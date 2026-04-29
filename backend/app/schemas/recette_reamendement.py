"""Schemas Pydantic pour RecetteReamendement"""
from pydantic import BaseModel, ConfigDict
from typing import Optional, List


class RecetteReamendementLigneBase(BaseModel):
    id_produit: int
    quantite:   float
    unite:      Optional[str] = None   # g | Kg | mL | L
    note_ligne: Optional[str] = None
    ordre:      int = 0


class RecetteReamendementLigneCreate(RecetteReamendementLigneBase):
    pass


class RecetteReamendementLigneRead(RecetteReamendementLigneBase):
    id_ligne:     int
    nom_produit:  Optional[str] = None
    type_produit: Optional[str] = None
    model_config  = ConfigDict(from_attributes=True)


class RecetteReamendementBase(BaseModel):
    nom_recette: str
    volume_pot:  Optional[float]= None   # volume du pot en L
    unite_pot:   Optional[str]  = "L"
    notes:       Optional[str]  = None


class RecetteReamendementCreate(RecetteReamendementBase):
    lignes: List[RecetteReamendementLigneCreate] = []


class RecetteReamendementUpdate(BaseModel):
    nom_recette: Optional[str]  = None
    volume_pot:  Optional[float]= None
    unite_pot:   Optional[str]  = None
    notes:       Optional[str]  = None
    lignes:      Optional[List[RecetteReamendementLigneCreate]] = None


class RecetteReamendementRead(RecetteReamendementBase):
    id_recette_reamend: int
    lignes:             List[RecetteReamendementLigneRead] = []
    model_config        = ConfigDict(from_attributes=True)
