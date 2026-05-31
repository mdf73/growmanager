"""
Schémas Pydantic pour l'intégration ESPHome.
NOUVEAU FICHIER — backend/app/schemas/esphome.py
"""
from datetime import datetime
from typing import Optional
from pydantic import BaseModel


class ESPHomePushPayload(BaseModel):
    """Corps JSON envoyé par le capteur ESPHome via http_request."""
    device_id:   str
    temperature: Optional[float] = None
    humidite:    Optional[float] = None
    co2:         Optional[float] = None
    timestamp:   Optional[int]  = None   # Unix timestamp UTC (optionnel)


class ESPHomePushResult(BaseModel):
    status:  str
    id_log:  Optional[int]  = None
    vpd:     Optional[float] = None
    message: Optional[str]  = None


class ESPHomeDeviceCreate(BaseModel):
    """Enregistrement d'un nouveau capteur ESPHome."""
    nom:       str
    device_id: str
    ip_lan:    Optional[str] = None
    id_espace: Optional[int] = None
    notes:     Optional[str] = None
