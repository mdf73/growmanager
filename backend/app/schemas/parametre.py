"""Schémas Pydantic pour ParametreListeValeur"""
from pydantic import BaseModel, ConfigDict


class ParametreCreate(BaseModel):
    valeur: str
    ordre:  int = 0


class ParametreUpdate(BaseModel):
    valeur: str | None = None
    ordre:  int | None = None


class ParametreRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id_parametre: int
    liste_nom:    str
    valeur:       str
    ordre:        int
