"""Schemas Pydantic pour RecetteFermentation"""
from pydantic import BaseModel, ConfigDict
from typing import Optional, List


class RecetteFermentationLigneBase(BaseModel):
    id_produit: int
    quantite:   float
    unite:      Optional[str] = None   # mL | L | g | Kg
    note_ligne: Optional[str] = None
    ordre:      int = 0


class RecetteFermentationLigneCreate(RecetteFermentationLigneBase):
    pass


class RecetteFermentationLigneRead(RecetteFermentationLigneBase):
    id_ligne:     int
    nom_produit:  Optional[str] = None
    type_produit: Optional[str] = None
    model_config  = ConfigDict(from_attributes=True)


class RecetteFermentationBase(BaseModel):
    nom_recette:       str
    type_fermentation: Optional[str]  = None
    volume_total:      Optional[float]= None
    unite_volume:      Optional[str]  = None   # L | mL
    duree_fermentation: Optional[int] = None   # heures
    notes:             Optional[str]  = None


class RecetteFermentationCreate(RecetteFermentationBase):
    lignes: List[RecetteFermentationLigneCreate] = []


class RecetteFermentationUpdate(BaseModel):
    nom_recette:       Optional[str]  = None
    type_fermentation: Optional[str]  = None
    volume_total:      Optional[float]= None
    unite_volume:      Optional[str]  = None
    duree_fermentation: Optional[int] = None
    notes:             Optional[str]  = None
    lignes:            Optional[List[RecetteFermentationLigneCreate]] = None


class RecetteFermentationRead(RecetteFermentationBase):
    id_recette_ferm: int
    lignes:          List[RecetteFermentationLigneRead] = []
    model_config     = ConfigDict(from_attributes=True)
