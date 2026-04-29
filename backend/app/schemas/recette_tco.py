"""Schemas Pydantic pour RecetteTCO"""
from pydantic import BaseModel, ConfigDict
from typing import Optional, List


class RecetteTCOLigneBase(BaseModel):
    id_produit: int
    quantite:   float
    unite:      Optional[str] = None   # mL | L | g | Kg
    note_ligne: Optional[str] = None
    ordre:      int = 0


class RecetteTCOLigneCreate(RecetteTCOLigneBase):
    pass


class RecetteTCOLigneRead(RecetteTCOLigneBase):
    id_ligne:     int
    nom_produit:  Optional[str] = None   # enrichi depuis ProduitEngrais
    type_produit: Optional[str] = None   # enrichi depuis ProduitEngrais
    model_config  = ConfigDict(from_attributes=True)


# ── Recette principale ────────────────────────────────────────────────────────

class RecetteTCOBase(BaseModel):
    nom_recette:         str
    type_tco:            Optional[str]  = None   # Croissance | Stretch | Floraison | Correctif
    quantite_tco:        Optional[float]= None
    unite_tco:           Optional[str]  = None   # L | mL
    duree_oxygenation_h: Optional[int]  = None   # heures d'oxygénation avant utilisation
    notes:               Optional[str]  = None


class RecetteTCOCreate(RecetteTCOBase):
    lignes: List[RecetteTCOLigneCreate] = []


class RecetteTCOUpdate(BaseModel):
    nom_recette:         Optional[str]  = None
    type_tco:            Optional[str]  = None
    quantite_tco:        Optional[float]= None
    unite_tco:           Optional[str]  = None
    duree_oxygenation_h: Optional[int]  = None
    notes:               Optional[str]  = None
    lignes:              Optional[List[RecetteTCOLigneCreate]] = None


class RecetteTCORead(RecetteTCOBase):
    id_recette_tco: int
    lignes:         List[RecetteTCOLigneRead] = []
    model_config    = ConfigDict(from_attributes=True)
