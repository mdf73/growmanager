"""
Routers pour :
  - GoveeDevice   → /api/capteurs
  - TemperatureLog → /api/temperature-logs
  - GoveeConfig   → /api/govee/config
  - Polling manuel → /api/govee/poll
"""
from datetime import datetime, timedelta, timezone
from typing import List, Optional

import csv
import io

from fastapi import APIRouter, Depends, HTTPException, Query, File, UploadFile, Form
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.database import get_db
from app.models.all_models import GoveeDevice, TemperatureLog, EspaceCulture, Culture, ParametreListeValeur
from app.schemas.capteur import (
    GoveeDeviceCreate, GoveeDeviceUpdate, GoveeDeviceRead,
    TemperatureLogCreate, TemperatureLogRead,
    GoveeConfigRead, GoveeConfigUpdate, PollResult, GmailImportResult,
)
from app.services.govee_poller import (
    compute_vpd, cloud_v2_list_devices,
    _udp_get_device_status, _cloud_v2_get_device_status,
    _get_cloud_api_key, _get_active_culture_id,
)

router = APIRouter(tags=["capteurs"])


# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────

def _enrich_device(d: GoveeDevice, db: Session) -> GoveeDeviceRead:
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
        # Marquer comme UTC si naïf (stocké via datetime.now(timezone.utc))
        if dl.tzinfo is None:
            dl = dl.replace(tzinfo=timezone.utc)
        derniere_lecture = dl

    return GoveeDeviceRead(
        id_device=   d.id_device,
        nom=         d.nom,
        device_id=   d.device_id,
        modele=      d.modele,
        ip_lan=      d.ip_lan,
        id_espace=   d.id_espace,
        actif=       d.actif,
        notes=       d.notes,
        nom_espace=  nom_espace,
        derniere_temperature= last_log.temperature  if last_log else None,
        derniere_humidite=    last_log.humidite     if last_log else None,
        derniere_vpd=         last_log.vpd          if last_log else None,
        derniere_lecture=     derniere_lecture,
    )


# ─────────────────────────────────────────────────────────────────────────────
# GoveeDevice CRUD
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/api/capteurs", response_model=List[GoveeDeviceRead])
def get_capteurs(db: Session = Depends(get_db)):
    """Liste tous les capteurs Govee."""
    devices = db.query(GoveeDevice).order_by(GoveeDevice.nom).all()
    return [_enrich_device(d, db) for d in devices]


@router.get("/api/capteurs/{device_id}", response_model=GoveeDeviceRead)
def get_capteur(device_id: int, db: Session = Depends(get_db)):
    d = db.query(GoveeDevice).filter(GoveeDevice.id_device == device_id).first()
    if not d:
        raise HTTPException(status_code=404, detail="Capteur introuvable")
    return _enrich_device(d, db)


@router.post("/api/capteurs", response_model=GoveeDeviceRead, status_code=201)
def create_capteur(payload: GoveeDeviceCreate, db: Session = Depends(get_db)):
    d = GoveeDevice(**payload.model_dump())
    db.add(d); db.commit(); db.refresh(d)
    return _enrich_device(d, db)


@router.put("/api/capteurs/{device_id}", response_model=GoveeDeviceRead)
def update_capteur(device_id: int, payload: GoveeDeviceUpdate, db: Session = Depends(get_db)):
    d = db.query(GoveeDevice).filter(GoveeDevice.id_device == device_id).first()
    if not d:
        raise HTTPException(status_code=404, detail="Capteur introuvable")
    for field, val in payload.model_dump(exclude_none=True).items():
        setattr(d, field, val)
    db.commit(); db.refresh(d)
    return _enrich_device(d, db)


@router.delete("/api/capteurs/{device_id}", status_code=204)
def delete_capteur(device_id: int, db: Session = Depends(get_db)):
    d = db.query(GoveeDevice).filter(GoveeDevice.id_device == device_id).first()
    if not d:
        raise HTTPException(status_code=404, detail="Capteur introuvable")
    db.delete(d); db.commit()


# ─────────────────────────────────────────────────────────────────────────────
# TemperatureLog
# ─────────────────────────────────────────────────────────────────────────────

def _enrich_log(log: TemperatureLog, db: Session) -> TemperatureLogRead:
    nom_device = None
    if log.id_device:
        d = db.query(GoveeDevice).filter(GoveeDevice.id_device == log.id_device).first()
        nom_device = d.nom if d else None
    dh = log.date_heure
    if dh is not None and dh.tzinfo is None:
        dh = dh.replace(tzinfo=timezone.utc)
    return TemperatureLogRead(
        id_log=      log.id_log,
        id_device=   log.id_device,
        id_culture=  log.id_culture,
        id_espace=   log.id_espace,
        date_heure=  dh,
        temperature= log.temperature,
        humidite=    log.humidite,
        vpd=         log.vpd,
        source=      log.source,
        nom_device=  nom_device,
    )


@router.get("/api/temperature-logs", response_model=List[TemperatureLogRead])
def get_logs(
    id_device:  Optional[int] = Query(None),
    id_espace:  Optional[int] = Query(None),
    id_culture: Optional[int] = Query(None),
    heures:     int           = Query(168, description="Fenêtre temporelle en heures (défaut 7j)"),
    date_debut: Optional[str] = Query(None, description="ISO datetime début (prioritaire sur heures)"),
    date_fin:   Optional[str] = Query(None, description="ISO datetime fin"),
    db: Session = Depends(get_db),
):
    """
    Logs de température pour une fenêtre de temps donnée.
    - heures <= 48  : données brutes (toutes les 5 min)
    - heures > 48   : moyennes horaires (pour alléger le graphique)
    Si date_debut + date_fin sont fournis, ils ont priorité sur heures.
    """
    # ── Détermination de la fenêtre temporelle ────────────────────────────────
    if date_debut and date_fin:
        since = datetime.fromisoformat(date_debut.replace('Z', '+00:00'))
        until = datetime.fromisoformat(date_fin.replace('Z', '+00:00'))
        fenetre_h = int((until - since).total_seconds() / 3600)
    else:
        since = datetime.now(timezone.utc) - timedelta(hours=heures)
        until = None
        fenetre_h = heures

    # ── Agrégation horaire pour les longues périodes ──────────────────────────
    if fenetre_h > 48:
        hour_trunc = func.date_format(TemperatureLog.date_heure, '%Y-%m-%d %H:00:00')
        q = (
            db.query(
                hour_trunc.label('date_heure_str'),
                func.round(func.avg(TemperatureLog.temperature), 1).label('temperature'),
                func.round(func.avg(TemperatureLog.humidite),    1).label('humidite'),
                func.round(func.avg(TemperatureLog.vpd),         4).label('vpd'),
                TemperatureLog.id_device,
                TemperatureLog.id_espace,
            )
            .filter(TemperatureLog.date_heure >= since)
        )
        if until      is not None: q = q.filter(TemperatureLog.date_heure <= until)
        if id_device  is not None: q = q.filter(TemperatureLog.id_device  == id_device)
        if id_espace  is not None: q = q.filter(TemperatureLog.id_espace  == id_espace)
        if id_culture is not None: q = q.filter(TemperatureLog.id_culture == id_culture)
        rows = (
            q.group_by(hour_trunc, TemperatureLog.id_device, TemperatureLog.id_espace)
             .order_by(hour_trunc.asc())
             .all()
        )
        return [
            TemperatureLogRead(
                id_log=      None,
                id_device=   r.id_device,
                id_espace=   r.id_espace,
                date_heure=  datetime.strptime(r.date_heure_str, '%Y-%m-%d %H:%M:%S').replace(tzinfo=timezone.utc),
                temperature= r.temperature,
                humidite=    r.humidite,
                vpd=         r.vpd,
                source=      'aggregated',
            )
            for r in rows
        ]

    # ── Données brutes (≤ 48h) ────────────────────────────────────────────────
    q = db.query(TemperatureLog).filter(TemperatureLog.date_heure >= since)
    if until      is not None: q = q.filter(TemperatureLog.date_heure <= until)
    if id_device  is not None: q = q.filter(TemperatureLog.id_device  == id_device)
    if id_espace  is not None: q = q.filter(TemperatureLog.id_espace  == id_espace)
    if id_culture is not None: q = q.filter(TemperatureLog.id_culture == id_culture)
    logs = q.order_by(TemperatureLog.date_heure.asc()).all()
    return [_enrich_log(log, db) for log in logs]


@router.get("/api/temperature-logs/culture/{id_culture}", response_model=List[TemperatureLogRead])
def get_logs_culture(id_culture: int, db: Session = Depends(get_db)):
    """Tout l'historique des logs pour une culture (archivage inclus)."""
    logs = (
        db.query(TemperatureLog)
        .filter(TemperatureLog.id_culture == id_culture)
        .order_by(TemperatureLog.date_heure.asc())
        .all()
    )
    return [_enrich_log(log, db) for log in logs]


@router.post("/api/temperature-logs", response_model=TemperatureLogRead, status_code=201)
def create_log(payload: TemperatureLogCreate, db: Session = Depends(get_db)):
    """Insertion manuelle d'un relevé."""
    vpd = None
    if payload.temperature is not None and payload.humidite is not None:
        from app.services.govee_poller import _get_leaf_offset
        vpd = compute_vpd(payload.temperature, payload.humidite, leaf_offset=_get_leaf_offset(db))

    log = TemperatureLog(
        id_device=   payload.id_device,
        id_culture=  payload.id_culture,
        id_espace=   payload.id_espace,
        date_heure=  payload.date_heure or datetime.now(timezone.utc),
        temperature= payload.temperature,
        humidite=    payload.humidite,
        vpd=         vpd,
        source=      payload.source or "manual",
    )
    db.add(log); db.commit(); db.refresh(log)
    return _enrich_log(log, db)


@router.delete("/api/temperature-logs/{log_id}", status_code=204)
def delete_log(log_id: int, db: Session = Depends(get_db)):
    log = db.query(TemperatureLog).filter(TemperatureLog.id_log == log_id).first()
    if not log:
        raise HTTPException(status_code=404, detail="Log introuvable")
    db.delete(log); db.commit()


# ─────────────────────────────────────────────────────────────────────────────
# Govee Config
# ─────────────────────────────────────────────────────────────────────────────

GOVEE_CONFIG_LIST = "govee_config"

def _get_config_val(db: Session, key: str) -> Optional[str]:
    prefix = f"{key}:"
    row = db.query(ParametreListeValeur).filter(
        ParametreListeValeur.liste_nom == GOVEE_CONFIG_LIST,
        ParametreListeValeur.valeur.like(f"{prefix}%"),
    ).first()
    return row.valeur.split(":", 1)[1].strip() if row else None


def _set_config_val(db: Session, key: str, value: str):
    prefix = f"{key}:"
    row = db.query(ParametreListeValeur).filter(
        ParametreListeValeur.liste_nom == GOVEE_CONFIG_LIST,
        ParametreListeValeur.valeur.like(f"{prefix}%"),
    ).first()
    if row:
        row.valeur = f"{key}:{value}"
    else:
        db.add(ParametreListeValeur(
            liste_nom=GOVEE_CONFIG_LIST,
            valeur=f"{key}:{value}",
            ordre=0,
        ))


@router.get("/api/govee/config", response_model=GoveeConfigRead)
def get_govee_config(db: Session = Depends(get_db)):
    api_key         = _get_config_val(db, "api_key")
    polling         = _get_config_val(db, "polling_enabled")
    gmail_user      = _get_config_val(db, "gmail_user")
    gmail_pwd       = _get_config_val(db, "gmail_app_password")
    gmail_enabled   = _get_config_val(db, "gmail_enabled")
    gmail_last_chk  = _get_config_val(db, "gmail_last_check")
    gmail_last_stat = _get_config_val(db, "gmail_last_status")
    return GoveeConfigRead(
        api_key=                api_key,
        polling_enabled=        polling == "true",
        gmail_user=             gmail_user,
        gmail_app_password_set= bool(gmail_pwd),
        gmail_enabled=          gmail_enabled == "true",
        gmail_last_check=       gmail_last_chk,
        gmail_last_status=      gmail_last_stat,
    )


@router.put("/api/govee/config", response_model=GoveeConfigRead)
def update_govee_config(payload: GoveeConfigUpdate, db: Session = Depends(get_db)):
    if payload.api_key is not None:
        _set_config_val(db, "api_key", payload.api_key)
    if payload.polling_enabled is not None:
        _set_config_val(db, "polling_enabled", "true" if payload.polling_enabled else "false")
    # Gmail
    if payload.gmail_user is not None:
        _set_config_val(db, "gmail_user", payload.gmail_user)
    if payload.gmail_app_password is not None:
        _set_config_val(db, "gmail_app_password", payload.gmail_app_password)
    if payload.gmail_enabled is not None:
        _set_config_val(db, "gmail_enabled", "true" if payload.gmail_enabled else "false")
    db.commit()
    return get_govee_config(db)


@router.post("/api/govee/check-gmail", response_model=GmailImportResult)
def check_gmail(db: Session = Depends(get_db)):
    """Déclenche immédiatement l'import Gmail et retourne le résultat."""
    from app.services.gmail_importer import check_gmail_and_import
    result = check_gmail_and_import(db)
    return GmailImportResult(**result)


# ─────────────────────────────────────────────────────────────────────────────
# Import des appareils depuis le compte Govee (API V2)
# ─────────────────────────────────────────────────────────────────────────────

class GoveeCloudDevice(BaseModel):
    """Appareil remonté par l'API Govee V2 (avant import)."""
    device_id:   str
    sku:         str
    device_name: str
    already_registered: bool = False


@router.get("/api/govee/cloud-devices", response_model=List[GoveeCloudDevice])
def list_cloud_devices(db: Session = Depends(get_db)):
    """Liste les appareils du compte Govee via API V2."""
    api_key = _get_cloud_api_key(db)
    if not api_key:
        raise HTTPException(status_code=400, detail="Clé API Govee non configurée")

    raw = cloud_v2_list_devices(api_key)
    if not raw:
        raise HTTPException(status_code=502, detail="Impossible de joindre l'API Govee V2")

    # Vérifier lesquels sont déjà enregistrés
    existing_ids = {d.device_id for d in db.query(GoveeDevice.device_id).all()
                    if d.device_id}

    return [
        GoveeCloudDevice(
            device_id=   d["device"],
            sku=         d["sku"],
            device_name= d.get("deviceName", d["device"]),
            already_registered= d["device"] in existing_ids,
        )
        for d in raw
        if "sensorTemperature" in str(d.get("capabilities", ""))  # filtrer les thermomètres
    ]


# ─────────────────────────────────────────────────────────────────────────────
# Polling manuel (déclenché à la demande)
# ─────────────────────────────────────────────────────────────────────────────

@router.post("/api/govee/poll", response_model=List[PollResult])
def manual_poll(db: Session = Depends(get_db)):
    """Déclenche immédiatement un cycle de polling sur tous les capteurs actifs (API V2)."""
    devices = db.query(GoveeDevice).filter(
        GoveeDevice.actif  == True,
        GoveeDevice.modele != "esphome",
    ).all()
    api_key     = _get_cloud_api_key(db)
    from app.services.govee_poller import _get_leaf_offset
    leaf_offset = _get_leaf_offset(db)
    results: List[PollResult] = []

    for device in devices:
        reading = None

        # 1. LAN UDP si IP configurée
        if device.ip_lan:
            reading = _udp_get_device_status(device.ip_lan)

        # 2. Cloud V2
        if reading is None and api_key and device.device_id:
            reading = _cloud_v2_get_device_status(api_key, device.device_id, device.modele or "H5179")

        if reading is None:
            results.append(PollResult(
                device_id=device.id_device, nom=device.nom,
                success=False, erreur="Aucune donnée — vérifier device_id et SKU (modèle)",
            ))
            continue

        temp = reading["temperature"]
        hum  = reading["humidity"]
        vpd  = compute_vpd(temp, hum, leaf_offset=leaf_offset)

        id_culture = None
        if device.id_espace:
            id_culture = _get_active_culture_id(db, device.id_espace)

        db.add(TemperatureLog(
            id_device=   device.id_device,
            id_culture=  id_culture,
            id_espace=   device.id_espace,
            date_heure=  datetime.now(timezone.utc),
            temperature= temp,
            humidite=    hum,
            vpd=         vpd,
            source=      "govee",
        ))
        results.append(PollResult(
            device_id=   device.id_device,
            nom=         device.nom,
            success=     True,
            temperature= temp,
            humidite=    hum,
            vpd=         vpd,
        ))

    db.commit()
    return results


# ─────────────────────────────────────────────────────────────────────────────
# Import CSV historique Govee
# ─────────────────────────────────────────────────────────────────────────────

class CsvImportResult(BaseModel):
    imported: int
    skipped:  int
    errors:   int
    message:  str


def _parse_govee_csv(content: str):
    """
    Parse un export CSV de l'app Govee Home.
    Supporte les formats :
      - Séparateurs : virgule ou point-virgule
      - Unités temp  : ℃ / °C  ou  ℉ / °F  (détecté dans l'en-tête)
      - Formats date : YYYY-MM-DD HH:MM:SS  ou  YYYY/MM/DD HH:MM:SS  etc.
    Retourne une liste de dicts {date_heure, temperature_c, humidity}.
    """
    # Détection du séparateur
    first_line = content.split('\n')[0]
    sep = ';' if first_line.count(';') > first_line.count(',') else ','

    reader = csv.DictReader(io.StringIO(content), delimiter=sep)
    rows = list(reader)
    if not rows:
        return [], False

    # Détection des colonnes (insensible à la casse et aux symboles Unicode)
    headers = list(rows[0].keys())

    def normalize(s: str) -> str:
        """Normalise un en-tête : minuscules, sans accents courants, sans symboles."""
        return (s.lower()
                 .replace('(', '').replace(')', '')
                 .replace('℃', 'c').replace('℉', 'f').replace('°', '')
                 .replace('é', 'e').replace('è', 'e').replace('ê', 'e')
                 .replace('à', 'a').replace('â', 'a')
                 .replace('ù', 'u').replace('û', 'u')
                 .replace('î', 'i').replace('ï', 'i')
                 .replace('ô', 'o'))

    def find_col(*keywords):
        for h in headers:
            h_n = normalize(h)
            if any(kw in h_n for kw in keywords):
                return h
        return None

    # "Horodatage..." (Govee FR), "Timestamp", "Date", "Time"
    ts_col   = find_col('horodatage', 'timestamp', 'date', 'time')
    # Fallback : première colonne si rien trouvé
    if ts_col is None and headers:
        ts_col = headers[0]

    temp_col = find_col('temperature', 'temp')
    hum_col  = find_col('humidity', 'humidite', 'hum', 'rh', 'relative')

    if not ts_col or not temp_col or not hum_col:
        return [], False

    # Détection Fahrenheit : cherche ℉ ou °F dans le nom de colonne
    # "Température_Celsius" / "_celsius" → jamais Fahrenheit
    tc_norm = normalize(temp_col or '')
    is_fahrenheit = (
        any(c in (temp_col or '') for c in ['℉', '°F', '(F)'])
        or ('fahrenheit' in tc_norm)
        or (tc_norm.endswith('_f') or tc_norm.endswith(' f'))
    )
    # Si la colonne contient explicitement "celsius", forcer Celsius
    if 'celsius' in tc_norm or '℃' in (temp_col or ''):
        is_fahrenheit = False

    # Formats de date acceptés
    DATE_FMTS = [
        '%Y-%m-%d %H:%M:%S',
        '%Y/%m/%d %H:%M:%S',
        '%Y-%m-%d %H:%M',
        '%Y/%m/%d %H:%M',
        '%m/%d/%Y %H:%M:%S',
        '%d/%m/%Y %H:%M:%S',
        '%d/%m/%Y %H:%M',
    ]

    def parse_dt(s: str):
        s = s.strip()
        for fmt in DATE_FMTS:
            try:
                return datetime.strptime(s, fmt)
            except ValueError:
                pass
        return None

    results = []
    for row in rows:
        ts_raw   = (row.get(ts_col) or '').strip()
        temp_raw = (row.get(temp_col) or '').strip()
        hum_raw  = (row.get(hum_col) or '').strip()

        if not ts_raw or not temp_raw or not hum_raw:
            continue

        dt = parse_dt(ts_raw)
        if dt is None:
            continue

        try:
            temp = float(temp_raw)
            hum  = float(hum_raw)
        except ValueError:
            continue

        if is_fahrenheit:
            temp = (temp - 32.0) * 5.0 / 9.0
        temp = round(temp, 1)
        hum  = round(hum, 1)

        results.append({'date_heure': dt, 'temperature': temp, 'humidity': hum})

    return results, True


@router.post("/api/govee/import-csv", response_model=CsvImportResult)
async def import_csv(
    id_device: int = Form(..., description="ID du capteur GrowManager auquel rattacher les données"),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    """
    Importe l'historique d'un export CSV de l'app Govee Home.
    Les entrées déjà présentes (même capteur + même horodatage à la minute près) sont ignorées.
    """
    # Vérifier que le capteur existe
    device = db.query(GoveeDevice).filter(GoveeDevice.id_device == id_device).first()
    if not device:
        raise HTTPException(status_code=404, detail="Capteur introuvable")

    # Lire le fichier
    raw_bytes = await file.read()
    try:
        content = raw_bytes.decode('utf-8')
    except UnicodeDecodeError:
        content = raw_bytes.decode('latin-1')

    rows, ok = _parse_govee_csv(content)
    if not ok:
        raise HTTPException(
            status_code=422,
            detail="Format CSV non reconnu — colonnes attendues : Timestamp, Temperature, Humidity"
        )

    if not rows:
        return CsvImportResult(imported=0, skipped=0, errors=0, message="Fichier vide ou aucune ligne valide")

    # Récupérer les horodatages déjà présents pour ce capteur (à la minute près)
    existing_ts = {
        log.date_heure.replace(second=0, microsecond=0)
        for log in db.query(TemperatureLog.date_heure)
            .filter(TemperatureLog.id_device == id_device)
            .all()
    }

    id_culture = None
    if device.id_espace:
        id_culture = _get_active_culture_id(db, device.id_espace)

    imported = skipped = errors = 0
    BATCH = 500

    for i, row in enumerate(rows):
        try:
            # Dédoublonnage à la minute
            ts_min = row['date_heure'].replace(second=0, microsecond=0)
            if ts_min in existing_ts:
                skipped += 1
                continue

            vpd = compute_vpd(row['temperature'], row['humidity'])

            db.add(TemperatureLog(
                id_device=   id_device,
                id_culture=  id_culture,
                id_espace=   device.id_espace,
                date_heure=  row['date_heure'],
                temperature= row['temperature'],
                humidite=    row['humidity'],
                vpd=         vpd,
                source=      'csv_import',
            ))
            existing_ts.add(ts_min)
            imported += 1

            # Commit par batch pour éviter de tout perdre en cas d'erreur
            if imported % BATCH == 0:
                db.commit()

        except Exception:
            errors += 1

    db.commit()

    parts = [f"{imported} enregistrement(s) importé(s)"]
    if skipped: parts.append(f"{skipped} déjà présent(s)")
    if errors:  parts.append(f"{errors} erreur(s)")

    return CsvImportResult(
        imported=imported,
        skipped=skipped,
        errors=errors,
        message=" · ".join(parts),
    )
