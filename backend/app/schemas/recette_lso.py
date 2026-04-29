"""Schemas Pydantic pour RecetteLSO (Sol Vivant)"""
from pydantic import BaseModel, ConfigDict
from typing import Optional, List


class RecetteLSOLigneBase(BaseModel):
    id_produit: int
    quantite:   float
    unite:      Optional[str] = None   # mL | L | g | Kg
    note_ligne: Optional[str] = None
    ordre:      int = 0


class RecetteLSOLigneCreate(RecetteLSOLigneBase):
    pass


class RecetteLSOLigneRead(RecetteLSOLigneBase):
    id_ligne:     int
    nom_produit:  Optional[str] = None
    type_produit: Optional[str] = None
    model_config  = ConfigDict(from_attributes=True)


class RecetteLSOBase(BaseModel):
    nom_recette:     str
    type_lso:        Optional[str]  = None
    quantite_totale: Optional[float]= None
    unite_quantite:  Optional[str]  = None   # L | Kg
    notes:           Optional[str]  = None


class RecetteLSOCreate(RecetteLSOBase):
    lignes: List[RecetteLSOLigneCreate] = []


class RecetteLSOUpdate(BaseModel):
    nom_recette:     Optional[str]  = None
    type_lso:        Optional[str]  = None
    quantite_totale: Optional[float]= None
    unite_quantite:  Optional[str]  = None
    notes:           Optional[str]  = None
    lignes:          Optional[List[RecetteLSOLigneCreate]] = None


class RecetteLSORead(RecetteLSOBase):
    id_recette_lso: int
    lignes:         List[RecetteLSOLigneRead] = []
    model_config    = ConfigDict(from_attributes=True)
