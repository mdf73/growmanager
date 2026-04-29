"""Schemas Pydantic pour les extractions (Rosin et Hash)"""
from pydantic import BaseModel, ConfigDict
from typing import Optional
from datetime import date


class RosinExtractionBase(BaseModel):
    """Schéma de base pour RosinExtraction"""
    id_bocal: Optional[int] = None
    id_rosinbag: Optional[int] = None
    id_press: Optional[int] = None
    id_stock_source: Optional[int] = None
    nom_variete_extract: Optional[str] = None
    date_rosinextraction: date
    # Paramètres d'extraction
    temperature_extraction: Optional[int] = None   # °C
    maillage: Optional[str] = None                 # ex: 72µ, 90µ…
    duree_preheat: Optional[int] = None            # secondes
    duree_extraction: Optional[int] = None         # secondes
    # Sacs d'entrée (g)
    sac_1_poids: Optional[float] = None
    sac_2_poids: Optional[float] = None
    sac_3_poids: Optional[float] = None
    sac_4_poids: Optional[float] = None
    quantite_utilisee: float        # total entrée = somme des sacs
    # Passes de presse (g)
    presse_1_poids: Optional[float] = None
    presse_2_poids: Optional[float] = None
    presse_3_poids: Optional[float] = None
    presse_4_poids: Optional[float] = None
    quantite_extraite: float        # total sortie = somme des passes
    info_rosinextraction: Optional[str] = None


class RosinExtractionCreate(RosinExtractionBase):
    pass


class RosinExtractionRead(RosinExtractionBase):
    id_rosinextraction: int
    variete_nom: Optional[str] = None   # enrichi côté serveur

    model_config = ConfigDict(from_attributes=True)


class HashExtractionBase(BaseModel):
    id_variete:          Optional[int]   = None
    id_iceobag:          Optional[int]   = None
    id_stock_source:     Optional[int]   = None
    nom_variete_hash:    Optional[str]   = None
    date_hashextraction: date
    type_extraction:     Optional[str]   = None   # 'Polinator' | 'Ice-o-lator'
    duree_polinator:     Optional[int]   = None   # minutes
    passages:            Optional[list]  = None   # [{"duree": int}]
    sacs:                Optional[list]  = None   # [{"maillage": str, "poids": float}]
    quantite_utilisee:   float
    quantite_extraite:   float
    info_hashextraction: Optional[str]   = None


class HashExtractionCreate(HashExtractionBase):
    pass


class HashExtractionRead(HashExtractionBase):
    id_hashextraction: int
    variete_nom: Optional[str] = None   # enrichi côté serveur
    model_config = ConfigDict(from_attributes=True)


class ExtractionStats(BaseModel):
    ratio_moyen_rosin: float
    total_presse_g: float
    total_extrait_rosin_g: float
    total_extrait_hash_g: float
    nombre_extractions: int
    model_config = ConfigDict(from_attributes=True)
