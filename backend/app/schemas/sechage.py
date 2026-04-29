"""Schemas Pydantic pour SessionSechage et PlantSechage"""
from pydantic import BaseModel, ConfigDict
from typing import Optional
from datetime import date, datetime


# ═══════════════════════════════════════════════════════════════════════════════
# PLANT SECHAGE
# ═══════════════════════════════════════════════════════════════════════════════

class PlantSechageCreate(BaseModel):
    id_plant: int
    date_mise_sechage: Optional[date] = None
    date_fin_sechage: Optional[date] = None
    poids_humide_g: Optional[float] = None
    poids_sec_g: Optional[float] = None
    notes: Optional[str] = None


class PlantSechageUpdate(BaseModel):
    date_mise_sechage: Optional[date] = None
    date_fin_sechage: Optional[date] = None
    poids_humide_g: Optional[float] = None
    poids_sec_g: Optional[float] = None
    notes: Optional[str] = None


class PlantSechageRead(BaseModel):
    id_plant_sechage: int
    id_plant: int
    id_session_sechage: int
    date_mise_sechage: Optional[date] = None
    date_fin_sechage: Optional[date] = None
    poids_humide_g: Optional[float] = None
    poids_sec_g: Optional[float] = None
    notes: Optional[str] = None
    # Enrichis
    nom_plant: Optional[str] = None
    nom_variete: Optional[str] = None
    id_culture: Optional[int] = None
    nom_culture: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


# ═══════════════════════════════════════════════════════════════════════════════
# SESSION SECHAGE
# ═══════════════════════════════════════════════════════════════════════════════

class SessionSechageCreate(BaseModel):
    id_espace: Optional[int] = None
    nom: Optional[str] = None
    methode_sechage: Optional[str] = None        # Filet | Penderie | Rack
    temperature_cible: Optional[float] = None
    humidite_cible: Optional[float] = None
    date_debut: Optional[date] = None
    notes: Optional[str] = None
    # Plantes à ajouter directement à la création
    plants: list[PlantSechageCreate] = []


class SessionSechageUpdate(BaseModel):
    id_espace: Optional[int] = None
    nom: Optional[str] = None
    methode_sechage: Optional[str] = None
    temperature_cible: Optional[float] = None
    humidite_cible: Optional[float] = None
    statut: Optional[str] = None
    date_debut: Optional[date] = None
    date_fin: Optional[date] = None
    notes: Optional[str] = None


class SessionSechageRead(BaseModel):
    id_session_sechage: int
    id_espace: Optional[int] = None
    nom_espace: Optional[str] = None
    nom: Optional[str] = None
    methode_sechage: Optional[str] = None
    temperature_cible: Optional[float] = None
    humidite_cible: Optional[float] = None
    statut: Optional[str] = None
    date_debut: Optional[date] = None
    date_fin: Optional[date] = None
    notes: Optional[str] = None
    created_at: Optional[datetime] = None
    nb_plants: int = 0
    plants: list[PlantSechageRead] = []

    model_config = ConfigDict(from_attributes=True)
