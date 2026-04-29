"""Schemas Pydantic pour Graine et PackGraine"""
from pydantic import BaseModel, ConfigDict
from typing import Optional
from datetime import date
from app.schemas.breeder import BreederRead
from app.schemas.variete import VarieteRead


class PackGraineBase(BaseModel):
    id_fournisseur: Optional[int] = None
    nbr_graines: int
    prix_achat: Optional[float] = None
    date_achat: Optional[date] = None


class PackGraineCreate(PackGraineBase):
    pass


class PackGraineRead(PackGraineBase):
    id_packgraine: int
    model_config = ConfigDict(from_attributes=True)


class PackGraineCompletCreate(BaseModel):
    """Création d'un pack complet avec toutes ses graines d'un coup"""
    id_fournisseur: Optional[int] = None
    nbr_graines: int
    prix_achat: Optional[float] = None
    date_achat: Optional[date] = None
    # Infos communes à toutes les graines du pack
    id_breeder: int
    id_variete: int
    croisement_variete: Optional[str] = None   # met à jour la Variété
    types_graines: Optional[str] = None
    duree_flo_min: Optional[int] = None
    duree_flo_max: Optional[int] = None
    edition_limite: bool = False


class PackGraineCompletUpdate(BaseModel):
    """Mise à jour d'un pack + ses graines (metadata + ajustement du stock)"""
    id_fournisseur: Optional[int] = None
    nbr_graines: Optional[int] = None   # si fourni, ajuste le nombre de graines
    prix_achat: Optional[float] = None
    date_achat: Optional[date] = None
    id_breeder: int
    id_variete: int
    croisement_variete: Optional[str] = None   # met à jour la Variété
    types_graines: Optional[str] = None
    duree_flo_min: Optional[int] = None
    duree_flo_max: Optional[int] = None
    edition_limite: bool = False


class PackGraineCompletRead(BaseModel):
    """Réponse après création/màj d'un pack complet"""
    id_packgraine: int
    nbr_graines: int
    nbr_graines_crees: int
    breeder_nom: str
    variete_nom: str
    model_config = ConfigDict(from_attributes=True)


class GraineBase(BaseModel):
    id_breeder: int
    id_variete: int
    id_packgraine: int
    duree_flo_min: Optional[int] = None
    duree_flo_max: Optional[int] = None
    types_graines: Optional[str] = None
    prix_achat: Optional[float] = None
    edition_limite: bool = False
    date_achat: Optional[date] = None
    utilisee: bool = False


class GraineCreate(GraineBase):
    pass


class GraineRead(GraineBase):
    id_graine: int
    breeder: Optional[BreederRead] = None
    variete: Optional[VarieteRead] = None
    model_config = ConfigDict(from_attributes=True)


class GraineSimple(BaseModel):
    """Graine simplifiée pour affichage dans détail pack"""
    id_graine: int
    utilisee: bool
    model_config = ConfigDict(from_attributes=True)


class CatalogueItem(BaseModel):
    """Item du catalogue avec tous les champs enrichis"""
    id_packgraine: int
    id_fournisseur: Optional[int] = None
    id_breeder: Optional[int] = None
    id_variete: Optional[int] = None
    breeder_nom: str
    variete_nom: str
    croisement_variete: Optional[str] = None
    lien_web: Optional[str] = None
    type_graines: Optional[str] = None
    duree_flo_min: Optional[int] = None
    duree_flo_max: Optional[int] = None
    prix_par_graine: Optional[float] = None
    nbr_graines_total: int
    nbr_graines_restantes: int
    paquet_ouvert: bool = False           # vrai si au moins une graine a été utilisée
    edition_limite: bool = False
    date_achat: Optional[date] = None

    model_config = ConfigDict(from_attributes=True)
