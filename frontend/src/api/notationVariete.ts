import client from './client'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface NotationRead {
  id_notation: number
  nom_variete: string
  breeder?: string | null
  date_notation?: string | null

  // Partie A — Culture /30
  vigueur_sante?: number | null
  productivite_structure?: number | null
  soif?: number | null

  // Partie B — Consommation /70
  apparence_structure?: number | null
  profil_aromatique?: number | null
  saveur_qualite?: number | null
  effet_puissance?: number | null

  // Labo
  taux_thc?: number | null
  taux_cbd?: number | null
  terpene_dominant?: string | null
  commentaire_labo?: string | null
  notes_generales?: string | null

  // Calculés
  total_culture?: number | null
  total_consommation?: number | null
  note_finale?: number | null

  created_at?: string | null
  updated_at?: string | null
}

export type NotationCreate = Omit<NotationRead, 'id_notation' | 'total_culture' | 'total_consommation' | 'note_finale' | 'created_at' | 'updated_at'>

export type NotationUpdate = Partial<NotationCreate>

// ── Types stats extraction ────────────────────────────────────────────────────

export interface ExtractionStat {
  avg_rosin_pct: number | null
  nb_rosin: number
  avg_hash_pct: number | null
  nb_hash: number
}

/** Clé = nom_variete */
export type ExtractionStatsMap = Record<string, ExtractionStat>

// ── API ────────────────────────────────────────────────────────────────────────

export const notationVarieteAPI = {
  list: () =>
    client.get<NotationRead[]>('/notations/').then(r => r.data),

  get: (id: number) =>
    client.get<NotationRead>(`/notations/${id}`).then(r => r.data),

  create: (payload: NotationCreate) =>
    client.post<NotationRead>('/notations/', payload).then(r => r.data),

  update: (id: number, payload: NotationUpdate) =>
    client.put<NotationRead>(`/notations/${id}`, payload).then(r => r.data),

  delete: (id: number) =>
    client.delete(`/notations/${id}`),

  getExtractionStats: () =>
    client.get<ExtractionStatsMap>('/notations/utils/extraction-stats').then(r => r.data),

  exportCsv: () => {
    window.open(`${client.defaults.baseURL ?? ''}/notations/export/csv`, '_blank')
  },
}
