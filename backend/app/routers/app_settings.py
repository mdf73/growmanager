"""Router AppSettings — paramètres applicatifs clé/valeur (prix kWh, devise…)"""
from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel

from app.database import get_db
from app.models.all_models import AppSettings

router = APIRouter(prefix="/api/app-settings", tags=["app-settings"])

# ── Valeurs par défaut ────────────────────────────────────────────────────────
SETTINGS_DEFAULTS = [
    {"cle": "prix_kwh",  "valeur": "0.18", "label": "Prix du kWh (€)"},
    {"cle": "devise",    "valeur": "EUR",   "label": "Devise"},
]


def seed_defaults(db: Session):
    """Insère les settings par défaut s'ils n'existent pas encore."""
    for s in SETTINGS_DEFAULTS:
        existing = db.query(AppSettings).filter(AppSettings.cle == s["cle"]).first()
        if not existing:
            db.add(AppSettings(cle=s["cle"], valeur=s["valeur"], label=s["label"]))
    db.commit()


# ── Schémas ───────────────────────────────────────────────────────────────────
class SettingRead(BaseModel):
    cle:    str
    valeur: str | None
    label:  str | None

    class Config:
        from_attributes = True


class SettingUpdate(BaseModel):
    valeur: str


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("", response_model=List[SettingRead])
def get_all(db: Session = Depends(get_db)):
    return db.query(AppSettings).order_by(AppSettings.id).all()


@router.get("/{cle}", response_model=SettingRead)
def get_one(cle: str, db: Session = Depends(get_db)):
    row = db.query(AppSettings).filter(AppSettings.cle == cle).first()
    if not row:
        raise HTTPException(status_code=404, detail=f"Setting '{cle}' introuvable")
    return row


@router.put("/{cle}", response_model=SettingRead)
def upsert(cle: str, payload: SettingUpdate, db: Session = Depends(get_db)):
    row = db.query(AppSettings).filter(AppSettings.cle == cle).first()
    if row:
        row.valeur = payload.valeur
    else:
        row = AppSettings(cle=cle, valeur=payload.valeur)
        db.add(row)
    db.commit()
    db.refresh(row)
    return row
