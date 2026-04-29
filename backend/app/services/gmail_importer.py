"""
Service d'import automatique des exports CSV Govee depuis Gmail (IMAP SSL).

Flux :
  1. Connexion IMAP à imap.gmail.com:993
  2. Recherche des emails non lus avec "Govee" dans le sujet
  3. Extraction des pièces jointes CSV
  4. Identification du capteur GrowManager par correspondance de nom
  5. Import via la logique partagée avec l'import manuel
  6. Marquage de l'email comme lu pour éviter le réimport

Déclenchement :
  - Automatique : job APScheduler quotidien à 00h30 (après l'export 23h59)
  - Manuel      : POST /api/govee/check-gmail
"""
from __future__ import annotations

import email
import imaplib
import logging
import re
import unicodedata
from datetime import datetime
from typing import List, Optional, Tuple

from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.models.all_models import GoveeDevice, ParametreListeValeur, TemperatureLog
from app.services.govee_poller import _get_active_culture_id, compute_vpd

logger = logging.getLogger("gmail_importer")

# ── Constantes ────────────────────────────────────────────────────────────────
IMAP_HOST        = "imap.gmail.com"
IMAP_PORT        = 993
GOVEE_CONFIG_KEY = "govee_config"
MAX_EMAILS       = 20   # ne traiter que les N derniers emails non lus


# ── Helpers config (miroir de capteurs.py pour éviter l'import circulaire) ───

def _cfg_get(db: Session, key: str) -> Optional[str]:
    row = (
        db.query(ParametreListeValeur)
        .filter(
            ParametreListeValeur.liste_nom == GOVEE_CONFIG_KEY,
            ParametreListeValeur.valeur.like(f"{key}:%"),
        )
        .first()
    )
    return row.valeur.split(":", 1)[1] if row else None


def _cfg_set(db: Session, key: str, value: str) -> None:
    row = (
        db.query(ParametreListeValeur)
        .filter(
            ParametreListeValeur.liste_nom == GOVEE_CONFIG_KEY,
            ParametreListeValeur.valeur.like(f"{key}:%"),
        )
        .first()
    )
    if row:
        row.valeur = f"{key}:{value}"
    else:
        db.add(ParametreListeValeur(
            liste_nom=GOVEE_CONFIG_KEY,
            valeur=f"{key}:{value}",
            ordre=0,
        ))


# ── Normalisation pour la correspondance de noms ──────────────────────────────

def _normalize(s: str) -> str:
    """Minuscules, sans accents, sans ponctuation — pour comparaison floue."""
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode("ascii")
    s = re.sub(r"[^a-z0-9 ]", " ", s.lower())
    return re.sub(r"\s+", " ", s).strip()


def _match_device(filename: str, devices: List[GoveeDevice]) -> Optional[GoveeDevice]:
    """
    Tente de faire correspondre un nom de fichier CSV à un capteur GrowManager.

    Stratégie (ordre décroissant de priorité) :
      1. Le nom normalisé du capteur est contenu dans le nom de fichier normalisé.
      2. Le nom de fichier normalisé est contenu dans le nom du capteur.
      3. Si un seul capteur disponible, retourne ce capteur directement.

    Retourne None si aucune correspondance trouvée avec plusieurs capteurs.
    """
    fname = _normalize(filename)

    # Correspondance : on préfère le match le plus long (plus spécifique)
    best: Optional[GoveeDevice] = None
    best_len = 0

    for dev in devices:
        dev_norm = _normalize(dev.nom)
        if not dev_norm:
            continue
        if dev_norm in fname or fname.startswith(dev_norm):
            if len(dev_norm) > best_len:
                best = dev
                best_len = len(dev_norm)

    if best:
        return best

    # Fallback : si un seul capteur, on l'utilise
    if len(devices) == 1:
        logger.info(f"Aucune correspondance de nom — 1 seul capteur, utilisation par défaut : {devices[0].nom}")
        return devices[0]

    return None


# ── Import des lignes CSV dans la base ───────────────────────────────────────

def _import_rows(
    db: Session,
    device: GoveeDevice,
    rows: list,
    source: str = "gmail",
) -> Tuple[int, int, int]:
    """
    Insère les lignes déjà parsées dans TemperatureLog avec déduplication.
    Retourne (imported, skipped, errors).
    """
    id_culture = None
    if device.id_espace:
        id_culture = _get_active_culture_id(db, device.id_espace)

    # Charger les horodatages existants pour ce capteur (déduplication à la minute)
    existing_ts = {
        log.date_heure.replace(second=0, microsecond=0)
        for log in db.query(TemperatureLog.date_heure)
            .filter(TemperatureLog.id_device == device.id_device)
            .all()
    }

    imported = skipped = errors = 0
    BATCH = 500

    for i, row in enumerate(rows):
        try:
            ts_min = row["date_heure"].replace(second=0, microsecond=0)
            if ts_min in existing_ts:
                skipped += 1
                continue

            temp = row["temperature"]
            hum  = row["humidity"]
            vpd  = compute_vpd(temp, hum)

            db.add(TemperatureLog(
                id_device=  device.id_device,
                id_culture= id_culture,
                id_espace=  device.id_espace,
                date_heure= row["date_heure"],
                temperature=temp,
                humidite=   hum,
                vpd=        vpd,
                source=     source,
            ))
            existing_ts.add(ts_min)
            imported += 1

            if (i + 1) % BATCH == 0:
                db.commit()

        except Exception as exc:
            errors += 1
            logger.warning(f"Erreur ligne {i}: {exc}")

    db.commit()
    return imported, skipped, errors


# ── Fonction principale ────────────────────────────────────────────────────────

def check_gmail_and_import(db: Optional[Session] = None) -> dict:
    """
    Point d'entrée principal. Connecte Gmail, importe les CSV Govee, retourne un résumé.

    Peut être appelé :
      - Depuis APScheduler (sans db → crée sa propre session)
      - Depuis un endpoint FastAPI (avec db injectée)
    """
    own_db = db is None
    if own_db:
        db = SessionLocal()

    try:
        # ── Config ────────────────────────────────────────────────────────────
        gmail_enabled  = _cfg_get(db, "gmail_enabled")
        gmail_user     = _cfg_get(db, "gmail_user")
        gmail_password = _cfg_get(db, "gmail_app_password")

        if gmail_enabled != "true":
            return {
                "emails_processed": 0, "imported_total": 0,
                "skipped_total": 0, "errors_total": 0,
                "message": "Import Gmail désactivé dans le paramétrage",
                "ok": False,
            }

        if not gmail_user or not gmail_password:
            return {
                "emails_processed": 0, "imported_total": 0,
                "skipped_total": 0, "errors_total": 0,
                "message": "Gmail non configuré — renseigne l'adresse et le mot de passe d'application",
                "ok": False,
            }

        # ── Capteurs actifs ───────────────────────────────────────────────────
        devices = db.query(GoveeDevice).filter(GoveeDevice.actif == True).all()
        if not devices:
            return {
                "emails_processed": 0, "imported_total": 0,
                "skipped_total": 0, "errors_total": 0,
                "message": "Aucun capteur actif dans GrowManager",
                "ok": False,
            }

        # ── Connexion IMAP ────────────────────────────────────────────────────
        logger.info(f"Connexion IMAP Gmail : {gmail_user}")
        try:
            mail = imaplib.IMAP4_SSL(IMAP_HOST, IMAP_PORT)
            mail.login(gmail_user, gmail_password)
        except imaplib.IMAP4.error as exc:
            err_msg = str(exc)
            logger.error(f"Erreur login IMAP: {err_msg}")
            _cfg_set(db, "gmail_last_check", datetime.utcnow().isoformat())
            _cfg_set(db, "gmail_last_status", f"Erreur login: {err_msg[:120]}")
            db.commit()
            return {
                "emails_processed": -1, "imported_total": 0,
                "skipped_total": 0, "errors_total": 0,
                "message": f"Échec connexion Gmail: {err_msg}",
                "ok": False,
            }

        mail.select("INBOX")

        # ── Recherche des emails ──────────────────────────────────────────────
        # On cherche les emails NON LUS avec "Govee" dans le sujet
        # En cas d'échec, on tente avec l'expéditeur govee.com
        search_criteria = [
            '(UNSEEN SUBJECT "Govee")',
            '(UNSEEN FROM "govee")',
            '(SUBJECT "Govee" SUBJECT "export")',  # fallback sans UNSEEN
        ]

        msg_ids = []
        for criteria in search_criteria:
            _, data = mail.search(None, criteria)
            if data and data[0]:
                msg_ids = data[0].split()
                if msg_ids:
                    logger.info(f"Critère '{criteria}' → {len(msg_ids)} email(s)")
                    break

        if not msg_ids:
            mail.logout()
            _cfg_set(db, "gmail_last_check", datetime.utcnow().isoformat())
            _cfg_set(db, "gmail_last_status", "Aucun email Govee non lu trouvé")
            db.commit()
            return {
                "emails_processed": 0, "imported_total": 0,
                "skipped_total": 0, "errors_total": 0,
                "message": "Aucun email Govee non lu trouvé dans la boîte de réception",
                "ok": True,
            }

        # Ne traiter que les MAX_EMAILS derniers pour éviter de tout réimporter
        msg_ids = msg_ids[-MAX_EMAILS:]
        logger.info(f"{len(msg_ids)} email(s) à traiter")

        # ── Traitement des emails ─────────────────────────────────────────────
        emails_processed   = 0
        imported_total     = 0
        skipped_total      = 0
        errors_total       = 0
        no_match_files: List[str] = []

        for msg_id in msg_ids:
            try:
                _, msg_data = mail.fetch(msg_id, "(RFC822)")
                if not msg_data or not msg_data[0]:
                    continue

                msg = email.message_from_bytes(msg_data[0][1])
                subject = msg.get("Subject", "(sans objet)")
                logger.info(f"Email: {subject}")

                # Extraire les pièces jointes CSV
                csv_attachments: List[Tuple[str, bytes]] = []
                for part in msg.walk():
                    disposition = part.get("Content-Disposition", "")
                    filename = part.get_filename()
                    if (
                        filename
                        and filename.lower().endswith(".csv")
                        and "attachment" in disposition.lower()
                    ):
                        payload = part.get_payload(decode=True)
                        if payload:
                            csv_attachments.append((filename, payload))

                if not csv_attachments:
                    logger.debug(f"Pas de CSV dans : {subject}")
                    continue

                emails_processed += 1
                email_had_import = False

                for filename, payload in csv_attachments:
                    # Décodage du CSV
                    try:
                        content = payload.decode("utf-8")
                    except UnicodeDecodeError:
                        content = payload.decode("latin-1", errors="replace")

                    # Parsing — import local pour éviter les imports circulaires
                    from app.routers.capteurs import _parse_govee_csv
                    rows, ok = _parse_govee_csv(content)
                    if not ok or not rows:
                        logger.warning(f"CSV non parseable: {filename}")
                        continue

                    # Correspondance capteur
                    device = _match_device(filename, devices)
                    if device is None:
                        no_match_files.append(filename)
                        logger.warning(f"Aucun capteur trouvé pour : {filename}")
                        continue

                    imp, skip, err = _import_rows(db, device, rows, source="gmail")
                    imported_total += imp
                    skipped_total  += skip
                    errors_total   += err
                    email_had_import = True
                    logger.info(f"{filename} → {device.nom} : +{imp} mesures ({skip} doublons)")

                # Marquer comme lu si au moins un CSV traité avec succès
                if email_had_import:
                    mail.store(msg_id, "+FLAGS", "\\Seen")

            except Exception as exc:
                logger.error(f"Erreur traitement email {msg_id}: {exc}")
                errors_total += 1

        mail.logout()

        # ── Statut final ──────────────────────────────────────────────────────
        now_str = datetime.utcnow().isoformat()
        parts = [
            f"{imported_total} nouvelle(s) mesure(s) importée(s)",
            f"{skipped_total} doublon(s) ignoré(s)",
        ]
        if no_match_files:
            parts.append(
                f"Fichier(s) sans capteur correspondant : {', '.join(no_match_files)}"
            )

        status_msg = " · ".join(parts)
        _cfg_set(db, "gmail_last_check", now_str)
        _cfg_set(db, "gmail_last_status", status_msg[:250])
        db.commit()

        return {
            "emails_processed": emails_processed,
            "imported_total":   imported_total,
            "skipped_total":    skipped_total,
            "errors_total":     errors_total,
            "message":          status_msg,
            "ok":               True,
        }

    except Exception as exc:
        logger.error(f"Erreur check_gmail_and_import: {exc}", exc_info=True)
        return {
            "emails_processed": -1, "imported_total": 0,
            "skipped_total": 0, "errors_total": 0,
            "message": f"Erreur inattendue: {str(exc)}",
            "ok": False,
        }
    finally:
        if own_db and db:
            db.close()
