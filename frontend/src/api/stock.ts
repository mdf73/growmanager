import client from './client'

export interface Stock {
  id_stock:          number
  id_variete?:       number
  id_bocal?:         number
  id_materiel_bocal?: number
  type_stock?:       string
  sous_type_stock?:  string
  lampe_type?:       string
  engrais_type?:     string
  maillage?:         string
  type_hash?:        string
  type_rosin?:       string
  date_stock?:       string
  date_fin_stock?:   string | null
  quantite_stock:    number
  variete_nom?:      string
  bocal_taille?:     number
  bocal_nom?:        string | null
  bocal_volume_ml?:  number | null
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
