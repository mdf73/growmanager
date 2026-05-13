"""Router pour le Dashboard"""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime, timedelta, date as date_type
from typing import Optional
from app.database import get_db
from app.models import Plant, Stock, Culture, RosinExtraction, Graine, PackGraine, ActionCalendrier, Box, GoveeDevice, TemperatureLog, SessionSechage, SessionCuring, PlantCuring, HistoriqueCulture, HistoriquePlant
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
    date_debut_flush: Optional[date_type] = None
    jours_flush: Optional[int] = None


class BurpingReminder(BaseModel):
    """Rappel d'ouverture bocal pour une session de curing active."""
    id_session_curing: int
    nom: str
    type_contenant: Optional[str] = None
    date_debut: Optional[date_type] = None
    jours_curing: int
    derniere_ouverture: Optional[date_type] = None
    jours_depuis_ouverture: int
    frequence_recommandee_j: int   # 1 | 3 | 7 | 14
    frequence_label: str           # "1x/jour" | "1x/3j" | "1x/7j" | "1x/2sem"
    a_ouvrir_aujourd_hui: bool
    nb_plantes: int


def _get_burp_frequency(jours_curing: int) -> tuple[int, str]:
    """Retourne (fenetre_j, label) selon l'age du curing.
    Aligne sur bocalBurpWindow() dans SechageCuring.tsx :
      J0-7   -> 1j  (chaque jour)
      J8-14  -> 3j  (tous les 2-3j)
      J15-28 -> 7j  (toutes les sem.)
      J29+   -> 14j (toutes les 2 sem.)
    """
    if jours_curing <= 7:
        return 1, "1x/jour"
    elif jours_curing <= 14:
        return 3, "1x/3j"
    elif jours_curing <= 28:
        return 7, "1x/7j"
    else:
        return 14, "1x/2sem"


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

    # Module 4 : Stock (Trim et WPFF exclus — rangés dans Extractions)
    EXTRACTION_TYPES = {'Trim', 'WPFF'}
    stocks = db.query(Stock).all()
    stocks_only = [s for s in stocks if s.type_stock not in EXTRACTION_TYPES]
    HERBE_TYPES = {'Fleur', 'Poussière'}
    stock_total = sum(float(s.quantite_stock or 0) for s in stocks_only)
    stock_herbe = sum(float(s.quantite_stock or 0) for s in stocks_only if s.type_stock in HERBE_TYPES)
    stock_hash  = sum(float(s.quantite_stock or 0) for s in stocks_only if s.type_stock == 'Hash')
    stock_rosin = sum(float(s.quantite_stock or 0) for s in stocks_only if s.type_stock == 'Rosin')

    # Module 5 : Production
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
            if t == 'féminisée':
                graines_fem += remaining
            elif t == 'régulière':
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

        date_flush = getattr(culture, 'date_debut_flush', None)
        jours_flush = (today - date_flush).days if date_flush else None

        result.append(BoxArrosageStats(
            id_culture=culture.id_culture,
            culture_nom=culture.nom or f"Culture #{culture.id_culture}",
            box_label=box_label,
            derniere_arrosage=derniere_arrosage,
            jours_depuis_arrosage=jours,
            date_debut_flush=date_flush,
            jours_flush=jours_flush,
        ))

    result.sort(key=lambda x: (x.jours_depuis_arrosage is None, -(x.jours_depuis_arrosage or 0)))
    return result


@router.get("/dashboard/burping-reminders", response_model=list[BurpingReminder])
def get_burping_reminders(db: Session = Depends(get_db)):
    """Rappels d'ouverture bocaux (burping) pour toutes les sessions de curing actives."""
    today = date_type.today()

    sessions = db.query(SessionCuring).filter(SessionCuring.statut == 'active').all()
    result = []

    for session in sessions:
        # Nombre de jours depuis le debut du curing
        jours_curing = (today - session.date_debut).days if session.date_debut else 0

        # Plantes dans cette session
        plant_curings = db.query(PlantCuring).filter(
            PlantCuring.id_session_curing == session.id_session_curing
        ).all()
        plant_ids = [pc.id_plant for pc in plant_curings]
        nb_plantes = len(plant_ids)

        # Derniere ouverture bocal pour cette session (n'importe quelle plante)
        derniere_ouverture: Optional[date_type] = None
        if plant_ids:
            last_action = (
                db.query(ActionCalendrier)
                .filter(
                    ActionCalendrier.id_plant.in_(plant_ids),
                    ActionCalendrier.type_action == 'ouverture_bocal',
                )
                .order_by(ActionCalendrier.date_action.desc())
                .first()
            )
            if last_action:
                derniere_ouverture = last_action.date_action

        # Reference pour le delai : derniere ouverture ou date de debut
        ref_date = derniere_ouverture if derniere_ouverture else session.date_debut
        jours_depuis_ouverture = (today - ref_date).days if ref_date else 0

        # Frequence recommandee (alignee sur bocalBurpWindow dans SechageCuring.tsx)
        frequence_j, frequence_label = _get_burp_frequency(jours_curing)

        # A ouvrir aujourd'hui si jours depuis derniere ouverture >= fenetre recommandee
        a_ouvrir = jours_depuis_ouverture >= frequence_j

        result.append(BurpingReminder(
            id_session_curing=session.id_session_curing,
            nom=session.nom or f"Session #{session.id_session_curing}",
            type_contenant=session.type_contenant,
            date_debut=session.date_debut,
            jours_curing=jours_curing,
            derniere_ouverture=derniere_ouverture,
            jours_depuis_ouverture=jours_depuis_ouverture,
            frequence_recommandee_j=frequence_j,
            frequence_label=frequence_label,
            a_ouvrir_aujourd_hui=a_ouvrir,
            nb_plantes=nb_plantes,
        ))

    # Tri : urgents en premier, puis par anciennete de curing
    result.sort(key=lambda x: (not x.a_ouvrir_aujourd_hui, -x.jours_depuis_ouverture))
    return result


class IpmWarning(BaseModel):
    """Avertissement IPM : traitement actif dont le délai avant récolte n'est pas écoulé."""
    id_action: int
    id_culture: int
    culture_nom: str
    id_plant: Optional[int] = None
    plant_nom: Optional[str] = None
    date_traitement: date_type
    produit: Optional[str] = None
    dose: Optional[float] = None
    methode: Optional[str] = None
    delai_recolte_j: int          # délai total en jours (saisi lors du traitement)
    jours_ecoules: int            # jours depuis la date du traitement
    jours_restants: int           # jours restants avant fin du délai
    alerte_rouge: bool            # True si < 7j restants avant fin du délai


@router.get("/dashboard/ipm-warnings", response_model=list[IpmWarning])
def get_ipm_warnings(db: Session = Depends(get_db)):
    """Retourne les traitements IPM dont le délai avant récolte n'est pas encore écoulé.
    Seules les actions de type 'traitement' avec un champ 'delai_recolte_j' dans
    les parametres JSON sont prises en compte."""
    today = date_type.today()

    # Récupère toutes les actions de type traitement ayant un délai renseigné
    actions = (
        db.query(ActionCalendrier)
        .filter(ActionCalendrier.type_action == 'traitement')
        .order_by(ActionCalendrier.date_action.desc())
        .all()
    )

    result = []
    for action in actions:
        params = action.parametres or {}
        raw_delai = params.get('delai_recolte_j')
        if raw_delai is None:
            continue
        try:
            delai_j = int(raw_delai)
        except (ValueError, TypeError):
            continue
        if delai_j <= 0:
            continue

        jours_ecoules = (today - action.date_action).days
        jours_restants = delai_j - jours_ecoules

        # On n'affiche que les traitements dont le délai n'est pas encore écoulé
        if jours_restants <= 0:
            continue

        # Infos culture
        culture = db.query(Culture).filter(Culture.id_culture == action.id_culture).first()
        culture_nom = (culture.nom if culture else None) or f"Culture #{action.id_culture}"

        # Infos plante (si traitement ciblé)
        plant_nom: Optional[str] = None
        if action.id_plant:
            plant = db.query(Plant).filter(Plant.id_plant == action.id_plant).first()
            if plant:
                plant_nom = plant.nom_affichage

        result.append(IpmWarning(
            id_action=action.id_action,
            id_culture=action.id_culture,
            culture_nom=culture_nom,
            id_plant=action.id_plant,
            plant_nom=plant_nom,
            date_traitement=action.date_action,
            produit=params.get('produit'),
            dose=float(params['dose']) if params.get('dose') is not None else None,
            methode=params.get('methode'),
            delai_recolte_j=delai_j,
            jours_ecoules=jours_ecoules,
            jours_restants=jours_restants,
            alerte_rouge=jours_restants < 7,
        ))

    # Urgents en premier
    result.sort(key=lambda x: x.jours_restants)
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
