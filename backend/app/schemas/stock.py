"""Schemas Pydantic pour Stock"""
from pydantic import BaseModel, ConfigDict
from typing import Optional
from datetime import date


class StockBase(BaseModel):
    """Schéma de base pour Stock"""
    id_variete:        Optional[int]   = None
    id_bocal:          Optional[int]   = None
    id_materiel_bocal: Optional[int]   = None
    id_plant:          Optional[int]   = None   # V4-F traçabilité
    type_stock:        Optional[str]   = None
    sous_type_stock:   Optional[str]   = None
    lampe_type:        Optional[str]   = None
    engrais_type:      Optional[str]   = None
    maillage:          Optional[str]   = None
    type_hash:         Optional[str]   = None
    type_rosin:        Optional[str]   = None
    date_stock:        Optional[date]  = None
    date_fin_stock:    Optional[date]  = None
    quantite_stock:    float


class StockCreate(StockBase):
    pass


class StockRead(StockBase):
    id_stock: int
    model_config = ConfigDict(from_attributes=True)


class StockWithVariete(StockRead):
    """Stock enrichi avec variété + bocal Materiel + plante"""
    variete_nom:       Optional[str]   = None
    bocal_taille:      Optional[int]   = None   # ancien système
    bocal_nom:         Optional[str]   = None   # nom du bocal Materiel
    bocal_volume_ml:   Optional[float] = None   # volume du bocal Materiel
    plant_nom:         Optional[str]   = None   # nom_affichage de la plante liée (V4-F)
    plant_culture_nom: Optional[str]   = None   # nom de la culture de la plante (V4-F)
    model_config = ConfigDict(from_attributes=True)


class BocalDisponible(BaseModel):
    """Bocal Materiel disponible pour affectation au stock"""
    id_materiel: int
    nom:         str
    volume_ml:   Optional[float] = None
    label:       str             # ex: "Bocal 1L Mason #3"
    model_config = ConfigDict(from_attributes=True)
