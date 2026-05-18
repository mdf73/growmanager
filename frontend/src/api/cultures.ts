import client from './client'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CultureCout {
  cout_engrais:     number | null
  cout_electricite: number | null
  cout_graines:     number | null
  cout_total:       number | null
  cout_par_gramme:  number | null
  puissance_w:      number | null
}

export interface Culture {
  id_culture: number
  nom?: string
  id_espace?: number
  nom_espace?: string
  statut?: 'active' | 'sechage_curing' | 'terminee'
  date_debut?: string
  date_fin?: string
  date_passage_12_12?: string
  date_debut_floraison?: string
  date_debut_flush?: string
  date_recolte_estimee?: string
  date_recolte_min?: string
  date_recolte_max?: string
  phase?: string
  type_culture?: string
  type_eclairage?: string
  but_culture?: string
  notes?: string
  nb_plantes: number
  nb_plantes_actives: number
  jours_culture?: number
  jours_depuis_dernier_arrosage?: number
  jours_depuis_dernier_tco?: number
  total_recolte_g?: number | null
}

export interface CultureWithDetails extends Culture {
  plants: Plant[]
  actions_recentes: Action[]
}

export interface Plant {
  id_plant: number
  id_culture: number
  id_graine?: number
  nom_affichage: string
  numero_plant?: number
  origine?: string
  statut?: string
  date_germination?: string
  date_debut_flo?: string
  date_recolte?: string
  date_fin_sechage?: string
  poids_recolte_g?: number
  substrat?: string
  id_recette_sol?: number
  nom_recette_sol?: string
  id_pot?: number
  taille_pot?: number
  volume_pot_l?: number
  notes?: string
  nom_variete?: string
  nom_breeder?: string
  duree_flo_min?: number
  duree_flo_max?: number
}

export interface Action {
  id_action: number
  id_plant?: number
  id_culture: number
  date_action: string
  type_action: string
  parametres?: Record<string, unknown>
  note?: string
  global_culture: boolean
  created_at?: string
  nom_plant?: string
}

export interface GraineSelection {
  id_packgraine: number
  nb_plantes: number
  id_pot?: number
  volume_pot_l?: number
}

export interface PotItem {
  id_pot: number
  taille_pot?: number
  volume_l?: number
  dimension_pot?: string
  etat?: string
  en_cours?: boolean
  nom_culture_en_cours?: string
}

export interface RecetteSolItem {
  id_recette_lso: number
  nom_recette: string
  type_lso?: string
  quantite_totale?: number
  unite_quantite?: string
}

export interface PlantExterneCreate {
  nom_affichage: string
  statut: 'sechage' | 'curing'
  date_recolte?: string
  date_fin_sechage?: string
  poids_g?: number
  provenance?: string
  prix_g?: number
  notes?: string
}

export interface CultureCreate {
  nom?: string
  id_espace: number
  date_debut: string
  graines_selection: GraineSelection[]
  type_culture?: string
  type_eclairage?: string
  but_culture?: string
  substrat_defaut?: string
  id_recette_sol_defaut?: number
  id_pot_defaut?: number
  volume_pot_l_defaut?: number
  notes?: string
  plantes_externes?: PlantExterneCreate[]
}

export interface CultureUpdate {
  nom?: string
  id_espace?: number
  date_debut?: string
  statut?: string
  date_fin?: string
  date_recolte_estimee?: string
  date_passage_12_12?: string
  date_debut_floraison?: string
  phase?: string
  type_culture?: string
  type_eclairage?: string
  but_culture?: string
  notes?: string
}

export interface ActionCreate {
  id_plant?: number
  date_action: string
  type_action: string
  parametres?: Record<string, unknown>
  note?: string
  global_culture?: boolean
  space_only?: boolean
  ph_entrant?: number
  ph_sortant?: number
  ec_entrant?: number
  ec_sortant?: number
}

export interface PlantUpdate {
  nom_affichage?: string
  statut?: string
  date_germination?: string
  date_debut_flo?: string
  date_recolte?: string
  date_fin_sechage?: string
  poids_recolte_g?: number
  substrat?: string
  id_recette_sol?: number
  id_pot?: number
  volume_pot_l?: number
  notes?: string
}

export interface PhEcPoint {
  date: string
  ph_entrant: number | null
  ph_sortant: number | null
  ec_entrant: number | null
  ec_sortant: number | null
}

export interface Stats {
  hauteurs: Record<string, { date: string; hauteur_cm: number }[]>
  arrosages: { date: string; volume_ml: number; type: string }[]
  intensites_lampe: { date: string; puissance_avant: number; puissance_apres: number }[]
  ph_ec: PhEcPoint[]
  nb_actions_total: number
}

export interface PlantForStock {
  id_plant:    number
  nom_affichage: string
  statut:      string | null
  id_culture:  number
  nom_culture: string | null
}

export interface PlantStockInfo {
  sous_type_stock: string | null
  lampe_type:      string | null
  substrat_type:   string | null
  engrais_type:    string | null
}

export interface PlantSechage {
  id_plant: number
  id_culture: number
  nom_affichage: string
  statut: 'sechage' | 'curing'
  date_recolte?: string
  date_fin_sechage?: string
  poids_recolte_g?: number
  nom_variete?: string
  nom_breeder?: string
  nom_culture?: string
  nom_espace?: string        // espace de culture (défaut)
  id_espace?: number
  duree_sechage_j?: number
  // Session séchage assignée
  id_plant_sechage?: number
  id_session_sechage?: number
  id_espace_sechage?: number
  nom_espace_sechage?: string  // espace de séchage si différent de la culture
  methode_sechage?: string
  poids_humide_g?: number
  // Session curing assignée
  id_plant_curing?: number
  id_session_curing?: number
  type_contenant?: string
  volume_contenant_l?: number
  boveda_rh?: number
  id_espace_curing?: number    // espace si curing dans un espace de culture
  nom_espace_curing?: string
  id_materiel_bocal?: number   // bocal inventaire sélectionné
  nom_materiel_bocal?: string
  derniere_ouverture_bocal?: string  // date ISO de la dernière ouverture_bocal
}

// ─── API ─────────────────────────────────────────────────────────────────────

export interface TransferCultureTarget {
  id_culture: number
  nom: string
  nom_espace?: string
  phase?: string
}

export interface TransferEspaceTarget {
  id_espace: number
  nom: string
}

export interface TransferTargets {
  cultures_actives: TransferCultureTarget[]
  espaces_disponibles: TransferEspaceTarget[]
}

export interface PlantTransferPayload {
  target_culture_id?: number
  target_espace_id?: number
}

export const cultureUtilsAPI = {
  getPots: () => client.get<PotItem[]>('/cultures/pots'),
  getRecettesSol: () => client.get<RecetteSolItem[]>('/cultures/recettes-sol'),
  getTransferTargets: (excludeCultureId: number) =>
    client.get<TransferTargets>('/cultures/utils/transfer-targets', {
      params: { exclude_culture_id: excludeCultureId },
    }),
}

export const cultureAPI = {
  getAll: (statut?: string) =>
    client.get<Culture[]>('/cultures/', { params: statut ? { statut } : {} }),
  getById: (id: number) =>
    client.get<CultureWithDetails>(`/cultures/${id}`),
  create: (data: CultureCreate) =>
    client.post<Culture>('/cultures/', data),
  update: (id: number, data: CultureUpdate) =>
    client.put<Culture>(`/cultures/${id}`, data),
  delete: (id: number) =>
    client.delete(`/cultures/${id}`),
  close: (id: number) =>
    client.post<Culture>(`/cultures/${id}/close`),
  getCout: (id: number) =>
    client.get<CultureCout>(`/cultures/${id}/cout`),
  getSechagePlants: () =>
    client.get<PlantSechage[]>('/cultures/sechage/plants'),
  getSechageEligible: () =>
    client.get<any[]>('/cultures/sechage/eligible'),
  getCuringEligible: () =>
    client.get<any[]>('/cultures/curing/eligible'),
  getPlantsByVariete: (idVariete: number) =>
    client.get<PlantForStock[]>(`/cultures/plants-by-variete/${idVariete}`),
  getPlantStockInfo: (idPlant: number) =>
    client.get<PlantStockInfo>(`/cultures/plant/${idPlant}/stock-info`),
}

export const plantAPI = {
  getByCulture: (cultureId: number) =>
    client.get<Plant[]>(`/cultures/${cultureId}/plants`),
  add: (cultureId: number, data: Omit<Plant, 'id_plant' | 'id_culture'>) =>
    client.post<Plant>(`/cultures/${cultureId}/plants`, data),
  update: (cultureId: number, plantId: number, data: PlantUpdate) =>
    client.put<Plant>(`/cultures/${cultureId}/plants/${plantId}`, data),
  delete: (cultureId: number, plantId: number) =>
    client.delete(`/cultures/${cultureId}/plants/${plantId}`),
  transfer: (cultureId: number, plantId: number, data: PlantTransferPayload) =>
    client.post<Plant>(`/cultures/${cultureId}/plants/${plantId}/transfer`, data),
}

export interface DernierTCO {
  found: boolean
  is_ready: boolean
  date_action?: string
  nom_recette?: string
  date_pret?: string
}

export const actionAPI = {
  getCalendrier: (cultureId: number, month?: string) =>
    client.get<Action[]>(`/cultures/${cultureId}/calendrier`, {
      params: month ? { month } : {},
    }),
  create: (cultureId: number, data: ActionCreate) =>
    client.post<Action[]>(`/cultures/${cultureId}/actions`, data),
  update: (cultureId: number, actionId: number, data: ActionCreate) =>
    client.put<Action>(`/cultures/${cultureId}/actions/${actionId}`, data),
  delete: (cultureId: number, actionId: number) =>
    client.delete(`/cultures/${cultureId}/actions/${actionId}`),
  getStats: (cultureId: number) =>
    client.get<Stats>(`/cultures/${cultureId}/stats`),
  getDernierTCO: (cultureId: number) =>
    client.get<DernierTCO>(`/cultures/dernier-tco/${cultureId}`),
}
