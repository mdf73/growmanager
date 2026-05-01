import axios from 'axios'

// ── Plant ─────────────────────────────────────────────────────────────────────
export interface HistoriquePlant {
  id_historique_plant:   number
  id_historique_culture: number
  id_variete:            number | null
  variete_nom:           string | null
  numero_plant:          number | null
  date_debut_plant:      string | null
  date_fin_plant:        string | null
  prix_graine:           number | null
  quantite_recoltee:     number | null
  notes:                 string | null
}

export interface HistoriquePlantCreate {
  id_variete?:         number | null
  variete_nom?:        string | null
  numero_plant?:       number | null
  date_debut_plant?:   string | null
  date_fin_plant?:     string | null
  prix_graine?:        number | null
  quantite_recoltee?:  number | null
  notes?:              string | null
}

// ── Culture ───────────────────────────────────────────────────────────────────
export interface HistoriqueCulture {
  id_historique_culture: number
  nom:                   string | null
  date_debut:            string | null
  date_fin:              string | null
  tente:                 string | null
  lampe:                 string | null
  puissance:             number | null
  type_culture:          string | null
  engrais:               string | null
  substrat:              string | null
  notes:                 string | null
  plants:                HistoriquePlant[]
  // computed
  duree_jours:           number | null
  nb_plants:             number
  quantite_totale:       number | null
  prix_total_graines:    number | null
  g_par_watt:            number | null
  varietes_label:        string
  // coûts (stockés à la clôture)
  cout_engrais:          number | null
  cout_electricite:      number | null
  cout_graines:          number | null
  cout_total:            number | null
  cout_par_gramme:       number | null
}

export interface HistoriqueCultureCreate {
  nom?:          string | null
  date_debut?:   string | null
  date_fin?:     string | null
  tente?:        string | null
  lampe?:        string | null
  puissance?:    number | null
  type_culture?: string | null
  engrais?:      string | null
  substrat?:     string | null
  notes?:        string | null
  plants:        HistoriquePlantCreate[]
}

export interface HistoriqueCultureUpdate {
  nom?:          string | null
  date_debut?:   string | null
  date_fin?:     string | null
  tente?:        string | null
  lampe?:        string | null
  puissance?:    number | null
  type_culture?: string | null
  engrais?:      string | null
  substrat?:     string | null
  notes?:        string | null
}

// ── API ───────────────────────────────────────────────────────────────────────
export const historiqueCultureAPI = {
  getAll: () =>
    axios.get<HistoriqueCulture[]>('/api/historique-cultures'),

  getOne: (id: number) =>
    axios.get<HistoriqueCulture>(`/api/historique-cultures/${id}`),

  create: (payload: HistoriqueCultureCreate) =>
    axios.post<HistoriqueCulture>('/api/historique-cultures', payload),

  update: (id: number, payload: HistoriqueCultureUpdate) =>
    axios.patch<HistoriqueCulture>(`/api/historique-cultures/${id}`, payload),

  delete: (id: number) =>
    axios.delete(`/api/historique-cultures/${id}`),

  addPlant: (cultureId: number, plant: HistoriquePlantCreate) =>
    axios.post<HistoriquePlant>(`/api/historique-cultures/${cultureId}/plants`, plant),

  deletePlant: (cultureId: number, plantId: number) =>
    axios.delete(`/api/historique-cultures/${cultureId}/plants/${plantId}`),

  getPrixGraine: (idVariete: number) =>
    axios.get<{ prix_graine: number | null }>(`/api/historique-cultures/prix-graine/${idVariete}`),
}
