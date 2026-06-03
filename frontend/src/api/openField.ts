import client from './client'

// ── Types ─────────────────────────────────────────────────────────────────────

export type StatutProjet = 'planifie' | 'en_cours' | 'recolte' | 'termine'
export type ConditionsProjet = 'outdoor' | 'greenhouse' | 'guerrilla'
export type MethodePollinisation = 'naturelle' | 'manuelle' | 'pinceau'
export type QualiteGraines = 'bonne' | 'moyenne' | 'immature'

export interface PlanteMere {
  id_mere: number
  id_projet: number
  id_variete?: number
  variete_nom?: string
  nom_phenotype?: string
  id_plant?: number
  plant_label?: string
  date_pollinisation?: string
  methode_pollinisation?: MethodePollinisation
  pere_identifie: boolean
  id_pollen?: number
  pollen_nom?: string
  nom_pere_libre?: string
  notes_pollinisation?: string
  date_recolte?: string
  nb_graines?: number
  poids_graines_g?: number
  qualite_graines?: QualiteGraines
  id_peres?: number[]
  id_packgraine?: number
  peres_labels?: string[]
  notes?: string
  created_at?: string
}

export interface ProjetOpenField {
  id_projet: number
  nom: string
  saison?: string
  lieu?: string
  conditions?: ConditionsProjet
  id_culture?: number
  culture_nom?: string
  statut: StatutProjet
  description?: string
  notes?: string
  created_at?: string
  meres: PlanteMere[]
  peres: PlantePere[]
  nb_meres: number
  nb_peres: number
  nb_graines_total: number
}

export interface ProjetCreate {
  nom: string
  saison?: string
  lieu?: string
  conditions?: ConditionsProjet
  id_culture?: number
  statut?: StatutProjet
  description?: string
  notes?: string
}

export interface PlanteMereCreate {
  id_variete?: number
  nom_phenotype?: string
  id_plant?: number
  date_pollinisation?: string
  methode_pollinisation?: MethodePollinisation
  pere_identifie?: boolean
  id_pollen?: number
  nom_pere_libre?: string
  id_peres?: number[]
  notes_pollinisation?: string
  notes?: string
}

export interface RecolteInput {
  date_recolte?: string
  nb_graines?: number
  poids_graines_g?: number
  qualite_graines?: QualiteGraines
  creer_pack?: boolean
  nom_variete_croisement?: string
}


export interface PlantePere {
  id_pere:     number
  id_projet:   number
  id_variete?: number
  variete_nom?: string
  nom_libre?:  string
  notes?:      string
  created_at?: string
}

export interface PlantePereCreate {
  id_variete?: number
  nom_libre?:  string
  notes?:      string
}

// ── API ───────────────────────────────────────────────────────────────────────

export const openFieldAPI = {
  // Projets
  list:   (statut?: string) =>
    client.get<ProjetOpenField[]>('/open-field', { params: statut ? { statut } : {} }),
  get:    (id: number) =>
    client.get<ProjetOpenField>(`/open-field/${id}`),
  create: (data: ProjetCreate) =>
    client.post<ProjetOpenField>('/open-field', data),
  update: (id: number, data: Partial<ProjetCreate>) =>
    client.patch<ProjetOpenField>(`/open-field/${id}`, data),
  delete: (id: number) =>
    client.delete(`/open-field/${id}`),

  // Mères
  addMere:    (projetId: number, data: PlanteMereCreate) =>
    client.post<ProjetOpenField>(`/open-field/${projetId}/meres`, data),
  updateMere: (projetId: number, mereId: number, data: Partial<PlanteMereCreate>) =>
    client.patch<ProjetOpenField>(`/open-field/${projetId}/meres/${mereId}`, data),
  deleteMere: (projetId: number, mereId: number) =>
    client.delete(`/open-field/${projetId}/meres/${mereId}`),

  // Pères
  addPere:    (projetId: number, data: PlantePereCreate) =>
    client.post<ProjetOpenField>(`/open-field/${projetId}/peres`, data),
  updatePere: (projetId: number, pereId: number, data: Partial<PlantePereCreate>) =>
    client.patch<ProjetOpenField>(`/open-field/${projetId}/peres/${pereId}`, data),
  deletePere: (projetId: number, pereId: number) =>
    client.delete(`/open-field/${projetId}/peres/${pereId}`),

  // Récolte
  recolte: (projetId: number, mereId: number, data: RecolteInput) =>
    client.post<ProjetOpenField>(`/open-field/${projetId}/meres/${mereId}/recolte`, data),
}
