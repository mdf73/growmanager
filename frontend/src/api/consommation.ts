import client from './client'

export interface SessionConsommation {
  id_session:       number
  date_heure:       string
  id_vaporisateur?: number | null
  nom_vaporisateur?: string | null
  type_produit:     string   // fleur | hash | rosin
  id_stock?:        number | null
  nom_variete?:     string | null
  quantite_g:       number
  options_vapo?:    Record<string, unknown> | null
  notes?:           string | null
  created_at?:      string | null
}

export interface SessionConsommationCreate {
  date_heure?:      string
  id_vaporisateur?: number | null
  type_produit:     string
  id_stock?:        number | null
  quantite_g:       number
  options_vapo?:    Record<string, unknown> | null
  notes?:           string | null
}

export interface ConsoStats {
  periodes: { jour: number; semaine: number; mois: number; annee: number }
  by_type:  Record<string, number>
  by_vapo:  { id_vaporisateur: number | null; nom: string; total_g: number }[]
  last7:    { date: string; total_g: number }[]
  avg_7j_g: number
  stock_dispo_g: Record<string, number>
  jours_restants: number | null
}

export const consommationAPI = {
  getAll: (limit = 100, offset = 0) =>
    client.get<SessionConsommation[]>('/consommation/', { params: { limit, offset } }).then(r => r.data),

  getStats: () =>
    client.get<ConsoStats>('/consommation/stats').then(r => r.data),

  create: (data: SessionConsommationCreate) =>
    client.post<SessionConsommation>('/consommation/', data).then(r => r.data),

  update: (id: number, data: Partial<SessionConsommationCreate>) =>
    client.put<SessionConsommation>(`/consommation/${id}`, data).then(r => r.data),

  delete: (id: number) =>
    client.delete(`/consommation/${id}`),
}
