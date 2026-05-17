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

export interface ActionCout {
  cout_total: number | null
  par_produit: { nom: string; cout: number | null }[]
}

export const getActionCout = (cultureId: number, actionId: number) =>
  client.get<ActionCout>(`/cultures/${cultureId}/actions/${actionId}/cout`)
    .then(r => r.data)

export const getCalendrierExport = (
  date_debut: string,
  date_fin: string,
  id_culture?: number,
) =>
  client.get<CalendrierEvent[]>('/calendrier/export', {
    params: { date_debut, date_fin, ...(id_culture !== undefined && { id_culture }) },
  }).then(r => r.data)
