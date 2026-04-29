"""Schemas Pydantic pour Breeder"""
from pydantic import BaseModel, ConfigDict
from typing import Optional
from datetime import date


class BreederBase(BaseModel):
    """Schéma de base pour Breeder"""
    nom_breeder: str
    origine_breeder: Optional[str] = None
    information_breeder: Optional[str] = None


class BreederCreate(BreederBase):
    """Schéma pour créer un Breeder"""
    pass


class BreederRead(BreederBase):
    """Schéma pour lire un Breeder"""
    id_breeder: int

    model_config = ConfigDict(from_attributes=True)


class BreederWithVarietes(BreederRead):
    """Schéma Breeder avec variétés associées"""
    # Les variétés seront ajoutées en tant que nested objects si nécessaire
    pass
