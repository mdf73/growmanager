"""Schemas Pydantic pour le Suivi des Sols Vivants"""
from pydantic import BaseModel, ConfigDict
from typing import Optional, List
from datetime import date


# ── Réamendements ──────────────────────────────────────────────────────────────

class SuiviReamendementBase(BaseModel):
    id_recette_reamend: Optional[int]  = None
    date_application:   Optional[date] = None
    notes:              Optional[str]  = None


class SuiviReamendementCreate(SuiviReamendementBase):
    pass


class SuiviReamendementRead(SuiviReamendementBase):
    id_suivi_reamend:   int
    nom_recette_reamend: Optional[str]  = None
    cout_estime:         Optional[float]= None
    model_config = ConfigDict(from_attributes=True)


# ── Arrosages ─────────────────────────────────────────────────────────────────

class SuiviArrosageBase(BaseModel):
    id_recette_engrais:  Optional[int]  = None
    volume_eau_l:        Optional[float]= None
    date_application:    Optional[date] = None
    notes:               Optional[str]  = None


class SuiviArrosageCreate(SuiviArrosageBase):
    pass


class SuiviArrosageRead(SuiviArrosageBase):
    id_suivi_arrosage:   int
    nom_recette_arrosage: Optional[str]  = None
    cout_estime:          Optional[float]= None
    model_config = ConfigDict(from_attributes=True)


# ── TCO ───────────────────────────────────────────────────────────────────────

class SuiviTCOBase(BaseModel):
    id_recette_tco:  Optional[int]  = None
    volume_applique: Optional[float]= None
    date_application: Optional[date]= None
    notes:           Optional[str]  = None


class SuiviTCOCreate(SuiviTCOBase):
    pass


class SuiviTCORead(SuiviTCOBase):
    id_suivi_tco:   int
    nom_recette_tco: Optional[str] = None
    model_config = ConfigDict(from_attributes=True)


# ── Fermentation ──────────────────────────────────────────────────────────────

class SuiviFermentationBase(BaseModel):
    id_recette_ferm: Optional[int]  = None
    volume_applique: Optional[float]= None
    date_application: Optional[date]= None
    notes:           Optional[str]  = None


class SuiviFermentationCreate(SuiviFermentationBase):
    pass


class SuiviFermentationRead(SuiviFermentationBase):
    id_suivi_ferm:    int
    nom_recette_ferm: Optional[str] = None
    model_config = ConfigDict(from_attributes=True)


# ── Cultures ──────────────────────────────────────────────────────────────────

class SuiviCultureBase(BaseModel):
    description: Optional[str]  = None
    date_debut:  Optional[date] = None
    date_fin:    Optional[date] = None
    notes:       Optional[str]  = None


class SuiviCultureCreate(SuiviCultureBase):
    pass


class SuiviCultureRead(SuiviCultureBase):
    id_suivi_culture: int
    model_config = ConfigDict(from_attributes=True)


# ── Suivi principal ───────────────────────────────────────────────────────────

class SuiviSolVivantBase(BaseModel):
    nom_pot:         str
    id_materiel:     Optional[int]  = None
    id_recette_lso:  Optional[int]  = None
    volume_pot_l:    Optional[float]= None
    date_preparation: Optional[date]= None
    commentaires:    Optional[str]  = None


class SuiviSolVivantCreate(SuiviSolVivantBase):
    reamendements: List[SuiviReamendementCreate] = []
    arrosages:     List[SuiviArrosageCreate]     = []
    tcos:          List[SuiviTCOCreate]          = []
    fermentations: List[SuiviFermentationCreate] = []
    cultures:      List[SuiviCultureCreate]      = []


class SuiviSolVivantUpdate(BaseModel):
    nom_pot:         Optional[str]  = None
    id_materiel:     Optional[int]  = None
    id_recette_lso:  Optional[int]  = None
    volume_pot_l:    Optional[float]= None
    date_preparation: Optional[date]= None
    commentaires:    Optional[str]  = None
    reamendements:   Optional[List[SuiviReamendementCreate]] = None
    arrosages:       Optional[List[SuiviArrosageCreate]]     = None
    tcos:            Optional[List[SuiviTCOCreate]]          = None
    fermentations:   Optional[List[SuiviFermentationCreate]] = None
    cultures:        Optional[List[SuiviCultureCreate]]      = None


class SuiviSolVivantRead(SuiviSolVivantBase):
    id_suivi:          int
    nom_recette_lso:   Optional[str]  = None
    nom_materiel:      Optional[str]  = None
    cout_lso_estime:   Optional[float]= None
    cout_total_estime: Optional[float]= None
    reamendements:     List[SuiviReamendementRead]  = []
    arrosages:         List[SuiviArrosageRead]      = []
    tcos:              List[SuiviTCORead]           = []
    fermentations:     List[SuiviFermentationRead]  = []
    cultures:          List[SuiviCultureRead]       = []
    model_config = ConfigDict(from_attributes=True)
