import client from './client'

export interface DashboardFullStats {
  // Module 1 — Cultures actives
  nb_cultures_actives: number
  nb_plants_veg: number
  nb_plants_flo: number
  veg_jours_min?: number
  veg_jours_max?: number
  flo_jours_min?: number
  flo_jours_max?: number
  harvest_restant_jours_min?: number  // peut être négatif
  harvest_restant_jours_max?: number
  // Module 2 — Séchage
  nb_plants_sechage: number
  sechage_jours_min?: number
  sechage_jours_max?: number
  // Module 3 — Curing
  nb_plants_curing: number
  curing_jours_min?: number
  curing_jours_max?: number
  // Module 4 — Stock
  stock_total_g: number
  stock_herbe_g: number
  stock_hash_g: number
  stock_rosin_g: number
  // Module 5 — Production
  production_annee_g: number
  production_mois_g: number
  production_30j_g: number
  nb_recoltes_annee: number
  // Module 6 — Graines
  graines_disponibles: number
  graines_regulieres: number
  graines_feminisees: number
  nb_varietes_graines: number
  valeur_graines_eur?: number
  // Séchage ambiance
  sechage_temp_moy?: number
  sechage_hum_moy?: number
  // Curing bocal
  curing_jours_bocal?: number
}

export interface BoxArrosageStats {
  id_culture: number
  culture_nom: string
  box_label?: string
  derniere_arrosage?: string   // ISO date "YYYY-MM-DD"
  jours_depuis_arrosage?: number
  date_debut_flush?: string    // ISO date — V4-C timer flush
  jours_flush?: number         // jours depuis début du flush
}

export interface BurpingReminder {
  id_session_curing: number
  nom: string
  type_contenant?: string
  date_debut?: string             // ISO date "YYYY-MM-DD"
  jours_curing: number
  derniere_ouverture?: string     // ISO date "YYYY-MM-DD"
  jours_depuis_ouverture: number
  frequence_recommandee_j: number // 1 | 3 | 7 | 14
  frequence_label: string         // "1x/jour" | "1x/3j" | "1x/7j" | "1x/2sem"
  a_ouvrir_aujourd_hui: boolean
  nb_plantes: number
}

export interface IpmWarning {
  id_action: number
  id_culture: number
  culture_nom: string
  id_plant?: number
  plant_nom?: string
  date_traitement: string      // ISO date "YYYY-MM-DD"
  produit?: string
  dose?: number
  methode?: string
  delai_recolte_j: number
  jours_ecoules: number
  jours_restants: number
  alerte_rouge: boolean        // True si < 7j restants
}

export const dashboardAPI = {
  getStats:            () => client.get<DashboardFullStats>('/dashboard/stats'),
  getArrosageBoxes:    () => client.get<BoxArrosageStats[]>('/dashboard/arrosage-boxes'),
  getBurpingReminders: () => client.get<BurpingReminder[]>('/dashboard/burping-reminders'),
  getIpmWarnings:      () => client.get<IpmWarning[]>('/dashboard/ipm-warnings'),
}
