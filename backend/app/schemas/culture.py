"""Schemas Pydantic pour Culture, Plant et ActionCalendrier — V2 complète"""
from pydantic import BaseModel, ConfigDict
from typing import Optional, Any
from datetime import date, datetime


# ═══════════════════════════════════════════════════════════════════════════════
# PLANT
# ═══════════════════════════════════════════════════════════════════════════════

class PlantCreate(BaseModel):
    id_graine: Optional[int] = None
    nom_affichage: str
    numero_plant: Optional[int] = None
    origine: str = "graine"          # graine | bouture | clone
    statut: str = "germination"      # germination | veg | floraison | sechage | recolte | abandonne
    date_germination: Optional[date] = None
    date_debut_flo: Optional[date] = None
    date_recolte: Optional[date] = None
    date_fin_sechage: Optional[date] = None
    poids_recolte_g: Optional[float] = None
    notes: Optional[str] = None


class PlantUpdate(BaseModel):
    nom_affichage: Optional[str] = None
    statut: Optional[str] = None
    date_germination: Optional[date] = None
    date_debut_flo: Optional[date] = None
    date_recolte: Optional[date] = None
    date_fin_sechage: Optional[date] = None
    poids_recolte_g: Optional[float] = None
    substrat: Optional[str] = None
    id_recette_sol: Optional[int] = None
    id_pot: Optional[int] = None
    volume_pot_l: Optional[float] = None
    notes: Optional[str] = None


class PlantRead(BaseModel):
    id_plant: int
    id_culture: int
    id_graine: Optional[int] = None
    nom_affichage: str
    numero_plant: Optional[int] = None
    origine: Optional[str] = None
    statut: Optional[str] = None
    date_germination: Optional[date] = None
    date_debut_flo: Optional[date] = None
    date_recolte: Optional[date] = None
    date_fin_sechage: Optional[date] = None
    poids_recolte_g: Optional[float] = None
    substrat: Optional[str] = None
    id_recette_sol: Optional[int] = None
    nom_recette_sol: Optional[str] = None    # enrichi
    id_pot: Optional[int] = None
    taille_pot: Optional[int] = None         # enrichi depuis Pot
    volume_pot_l: Optional[float] = None
    notes: Optional[str] = None
    # Champs enrichis variété
    nom_variete: Optional[str] = None
    nom_breeder: Optional[str] = None
    duree_flo_min: Optional[int] = None
    duree_flo_max: Optional[int] = None

    model_config = ConfigDict(from_attributes=True)


# ═══════════════════════════════════════════════════════════════════════════════
# TRANSFERT PLANTE
# ═══════════════════════════════════════════════════════════════════════════════

class PlantTransferPayload(BaseModel):
    """Déplacer une plante vers une culture existante OU vers un espace disponible
    (dans ce cas une nouvelle culture y est créée automatiquement)."""
    target_culture_id: Optional[int] = None   # culture active existante
    target_espace_id: Optional[int] = None    # espace sans culture → crée une nouvelle culture


# ═══════════════════════════════════════════════════════════════════════════════
# ACTION CALENDRIER
# ═══════════════════════════════════════════════════════════════════════════════

class ActionCreate(BaseModel):
    id_plant: Optional[int] = None       # None → global_culture=True
    date_action: date
    type_action: str                     # ex: 'graine_verre_eau', 'mise_sous_led', 'arrosage_engrais'…
    parametres: Optional[dict[str, Any]] = None
    note: Optional[str] = None
    global_culture: bool = False
    space_only: bool = False             # True → enregistre uniquement sur l'espace (pas par plante)


class ActionRead(BaseModel):
    id_action: int
    id_plant: Optional[int] = None
    id_culture: int
    date_action: date
    type_action: str
    parametres: Optional[dict[str, Any]] = None
    note: Optional[str] = None
    global_culture: bool
    created_at: Optional[datetime] = None
    nom_plant: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


# ═══════════════════════════════════════════════════════════════════════════════
# CULTURE
# ═══════════════════════════════════════════════════════════════════════════════

class GraineSelection(BaseModel):
    """Sélection d'un paquet de graines avec le nombre de plantes à créer"""
    id_packgraine: int
    nb_plantes: int = 1
    id_pot: Optional[int] = None           # pot spécifique pour cette sélection
    volume_pot_l: Optional[float] = None   # volume du pot en L pour cette sélection


class PlantExterneCreate(BaseModel):
    """Plante externe (achat / import) — entrée directe en séchage ou curing"""
    nom_affichage: str
    statut: str                           # sechage | curing
    date_recolte: Optional[date] = None
    date_fin_sechage: Optional[date] = None
    poids_g: Optional[float] = None       # poids frais (séchage) ou sec (curing)
    provenance: Optional[str] = None
    prix_g: Optional[float] = None
    notes: Optional[str] = None


class CultureCreate(BaseModel):
    nom: Optional[str] = None
    id_espace: int
    date_debut: date
    graines_selection: list[GraineSelection] = []   # vide si plantes_externes
    type_culture: Optional[str] = None      # indoor | outdoor | greenhouse
    type_eclairage: Optional[str] = None    # LED | HPS | CMH | LEC | fluorescent | soleil
    but_culture: Optional[str] = None       # Récolte | Hunt | Reproduction | (paramétrable, comma-separated)
    # Substrat / pot par défaut appliqué à toutes les plantes créées
    substrat_defaut: Optional[str] = None
    id_recette_sol_defaut: Optional[int] = None
    id_pot_defaut: Optional[int] = None
    volume_pot_l_defaut: Optional[float] = None
    notes: Optional[str] = None
    # Plantes externes (achat / import séchage / import curing)
    plantes_externes: Optional[list[PlantExterneCreate]] = None


class CultureUpdate(BaseModel):
    nom: Optional[str] = None
    id_espace: Optional[int] = None
    date_debut: Optional[date] = None
    statut: Optional[str] = None
    date_fin: Optional[date] = None
    date_recolte_estimee: Optional[date] = None
    date_passage_12_12: Optional[date] = None
    date_debut_floraison: Optional[date] = None
    phase: Optional[str] = None
    type_culture: Optional[str] = None
    type_eclairage: Optional[str] = None
    but_culture: Optional[str] = None
    notes: Optional[str] = None


class CultureRead(BaseModel):
    id_culture: int
    nom: Optional[str] = None
    id_espace: Optional[int] = None
    nom_espace: Optional[str] = None
    statut: Optional[str] = None
    date_debut: Optional[date] = None
    date_fin: Optional[date] = None
    date_passage_12_12: Optional[date] = None
    date_debut_floraison: Optional[date] = None
    date_recolte_estimee: Optional[date] = None   # max — conservé pour rétro-compat
    date_recolte_min: Optional[date] = None        # première récolte prévue (plante la plus rapide)
    date_recolte_max: Optional[date] = None        # dernière récolte prévue (plante la plus lente)
    phase: Optional[str] = None
    type_culture: Optional[str] = None
    type_eclairage: Optional[str] = None
    but_culture: Optional[str] = None
    notes: Optional[str] = None
    nb_plantes: int = 0
    nb_plantes_actives: int = 0
    jours_culture: Optional[int] = None
    jours_depuis_dernier_arrosage: Optional[int] = None
    jours_depuis_dernier_tco: Optional[int] = None

    model_config = ConfigDict(from_attributes=True)


class CultureWithDetails(CultureRead):
    plants: list[PlantRead] = []
    actions_recentes: list[ActionRead] = []


# ─── Rétro-compat avec l'ancien router (ne plus utiliser) ───────────────────
class CultureBase(BaseModel):
    id_box: Optional[int] = None
    type_culture: Optional[str] = None
    date_germination: Optional[date] = None
    date_debut_croissance: Optional[date] = None
    date_passage_12_12: Optional[date] = None
    date_debut_floraison: Optional[date] = None
    duree_croissance: Optional[int] = None
    duree_stretch: Optional[int] = None
    phase: Optional[str] = None
    notes: Optional[str] = None


ActionCalendrierCreate = ActionCreate
ActionCalendrierRead = ActionRead
PlantBase = PlantCreate
CultureWithDetails = CultureWithDetails
