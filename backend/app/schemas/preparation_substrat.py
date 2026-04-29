"""Schémas Pydantic — Préparation substrat"""
from datetime import date, datetime
from typing import Optional, List, Any
from pydantic import BaseModel


class PotConfig(BaseModel):
    volume_l: float
    nb: int


class IngredientResult(BaseModel):
    label: str
    quantite: float
    unite: str


class PreparationSubstratCreate(BaseModel):
    date_preparation: Optional[date] = None
    volume_total_l: float
    type_sol: Optional[str] = None
    id_recette_lso: Optional[int] = None
    nom_recette_lso: Optional[str] = None
    configuration_pots: Optional[List[PotConfig]] = None   # sérialisé en JSON
    resultat: Optional[List[IngredientResult]] = None       # sérialisé en JSON
    notes: Optional[str] = None


class PreparationSubstratRead(BaseModel):
    id_preparation: int
    date_preparation: date
    volume_total_l: float
    type_sol: Optional[str] = None
    id_recette_lso: Optional[int] = None
    nom_recette_lso: Optional[str] = None
    configuration_pots: Optional[Any] = None
    resultat: Optional[Any] = None
    notes: Optional[str] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True
