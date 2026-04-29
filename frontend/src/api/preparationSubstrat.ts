import client from './client'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PotConfig {
  volume_l: number
  nb: number
}

export interface IngredientResult {
  label: string
  quantite: number
  unite: string
}

export interface PreparationSubstrat {
  id_preparation: number
  date_preparation: string
  volume_total_l: number
  type_sol?: string
  id_recette_lso?: number
  nom_recette_lso?: string
  configuration_pots?: PotConfig[]
  resultat?: IngredientResult[]
  notes?: string
  created_at?: string
}

export interface PreparationSubstratCreate {
  date_preparation?: string
  volume_total_l: number
  type_sol?: string
  id_recette_lso?: number
  nom_recette_lso?: string
  configuration_pots?: PotConfig[]
  resultat?: IngredientResult[]
  notes?: string
}

// ─── API calls ────────────────────────────────────────────────────────────────

export const preparationSubstratAPI = {
  getAll: () => client.get<PreparationSubstrat[]>('/preparation-substrat/'),
  getOne: (id: number) => client.get<PreparationSubstrat>(`/preparation-substrat/${id}`),
  create: (data: PreparationSubstratCreate) =>
    client.post<PreparationSubstrat>('/preparation-substrat/', data),
  delete: (id: number) => client.delete(`/preparation-substrat/${id}`),
}
