"""Router ParametreListeValeur — CRUD des listes déroulantes paramétrables"""
from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import insert
from sqlalchemy.exc import IntegrityError
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
    # Matériel — général
    "materiel_categories": ["Bocaux", "Lampes", "Pots", "Coupelles et bacs", "Arrosage", "Tentes",
                          "Pompes et Bulleurs", "Ventilation", "Filets", "Séchage", "Outils"],
    "etats_materiel":    ["Neuf", "Bon état", "Usagé", "Hors service"],
    # Matériel — vaporisateurs
    "vapo_types_chauffe":  ["Conduction", "Convection", "Mixte", "Induction"],
    "vapo_types_batterie": ["Intégrée", "Amovible 18650"],
    "vapo_types_charge":   ["USB-C", "Propriétaire", "Micro-USB", "Autre"],
    "vapo_compatibilites": ["Fleurs séchées", "Résines", "Concentrés (Rosin)"],
    "vapo_conso_types":    ["Bol céramique", "Bol saphir", "Bol SiC", "Bol quartz",
                            "Terps ball", "Screen", "Joint", "Embout", "Autre"],
    "vapo_conso_matieres": ["Céramique", "Saphir", "SiC", "Quartz", "Titane", "Acier inox", "Verre", "Autre"],
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
    # Suivi de culture — carences détectables
    "carences": ["Azote (N)", "Phosphore (P)", "Potassium (K)", "Calcium (Ca)", "Magnésium (Mg)",
                 "Soufre (S)", "Fer (Fe)", "Manganèse (Mn)", "Zinc (Zn)", "Cuivre (Cu)",
                 "Bore (B)", "Molybdène (Mo)"],
}

# ── Valeurs verrouillées ──────────────────────────────────────────────────────
# Le code s'appuie sur ces valeurs (champs spécifiques par catégorie, « Bocaux » pour
# le stock et le curing) : ni renommables ni supprimables.
# Miroir : frontend/src/api/parametres.ts (LISTES_VERROUILLEES).
LISTES_VERROUILLEES: dict[str, list[str]] = {
    "materiel_categories": LISTE_DEFAULTS["materiel_categories"],
}


def _check_non_verrouille(row: ParametreListeValeur):
    if row.valeur in LISTES_VERROUILLEES.get(row.liste_nom, []):
        raise HTTPException(
            status_code=403,
            detail=f"« {row.valeur} » est une valeur de base utilisée par l'application : "
                   "elle ne peut être ni renommée ni supprimée",
        )


def _insert_ignore(db: Session, liste_nom: str, valeur: str, ordre: int):
    # INSERT IGNORE + index unique (liste_nom, valeur) : les 2 workers uvicorn exécutent
    # ce seed en parallèle au démarrage, le second ne doit pas créer de doublons.
    db.execute(insert(ParametreListeValeur).prefix_with("IGNORE").values(
        liste_nom=liste_nom, valeur=valeur, ordre=ordre))


def _commit_or_409(db: Session):
    """Index unique (liste_nom, valeur), insensible à la casse et aux accents (collation MySQL)."""
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="Cette valeur existe déjà dans la liste")


def seed_defaults(db: Session):
    """Insère les valeurs par défaut pour les listes vides au démarrage."""
    for liste_nom, valeurs in LISTE_DEFAULTS.items():
        count = db.query(ParametreListeValeur).filter(
            ParametreListeValeur.liste_nom == liste_nom
        ).count()
        if count == 0:
            for i, v in enumerate(valeurs):
                _insert_ignore(db, liste_nom, v, i)
    # Les valeurs verrouillées doivent toujours exister
    for liste_nom, valeurs in LISTES_VERROUILLEES.items():
        existantes = {r.valeur for r in db.query(ParametreListeValeur).filter(
            ParametreListeValeur.liste_nom == liste_nom).all()}
        for i, v in enumerate(valeurs):
            if v not in existantes:
                _insert_ignore(db, liste_nom, v, i)
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
    _commit_or_409(db)
    db.refresh(row)
    return row


@router.patch("/{id_parametre}", response_model=ParametreRead)
def update_value(id_parametre: int, payload: ParametreUpdate, db: Session = Depends(get_db)):
    row = db.query(ParametreListeValeur).filter(
        ParametreListeValeur.id_parametre == id_parametre
    ).first()
    if not row:
        raise HTTPException(status_code=404, detail="Paramètre introuvable")
    if payload.valeur is not None and payload.valeur != row.valeur:
        _check_non_verrouille(row)
    if payload.valeur is not None:
        row.valeur = payload.valeur
    if payload.ordre is not None:
        row.ordre = payload.ordre
    _commit_or_409(db)
    db.refresh(row)
    return row


@router.delete("/{id_parametre}", status_code=204)
def delete_value(id_parametre: int, db: Session = Depends(get_db)):
    row = db.query(ParametreListeValeur).filter(
        ParametreListeValeur.id_parametre == id_parametre
    ).first()
    if not row:
        raise HTTPException(status_code=404, detail="Paramètre introuvable")
    _check_non_verrouille(row)
    db.delete(row)
    db.commit()
