from __future__ import annotations
from typing import Optional, List, Any
from datetime import date, datetime
from pydantic import BaseModel


# ── PlantePere ────────────────────────────────────────────────────────────────

class PlantePereBase(BaseModel):
    id_variete: Optional[int] = None
    nom_libre:  Optional[str] = None
    notes:      Optional[str] = None

class PlantePereCreate(PlantePereBase):
    pass

class PlantePereUpdate(PlantePereBase):
    pass

class PlantePereRead(PlantePereBase):
    id_pere:     int
    id_projet:   int
    variete_nom: Optional[str] = None
    created_at:  Optional[datetime] = None

    class Config:
        from_attributes = True


# ── PlanteMere ────────────────────────────────────────────────────────────────

class PlanteMereBase(BaseModel):
    id_variete:             Optional[int]   = None
    nom_phenotype:          Optional[str]   = None
    id_plant:               Optional[int]   = None
    date_pollinisation:     Optional[date]  = None
    methode_pollinisation:  Optional[str]   = None   # naturelle | manuelle | pinceau
    pere_identifie:         Optional[bool]  = False
    id_pollen:              Optional[int]   = None
    nom_pere_libre:         Optional[str]   = None
    id_peres:               Optional[List[int]] = None   # IDs PlantePereOpenField probables
    notes_pollinisation:    Optional[str]   = None
    notes:                  Optional[str]   = None

class PlanteMereCreate(PlanteMereBase):
    pass

class PlanteMereUpdate(PlanteMereBase):
    pass

class RecolteInput(BaseModel):
    date_recolte:            Optional[date]  = None
    nb_graines:              Optional[int]   = None
    poids_graines_g:         Optional[float] = None
    qualite_graines:         Optional[str]   = None   # bonne | moyenne | immature
    # Pour créer automatiquement un PackGraine + nouvelle Variete
    creer_pack:              bool            = True
    nom_variete_croisement:  Optional[str]   = None   # nom de la nouvelle variété créée

class PlanteMereRead(PlanteMereBase):
    id_mere:         int
    id_projet:       int
    date_recolte:    Optional[date]  = None
    nb_graines:      Optional[int]   = None
    poids_graines_g: Optional[float] = None
    qualite_graines: Optional[str]   = None
    id_packgraine:   Optional[int]   = None
    created_at:      Optional[datetime] = None
    # Enrichissements
    variete_nom:     Optional[str]   = None
    pollen_nom:      Optional[str]   = None
    plant_label:     Optional[str]   = None
    peres_labels:    Optional[List[str]] = None  # noms des pères probables

    class Config:
        from_attributes = True


# ── ProjetOpenField ───────────────────────────────────────────────────────────

class ProjetOpenFieldBase(BaseModel):
    nom:          str
    saison:       Optional[str]  = None
    lieu:         Optional[str]  = None
    conditions:   Optional[str]  = None   # outdoor | greenhouse | guerrilla
    id_culture:   Optional[int]  = None
    statut:       Optional[str]  = "planifie"
    description:  Optional[str]  = None
    notes:        Optional[str]  = None

class ProjetOpenFieldCreate(ProjetOpenFieldBase):
    pass

class ProjetOpenFieldUpdate(BaseModel):
    nom:          Optional[str]  = None
    saison:       Optional[str]  = None
    lieu:         Optional[str]  = None
    conditions:   Optional[str]  = None
    id_culture:   Optional[int]  = None
    statut:       Optional[str]  = None
    description:  Optional[str]  = None
    notes:        Optional[str]  = None

class ProjetOpenFieldRead(ProjetOpenFieldBase):
    id_projet:    int
    created_at:   Optional[datetime] = None
    meres:        List[PlanteMereRead] = []
    peres:        List[PlantePereRead] = []
    # Enrichissements
    culture_nom:  Optional[str]  = None
    nb_meres:     int            = 0
    nb_peres:     int            = 0
    nb_graines_total: int        = 0

    class Config:
        from_attributes = True
