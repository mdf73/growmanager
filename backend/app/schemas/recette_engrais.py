"""Schemas Pydantic pour RecetteEngrais"""
from pydantic import BaseModel, ConfigDict
from typing import Optional, List


class RecetteEngraisLigneBase(BaseModel):
    id_produit:   int
    dosage:       float
    unite:        Optional[str] = None   # mL/L | g/L
    ordre:        int = 0


class RecetteEngraisLigneCreate(RecetteEngraisLigneBase):
    pass


class RecetteEngraisLigneRead(RecetteEngraisLigneBase):
    id_ligne:     int
    nom_produit:  Optional[str] = None   # enrichi depuis ProduitEngrais
    type_produit: Optional[str] = None   # enrichi depuis ProduitEngrais
    model_config  = ConfigDict(from_attributes=True)


# ── Recette principale ────────────────────────────────────────────────────────

class RecetteEngraisBase(BaseModel):
    nom_recette:  str
    type_recette: Optional[str]  = None   # Arrosage | Pulvérisation
    periode:      Optional[str]  = None
    semaine:      Optional[int]  = None   # 1-20
    ph_cible:     Optional[float]= None
    notes:        Optional[str]  = None


class RecetteEngraisCreate(RecetteEngraisBase):
    lignes: List[RecetteEngraisLigneCreate] = []


class RecetteEngraisUpdate(BaseModel):
    nom_recette:  Optional[str]  = None
    type_recette: Optional[str]  = None
    periode:      Optional[str]  = None
    semaine:      Optional[int]  = None
    ph_cible:     Optional[float]= None
    notes:        Optional[str]  = None
    lignes:       Optional[List[RecetteEngraisLigneCreate]] = None


class RecetteEngraisRead(RecetteEngraisBase):
    id_recette: int
    lignes:     List[RecetteEngraisLigneRead] = []
    model_config = ConfigDict(from_attributes=True)
