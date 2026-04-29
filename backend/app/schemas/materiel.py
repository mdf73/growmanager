"""Schémas Pydantic pour Materiel"""
from datetime import date
from decimal import Decimal
from typing import Optional, Any, Dict
from pydantic import BaseModel, ConfigDict


class MaterielBase(BaseModel):
    categorie:         str
    nom:               str
    marque:            Optional[str]          = None
    code_barre_serial: Optional[str]          = None
    date_achat:        Optional[date]         = None
    prix_achat:        Optional[Decimal]      = None
    site_achat:        Optional[str]          = None
    etat:              Optional[str]          = None
    date_sortie_stock: Optional[date]         = None
    notes:             Optional[str]          = None
    caracteristiques:  Optional[Dict[str, Any]] = None


class MaterielCreate(MaterielBase):
    pass


class MaterielUpdate(BaseModel):
    categorie:         Optional[str]          = None
    nom:               Optional[str]          = None
    marque:            Optional[str]          = None
    code_barre_serial: Optional[str]          = None
    date_achat:        Optional[date]         = None
    prix_achat:        Optional[Decimal]      = None
    site_achat:        Optional[str]          = None
    etat:              Optional[str]          = None
    date_sortie_stock: Optional[date]         = None
    notes:             Optional[str]          = None
    caracteristiques:  Optional[Dict[str, Any]] = None


class MaterielRead(MaterielBase):
    model_config = ConfigDict(from_attributes=True)

    id_materiel: int
    age_jours:   Optional[int] = None   # calculé dans le router
