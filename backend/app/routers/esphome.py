"""
Router ESPHome — intégration capteurs ESPHome dans GrowManager.

Architecture :
  - ESPHome pousse ses données via POST /api/capteurs/esphome/push
  - Les capteurs ESPHome sont stockés dans GoveeDevice avec modele="esphome"
  - Les relevés sont dans TemperatureLog avec source="esphome"
    => graphiques et filtres existants déjà compatibles sans toucher au frontend
"""
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.all_models import GoveeDevice, TemperatureLog, EspaceCulture
from app.schemas.esphome import (
    ESPHomePushPayload, ESPHomePushResult,
    ESPHomeDeviceCreate, ESPHomeDeviceUpdate,
)
from app.services.govee_poller import compute_vpd, _get_active_culture_id

router = APIRouter(tags=["esphome"])

ESPHOME_MODELE = "esphome"


# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────

def _get_esphome_device(device_id: str, db: Session) -> Optional[GoveeDevice]:
    return (
        db.query(GoveeDevice)
        .filter(
            GoveeDevice.device_id == device_id,
            GoveeDevice.modele    == ESPHOME_MODELE,
        )
        .first()
    )


def _enrich_esphome_device(d: GoveeDevice, db: Session) -> dict:
    """Enrichit un GoveeDevice ESPHome avec le nom d'espace et la dernière lecture."""
    nom_espace = None
    if d.id_espace:
        esp = db.query(EspaceCulture).filter(EspaceCulture.id_espace == d.id_espace).first()
        nom_espace = esp.nom if esp else None

    last_log = (
        db.query(TemperatureLog)
        .filter(TemperatureLog.id_device == d.id_device)
        .order_by(TemperatureLog.date_heure.desc())
        .first()
    )

    derniere_lecture = None
    if last_log and last_log.date_heure:
        dl = last_log.date_heure
        if dl.tzinfo is None:
            dl = dl.replace(tzinfo=timezone.utc)
        derniere_lecture = dl.isoformat()

    return {
        "id_device":          d.id_device,
        "nom":                d.nom,
        "device_id":          d.device_id,
        "modele":             d.modele,
        "ip_lan":             d.ip_lan,
        "id_espace":          d.id_espace,
        "nom_espace":         nom_espace,
        "actif":              d.actif,
        "notes":              d.notes,
        "derniere_temperature": last_log.temperature if last_log else None,
        "derniere_humidite":    last_log.humidite    if last_log else None,
        "derniere_vpd":         last_log.vpd         if last_log else None,
        "derniere_lecture":     derniere_lecture,
    }


# ─────────────────────────────────────────────────────────────────────────────
# Endpoint principal : réception des données ESPHome
# ─────────────────────────────────────────────────────────────────────────────

@router.post("/api/capteurs/esphome/push", response_model=ESPHomePushResult)
def esphome_push(payload: ESPHomePushPayload, db: Session = Depends(get_db)):
    """
    Reçoit un relevé depuis un capteur ESPHome via HTTP POST.
    Le capteur doit être enregistré au préalable via POST /api/capteurs/esphome/devices.
    """
    device = _get_esphome_device(payload.device_id, db)
    if not device:
        raise HTTPException(
            status_code=404,
            detail=(
                f"Capteur ESPHome '{payload.device_id}' non enregistré. "
                f"Créez-le d'abord depuis Paramétrage > Capteurs ESPHome."
            ),
        )

    if not device.actif:
        return ESPHomePushResult(status="ignored", message="Capteur inactif — donnée ignorée")

    # Calcul VPD si temp + humidité disponibles
    vpd = None
    if payload.temperature is not None and payload.humidite is not None:
        vpd = compute_vpd(payload.temperature, payload.humidite)

    # Culture active liée à l'espace du capteur
    id_culture = None
    if device.id_espace:
        id_culture = _get_active_culture_id(db, device.id_espace)

    # Horodatage : timestamp ESPHome si fourni, sinon maintenant
    if payload.timestamp:
        date_heure = datetime.fromtimestamp(payload.timestamp, tz=timezone.utc)
    else:
        date_heure = datetime.now(timezone.utc)

    log = TemperatureLog(
        id_device=   device.id_device,
        id_culture=  id_culture,
        id_espace=   device.id_espace,
        date_heure=  date_heure,
        temperature= payload.temperature,
        humidite=    payload.humidite,
        vpd=         vpd,
        source=      "esphome",
    )
    db.add(log)
    db.commit()
    db.refresh(log)

    return ESPHomePushResult(status="ok", id_log=log.id_log, vpd=vpd)


# ─────────────────────────────────────────────────────────────────────────────
# CRUD capteurs ESPHome
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/api/capteurs/esphome/devices")
def list_esphome_devices(db: Session = Depends(get_db)):
    """Liste tous les capteurs ESPHome enregistrés."""
    devices = (
        db.query(GoveeDevice)
        .filter(GoveeDevice.modele == ESPHOME_MODELE)
        .order_by(GoveeDevice.nom)
        .all()
    )
    return [_enrich_esphome_device(d, db) for d in devices]


@router.post("/api/capteurs/esphome/devices", status_code=201)
def create_esphome_device(payload: ESPHomeDeviceCreate, db: Session = Depends(get_db)):
    """
    Enregistre un nouveau capteur ESPHome.
    Le device_id doit correspondre exactement à celui configuré dans le YAML ESPHome.
    """
    existing = _get_esphome_device(payload.device_id, db)
    if existing:
        raise HTTPException(
            status_code=409,
            detail=f"Un capteur ESPHome avec device_id='{payload.device_id}' existe déjà.",
        )

    device = GoveeDevice(
        nom=       payload.nom,
        device_id= payload.device_id,
        modele=    ESPHOME_MODELE,
        ip_lan=    payload.ip_lan,
        id_espace= payload.id_espace,
        actif=     True,
        notes=     payload.notes,
    )
    db.add(device)
    db.commit()
    db.refresh(device)
    return _enrich_esphome_device(device, db)


@router.put("/api/capteurs/esphome/devices/{device_id}", status_code=200)
def update_esphome_device(
    device_id: int,
    payload: ESPHomeDeviceUpdate,
    db: Session = Depends(get_db),
):
    """Mise à jour d'un capteur ESPHome (nom, espace, actif, notes)."""
    device = db.query(GoveeDevice).filter(
        GoveeDevice.id_device == device_id,
        GoveeDevice.modele    == ESPHOME_MODELE,
    ).first()
    if not device:
        raise HTTPException(status_code=404, detail="Capteur ESPHome introuvable")

    for field, val in payload.model_dump(exclude_none=True).items():
        setattr(device, field, val)
    db.commit()
    db.refresh(device)
    return _enrich_esphome_device(device, db)


@router.delete("/api/capteurs/esphome/devices/{device_id}", status_code=204)
def delete_esphome_device(device_id: int, db: Session = Depends(get_db)):
    """Supprime un capteur ESPHome (les logs associés sont conservés)."""
    device = db.query(GoveeDevice).filter(
        GoveeDevice.id_device == device_id,
        GoveeDevice.modele    == ESPHOME_MODELE,
    ).first()
    if not device:
        raise HTTPException(status_code=404, detail="Capteur ESPHome introuvable")
    db.delete(device)
    db.commit()
