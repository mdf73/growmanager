"""Schémas Pydantic pour NotationVariete (Classement des variétés)."""
from datetime import date, datetime
from typing import Optional
from pydantic import BaseModel, Field


# ── Champs communs ─────────────────────────────────────────────────────────────

class NotationBase(BaseModel):
    nom_variete:            str
    breeder:                Optional[str]   = None
    date_notation:          Optional[date]  = None

    # Partie A — Culture (/30)
    vigueur_sante:          Optional[float] = Field(None, ge=0, le=10)
    productivite_structure: Optional[float] = Field(None, ge=0, le=10)
    soif:                   Optional[float] = Field(None, ge=0, le=10)

    # Partie B — Consommation (/70)
    apparence_structure:    Optional[float] = Field(None, ge=0, le=15)
    profil_aromatique:      Optional[float] = Field(None, ge=0, le=15)
    saveur_qualite:         Optional[float] = Field(None, ge=0, le=20)
    effet_puissance:        Optional[float] = Field(None, ge=0, le=20)

    # Labo (informatif)
    taux_thc:               Optional[float] = None
    taux_cbd:               Optional[float] = None
    terpene_dominant:       Optional[str]   = None
    commentaire_labo:       Optional[str]   = None
    notes_generales:        Optional[str]   = None


class NotationCreate(NotationBase):
    pass


class NotationUpdate(BaseModel):
    """Tous les champs optionnels pour la mise à jour partielle."""
    nom_variete:            Optional[str]   = None
    breeder:                Optional[str]   = None
    date_notation:          Optional[date]  = None

    vigueur_sante:          Optional[float] = Field(None, ge=0, le=10)
    productivite_structure: Optional[float] = Field(None, ge=0, le=10)
    soif:                   Optional[float] = Field(None, ge=0, le=10)

    apparence_structure:    Optional[float] = Field(None, ge=0, le=15)
    profil_aromatique:      Optional[float] = Field(None, ge=0, le=15)
    saveur_qualite:         Optional[float] = Field(None, ge=0, le=20)
    effet_puissance:        Optional[float] = Field(None, ge=0, le=20)

    taux_thc:               Optional[float] = None
    taux_cbd:               Optional[float] = None
    terpene_dominant:       Optional[str]   = None
    commentaire_labo:       Optional[str]   = None
    notes_generales:        Optional[str]   = None


class NotationRead(NotationBase):
    id_notation:   int
    created_at:    Optional[datetime] = None
    updated_at:    Optional[datetime] = None

    # Scores calculés (retournés par l'API)
    total_culture:      Optional[float] = None   # /30
    total_consommation: Optional[float] = None   # /70
    note_finale:        Optional[float] = None   # /100

    model_config = {"from_attributes": True}
