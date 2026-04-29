"""Schemas Pydantic pour GoveeDevice (capteurs) et TemperatureLog"""
from pydantic import BaseModel, ConfigDict
from typing import Optional, List
from datetime import datetime


# ── GoveeDevice ───────────────────────────────────────────────────────────────

class GoveeDeviceBase(BaseModel):
    nom:       str
    device_id: Optional[str] = None
    modele:    Optional[str] = None
    ip_lan:    Optional[str] = None
    id_espace: Optional[int] = None
    actif:     bool          = True
    notes:     Optional[str] = None


class GoveeDeviceCreate(GoveeDeviceBase):
    pass


class GoveeDeviceUpdate(BaseModel):
    nom:       Optional[str]  = None
    device_id: Optional[str]  = None
    modele:    Optional[str]  = None
    ip_lan:    Optional[str]  = None
    id_espace: Optional[int]  = None
    actif:     Optional[bool] = None
    notes:     Optional[str]  = None


class GoveeDeviceRead(GoveeDeviceBase):
    id_device:   int
    nom_espace:  Optional[str] = None
    # Dernière lecture connue
    derniere_temperature: Optional[float] = None
    derniere_humidite:    Optional[float] = None
    derniere_vpd:         Optional[float] = None
    derniere_lecture:     Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


# ── TemperatureLog ────────────────────────────────────────────────────────────

class TemperatureLogCreate(BaseModel):
    id_device:   Optional[int]      = None
    id_culture:  Optional[int]      = None
    id_espace:   Optional[int]      = None
    date_heure:  Optional[datetime] = None
    temperature: Optional[float]    = None
    humidite:    Optional[float]    = None
    source:      Optional[str]      = "manual"


class TemperatureLogRead(BaseModel):
    id_log:      Optional[int]      = None   # None pour les lignes agrégées
    id_device:   Optional[int]      = None
    id_culture:  Optional[int]      = None
    id_espace:   Optional[int]      = None
    date_heure:  datetime
    temperature: Optional[float]    = None
    humidite:    Optional[float]    = None
    vpd:         Optional[float]    = None
    source:      Optional[str]      = None
    nom_device:  Optional[str]      = None

    model_config = ConfigDict(from_attributes=True)


# ── GoveeConfig ───────────────────────────────────────────────────────────────

class GoveeConfigRead(BaseModel):
    api_key:          Optional[str]  = None
    polling_enabled:  bool           = False
    # Gmail auto-import
    gmail_user:       Optional[str]  = None
    gmail_app_password_set: bool     = False   # True si un mot de passe est enregistré
    gmail_enabled:    bool           = False
    gmail_last_check: Optional[str]  = None    # ISO datetime UTC
    gmail_last_status: Optional[str] = None    # Résumé de la dernière vérif


class GoveeConfigUpdate(BaseModel):
    api_key:           Optional[str]  = None
    polling_enabled:   Optional[bool] = None
    # Gmail
    gmail_user:        Optional[str]  = None
    gmail_app_password: Optional[str] = None   # None = ne pas modifier
    gmail_enabled:     Optional[bool] = None


# ── Résultat import Gmail ─────────────────────────────────────────────────────

class GmailImportResult(BaseModel):
    emails_processed: int
    imported_total:   int
    skipped_total:    int
    errors_total:     int
    message:          str
    ok:               bool


# ── Trigger manuel ────────────────────────────────────────────────────────────

class PollResult(BaseModel):
    device_id:    int
    nom:          str
    success:      bool
    temperature:  Optional[float] = None
    humidite:     Optional[float] = None
    vpd:          Optional[float] = None
    erreur:       Optional[str]   = None
