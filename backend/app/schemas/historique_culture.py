"""Schémas Pydantic pour HistoriqueCulture + HistoriquePlant"""
from datetime import date
from decimal import Decimal
from typing import Optional, List
from pydantic import BaseModel, ConfigDict


# ─────────────────────────────────────────
# Plant schemas
# ─────────────────────────────────────────

class HistoriquePlantBase(BaseModel):
    id_variete:        Optional[int]     = None
    variete_nom:       Optional[str]     = None
    numero_plant:      Optional[int]     = None
    date_debut_plant:  Optional[date]    = None
    date_fin_plant:    Optional[date]    = None
    prix_graine:       Optional[Decimal] = None
    quantite_recoltee: Optional[Decimal] = None
    notes:             Optional[str]     = None


class HistoriquePlantCreate(HistoriquePlantBase):
    pass


class HistoriquePlantRead(HistoriquePlantBase):
    model_config = ConfigDict(from_attributes=True)
    id_historique_plant:   int
    id_historique_culture: int


# ─────────────────────────────────────────
# Culture schemas
# ─────────────────────────────────────────

class HistoriqueCultureBase(BaseModel):
    nom:          Optional[str]  = None
    date_debut:   Optional[date] = None
    date_fin:     Optional[date] = None
    tente:        Optional[str]  = None
    lampe:        Optional[str]  = None
    puissance:    Optional[int]  = None
    type_culture: Optional[str]  = None
    engrais:      Optional[str]  = None
    substrat:     Optional[str]  = None
    notes:        Optional[str]  = None


class HistoriqueCultureCreate(HistoriqueCultureBase):
    plants: List[HistoriquePlantCreate] = []


class HistoriqueCultureUpdate(BaseModel):
    """Tous les champs sont optionnels pour un PATCH partiel."""
    nom:          Optional[str]  = None
    date_debut:   Optional[date] = None
    date_fin:     Optional[date] = None
    tente:        Optional[str]  = None
    lampe:        Optional[str]  = None
    puissance:    Optional[int]  = None
    type_culture: Optional[str]  = None
    engrais:      Optional[str]  = None
    substrat:     Optional[str]  = None
    notes:        Optional[str]  = None


class HistoriqueCultureRead(HistoriqueCultureBase):
    model_config = ConfigDict(from_attributes=True)

    id_historique_culture: int
    plants: List[HistoriquePlantRead] = []

    # Champs calculés (remplis dans le router)
    duree_jours:       Optional[int]   = None
    nb_plants:         int             = 0
    quantite_totale:   Optional[float] = None   # somme des récoltes
    prix_total_graines: Optional[float] = None  # somme des prix graines
    g_par_watt:        Optional[float] = None
    varietes_label:    str             = ""     # ex: "Gelato, OG Kush"

    # Coûts (stockés en DB à la clôture)
    cout_engrais:      Optional[float] = None
    cout_electricite:  Optional[float] = None
    cout_graines:      Optional[float] = None
    cout_total:        Optional[float] = None
    cout_par_gramme:   Optional[float] = None
