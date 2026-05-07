import client from './client'

// --- Types ---

export type TypeCroisement = 'F1' | 'F2' | 'BX' | 'S1' | 'IBL' | 'polyhybrid'
export type StatutCroisement = 'planifie' | 'pollinise' | 'maturation' | 'recolte' | 'echec'
export type MethodePollinisation = 'plante_entiere' | 'branche_isolee' | 'pinceau'
export type QualiteGraines = 'bonne' | 'moyenne' | 'immature'
export type StockagePollen = 'frigo' | 'congelateur' | 'ambiant'

// --- Pollen ---

export interface Pollen {
  id_pollen: number
  nom_pollen: string
  id_variete_source?: number
  nom_variete_source?: string
  pheno_source?: string
  reverse: boolean
  date_collecte?: string
  quantite_initiale_g?: number
  quantite_restante_g?: number
  stockage?: StockagePollen
  date_peremption?: string
  actif: boolean
  notes?: string
  created_at?: string
  perime: boolean
  epuise: boolean
}

export interface PollenCreate {
  nom_pollen: string
  id_variete_source?: number
  pheno_source?: string
  reverse?: boolean
  date_collecte?: string
  quantite_initiale_g?: number
  quantite_restante_g?: number
  stockage?: StockagePollen
  date_peremption?: string
  notes?: string
}

export interface PollenUpdate extends Partial<PollenCreate> {
  actif?: boolean
}

// --- Croisement ---

export interface Croisement {
  id_croisement: number
  nom_croisement: string
  type_croisement?: TypeCroisement

  id_variete_mere?: number
  nom_variete_mere?: string
  pheno_mere?: string
  notes_mere?: string

  id_pollen?: number
  nom_pollen?: string
  id_variete_pere?: number
  nom_variete_pere?: string
  pheno_pere?: string
  pere_reverse: boolean
  notes_pere?: string

  date_pollinisation?: string
  methode?: MethodePollinisation
  zone_pollinisee?: string
  quantite_pollen_utilisee_g?: number

  date_recolte_graines?: string
  nb_graines?: number
  qualite_graines?: QualiteGraines
  poids_graines_g?: number

  id_variete_resultat?: number
  id_packgraine_resultat?: number

  statut: StatutCroisement
  notes?: string
  created_at?: string
}

export interface CroisementCreate {
  nom_croisement: string
  type_croisement?: TypeCroisement
  id_variete_mere?: number
  pheno_mere?: string
  notes_mere?: string
  id_pollen?: number
  id_variete_pere?: number
  pheno_pere?: string
  pere_reverse?: boolean
  notes_pere?: string
  date_pollinisation?: string
  methode?: MethodePollinisation
  zone_pollinisee?: string
  quantite_pollen_utilisee_g?: number
  statut?: StatutCroisement
  notes?: string
}

export interface CroisementUpdate extends Partial<CroisementCreate> {}

export interface RecolteGrainesInput {
  date_recolte_graines: string
  nb_graines: number
  qualite_graines?: QualiteGraines
  poids_graines_g?: number
  // Breeder
  id_breeder?: number
  nom_breeder_nouveau?: string
  // Variete
  creer_variete?: boolean
  nom_variete_resultat?: string
  id_variete_existante?: number   // si creer_variete=false → variété à lier
  // Pack + graines
  creer_packgraine?: boolean
  types_graines?: string
}

// --- API calls ---

export const croisementAPI = {
  // Croisements
  list: (statut?: StatutCroisement) =>
    client.get<Croisement[]>('/croisements/', { params: statut ? { statut } : undefined }),
  get: (id: number) => client.get<Croisement>(`/croisements/${id}`),
  create: (data: CroisementCreate) => client.post<Croisement>('/croisements/', data),
  update: (id: number, data: CroisementUpdate) => client.put<Croisement>(`/croisements/${id}`, data),
  delete: (id: number) => client.delete(`/croisements/${id}`),
  finaliserRecolte: (id: number, data: RecolteGrainesInput) =>
    client.post<Croisement>(`/croisements/${id}/recolte`, data),

  // Pollen
  listPollen: (actifOnly = false) =>
    client.get<Pollen[]>('/croisements/pollen', { params: { actif_only: actifOnly } }),
  getPollen: (id: number) => client.get<Pollen>(`/croisements/pollen/${id}`),
  createPollen: (data: PollenCreate) => client.post<Pollen>('/croisements/pollen', data),
  updatePollen: (id: number, data: PollenUpdate) =>
    client.put<Pollen>(`/croisements/pollen/${id}`, data),
  deletePollen: (id: number) => client.delete(`/croisements/pollen/${id}`),
}
