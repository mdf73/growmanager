"""
Service de polling Govee — API V2 (openapi.api.govee.com) prioritaire,
fallback UDP LAN pour les appareils compatibles.

Endpoints V2 utilisés :
  - GET  https://openapi.api.govee.com/router/api/v1/user/devices   → liste des appareils
  - POST https://openapi.api.govee.com/router/api/v1/device/state   → état d'un appareil
"""
from __future__ import annotations

import json
import math
import socket
import uuid
import logging
from datetime import datetime
from typing import Optional, List

import httpx
from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.models.all_models import GoveeDevice, TemperatureLog, Culture

logger = logging.getLogger("govee_poller")

# ── Endpoints Govee V2 ────────────────────────────────────────────────────────
GOVEE_V2_BASE    = "https://openapi.api.govee.com/router/api/v1"
GOVEE_V2_DEVICES = f"{GOVEE_V2_BASE}/user/devices"
GOVEE_V2_STATE   = f"{GOVEE_V2_BASE}/device/state"

# ── UDP LAN ───────────────────────────────────────────────────────────────────
GOVEE_CMD_PORT  = 4003
GOVEE_RESP_PORT = 4002
GOVEE_TIMEOUT   = 3.0


# ── VPD ───────────────────────────────────────────────────────────────────────

def compute_vpd(temp_c: float, humidity_pct: float) -> float:
    """
    Déficit de Pression de Vapeur (kPa).
    Formule Tetens : es = 0.6108 * exp(17.27 * T / (T + 237.3))
    VPD = es * (1 - RH/100)
    """
    es  = 0.6108 * math.exp(17.27 * temp_c / (temp_c + 237.3))
    vpd = es * (1.0 - humidity_pct / 100.0)
    return round(vpd, 4)


# ── API V2 — Liste des appareils ──────────────────────────────────────────────

def cloud_v2_list_devices(api_key: str) -> List[dict]:
    """
    Retourne la liste des appareils Govee du compte via API V2.
    Format retourné : [{"sku": "H5179", "device": "37:79:...", "deviceName": "...", ...}, ...]
    """
    try:
        resp = httpx.get(
            GOVEE_V2_DEVICES,
            headers={"Govee-API-Key": api_key},
            timeout=10,
        )
        resp.raise_for_status()
        body = resp.json()
        if body.get("code") == 200:
            return body.get("data", [])
    except Exception as e:
        logger.warning(f"V2 list devices error: {e}")
    return []


# ── API V2 — État d'un appareil ───────────────────────────────────────────────

def _cloud_v2_get_device_status(api_key: str, device_id: str, sku: str) -> Optional[dict]:
    """
    Récupère température et humidité via API Govee V2.
    Retourne {"temperature": float, "humidity": float} ou None.
    """
    payload = {
        "requestId": str(uuid.uuid4()),
        "payload": {
            "sku":    sku,
            "device": device_id,
        },
    }
    try:
        resp = httpx.post(
            GOVEE_V2_STATE,
            json=payload,
            headers={
                "Govee-API-Key":  api_key,
                "Content-Type":   "application/json",
            },
            timeout=10,
        )
        resp.raise_for_status()
        body = resp.json()

        if body.get("code") != 200:
            logger.warning(f"V2 state {device_id}: code={body.get('code')} msg={body.get('message')}")
            return None

        capabilities = body.get("payload", {}).get("capabilities", [])
        temp = None
        hum  = None
        temp_unit = None  # 1 = Fahrenheit, 2 = Celsius

        for cap in capabilities:
            instance = cap.get("instance", "")
            value    = cap.get("state", {}).get("value")

            if instance == "sensorTemperature" and value is not None:
                v = float(value)
                # Certains modèles renvoient la valeur × 100 (ex: 2150 → 21.5°C)
                temp = round(v / 100.0, 1) if v > 100 else round(v, 1)

            elif instance == "sensorHumidity" and value is not None:
                v = float(value)
                hum = round(v / 100.0, 1) if v > 100 else round(v, 1)

            elif instance in ("temperatureUnit", "tempUnit") and value is not None:
                try:
                    temp_unit = int(value)
                except (ValueError, TypeError):
                    pass

        if temp is not None and hum is not None:
            # Conversion Fahrenheit → Celsius si unité = 1 (°F)
            # ou heuristique : temp > 45 est irréaliste en °C pour une box, probablement en °F
            if temp_unit == 1 or (temp_unit is None and temp > 45.0):
                temp = round((temp - 32.0) * 5.0 / 9.0, 1)
                logger.debug(f"Conversion F→C appliquée → {temp}°C")
            return {"temperature": temp, "humidity": hum}

        logger.warning(f"V2 state {device_id}: données incomplètes T={temp} H={hum}")
    except Exception as e:
        logger.warning(f"V2 state {device_id} ({sku}) error: {e}")
    return None


# ── UDP LAN ───────────────────────────────────────────────────────────────────

def _udp_get_device_status(ip: str) -> Optional[dict]:
    """
    Interroge un appareil Govee via l'API LAN (UDP).
    Retourne {"temperature": float, "humidity": float} ou None.
    """
    cmd = json.dumps({"msg": {"cmd": "devStatus", "data": {}}}).encode()
    sock = None
    try:
        sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        sock.settimeout(GOVEE_TIMEOUT)
        sock.setsockopt(socket.SOL_SOCKET, socket.SO_BROADCAST, 1)
        sock.bind(("", GOVEE_RESP_PORT))
        sock.sendto(cmd, (ip, GOVEE_CMD_PORT))
        data, _ = sock.recvfrom(4096)
        inner = json.loads(data.decode()).get("msg", {}).get("data", {})
        t = inner.get("temperature")
        h = inner.get("humidity")
        if t is not None and h is not None:
            return {
                "temperature": round(float(t) / 100.0, 1),
                "humidity":    round(float(h) / 100.0, 1),
            }
    except Exception as e:
        logger.debug(f"UDP LAN {ip} error: {e}")
    finally:
        if sock:
            try: sock.close()
            except: pass
    return None


# ── Config helper ─────────────────────────────────────────────────────────────

def _get_cloud_api_key(db: Session) -> Optional[str]:
    from app.models.all_models import ParametreListeValeur
    row = db.query(ParametreListeValeur).filter(
        ParametreListeValeur.liste_nom == "govee_config",
        ParametreListeValeur.valeur.like("api_key:%"),
    ).first()
    return row.valeur.split(":", 1)[1].strip() if row else None


def _get_active_culture_id(db: Session, id_espace: int) -> Optional[int]:
    culture = db.query(Culture).filter(
        Culture.id_espace == id_espace,
        Culture.statut    == "active",
    ).first()
    return culture.id_culture if culture else None


# ── Polling principal ─────────────────────────────────────────────────────────

def poll_all_devices():
    """
    Interroge tous les GoveeDevice actifs et insère un TemperatureLog.
    Ordre de priorité : LAN UDP → Cloud V2.
    """
    db: Session = SessionLocal()
    try:
        devices = db.query(GoveeDevice).filter(
            GoveeDevice.actif  == True,
            GoveeDevice.modele != "esphome",
        ).all()
        if not devices:
            return
        api_key = _get_cloud_api_key(db)

        for device in devices:
            reading: Optional[dict] = None

            # 1. LAN UDP (si IP configurée)
            if device.ip_lan:
                reading = _udp_get_device_status(device.ip_lan)

            # 2. Cloud V2
            if reading is None and api_key and device.device_id:
                sku = device.modele or "H5179"
                reading = _cloud_v2_get_device_status(api_key, device.device_id, sku)

            if reading is None:
                logger.warning(f"Device '{device.nom}': aucune donnée.")
                continue

            temp = reading["temperature"]
            hum  = reading["humidity"]
            vpd  = compute_vpd(temp, hum)

            id_culture = None
            if device.id_espace:
                id_culture = _get_active_culture_id(db, device.id_espace)

            db.add(TemperatureLog(
                id_device=   device.id_device,
                id_culture=  id_culture,
                id_espace=   device.id_espace,
                date_heure=  datetime.utcnow(),
                temperature= temp,
                humidite=    hum,
                vpd=         vpd,
                source=      "govee",
            ))
            logger.info(f"'{device.nom}': T={temp}°C H={hum}% VPD={vpd}kPa")

        db.commit()
    except Exception as e:
        logger.error(f"poll_all_devices error: {e}")
        db.rollback()
    finally:
        db.close()


# ── APScheduler ───────────────────────────────────────────────────────────────

def start_poller(app):
    try:
        from apscheduler.schedulers.background import BackgroundScheduler
        from apscheduler.triggers.cron import CronTrigger

        scheduler = BackgroundScheduler(
            timezone="Europe/Paris",
            job_defaults={
                # Tolère jusqu'à 1h de retard (veille ordi / redémarrage)
                "misfire_grace_time": 3600,
                # Ne lance qu'une fois même si plusieurs intervalles ratés
                "coalesce": True,
            },
        )

        # ── Job 1 : polling API Govee toutes les 5 min ────────────────────────
        scheduler.add_job(
            poll_all_devices,
            trigger="interval",
            minutes=5,
            id="govee_poll",
            replace_existing=True,
        )

        # ── Job 2 : import automatique Gmail quotidien à 00h30 ────────────────
        # 30 min après l'export Govee de 23h59 pour laisser le temps à l'email d'arriver.
        def _gmail_job():
            from app.services.gmail_importer import check_gmail_and_import
            result = check_gmail_and_import()
            logger.info(f"[Gmail auto-import] {result.get('message', '—')}")

        scheduler.add_job(
            _gmail_job,
            trigger=CronTrigger(hour=0, minute=30),
            id="gmail_import",
            replace_existing=True,
        )

        scheduler.start()

        @app.on_event("shutdown")
        def _shutdown():
            scheduler.shutdown(wait=False)

        logger.info("Govee poller démarré (5 min) + Gmail import quotidien (00h30).")
    except ImportError:
        logger.warning("APScheduler absent — polling automatique désactivé.")
