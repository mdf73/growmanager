"""Schémas Pydantic pour NotationVariete (Classement des variétés)."""
from datetime import date, datetime
from typing import Optional
from pydantic import BaseModel, Field


# ── Champs communs ─────────────────────────────────────────────────────────────

class NotationBase(BaseModel):
    nom_variete:      str
    breeder:          Optional[str]   = None
    date_notation:    Optional[date]  = None

    # Notes manuelles sur 5 étoiles
    note_gout:        Optional[float] = Field(None, ge=0, le=5)
    note_odeur:       Optional[float] = Field(None, ge=0, le=5)
    note_texture:     Optional[float] = Field(None, ge=0, le=5)
    note_extraction:  Optional[float] = Field(None, ge=0, le=5)

    # Labo (informatif)
    taux_thc:         Optional[float] = None
    taux_cbd:         Optional[float] = None
    terpene_dominant: Optional[str]   = None
    commentaire_labo: Optional[str]   = None
    notes_generales:  Optional[str]   = None


class NotationCreate(NotationBase):
    pass


class NotationUpdate(BaseModel):
    """Tous les champs optionnels pour la mise à jour partielle."""
    nom_variete:      Optional[str]   = None
    breeder:          Optional[str]   = None
    date_notation:    Optional[date]  = None

    note_gout:        Optional[float] = Field(None, ge=0, le=5)
    note_odeur:       Optional[float] = Field(None, ge=0, le=5)
    note_texture:     Optional[float] = Field(None, ge=0, le=5)
    note_extraction:  Optional[float] = Field(None, ge=0, le=5)

    taux_thc:         Optional[float] = None
    taux_cbd:         Optional[float] = None
    terpene_dominant: Optional[str]   = None
    commentaire_labo: Optional[str]   = None
    notes_generales:  Optional[str]   = None


class NotationRead(NotationBase):
    id_notation:  int
    created_at:   Optional[datetime] = None
    updated_at:   Optional[datetime] = None
    note_moyenne: Optional[float]    = None   # moyenne des notes renseignées (/5)

    model_config = {"from_attributes": True}
