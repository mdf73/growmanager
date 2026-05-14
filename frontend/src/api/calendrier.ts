import client from './client'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CalendrierEvent {
  id_action:      number
  date_action:    string        // ISO string "2026-05-14T10:30:00"
  type_action:    string
  global_culture: boolean
  parametres:     Record<string, unknown> | null
  note:           string | null
  // Culture
  id_culture:     number
  culture_nom:    string
  culture_statut: string | null
  // Plant
  id_plant:       number | null
  plant_nom:      string | null
}

export interface CultureRef {
  id_culture: number
  nom:        string
  statut:     string | null
  date_debut: string | null
  date_fin:   string | null
}

// ─── API calls ────────────────────────────────────────────────────────────────

export const getCalendrierEvents = (year: number, month: number) =>
  client.get<CalendrierEvent[]>('/calendrier/', { params: { year, month } })
    .then(r => r.data)

export const getCulturesRef = () =>
  client.get<CultureRef[]>('/calendrier/cultures-actives')
    .then(r => r.data)
