"""Schémas Pydantic pour SessionConsommation"""
from datetime import datetime
from typing import Any, Dict, Optional
from pydantic import BaseModel, Field


class SessionConsommationCreate(BaseModel):
    date_heure:       Optional[datetime]   = None   # None → datetime.utcnow côté serveur
    id_vaporisateur:  Optional[int]        = None
    type_produit:     str                           # fleur | hash | rosin
    id_stock:         Optional[int]        = None
    quantite_g:       float                = Field(..., gt=0)
    options_vapo:     Optional[Dict[str, Any]] = None
    notes:            Optional[str]        = None


class SessionConsommationUpdate(BaseModel):
    date_heure:       Optional[datetime]   = None
    id_vaporisateur:  Optional[int]        = None
    type_produit:     Optional[str]        = None
    id_stock:         Optional[int]        = None
    quantite_g:       Optional[float]      = None
    options_vapo:     Optional[Dict[str, Any]] = None
    notes:            Optional[str]        = None


class SessionConsommationRead(BaseModel):
    id_session:       int
    date_heure:       datetime
    id_vaporisateur:  Optional[int]
    nom_vaporisateur: Optional[str]        = None   # enrichi
    type_produit:     str
    id_stock:         Optional[int]
    nom_variete:      Optional[str]        = None   # enrichi depuis Stock → Variete
    quantite_g:       float
    options_vapo:     Optional[Dict[str, Any]]
    notes:            Optional[str]
    created_at:       Optional[datetime]

    class Config:
        from_attributes = True
