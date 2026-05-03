"""Schemas Pydantic pour SessionCuring et PlantCuring"""
from pydantic import BaseModel, ConfigDict
from typing import Optional
from datetime import date, datetime


# ═══════════════════════════════════════════════════════════════════════════════
# PLANT CURING
# ═══════════════════════════════════════════════════════════════════════════════

class PlantCuringCreate(BaseModel):
    id_plant: int
    date_mise_curing: Optional[date] = None
    date_fin_curing: Optional[date] = None
    poids_debut_g: Optional[float] = None
    poids_final_g: Optional[float] = None
    notes: Optional[str] = None


class PlantCuringUpdate(BaseModel):
    date_mise_curing: Optional[date] = None
    date_fin_curing: Optional[date] = None
    poids_debut_g: Optional[float] = None
    poids_final_g: Optional[float] = None
    notes: Optional[str] = None


class PlantCuringRead(BaseModel):
    id_plant_curing: int
    id_plant: int
    id_session_curing: int
    date_mise_curing: Optional[date] = None
    date_fin_curing: Optional[date] = None
    poids_debut_g: Optional[float] = None
    poids_final_g: Optional[float] = None
    notes: Optional[str] = None
    # Enrichis
    nom_plant: Optional[str] = None
    nom_variete: Optional[str] = None
    id_culture: Optional[int] = None
    nom_culture: Optional[str] = None
    date_recolte: Optional[date] = None

    model_config = ConfigDict(from_attributes=True)


# ═══════════════════════════════════════════════════════════════════════════════
# SESSION CURING
# ═══════════════════════════════════════════════════════════════════════════════

class SessionCuringCreate(BaseModel):
    nom: Optional[str] = None
    type_contenant: Optional[str] = None          # Bocal | Grove Bag | Sac sous vide | Autre
    volume_contenant_l: Optional[float] = None
    boveda_rh: Optional[int] = None               # 58 | 62 ...
    id_espace: Optional[int] = None               # espace de culture si curing dans un espace
    id_materiel_bocal: Optional[int] = None       # bocal sélectionné depuis l'inventaire
    date_debut: Optional[date] = None
    notes: Optional[str] = None
    # Plantes à ajouter directement à la création
    plants: list[PlantCuringCreate] = []


class SessionCuringUpdate(BaseModel):
    nom: Optional[str] = None
    type_contenant: Optional[str] = None
    volume_contenant_l: Optional[float] = None
    boveda_rh: Optional[int] = None
    id_espace: Optional[int] = None
    id_materiel_bocal: Optional[int] = None
    statut: Optional[str] = None
    date_debut: Optional[date] = None
    date_fin: Optional[date] = None
    notes: Optional[str] = None


class SessionCuringRead(BaseModel):
    id_session_curing: int
    nom: Optional[str] = None
    type_contenant: Optional[str] = None
    volume_contenant_l: Optional[float] = None
    boveda_rh: Optional[int] = None
    id_espace: Optional[int] = None
    id_materiel_bocal: Optional[int] = None
    # Enrichis
    nom_espace: Optional[str] = None
    nom_materiel_bocal: Optional[str] = None
    statut: Optional[str] = None
    date_debut: Optional[date] = None
    date_fin: Optional[date] = None
    notes: Optional[str] = None
    created_at: Optional[datetime] = None
    nb_plants: int = 0
    plants: list[PlantCuringRead] = []

    model_config = ConfigDict(from_attributes=True)
