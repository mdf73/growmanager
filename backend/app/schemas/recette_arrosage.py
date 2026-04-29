"""Schemas Pydantic pour RecetteArrosage"""
from pydantic import BaseModel, ConfigDict
from typing import Optional, List


class RecetteArrosageLigneBase(BaseModel):
    id_produit: int
    quantite:   float
    unite:      Optional[str] = None   # mL | L | g | Kg
    note_ligne: Optional[str] = None
    ordre:      int = 0


class RecetteArrosageLigneCreate(RecetteArrosageLigneBase):
    pass


class RecetteArrosageLigneRead(RecetteArrosageLigneBase):
    id_ligne:     int
    nom_produit:  Optional[str] = None
    type_produit: Optional[str] = None
    model_config  = ConfigDict(from_attributes=True)


class RecetteArrosageBase(BaseModel):
    nom_recette:   str
    type_arrosage: Optional[str]  = None   # Eau simple | Eau + amendements
    quantite_eau:  Optional[float]= None
    unite_eau:     Optional[str]  = None   # L | mL
    notes:         Optional[str]  = None


class RecetteArrosageCreate(RecetteArrosageBase):
    lignes: List[RecetteArrosageLigneCreate] = []


class RecetteArrosageUpdate(BaseModel):
    nom_recette:   Optional[str]  = None
    type_arrosage: Optional[str]  = None
    quantite_eau:  Optional[float]= None
    unite_eau:     Optional[str]  = None
    notes:         Optional[str]  = None
    lignes:        Optional[List[RecetteArrosageLigneCreate]] = None


class RecetteArrosageRead(RecetteArrosageBase):
    id_recette_arrosage: int
    lignes:              List[RecetteArrosageLigneRead] = []
    model_config         = ConfigDict(from_attributes=True)
