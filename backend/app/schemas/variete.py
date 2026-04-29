"""Schemas Pydantic pour Variete"""
from pydantic import BaseModel, ConfigDict
from typing import Optional


class VarieteBase(BaseModel):
    nom_variete: str
    croisement_variete: Optional[str] = None
    informations_variete: Optional[str] = None
    lien_web: Optional[str] = None


class VarieteCreate(VarieteBase):
    pass


class VarieteRead(VarieteBase):
    id_variete: int
    model_config = ConfigDict(from_attributes=True)
