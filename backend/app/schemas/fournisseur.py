"""Schemas Pydantic pour Fournisseur"""
from pydantic import BaseModel, ConfigDict
from typing import Optional


class FournisseurBase(BaseModel):
    nom_fournisseur: str
    site_web: Optional[str] = None


class FournisseurCreate(FournisseurBase):
    pass


class FournisseurRead(FournisseurBase):
    id_fournisseur: int

    model_config = ConfigDict(from_attributes=True)
