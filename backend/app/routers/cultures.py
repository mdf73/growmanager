"""Router Culture — V2 complète"""
import logging
from datetime import date, timedelta, datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import extract
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Culture, Plant, ActionCalendrier, EspaceCulture, Graine, ProduitEngrais, Stock
from app.models.all_models import RecetteEngrais, RecetteTCO, HistoriqueCulture, HistoriquePlant, RecetteLSO, CultureLampe, Lampe, AppSettings, EspaceMateriel, Materiel
from app.schemas.culture import (
    CultureCreate, CultureUpdate, CultureRead, CultureWithDetails,
    PlantCreate, PlantUpdate, PlantRead,
    ActionCreate, ActionRead,
    PlantTransferPayload,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/cultures", tags=["cultures"])


# ─── Helpers ──────────────────────────────────────────────────────────────────

def _enrich_plant(plant: Plant, db: Session) -> dict:
    from app.models import RecetteLSO, Materiel as PotModel
    data = {
        "id_plant": plant.id_plant,
        "id_culture": plant.id_culture,
        "id_graine": plant.id_graine,
        "nom_affichage": plant.nom_affichage,
        "numero_plant": plant.numero_plant,
        "origine": plant.origine,
        "statut": plant.statut,
        "date_germination": plant.date_germination,
        "date_debut_flo": plant.date_debut_flo,
        "date_recolte": plant.date_recolte,
        "date_fin_sechage": plant.date_fin_sechage,
        "poids_recolte_g": float(plant.poids_recolte_g) if plant.poids_recolte_g else None,
        "substrat": plant.substrat,
        "id_recette_sol": plant.id_recette_sol,
        "nom_recette_sol": None,
        "id_pot": plant.id_pot,
        "taille_pot": None,
        "volume_pot_l": float(plant.volume_pot_l) if plant.volume_pot_l else None,
        "notes": plant.notes,
        "nom_variete": None,
        "nom_breeder": None,
        "duree_flo_min": None,
        "duree_flo_max": None,
    }
    if plant.id_graine:
        graine = db.query(Graine).filter(Graine.id_graine == plant.id_graine).first()
        if graine:
            data["duree_flo_min"] = graine.duree_flo_min
            data["duree_flo_max"] = graine.duree_flo_max
            if graine.variete:
                data["nom_variete"] = graine.variete.nom_variete
            if graine.breeder:
                data["nom_breeder"] = graine.breeder.nom_breeder
    if plant.id_recette_sol:
        recette = db.query(RecetteLSO).filter(RecetteLSO.id_recette_lso == plant.id_recette_sol).first()
        if recette:
            data["nom_recette_sol"] = recette.nom_recette
    if plant.id_pot:
        # id_pot stores id_materiel from the Materiel table (category Pots)
        pot = db.query(PotModel).filter(PotModel.id_materiel == plant.id_pot).first()
        if pot:
            data["taille_pot"] = (pot.caracteristiques or {}).get("volume")
    return data


def _enrich_action(action: ActionCalendrier, db: Session) -> dict:
    data = {
        "id_action": action.id_action,
        "id_plant": action.id_plant,
        "id_culture": action.id_culture,
        "date_action": action.date_action,
        "type_action": action.type_action,
        "parametres": action.parametres,
        "note": action.note,
        "global_culture": action.global_culture,
        "created_at": action.created_at,
        "nom_plant": None,
    }
    if action.id_plant:
        plant = db.query(Plant).filter(Plant.id_plant == action.id_plant).first()
        if plant:
            data["nom_plant"] = plant.nom_affichage
    return data


def _enrich_culture(culture: Culture, db: Session) -> dict:
    plants = db.query(Plant).filter(Plant.id_culture == culture.id_culture).all()
    # Auto-repair: si la culture est encore "active" mais toutes les plantes sont finies, on corrige
    if culture.statut == "active" and plants:
        _maybe_close_culture(culture, db)
    statuts_finis = {"recolte", "abandonne", "wpff"}
    nb_actives = sum(1 for p in plants if p.statut not in statuts_finis)
    jours = None
    if culture.date_debut:
        jours = (date.today() - culture.date_debut).days

    nom_espace = None
    if culture.id_espace:
        espace = db.query(EspaceCulture).filter(EspaceCulture.id_espace == culture.id_espace).first()
        if espace:
            nom_espace = espace.nom

    # Dernier arrosage (eau pure, engrais, TCO arrosage ou préparation TCO)
    _arrosage_types = ["arrosage_eau", "arrosage_engrais", "arrosage_tco", "preparation_tco"]
    last_arrosage = (
        db.query(ActionCalendrier)
        .filter(
            ActionCalendrier.id_culture == culture.id_culture,
            ActionCalendrier.type_action.in_(_arrosage_types),
        )
        .order_by(ActionCalendrier.date_action.desc())
        .first()
    )
    jours_depuis_arrosage = None
    if last_arrosage:
        last_date = last_arrosage.date_action
        if isinstance(last_date, str):
            last_date = date.fromisoformat(last_date)
        jours_depuis_arrosage = (date.today() - last_date).days

    # Dernier TCO (préparation uniquement)
    last_tco = (
        db.query(ActionCalendrier)
        .filter(
            ActionCalendrier.id_culture == culture.id_culture,
            ActionCalendrier.type_action == "preparation_tco",
        )
        .order_by(ActionCalendrier.date_action.desc())
        .first()
    )
    jours_depuis_tco = None
    if last_tco:
        last_tco_date = last_tco.date_action
        if isinstance(last_tco_date, str):
            last_tco_date = date.fromisoformat(last_tco_date)
        jours_depuis_tco = (date.today() - last_tco_date).days

    # Calcul de la fenêtre de récolte : première date (min des duree_flo_min) et
    # dernière date (max des duree_flo_max) parmi toutes les plantes de la culture.
    date_recolte_min: Optional[date] = None
    date_recolte_max: Optional[date] = None
    for p in plants:
        if not p.id_graine:
            continue
        g = db.query(Graine).filter(Graine.id_graine == p.id_graine).first()
        if not g:
            continue
        base = p.date_debut_flo or culture.date_debut_floraison or culture.date_passage_12_12
        if not base:
            continue
        if g.duree_flo_min:
            candidate_min = base + timedelta(days=g.duree_flo_min)
            if date_recolte_min is None or candidate_min < date_recolte_min:
                date_recolte_min = candidate_min
        if g.duree_flo_max:
            candidate_max = base + timedelta(days=g.duree_flo_max)
            if date_recolte_max is None or candidate_max > date_recolte_max:
                date_recolte_max = candidate_max

    return {
        "id_culture": culture.id_culture,
        "nom": culture.nom,
        "id_espace": culture.id_espace,
        "nom_espace": nom_espace,
        "statut": culture.statut,
        "date_debut": culture.date_debut,
        "date_fin": culture.date_fin,
        "date_passage_12_12": culture.date_passage_12_12,
        "date_debut_floraison": culture.date_debut_floraison,
        "date_recolte_estimee": culture.date_recolte_estimee,
        "date_recolte_min": date_recolte_min,
        "date_recolte_max": date_recolte_max,
        "phase": culture.phase,
        "type_culture": culture.type_culture,
        "type_eclairage": culture.type_eclairage,
        "but_culture": culture.but_culture,
        "notes": culture.notes,
        "nb_plantes": len(plants),
        "nb_plantes_actives": nb_actives,
        "jours_culture": jours,
        "jours_depuis_dernier_arrosage": jours_depuis_arrosage,
        "jours_depuis_dernier_tco": jours_depuis_tco,
        "total_recolte_g": sum(float(p.poids_recolte_g) for p in plants if p.poids_recolte_g) or None,
    }


def _build_plant_name(graine: Optional[Graine], numero: int) -> str:
    if graine and graine.variete:
        return f"{graine.variete.nom_variete} #{graine.id_graine}"
    return f"Plant #{numero}"


def _maybe_close_culture(culture: Culture, db: Session) -> None:
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
    # Ne pas créer un double archivage (le check terminee est supprimé : close_culture en avait besoin)
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
        from collections import Counter
        substrat_auto = Counter(substrats).most_common(1)[0][0]

    historique = HistoriqueCulture(
        date_debut=culture.date_debut,
        date_fin=culture.date_fin or today,
        id_espace=culture.id_espace,
        nom=culture.nom,
        type_culture=culture.type_eclairage,
        tente=tente,
        substrat=substrat_auto,
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
    # Puissance lampe (dénormalisée)
    historique.puissance         = couts["puissance_w"] or historique.puissance

    # Passer la culture en terminée
    culture.statut = "terminee"
    if not culture.date_fin:
        culture.date_fin = today
    db.commit()


def _compute_culture_cost(id_culture: int, db: Session, date_fin_override=None) -> dict:
    """Calcule les coûts d'une culture : électricité, engrais, graines.
    Retourne un dict avec les montants en € (None si pas calculable).
    """
    from decimal import Decimal

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
    # Heures selon la phase : croissance = 18h, floraison = 12h
    # Intensité : 100% par défaut, modifiée par les actions intensite_lampe (dimmer)
    date_flo = culture.date_debut_floraison or culture.date_passage_12_12

    # Récupère les changements d'intensité triés par date
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
        """Calcule le coût électricité d'une lampe selon son historique d'intensité.
        Les actions sans id_lampe_materiel s'appliquent à toutes les lampes (legacy)."""
        lamp_actions = [
            a for a in actions_intensite
            if (a.parametres or {}).get("id_lampe_materiel") in (None, id_mat)
        ]

        # Points de changement d'intensité pour cette lampe
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
            # Découpage avant/après floraison
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
        # Calcul per-lampe depuis l'espace de culture
        for mat in equip_rows:
            carac = mat.caracteristiques or {}
            pw = carac.get("puissance_w")
            if pw:
                try:
                    cout_electricite += _kw_for_lamp(mat.id_materiel, int(pw))
                except (ValueError, TypeError):
                    pass
    elif puissance_w > 0:
        # Fallback legacy : une seule "lampe" globale sans id_materiel
        cout_electricite = _kw_for_lamp(-1, puissance_w)

    cout_electricite = round(cout_electricite, 2)

    # ── Coût engrais (arrosages avec RecetteEngrais liée) ────────────────────
    actions_arrosage = db.query(ActionCalendrier).filter(
        ActionCalendrier.id_culture == id_culture,
        ActionCalendrier.type_action == "arrosage_engrais",
    ).all()

    cout_engrais = 0.0
    for action in actions_arrosage:
        p = action.parametres or {}
        id_recette = p.get("id_recette")
        if not id_recette:
            continue
        # Pour les actions per-plante (global=False), préférer volume_par_plante_l
        # car volume_l peut contenir le volume TOTAL de la session (bug de stockage)
        if not action.global_culture and p.get("volume_par_plante_l"):
            raw_vol = p.get("volume_par_plante_l")
        else:
            raw_vol = p.get("volume_l")
        if not raw_vol:
            continue
        volume_l = float(raw_vol)
        recette = db.query(RecetteEngrais).filter(RecetteEngrais.id_recette == id_recette).first()
        if not recette:
            continue
        for ligne in recette.lignes:
            prod = db.query(ProduitEngrais).filter(ProduitEngrais.id_produit == ligne.id_produit).first()
            if not prod or not prod.prix_achat or not prod.volume_conditionnement:
                continue
            qte_utilisee = ligne.dosage * volume_l          # mL ou g utilisés
            prix_par_unite = float(prod.prix_achat) / float(prod.volume_conditionnement)
            cout_engrais += qte_utilisee * prix_par_unite

    cout_engrais = round(cout_engrais, 2)

    # ── Coût graines (depuis les plantes de la culture) ──────────────────────
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

    # Récolte totale (poids_recolte_g des plantes)
    total_g = sum(float(p.poids_recolte_g) for p in plants if p.poids_recolte_g)
    cout_par_gramme = round(cout_total / total_g, 4) if total_g > 0 else None

    return {
        "cout_engrais":     cout_engrais if cout_engrais > 0 else None,
        "cout_electricite": cout_electricite,   # toujours retourné (0 si pas de lampe)
        "cout_graines":     cout_graines if cout_graines > 0 else None,
        "cout_total":       cout_total if cout_total > 0 else None,
        "cout_par_gramme":  cout_par_gramme,
        "puissance_w":      puissance_w,        # 0 = aucune lampe liée
    }


def _compute_harvest_date(culture: Culture, db: Session) -> None:
    """Calcule date_recolte_estimee = dernier jour de récolte possible de la box.
    = date_debut_flo de la plante + duree_flo_max de sa variété (valeur max parmi toutes les plantes).
    Utilise date_debut_flo individuelle si dispo, sinon date_debut_floraison de la culture en fallback."""
    plants = db.query(Plant).filter(Plant.id_culture == culture.id_culture).all()
    latest: Optional[date] = None
    for p in plants:
        if not p.id_graine:
            continue
        g = db.query(Graine).filter(Graine.id_graine == p.id_graine).first()
        if not g:
            continue
        duree_max = g.duree_flo_max or g.duree_flo_min
        if not duree_max:
            continue
        # Date de référence : date_debut_flo de la plante, ou fallback sur la culture
        base = p.date_debut_flo or culture.date_debut_floraison or culture.date_passage_12_12
        if not base:
            continue
        candidate = base + timedelta(days=duree_max)
        if latest is None or candidate > latest:
            latest = candidate
    if latest:
        culture.date_recolte_estimee = latest
        db.commit()


def _handle_action_effects(action: ActionCalendrier, culture: Culture, db: Session) -> None:
    t = action.type_action
    p = action.parametres or {}
    pid = action.id_plant

    def get_plant(plant_id):
        if plant_id:
            return db.query(Plant).filter(Plant.id_plant == plant_id).first()
        return None

    def set_statut(plant_id, new_statut):
        # Les actions globales sont éclatées par plante en amont (create_action),
        # donc plant_id est toujours renseigné ici.
        if plant_id:
            pl = get_plant(plant_id)
            if pl:
                pl.statut = new_statut

    if t == "graine_germee":
        set_statut(pid, "germination")
        pl = get_plant(pid)
        if pl:
            pl.date_germination = action.date_action
    elif t == "debut_croissance":
        # Début croissance : plant en veg + phase culture = croissance
        set_statut(pid, "veg")
        if not culture.date_debut_croissance:
            culture.date_debut_croissance = action.date_action
        culture.phase = "croissance"
    elif t == "debut_floraison":
        # Début floraison : plant en floraison + phase culture = floraison
        # + met à jour date_debut_flo (plante) et date_debut_floraison (culture)
        # + recalcule la date de récolte estimée
        # + crée automatiquement les actions recolte_prevue par plante
        set_statut(pid, "floraison")
        if not culture.date_debut_floraison:
            culture.date_debut_floraison = action.date_action
        culture.phase = "floraison"

        # La plante concernée (les actions globales sont éclatées en actions par plante en amont)
        pl = get_plant(pid)
        plants_flo = [pl] if pl else []

        # Mettre à jour date_debut_flo sur chaque plante + créer actions recolte_prevue
        base_date = action.date_action
        if isinstance(base_date, str):
            base_date = date.fromisoformat(base_date)

        for pl_flo in plants_flo:
            # Fixer date_debut_flo si pas encore fait
            if not pl_flo.date_debut_flo:
                pl_flo.date_debut_flo = base_date

            # Calcul de la date de récolte prévue pour ce plant (durées en jours)
            predicted_min: Optional[date] = None
            predicted_max: Optional[date] = None
            if pl_flo.id_graine:
                g = db.query(Graine).filter(Graine.id_graine == pl_flo.id_graine).first()
                if g:
                    if g.duree_flo_min:
                        predicted_min = base_date + timedelta(days=g.duree_flo_min)
                    if g.duree_flo_max:
                        predicted_max = base_date + timedelta(days=g.duree_flo_max)

            # Date médiane pour l'action principale
            if predicted_min and predicted_max:
                mid_days = (predicted_min.toordinal() + predicted_max.toordinal()) // 2
                predicted_mid = date.fromordinal(mid_days)
            elif predicted_min or predicted_max:
                predicted_mid = predicted_min or predicted_max
            else:
                # Fallback sur date_recolte_estimee de la culture
                predicted_mid = culture.date_recolte_estimee

            if predicted_mid:
                # Supprimer les anciennes prévisions pour éviter les doublons
                db.query(ActionCalendrier).filter(
                    ActionCalendrier.id_culture == culture.id_culture,
                    ActionCalendrier.id_plant == pl_flo.id_plant,
                    ActionCalendrier.type_action == "recolte_prevue",
                ).delete(synchronize_session=False)

                params: dict = {}
                if predicted_min:
                    params["date_min"] = str(predicted_min)
                if predicted_max:
                    params["date_max"] = str(predicted_max)
                # Stocker le nom de la variété pour affichage dans le calendrier
                if pl_flo.id_graine:
                    _g = db.query(Graine).filter(Graine.id_graine == pl_flo.id_graine).first()
                    if _g and _g.variete:
                        params["nom_variete"] = _g.variete.nom_variete

                db.add(ActionCalendrier(
                    id_culture=culture.id_culture,
                    id_plant=pl_flo.id_plant,
                    date_action=predicted_mid,
                    type_action="recolte_prevue",
                    parametres=params if params else None,
                    global_culture=False,
                ))

        _compute_harvest_date(culture, db)
    elif t == "passage_12_12":
        culture.date_passage_12_12 = action.date_action
        _compute_harvest_date(culture, db)
    elif t == "deces_plante":
        set_statut(pid, "abandonne")
        _maybe_close_culture(culture, db)

    elif t == "recolte":
        # Récolte → plant(s) en séchage, date_recolte enregistrée
        if action.global_culture:
            # Toutes les plantes actives → séchage
            _active_statuts = {"germination", "veg", "floraison"}
            all_active = db.query(Plant).filter(
                Plant.id_culture == culture.id_culture,
                Plant.statut.in_(_active_statuts),
            ).all()
            for _pl in all_active:
                _pl.statut = "sechage"
                _pl.date_recolte = action.date_action
        else:
            pl = get_plant(pid)
            if pl:
                pl.statut = "sechage"
                pl.date_recolte = action.date_action
        _maybe_close_culture(culture, db)

    elif t == "debut_curing":
        # Début curing : fin du séchage, poids enregistré, plant = curing
        # Le stock est créé à fin_curing (quand le curing est réellement terminé)
        pl = get_plant(pid)
        if pl:
            pl.statut = "curing"
            pl.date_fin_sechage = action.date_action
            poids = p.get("poids_g")
            if poids:
                pl.poids_recolte_g = float(poids)
        _maybe_close_culture(culture, db)

    elif t == "fin_curing":
        # Fin curing : plant = prete, entrée stock fleur créée avec toutes les infos de culture
        pl = get_plant(pid)
        if pl:
            pl.statut = "prete"
            poids = float(pl.poids_recolte_g) if pl.poids_recolte_g else None
            if poids and pl.id_graine:
                graine = db.query(Graine).filter(Graine.id_graine == pl.id_graine).first()
                if graine and graine.id_variete:

                    # ── 1. Type de culture → sous_type_stock (indoor / outdoor / autre) ──
                    sous_type = (culture.type_culture or "").lower() or "disponible"

                    # ── 2. Lampe utilisée → cherche la dernière action mise_sous_led/neons ──
                    lampe_action = (
                        db.query(ActionCalendrier)
                        .filter(
                            ActionCalendrier.id_culture == culture.id_culture,
                            ActionCalendrier.type_action.in_(["mise_sous_led", "mise_sous_neons"]),
                        )
                        .order_by(ActionCalendrier.date_action.desc())
                        .first()
                    )
                    lampe_type = None
                    if lampe_action and lampe_action.parametres:
                        lampe_type = lampe_action.parametres.get("nom_lampe")

                    # ── 3. Substrat / engrais → depuis la plante ──────────────────────────
                    engrais_type = pl.substrat or None
                    if pl.substrat == "sol_vivant" and pl.id_recette_sol:
                        recette = db.query(RecetteLSO).filter(
                            RecetteLSO.id_recette_lso == pl.id_recette_sol
                        ).first()
                        if recette:
                            engrais_type = f"Sol Vivant — {recette.nom_recette}"
                    elif pl.substrat and pl.substrat != "sol_vivant":
                        # Substrat standard, on capitalise pour l'affichage
                        engrais_type = pl.substrat.replace("_", " ").capitalize()

                    stock_entry = Stock(
                        id_variete=graine.id_variete,
                        type_stock="fleur",
                        sous_type_stock=sous_type,
                        lampe_type=lampe_type,
                        engrais_type=engrais_type,
                        date_stock=action.date_action,
                        quantite_stock=poids,
                        quantite_initiale=poids,   # V4-G — référence pour alertes %
                    )
                    db.add(stock_entry)
        _maybe_close_culture(culture, db)
        _maybe_archive_culture(culture, db)

    elif t == "prete":
        # Conservé pour compatibilité avec les actions existantes
        pl = get_plant(pid)
        if pl:
            pl.statut = "prete"
        _maybe_close_culture(culture, db)
        _maybe_archive_culture(culture, db)

    elif t == "ouverture_bocal":
        # Ouverture bocal de curing — juste enregistrée dans le calendrier
        # parametres: { duree_min: 5|10|15|20|30|45|60 }
        pass  # Aucun changement de statut, action purement calendaire

    elif t == "fin_sechage":
        # Conservé pour compatibilité avec les actions existantes
        pl = get_plant(pid)
        if pl:
            pl.statut = "recolte"
            pl.date_fin_sechage = action.date_action
            poids = p.get("poids_g")
            if poids:
                pl.poids_recolte_g = poids
        _maybe_close_culture(culture, db)

    elif t == "arrosage_engrais":
        # Déduction stock : via recette (recommandé) ou liste manuelle (legacy)
        id_recette = p.get("id_recette")
        volume_l = float(p.get("volume_l") or 1.0)
        if id_recette:
            recette = db.query(RecetteEngrais).filter(RecetteEngrais.id_recette == id_recette).first()
            if recette:
                for ligne in recette.lignes:
                    qte_calculee = float(ligne.dosage) * volume_l  # dosage en mL/L ou g/L
                    prod = db.query(ProduitEngrais).filter(ProduitEngrais.id_produit == ligne.id_produit).first()
                    if prod and prod.quantite_stock is not None:
                        prod.quantite_stock = max(0, float(prod.quantite_stock) - qte_calculee)
        else:
            # Legacy : liste manuelle de produits
            for item in p.get("produits", []):
                pid_prod = item.get("id_produit")
                qte = item.get("quantite", 0)
                if pid_prod and qte:
                    prod = db.query(ProduitEngrais).filter(ProduitEngrais.id_produit == pid_prod).first()
                    if prod and prod.quantite_stock is not None:
                        prod.quantite_stock = max(0, float(prod.quantite_stock) - float(qte))

    elif t == "preparation_tco":
        # Déduction stock TCO — les amendements sont retirés lors de la préparation
        id_recette_tco = p.get("id_recette_tco")
        volume_l = float(p.get("volume_l") or 1.0)
        if id_recette_tco:
            recette = db.query(RecetteTCO).filter(RecetteTCO.id_recette_tco == id_recette_tco).first()
            if recette and recette.quantite_tco and recette.quantite_tco > 0:
                scale = volume_l / float(recette.quantite_tco)
                for ligne in recette.lignes:
                    qte_calculee = float(ligne.quantite) * scale
                    prod = db.query(ProduitEngrais).filter(ProduitEngrais.id_produit == ligne.id_produit).first()
                    if prod and prod.quantite_stock is not None:
                        prod.quantite_stock = max(0, float(prod.quantite_stock) - qte_calculee)
        # arrosage_tco : PAS de déduction stock (déjà fait à la préparation)

    elif t == "rempotage":
        # Mise à jour du pot et du volume — action toujours par plante (éclatée en amont)
        id_materiel_pot = p.get("id_materiel_pot")
        volume_pot_l = p.get("volume_pot_l")
        pl = get_plant(pid)
        if pl:
            if id_materiel_pot:
                pl.id_pot = id_materiel_pot
            if volume_pot_l:
                pl.volume_pot_l = volume_pot_l

    elif t in ("pincage", "detection_maladie", "detection_parasite", "traitement"):
        # Actions informationnelles : enregistrées telles quelles, sans effet de bord
        pass

    db.commit()


# ═══════════════════════════════════════════════════════════════════════════════
# COMPARAISON INTER-CULTURES
# ═══════════════════════════════════════════════════════════════════════════════

@router.get("/compare")
def compare_cultures(ids: str = Query(..., description="IDs séparés par virgule, ex: 1,2,3"), db: Session = Depends(get_db)):
    """Compare 2 à 3 cultures : métriques clés + données pour graphiques superposés."""
    from collections import Counter
    try:
        id_list = [int(x.strip()) for x in ids.split(",") if x.strip()]
    except ValueError:
        raise HTTPException(status_code=400, detail="ids doit être une liste d'entiers séparés par des virgules")
    if len(id_list) < 2 or len(id_list) > 3:
        raise HTTPException(status_code=400, detail="Sélectionnez entre 2 et 3 cultures")

    today = date.today()
    results = []

    for cid in id_list:
        culture = db.query(Culture).filter(Culture.id_culture == cid).first()
        if not culture:
            raise HTTPException(status_code=404, detail=f"Culture {cid} introuvable")

        plants = db.query(Plant).filter(Plant.id_culture == cid).all()

        # ── Durées ───────────────────────────────────────────────────────────
        date_debut = culture.date_debut
        date_fin   = culture.date_fin or today
        date_flo   = culture.date_debut_floraison or culture.date_passage_12_12

        duree_totale_j = (date_fin - date_debut).days if date_debut else None
        duree_veg_j    = (date_flo - date_debut).days if date_debut and date_flo else None
        duree_flo_j    = (date_fin - date_flo).days if date_flo else None

        # ── Rendement ────────────────────────────────────────────────────────
        STATUTS_RECOLTE = {"recolte", "prete", "curing", "wpff", "sechage"}
        plantes_recoltees = [p for p in plants if p.statut in STATUTS_RECOLTE and p.poids_recolte_g]
        nb_plantes        = len(plants)
        nb_recoltees      = len(plantes_recoltees)
        rendement_total_g = sum(float(p.poids_recolte_g) for p in plantes_recoltees) if plantes_recoltees else None
        rendement_par_plante_g = round(rendement_total_g / nb_recoltees, 1) if rendement_total_g and nb_recoltees else None

        # ── Coûts ────────────────────────────────────────────────────────────
        couts = _compute_culture_cost(cid, db)

        # ── Espace / tente ────────────────────────────────────────────────────
        nom_espace = None
        if culture.id_espace:
            espace = db.query(EspaceCulture).filter(EspaceCulture.id_espace == culture.id_espace).first()
            if espace:
                nom_espace = espace.nom

        # ── Lampes (nom + wattage) ────────────────────────────────────────────
        lampes_info = []
        puissance_w_total = 0
        if culture.id_espace:
            mats = (
                db.query(Materiel)
                .join(EspaceMateriel, EspaceMateriel.id_materiel == Materiel.id_materiel)
                .filter(EspaceMateriel.id_espace == culture.id_espace)
                .filter(Materiel.categorie == "Lampes")
                .all()
            )
            for m in mats:
                carac = m.caracteristiques or {}
                pw = carac.get("puissance_w")
                try:
                    pw_int = int(pw) if pw else None
                except (ValueError, TypeError):
                    pw_int = None
                if pw_int:
                    puissance_w_total += pw_int
                lampes_info.append({
                    "nom":        m.nom,
                    "marque":     m.marque,
                    "puissance_w": pw_int,
                })
        # Fallback legacy CultureLampe → Lampe
        if not lampes_info:
            legacy_lampes = (
                db.query(Lampe)
                .join(CultureLampe, CultureLampe.id_lampe == Lampe.id_lampe)
                .filter(CultureLampe.id_culture == cid)
                .all()
            )
            for l in legacy_lampes:
                pw = l.puissance_lampe or 0
                puissance_w_total += pw
                lampes_info.append({
                    "nom":        f"Lampe {pw}W",
                    "marque":     None,
                    "puissance_w": pw,
                })

        # ── Actions ───────────────────────────────────────────────────────────
        actions = (
            db.query(ActionCalendrier)
            .filter(ActionCalendrier.id_culture == cid)
            .order_by(ActionCalendrier.date_action)
            .all()
        )

        plants_map = {p.id_plant: p.nom_affichage for p in plants}

        # ── LSO ou engrais conventionnel ──────────────────────────────────────
        is_lso = any(p.substrat == "sol_vivant" or p.id_recette_sol for p in plants)
        # Fallback : s'il y a des actions preparation_tco → LSO
        if not is_lso:
            is_lso = any(a.type_action == "preparation_tco" for a in actions)

        tco_par_type: dict = {}
        marques_engrais: list = []

        if is_lso:
            # Compter les TCO par type (Croissance, Floraison, Stretch, Correctif, Réamendement)
            tco_counts: dict = {}
            for a in actions:
                if a.type_action != "preparation_tco":
                    continue
                params = a.parametres or {}
                id_recette_tco = params.get("id_recette_tco")
                type_tco = "Autre"
                if id_recette_tco:
                    recette_tco = db.query(RecetteTCO).filter(
                        RecetteTCO.id_recette_tco == id_recette_tco
                    ).first()
                    if recette_tco and recette_tco.type_tco:
                        type_tco = recette_tco.type_tco
                tco_counts[type_tco] = tco_counts.get(type_tco, 0) + 1
            tco_par_type = tco_counts
        else:
            # Engrais conventionnel : collecter les marques/produits utilisés
            marques_set: set = set()
            for a in actions:
                if a.type_action != "arrosage_engrais":
                    continue
                params = a.parametres or {}
                # Via recette
                id_recette = params.get("id_recette")
                if id_recette:
                    recette_engrais = db.query(RecetteEngrais).filter(
                        RecetteEngrais.id_recette == id_recette
                    ).first()
                    if recette_engrais:
                        for ligne in recette_engrais.lignes:
                            prod = db.query(ProduitEngrais).filter(
                                ProduitEngrais.id_produit == ligne.id_produit
                            ).first()
                            if prod and prod.marque:
                                marques_set.add(prod.marque)
                # Legacy : liste manuelle
                for item in params.get("produits", []):
                    pid_prod = item.get("id_produit")
                    if pid_prod:
                        prod = db.query(ProduitEngrais).filter(
                            ProduitEngrais.id_produit == pid_prod
                        ).first()
                        if prod and prod.marque:
                            marques_set.add(prod.marque)
            marques_engrais = sorted(marques_set)

        # ── Détail coût engrais par recette (diagnostic) ────────────────────
        recettes_cout: dict = {}  # {nom_recette: {volume_l, cout, nb_actions}}
        for a in actions:
            if a.type_action != "arrosage_engrais":
                continue
            p2 = a.parametres or {}
            id_r = p2.get("id_recette")
            if not id_r:
                continue
            if not a.global_culture and p2.get("volume_par_plante_l"):
                vol2 = float(p2.get("volume_par_plante_l"))
            else:
                vol2 = float(p2.get("volume_l") or 0)
            if not vol2:
                continue
            rec2 = db.query(RecetteEngrais).filter(RecetteEngrais.id_recette == id_r).first()
            if not rec2:
                continue
            nom_rec = rec2.nom_recette or f"Recette #{id_r}"
            cout_action = 0.0
            for ligne2 in rec2.lignes:
                prod2 = db.query(ProduitEngrais).filter(ProduitEngrais.id_produit == ligne2.id_produit).first()
                if not prod2 or not prod2.prix_achat or not prod2.volume_conditionnement:
                    continue
                cout_action += ligne2.dosage * vol2 * (float(prod2.prix_achat) / float(prod2.volume_conditionnement))
            if nom_rec not in recettes_cout:
                recettes_cout[nom_rec] = {"volume_l": 0.0, "cout": 0.0, "nb_actions": 0}
            recettes_cout[nom_rec]["volume_l"]   += vol2
            recettes_cout[nom_rec]["cout"]        += cout_action
            recettes_cout[nom_rec]["nb_actions"]  += 1
        details_cout_engrais = [
            {
                "nom_recette":   k,
                "volume_l":      round(v["volume_l"], 2),
                "cout":          round(v["cout"], 2),
                "cout_par_litre": round(v["cout"] / v["volume_l"], 4) if v["volume_l"] > 0 else None,
                "nb_actions":    v["nb_actions"],
            }
            for k, v in sorted(recettes_cout.items(), key=lambda x: -x[1]["cout"])
        ]

        # ── Hauteurs + arrosages ─────────────────────────────────────────────
        hauteurs = []
        arrosage_points = []

        for a in actions:
            if not date_debut:
                continue
            params = a.parametres or {}
            offset = (a.date_action - date_debut).days

            if a.type_action == "hauteur_plante":
                h = params.get("hauteur_cm")
                if h is not None:
                    nom = plants_map.get(a.id_plant, "Global") if a.id_plant else "Global"
                    hauteurs.append({"jour_offset": offset, "hauteur_cm": float(h), "plante": nom})

            elif a.type_action in ("arrosage_eau", "arrosage_engrais", "arrosage_tco"):
                # Pour les actions per-plante, préférer volume_par_plante_l (évite le double-comptage)
                if not a.global_culture and params.get("volume_par_plante_l"):
                    vol = params.get("volume_par_plante_l")
                else:
                    vol = params.get("volume_l")
                if vol is not None:
                    arrosage_points.append({
                        "jour_offset": offset,
                        "volume_ml": round(float(vol) * 1000),
                        "is_engrais": a.type_action == "arrosage_engrais",
                    })

        # Arrosages cumulés (tous types)
        cumul = 0
        arrosages_cumules = []
        volume_engrais_ml = 0
        for pt in sorted(arrosage_points, key=lambda x: x["jour_offset"]):
            cumul += pt["volume_ml"]
            if pt["is_engrais"]:
                volume_engrais_ml += pt["volume_ml"]
            arrosages_cumules.append({"jour_offset": pt["jour_offset"], "volume_cumul_ml": cumul})
        volume_arrosage_total_l  = round(cumul / 1000, 1) if cumul else None
        volume_arrosage_engrais_l = round(volume_engrais_ml / 1000, 1) if volume_engrais_ml else None

        # ── Variétés ─────────────────────────────────────────────────────────
        varietes = []
        for p in plants:
            if p.id_graine:
                g = db.query(Graine).filter(Graine.id_graine == p.id_graine).first()
                if g and g.variete and g.variete.nom_variete not in varietes:
                    varietes.append(g.variete.nom_variete)

        results.append({
            "id_culture":              cid,
            "nom":                     culture.nom or f"Culture #{cid}",
            "statut":                  culture.statut,
            "date_debut":              str(culture.date_debut) if culture.date_debut else None,
            "date_fin":                str(culture.date_fin) if culture.date_fin else None,
            "type_culture":            culture.type_culture,
            "type_eclairage":          culture.type_eclairage,
            "nom_espace":              nom_espace,
            "lampes":                  lampes_info,
            "puissance_w_total":       puissance_w_total or None,
            "is_lso":                  is_lso,
            "tco_par_type":            tco_par_type,
            "nb_tco_total":            sum(tco_par_type.values()),
            "marques_engrais":         marques_engrais,
            "nb_plantes":              nb_plantes,
            "nb_plantes_recoltees":    nb_recoltees,
            "varietes":                varietes,
            "duree_totale_j":          duree_totale_j,
            "duree_veg_j":             duree_veg_j,
            "duree_flo_j":             duree_flo_j,
            "rendement_total_g":       round(rendement_total_g, 1) if rendement_total_g else None,
            "rendement_par_plante_g":  rendement_par_plante_g,
            "cout_total":              couts.get("cout_total"),
            "cout_par_gramme":         couts.get("cout_par_gramme"),
            "cout_engrais":            couts.get("cout_engrais"),
            "cout_electricite":        couts.get("cout_electricite"),
            "cout_graines":            couts.get("cout_graines"),
            "volume_arrosage_total_l": volume_arrosage_total_l,
            "volume_arrosage_engrais_l": volume_arrosage_engrais_l,
            "hauteurs":                hauteurs,
            "details_cout_engrais":    details_cout_engrais,
            "arrosages_cumules":       arrosages_cumules,
        })

    return results


# ═══════════════════════════════════════════════════════════════════════════════
# UTILITAIRES (pour le formulaire de création)
# ═══════════════════════════════════════════════════════════════════════════════

@router.get("/pots")
def list_pots(db: Session = Depends(get_db)):
    from app.models import Materiel
    # Les pots sont dans la table Materiel, catégorie 'Pots'
    pots = (
        db.query(Materiel)
        .filter(Materiel.categorie == "Pots", Materiel.etat != "Hors service")
        .order_by(Materiel.nom)
        .all()
    )
    # Calcule les pots déjà occupés par une plante active dans une culture non-terminée
    pots_en_cours: dict[int, str] = {}
    occupied = (
        db.query(Plant, Culture)
        .join(Culture, Plant.id_culture == Culture.id_culture)
        .filter(
            Plant.id_pot.isnot(None),
            ~Plant.statut.in_(["recolte", "abandonne"]),
            Culture.statut != "terminee",
        )
        .all()
    )
    for occ_plant, occ_culture in occupied:
        pots_en_cours[occ_plant.id_pot] = occ_culture.nom

    return [
        {
            "id_pot": p.id_materiel,
            "taille_pot": (p.caracteristiques or {}).get("volume"),
            "volume_l": (p.caracteristiques or {}).get("volume_l"),
            "dimension_pot": p.nom,
            "etat": p.etat,
            "en_cours": p.id_materiel in pots_en_cours,
            "nom_culture_en_cours": pots_en_cours.get(p.id_materiel),
        }
        for p in pots
    ]


@router.get("/utils/transfer-targets")
def get_transfer_targets(exclude_culture_id: int = Query(...), db: Session = Depends(get_db)):
    """Retourne les cibles disponibles pour un transfert de plante :
    - cultures actives (autres que la culture source)
    - espaces de culture sans culture active (disponibles pour une nouvelle culture)
    """
    # 1. Cultures actives hors culture source
    cultures_actives = (
        db.query(Culture)
        .filter(
            Culture.statut == "active",
            Culture.id_culture != exclude_culture_id,
        )
        .order_by(Culture.date_debut.desc())
        .all()
    )
    cultures_result = []
    for c in cultures_actives:
        nom_espace = None
        if c.id_espace:
            esp = db.query(EspaceCulture).filter(EspaceCulture.id_espace == c.id_espace).first()
            nom_espace = esp.nom if esp else None
        cultures_result.append({
            "id_culture": c.id_culture,
            "nom": c.nom or f"Culture #{c.id_culture}",
            "nom_espace": nom_espace,
            "phase": c.phase,
        })

    # 2. Espaces sans culture active (disponibles)
    espaces_avec_culture_active = (
        db.query(Culture.id_espace)
        .filter(Culture.statut == "active", Culture.id_espace.isnot(None))
        .distinct()
        .subquery()
    )
    espaces_dispos = (
        db.query(EspaceCulture)
        .filter(~EspaceCulture.id_espace.in_(espaces_avec_culture_active))
        .order_by(EspaceCulture.nom)
        .all()
    )
    espaces_result = [
        {"id_espace": e.id_espace, "nom": e.nom}
        for e in espaces_dispos
    ]

    return {"cultures_actives": cultures_result, "espaces_disponibles": espaces_result}


@router.get("/recettes-sol")
def list_recettes_sol(db: Session = Depends(get_db)):
    from app.models.all_models import RecetteLSO
    recettes = db.query(RecetteLSO).order_by(RecetteLSO.nom_recette).all()
    return [
        {
            "id_recette_lso": r.id_recette_lso,
            "nom_recette": r.nom_recette,
            "type_lso": r.type_lso,
            "quantite_totale": r.quantite_totale,
            "unite_quantite": r.unite_quantite,
        }
        for r in recettes
    ]


# ═══════════════════════════════════════════════════════════════════════════════
# CULTURES CRUD
# ═══════════════════════════════════════════════════════════════════════════════

@router.get("/dernier-tco/{culture_id}")
def get_dernier_tco(culture_id: int, db: Session = Depends(get_db)):
    """Retourne la dernière préparation TCO de la culture et si elle est prête."""
    action = (
        db.query(ActionCalendrier)
        .filter(
            ActionCalendrier.id_culture == culture_id,
            ActionCalendrier.type_action == "preparation_tco",
        )
        .order_by(ActionCalendrier.date_action.desc(), ActionCalendrier.created_at.desc())
        .first()
    )
    if not action:
        return {"found": False, "is_ready": False}
    params = action.parametres or {}
    date_pret_str = params.get("date_pret")
    is_ready = True
    if date_pret_str:
        try:
            date_pret = datetime.fromisoformat(date_pret_str)
            is_ready = datetime.now() >= date_pret
        except Exception:
            is_ready = True
    return {
        "found": True,
        "date_action": str(action.date_action),
        "nom_recette": params.get("nom_recette"),
        "date_pret": date_pret_str,
        "is_ready": is_ready,
    }


@router.get("/", response_model=list[CultureRead])
def list_cultures(
    statut: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    q = db.query(Culture)
    if statut:
        q = q.filter(Culture.statut == statut)
    else:
        q = q.filter(Culture.statut.in_(["active", "sechage_curing"]))
    cultures = q.order_by(Culture.date_debut.desc()).all()
    return [_enrich_culture(c, db) for c in cultures]


@router.get("/sechage/plants")
def list_plants_sechage(db: Session = Depends(get_db)):
    """Toutes les plantes en séchage ou curing, enrichies variété/breeder/espace/durée + session assignée."""
    from app.models.all_models import PlantSechage as PlantSechageModel, SessionSechage
    from app.models.all_models import PlantCuring as PlantCuringModel, SessionCuring
    today = date.today()
    plants = (
        db.query(Plant)
        .filter(Plant.statut.in_(["sechage", "curing"]))
        .order_by(Plant.date_recolte.asc())
        .all()
    )
    result = []
    for plant in plants:
        culture = db.query(Culture).filter(Culture.id_culture == plant.id_culture).first()
        # Espace de culture (par défaut)
        nom_espace = None
        id_espace = None
        if culture and culture.id_espace:
            id_espace = culture.id_espace
            esp = db.query(EspaceCulture).filter(EspaceCulture.id_espace == culture.id_espace).first()
            nom_espace = esp.nom if esp else None

        nom_variete = None
        nom_breeder = None
        if plant.id_graine:
            graine = db.query(Graine).filter(Graine.id_graine == plant.id_graine).first()
            if graine:
                if graine.variete:
                    nom_variete = graine.variete.nom_variete
                if graine.breeder:
                    nom_breeder = graine.breeder.nom_breeder

        duree_sechage_j = None
        if plant.date_recolte:
            end_date = plant.date_fin_sechage or today
            duree_sechage_j = (end_date - plant.date_recolte).days

        # Session de séchage assignée (si elle existe)
        id_session_sechage = None
        nom_espace_sechage = None
        id_espace_sechage = None
        methode_sechage = None
        poids_humide_g = None
        id_plant_sechage = None
        ps = db.query(PlantSechageModel).filter(
            PlantSechageModel.id_plant == plant.id_plant
        ).order_by(PlantSechageModel.id_plant_sechage.desc()).first()
        if ps:
            id_plant_sechage = ps.id_plant_sechage
            id_session_sechage = ps.id_session_sechage
            poids_humide_g = float(ps.poids_humide_g) if ps.poids_humide_g else None
            session_s = db.query(SessionSechage).filter(SessionSechage.id_session_sechage == ps.id_session_sechage).first()
            if session_s:
                methode_sechage = session_s.methode_sechage
                if session_s.id_espace:
                    id_espace_sechage = session_s.id_espace
                    esp_s = db.query(EspaceCulture).filter(EspaceCulture.id_espace == session_s.id_espace).first()
                    nom_espace_sechage = esp_s.nom if esp_s else None

        # Session de curing assignée (si elle existe)
        id_session_curing = None
        type_contenant = None
        volume_contenant_l = None
        boveda_rh = None
        id_plant_curing = None
        id_espace_curing = None
        nom_espace_curing = None
        id_materiel_bocal = None
        nom_materiel_bocal = None
        pc = db.query(PlantCuringModel).filter(
            PlantCuringModel.id_plant == plant.id_plant
        ).order_by(PlantCuringModel.id_plant_curing.desc()).first()
        if pc:
            id_plant_curing = pc.id_plant_curing
            id_session_curing = pc.id_session_curing
            session_c = db.query(SessionCuring).filter(SessionCuring.id_session_curing == pc.id_session_curing).first()
            if session_c:
                type_contenant = session_c.type_contenant
                volume_contenant_l = float(session_c.volume_contenant_l) if session_c.volume_contenant_l else None
                boveda_rh = session_c.boveda_rh
                if session_c.id_espace:
                    id_espace_curing = session_c.id_espace
                    esp_c = db.query(EspaceCulture).filter(EspaceCulture.id_espace == session_c.id_espace).first()
                    nom_espace_curing = esp_c.nom if esp_c else None
                if session_c.id_materiel_bocal:
                    from app.models.all_models import Materiel
                    id_materiel_bocal = session_c.id_materiel_bocal
                    mat = db.query(Materiel).filter(Materiel.id_materiel == session_c.id_materiel_bocal).first()
                    nom_materiel_bocal = mat.nom if mat else None

        # Dernière ouverture du bocal (action ouverture_bocal dans le calendrier)
        derniere_ouverture_bocal = None
        if plant.statut == 'curing':
            from app.models.all_models import ActionCalendrier
            last_ouv = (
                db.query(ActionCalendrier)
                .filter(
                    ActionCalendrier.id_plant == plant.id_plant,
                    ActionCalendrier.type_action == "ouverture_bocal",
                )
                .order_by(ActionCalendrier.date_action.desc())
                .first()
            )
            if last_ouv:
                derniere_ouverture_bocal = str(last_ouv.date_action)

        result.append({
            "id_plant": plant.id_plant,
            "id_culture": plant.id_culture,
            "nom_affichage": plant.nom_affichage,
            "statut": plant.statut,
            "date_recolte": str(plant.date_recolte) if plant.date_recolte else None,
            "date_fin_sechage": str(plant.date_fin_sechage) if plant.date_fin_sechage else None,
            "poids_recolte_g": float(plant.poids_recolte_g) if plant.poids_recolte_g else None,
            "nom_variete": nom_variete,
            "nom_breeder": nom_breeder,
            "nom_culture": culture.nom if culture else None,
            "nom_espace": nom_espace,           # espace de culture (défaut)
            "id_espace": id_espace,
            "duree_sechage_j": duree_sechage_j,
            # Session séchage assignée
            "id_plant_sechage": id_plant_sechage,
            "id_session_sechage": id_session_sechage,
            "id_espace_sechage": id_espace_sechage,
            "nom_espace_sechage": nom_espace_sechage,   # espace séchage si différent
            "methode_sechage": methode_sechage,
            "poids_humide_g": poids_humide_g,
            # Session curing assignée
            "id_plant_curing": id_plant_curing,
            "id_session_curing": id_session_curing,
            "type_contenant": type_contenant,
            "volume_contenant_l": volume_contenant_l,
            "boveda_rh": boveda_rh,
            "id_espace_curing": id_espace_curing,
            "nom_espace_curing": nom_espace_curing,     # espace si curing dans un espace
            "id_materiel_bocal": id_materiel_bocal,
            "nom_materiel_bocal": nom_materiel_bocal,   # bocal inventaire si sélectionné
            "derniere_ouverture_bocal": derniere_ouverture_bocal,  # date ISO de la dernière ouverture_bocal
        })
    return result


@router.get("/sechage/eligible")
def list_plants_eligible_sechage(db: Session = Depends(get_db)):
    """Plantes éligibles au séchage : en floraison ou recolte, pas déjà dans une session séchage active."""
    from app.models.all_models import PlantSechage as PlantSechageModel
    plants = (
        db.query(Plant)
        .filter(Plant.statut.in_(["floraison", "recolte"]))
        .order_by(Plant.id_plant.asc())
        .all()
    )
    # Exclure celles déjà dans un séchage actif
    already_in = set(
        r[0] for r in db.query(PlantSechageModel.id_plant)
        .filter(PlantSechageModel.date_fin_sechage.is_(None))
        .all()
    )
    result = []
    for plant in plants:
        if plant.id_plant in already_in:
            continue
        culture = db.query(Culture).filter(Culture.id_culture == plant.id_culture).first()
        nom_variete = None
        if plant.id_graine:
            graine = db.query(Graine).filter(Graine.id_graine == plant.id_graine).first()
            if graine and graine.variete:
                nom_variete = graine.variete.nom_variete
        result.append({
            "id_plant": plant.id_plant,
            "nom_affichage": plant.nom_affichage,
            "statut": plant.statut,
            "id_culture": plant.id_culture,
            "nom_culture": culture.nom if culture else None,
            "nom_variete": nom_variete,
            "poids_recolte_g": float(plant.poids_recolte_g) if plant.poids_recolte_g else None,
            "date_recolte": str(plant.date_recolte) if plant.date_recolte else None,
        })
    return result


@router.get("/curing/eligible")
def list_plants_eligible_curing(db: Session = Depends(get_db)):
    """Plantes éligibles au curing : en sechage (séchage terminé), pas déjà dans un curing actif."""
    from app.models.all_models import PlantCuring as PlantCuringModel
    plants = (
        db.query(Plant)
        .filter(Plant.statut == "sechage")
        .order_by(Plant.id_plant.asc())
        .all()
    )
    # Exclure celles déjà dans un curing actif
    already_in = set(
        r[0] for r in db.query(PlantCuringModel.id_plant)
        .filter(PlantCuringModel.date_fin_curing.is_(None))
        .all()
    )
    result = []
    for plant in plants:
        if plant.id_plant in already_in:
            continue
        culture = db.query(Culture).filter(Culture.id_culture == plant.id_culture).first()
        nom_variete = None
        if plant.id_graine:
            graine = db.query(Graine).filter(Graine.id_graine == plant.id_graine).first()
            if graine and graine.variete:
                nom_variete = graine.variete.nom_variete
        result.append({
            "id_plant": plant.id_plant,
            "nom_affichage": plant.nom_affichage,
            "statut": plant.statut,
            "id_culture": plant.id_culture,
            "nom_culture": culture.nom if culture else None,
            "nom_variete": nom_variete,
            "poids_recolte_g": float(plant.poids_recolte_g) if plant.poids_recolte_g else None,
            "date_recolte": str(plant.date_recolte) if plant.date_recolte else None,
        })
    return result


@router.get("/plants-by-variete/{id_variete}")
def get_plants_by_variete(id_variete: int, db: Session = Depends(get_db)):
    """Retourne toutes les plantes d'une variété donnée (pour picker stock)."""
    plants = (
        db.query(Plant)
        .join(Graine, Plant.id_graine == Graine.id_graine)
        .filter(Graine.id_variete == id_variete)
        .order_by(Plant.id_plant.asc())
        .all()
    )
    result = []
    for plant in plants:
        culture = db.query(Culture).filter(Culture.id_culture == plant.id_culture).first()
        result.append({
            "id_plant":      plant.id_plant,
            "nom_affichage": plant.nom_affichage,
            "statut":        plant.statut,
            "id_culture":    plant.id_culture,
            "nom_culture":   culture.nom if culture else None,
        })
    return result


@router.get("/{culture_id}", response_model=CultureWithDetails)
def get_culture(culture_id: int, db: Session = Depends(get_db)):
    culture = db.query(Culture).filter(Culture.id_culture == culture_id).first()
    if not culture:
        raise HTTPException(status_code=404, detail="Culture non trouvée")
    data = _enrich_culture(culture, db)
    plants = db.query(Plant).filter(Plant.id_culture == culture_id).order_by(Plant.numero_plant).all()
    data["plants"] = [_enrich_plant(p, db) for p in plants]
    actions = (
        db.query(ActionCalendrier)
        .filter(ActionCalendrier.id_culture == culture_id)
        .order_by(ActionCalendrier.date_action.desc())
        .limit(10).all()
    )
    data["actions_recentes"] = [_enrich_action(a, db) for a in actions]
    return data


@router.post("/", response_model=CultureRead, status_code=201)
def create_culture(payload: CultureCreate, db: Session = Depends(get_db)):
    mode_externe = bool(payload.plantes_externes)
    logger.info(
        "=== DÉBUT CREATE CULTURE — espace=%s, graines=%s, externes=%s ===",
        payload.id_espace, len(payload.graines_selection), len(payload.plantes_externes or [])
    )
    try:
        espace = db.query(EspaceCulture).filter(EspaceCulture.id_espace == payload.id_espace).first()
        if not espace:
            raise HTTPException(status_code=404, detail="Espace de culture introuvable")

        # ── Règle 0 : au moins une graine ou une plante externe ──────────────
        if not mode_externe and not payload.graines_selection:
            raise HTTPException(status_code=400, detail="Au moins une variété de graine est requise.")

        # ── Règle 1 : un seul culture active par espace ───────────────────────
        # Les cultures externes arrivent directement en séchage_curing → pas de conflit
        if not mode_externe:
            existing_active = db.query(Culture).filter(
                Culture.id_espace == payload.id_espace,
                Culture.statut == "active",
            ).first()
            if existing_active:
                raise HTTPException(
                    status_code=409,
                    detail=f"L'espace « {espace.nom} » a déjà une culture active : « {existing_active.nom} ». "
                           f"Passez-la en séchage/curing ou clôturez-la avant d'en démarrer une nouvelle.",
                )

        # ── Règle 2 : vérifier que les pots demandés ne sont pas déjà utilisés ─
        pots_demandes = [sel.id_pot for sel in payload.graines_selection if sel.id_pot is not None]
        if pots_demandes:
            conflict = (
                db.query(Plant, Culture)
                .join(Culture, Plant.id_culture == Culture.id_culture)
                .filter(
                    Plant.id_pot.in_(pots_demandes),
                    ~Plant.statut.in_(["recolte", "abandonne"]),
                    Culture.statut != "terminee",
                )
                .first()
            )
            if conflict:
                c_plant, c_culture = conflict
                raise HTTPException(
                    status_code=409,
                    detail=f"Le pot sélectionné est déjà utilisé par « {c_plant.nom_affichage} » "
                           f"dans la culture « {c_culture.nom} ».",
                )

        # ── Statut de la culture selon le mode ───────────────────────────────
        if mode_externe:
            # Les plantes externes arrivent en séchage ou curing → culture en sechage_curing
            _statuts_ext = {pe.statut for pe in (payload.plantes_externes or [])}
            culture_statut = "sechage_curing"
            culture_phase = "sechage_curing"
            nom = payload.nom or f"Import externe {espace.nom} — {payload.date_debut.strftime('%d/%m/%Y')}"
        else:
            culture_statut = "active"
            culture_phase = "germination"
            nom = payload.nom or f"Culture {espace.nom} — {payload.date_debut.strftime('%d/%m/%Y')}"

        culture = Culture(
            id_espace=payload.id_espace,
            nom=nom,
            date_debut=payload.date_debut,
            statut=culture_statut,
            type_culture=payload.type_culture,
            type_eclairage=payload.type_eclairage,
            but_culture=payload.but_culture,
            notes=payload.notes,
            phase=culture_phase,
        )
        db.add(culture)
        db.flush()

        plant_counter = 1

        # ── Plantes internes (graines catalogue) ──────────────────────────────
        for sel in payload.graines_selection:
            graines_disponibles = (
                db.query(Graine)
                .filter(
                    Graine.id_packgraine == sel.id_packgraine,
                    (Graine.utilisee == False) | (Graine.utilisee == None)
                )
                .order_by(Graine.id_graine)
                .limit(sel.nb_plantes)
                .all()
            )
            if len(graines_disponibles) < sel.nb_plantes:
                raise HTTPException(
                    status_code=400,
                    detail=f"Pas assez de graines disponibles dans le paquet {sel.id_packgraine} "
                           f"(demandé: {sel.nb_plantes}, disponible: {len(graines_disponibles)})"
                )
            for graine in graines_disponibles:
                nom_plant = _build_plant_name(graine, plant_counter)
                plant = Plant(
                    id_culture=culture.id_culture,
                    id_graine=graine.id_graine,
                    nom_affichage=nom_plant,
                    numero_plant=plant_counter,
                    origine="graine",
                    statut="germination",
                    substrat=payload.substrat_defaut,
                    id_recette_sol=payload.id_recette_sol_defaut,
                    id_pot=sel.id_pot if sel.id_pot is not None else payload.id_pot_defaut,
                    volume_pot_l=sel.volume_pot_l if sel.volume_pot_l is not None else payload.volume_pot_l_defaut,
                )
                db.add(plant)
                graine.utilisee = True
                plant_counter += 1

        # ── Plantes externes (import séchage / curing) ────────────────────────
        for pe in (payload.plantes_externes or []):
            # Construire les notes avec provenance/prix si présents
            pe_notes_parts = []
            if pe.provenance:
                pe_notes_parts.append(f"Provenance: {pe.provenance}")
            if pe.prix_g is not None:
                pe_notes_parts.append(f"Prix: {pe.prix_g:.2f}€/g")
            if pe.notes:
                pe_notes_parts.append(pe.notes)
            notes_plant = "\n".join(pe_notes_parts) or None

            plant = Plant(
                id_culture=culture.id_culture,
                nom_affichage=pe.nom_affichage,
                numero_plant=plant_counter,
                origine="graine",          # enum contraint — "externe" stocké dans notes
                statut=pe.statut,          # sechage | curing
                date_recolte=pe.date_recolte,
                date_fin_sechage=pe.date_fin_sechage if pe.statut == "curing" else None,
                poids_recolte_g=pe.poids_g,
                notes=notes_plant,
            )
            db.add(plant)
            plant_counter += 1

        db.commit()
        db.refresh(culture)
        return _enrich_culture(culture, db)

    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        logger.exception("Erreur création culture: %s", str(e))
        raise HTTPException(status_code=500, detail=f"Erreur interne: {str(e)}")


@router.put("/{culture_id}", response_model=CultureRead)
def update_culture(culture_id: int, payload: CultureUpdate, db: Session = Depends(get_db)):
    culture = db.query(Culture).filter(Culture.id_culture == culture_id).first()
    if not culture:
        raise HTTPException(status_code=404, detail="Culture non trouvée")
    for f in ["nom", "id_espace", "date_debut", "statut", "date_fin", "date_recolte_estimee",
              "date_passage_12_12", "date_debut_floraison", "phase",
              "type_culture", "type_eclairage", "but_culture", "notes"]:
        v = getattr(payload, f)
        if v is not None:
            setattr(culture, f, v)
    if payload.date_passage_12_12:
        _compute_harvest_date(culture, db)
    db.commit()
    db.refresh(culture)
    return _enrich_culture(culture, db)


@router.delete("/{culture_id}", status_code=204)
def delete_culture(culture_id: int, db: Session = Depends(get_db)):
    culture = db.query(Culture).filter(Culture.id_culture == culture_id).first()
    if not culture:
        raise HTTPException(status_code=404, detail="Culture non trouvée")
    # Sécurité : seules les cultures terminées (ou en séchage/curing) peuvent être supprimées
    statuts_supprimables = {"terminee", "sechage_curing"}
    if culture.statut not in statuts_supprimables:
        raise HTTPException(
            status_code=400,
            detail="Seules les cultures terminées ou en séchage/curing peuvent être supprimées. "
                   "Clôturez d'abord la culture avant de la supprimer.",
        )
    # Cascade manuelle : actions → plantes → culture
    db.query(ActionCalendrier).filter(ActionCalendrier.id_culture == culture_id).delete(synchronize_session=False)
    db.query(Plant).filter(Plant.id_culture == culture_id).delete(synchronize_session=False)
    db.delete(culture)
    db.commit()


@router.get("/{culture_id}/cout")
def get_culture_cout(culture_id: int, db: Session = Depends(get_db)):
    """Calcule dynamiquement les coûts d'une culture active ou terminée."""
    culture = db.query(Culture).filter(Culture.id_culture == culture_id).first()
    if not culture:
        raise HTTPException(status_code=404, detail="Culture non trouvée")
    return _compute_culture_cost(culture_id, db)


@router.post("/{culture_id}/close", response_model=CultureRead)
def close_culture(culture_id: int, db: Session = Depends(get_db)):
    culture = db.query(Culture).filter(Culture.id_culture == culture_id).first()
    if not culture:
        raise HTTPException(status_code=404, detail="Culture non trouvée")
    # Tenter d'archiver AVANT de forcer le statut terminee
    # (car _maybe_archive_culture vérifie les statuts des plantes, pas le statut de la culture)
    _maybe_archive_culture(culture, db)
    # Si l'archivage n'a pas eu lieu (conditions non remplies), forcer la clôture manuelle
    if culture.statut != "terminee":
        culture.statut = "terminee"
        if not culture.date_fin:
            culture.date_fin = date.today()
        db.commit()
    db.refresh(culture)
    return _enrich_culture(culture, db)


# ═══════════════════════════════════════════════════════════════════════════════
# PLANTS
# ═══════════════════════════════════════════════════════════════════════════════

@router.get("/{culture_id}/plants", response_model=list[PlantRead])
def get_plants(culture_id: int, db: Session = Depends(get_db)):
    culture = db.query(Culture).filter(Culture.id_culture == culture_id).first()
    if not culture:
        raise HTTPException(status_code=404, detail="Culture non trouvée")
    plants = db.query(Plant).filter(Plant.id_culture == culture_id).order_by(Plant.numero_plant).all()
    return [_enrich_plant(p, db) for p in plants]


@router.post("/{culture_id}/plants", response_model=PlantRead, status_code=201)
def add_plant(culture_id: int, payload: PlantCreate, db: Session = Depends(get_db)):
    culture = db.query(Culture).filter(Culture.id_culture == culture_id).first()
    if not culture:
        raise HTTPException(status_code=404, detail="Culture non trouvée")
    plant = Plant(
        id_culture=culture_id,
        id_graine=payload.id_graine,
        nom_affichage=payload.nom_affichage,
        numero_plant=payload.numero_plant,
        origine=payload.origine,
        statut=payload.statut,
        date_germination=payload.date_germination,
        date_debut_flo=payload.date_debut_flo,
        date_recolte=payload.date_recolte,
        date_fin_sechage=payload.date_fin_sechage,
        poids_recolte_g=payload.poids_recolte_g,
        notes=payload.notes,
    )
    db.add(plant)
    db.commit()
    db.refresh(plant)
    return _enrich_plant(plant, db)


@router.put("/{culture_id}/plants/{plant_id}", response_model=PlantRead)
def update_plant(culture_id: int, plant_id: int, payload: PlantUpdate, db: Session = Depends(get_db)):
    plant = db.query(Plant).filter(Plant.id_plant == plant_id, Plant.id_culture == culture_id).first()
    if not plant:
        raise HTTPException(status_code=404, detail="Plant non trouvé")

    # ── Règle : vérifier que le nouveau pot n'est pas déjà utilisé par une autre plante active ─
    if payload.id_pot is not None and payload.id_pot != plant.id_pot:
        conflict = (
            db.query(Plant, Culture)
            .join(Culture, Plant.id_culture == Culture.id_culture)
            .filter(
                Plant.id_pot == payload.id_pot,
                Plant.id_plant != plant_id,
                ~Plant.statut.in_(["recolte", "abandonne"]),
                Culture.statut != "terminee",
            )
            .first()
        )
        if conflict:
            c_plant, c_culture = conflict
            raise HTTPException(
                status_code=409,
                detail=f"Ce pot est déjà utilisé par « {c_plant.nom_affichage} » "
                       f"dans la culture « {c_culture.nom} ».",
            )

    for f in ["nom_affichage", "statut", "date_germination", "date_debut_flo",
              "date_recolte", "date_fin_sechage", "poids_recolte_g",
              "substrat", "id_recette_sol", "id_pot", "volume_pot_l", "notes"]:
        v = getattr(payload, f)
        if v is not None:
            setattr(plant, f, v)
    db.commit()
    db.refresh(plant)
    return _enrich_plant(plant, db)


@router.post("/{culture_id}/plants/{plant_id}/transfer", response_model=PlantRead)
def transfer_plant(
    culture_id: int,
    plant_id: int,
    payload: PlantTransferPayload,
    db: Session = Depends(get_db),
):
    """Déplace une plante (et toutes ses actions) vers une autre culture active
    ou vers un nouvel espace disponible (une culture y est créée automatiquement)."""
    plant = db.query(Plant).filter(Plant.id_plant == plant_id, Plant.id_culture == culture_id).first()
    if not plant:
        raise HTTPException(status_code=404, detail="Plant non trouvé")

    if not payload.target_culture_id and not payload.target_espace_id:
        raise HTTPException(status_code=400, detail="Fournir target_culture_id ou target_espace_id")

    target_culture_id: int

    if payload.target_culture_id:
        # Vérifier que la culture cible existe et est active
        target = db.query(Culture).filter(Culture.id_culture == payload.target_culture_id).first()
        if not target:
            raise HTTPException(status_code=404, detail="Culture cible non trouvée")
        if target.statut != "active":
            raise HTTPException(status_code=400, detail="La culture cible doit être active")
        target_culture_id = target.id_culture

    else:
        # Créer une nouvelle culture dans l'espace disponible
        espace = db.query(EspaceCulture).filter(EspaceCulture.id_espace == payload.target_espace_id).first()
        if not espace:
            raise HTTPException(status_code=404, detail="Espace non trouvé")
        # Vérifier qu'aucune culture active n'y est déjà
        existing = db.query(Culture).filter(
            Culture.id_espace == payload.target_espace_id,
            Culture.statut == "active",
        ).first()
        if existing:
            raise HTTPException(status_code=409, detail="Cet espace a déjà une culture active")
        new_culture = Culture(
            nom=f"{espace.nom} — {date.today().strftime('%d/%m/%Y')}",
            id_espace=payload.target_espace_id,
            date_debut=date.today(),
            statut="active",
        )
        db.add(new_culture)
        db.flush()  # pour récupérer l'id
        target_culture_id = new_culture.id_culture

    # Déplacer la plante
    plant.id_culture = target_culture_id

    # Déplacer toutes les actions liées à cette plante
    db.query(ActionCalendrier).filter(
        ActionCalendrier.id_plant == plant_id,
        ActionCalendrier.id_culture == culture_id,
    ).update({"id_culture": target_culture_id}, synchronize_session=False)

    db.commit()
    db.refresh(plant)
    return _enrich_plant(plant, db)


@router.delete("/{culture_id}/plants/{plant_id}", status_code=204)
def delete_plant(culture_id: int, plant_id: int, db: Session = Depends(get_db)):
    plant = db.query(Plant).filter(Plant.id_plant == plant_id, Plant.id_culture == culture_id).first()
    if not plant:
        raise HTTPException(status_code=404, detail="Plant non trouvé")
    db.delete(plant)
    db.commit()


# ═══════════════════════════════════════════════════════════════════════════════
# CALENDRIER / ACTIONS
# ═══════════════════════════════════════════════════════════════════════════════

@router.get("/{culture_id}/calendrier", response_model=list[ActionRead])
def get_calendrier(
    culture_id: int,
    month: Optional[str] = Query(None, description="YYYY-MM"),
    db: Session = Depends(get_db),
):
    culture = db.query(Culture).filter(Culture.id_culture == culture_id).first()
    if not culture:
        raise HTTPException(status_code=404, detail="Culture non trouvée")
    if month:
        try:
            year, m = int(month[:4]), int(month[5:7])
        except Exception:
            raise HTTPException(status_code=422, detail="Format invalide, utiliser YYYY-MM")
    else:
        today = date.today()
        year, m = today.year, today.month

    actions = (
        db.query(ActionCalendrier)
        .filter(
            ActionCalendrier.id_culture == culture_id,
            extract("year", ActionCalendrier.date_action) == year,
            extract("month", ActionCalendrier.date_action) == m,
        )
        .order_by(ActionCalendrier.date_action, ActionCalendrier.created_at)
        .all()
    )
    return [_enrich_action(a, db) for a in actions]


@router.post("/{culture_id}/actions", response_model=list[ActionRead], status_code=201)
def create_action(culture_id: int, payload: ActionCreate, db: Session = Depends(get_db)):
    culture = db.query(Culture).filter(Culture.id_culture == culture_id).first()
    if not culture:
        raise HTTPException(status_code=404, detail="Culture non trouvée")

    is_global = payload.global_culture or (payload.id_plant is None)

    # space_only = enregistrement unique sur l'espace, sans expansion par plante ni effets sur plantes
    if payload.space_only:
        action = ActionCalendrier(
            id_culture=culture_id,
            id_plant=None,
            date_action=payload.date_action,
            type_action=payload.type_action,
            parametres=payload.parametres,
            note=payload.note,
            global_culture=True,
        )
        db.add(action)
        db.flush()
        # Appliquer les effets au niveau culture (ex: passage_12_12) mais pas aux plantes
        _handle_action_effects(action, culture, db)
        db.commit()
        return [_enrich_action(action, db)]

    if is_global:
        # Une action individuelle par plante active (pas récoltée / abandonnée)
        statuts_exclus = {"recolte", "curing", "prete", "abandonne", "wpff"}
        plants_cibles = db.query(Plant).filter(
            Plant.id_culture == culture_id,
            ~Plant.statut.in_(statuts_exclus),
        ).all()
        created = []
        for pl in plants_cibles:
            action = ActionCalendrier(
                id_culture=culture_id,
                id_plant=pl.id_plant,
                date_action=payload.date_action,
                type_action=payload.type_action,
                parametres=payload.parametres,
                note=payload.note,
                global_culture=False,
            )
            db.add(action)
            db.flush()
            _handle_action_effects(action, culture, db)
            created.append(action)
        if not created:
            # Aucune plante active : créer quand même un enregistrement global pour la traçabilité
            action = ActionCalendrier(
                id_culture=culture_id,
                id_plant=None,
                date_action=payload.date_action,
                type_action=payload.type_action,
                parametres=payload.parametres,
                note=payload.note,
                global_culture=True,
            )
            db.add(action)
            db.flush()
            _handle_action_effects(action, culture, db)
            created.append(action)
        db.commit()
        return [_enrich_action(a, db) for a in created]
    else:
        # Action ciblée sur une plante spécifique
        action = ActionCalendrier(
            id_culture=culture_id,
            id_plant=payload.id_plant,
            date_action=payload.date_action,
            type_action=payload.type_action,
            parametres=payload.parametres,
            note=payload.note,
            global_culture=False,
        )
        db.add(action)
        db.flush()
        _handle_action_effects(action, culture, db)
        db.commit()
        db.refresh(action)
        return [_enrich_action(action, db)]


@router.put("/{culture_id}/actions/{action_id}", response_model=ActionRead)
def update_action(culture_id: int, action_id: int, payload: ActionCreate, db: Session = Depends(get_db)):
    action = db.query(ActionCalendrier).filter(
        ActionCalendrier.id_action == action_id,
        ActionCalendrier.id_culture == culture_id
    ).first()
    if not action:
        raise HTTPException(status_code=404, detail="Action non trouvée")
    action.date_action = payload.date_action
    action.type_action = payload.type_action
    action.parametres = payload.parametres
    action.note = payload.note
    action.id_plant = payload.id_plant
    action.global_culture = payload.global_culture
    db.commit()
    db.refresh(action)
    return _enrich_action(action, db)


@router.delete("/{culture_id}/actions/{action_id}", status_code=204)
def delete_action(culture_id: int, action_id: int, db: Session = Depends(get_db)):
    action = db.query(ActionCalendrier).filter(
        ActionCalendrier.id_action == action_id,
        ActionCalendrier.id_culture == culture_id
    ).first()
    if not action:
        raise HTTPException(status_code=404, detail="Action non trouvée")
    db.delete(action)
    db.commit()


# ═══════════════════════════════════════════════════════════════════════════════
# STATS
# ═══════════════════════════════════════════════════════════════════════════════

@router.get("/{culture_id}/stats")
def get_stats(culture_id: int, db: Session = Depends(get_db)):
    culture = db.query(Culture).filter(Culture.id_culture == culture_id).first()
    if not culture:
        raise HTTPException(status_code=404, detail="Culture non trouvée")

    actions = (
        db.query(ActionCalendrier)
        .filter(ActionCalendrier.id_culture == culture_id)
        .order_by(ActionCalendrier.date_action)
        .all()
    )
    plants_map = {
        p.id_plant: p.nom_affichage
        for p in db.query(Plant).filter(Plant.id_culture == culture_id).all()
    }

    hauteurs: dict = {}
    arrosages: list = []
    intensites: list = []

    for a in actions:
        params = a.parametres or {}
        d = str(a.date_action)

        if a.type_action == "hauteur_plante":
            nom = plants_map.get(a.id_plant, "Global") if a.id_plant else "Global"
            hauteurs.setdefault(nom, []).append({"date": d, "hauteur_cm": params.get("hauteur_cm")})

        elif a.type_action in ("arrosage_eau", "arrosage_engrais", "arrosage_tco", "preparation_tco"):
            vol_l = params.get("volume_l")
            vol_ml = round(float(vol_l) * 1000) if vol_l else None
            arrosages.append({"date": d, "volume_ml": vol_ml, "type": a.type_action})

        elif a.type_action == "intensite_lampe":
            intensites.append({
                "date": d,
                "puissance_avant": params.get("puissance_avant"),
                "puissance_apres": params.get("puissance_apres"),
            })

    return {
        "hauteurs": hauteurs,
        "arrosages": arrosages,
        "intensites_lampe": intensites,
        "nb_actions_total": len(actions),
    }




# ==============================================================================
# EXPORT PDF -- Fiche culture complete
# ==============================================================================

@router.get("/{culture_id}/export/pdf")
def export_culture_pdf(culture_id: int, db: Session = Depends(get_db)):
    # Generate a complete A4 PDF sheet for a culture.
    try:
        from fpdf import FPDF
        from fastapi.responses import StreamingResponse
        import io
    except ImportError:
        raise HTTPException(status_code=501, detail="fpdf2 non disponible.")

    culture = db.query(Culture).filter(Culture.id_culture == culture_id).first()
    if not culture:
        raise HTTPException(status_code=404, detail="Culture non trouvee")

    plants = db.query(Plant).filter(Plant.id_culture == culture_id).all()
    actions = (
        db.query(ActionCalendrier)
        .filter(ActionCalendrier.id_culture == culture_id)
        .order_by(ActionCalendrier.date_action)
        .all()
    )

    # -- Espace info ----------------------------------------------------------
    espace = db.query(EspaceCulture).filter(
        EspaceCulture.id_espace == culture.id_espace
    ).first() if culture.id_espace else None
    espace_nom = espace.nom if espace else "-"

    # -- Enrich plants --------------------------------------------------------
    plants_enriched = []
    for p in plants:
        enriched = _enrich_plant(p, db)
        variete_nom = enriched.get("variete_nom") or "-"
        statut = enriched.get("statut") or "-"
        substrat = enriched.get("substrat") or "-"
        vol = p.volume_pot_l
        pot_str = (f"{vol:.0f}L") if vol else "-"
        poids = enriched.get("poids_recolte_g")
        poids_str = (f"{poids:.1f}g") if poids else "-"
        plants_enriched.append({
            "nom": p.nom_affichage or "-",
            "variete": variete_nom,
            "statut": statut,
            "substrat": substrat,
            "pot": pot_str,
            "poids": poids_str,
        })

    # -- Action summary -------------------------------------------------------
    ACTION_LABELS = {
        "arrosage":            "Arrosages",
        "arrosage_engrais":    "Arrosages engrais",
        "preparation_tco":     "Preparations TCO",
        "lollipopping":        "Lollipopping",
        "defoliation":         "Defoliations",
        "palissage":           "Palissage",
        "debut_floraison":     "Debut floraison",
        "traitement":          "Traitements",
        "recolte":             "Recoltes",
        "note":                "Notes",
    }
    action_counts = {}
    for a in actions:
        t = a.type_action or "autre"
        action_counts[t] = action_counts.get(t, 0) + 1

    # -- Costs ----------------------------------------------------------------
    costs = _compute_culture_cost(culture_id, db)

    # -- Durations ------------------------------------------------------------
    import datetime as _dt
    duree_veg = None
    duree_flo = None
    duree_total = None
    if culture.date_debut and culture.date_debut_floraison:
        duree_veg = (culture.date_debut_floraison - culture.date_debut).days
    if culture.date_debut_floraison and culture.date_fin:
        duree_flo = (culture.date_fin - culture.date_debut_floraison).days
    if culture.date_debut and culture.date_fin:
        duree_total = (culture.date_fin - culture.date_debut).days

    def _safe(text):
        if text is None:
            return "-"
        s = str(text)
        return s.encode("latin-1", errors="replace").decode("latin-1")

    # -- Brand colours --------------------------------------------------------
    VERT_R, VERT_G, VERT_B   = 34, 139, 34
    BLANC_R, BLANC_G, BLANC_B = 255, 255, 255
    GRIS_R,  GRIS_G,  GRIS_B  = 245, 245, 245
    TEXT_R,  TEXT_G,  TEXT_B  = 30, 30, 30

    # -------------------------------------------------------------------------
    # Build PDF A4 (210 x 297 mm)
    # -------------------------------------------------------------------------
    today = _dt.date.today()

    class GrowPDF(FPDF):
        def header(self):
            # Green header bar
            self.set_fill_color(VERT_R, VERT_G, VERT_B)
            self.rect(0, 0, 210, 22, "F")
            self.set_text_color(BLANC_R, BLANC_G, BLANC_B)
            self.set_font("Helvetica", "B", 14)
            self.set_y(5)
            self.cell(0, 8, _safe(f"GrowManager -- Fiche Culture #{culture_id}"), align="C", new_x="LMARGIN", new_y="NEXT")
            self.set_font("Helvetica", "", 8)
            self.cell(0, 5, _safe(f"{culture.nom}  |  {espace_nom}  |  {culture.statut or ''}"), align="C", new_x="LMARGIN", new_y="NEXT")
            self.set_text_color(TEXT_R, TEXT_G, TEXT_B)
            self.ln(4)

        def footer(self):
            self.set_y(-12)
            self.set_font("Helvetica", "I", 7)
            self.set_text_color(150, 150, 150)
            self.cell(
                0, 5,
                _safe(f"GrowManager  |  Fiche culture #{culture_id}  |  {today.strftime('%d/%m/%Y')}  |  Page {self.page_no()}"),
                align="C"
            )

    pdf = GrowPDF(orientation="P", unit="mm", format="A4")
    pdf.set_margins(14, 28, 14)
    pdf.set_auto_page_break(auto=True, margin=16)
    pdf.add_page()
    pdf.set_text_color(TEXT_R, TEXT_G, TEXT_B)

    # -------------------------------------------------------------------------
    # Section 1 -- Informations generales (2 colonnes)
    # -------------------------------------------------------------------------
    def section_title(title):
        pdf.set_font("Helvetica", "B", 10)
        pdf.set_fill_color(VERT_R, VERT_G, VERT_B)
        pdf.set_text_color(BLANC_R, BLANC_G, BLANC_B)
        pdf.cell(0, 7, _safe(f"  {title}"), fill=True, new_x="LMARGIN", new_y="NEXT")
        pdf.set_text_color(TEXT_R, TEXT_G, TEXT_B)
        pdf.ln(2)

    def kv_row(key, val, col_w=91, col_gap=10):
        pdf.set_font("Helvetica", "B", 8)
        pdf.cell(42, 5, _safe(key + " :"), border=0)
        pdf.set_font("Helvetica", "", 8)
        pdf.cell(col_w - 42, 5, _safe(val), border=0, new_x="LMARGIN", new_y="NEXT")

    section_title("Informations generales")

    # Col gauche
    col_x_left  = 14
    col_x_right = 115
    col_w = 91

    left_rows = [
        ("Nom",          culture.nom or "-"),
        ("Espace",       espace_nom),
        ("Statut",       culture.statut or "-"),
        ("But",          culture.but_culture or "-"),
        ("Nb plantes",   str(len(plants))),
    ]
    right_rows = [
        ("Debut veg",    str(culture.date_debut) if culture.date_debut else "-"),
        ("12/12",        str(culture.date_passage_12_12) if culture.date_passage_12_12 else "-"),
        ("Debut flo",    str(culture.date_debut_floraison) if culture.date_debut_floraison else "-"),
        ("Fin / Recolte", str(culture.date_fin) if culture.date_fin else "-"),
        ("Duree veg",    (f"{duree_veg}j") if duree_veg else "-"),
        ("Duree flo",    (f"{duree_flo}j") if duree_flo else "-"),
        ("Duree totale", (f"{duree_total}j") if duree_total else "-"),
    ]

    max_rows = max(len(left_rows), len(right_rows))
    y_start = pdf.get_y()
    for i in range(max_rows):
        y = y_start + i * 5.5
        # Left col
        if i < len(left_rows):
            k, v = left_rows[i]
            pdf.set_xy(col_x_left, y)
            pdf.set_font("Helvetica", "B", 8)
            pdf.cell(38, 5, _safe(k + " :"))
            pdf.set_font("Helvetica", "", 8)
            pdf.cell(col_w - 38, 5, _safe(v))
        # Right col
        if i < len(right_rows):
            k, v = right_rows[i]
            pdf.set_xy(col_x_right, y)
            pdf.set_font("Helvetica", "B", 8)
            pdf.cell(38, 5, _safe(k + " :"))
            pdf.set_font("Helvetica", "", 8)
            pdf.cell(col_w - 38, 5, _safe(v))

    pdf.set_y(y_start + max_rows * 5.5 + 4)

    # -------------------------------------------------------------------------
    # Section 2 -- Tableau des plantes
    # -------------------------------------------------------------------------
    if plants_enriched:
        section_title("Plantes")
        headers   = ["Nom",    "Variete",  "Statut",  "Substrat", "Pot",  "Poids"]
        col_ws    = [30,        50,          24,         38,         14,     20]
        pdf.set_font("Helvetica", "B", 7)
        pdf.set_fill_color(220, 240, 220)
        for h, w in zip(headers, col_ws):
            pdf.cell(w, 6, _safe(h), border=1, fill=True, align="C")
        pdf.ln()
        pdf.set_font("Helvetica", "", 7)
        for idx, p in enumerate(plants_enriched):
            fill = idx % 2 == 0
            pdf.set_fill_color(GRIS_R, GRIS_G, GRIS_B)
            row_vals = [p["nom"], p["variete"], p["statut"], p["substrat"], p["pot"], p["poids"]]
            for val, w in zip(row_vals, col_ws):
                pdf.cell(w, 5.5, _safe(val), border=1, fill=fill, align="C")
            pdf.ln()
        pdf.ln(3)

    # -------------------------------------------------------------------------
    # Section 3 -- Resume actions
    # -------------------------------------------------------------------------
    if action_counts:
        section_title("Resume des actions")
        pdf.set_font("Helvetica", "", 8)
        items = []
        for t, cnt in sorted(action_counts.items()):
            label = ACTION_LABELS.get(t, t)
            items.append(f"{label}: {cnt}")
        # 3-column grid
        col_w3 = 58
        for i, item in enumerate(items):
            if i > 0 and i % 3 == 0:
                pdf.ln()
            pdf.set_font("Helvetica", "B", 8)
            pdf.cell(col_w3, 5.5, _safe(item))
        pdf.ln(5)

    # -------------------------------------------------------------------------
    # Section 4 -- Couts
    # -------------------------------------------------------------------------
    section_title("Couts")
    pdf.set_font("Helvetica", "", 8)
    cost_rows = [
        ("Electricite",  f"{costs.get('cout_electricite_eur', 0):.2f} EUR"),
        ("Engrais",      f"{costs.get('cout_engrais_eur', 0):.2f} EUR"),
        ("Graines",      f"{costs.get('cout_graines_eur', 0):.2f} EUR"),
        ("Total",        f"{costs.get('cout_total_eur', 0):.2f} EUR"),
    ]
    poids_total = costs.get("poids_total_g", 0)
    if poids_total:
        cout_total = costs.get("cout_total_eur", 0)
        cpg = cout_total / poids_total if poids_total > 0 else 0
        cost_rows.append(("Cout / gramme", f"{cpg:.2f} EUR/g"))
        cost_rows.append(("Rendement",     f"{poids_total:.1f} g"))

    for k, v in cost_rows:
        pdf.set_font("Helvetica", "B", 8)
        pdf.cell(50, 5.5, _safe(k + " :"))
        pdf.set_font("Helvetica", "", 8)
        pdf.cell(80, 5.5, _safe(v), new_x="LMARGIN", new_y="NEXT")
    pdf.ln(3)

    # -------------------------------------------------------------------------
    # Section 5 -- Notes
    # -------------------------------------------------------------------------
    if culture.notes:
        section_title("Notes")
        pdf.set_font("Helvetica", "", 8)
        pdf.multi_cell(0, 5, _safe(culture.notes))
        pdf.ln(3)

    # -- Output ---------------------------------------------------------------
    pdf_bytes = pdf.output()
    safe_nom  = (culture.nom or f"culture_{culture_id}").replace(" ", "_")
    filename  = f"fiche_{safe_nom}.pdf"

    return StreamingResponse(
        io.BytesIO(bytes(pdf_bytes)),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
