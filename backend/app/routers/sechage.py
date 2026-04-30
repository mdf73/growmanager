"""Router SessionSechage — CRUD sessions de séchage + gestion des plantes"""
from datetime import date
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.all_models import (
    SessionSechage, PlantSechage, Plant, Culture, EspaceCulture, Graine, Variete,
    ActionCalendrier,
)
from app.models import Stock
from app.schemas.sechage import (
    SessionSechageCreate, SessionSechageUpdate, SessionSechageRead,
    PlantSechageCreate, PlantSechageUpdate, PlantSechageRead,
)

router = APIRouter(prefix="/api/sechage", tags=["sechage"])


# ── Helpers ───────────────────────────────────────────────────────────────────

def _enrich_plant_sechage(ps: PlantSechage, db: Session) -> PlantSechageRead:
    """Enrichit une ligne PlantSechage avec les infos de la plante d'origine."""
    plant = db.query(Plant).filter(Plant.id_plant == ps.id_plant).first()
    nom_variete = None
    id_culture = None
    nom_culture = None
    if plant:
        id_culture = plant.id_culture
        culture = db.query(Culture).filter(Culture.id_culture == plant.id_culture).first()
        nom_culture = culture.nom if culture else None
        if plant.id_graine:
            graine = db.query(Graine).filter(Graine.id_graine == plant.id_graine).first()
            if graine and graine.id_variete:
                variete = db.query(Variete).filter(Variete.id_variete == graine.id_variete).first()
                nom_variete = variete.nom_variete if variete else None
    return PlantSechageRead(
        id_plant_sechage=ps.id_plant_sechage,
        id_plant=ps.id_plant,
        id_session_sechage=ps.id_session_sechage,
        date_mise_sechage=ps.date_mise_sechage,
        date_fin_sechage=ps.date_fin_sechage,
        poids_humide_g=float(ps.poids_humide_g) if ps.poids_humide_g else None,
        poids_sec_g=float(ps.poids_sec_g) if ps.poids_sec_g else None,
        notes=ps.notes,
        nom_plant=plant.nom_affichage if plant else None,
        nom_variete=nom_variete,
        id_culture=id_culture,
        nom_culture=nom_culture,
    )


def _enrich_session(s: SessionSechage, db: Session) -> SessionSechageRead:
    espace = db.query(EspaceCulture).filter(EspaceCulture.id_espace == s.id_espace).first() if s.id_espace else None
    plants_enriched = [_enrich_plant_sechage(ps, db) for ps in s.plants]
    return SessionSechageRead(
        id_session_sechage=s.id_session_sechage,
        id_espace=s.id_espace,
        nom_espace=espace.nom if espace else None,
        nom=s.nom,
        methode_sechage=s.methode_sechage,
        temperature_cible=s.temperature_cible,
        humidite_cible=s.humidite_cible,
        statut=s.statut,
        date_debut=s.date_debut,
        date_fin=s.date_fin,
        notes=s.notes,
        created_at=s.created_at,
        nb_plants=len(plants_enriched),
        plants=plants_enriched,
    )


# ── CRUD Sessions ─────────────────────────────────────────────────────────────

@router.get("/", response_model=List[SessionSechageRead])
def list_sessions(statut: str = None, db: Session = Depends(get_db)):
    q = db.query(SessionSechage)
    if statut:
        q = q.filter(SessionSechage.statut == statut)
    sessions = q.order_by(SessionSechage.date_debut.desc()).all()
    return [_enrich_session(s, db) for s in sessions]


@router.get("/{id_session}", response_model=SessionSechageRead)
def get_session(id_session: int, db: Session = Depends(get_db)):
    s = db.query(SessionSechage).filter(SessionSechage.id_session_sechage == id_session).first()
    if not s:
        raise HTTPException(404, "Session de séchage introuvable")
    return _enrich_session(s, db)


@router.post("/", response_model=SessionSechageRead)
def create_session(payload: SessionSechageCreate, db: Session = Depends(get_db)):
    s = SessionSechage(
        id_espace=payload.id_espace,
        nom=payload.nom,
        methode_sechage=payload.methode_sechage,
        temperature_cible=payload.temperature_cible,
        humidite_cible=payload.humidite_cible,
        date_debut=payload.date_debut,
        notes=payload.notes,
        statut="active",
    )
    db.add(s)
    db.flush()
    # Ajouter les plantes fournies
    for p in payload.plants:
        plant = db.query(Plant).filter(Plant.id_plant == p.id_plant).first()
        if not plant:
            raise HTTPException(404, f"Plant {p.id_plant} introuvable")
        ps = PlantSechage(
            id_plant=p.id_plant,
            id_session_sechage=s.id_session_sechage,
            date_mise_sechage=p.date_mise_sechage or payload.date_debut,
            poids_humide_g=p.poids_humide_g,
            poids_sec_g=p.poids_sec_g,
            notes=p.notes,
        )
        db.add(ps)
        # Mettre à jour le statut de la plante
        plant.statut = "sechage"
        if p.date_mise_sechage or payload.date_debut:
            plant.date_recolte = p.date_mise_sechage or payload.date_debut
    db.commit()
    db.refresh(s)
    return _enrich_session(s, db)


@router.put("/{id_session}", response_model=SessionSechageRead)
def update_session(id_session: int, payload: SessionSechageUpdate, db: Session = Depends(get_db)):
    s = db.query(SessionSechage).filter(SessionSechage.id_session_sechage == id_session).first()
    if not s:
        raise HTTPException(404, "Session de séchage introuvable")
    for field, val in payload.model_dump(exclude_unset=True).items():
        setattr(s, field, val)
    db.commit()
    db.refresh(s)
    return _enrich_session(s, db)


@router.delete("/{id_session}")
def delete_session(id_session: int, db: Session = Depends(get_db)):
    s = db.query(SessionSechage).filter(SessionSechage.id_session_sechage == id_session).first()
    if not s:
        raise HTTPException(404, "Session de séchage introuvable")
    db.delete(s)
    db.commit()
    return {"ok": True}


# ── CRUD Plantes dans une session ─────────────────────────────────────────────

@router.post("/{id_session}/plants", response_model=PlantSechageRead)
def add_plant_to_session(id_session: int, payload: PlantSechageCreate, db: Session = Depends(get_db)):
    s = db.query(SessionSechage).filter(SessionSechage.id_session_sechage == id_session).first()
    if not s:
        raise HTTPException(404, "Session de séchage introuvable")
    plant = db.query(Plant).filter(Plant.id_plant == payload.id_plant).first()
    if not plant:
        raise HTTPException(404, f"Plant {payload.id_plant} introuvable")
    # Vérifier que la plante n'est pas déjà dans une session de séchage active
    existing = db.query(PlantSechage).filter(
        PlantSechage.id_plant == payload.id_plant,
        PlantSechage.date_fin_sechage.is_(None),
    ).first()
    if existing:
        raise HTTPException(400, f"Plant {payload.id_plant} est déjà en séchage (session #{existing.id_session_sechage})")
    ps = PlantSechage(
        id_plant=payload.id_plant,
        id_session_sechage=id_session,
        date_mise_sechage=payload.date_mise_sechage or s.date_debut,
        poids_humide_g=payload.poids_humide_g,
        poids_sec_g=payload.poids_sec_g,
        notes=payload.notes,
    )
    db.add(ps)
    plant.statut = "sechage"
    if payload.date_mise_sechage or s.date_debut:
        plant.date_recolte = payload.date_mise_sechage or s.date_debut
    db.commit()
    db.refresh(ps)
    return _enrich_plant_sechage(ps, db)


@router.put("/{id_session}/plants/{id_plant_sechage}", response_model=PlantSechageRead)
def update_plant_sechage(id_session: int, id_plant_sechage: int, payload: PlantSechageUpdate, db: Session = Depends(get_db)):
    ps = db.query(PlantSechage).filter(
        PlantSechage.id_plant_sechage == id_plant_sechage,
        PlantSechage.id_session_sechage == id_session,
    ).first()
    if not ps:
        raise HTTPException(404, "Entrée de séchage introuvable")
    for field, val in payload.model_dump(exclude_unset=True).items():
        setattr(ps, field, val)
    # Si on renseigne la date de fin → mettre à jour le statut de la plante
    if payload.date_fin_sechage:
        plant = db.query(Plant).filter(Plant.id_plant == ps.id_plant).first()
        if plant:
            plant.date_fin_sechage = payload.date_fin_sechage
            if payload.poids_sec_g:
                plant.poids_recolte_g = payload.poids_sec_g
    db.commit()
    db.refresh(ps)
    return _enrich_plant_sechage(ps, db)


@router.delete("/{id_session}/plants/{id_plant_sechage}")
def remove_plant_from_session(id_session: int, id_plant_sechage: int, db: Session = Depends(get_db)):
    ps = db.query(PlantSechage).filter(
        PlantSechage.id_plant_sechage == id_plant_sechage,
        PlantSechage.id_session_sechage == id_session,
    ).first()
    if not ps:
        raise HTTPException(404, "Entrée de séchage introuvable")
    db.delete(ps)
    db.commit()
    return {"ok": True}


# ── WPFF (Whole Plant Fresh Frozen) ──────────────────────────────────────────

class WpffPayload(BaseModel):
    poids_g: Optional[float] = None  # optionnel
    date_action: Optional[str] = None  # format YYYY-MM-DD, défaut = aujourd'hui


@router.post("/plants/{id_plant}/wpff")
def passer_en_wpff(id_plant: int, payload: WpffPayload, db: Session = Depends(get_db)):
    """
    Passe une plante en séchage directement en WPFF (congélateur) :
    - Statut plant → 'wpff'
    - Crée une entrée Stock type_stock='WPFF'
    - Log une ActionCalendrier type_action='wpff'
    - Clôt la session de séchage associée si elle existe
    """
    plant = db.query(Plant).filter(Plant.id_plant == id_plant).first()
    if not plant:
        raise HTTPException(404, "Plante introuvable")
    if plant.statut != "sechage":
        raise HTTPException(400, f"La plante est en statut '{plant.statut}', elle doit être en 'sechage' pour passer en WPFF")

    today = date.today()
    action_date = date.fromisoformat(payload.date_action) if payload.date_action else today

    # Récupérer id_variete via graine
    id_variete = None
    if plant.id_graine:
        graine = db.query(Graine).filter(Graine.id_graine == plant.id_graine).first()
        if graine:
            id_variete = graine.id_variete

    # 1. Changer le statut de la plante
    plant.statut = "wpff"

    # 2. Clore la session de séchage associée (date_fin_sechage sur PlantSechage)
    ps = db.query(PlantSechage).filter(
        PlantSechage.id_plant == id_plant,
        PlantSechage.date_fin_sechage.is_(None),
    ).first()
    if ps:
        ps.date_fin_sechage = action_date
        if payload.poids_g:
            ps.poids_sec_g = payload.poids_g

    # 3. Créer l'entrée Stock WPFF
    stock = Stock(
        id_variete=id_variete,
        type_stock="WPFF",
        date_stock=action_date,
        quantite_stock=payload.poids_g or 0.0,
    )
    db.add(stock)

    # 4. Logger l'action dans le calendrier
    action = ActionCalendrier(
        id_culture=plant.id_culture,
        id_plant=plant.id_plant,
        date_action=action_date,
        type_action="wpff",
        parametres={"poids_g": payload.poids_g} if payload.poids_g else {},
    )
    db.add(action)

    db.commit()
    db.refresh(stock)
    return {"ok": True, "id_stock": stock.id_stock, "quantite_g": stock.quantite_stock}
