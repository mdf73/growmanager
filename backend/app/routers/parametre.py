"""Router ParametreListeValeur — CRUD des listes déroulantes paramétrables"""
import unicodedata
from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import insert
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.database import get_db
from pydantic import BaseModel

from app.models.all_models import AppSettings, Fournisseur, ParametreListeValeur
from app.schemas.parametre import ParametreCreate, ParametreUpdate, ParametreRead

router = APIRouter(prefix="/api/parametres", tags=["parametres"])

# ── Standard des listes (ADR-011) ─────────────────────────────────────────────
# Aucune liste n'est remplie au démarrage : le standard (frontend/src/data/standard-parametres.json,
# source unique serveur + autonome) est envoyé par le frontend via POST /_standard/charger quand
# l'utilisateur presse un bouton de Paramétrage. Seules les valeurs verrouillées sont seedées.

# Listes techniques stockées dans la même table : jamais touchées par le chargement du standard.
LISTES_TECHNIQUES = {"govee_config"}

# ── Valeurs verrouillées ──────────────────────────────────────────────────────
# Le code s'appuie sur ces valeurs (champs spécifiques par catégorie, « Bocaux » pour
# le stock et le curing, types de stock testés par égalité) : ni renommables ni supprimables,
# toujours présentes. Miroir : frontend/src/api/parametres.ts (LISTES_VERROUILLEES).
LISTES_VERROUILLEES: dict[str, list[str]] = {
    "materiel_categories": ["Bocaux", "Lampes", "Pots", "Coupelles et bacs", "Arrosage", "Tentes",
                            "Pompes et Bulleurs", "Ventilation", "Filets", "Séchage", "Outils"],
    "types_stock": ["Fleur", "Trim", "WPFF", "Hash", "Rosin"],
}


def normaliser(valeur: str) -> str:
    """Clé de comparaison : minuscules, sans accents, espaces rognés et réduits.
    Miroir : frontend/src/api/parametres.ts (normaliserValeur)."""
    sans_accents = "".join(c for c in unicodedata.normalize("NFD", valeur)
                           if unicodedata.category(c) != "Mn")
    return " ".join(sans_accents.lower().split())


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
    """Au démarrage : seules les valeurs verrouillées doivent toujours exister."""
    for liste_nom, valeurs in LISTES_VERROUILLEES.items():
        existantes = {normaliser(r.valeur) for r in db.query(ParametreListeValeur).filter(
            ParametreListeValeur.liste_nom == liste_nom).all()}
        for i, v in enumerate(valeurs):
            if normaliser(v) not in existantes:
                _insert_ignore(db, liste_nom, v, i)
    db.commit()


def charger_valeurs(db: Session, listes: dict[str, list[str]]) -> dict[str, int]:
    """Insère les valeurs absentes (comparaison normalisée). Jamais d'UPDATE ni de DELETE.
    Retourne le nombre de valeurs ajoutées par liste."""
    ajouts: dict[str, int] = {}
    for liste_nom, valeurs in listes.items():
        if liste_nom in LISTES_TECHNIQUES:
            continue
        rows = db.query(ParametreListeValeur).filter(ParametreListeValeur.liste_nom == liste_nom).all()
        existantes = {normaliser(r.valeur) for r in rows}
        ordre = max((r.ordre or 0 for r in rows), default=-1) + 1
        n = 0
        for v in valeurs:
            v = (v or "").strip()
            if not v or normaliser(v) in existantes:
                continue
            _insert_ignore(db, liste_nom, v, ordre)
            existantes.add(normaliser(v))
            ordre += 1
            n += 1
        ajouts[liste_nom] = n
    db.commit()
    return ajouts


def migrer_fournisseurs_vers_liste(db: Session):
    """Migration unique : les fournisseurs de la table Fournisseur (packs de graines) rejoignent
    la liste paramétrable « fournisseurs », désormais seule source de la liste déroulante."""
    cle = "migr_fournisseurs_liste"
    if db.query(AppSettings).filter(AppSettings.cle == cle).first():
        return
    noms = [f.nom_fournisseur for f in db.query(Fournisseur).all() if f.nom_fournisseur]
    charger_valeurs(db, {"fournisseurs": noms})
    db.execute(insert(AppSettings).prefix_with("IGNORE").values(cle=cle, valeur="1", label=None))
    db.commit()


class StandardPayload(BaseModel):
    listes: dict[str, list[str]]


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("/_standard/charger")
def charger_standard(payload: StandardPayload, db: Session = Depends(get_db)):
    """Bouton « Charger les valeurs standard » : ajoute les valeurs absentes, n'écrase rien."""
    ajouts = charger_valeurs(db, payload.listes)
    return {"ajoutees": sum(ajouts.values()), "par_liste": ajouts}


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
