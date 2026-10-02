"""Helpers partagés pour la clôture et l'archivage d'une culture.

Ces fonctions sont utilisées par cultures.py ET curing.py pour éviter
la duplication de logique et garantir que le statut d'une culture est
mis à jour correctement quelle que soit la route qui modifie le statut
des plantes.
"""
from collections import Counter
from datetime import date
from typing import Optional

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models import Culture, CultureEmplacement, Plant, ActionCalendrier, EspaceCulture, Graine, ProduitEngrais
from app.models.all_models import (
    HistoriqueCulture, HistoriquePlant,
    CultureLampe, Lampe, AppSettings, EspaceMateriel, Materiel, RecetteEngrais,
)


# ── Fermeture automatique de culture ─────────────────────────────────────────

def _maybe_close_culture(culture: Culture, db: Session) -> None:
    """Passe la culture en 'sechage_curing' si toutes les plantes ont fini la phase active."""
    plants = db.query(Plant).filter(Plant.id_culture == culture.id_culture).all()
    if not plants:
        return
    statuts_finis = {"sechage", "recolte", "curing", "prete", "abandonne", "wpff"}
    all_done = all(p.statut in statuts_finis for p in plants)
    if all_done and culture.statut == "active":
        has_recolte = any(p.statut in {"sechage", "recolte", "curing", "prete", "wpff"} for p in plants)
        culture.statut = "sechage_curing" if has_recolte else "terminee"
        culture.date_fin = date.today()
        db.commit()


# ── Archivage automatique dans HistoriqueCulture ─────────────────────────────

def _maybe_archive_culture(culture: Culture, db: Session) -> None:
    """Archive la culture dans HistoriqueCulture quand toutes les plantes sont effectivement terminées.
    Statuts considérés comme terminaux : curing (poids sec déjà enregistré), prete, wpff, abandonne.
    La culture passe en 'terminee'."""
    plants = db.query(Plant).filter(Plant.id_culture == culture.id_culture).all()
    if not plants:
        return
    # curing = poids sec déjà enregistré au début du curing → considéré comme terminal pour l'archivage
    STATUTS_ARCHIVES = {"curing", "prete", "abandonne", "wpff"}
    if not all(p.statut in STATUTS_ARCHIVES for p in plants):
        return
    # Ne pas créer un double archivage
    existing = db.query(HistoriqueCulture).filter(
        HistoriqueCulture.id_espace == culture.id_espace,
        HistoriqueCulture.date_debut == culture.date_debut,
    ).first()
    if existing:
        return

    # Créer l'entrée historique
    today = date.today()

    # Auto-populate : tente = nom de l'espace de culture
    tente = None
    if culture.id_espace:
        espace = db.query(EspaceCulture).filter(EspaceCulture.id_espace == culture.id_espace).first()
        if espace:
            tente = espace.nom

    # Auto-populate : substrat majoritaire parmi les plantes récoltées
    substrat_auto = None
    substrats = [p.substrat for p in plants if p.substrat and p.statut != "abandonne"]
    if substrats:
        substrat_auto = Counter(substrats).most_common(1)[0][0]

    # Auto-populate : lampe(s) depuis l'espace de culture (Materiel) ou CultureLampe (legacy)
    lampe_auto = None
    if culture.id_espace:
        mats_lampe = (
            db.query(Materiel)
            .join(EspaceMateriel, EspaceMateriel.id_materiel == Materiel.id_materiel)
            .filter(EspaceMateriel.id_espace == culture.id_espace)
            .filter(Materiel.categorie == "Lampes")
            .all()
        )
        if mats_lampe:
            lampe_auto = ", ".join(m.nom for m in mats_lampe)
    if not lampe_auto:
        # Fallback legacy : CultureLampe → Lampe.marque
        lampes_legacy = (
            db.query(Lampe)
            .join(CultureLampe, CultureLampe.id_lampe == Lampe.id_lampe)
            .filter(CultureLampe.id_culture == culture.id_culture)
            .all()
        )
        if lampes_legacy:
            noms = [l.marque.nom_marque for l in lampes_legacy if l.marque]
            lampe_auto = ", ".join(noms) if noms else None

    # Auto-populate : engrais depuis la relation Culture.engrais (CultureEngrais)
    engrais_auto = None
    if culture.engrais:
        noms_engrais = [e.nom_engrais for e in culture.engrais if e.nom_engrais]
        if noms_engrais:
            engrais_auto = ", ".join(noms_engrais)

    historique = HistoriqueCulture(
        id_culture=culture.id_culture,
        date_debut=culture.date_debut,
        date_fin=culture.date_fin or today,
        id_espace=culture.id_espace,
        nom=culture.nom,
        type_culture=culture.type_eclairage,
        tente=tente,
        substrat=substrat_auto,
        lampe=lampe_auto,
        engrais=engrais_auto,
        notes=culture.notes,
    )
    db.add(historique)
    db.flush()  # pour obtenir l'id

    # Créer une ligne par plante récoltée
    for plant in plants:
        if plant.statut == "abandonne":
            continue
        nom_variete = None
        id_variete = None
        prix_graine = None
        if plant.id_graine:
            graine = db.query(Graine).filter(Graine.id_graine == plant.id_graine).first()
            if graine:
                id_variete = graine.id_variete
                if graine.variete:
                    nom_variete = graine.variete.nom_variete
                prix_graine = float(graine.prix_achat) if graine.prix_achat else None

        hp = HistoriquePlant(
            id_historique_culture=historique.id_historique_culture,
            id_variete=id_variete,
            variete_nom=nom_variete,
            numero_plant=plant.numero_plant,
            date_debut_plant=plant.date_germination or culture.date_debut,
            date_fin_plant=plant.date_fin_sechage or today,
            prix_graine=prix_graine,
            quantite_recoltee=float(plant.poids_recolte_g) if plant.poids_recolte_g else None,
            notes=plant.notes,
        )
        db.add(hp)

    # ── Calcul des coûts à la clôture ──────────────────────────────────────
    couts = _compute_culture_cost(culture.id_culture, db, date_fin_override=today)
    historique.cout_engrais      = couts["cout_engrais"]
    historique.cout_electricite  = couts["cout_electricite"]
    historique.cout_graines      = couts["cout_graines"]
    historique.cout_total        = couts["cout_total"]
    historique.cout_par_gramme   = couts["cout_par_gramme"]
    historique.puissance         = couts["puissance_w"] or historique.puissance

    # Passer la culture en terminée
    culture.statut = "terminee"
    if not culture.date_fin:
        culture.date_fin = today
    db.commit()


# ── Calcul des coûts d'une culture ───────────────────────────────────────────

def _compute_culture_cost(id_culture: int, db: Session, date_fin_override=None) -> dict:
    """Calcule les coûts d'une culture : électricité, engrais, graines.
    Retourne un dict avec les montants en € (None si pas calculable).
    """
    culture = db.query(Culture).filter(Culture.id_culture == id_culture).first()
    if not culture:
        return {"cout_engrais": None, "cout_electricite": None, "cout_graines": None,
                "cout_total": None, "cout_par_gramme": None, "puissance_w": None}

    today = date.today()
    date_debut = culture.date_debut or today
    date_fin   = date_fin_override or culture.date_fin or today

    # ── Prix kWh depuis AppSettings ──────────────────────────────────────────
    setting = db.query(AppSettings).filter(AppSettings.cle == "prix_kwh").first()
    prix_kwh = float(setting.valeur) if setting and setting.valeur else 0.18

    # ── Puissance totale des lampes ──────────────────────────────────────────
    # Source 1 : lampes dans l'espace de culture (Materiel.caracteristiques.puissance_w)
    puissance_w = 0
    equip_rows = []
    if culture.id_espace:
        equip_rows = (
            db.query(Materiel)
            .join(EspaceMateriel, EspaceMateriel.id_materiel == Materiel.id_materiel)
            .filter(EspaceMateriel.id_espace == culture.id_espace)
            .filter(Materiel.categorie == "Lampes")
            .all()
        )
        for mat in equip_rows:
            carac = mat.caracteristiques or {}
            pw = carac.get("puissance_w")
            if pw:
                try:
                    puissance_w += int(pw)
                except (ValueError, TypeError):
                    pass
    # Source 2 (legacy) : CultureLampe → Lampe.puissance_lampe
    if puissance_w == 0:
        lampes = (
            db.query(Lampe)
            .join(CultureLampe, CultureLampe.id_lampe == Lampe.id_lampe)
            .filter(CultureLampe.id_culture == id_culture)
            .all()
        )
        puissance_w = sum(l.puissance_lampe for l in lampes if l.puissance_lampe) or 0

    # ── Coût électricité ─────────────────────────────────────────────────────
    date_flo = culture.date_debut_floraison or culture.date_passage_12_12

    actions_intensite = (
        db.query(ActionCalendrier)
        .filter(
            ActionCalendrier.id_culture == id_culture,
            ActionCalendrier.type_action == "intensite_lampe",
        )
        .order_by(ActionCalendrier.date_action)
        .all()
    )

    def _kw_for_lamp(id_mat: int, pwr_w: int) -> float:
        lamp_actions = [
            a for a in actions_intensite
            if (a.parametres or {}).get("id_lampe_materiel") in (None, id_mat)
        ]
        bkpts = [(date_debut, 100.0)]
        for act in lamp_actions:
            d = act.date_action
            val = (act.parametres or {}).get("puissance_apres")
            if val is not None and date_debut <= d <= date_fin:
                try:
                    bkpts.append((d, float(val)))
                except (ValueError, TypeError):
                    pass
        bkpts.append((date_fin, None))

        kw = pwr_w / 1000
        total = 0.0
        for i in range(len(bkpts) - 1):
            seg_start, intensite_pct = bkpts[i]
            seg_end = bkpts[i + 1][0]
            if seg_start >= seg_end:
                continue
            if date_flo and seg_start < date_flo < seg_end:
                subs = [(seg_start, date_flo, 18), (date_flo, seg_end, 12)]
            else:
                h = 12 if (date_flo and seg_start >= date_flo) else 18
                subs = [(seg_start, seg_end, h)]
            for sub_s, sub_e, h in subs:
                j = max((sub_e - sub_s).days, 0)
                total += kw * (intensite_pct / 100) * h * j * prix_kwh
        return total

    cout_electricite = 0.0
    if culture.id_espace:
        for mat in equip_rows:
            carac = mat.caracteristiques or {}
            pw = carac.get("puissance_w")
            if pw:
                try:
                    cout_electricite += _kw_for_lamp(mat.id_materiel, int(pw))
                except (ValueError, TypeError):
                    pass
    elif puissance_w > 0:
        cout_electricite = _kw_for_lamp(-1, puissance_w)

    cout_electricite = round(cout_electricite, 2)

    # ── Coût engrais ─────────────────────────────────────────────────────────
    actions_arrosage = db.query(ActionCalendrier).filter(
        ActionCalendrier.id_culture == id_culture,
        ActionCalendrier.type_action == "arrosage_engrais",
    ).all()

    def _to_small_unit(val: float, unite: str) -> float:
        """Normalise L→mL et Kg→g pour homogénéiser les calculs de coût."""
        if unite and unite.lower() in ('l', 'kg'):
            return val * 1000.0
        return val

    cout_engrais = 0.0
    for action in actions_arrosage:
        p = action.parametres or {}
        id_recette = p.get("id_recette")
        volume_l   = float(p.get("volume_l") or 1.0)
        if not id_recette:
            continue
        recette = db.query(RecetteEngrais).filter(RecetteEngrais.id_recette == id_recette).first()
        if not recette:
            continue
        for ligne in recette.lignes:
            prod = db.query(ProduitEngrais).filter(ProduitEngrais.id_produit == ligne.id_produit).first()
            if not prod or not prod.prix_achat or not prod.volume_conditionnement:
                continue
            # Quantité utilisée en petite unité (mL ou g)
            qte_utilisee = _to_small_unit(float(ligne.dosage) * volume_l, ligne.unite or 'mL')
            # Taille du flacon en petite unité (mL ou g) — évite la confusion €/L vs €/mL
            base = _to_small_unit(float(prod.volume_conditionnement), prod.unite_volume or 'mL')
            if not base:
                continue
            cout_engrais += qte_utilisee * (float(prod.prix_achat) / base)

    cout_engrais = round(cout_engrais, 2)

    # ── Coût graines ─────────────────────────────────────────────────────────
    plants = db.query(Plant).filter(Plant.id_culture == id_culture).all()
    cout_graines = 0.0
    for plant in plants:
        if plant.id_graine:
            graine = db.query(Graine).filter(Graine.id_graine == plant.id_graine).first()
            if graine and graine.prix_achat:
                cout_graines += float(graine.prix_achat)
    cout_graines = round(cout_graines, 2)

    # ── Total & €/g ──────────────────────────────────────────────────────────
    cout_total = round(cout_electricite + cout_engrais + cout_graines, 2)
    total_g = sum(float(p.poids_recolte_g) for p in plants if p.poids_recolte_g)
    cout_par_gramme = round(cout_total / total_g, 4) if total_g > 0 else None

    return {
        "cout_engrais":     cout_engrais if cout_engrais > 0 else None,
        "cout_electricite": cout_electricite,
        "cout_graines":     cout_graines if cout_graines > 0 else None,
        "cout_total":       cout_total if cout_total > 0 else None,
        "cout_par_gramme":  cout_par_gramme,
        "puissance_w":      puissance_w,
    }


# ── Historique des emplacements (déplacement de culture) ─────────────────────

def serialize_emplacement(row: CultureEmplacement, db: Session) -> dict:
    nom = None
    if row.id_espace:
        esp = db.query(EspaceCulture).filter(EspaceCulture.id_espace == row.id_espace).first()
        nom = esp.nom if esp else None
    return {
        "id_emplacement": row.id_emplacement,
        "id_culture": row.id_culture,
        "id_espace": row.id_espace,
        "nom_espace": nom,
        "date_debut": row.date_debut,
        "date_fin": row.date_fin,
    }


def list_emplacements(db: Session, id_culture: int) -> list[dict]:
    rows = (
        db.query(CultureEmplacement)
        .filter(CultureEmplacement.id_culture == id_culture)
        .order_by(CultureEmplacement.date_debut.desc(), CultureEmplacement.id_emplacement.desc())
        .all()
    )
    return [serialize_emplacement(r, db) for r in rows]


def ensure_initial_emplacement(db: Session, culture: Culture) -> Optional[CultureEmplacement]:
    """Crée l'affectation initiale si la culture a un espace et aucun historique."""
    if not culture.id_espace:
        return None
    existing = (
        db.query(CultureEmplacement)
        .filter(CultureEmplacement.id_culture == culture.id_culture)
        .first()
    )
    if existing:
        return existing
    row = CultureEmplacement(
        id_culture=culture.id_culture,
        id_espace=culture.id_espace,
        date_debut=culture.date_debut or date.today(),
        date_fin=None,
    )
    db.add(row)
    db.flush()
    return row


def espace_id_at(
    emplacements: list[CultureEmplacement],
    jour: date,
    fallback: Optional[int] = None,
) -> Optional[int]:
    """Espace de la culture à `jour`. Intervalle [date_debut, date_fin)."""
    covering = [
        e for e in emplacements
        if e.date_debut <= jour and (e.date_fin is None or jour < e.date_fin)
    ]
    if covering:
        covering.sort(key=lambda e: e.date_debut, reverse=True)
        return covering[0].id_espace
    if not emplacements:
        return fallback
    first = min(emplacements, key=lambda e: e.date_debut)
    if jour < first.date_debut:
        return first.id_espace
    last = max(emplacements, key=lambda e: (e.date_debut, e.id_emplacement or 0))
    return last.id_espace


def deplacer_culture(db: Session, culture: Culture, id_espace: int, date_deplacement: date) -> Culture:
    """Clôture l'affectation courante et ouvre la nouvelle. Met à jour culture.id_espace."""
    if date_deplacement is None:
        raise HTTPException(status_code=400, detail="La date de déplacement est obligatoire")

    espace = db.query(EspaceCulture).filter(EspaceCulture.id_espace == id_espace).first()
    if not espace:
        raise HTTPException(status_code=404, detail="Espace de culture introuvable")

    if culture.id_espace == id_espace:
        raise HTTPException(status_code=400, detail="La culture est déjà dans cet espace")

    occupant = (
        db.query(Culture)
        .filter(
            Culture.id_espace == id_espace,
            Culture.statut.in_(["active", "sechage_curing"]),
            Culture.id_culture != culture.id_culture,
        )
        .first()
    )
    if occupant:
        raise HTTPException(
            status_code=409,
            detail=f"L'espace « {espace.nom} » est déjà occupé par « {occupant.nom} ».",
        )

    ensure_initial_emplacement(db, culture)

    courant = (
        db.query(CultureEmplacement)
        .filter(
            CultureEmplacement.id_culture == culture.id_culture,
            CultureEmplacement.date_fin.is_(None),
        )
        .order_by(CultureEmplacement.date_debut.desc())
        .first()
    )
    if courant:
        if date_deplacement < courant.date_debut:
            raise HTTPException(
                status_code=400,
                detail="La date de déplacement doit être postérieure ou égale au début de l'affectation actuelle",
            )
        courant.date_fin = date_deplacement

    db.add(CultureEmplacement(
        id_culture=culture.id_culture,
        id_espace=id_espace,
        date_debut=date_deplacement,
        date_fin=None,
    ))
    culture.id_espace = id_espace
    db.flush()
    return culture


def corriger_date_emplacement(
    db: Session,
    culture: Culture,
    id_emplacement: int,
    nouvelle_date: date,
) -> Culture:
    """Modifie la date de début d'une affectation et recale la date_fin du voisin précédent."""
    if nouvelle_date is None:
        raise HTTPException(status_code=400, detail="La date de début est obligatoire")

    row = (
        db.query(CultureEmplacement)
        .filter(
            CultureEmplacement.id_emplacement == id_emplacement,
            CultureEmplacement.id_culture == culture.id_culture,
        )
        .first()
    )
    if not row:
        raise HTTPException(status_code=404, detail="Affectation introuvable")

    if nouvelle_date == row.date_debut:
        return culture

    rows = (
        db.query(CultureEmplacement)
        .filter(CultureEmplacement.id_culture == culture.id_culture)
        .order_by(CultureEmplacement.date_debut.asc(), CultureEmplacement.id_emplacement.asc())
        .all()
    )
    idx = next((i for i, r in enumerate(rows) if r.id_emplacement == id_emplacement), None)
    if idx is None:
        raise HTTPException(status_code=404, detail="Affectation introuvable")

    precedent = rows[idx - 1] if idx > 0 else None
    suivant = rows[idx + 1] if idx + 1 < len(rows) else None

    if precedent is None:
        if culture.date_debut and nouvelle_date < culture.date_debut:
            raise HTTPException(
                status_code=400,
                detail="La date ne peut pas être antérieure au début de la culture",
            )
    else:
        if nouvelle_date <= precedent.date_debut:
            raise HTTPException(
                status_code=400,
                detail="La date doit être postérieure au début de l'affectation précédente",
            )

    fin_effective = row.date_fin
    if suivant and (fin_effective is None or suivant.date_debut < fin_effective):
        fin_effective = suivant.date_debut
    if fin_effective is not None and nouvelle_date >= fin_effective:
        raise HTTPException(
            status_code=400,
            detail="La date créerait un intervalle vide ou négatif",
        )

    row.date_debut = nouvelle_date
    if precedent:
        precedent.date_fin = nouvelle_date

    db.flush()

    tous = (
        db.query(CultureEmplacement)
        .filter(CultureEmplacement.id_culture == culture.id_culture)
        .order_by(CultureEmplacement.date_debut.asc(), CultureEmplacement.id_emplacement.asc())
        .all()
    )
    courants = [r for r in tous if r.date_fin is None]
    if len(courants) != 1:
        raise HTTPException(
            status_code=400,
            detail="Cette modification casserait l'affectation courante",
        )
    for i, r in enumerate(tous):
        if r.date_fin is not None and r.date_debut >= r.date_fin:
            raise HTTPException(
                status_code=400,
                detail="La date créerait un intervalle vide ou négatif",
            )
        if i + 1 < len(tous):
            nxt = tous[i + 1]
            if r.date_fin != nxt.date_debut or nxt.date_debut <= r.date_debut:
                raise HTTPException(
                    status_code=400,
                    detail="Cette date chevaucherait une autre affectation",
                )

    culture.id_espace = courants[0].id_espace
    db.flush()
    return culture
