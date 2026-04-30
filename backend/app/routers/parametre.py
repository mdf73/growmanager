"""Router ParametreListeValeur — CRUD des listes déroulantes paramétrables"""
from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.all_models import ParametreListeValeur
from app.schemas.parametre import ParametreCreate, ParametreUpdate, ParametreRead

router = APIRouter(prefix="/api/parametres", tags=["parametres"])

# ── Valeurs par défaut pour chaque liste ──────────────────────────────────────
LISTE_DEFAULTS: dict[str, list[str]] = {
    # Général
    "marques":      [],
    "fournisseurs": ["Amazon", "Azaneo", "Opengrow", "Growshop", "Cultura", "eBay", "AliExpress"],
    # Historique Culture
    "tentes":         ["60x60x100", "60x120x150", "100x100x200", "120x120x200", "Exterieur"],
    "lampes_hc":      ["LED Crescience", "LED Marshydro", "MH", "HPS"],
    "puissances_hc":  ["110", "135", "150", "550", "600"],
    "types_culture":  ["Indoor", "Outdoor"],
    "engrais":        ["Living Soil (LSO)", "Aptus", "Hesi", "Aucun", "Autre"],
    "substrats":      ["LSO", "Terre", "Terre+Coco", "Coco", "NFT", "Billes d'argile", "Pleine terre"],
    # Matériel
    "lampes_types":      ["LED", "HPS", "MH", "CMH"],
    "spectres":          ["Full Spectrum", "Veg", "Bloom", "2700K", "3000K", "4000K", "5000K",
                          "6500K", "254nm", "350nm", "450nm", "660nm", "730nm", "760nm"],
    "pot_matieres":      ["Plastique", "Tissu", "Céramique", "Autre"],
    "arrosage_types":    ["Goutte-à-goutte", "Arrosoir"],
    "pompe_types":       ["Pompe à eau", "Bulleur", "Pompe à air"],
    "ventilation_types": ["Extracteur", "Intracteur", "Ventilateur", "Ventilateur oscillant"],
    "filet_types":       ["LST", "SCROG"],
    "sechage_types":     ["Filet", "Penderie", "Rack"],
    "outil_types":       ["Cisailles", "Loupe", "pH-mètre", "EC-mètre",
                          "Hygromètre", "Thermomètre", "Balance", "Autre"],
    # Matériel — Bocaux
    "bocal_fermetures":  ["Couvercle à vis", "Bail clasp (Le Parfait)", "Mason Jar", "Flip-top", "Autre"],
    "bocal_couleurs":    ["Clair", "Ambré", "Teinté"],
    "bocal_usages":      ["Curing", "Stockage longue durée", "Fermentation", "Infusion", "Autre"],
    # Stock — types & maillages
    "types_hash":       ["Ice-O-Lator Dry", "Ice-o-Lator WPFF", "Dry", "FingerHash", "Pollinator", "Static"],
    "types_stock":      ["Fleur", "Trim", "WPFF", "Hash", "Rosin", "Autre"],
    "sous_types_stock": ["Indoor", "Outdoor"],
    "types_rosin":      ["Flower Rosin", "Hash Rosin"],
    "lampes_stock":     ["LED Crescience 500W", "LED Crescience 110W", "LED MarsHydro 135W", "Soleil"],
    "maillages_iceolator": ["15µ", "25µ", "45µ", "73µ", "90µ", "160µ", "190µ", "220µ"],
    "maillages_rosin":     ["25µ", "36µ", "45µ", "72µ", "90µ", "120µ", "160µ", "220µ"],
    # Recettes
    "periodes_recette": ["Veg", "Early Flo", "Flo", "Late Flo", "Maturation", "Flush"],
    "types_lso": ["Substrat de base", "Super soil", "Mix transplantation", "Top dress", "Correctif"],
    "types_fermentation": ["AACT", "Compost tea", "Lactofermentation", "Bokashi", "JADAM JLF", "Autre"],
    "types_espace": ["Tente", "Box", "Armoire", "Chambre", "Outdoor", "Serre", "Autre"],
    # Culture — but de culture
    "buts_culture": ["Récolte", "Hunt", "Reproduction"],
    # Préparation substrat — types de sol
    "types_sol_preparation": ["Sol vivant (LSO)", "Coco seul", "Terre seule", "Coco + Terre"],
}


def seed_defaults(db: Session):
    """Insère les valeurs par défaut pour les listes vides au démarrage."""
    for liste_nom, valeurs in LISTE_DEFAULTS.items():
        count = db.query(ParametreListeValeur).filter(
            ParametreListeValeur.liste_nom == liste_nom
        ).count()
        if count == 0:
            for i, v in enumerate(valeurs):
                db.add(ParametreListeValeur(liste_nom=liste_nom, valeur=v, ordre=i))
    db.commit()


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/{liste_nom}", response_model=List[ParametreRead])
def get_list(liste_nom: str, db: Session = Depends(get_db)):
    return (
        db.query(ParametreListeValeur)
        .filter(ParametreListeValeur.liste_nom == liste_nom)
        .order_by(ParametreListeValeur.ordre, ParametreListeValeur.valeur)
        .all()
    )


@router.post("/{liste_nom}", response_model=ParametreRead, status_code=201)
def add_value(liste_nom: str, payload: ParametreCreate, db: Session = Depends(get_db)):
    # Vérifier les doublons (insensible à la casse)
    exists = db.query(ParametreListeValeur).filter(
        ParametreListeValeur.liste_nom == liste_nom,
        ParametreListeValeur.valeur == payload.valeur,
    ).first()
    if exists:
        raise HTTPException(status_code=409, detail="Cette valeur existe déjà dans la liste")
    # Ordre auto = max + 1
    from sqlalchemy import func
    max_ordre = db.query(func.max(ParametreListeValeur.ordre)).filter(
        ParametreListeValeur.liste_nom == liste_nom
    ).scalar() or 0
    row = ParametreListeValeur(liste_nom=liste_nom, valeur=payload.valeur, ordre=max_ordre + 1)
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


@router.patch("/{id_parametre}", response_model=ParametreRead)
def update_value(id_parametre: int, payload: ParametreUpdate, db: Session = Depends(get_db)):
    row = db.query(ParametreListeValeur).filter(
        ParametreListeValeur.id_parametre == id_parametre
    ).first()
    if not row:
        raise HTTPException(status_code=404, detail="Paramètre introuvable")
    if payload.valeur is not None:
        row.valeur = payload.valeur
    if payload.ordre is not None:
        row.ordre = payload.ordre
    db.commit()
    db.refresh(row)
    return row


@router.delete("/{id_parametre}", status_code=204)
def delete_value(id_parametre: int, db: Session = Depends(get_db)):
    row = db.query(ParametreListeValeur).filter(
        ParametreListeValeur.id_parametre == id_parametre
    ).first()
    if not row:
        raise HTTPException(status_code=404, detail="Paramètre introuvable")
    db.delete(row)
    db.commit()
