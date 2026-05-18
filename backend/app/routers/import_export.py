"""Import / Export CSV — Breeders, Variétés, Packs de graines + Backup mysqldump"""
import csv
import io
import os
import subprocess
from datetime import date as date_type, datetime
from fastapi import APIRouter, Depends, UploadFile, File, HTTPException
from fastapi.responses import StreamingResponse, Response
from sqlalchemy.orm import Session

from sqlalchemy import func
from app.database import get_db
from app.models.all_models import Breeder, Variete, PackGraine, Graine, Fournisseur, Stock, RosinExtraction, HashExtraction, HistoriqueCulture, HistoriquePlant, Materiel, ProduitEngrais

router = APIRouter(prefix="/api", tags=["import_export"])

SEP = ";"  # séparateur Excel francophone


# ─────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────

def _csv_response(rows: list[list], filename: str) -> StreamingResponse:
    """Génère une réponse CSV avec BOM UTF-8 (compatible Excel)."""
    output = io.StringIO()
    output.write("\ufeff")  # BOM
    writer = csv.writer(output, delimiter=SEP, quoting=csv.QUOTE_MINIMAL)
    for row in rows:
        writer.writerow([str(v) if v is not None else "" for v in row])
    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f"attachment; filename*=UTF-8''{filename}"},
    )


def _parse_csv(content: bytes) -> list[dict]:
    """Décode et parse un CSV.
    Autodetecte l'encodage (UTF-8/BOM, cp1252, latin-1)
    et le séparateur (\t, ; ou ,).
    Excel français re-encode souvent en cp1252 à l'ouverture/sauvegarde.
    """
    text: str | None = None
    for enc in ("utf-8-sig", "utf-8", "cp1252", "iso-8859-1"):
        try:
            text = content.decode(enc)
            break
        except (UnicodeDecodeError, ValueError):
            continue
    if text is None:
        text = content.decode("latin-1", errors="replace")

    sample = text[:2000]
    # Détection du séparateur : tabulation en priorité, puis ; puis ,
    counts = {"\t": sample.count("\t"), ";": sample.count(";"), ",": sample.count(",")}
    sep = max(counts, key=lambda k: counts[k])
    reader = csv.DictReader(io.StringIO(text), delimiter=sep)
    return list(reader)


def _str(row: dict, key: str) -> str | None:
    v = row.get(key, "").strip()
    return v if v else None


def _int(row: dict, key: str) -> int | None:
    v = row.get(key, "").strip()
    return int(v) if v.lstrip("-").isdigit() else None


def _float(row: dict, key: str) -> float | None:
    """Parse un float en nettoyant les symboles monétaires et espaces.
    Gère les formats : '50 €', '50.00', '50,00', '50€', etc.
    """
    v = row.get(key, "").strip()
    # Supprimer les symboles monétaires et espaces insécables
    for ch in ("€", "$", "£", "\xa0", " "):
        v = v.replace(ch, "")
    v = v.replace(",", ".")
    try:
        return float(v) if v else None
    except ValueError:
        return None


def _date(row: dict, key: str) -> date_type | None:
    v = row.get(key, "").strip()
    if not v:
        return None
    for fmt in ("%Y-%m-%d", "%d/%m/%Y", "%d-%m-%Y"):
        try:
            from datetime import datetime
            return datetime.strptime(v, fmt).date()
        except ValueError:
            continue
    return None


def _bool(row: dict, key: str) -> bool:
    v = row.get(key, "0").strip().lower()
    return v in ("1", "true", "oui", "yes", "vrai")


# ─────────────────────────────────────────
# BREEDERS — Export
# ─────────────────────────────────────────

@router.get("/export/breeders", summary="Exporte les breeders en CSV")
def export_breeders(db: Session = Depends(get_db)):
    rows = [["nom_breeder", "origine_breeder", "information_breeder"]]
    for b in db.query(Breeder).order_by(Breeder.nom_breeder).all():
        rows.append([b.nom_breeder, b.origine_breeder, b.information_breeder])
    return _csv_response(rows, "breeders.csv")


# ─────────────────────────────────────────
# BREEDERS — Import
# ─────────────────────────────────────────

@router.post("/import/breeders", summary="Importe des breeders depuis un CSV")
async def import_breeders(file: UploadFile = File(...), db: Session = Depends(get_db)):
    rows = _parse_csv(await file.read())
    created, skipped = 0, 0
    for row in rows:
        nom = _str(row, "nom_breeder")
        if not nom:
            continue
        if db.query(Breeder).filter(Breeder.nom_breeder == nom).first():
            skipped += 1
            continue
        db.add(Breeder(
            nom_breeder=nom,
            origine_breeder=_str(row, "origine_breeder"),
            information_breeder=_str(row, "information_breeder"),
        ))
        created += 1
    db.commit()
    return {"created": created, "skipped": skipped}


# ─────────────────────────────────────────
# VARIÉTÉS — Export
# ─────────────────────────────────────────

@router.get("/export/varietes", summary="Exporte les variétés en CSV")
def export_varietes(db: Session = Depends(get_db)):
    rows = [["nom_variete", "croisement_variete", "lien_web", "informations_variete"]]
    for v in db.query(Variete).order_by(Variete.nom_variete).all():
        rows.append([v.nom_variete, v.croisement_variete, v.lien_web, v.informations_variete])
    return _csv_response(rows, "varietes.csv")


# ─────────────────────────────────────────
# VARIÉTÉS — Import
# ─────────────────────────────────────────

@router.post("/import/varietes", summary="Importe des variétés depuis un CSV")
async def import_varietes(file: UploadFile = File(...), db: Session = Depends(get_db)):
    rows = _parse_csv(await file.read())
    created, skipped = 0, 0
    for row in rows:
        nom = _str(row, "nom_variete")
        if not nom:
            continue
        if db.query(Variete).filter(Variete.nom_variete == nom).first():
            skipped += 1
            continue
        db.add(Variete(
            nom_variete=nom,
            croisement_variete=_str(row, "croisement_variete"),
            lien_web=_str(row, "lien_web"),
            informations_variete=_str(row, "informations_variete"),
        ))
        created += 1
    db.commit()
    return {"created": created, "skipped": skipped}


# ─────────────────────────────────────────
# PACKS — Export
# ─────────────────────────────────────────

@router.get("/export/packs", summary="Exporte les packs de graines en CSV")
def export_packs(db: Session = Depends(get_db)):
    rows = [[
        "breeder_nom", "variete_nom", "croisement_variete",
        "type_graines", "duree_flo_min", "duree_flo_max",
        "nbr_graines", "nbr_restantes", "prix_achat", "date_achat",
        "edition_limite", "fournisseur_nom", "lien_web",
    ]]
    for pack in db.query(PackGraine).all():
        first_graine = (
            db.query(Graine)
            .filter(Graine.id_packgraine == pack.id_packgraine)
            .first()
        )
        if not first_graine:
            continue

        # Nombre de graines restantes (non utilisées)
        nbr_restantes = db.query(func.count(Graine.id_graine)).filter(
            Graine.id_packgraine == pack.id_packgraine,
            Graine.utilisee == False,
        ).scalar() or 0

        breeder = db.query(Breeder).filter(Breeder.id_breeder == first_graine.id_breeder).first()
        variete = db.query(Variete).filter(Variete.id_variete == first_graine.id_variete).first()
        fournisseur = (
            db.query(Fournisseur).filter(Fournisseur.id_fournisseur == pack.id_fournisseur).first()
            if pack.id_fournisseur else None
        )

        rows.append([
            breeder.nom_breeder if breeder else "",
            variete.nom_variete if variete else "",
            variete.croisement_variete if variete else "",
            first_graine.types_graines or "",
            first_graine.duree_flo_min or "",
            first_graine.duree_flo_max or "",
            pack.nbr_graines or "",
            nbr_restantes,
            float(pack.prix_achat) if pack.prix_achat else "",
            pack.date_achat.isoformat() if pack.date_achat else "",
            1 if first_graine.edition_limite else 0,
            fournisseur.nom_fournisseur if fournisseur else "",
            variete.lien_web if variete else "",
        ])
    return _csv_response(rows, "packs_graines.csv")


# ─────────────────────────────────────────
# PACKS — Import
# ─────────────────────────────────────────

@router.post("/import/packs", summary="Importe des packs de graines depuis un CSV")
async def import_packs(file: UploadFile = File(...), db: Session = Depends(get_db)):
    rows = _parse_csv(await file.read())
    created, skipped, errors = 0, 0, []

    for i, row in enumerate(rows, start=2):
        breeder_nom = _str(row, "breeder_nom")
        variete_nom = _str(row, "variete_nom")
        if not breeder_nom or not variete_nom:
            errors.append(f"Ligne {i} : breeder_nom et variete_nom sont obligatoires")
            skipped += 1
            continue

        # Breeder — crée s'il n'existe pas
        breeder = db.query(Breeder).filter(Breeder.nom_breeder == breeder_nom).first()
        if not breeder:
            breeder = Breeder(nom_breeder=breeder_nom)
            db.add(breeder)
            db.flush()

        # Variété — crée ou met à jour le croisement
        variete = db.query(Variete).filter(Variete.nom_variete == variete_nom).first()
        if not variete:
            variete = Variete(
                nom_variete=variete_nom,
                croisement_variete=_str(row, "croisement_variete"),
                lien_web=_str(row, "lien_web"),
            )
            db.add(variete)
            db.flush()
        else:
            if _str(row, "croisement_variete"):
                variete.croisement_variete = _str(row, "croisement_variete")
            if _str(row, "lien_web"):
                variete.lien_web = _str(row, "lien_web")

        # Fournisseur — optionnel
        fournisseur = None
        fournisseur_nom = _str(row, "fournisseur_nom")
        if fournisseur_nom:
            fournisseur = db.query(Fournisseur).filter(
                Fournisseur.nom_fournisseur == fournisseur_nom
            ).first()
            if not fournisseur:
                fournisseur = Fournisseur(nom_fournisseur=fournisseur_nom)
                db.add(fournisseur)
                db.flush()

        nbr = max(1, _int(row, "nbr_graines") or 1)
        prix_pack = _float(row, "prix_achat")
        prix_par_graine = (prix_pack / nbr) if prix_pack else None
        date_achat = _date(row, "date_achat")
        flo_min = _int(row, "duree_flo_min")
        flo_max = _int(row, "duree_flo_max")
        edition_limite = _bool(row, "edition_limite")
        types_graines = _str(row, "type_graines") or "Féminisée"

        pack = PackGraine(
            id_fournisseur=fournisseur.id_fournisseur if fournisseur else None,
            nbr_graines=nbr,
            prix_achat=prix_pack,
            date_achat=date_achat,
        )
        db.add(pack)
        db.flush()

        for _ in range(nbr):
            db.add(Graine(
                id_breeder=breeder.id_breeder,
                id_variete=variete.id_variete,
                id_packgraine=pack.id_packgraine,
                types_graines=types_graines,
                duree_flo_min=flo_min,
                duree_flo_max=flo_max,
                prix_achat=prix_par_graine,
                edition_limite=edition_limite,
                date_achat=date_achat,
                utilisee=False,
            ))

        created += 1

    db.commit()
    return {"created": created, "skipped": skipped, "errors": errors}


# ─────────────────────────────────────────
# STOCK — Export
# ─────────────────────────────────────────

@router.get("/export/stock", summary="Exporte le stock en CSV")
def export_stock(db: Session = Depends(get_db)):
    rows = [[
        "variete_nom", "type_stock", "sous_type_stock",
        "lampe_type", "engrais_type", "quantite_stock", "date_stock",
    ]]
    for s in db.query(Stock).order_by(Stock.date_stock.desc()).all():
        variete = db.query(Variete).filter(Variete.id_variete == s.id_variete).first() if s.id_variete else None
        rows.append([
            variete.nom_variete if variete else "",
            s.type_stock or "",
            s.sous_type_stock or "",
            s.lampe_type or "",
            s.engrais_type or "",
            float(s.quantite_stock) if s.quantite_stock else 0,
            s.date_stock.isoformat() if s.date_stock else "",
        ])
    return _csv_response(rows, "stock.csv")


# ─────────────────────────────────────────
# STOCK — Import
# ─────────────────────────────────────────

@router.post("/import/stock", summary="Importe du stock depuis un CSV")
async def import_stock(file: UploadFile = File(...), db: Session = Depends(get_db)):
    rows = _parse_csv(await file.read())
    created, skipped, errors = 0, 0, []

    for i, row in enumerate(rows, start=2):
        quantite = _float(row, "quantite_stock")
        if quantite is None:
            errors.append(f"Ligne {i} : quantite_stock manquante ou invalide")
            skipped += 1
            continue

        # Résolution variété (optionnelle)
        variete_nom = _str(row, "variete_nom")
        variete = None
        if variete_nom:
            variete = db.query(Variete).filter(Variete.nom_variete == variete_nom).first()

        db.add(Stock(
            id_variete=variete.id_variete if variete else None,
            type_stock=_str(row, "type_stock"),
            sous_type_stock=_str(row, "sous_type_stock"),
            lampe_type=_str(row, "lampe_type"),
            engrais_type=_str(row, "engrais_type"),
            quantite_stock=quantite,
            date_stock=_date(row, "date_stock"),
        ))
        created += 1

    db.commit()
    return {"created": created, "skipped": skipped, "errors": errors}


# ─────────────────────────────────────────
# EXTRACTIONS ROSIN — Export
# ─────────────────────────────────────────

@router.get("/export/extractions", summary="Exporte les extractions rosin en CSV")
def export_extractions(db: Session = Depends(get_db)):
    rows = [[
        "variete_nom", "date_extraction",
        "temperature", "maillage", "duree_preheat_sec", "duree_extraction_sec",
        "sac_1_poids", "sac_2_poids", "sac_3_poids", "sac_4_poids",
        "poids_entree",
        "presse_1_poids", "presse_2_poids", "presse_3_poids", "presse_4_poids",
        "poids_sortie",
    ]]
    for e in db.query(RosinExtraction).order_by(RosinExtraction.date_rosinextraction.desc()).all():
        variete_nom = ""
        if e.id_stock_source:
            stock = db.query(Stock).filter(Stock.id_stock == e.id_stock_source).first()
            if stock and stock.id_variete:
                variete = db.query(Variete).filter(Variete.id_variete == stock.id_variete).first()
                if variete:
                    variete_nom = variete.nom_variete
        if not variete_nom:
            variete_nom = e.nom_variete_extract or ""
        f = lambda v: float(v) if v else ""
        rows.append([
            variete_nom,
            e.date_rosinextraction.isoformat() if e.date_rosinextraction else "",
            e.temperature_extraction or "",
            e.maillage or "",
            e.duree_preheat or "",
            e.duree_extraction or "",
            f(e.sac_1_poids), f(e.sac_2_poids), f(e.sac_3_poids), f(e.sac_4_poids),
            float(e.quantite_utilisee) if e.quantite_utilisee else 0,
            f(e.presse_1_poids), f(e.presse_2_poids), f(e.presse_3_poids), f(e.presse_4_poids),
            float(e.quantite_extraite) if e.quantite_extraite else 0,
        ])
    return _csv_response(rows, "extractions_rosin.csv")


# ─────────────────────────────────────────
# EXTRACTIONS ROSIN — Import
# ─────────────────────────────────────────

@router.post("/import/extractions", summary="Importe des extractions rosin depuis un CSV")
async def import_extractions(file: UploadFile = File(...), db: Session = Depends(get_db)):
    """
    Import historique — ne déduit pas le stock source.
    Colonnes : variete_nom, date_extraction, sac_1_poids, sac_2_poids,
               sac_3_poids, sac_4_poids, poids_entree *, poids_sortie *
    """
    rows = _parse_csv(await file.read())
    created, skipped, errors = 0, 0, []

    for i, row in enumerate(rows, start=2):
        poids_entree = _float(row, "poids_entree")
        poids_sortie = _float(row, "poids_sortie")
        if poids_entree is None or poids_sortie is None:
            errors.append(f"Ligne {i} : poids_entree et poids_sortie sont obligatoires")
            skipped += 1
            continue

        date_ext = _date(row, "date_extraction")
        if not date_ext:
            from datetime import date as dt
            date_ext = dt.today()

        variete_nom = _str(row, "variete_nom")

        db.add(RosinExtraction(
            nom_variete_extract=variete_nom,
            date_rosinextraction=date_ext,
            temperature_extraction=_int(row, "temperature"),
            maillage=_str(row, "maillage"),
            duree_preheat=_int(row, "duree_preheat_sec"),
            duree_extraction=_int(row, "duree_extraction_sec"),
            sac_1_poids=_float(row, "sac_1_poids"),
            sac_2_poids=_float(row, "sac_2_poids"),
            sac_3_poids=_float(row, "sac_3_poids"),
            sac_4_poids=_float(row, "sac_4_poids"),
            quantite_utilisee=poids_entree,
            presse_1_poids=_float(row, "presse_1_poids"),
            presse_2_poids=_float(row, "presse_2_poids"),
            presse_3_poids=_float(row, "presse_3_poids"),
            presse_4_poids=_float(row, "presse_4_poids"),
            quantite_extraite=poids_sortie,
        ))
        created += 1

    db.commit()
    return {"created": created, "skipped": skipped, "errors": errors}


# ─────────────────────────────────────────
# HISTORIQUE CULTURES — Export
# ─────────────────────────────────────────

@router.get("/export/historique-cultures", summary="Exporte l'historique des cultures en CSV")
def export_historique_cultures(db: Session = Depends(get_db)):
    """
    Export à plat : une ligne par plante.
    Les champs de la culture (dates, tente, lampe…) sont répétés sur chaque ligne.
    La colonne culture_id permet de ré-importer en regroupant correctement les plantes.
    """
    rows = [[
        "culture_id",
        "date_debut", "date_fin", "tente", "lampe", "puissance",
        "type_culture", "engrais", "substrat", "notes_culture",
        "numero_plant", "variete_nom",
        "date_debut_plant", "date_fin_plant",
        "prix_graine", "quantite_recoltee", "notes_plant",
    ]]
    cultures = (
        db.query(HistoriqueCulture)
        .order_by(HistoriqueCulture.date_debut.desc())
        .all()
    )
    for c in cultures:
        plants = (
            db.query(HistoriquePlant)
            .filter(HistoriquePlant.id_historique_culture == c.id_historique_culture)
            .order_by(HistoriquePlant.numero_plant)
            .all()
        )
        f = lambda v: float(v) if v is not None else ""
        base = [
            c.id_historique_culture,
            c.date_debut.isoformat() if c.date_debut else "",
            c.date_fin.isoformat()   if c.date_fin   else "",
            c.tente        or "",
            c.lampe        or "",
            c.puissance    or "",
            c.type_culture or "",
            c.engrais      or "",
            c.substrat     or "",
            c.notes        or "",
        ]
        if plants:
            for p in plants:
                rows.append(base + [
                    p.numero_plant or "",
                    p.variete_nom  or "",
                    p.date_debut_plant.isoformat() if p.date_debut_plant else "",
                    p.date_fin_plant.isoformat()   if p.date_fin_plant   else "",
                    f(p.prix_graine),
                    f(p.quantite_recoltee),
                    p.notes or "",
                ])
        else:
            # Culture sans plantes — on exporte quand même une ligne
            rows.append(base + ["", "", "", "", "", "", ""])
    return _csv_response(rows, "historique_cultures.csv")


# ─────────────────────────────────────────
# HISTORIQUE CULTURES — Import
# ─────────────────────────────────────────

@router.post("/import/historique-cultures", summary="Importe l'historique cultures depuis un CSV")
async def import_historique_cultures(file: UploadFile = File(...), db: Session = Depends(get_db)):
    """
    Import depuis le format d'export (une ligne par plante).
    Les lignes avec le même culture_id sont regroupées sous la même culture.
    Sans culture_id, chaque groupe de lignes consécutives ayant le même
    (date_debut, tente) est regroupé dans une culture.
    """
    csv_rows = _parse_csv(await file.read())
    created_cultures, created_plants, skipped, errors = 0, 0, 0, []

    # Regrouper par culture_id si disponible, sinon par (date_debut, tente)
    from collections import defaultdict, OrderedDict
    groups: dict = OrderedDict()

    for i, row in enumerate(csv_rows, start=2):
        cid = _str(row, "culture_id")
        date_debut = _str(row, "date_debut") or ""
        tente      = _str(row, "tente")      or ""
        key = cid if cid else f"{date_debut}|{tente}|{i}"  # sans id → culture distincte par ligne

        if key not in groups:
            groups[key] = {"meta": row, "plants": []}
        groups[key]["plants"].append(row)

    for key, grp in groups.items():
        meta = grp["meta"]
        date_debut = _date(meta, "date_debut")
        if not date_debut and not _str(meta, "tente"):
            skipped += 1
            continue

        culture = HistoriqueCulture(
            date_debut   = date_debut,
            date_fin     = _date(meta, "date_fin"),
            tente        = _str(meta, "tente"),
            lampe        = _str(meta, "lampe"),
            puissance    = _int(meta, "puissance"),
            type_culture = _str(meta, "type_culture"),
            engrais      = _str(meta, "engrais"),
            substrat     = _str(meta, "substrat"),
            notes        = _str(meta, "notes_culture"),
        )
        db.add(culture)
        db.flush()
        created_cultures += 1

        for j, pr in enumerate(grp["plants"], start=1):
            variete_nom = _str(pr, "variete_nom")
            if not variete_nom:
                continue
            # Résoudre id_variete si possible
            variete_obj = db.query(Variete).filter(Variete.nom_variete == variete_nom).first()
            db.add(HistoriquePlant(
                id_historique_culture = culture.id_historique_culture,
                id_variete            = variete_obj.id_variete if variete_obj else None,
                variete_nom           = variete_nom,
                numero_plant          = _int(pr, "numero_plant") or j,
                date_debut_plant      = _date(pr, "date_debut_plant"),
                date_fin_plant        = _date(pr, "date_fin_plant"),
                prix_graine           = _float(pr, "prix_graine"),
                quantite_recoltee     = _float(pr, "quantite_recoltee"),
                notes                 = _str(pr, "notes_plant"),
            ))
            created_plants += 1

    db.commit()
    return {"created": created_cultures, "skipped": skipped, "errors": errors,
            "details": f"{created_cultures} culture(s), {created_plants} plante(s) importée(s)"}


# ─────────────────────────────────────────
# EXTRACTIONS HASH — Export
# ─────────────────────────────────────────

@router.get("/export/extractions-hash", summary="Exporte les extractions hash en CSV")
def export_hash_extractions(db: Session = Depends(get_db)):
    rows = [["variete_nom", "date_extraction", "poids_entree", "poids_sortie", "notes"]]
    for e in db.query(HashExtraction).order_by(HashExtraction.date_hashextraction.desc()).all():
        variete_nom = e.nom_variete_hash or ""
        if e.id_variete:
            variete = db.query(Variete).filter(Variete.id_variete == e.id_variete).first()
            if variete:
                variete_nom = variete.nom_variete
        rows.append([
            variete_nom,
            e.date_hashextraction.isoformat() if e.date_hashextraction else "",
            float(e.quantite_utilisee) if e.quantite_utilisee else 0,
            float(e.quantite_extraite) if e.quantite_extraite else 0,
            e.info_hashextraction or "",
        ])
    return _csv_response(rows, "extractions_hash.csv")


# ─────────────────────────────────────────
# EXTRACTIONS HASH — Import
# ─────────────────────────────────────────

@router.post("/import/extractions-hash", summary="Importe des extractions hash depuis un CSV")
async def import_hash_extractions(file: UploadFile = File(...), db: Session = Depends(get_db)):
    rows = _parse_csv(await file.read())
    created, skipped, errors = 0, 0, []

    for i, row in enumerate(rows, start=2):
        poids_entree = _float(row, "poids_entree")
        poids_sortie = _float(row, "poids_sortie")
        if poids_entree is None or poids_sortie is None:
            errors.append(f"Ligne {i} : poids_entree et poids_sortie sont obligatoires")
            skipped += 1
            continue

        date_ext = _date(row, "date_extraction")
        if not date_ext:
            from datetime import date as dt
            date_ext = dt.today()

        variete_nom = _str(row, "variete_nom")
        id_variete = None
        if variete_nom:
            v = db.query(Variete).filter(Variete.nom_variete == variete_nom).first()
            if v:
                id_variete = v.id_variete

        db.add(HashExtraction(
            id_variete=id_variete,
            nom_variete_hash=variete_nom,
            date_hashextraction=date_ext,
            quantite_utilisee=poids_entree,
            quantite_extraite=poids_sortie,
            info_hashextraction=_str(row, "notes"),
        ))
        created += 1

    db.commit()
    return {"created": created, "skipped": skipped, "errors": errors}


# ── Matériel ──────────────────────────────────────────────────────────────────

@router.get("/export/materiel", summary="Exporte le matériel en CSV")
def export_materiel(db: Session = Depends(get_db)):
    import json
    rows = db.query(Materiel).order_by(Materiel.categorie, Materiel.nom).all()
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "id_materiel", "categorie", "nom", "marque", "code_barre_serial",
        "date_achat", "prix_achat", "site_achat", "etat", "notes", "caracteristiques",
    ])
    for r in rows:
        writer.writerow([
            r.id_materiel,
            r.categorie or "",
            r.nom or "",
            r.marque or "",
            r.code_barre_serial or "",
            r.date_achat.isoformat() if r.date_achat else "",
            str(r.prix_achat) if r.prix_achat is not None else "",
            r.site_achat or "",
            r.etat or "",
            r.notes or "",
            json.dumps(r.caracteristiques, ensure_ascii=False) if r.caracteristiques else "",
        ])
    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue().encode("utf-8-sig")]),
        media_type="text/csv",
        headers={"Content-Disposition": 'attachment; filename="materiel.csv"'},
    )


@router.post("/import/materiel", summary="Importe du matériel depuis un CSV")
async def import_materiel(file: UploadFile = File(...), db: Session = Depends(get_db)):
    import json as _json
    content = await file.read()
    reader = _parse_csv(content)
    created, skipped, errors = 0, 0, []

    def _str(row, k): return (row.get(k) or "").strip() or None
    def _dec(row, k):
        v = _str(row, k)
        if not v: return None
        try: return float(v)
        except: return None
    def _date(row, k):
        v = _str(row, k)
        if not v: return None
        from datetime import datetime as _dt
        for fmt in ("%Y-%m-%d", "%d/%m/%Y", "%d-%m-%Y", "%Y/%m/%d"):
            try: return _dt.strptime(v, fmt).date()
            except ValueError: continue
        return None

    for i, row in enumerate(reader, start=2):
        nom = _str(row, "nom")
        categorie = _str(row, "categorie")
        if not nom or not categorie:
            skipped += 1
            continue
        try:
            caract_raw = _str(row, "caracteristiques")
            caract = _json.loads(caract_raw) if caract_raw else None
        except Exception:
            caract = None
        try:
            db.add(Materiel(
                categorie         = categorie,
                nom               = nom,
                marque            = _str(row, "marque"),
                code_barre_serial = _str(row, "code_barre_serial"),
                date_achat        = _date(row, "date_achat"),
                prix_achat        = _dec(row, "prix_achat"),
                site_achat        = _str(row, "site_achat"),
                etat              = _str(row, "etat"),
                notes             = _str(row, "notes"),
                caracteristiques  = caract,
            ))
            created += 1
        except Exception as e:
            errors.append(f"Ligne {i}: {e}")
    db.commit()
    return {"created": created, "skipped": skipped, "errors": errors}


# ══════════════════════════════════════════
# Sols & Engrais — Export / Import
# ══════════════════════════════════════════

@router.get("/export/engrais")
def export_engrais(db: Session = Depends(get_db)):
    produits = db.query(ProduitEngrais).order_by(ProduitEngrais.nom_produit).all()
    rows = [["nom_produit", "marque", "type_produit", "conditionnement",
             "volume_conditionnement", "unite_volume",
             "prix_achat", "date_achat", "date_peremption",
             "quantite_stock", "unite_quantite", "dosage_conseille", "notes"]]
    for p in produits:
        rows.append([
            p.nom_produit, p.marque, p.type_produit, p.conditionnement,
            p.volume_conditionnement, p.unite_volume,
            p.prix_achat, p.date_achat, p.date_peremption,
            p.quantite_stock, p.unite_quantite, p.dosage_conseille, p.notes,
        ])
    return _csv_response(rows, "sols_engrais.csv")


# ══════════════════════════════════════════
# BACKUP — mysqldump / restore
# ══════════════════════════════════════════

def _mysql_credentials():
    """Retourne les credentials MySQL depuis les variables d'environnement."""
    return {
        "host":     os.getenv("DB_HOST", "db"),
        "user":     os.getenv("MYSQL_USER", "grow"),
        "password": os.getenv("MYSQL_PASSWORD", "grow2024"),
        "database": os.getenv("MYSQL_DATABASE", "growmanager"),
    }


@router.get("/backup/dump", summary="Export complet mysqldump (.sql)")
def backup_dump():
    """Lance mysqldump et renvoie le fichier .sql en téléchargement."""
    creds = _mysql_credentials()
    try:
        result = subprocess.run(
            [
                "mysqldump",
                f"--host={creds['host']}",
                f"--user={creds['user']}",
                f"--password={creds['password']}",
                "--single-transaction",
                "--routines",
                "--triggers",
                "--skip-ssl",
                creds["database"],
            ],
            capture_output=True,
            timeout=120,
        )
    except FileNotFoundError:
        raise HTTPException(status_code=500, detail="mysqldump introuvable — rebuild le container backend")
    except subprocess.TimeoutExpired:
        raise HTTPException(status_code=500, detail="mysqldump timeout (> 120s)")

    if result.returncode != 0:
        err = result.stderr.decode(errors="replace")
        raise HTTPException(status_code=500, detail=f"mysqldump erreur : {err}")

    filename = f"growmanager_backup_{datetime.now().strftime('%Y%m%d_%H%M%S')}.sql"
    return Response(
        content=result.stdout,
        media_type="application/octet-stream",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


@router.post("/backup/restore", summary="Restaure la base depuis un fichier .sql")
async def backup_restore(file: UploadFile = File(...)):
    """Exécute un fichier SQL via mysql pour restaurer la base."""
    if not (file.filename or "").lower().endswith(".sql"):
        raise HTTPException(status_code=400, detail="Le fichier doit avoir l'extension .sql")

    content = await file.read()
    if not content.strip():
        raise HTTPException(status_code=400, detail="Le fichier est vide")

    creds = _mysql_credentials()
    try:
        result = subprocess.run(
            [
                "mysql",
                f"--host={creds['host']}",
                f"--user={creds['user']}",
                f"--password={creds['password']}",
                "--skip-ssl",
                creds["database"],
            ],
            input=content,
            capture_output=True,
            timeout=120,
        )
    except FileNotFoundError:
        raise HTTPException(status_code=500, detail="mysql client introuvable — rebuild le container backend")
    except subprocess.TimeoutExpired:
        raise HTTPException(status_code=500, detail="Restauration timeout (> 120s)")

    if result.returncode != 0:
        err = result.stderr.decode(errors="replace")
        raise HTTPException(status_code=500, detail=f"Restauration échouée : {err}")

    return {"ok": True, "message": "Base de données restaurée avec succès"}


@router.post("/import/engrais")
def import_engrais(file: UploadFile = File(...), db: Session = Depends(get_db)):
    reader = _parse_csv(file.file.read())
    created, skipped, errors = 0, 0, []

    def _str(row, k):
        return (row.get(k) or "").strip() or None
    def _dec(row, k):
        v = _str(row, k)
        if not v: return None
        try: return float(v.replace(",", "."))
        except: return None
    def _date(row, k):
        v = _str(row, k)
        if not v: return None
        from datetime import datetime as _dt
        for fmt in ("%Y-%m-%d", "%d/%m/%Y", "%d-%m-%Y", "%Y/%m/%d"):
            try: return _dt.strptime(v, fmt).date()
            except ValueError: continue
        return None

    for i, row in enumerate(reader, start=2):
        nom = _str(row, "nom_produit")
        if not nom:
            skipped += 1
            continue
        try:
            db.add(ProduitEngrais(
                nom_produit            = nom,
                marque                 = _str(row, "marque"),
                type_produit           = _str(row, "type_produit"),
                conditionnement        = _str(row, "conditionnement"),
                volume_conditionnement = _dec(row, "volume_conditionnement"),
                unite_volume           = _str(row, "unite_volume"),
                prix_achat             = _dec(row, "prix_achat"),
                date_achat             = _date(row, "date_achat"),
                date_peremption        = _date(row, "date_peremption"),
                quantite_stock         = _dec(row, "quantite_stock"),
                unite_quantite         = _str(row, "unite_quantite"),
                dosage_conseille       = _str(row, "dosage_conseille"),
                notes                  = _str(row, "notes"),
            ))
            created += 1
        except Exception as e:
            errors.append(f"Ligne {i}: {e}")
    db.commit()
    return {"created": created, "skipped": skipped, "errors": errors}
