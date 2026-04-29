import client from './client'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PlantSechage {
  id_plant_sechage: number
  id_plant: number
  id_session_sechage: number
  date_mise_sechage?: string
  date_fin_sechage?: string
  poids_humide_g?: number
  poids_sec_g?: number
  notes?: string
  nom_plant?: string
  nom_variete?: string
  id_culture?: number
  nom_culture?: string
}

export interface SessionSechage {
  id_session_sechage: number
  id_espace?: number
  nom_espace?: string
  nom?: string
  methode_sechage?: string
  temperature_cible?: number
  humidite_cible?: number
  statut?: 'active' | 'terminee'
  date_debut?: string
  date_fin?: string
  notes?: string
  created_at?: string
  nb_plants: number
  plants: PlantSechage[]
}

export interface SessionSechageCreate {
  id_espace?: number
  nom?: string
  methode_sechage?: string
  temperature_cible?: number
  humidite_cible?: number
  date_debut?: string
  notes?: string
  plants?: PlantSechageCreate[]
}

export interface SessionSechageUpdate {
  id_espace?: number
  nom?: string
  methode_sechage?: string
  temperature_cible?: number
  humidite_cible?: number
  statut?: string
  date_debut?: string
  date_fin?: string
  notes?: string
}

export interface PlantSechageCreate {
  id_plant: number
  date_mise_sechage?: string
  date_fin_sechage?: string
  poids_humide_g?: number
  poids_sec_g?: number
  notes?: string
}

export interface PlantSechageUpdate {
  date_mise_sechage?: string
  date_fin_sechage?: string
  poids_humide_g?: number
  poids_sec_g?: number
  notes?: string
}

// ─── API ──────────────────────────────────────────────────────────────────────

export const sechageAPI = {
  // Sessions
  list: (statut?: string) =>
    client.get<SessionSechage[]>('/sechage/', { params: statut ? { statut } : {} }).then(r => r.data),

  get: (id: number) =>
    client.get<SessionSechage>(`/sechage/${id}`).then(r => r.data),

  create: (data: SessionSechageCreate) =>
    client.post<SessionSechage>('/sechage/', data).then(r => r.data),

  update: (id: number, data: SessionSechageUpdate) =>
    client.put<SessionSechage>(`/sechage/${id}`, data).then(r => r.data),

  delete: (id: number) =>
    client.delete(`/sechage/${id}`).then(r => r.data),

  // Plants dans une session
  addPlant: (sessionId: number, data: PlantSechageCreate) =>
    client.post<PlantSechage>(`/sechage/${sessionId}/plants`, data).then(r => r.data),

  updatePlant: (sessionId: number, plantSechageId: number, data: PlantSechageUpdate) =>
    client.put<PlantSechage>(`/sechage/${sessionId}/plants/${plantSechageId}`, data).then(r => r.data),

  removePlant: (sessionId: number, plantSechageId: number) =>
    client.delete(`/sechage/${sessionId}/plants/${plantSechageId}`).then(r => r.data),
}
