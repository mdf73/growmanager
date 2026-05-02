"""Schémas Pydantic pour Vaporisateur et VapoConsommable"""
from datetime import date, datetime
from typing import Optional, List
from pydantic import BaseModel


# ── Consommables ────────────────────────────────────────────────────────────

class VapoConsommableBase(BaseModel):
    id_vaporisateur:  Optional[int]   = None
    type_consommable: str
    diametre_mm:      Optional[float] = None
    matiere:          Optional[str]   = None
    date_achat:       Optional[date]  = None
    prix_achat:       Optional[float] = None
    notes:            Optional[str]   = None


class VapoConsommableCreate(VapoConsommableBase):
    pass


class VapoConsommableRead(VapoConsommableBase):
    id_consommable: int
    created_at:     Optional[datetime] = None

    class Config:
        from_attributes = True


# ── Vaporisateurs ────────────────────────────────────────────────────────────

class VaporisateurBase(BaseModel):
    nom:               str
    modele:            Optional[str]   = None
    marque:            Optional[str]   = None
    site_achat:        Optional[str]   = None
    date_achat:        Optional[date]  = None
    prix_achat:        Optional[float] = None
    numero_serie:      Optional[str]   = None
    type_chauffe:      Optional[str]   = None   # conduction | convection | mixte | induction
    a_eau:             Optional[bool]  = False
    temp_min:          Optional[int]   = None
    temp_max:          Optional[int]   = None
    compatibilites:    Optional[str]   = None   # CSV : fleurs_sechees,resines,concentres
    type_batterie:     Optional[str]   = None   # integree | amovible_18650
    autonomie_sessions: Optional[int]  = None
    autonomie_mah:     Optional[int]   = None
    temps_chauffe_s:   Optional[int]   = None
    type_charge:       Optional[str]   = None   # usb_c | proprietaire | autre
    nbr_sessions:      Optional[int]   = 0
    notes:             Optional[str]   = None


class VaporisateurCreate(VaporisateurBase):
    pass


class VaporisateurRead(VaporisateurBase):
    id_vaporisateur: int
    created_at:      Optional[datetime]          = None
    consommables:    List[VapoConsommableRead]   = []

    class Config:
        from_attributes = True
