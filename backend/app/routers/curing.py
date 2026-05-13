"""Router SessionCuring — CRUD sessions de curing + gestion des plantes"""
from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.all_models import (
    SessionCuring, PlantCuring, Plant, Culture, Graine, Variete, EspaceCulture, Materiel,
)
from app.schemas.curing import (
    SessionCuringCreate, SessionCuringUpdate, SessionCuringRead,
    PlantCuringCreate, PlantCuringUpdate, PlantCuringRead,
)
from app.routers.culture_helpers import _maybe_close_culture, _maybe_archive_culture

router = APIRouter(prefix="/api/curing", tags=["curing"])


# ── Helpers ───────────────────────────────────────────────────────────────────

def _enrich_plant_curing(pc: PlantCuring, db: Session) -> PlantCuringRead:
    """Enrichit une ligne PlantCuring avec les infos de la plante d'origine."""
    plant = db.query(Plant).filter(Plant.id_plant == pc.id_plant).first()
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
    return PlantCuringRead(
        id_plant_curing=pc.id_plant_curing,
        id_plant=pc.id_plant,
        id_session_curing=pc.id_session_curing,
        date_mise_curing=pc.date_mise_curing,
        date_fin_curing=pc.date_fin_curing,
        poids_debut_g=float(pc.poids_debut_g) if pc.poids_debut_g else None,
        poids_final_g=float(pc.poids_final_g) if pc.poids_final_g else None,
        notes=pc.notes,
        nom_plant=plant.nom_affichage if plant else None,
        nom_variete=nom_variete,
        id_culture=id_culture,
        nom_culture=nom_culture,
        date_recolte=plant.date_recolte if plant else None,
    )


def _enrich_session(s: SessionCuring, db: Session) -> SessionCuringRead:
    plants_enriched = [_enrich_plant_curing(pc, db) for pc in s.plants]
    # Enrichir espace et bocal inventaire
    nom_espace = None
    if s.id_espace:
        esp = db.query(EspaceCulture).filter(EspaceCulture.id_espace == s.id_espace).first()
        nom_espace = esp.nom if esp else None
    nom_materiel_bocal = None
    if s.id_materiel_bocal:
        mat = db.query(Materiel).filter(Materiel.id_materiel == s.id_materiel_bocal).first()
        nom_materiel_bocal = mat.nom if mat else None
    return SessionCuringRead(
        id_session_curing=s.id_session_curing,
        nom=s.nom,
        type_contenant=s.type_contenant,
        volume_contenant_l=float(s.volume_contenant_l) if s.volume_contenant_l else None,
        boveda_rh=s.boveda_rh,
        id_espace=s.id_espace,
        id_materiel_bocal=s.id_materiel_bocal,
        nom_espace=nom_espace,
        nom_materiel_bocal=nom_materiel_bocal,
        statut=s.statut,
        date_debut=s.date_debut,
        date_fin=s.date_fin,
        notes=s.notes,
        created_at=s.created_at,
        nb_plants=len(plants_enriched),
        plants=plants_enriched,
    )


# ── CRUD Sessions ─────────────────────────────────────────────────────────────

@router.get("/", response_model=List[SessionCuringRead])
def list_sessions(statut: str = None, db: Session = Depends(get_db)):
    q = db.query(SessionCuring)
    if statut:
        q = q.filter(SessionCuring.statut == statut)
    sessions = q.order_by(SessionCuring.date_debut.desc()).all()
    return [_enrich_session(s, db) for s in sessions]


@router.get("/{id_session}", response_model=SessionCuringRead)
def get_session(id_session: int, db: Session = Depends(get_db)):
    s = db.query(SessionCuring).filter(SessionCuring.id_session_curing == id_session).first()
    if not s:
        raise HTTPException(404, "Session de curing introuvable")
    return _enrich_session(s, db)


@router.post("/", response_model=SessionCuringRead)
def create_session(payload: SessionCuringCreate, db: Session = Depends(get_db)):
    s = SessionCuring(
        nom=payload.nom,
        type_contenant=payload.type_contenant,
        volume_contenant_l=payload.volume_contenant_l,
        boveda_rh=payload.boveda_rh,
        id_espace=payload.id_espace,
        id_materiel_bocal=payload.id_materiel_bocal,
        date_debut=payload.date_debut,
        notes=payload.notes,
        statut="active",
    )
    db.add(s)
    db.flush()
    # Ajouter les plantes fournies
    cultures_a_verifier = set()
    for p in payload.plants:
        plant = db.query(Plant).filter(Plant.id_plant == p.id_plant).first()
        if not plant:
            raise HTTPException(404, f"Plant {p.id_plant} introuvable")
        pc = PlantCuring(
            id_plant=p.id_plant,
            id_session_curing=s.id_session_curing,
            date_mise_curing=p.date_mise_curing or payload.date_debut,
            poids_debut_g=p.poids_debut_g,
            poids_final_g=p.poids_final_g,
            notes=p.notes,
        )
        db.add(pc)
        # Mettre à jour le statut de la plante
        plant.statut = "curing"
        if plant.id_culture:
            cultures_a_verifier.add(plant.id_culture)
    db.flush()
    # Vérifier si les cultures concernées doivent être fermées / archivées
    for id_culture in cultures_a_verifier:
        culture = db.query(Culture).filter(Culture.id_culture == id_culture).first()
        if culture:
            _maybe_close_culture(culture, db)
            _maybe_archive_culture(culture, db)
    db.commit()
    db.refresh(s)
    return _enrich_session(s, db)


@router.put("/{id_session}", response_model=SessionCuringRead)
def update_session(id_session: int, payload: SessionCuringUpdate, db: Session = Depends(get_db)):
    s = db.query(SessionCuring).filter(SessionCuring.id_session_curing == id_session).first()
    if not s:
        raise HTTPException(404, "Session de curing introuvable")
    for field, val in payload.model_dump(exclude_unset=True).items():
        setattr(s, field, val)
    db.commit()
    db.refresh(s)
    return _enrich_session(s, db)


@router.delete("/{id_session}")
def delete_session(id_session: int, db: Session = Depends(get_db)):
    s = db.query(SessionCuring).filter(SessionCuring.id_session_curing == id_session).first()
    if not s:
        raise HTTPException(404, "Session de curing introuvable")
    db.delete(s)
    db.commit()
    return {"ok": True}


# ── CRUD Plantes dans une session ─────────────────────────────────────────────

@router.post("/{id_session}/plants", response_model=PlantCuringRead)
def add_plant_to_session(id_session: int, payload: PlantCuringCreate, db: Session = Depends(get_db)):
    s = db.query(SessionCuring).filter(SessionCuring.id_session_curing == id_session).first()
    if not s:
        raise HTTPException(404, "Session de curing introuvable")
    plant = db.query(Plant).filter(Plant.id_plant == payload.id_plant).first()
    if not plant:
        raise HTTPException(404, f"Plant {payload.id_plant} introuvable")
    # Vérifier que la plante n'est pas déjà dans une session de curing active
    existing = db.query(PlantCuring).filter(
        PlantCuring.id_plant == payload.id_plant,
        PlantCuring.date_fin_curing.is_(None),
    ).first()
    if existing:
        raise HTTPException(400, f"Plant {payload.id_plant} est déjà en curing (session #{existing.id_session_curing})")
    pc = PlantCuring(
        id_plant=payload.id_plant,
        id_session_curing=id_session,
        date_mise_curing=payload.date_mise_curing or s.date_debut,
        poids_debut_g=payload.poids_debut_g,
        poids_final_g=payload.poids_final_g,
        notes=payload.notes,
    )
    db.add(pc)
    plant.statut = "curing"
    db.flush()
    # Vérifier si la culture doit être fermée / archivée
    if plant.id_culture:
        culture = db.query(Culture).filter(Culture.id_culture == plant.id_culture).first()
        if culture:
            _maybe_close_culture(culture, db)
            _maybe_archive_culture(culture, db)
    db.commit()
    db.refresh(pc)
    return _enrich_plant_curing(pc, db)


@router.put("/{id_session}/plants/{id_plant_curing}", response_model=PlantCuringRead)
def update_plant_curing(id_session: int, id_plant_curing: int, payload: PlantCuringUpdate, db: Session = Depends(get_db)):
    pc = db.query(PlantCuring).filter(
        PlantCuring.id_plant_curing == id_plant_curing,
        PlantCuring.id_session_curing == id_session,
    ).first()
    if not pc:
        raise HTTPException(404, "Entrée de curing introuvable")
    for field, val in payload.model_dump(exclude_unset=True).items():
        setattr(pc, field, val)
    # Si date de fin → marquer la plante comme prête
    if payload.date_fin_curing:
        plant = db.query(Plant).filter(Plant.id_plant == pc.id_plant).first()
        if plant:
            plant.statut = "prete"
            if payload.poids_final_g:
                plant.poids_recolte_g = payload.poids_final_g
    db.commit()
    db.refresh(pc)
    return _enrich_plant_curing(pc, db)


@router.delete("/{id_session}/plants/{id_plant_curing}")
def remove_plant_from_session(id_session: int, id_plant_curing: int, db: Session = Depends(get_db)):
    pc = db.query(PlantCuring).filter(
        PlantCuring.id_plant_curing == id_plant_curing,
        PlantCuring.id_session_curing == id_session,
    ).first()
    if not pc:
        raise HTTPException(404, "Entrée de curing introuvable")
    db.delete(pc)
    db.commit()
    return {"ok": True}
