import client from './client'

export interface Stock {
  id_stock:          number
  id_variete?:       number | null
  id_bocal?:         number | null
  id_materiel_bocal?: number | null
  id_plant?:         number | null          // V4-F traçabilité
  type_stock?:       string | null
  sous_type_stock?:  string | null
  lampe_type?:       string | null
  engrais_type?:     string | null
  maillage?:         string | null
  type_hash?:        string | null
  type_rosin?:       string | null
  date_stock?:       string | null
  date_fin_stock?:   string | null
  quantite_stock:    number
  variete_nom?:      string
  bocal_taille?:     number
  bocal_nom?:        string | null
  bocal_volume_ml?:  number | null
  plant_nom?:        string | null          // V4-F : nom_affichage de la plante liée
  plant_culture_nom?: string | null         // V4-F : nom de la culture de la plante
}

export interface BocalDisponible {
  id_materiel: number
  nom:         string
  volume_ml?:  number | null
  label:       string
}

export interface RosinExtraction {
  id_rosinextraction: number
  id_bocal?: number
  id_rosinbag?: number
  id_press?: number
  id_stock_source?: number
  nom_variete_extract?: string
  variete_nom?: string          // enrichi côté serveur
  date_rosinextraction: string
  // Paramètres d'extraction
  temperature_extraction?: number  // °C
  maillage?: string                // ex: 72µ, 90µ…
  duree_preheat?: number           // secondes
  duree_extraction?: number        // secondes
  // Sacs d'entrée
  sac_1_poids?: number
  sac_2_poids?: number
  sac_3_poids?: number
  sac_4_poids?: number
  quantite_utilisee: number
  // Passes de presse
  presse_1_poids?: number
  presse_2_poids?: number
  presse_3_poids?: number
  presse_4_poids?: number
  quantite_extraite: number
  info_rosinextraction?: string
}

export interface SacIceo {
  maillage: string
  poids: number
}

export interface PassageIceo {
  duree: number   // minutes
}

export interface HashExtraction {
  id_hashextraction:   number
  id_variete?:         number
  id_iceobag?:         number
  id_stock_source?:    number
  nom_variete_hash?:   string
  variete_nom?:        string     // enrichi côté serveur
  date_hashextraction: string
  type_extraction?:    'Polinator' | 'Ice-o-lator'
  duree_polinator?:    number     // minutes, pour Polinator
  passages?:           PassageIceo[]   // pour Ice-o-lator
  sacs?:               SacIceo[]       // pour Ice-o-lator
  quantite_utilisee:   number
  quantite_extraite:   number
  info_hashextraction?: string
}

export interface ExtractionStats {
  ratio_moyen_rosin: number
  total_presse_g: number
  total_extrait_rosin_g: number
  total_extrait_hash_g: number
  nombre_extractions: number
}

// ── Types traçabilité origine ─────────────────────────────────────────────────
export interface BreederMin { id_breeder: number; nom_breeder: string }
export interface VarieteDetail {
  id_variete: number
  nom_variete: string
  croisement_variete: string | null
  informations_variete: string | null
  lien_web: string | null
}
export interface GrainePlant {
  id_graine: number
  types_graines: string | null
  breeder: BreederMin | null
}
export interface PlantOrigine {
  id_plant: number
  nom_affichage: string
  date_recolte: string | null
  poids_recolte_g: number | null
  statut: string | null
  graine: GrainePlant | null
  sechage_date_debut: string | null
  sechage_date_fin: string | null
  curing_date_debut: string | null
  poids_debut_curing_g: number | null
  poids_final_curing_g: number | null
}
export interface CultureSource {
  id_culture: number
  nom: string
  statut: string | null
  date_debut: string | null
  date_passage_12_12: string | null
  date_debut_floraison: string | null
  plants: PlantOrigine[]
}
export interface BocalInfo { id_materiel: number; nom: string; volume_ml: number | null }
export interface StockOrigine {
  stock: Stock
  variete: VarieteDetail | null
  bocal: BocalInfo | null
  cultures_source: CultureSource[]
}

export const stockAPI = {
  getAll:  ()                                          => client.get<Stock[]>('/stock/'),
  getById: (id: number)                                => client.get<Stock>(`/stock/${id}`),
  create:  (data: Omit<Stock, 'id_stock'>)             => client.post<Stock>('/stock/', data),
  update:  (id: number, data: Omit<Stock, 'id_stock'>) => client.put<Stock>(`/stock/${id}`, data),
  delete:  (id: number)                                => client.delete(`/stock/${id}`),
  sortie:  (id: number)                                => client.post<Stock>(`/stock/${id}/sortie`),
  getBocauxDisponibles: (currentStockId?: number)      =>
    client.get<BocalDisponible[]>('/stock/bocaux-disponibles', {
      params: currentStockId ? { current_stock_id: currentStockId } : undefined,
    }),

  origine: (stockId: number) =>
    client.get<StockOrigine>(`/stock/${stockId}/origine`),

  downloadLabel: async (stockId: number): Promise<void> => {
    const response = await client.get(`/stock/${stockId}/label`, {
      responseType: 'blob',
    })
    const url = URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }))
    const a   = document.createElement('a')
    a.href     = url
    a.download = `label_stock_${stockId}.pdf`
    a.click()
    URL.revokeObjectURL(url)
  },
}

export const rosinAPI = {
  getAll:   ()                                                      => client.get<RosinExtraction[]>('/rosin'),
  getStats: ()                                                      => client.get<ExtractionStats>('/rosin/stats'),
  create:   (data: Omit<RosinExtraction, 'id_rosinextraction' | 'variete_nom'>) =>
    client.post<RosinExtraction>('/rosin', data),
  delete:   (id: number)                                           => client.delete(`/rosin/${id}`),
}

export const hashAPI = {
  getAll:   ()            => client.get<HashExtraction[]>('/hash'),
  getStats: ()            => client.get<{ nombre_extractions: number; total_entree_g: number; total_hash_g: number; ratio_moyen: number }>('/hash/stats'),
  create:   (data: Omit<HashExtraction, 'id_hashextraction' | 'variete_nom'>) =>
    client.post<HashExtraction>('/hash', data),
  delete:   (id: number)  => client.delete(`/hash/${id}`),
}