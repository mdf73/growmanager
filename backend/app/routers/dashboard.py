"""Router pour le Dashboard"""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime, timedelta, date as date_type
from typing import Optional
from app.database import get_db
from app.models import Plant, Stock, Culture, RosinExtraction, Graine, PackGraine, ActionCalendrier, Box, GoveeDevice, TemperatureLog, SessionSechage, HistoriqueCulture, HistoriquePlant
from pydantic import BaseModel

router = APIRouter(prefix="/api", tags=["dashboard"])


class DashboardStats(BaseModel):
    """Statistiques du dashboard (legacy)"""
    plants_actifs: int
    stock_total_g: float
    cultures_en_cours: int
    ratio_moyen_extraction: float
    derniers_extractions: list


class DashboardFullStats(BaseModel):
    # Module 1 -- Cultures actives
    nb_cultures_actives: int
    nb_plants_veg: int
    nb_plants_flo: int
    veg_jours_min: Optional[int] = None
    veg_jours_max: Optional[int] = None
    flo_jours_min: Optional[int] = None
    flo_jours_max: Optional[int] = None
    harvest_restant_jours_min: Optional[int] = None
    harvest_restant_jours_max: Optional[int] = None
    # Module 2 -- Sechage
    nb_plants_sechage: int
    sechage_jours_min: Optional[int] = None
    sechage_jours_max: Optional[int] = None
    # Module 3 -- Curing
    nb_plants_curing: int
    curing_jours_min: Optional[int] = None
    curing_jours_max: Optional[int] = None
    # Module 4 -- Stock
    stock_total_g: float
    stock_herbe_g: float
    stock_hash_g: float
    stock_rosin_g: float
    # Module 5 -- Production
    production_annee_g: float
    production_mois_g: float
    production_30j_g: float
    nb_recoltes_annee: int
    # Module 6 -- Graines
    graines_disponibles: int
    graines_regulieres: int
    graines_feminisees: int
    nb_varietes_graines: int
    valeur_graines_eur: Optional[float] = None
    # Module 2 extra -- Sechage ambiance
    sechage_temp_moy: Optional[float] = None
    sechage_hum_moy: Optional[float] = None
    # Module 3 extra -- Curing bocal
    curing_jours_bocal: Optional[int] = None


class BoxArrosageStats(BaseModel):
    """Stats d'arrosage par culture active (module dashboard)"""
    id_culture: int
    culture_nom: str
    box_label: Optional[str] = None
    derniere_arrosage: Optional[date_type] = None
    jours_depuis_arrosage: Optional[int] = None


def _minmax(lst: list):
    if not lst:
        return None, None
    return min(lst), max(lst)


@router.get("/dashboard/stats", response_model=DashboardFullStats)
def get_dashboard_stats(db: Session = Depends(get_db)):
    """Statistiques completes pour le nouveau dashboard"""
    today = date_type.today()

    # Module 1 : Cultures actives
    nb_cultures_actives = db.query(func.count(Culture.id_culture)).filter(
        Culture.statut == 'active'
    ).scalar() or 0

    plants_veg = db.query(Plant).filter(Plant.statut == 'veg').all()
    plants_flo = db.query(Plant).filter(Plant.statut == 'floraison').all()

    veg_days = [
        (today - p.date_germination).days
        for p in plants_veg if p.date_germination
    ]

    flo_days = []
    hrv_remaining_min_list = []
    hrv_remaining_max_list = []
    for p in plants_flo:
        if p.date_debut_flo:
            elapsed = (today - p.date_debut_flo).days
            flo_days.append(elapsed)
            if p.id_graine:
                g = db.query(Graine).filter(Graine.id_graine == p.id_graine).first()
                if g:
                    if g.duree_flo_min:
                        hrv_remaining_min_list.append(int(g.duree_flo_min) - elapsed)
                    if g.duree_flo_max:
                        hrv_remaining_max_list.append(int(g.duree_flo_max) - elapsed)

    veg_min, veg_max = _minmax(veg_days)
    flo_min, flo_max = _minmax(flo_days)
    hrv_min = min(hrv_remaining_min_list) if hrv_remaining_min_list else None
    hrv_max = max(hrv_remaining_max_list) if hrv_remaining_max_list else None

    # Module 2 : Sechage
    plants_sechage = db.query(Plant).filter(Plant.statut == 'sechage').all()
    sechage_days = [
        (today - p.date_recolte).days
        for p in plants_sechage if p.date_recolte
    ]
    sech_min, sech_max = _minmax(sechage_days)

    # Module 3 : Curing
    plants_curing = db.query(Plant).filter(Plant.statut == 'curing').all()
    curing_days = [
        (today - p.date_fin_sechage).days
        for p in plants_curing if p.date_fin_sechage
    ]
    cur_min, cur_max = _minmax(curing_days)

    # Module 4 : Stock (Trim et WPFF exclus \u2014 rang\u00e9s dans Extractions)
    EXTRACTION_TYPES = {'Trim', 'WPFF'}
    stocks = db.query(Stock).all()
    stocks_only = [s for s in stocks if s.type_stock not in EXTRACTION_TYPES]
    HERBE_TYPES = {'Fleur', 'Poussi\u00e8re'}
    stock_total = sum(float(s.quantite_stock or 0) for s in stocks_only)
    stock_herbe = sum(float(s.quantite_stock or 0) for s in stocks_only if s.type_stock in HERBE_TYPES)
    stock_hash  = sum(float(s.quantite_stock or 0) for s in stocks_only if s.type_stock == 'Hash')
    stock_rosin = sum(float(s.quantite_stock or 0) for s in stocks_only if s.type_stock == 'Rosin')

    # Module 5 : Production
    # Base sur l'historique de production : date_fin de HistoriqueCulture
    # determine l'annee/mois de recolte ; somme de quantite_recoltee des HistoriquePlant.
    debut_annee = today.replace(month=1, day=1)
    debut_mois  = today.replace(day=1)
    debut_30j   = today - timedelta(days=30)
    fin_annee   = today.replace(month=12, day=31)

    def _sum_recolte_historique(cultures):
        total = 0.0
        for c in cultures:
            for p in c.plants:
                if p.quantite_recoltee is not None:
                    total += float(p.quantite_recoltee)
        return total

    cultures_annee = db.query(HistoriqueCulture).filter(
        HistoriqueCulture.date_fin.isnot(None),
        HistoriqueCulture.date_fin >= debut_annee,
        HistoriqueCulture.date_fin <= fin_annee,
    ).all()

    cultures_mois = db.query(HistoriqueCulture).filter(
        HistoriqueCulture.date_fin.isnot(None),
        HistoriqueCulture.date_fin >= debut_mois,
        HistoriqueCulture.date_fin <= today,
    ).all()

    cultures_30j = db.query(HistoriqueCulture).filter(
        HistoriqueCulture.date_fin.isnot(None),
        HistoriqueCulture.date_fin >= debut_30j,
        HistoriqueCulture.date_fin <= today,
    ).all()

    prod_annee        = _sum_recolte_historique(cultures_annee)
    prod_mois         = _sum_recolte_historique(cultures_mois)
    prod_30j          = _sum_recolte_historique(cultures_30j)
    nb_recoltes_annee = len(cultures_annee)

    # Module 6 : Graines
    packs = db.query(PackGraine).all()
    graines_dispo = 0
    graines_fem   = 0
    graines_reg   = 0
    varietes_ids: set = set()
    valeur_total  = 0.0
    has_price     = False

    for pack in packs:
        remaining = db.query(func.count(Graine.id_graine)).filter(
            Graine.id_packgraine == pack.id_packgraine,
            (Graine.utilisee == False) | (Graine.utilisee == None),
        ).scalar() or 0

        if remaining == 0:
            continue

        graines_dispo += remaining

        first = db.query(Graine).filter(
            Graine.id_packgraine == pack.id_packgraine
        ).first()
        if first:
            t = (first.types_graines or '').strip().lower()
            if t == 'f\u00e9minis\u00e9e':
                graines_fem += remaining
            elif t == 'r\u00e9guli\u00e8re':
                graines_reg += remaining
            if first.id_variete:
                varietes_ids.add(first.id_variete)

        if pack.prix_achat and pack.nbr_graines:
            prix_par = float(pack.prix_achat) / pack.nbr_graines
            valeur_total += prix_par * remaining
            has_price = True

    nb_varietes = len(varietes_ids)
    valeur_graines: Optional[float] = round(valeur_total, 2) if has_price else None

    # Module 2 extra : T & Humidite
    sessions_sechage = db.query(SessionSechage).filter(SessionSechage.statut == 'active').all()
    espace_ids_sechage = {s.id_espace for s in sessions_sechage if s.id_espace is not None}

    temps, hums = [], []
    if espace_ids_sechage:
        sechage_devices = db.query(GoveeDevice).filter(
            GoveeDevice.actif == True,
            GoveeDevice.id_espace.in_(espace_ids_sechage),
        ).all()
        for dev in sechage_devices:
            last_log = (
                db.query(TemperatureLog)
                .filter(TemperatureLog.id_device == dev.id_device)
                .order_by(TemperatureLog.date_heure.desc())
                .first()
            )
            if last_log:
                if last_log.temperature is not None:
                    temps.append(float(last_log.temperature))
                if last_log.humidite is not None:
                    hums.append(float(last_log.humidite))
    sechage_temp_moy = round(sum(temps) / len(temps), 1) if temps else None
    sechage_hum_moy  = round(sum(hums)  / len(hums),  1) if hums  else None

    # Module 3 extra : Curing bocal
    curing_jours_bocal: Optional[int] = None
    if plants_curing:
        plant_ids_curing = [p.id_plant for p in plants_curing]
        ouv_actions = (
            db.query(ActionCalendrier)
            .filter(
                ActionCalendrier.id_plant.in_(plant_ids_curing),
                ActionCalendrier.type_action == 'ouverture_bocal',
            )
            .order_by(ActionCalendrier.date_action.desc())
            .all()
        )
        max_jours = 0
        for p in plants_curing:
            plant_ouv = next((a.date_action for a in ouv_actions if a.id_plant == p.id_plant), None)
            ref = plant_ouv if plant_ouv else p.date_fin_sechage
            if ref:
                jours_p = (today - ref).days
                if jours_p > max_jours:
                    max_jours = jours_p
        curing_jours_bocal = max_jours if plants_curing else None

    return DashboardFullStats(
        nb_cultures_actives=nb_cultures_actives,
        nb_plants_veg=len(plants_veg),
        nb_plants_flo=len(plants_flo),
        veg_jours_min=veg_min,
        veg_jours_max=veg_max,
        flo_jours_min=flo_min,
        flo_jours_max=flo_max,
        harvest_restant_jours_min=hrv_min,
        harvest_restant_jours_max=hrv_max,
        nb_plants_sechage=len(plants_sechage),
        sechage_jours_min=sech_min,
        sechage_jours_max=sech_max,
        nb_plants_curing=len(plants_curing),
        curing_jours_min=cur_min,
        curing_jours_max=cur_max,
        stock_total_g=round(stock_total, 1),
        stock_herbe_g=round(stock_herbe, 1),
        stock_hash_g=round(stock_hash, 1),
        stock_rosin_g=round(stock_rosin, 1),
        production_annee_g=round(prod_annee, 1),
        production_mois_g=round(prod_mois, 1),
        production_30j_g=round(prod_30j, 1),
        nb_recoltes_annee=nb_recoltes_annee,
        graines_disponibles=int(graines_dispo),
        graines_regulieres=graines_reg,
        graines_feminisees=graines_fem,
        nb_varietes_graines=nb_varietes,
        valeur_graines_eur=valeur_graines,
        sechage_temp_moy=sechage_temp_moy,
        sechage_hum_moy=sechage_hum_moy,
        curing_jours_bocal=curing_jours_bocal,
    )


@router.get("/dashboard/arrosage-boxes", response_model=list[BoxArrosageStats])
def get_arrosage_boxes(db: Session = Depends(get_db)):
    """Retourne pour chaque culture active la duree depuis le dernier arrosage."""
    today = date_type.today()
    TYPES_ARROSAGE = ('arrosage_eau', 'arrosage_engrais')

    cultures_actives = db.query(Culture).filter(Culture.statut == 'active').all()

    result = []
    for culture in cultures_actives:
        box_label: Optional[str] = None
        if culture.id_box:
            box = db.query(Box).filter(Box.id_box == culture.id_box).first()
            if box and box.largeur_tente and box.profondeur_tente and box.hauteur_tente:
                box_label = f"{box.largeur_tente}x{box.profondeur_tente}x{box.hauteur_tente} cm"

        last_action = (
            db.query(ActionCalendrier)
            .filter(
                ActionCalendrier.id_culture == culture.id_culture,
                ActionCalendrier.type_action.in_(TYPES_ARROSAGE),
            )
            .order_by(ActionCalendrier.date_action.desc())
            .first()
        )

        derniere_arrosage = last_action.date_action if last_action else None
        jours = (today - derniere_arrosage).days if derniere_arrosage else None

        result.append(BoxArrosageStats(
            id_culture=culture.id_culture,
            culture_nom=culture.nom or f"Culture #{culture.id_culture}",
            box_label=box_label,
            derniere_arrosage=derniere_arrosage,
            jours_depuis_arrosage=jours,
        ))

    result.sort(key=lambda x: (x.jours_depuis_arrosage is None, -(x.jours_depuis_arrosage or 0)))
    return result


@router.get("/dashboard", response_model=DashboardStats)
def get_dashboard(db: Session = Depends(get_db)):
    """Recupere les statistiques du dashboard (legacy)"""
    plants_actifs = db.query(func.count(Plant.id_plant)).filter(
        Plant.statut.in_(["germination", "veg", "floraison"])
    ).scalar() or 0

    stock_total = db.query(func.sum(Stock.quantite_stock)).filter(
        Stock.type_stock.notin_(['Trim', 'WPFF'])
    ).scalar() or 0

    cultures_en_cours = db.query(func.count(Culture.id_culture)).filter(
        Culture.statut == 'active'
    ).scalar() or 0

    extractions = db.query(RosinExtraction).all()
    if extractions:
        total_presse  = sum(float(e.quantite_utilisee or 0) for e in extractions)
        total_extrait = sum(float(e.quantite_extraite  or 0) for e in extractions)
        ratio_moyen   = (total_extrait / total_presse * 100) if total_presse > 0 else 0
    else:
        ratio_moyen = 0.0

    derniers_extractions = db.query(RosinExtraction).order_by(
        RosinExtraction.date_rosinextraction.desc()
    ).limit(5).all()

    extractions_data = [
        {
            "id":                e.id_rosinextraction,
            "variete":           e.nom_variete_extract,
            "quantite_utilisee": float(e.quantite_utilisee or 0),
            "quantite_extraite": float(e.quantite_extraite  or 0),
            "date":              e.date_rosinextraction.isoformat() if e.date_rosinextraction else None,
        }
        for e in derniers_extractions
    ]

    return DashboardStats(
        plants_actifs=plants_actifs,
        stock_total_g=float(stock_total),
        cultures_en_cours=cultures_en_cours,
        ratio_moyen_extraction=round(ratio_moyen, 2),
        derniers_extractions=extractions_data,
    )
