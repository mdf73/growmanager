"""Schemas Pydantic pour PlanCulture et PlanCultureVariete"""
from pydantic import BaseModel, ConfigDict
from typing import Optional
from datetime import datetime


# ─── Variété dans un plan ─────────────────────────────────────────────────────

class PlanVarieteCreate(BaseModel):
    id_packgraine: int
    nb_plantes: int = 1
    taille_pot_l: Optional[float] = None
    ordre: int = 0


class PlanVarieteUpdate(BaseModel):
    nb_plantes: Optional[int] = None
    taille_pot_l: Optional[float] = None
    ordre: Optional[int] = None


class PlanVarieteRead(BaseModel):
    id_plan_variete: int
    id_packgraine: int
    nb_plantes: int
    taille_pot_l: Optional[float] = None
    ordre: int = 0
    # Champs enrichis depuis Graine / PackGraine
    nom_variete: Optional[str] = None
    nom_breeder: Optional[str] = None
    type_graine: Optional[str] = None        # reguliere | auto | fem
    duree_flo_min: Optional[int] = None
    duree_flo_max: Optional[int] = None
    stock_disponible: int = 0                # nb graines restantes dans le pack
    paquet_ouvert: bool = False              # au moins une graine utilisée
    prix_achat_pack: Optional[float] = None
    date_achat_pack: Optional[str] = None
    duree_conservation_mois: Optional[int] = None

    model_config = ConfigDict(from_attributes=True)


# ─── Plan de culture ──────────────────────────────────────────────────────────

class PlanCultureCreate(BaseModel):
    nom: str
    id_espace: Optional[int] = None
    notes: Optional[str] = None


class PlanCultureUpdate(BaseModel):
    nom: Optional[str] = None
    id_espace: Optional[int] = None
    statut: Optional[str] = None
    notes: Optional[str] = None


class PlanCultureRead(BaseModel):
    id_plan: int
    nom: str
    id_espace: Optional[int] = None
    nom_espace: Optional[str] = None
    surface_m2: Optional[float] = None
    statut: str = "brouillon"
    notes: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    varietes: list[PlanVarieteRead] = []
    nb_plantes_total: int = 0   # somme nb_plantes de toutes les lignes

    model_config = ConfigDict(from_attributes=True)


# ─── Calcul pots ──────────────────────────────────────────────────────────────

class NbPotsResult(BaseModel):
    surface_m2: float
    taille_pot_l: float
    nb_pots_recommande: int
