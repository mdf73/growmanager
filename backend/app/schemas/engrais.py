"""Schemas Pydantic pour ProduitEngrais (Sols & Engrais)"""
from pydantic import BaseModel, ConfigDict
from typing import Optional, List
from datetime import date, datetime
from decimal import Decimal


# ── AchatEngrais ─────────────────────────────────────────────────────────────

class AchatEngraisCreate(BaseModel):
    date_achat:      Optional[date]  = None
    volume_achat:    Optional[float] = None
    unite_volume:    Optional[str]   = None
    prix_achat:      Optional[float] = None
    date_peremption: Optional[date]  = None
    conditionnement: Optional[str]   = None
    notes:           Optional[str]   = None


class AchatEngraisRead(AchatEngraisCreate):
    id_achat:   int
    id_produit: int
    created_at: Optional[datetime] = None
    model_config = ConfigDict(from_attributes=True)


# ── ProduitEngrais ────────────────────────────────────────────────────────────

class ProduitEngraisBase(BaseModel):
    nom_produit:            str
    marque:                 Optional[str]     = None
    type_produit:           Optional[str]     = None
    conditionnement:        Optional[str]     = None
    volume_conditionnement: Optional[float]   = None
    unite_volume:           Optional[str]     = None
    prix_achat:             Optional[float]   = None
    date_achat:             Optional[date]    = None
    date_peremption:        Optional[date]    = None
    quantite_stock:         Optional[float]   = None
    unite_quantite:         Optional[str]     = None
    dosage_conseille:       Optional[str]     = None
    notes:                  Optional[str]     = None


class ProduitEngraisCreate(ProduitEngraisBase):
    pass


class ProduitEngraisUpdate(BaseModel):
    nom_produit:            Optional[str]     = None
    marque:                 Optional[str]     = None
    type_produit:           Optional[str]     = None
    conditionnement:        Optional[str]     = None
    volume_conditionnement: Optional[float]   = None
    unite_volume:           Optional[str]     = None
    prix_achat:             Optional[float]   = None
    date_achat:             Optional[date]    = None
    date_peremption:        Optional[date]    = None
    quantite_stock:         Optional[float]   = None
    unite_quantite:         Optional[str]     = None
    dosage_conseille:       Optional[str]     = None
    notes:                  Optional[str]     = None


class ProduitEngraisRead(ProduitEngraisBase):
    id_produit: int
    model_config = ConfigDict(from_attributes=True)


class RechargePayload(BaseModel):
    """Payload pour recharger le stock d'un produit (achat d'un nouveau contenant)."""
    date_achat:      Optional[date]  = None
    volume_achat:    Optional[float] = None   # volume du nouveau contenant
    unite_volume:    Optional[str]   = None
    prix_achat:      Optional[float] = None
    date_peremption: Optional[date]  = None
    conditionnement: Optional[str]   = None
    notes:           Optional[str]   = None
