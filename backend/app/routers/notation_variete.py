"""Router Classement des variétés.

- Notations manuelles (4 notes sur 5 étoiles, une notation par variété) : CRUD
- Classement : agrège automatiquement, pour chaque variété produite,
  les rendements de culture (par taille de pot / hydro), les rendements rosin et hash
  (cumulés) et le taux de germination des graines.
- Export CSV du classement complet.
"""
import csv
import io
import unicodedata
from datetime import date, datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.all_models import (
    ActionCalendrier, Breeder, Culture, Graine, HashExtraction, HistoriqueCulture,
    HistoriquePlant, Materiel, NotationVariete, Plant, RosinExtraction, Stock, Variete,
)
from app.schemas.notation_variete import NotationCreate, NotationUpdate, NotationRead

router = APIRouter(prefix="/api/notations", tags=["notations"])

NOTE_FIELDS = ("note_gout", "note_odeur", "note_texture", "note_extraction")
FIELDS = (
    "nom_variete", "breeder", "date_notation", *NOTE_FIELDS,
    "taux_thc", "taux_cbd", "terpene_dominant", "commentaire_labo", "notes_generales",
)

# Substrats considérés comme hydroponie (comparaison insensible à la casse, sous-chaîne)
HYDRO_KEYWORDS = ("hydro", "nft", "argile", "dwc", "aero", "aéro", "ebb")
# Règle métier : toutes les anciennes cultures en terre (historique saisi à la main) étaient en pots de 15 L
POT_HISTORIQUE_TERRE_L = 15.0
# Statuts prouvant qu'une graine a germé
STATUTS_GERMES = {"veg", "floraison", "sechage", "curing", "prete", "recolte", "wpff"}


# ── Helpers ───────────────────────────────────────────────────────────────────

def _key(name: Optional[str]) -> str:
    """Clé de regroupement : casse, espaces et accents ignorés (Açaï Jelly = Acai Jelly)."""
    s = unicodedata.normalize("NFKD", " ".join((name or "").split()).lower())
    return "".join(c for c in s if not unicodedata.combining(c))


def _is_hydro(substrat: Optional[str]) -> bool:
    s = (substrat or "").lower()
    return any(k in s for k in HYDRO_KEYWORDS)


def _to_float(v) -> Optional[float]:
    if v is None or v == "":
        return None
    try:
        return float(str(v).replace(",", ".").lower().replace("l", "").strip())
    except (TypeError, ValueError):
        return None


def _note_moyenne(n) -> Optional[float]:
    vals = [getattr(n, f) for f in NOTE_FIELDS if getattr(n, f) is not None]
    return round(sum(vals) / len(vals), 2) if vals else None


def _to_read(n: NotationVariete) -> dict:
    data = {f: getattr(n, f) for f in FIELDS}
    data.update({
        "id_notation":  n.id_notation,
        "created_at":   n.created_at,
        "updated_at":   n.updated_at,
        "note_moyenne": _note_moyenne(n),
    })
    return data


def _bucket_label(kind: str, volume: Optional[float]) -> str:
    if kind == "hydro":
        return "Hydro"
    if kind == "pot" and volume is not None:
        return f"{volume:g} L".replace(".", ",")
    return "Pot non renseigné"


def build_classement(db: Session) -> list[dict]:
    """Agrège toutes les données de production par variété (clé = nom normalisé)."""
    varietes = {v.id_variete: v.nom_variete for v in db.query(Variete).all()}
    breeders = {b.id_breeder: b.nom_breeder for b in db.query(Breeder).all()}
    graines = {g.id_graine: (g.id_variete, g.id_breeder) for g in db.query(Graine).all()}
    stocks = {s.id_stock: s.id_variete for s in db.query(Stock).all()}
    pots_volume: dict[int, Optional[float]] = {}
    for m in db.query(Materiel).filter(Materiel.categorie == "Pots").all():
        c = m.caracteristiques or {}
        pots_volume[m.id_materiel] = _to_float(c.get("volume_l")) or _to_float(c.get("volume"))

    rows: dict[str, dict] = {}

    def row(name: str) -> dict:
        k = _key(name)
        if k not in rows:
            rows[k] = {
                "nom_variete": " ".join(name.split()), "breeder": None,
                "_yields": {},          # (kind, volume) -> [g]
                "_rosin": [0.0, 0.0, 0],  # utilisé, extrait, nb
                "_hash":  [0.0, 0.0, 0],
                "_germ":  [0, 0],        # germées, mortes
                "notation": None,
            }
        return rows[k]

    def add_yield(name: str, kind: str, volume: Optional[float], g: float):
        r = row(name)
        r["_yields"].setdefault((kind, volume), []).append(g)

    # ── Plantes des cultures (données détaillées : pot, substrat, germination) ──
    graines_mortes = {
        a.id_plant for a in db.query(ActionCalendrier.id_plant)
        .filter(ActionCalendrier.type_action == "graine_morte", ActionCalendrier.id_plant.isnot(None)).all()
    }
    for p in db.query(Plant).all():
        id_variete, id_breeder = graines.get(p.id_graine, (None, None))
        name = varietes.get(id_variete)
        if not name:
            continue
        r = row(name)
        if not r["breeder"] and id_breeder:
            r["breeder"] = breeders.get(id_breeder)

        # Germination (uniquement les plantes issues de graine)
        if (p.origine or "graine") == "graine":
            if p.id_plant in graines_mortes:
                r["_germ"][1] += 1
            elif p.date_germination or p.statut in STATUTS_GERMES:
                r["_germ"][0] += 1
            # sinon : germination en cours ou abandon non qualifié → non compté

        # Rendement culture (poids sec)
        poids = float(p.poids_recolte_g) if p.poids_recolte_g else 0.0
        if poids > 0 and p.statut != "abandonne":
            if _is_hydro(p.substrat):
                add_yield(name, "hydro", None, poids)
            else:
                vol = float(p.volume_pot_l) if p.volume_pot_l else pots_volume.get(p.id_pot)
                add_yield(name, "pot" if vol else "inconnu", vol, poids)

    # ── Historique (anciennes cultures) — sans les archives de cultures encore présentes ──
    cultures_ids = {c.id_culture for c in db.query(Culture.id_culture).all()}
    hists = {
        h.id_historique_culture: h for h in db.query(HistoriqueCulture).all()
        if not (h.id_culture and h.id_culture in cultures_ids)
    }
    for hp in db.query(HistoriquePlant).all():
        h = hists.get(hp.id_historique_culture)
        if not h:
            continue
        name = (hp.variete_nom or "").strip() or varietes.get(hp.id_variete)
        qte = float(hp.quantite_recoltee) if hp.quantite_recoltee else 0.0
        if not name or qte <= 0:
            continue
        if _is_hydro(h.substrat):
            add_yield(name, "hydro", None, qte)
        elif h.substrat:
            add_yield(name, "pot", POT_HISTORIQUE_TERRE_L, qte)
        else:
            add_yield(name, "inconnu", None, qte)

    # ── Extractions (cumul : total extrait / total utilisé) ──────────────────
    def nom_from_stock(id_stock) -> Optional[str]:
        return varietes.get(stocks.get(id_stock)) if id_stock else None

    for x in db.query(RosinExtraction).all():
        if not x.quantite_utilisee or not x.quantite_extraite or float(x.quantite_utilisee) <= 0:
            continue
        name = (x.nom_variete_extract or "").strip() or nom_from_stock(x.id_stock_source)
        if not name:
            continue
        acc = row(name)["_rosin"]
        acc[0] += float(x.quantite_utilisee); acc[1] += float(x.quantite_extraite); acc[2] += 1

    for x in db.query(HashExtraction).all():
        if not x.quantite_utilisee or not x.quantite_extraite or float(x.quantite_utilisee) <= 0:
            continue
        name = (x.nom_variete_hash or "").strip()
        if not name and x.id_variete:
            name = varietes.get(x.id_variete, "")
        if not name:
            name = nom_from_stock(x.id_stock_source) or ""
        if not name:
            continue
        acc = row(name)["_hash"]
        acc[0] += float(x.quantite_utilisee); acc[1] += float(x.quantite_extraite); acc[2] += 1

    # ── Notations manuelles (la plus récente si doublon) ─────────────────────
    notations = db.query(NotationVariete).order_by(NotationVariete.updated_at, NotationVariete.id_notation).all()
    for n in notations:
        r = row(n.nom_variete)
        r["notation"] = _to_read(n)
        if n.breeder:
            r["breeder"] = n.breeder

    # ── Mise en forme ─────────────────────────────────────────────────────────
    order = {"pot": 0, "hydro": 1, "inconnu": 2}
    result = []
    for k, r in rows.items():
        buckets = []
        all_g: list[float] = []
        for (kind, vol), vals in sorted(r["_yields"].items(), key=lambda kv: (order[kv[0][0]], kv[0][1] or 0)):
            all_g += vals
            buckets.append({
                "type": kind, "volume_l": vol, "label": _bucket_label(kind, vol),
                "nb_pieds": len(vals),
                "moyenne_g": round(sum(vals) / len(vals), 1),
                "total_g": round(sum(vals), 1),
                "min_g": round(min(vals), 1), "max_g": round(max(vals), 1),
            })

        def extr(acc):
            if not acc[2]:
                return None
            return {"nb": acc[2], "total_utilise_g": round(acc[0], 1), "total_extrait_g": round(acc[1], 2),
                    "rendement_pct": round(acc[1] / acc[0] * 100, 1)}

        germees, mortes = r["_germ"]
        semees = germees + mortes
        notation = r["notation"]
        result.append({
            "key": k,
            "nom_variete": r["nom_variete"],
            "breeder": r["breeder"],
            "notation": notation,
            "note_moyenne": notation["note_moyenne"] if notation else None,
            "rendement_culture": buckets,
            "nb_pieds_recoltes": len(all_g),
            "rendement_moyen_g": round(sum(all_g) / len(all_g), 1) if all_g else None,
            "rosin": extr(r["_rosin"]),
            "hash": extr(r["_hash"]),
            "germination": {
                "semees": semees, "germees": germees, "mortes": mortes,
                "taux_pct": round(germees / semees * 100, 1),
            } if semees else None,
        })

    result.sort(key=lambda x: (
        x["note_moyenne"] is None, -(x["note_moyenne"] or 0),
        -(x["rendement_moyen_g"] or 0), x["nom_variete"].lower(),
    ))
    return result


# ── Routes utilitaires (AVANT /{id}) ─────────────────────────────────────────

@router.get("/utils/classement")
def get_classement(db: Session = Depends(get_db)):
    """Classement complet : une ligne par variété produite ou notée."""
    return build_classement(db)


@router.get("/export/csv")
def export_csv(db: Session = Depends(get_db)):
    """Export du classement complet (stats calculées + notes) au format CSV."""
    output = io.StringIO()
    writer = csv.writer(output, delimiter=";")
    writer.writerow([
        "Rang", "Variété", "Breeder",
        "Goût (/5)", "Odeur (/5)", "Texture (/5)", "Facilité extraction (/5)", "Moyenne (/5)",
        "Rendement culture (détail)", "Pieds récoltés", "Moyenne g/pied",
        "Rosin %", "Rosin extrait (g)", "Rosin utilisé (g)", "Nb presses",
        "Hash %", "Hash extrait (g)", "Hash utilisé (g)", "Nb extractions hash",
        "Graines semées", "Graines germées", "Germination %",
        "THC %", "CBD %", "Terpènes", "Notes",
    ])

    def fr(v):
        return "" if v is None else str(v).replace(".", ",")

    for i, r in enumerate(build_classement(db), start=1):
        n = r["notation"] or {}
        ro, ha, ge = r["rosin"] or {}, r["hash"] or {}, r["germination"] or {}
        detail = " | ".join(f'{b["label"]} : {fr(b["moyenne_g"])} g ({b["nb_pieds"]} pied{"s" if b["nb_pieds"] > 1 else ""})'
                            for b in r["rendement_culture"])
        writer.writerow([
            i, r["nom_variete"], r["breeder"] or "",
            fr(n.get("note_gout")), fr(n.get("note_odeur")), fr(n.get("note_texture")),
            fr(n.get("note_extraction")), fr(r["note_moyenne"]),
            detail, r["nb_pieds_recoltes"] or "", fr(r["rendement_moyen_g"]),
            fr(ro.get("rendement_pct")), fr(ro.get("total_extrait_g")), fr(ro.get("total_utilise_g")), ro.get("nb", ""),
            fr(ha.get("rendement_pct")), fr(ha.get("total_extrait_g")), fr(ha.get("total_utilise_g")), ha.get("nb", ""),
            ge.get("semees", ""), ge.get("germees", ""), fr(ge.get("taux_pct")),
            fr(n.get("taux_thc")), fr(n.get("taux_cbd")), n.get("terpene_dominant") or "",
            (n.get("notes_generales") or "").replace("\n", " "),
        ])

    filename = f"classement_varietes_{date.today().isoformat()}.csv"
    return StreamingResponse(
        iter(["﻿" + output.getvalue()]),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


# ── CRUD notations ────────────────────────────────────────────────────────────

def _find_by_name(db: Session, nom: str) -> Optional[NotationVariete]:
    k = _key(nom)
    for n in db.query(NotationVariete).all():
        if _key(n.nom_variete) == k:
            return n
    return None


@router.get("/", response_model=list[NotationRead])
def list_notations(db: Session = Depends(get_db)):
    """Toutes les notations, triées par note moyenne décroissante."""
    result = [_to_read(n) for n in db.query(NotationVariete).all()]
    result.sort(key=lambda x: (x["note_moyenne"] is None, -(x["note_moyenne"] or 0)))
    return result


@router.post("/", response_model=NotationRead, status_code=201)
def create_notation(payload: NotationCreate, db: Session = Depends(get_db)):
    """Crée la notation d'une variété, ou met à jour celle qui existe déjà (une notation par variété)."""
    data = payload.model_dump()
    data["nom_variete"] = " ".join((payload.nom_variete or "").split())
    if not data["nom_variete"]:
        raise HTTPException(status_code=422, detail="Nom de variété obligatoire")
    n = _find_by_name(db, data["nom_variete"])
    if n is None:
        n = NotationVariete(nom_variete=data["nom_variete"])
        db.add(n)
    for f in FIELDS:
        if f != "nom_variete":
            setattr(n, f, data.get(f))
    if not n.date_notation:
        n.date_notation = date.today()
    n.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(n)
    return _to_read(n)


@router.get("/{notation_id}", response_model=NotationRead)
def get_notation(notation_id: int, db: Session = Depends(get_db)):
    n = db.query(NotationVariete).filter(NotationVariete.id_notation == notation_id).first()
    if not n:
        raise HTTPException(status_code=404, detail="Notation introuvable")
    return _to_read(n)


@router.put("/{notation_id}", response_model=NotationRead)
def update_notation(notation_id: int, payload: NotationUpdate, db: Session = Depends(get_db)):
    n = db.query(NotationVariete).filter(NotationVariete.id_notation == notation_id).first()
    if not n:
        raise HTTPException(status_code=404, detail="Notation introuvable")
    # Seuls les champs envoyés sont modifiés (une note peut être remise à null = non notée)
    for f, v in payload.model_dump(exclude_unset=True).items():
        if f == "nom_variete" and not v:
            continue
        setattr(n, f, v)
    n.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(n)
    return _to_read(n)


@router.delete("/{notation_id}", status_code=204)
def delete_notation(notation_id: int, db: Session = Depends(get_db)):
    n = db.query(NotationVariete).filter(NotationVariete.id_notation == notation_id).first()
    if not n:
        raise HTTPException(status_code=404, detail="Notation introuvable")
    db.delete(n)
    db.commit()
