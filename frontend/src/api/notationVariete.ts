import client from './client'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface NotationRead {
  id_notation: number
  nom_variete: string
  breeder?: string | null
  date_notation?: string | null

  // Notes manuelles sur 5 étoiles
  note_gout?: number | null
  note_odeur?: number | null
  note_texture?: number | null
  note_extraction?: number | null

  // Labo (informatif)
  taux_thc?: number | null
  taux_cbd?: number | null
  terpene_dominant?: string | null
  commentaire_labo?: string | null
  notes_generales?: string | null

  // Calculé : moyenne des notes renseignées (/5)
  note_moyenne?: number | null

  created_at?: string | null
  updated_at?: string | null
}

export type NotationCreate = Omit<NotationRead, 'id_notation' | 'note_moyenne' | 'created_at' | 'updated_at'>

export type NotationUpdate = Partial<NotationCreate>

// ── Classement (stats calculées automatiquement) ─────────────────────────────

export interface RendementBucket {
  type: 'pot' | 'hydro' | 'inconnu'
  volume_l: number | null
  label: string
  nb_pieds: number
  moyenne_g: number
  total_g: number
  min_g: number
  max_g: number
}

export interface ExtractionCumul {
  nb: number
  total_utilise_g: number
  total_extrait_g: number
  rendement_pct: number
}

export interface GerminationStat {
  semees: number
  germees: number
  mortes: number
  taux_pct: number
}

export interface ClassementRow {
  key: string
  nom_variete: string
  breeder: string | null
  notation: NotationRead | null
  note_moyenne: number | null
  rendement_culture: RendementBucket[]
  nb_pieds_recoltes: number
  rendement_moyen_g: number | null
  rosin: ExtractionCumul | null
  hash: ExtractionCumul | null
  germination: GerminationStat | null
}

// ── API ────────────────────────────────────────────────────────────────────────

export const notationVarieteAPI = {
  list: () =>
    client.get<NotationRead[]>('/notations/').then(r => r.data),

  get: (id: number) =>
    client.get<NotationRead>(`/notations/${id}`).then(r => r.data),

  /** Crée la notation, ou met à jour celle de la variété si elle existe déjà. */
  create: (payload: NotationCreate) =>
    client.post<NotationRead>('/notations/', payload).then(r => r.data),

  update: (id: number, payload: NotationUpdate) =>
    client.put<NotationRead>(`/notations/${id}`, payload).then(r => r.data),

  delete: (id: number) =>
    client.delete(`/notations/${id}`),

  getClassement: () =>
    client.get<ClassementRow[]>('/notations/utils/classement').then(r => r.data),

  exportCsv: () => {
    window.open(`${client.defaults.baseURL ?? ''}/notations/export/csv`, '_blank')
  },
}
