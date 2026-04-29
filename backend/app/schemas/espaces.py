"""Schemas Pydantic pour EspaceCulture"""
from pydantic import BaseModel, ConfigDict
from typing import Optional, List
from datetime import date


class EspaceMaterielBase(BaseModel):
    id_materiel:       int
    date_assignation:  Optional[date] = None
    notes:             Optional[str]  = None


class EspaceMaterielCreate(EspaceMaterielBase):
    pass


class EspaceMaterielRead(EspaceMaterielBase):
    id_espace_materiel: int
    nom_materiel:       Optional[str] = None
    categorie:          Optional[str] = None
    marque:             Optional[str] = None
    etat:               Optional[str] = None
    model_config = ConfigDict(from_attributes=True)


class EspaceCultureBase(BaseModel):
    nom:                   str
    type_espace:           Optional[str]  = None
    id_materiel_principal: Optional[int]  = None
    dimensions:            Optional[str]  = None   # ex: "60x60x160 cm"
    surface_m2:            Optional[float]= None
    hauteur_cm:            Optional[int]  = None
    statut:                Optional[str]  = "Actif"   # Actif | Inactif | Maintenance
    notes:                 Optional[str]  = None


class EspaceCultureCreate(EspaceCultureBase):
    equipements: List[EspaceMaterielCreate] = []


class EspaceCultureUpdate(BaseModel):
    nom:                   Optional[str]  = None
    type_espace:           Optional[str]  = None
    id_materiel_principal: Optional[int]  = None
    dimensions:            Optional[str]  = None
    surface_m2:            Optional[float]= None
    hauteur_cm:            Optional[int]  = None
    statut:                Optional[str]  = None
    notes:                 Optional[str]  = None
    equipements:           Optional[List[EspaceMaterielCreate]] = None


class EspaceCultureRead(EspaceCultureBase):
    id_espace:              int
    nom_materiel_principal: Optional[str] = None
    equipements:            List[EspaceMaterielRead] = []
    model_config = ConfigDict(from_attributes=True)
