"""Schemas Pydantic pour Pollen et Croisement"""
from pydantic import BaseModel, ConfigDict
from typing import Optional
from datetime import date, datetime


# ─── Pollen ──────────────────────────────────────────────────────────────────

class PollenCreate(BaseModel):
    nom_pollen: str
    id_variete_source: Optional[int] = None
    pheno_source: Optional[str] = None
    reverse: bool = False
    date_collecte: Optional[date] = None
    quantite_initiale_g: Optional[float] = None
    quantite_restante_g: Optional[float] = None
    stockage: Optional[str] = None            # frigo | congelateur | ambiant
    date_peremption: Optional[date] = None    # si absent, calculé auto
    notes: Optional[str] = None


class PollenUpdate(BaseModel):
    nom_pollen: Optional[str] = None
    id_variete_source: Optional[int] = None
    pheno_source: Optional[str] = None
    reverse: Optional[bool] = None
    date_collecte: Optional[date] = None
    quantite_initiale_g: Optional[float] = None
    quantite_restante_g: Optional[float] = None
    stockage: Optional[str] = None
    date_peremption: Optional[date] = None
    actif: Optional[bool] = None
    notes: Optional[str] = None


class PollenRead(BaseModel):
    id_pollen: int
    nom_pollen: str
    id_variete_source: Optional[int] = None
    nom_variete_source: Optional[str] = None
    pheno_source: Optional[str] = None
    reverse: bool = False
    date_collecte: Optional[date] = None
    quantite_initiale_g: Optional[float] = None
    quantite_restante_g: Optional[float] = None
    stockage: Optional[str] = None
    date_peremption: Optional[date] = None
    actif: bool = True
    notes: Optional[str] = None
    created_at: Optional[datetime] = None
    # Flags calculés
    perime: bool = False
    epuise: bool = False

    model_config = ConfigDict(from_attributes=True)


# ─── Croisement ──────────────────────────────────────────────────────────────

class CroisementCreate(BaseModel):
    nom_croisement: str
    type_croisement: Optional[str] = None              # F1 | F2 | BX | S1 | IBL | polyhybrid

    # Mère
    id_variete_mere: Optional[int] = None
    pheno_mere: Optional[str] = None
    notes_mere: Optional[str] = None

    # Père (pollen OU variété directe)
    id_pollen: Optional[int] = None
    id_variete_pere: Optional[int] = None
    pheno_pere: Optional[str] = None
    pere_reverse: bool = False
    notes_pere: Optional[str] = None

    # Pollinisation
    date_pollinisation: Optional[date] = None
    methode: Optional[str] = None
    zone_pollinisee: Optional[str] = None
    quantite_pollen_utilisee_g: Optional[float] = None

    statut: str = "planifie"
    notes: Optional[str] = None


class CroisementUpdate(BaseModel):
    nom_croisement: Optional[str] = None
    type_croisement: Optional[str] = None
    id_variete_mere: Optional[int] = None
    pheno_mere: Optional[str] = None
    notes_mere: Optional[str] = None
    id_pollen: Optional[int] = None
    id_variete_pere: Optional[int] = None
    pheno_pere: Optional[str] = None
    pere_reverse: Optional[bool] = None
    notes_pere: Optional[str] = None
    date_pollinisation: Optional[date] = None
    methode: Optional[str] = None
    zone_pollinisee: Optional[str] = None
    quantite_pollen_utilisee_g: Optional[float] = None
    statut: Optional[str] = None
    notes: Optional[str] = None


class RecolteGrainesInput(BaseModel):
    """Payload de finalisation d'un croisement → passage au statut 'recolte'."""
    date_recolte_graines: date
    nb_graines: int
    qualite_graines: Optional[str] = None             # bonne | moyenne | immature
    poids_graines_g: Optional[float] = None
    # Toggles sorties auto
    creer_variete: bool = True
    creer_packgraine: bool = True


class CroisementRead(BaseModel):
    id_croisement: int
    nom_croisement: str
    type_croisement: Optional[str] = None

    # Mère
    id_variete_mere: Optional[int] = None
    nom_variete_mere: Optional[str] = None
    pheno_mere: Optional[str] = None
    notes_mere: Optional[str] = None

    # Père
    id_pollen: Optional[int] = None
    nom_pollen: Optional[str] = None
    id_variete_pere: Optional[int] = None
    nom_variete_pere: Optional[str] = None
    pheno_pere: Optional[str] = None
    pere_reverse: bool = False
    notes_pere: Optional[str] = None

    # Pollinisation
    date_pollinisation: Optional[date] = None
    methode: Optional[str] = None
    zone_pollinisee: Optional[str] = None
    quantite_pollen_utilisee_g: Optional[float] = None

    # Résultat
    date_recolte_graines: Optional[date] = None
    nb_graines: Optional[int] = None
    qualite_graines: Optional[str] = None
    poids_graines_g: Optional[float] = None

    # Sorties
    id_variete_resultat: Optional[int] = None
    id_packgraine_resultat: Optional[int] = None

    statut: str = "planifie"
    notes: Optional[str] = None
    created_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)
