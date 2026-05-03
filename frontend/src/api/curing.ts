import client from './client'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PlantCuring {
  id_plant_curing: number
  id_plant: number
  id_session_curing: number
  date_mise_curing?: string
  date_fin_curing?: string
  poids_debut_g?: number
  poids_final_g?: number
  notes?: string
  nom_plant?: string
  nom_variete?: string
  id_culture?: number
  nom_culture?: string
  date_recolte?: string
}

export interface SessionCuring {
  id_session_curing: number
  nom?: string
  type_contenant?: string
  volume_contenant_l?: number
  boveda_rh?: number
  statut?: 'active' | 'terminee'
  date_debut?: string
  date_fin?: string
  notes?: string
  created_at?: string
  nb_plants: number
  plants: PlantCuring[]
}

export interface SessionCuringCreate {
  nom?: string
  type_contenant?: string
  volume_contenant_l?: number
  boveda_rh?: number
  id_espace?: number
  id_materiel_bocal?: number
  date_debut?: string
  notes?: string
  plants?: PlantCuringCreate[]
}

export interface SessionCuringUpdate {
  nom?: string
  type_contenant?: string
  volume_contenant_l?: number
  boveda_rh?: number
  id_espace?: number | null
  id_materiel_bocal?: number | null
  statut?: string
  date_debut?: string
  date_fin?: string
  notes?: string
}

export interface PlantCuringCreate {
  id_plant: number
  date_mise_curing?: string
  date_fin_curing?: string
  poids_debut_g?: number
  poids_final_g?: number
  notes?: string
}

export interface PlantCuringUpdate {
  date_mise_curing?: string
  date_fin_curing?: string
  poids_debut_g?: number
  poids_final_g?: number
  notes?: string
}

// ─── API ──────────────────────────────────────────────────────────────────────

export const curingAPI = {
  // Sessions
  list: (statut?: string) =>
    client.get<SessionCuring[]>('/curing/', { params: statut ? { statut } : {} }).then(r => r.data),

  get: (id: number) =>
    client.get<SessionCuring>(`/curing/${id}`).then(r => r.data),

  create: (data: SessionCuringCreate) =>
    client.post<SessionCuring>('/curing/', data).then(r => r.data),

  update: (id: number, data: SessionCuringUpdate) =>
    client.put<SessionCuring>(`/curing/${id}`, data).then(r => r.data),

  delete: (id: number) =>
    client.delete(`/curing/${id}`).then(r => r.data),

  // Plants dans une session
  addPlant: (sessionId: number, data: PlantCuringCreate) =>
    client.post<PlantCuring>(`/curing/${sessionId}/plants`, data).then(r => r.data),

  updatePlant: (sessionId: number, plantCuringId: number, data: PlantCuringUpdate) =>
    client.put<PlantCuring>(`/curing/${sessionId}/plants/${plantCuringId}`, data).then(r => r.data),

  removePlant: (sessionId: number, plantCuringId: number) =>
    client.delete(`/curing/${sessionId}/plants/${plantCuringId}`).then(r => r.data),
}
