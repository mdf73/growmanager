import client from './client'

export interface Graine {
  id_graine: number
  id_breeder: number
  id_variete: number
  id_packgraine: number
  duree_flo_min?: number
  duree_flo_max?: number
  types_graines?: string
  prix_achat?: number
  edition_limite: boolean
  date_achat?: string
  utilisee: boolean
}

export interface GraineSimple {
  id_graine: number
  utilisee: boolean
}

export interface PackGraine {
  id_packgraine: number
  id_fournisseur?: number
  nbr_graines: number
  prix_achat?: number
  date_achat?: string
  duree_conservation_mois?: number
}

export interface CatalogueItem {
  id_packgraine: number
  id_fournisseur?: number
  id_breeder?: number
  id_variete?: number
  breeder_nom: string
  variete_nom: string
  croisement_variete?: string
  lien_web?: string
  type_graines?: string
  duree_flo_min?: number
  duree_flo_max?: number
  prix_par_graine?: number
  nbr_graines_total: number
  nbr_graines_restantes: number
  paquet_ouvert: boolean
  edition_limite: boolean
  date_achat?: string
}

export interface PackGraineCompletCreate {
  id_fournisseur?: number
  nbr_graines: number
  prix_achat?: number
  date_achat?: string
  id_breeder: number
  id_variete: number
  croisement_variete?: string
  types_graines?: string
  duree_flo_min?: number
  duree_flo_max?: number
  edition_limite: boolean
}

export interface PackGraineCompletRead {
  id_packgraine: number
  nbr_graines: number
  nbr_graines_crees: number
  breeder_nom: string
  variete_nom: string
}

export const graineAPI = {
  getAll: () => client.get<Graine[]>('/graines'),
  getById: (id: number) => client.get<Graine>(`/graines/${id}`),
  create: (data: Omit<Graine, 'id_graine'>) => client.post<Graine>('/graines', data),
  update: (id: number, data: Omit<Graine, 'id_graine'>) => client.put<Graine>(`/graines/${id}`, data),
}

export const packAPI = {
  getAll: () => client.get<PackGraine[]>('/packs'),
  getById: (id: number) => client.get<PackGraine>(`/packs/${id}`),
}

export const catalogueAPI = {
  get: () => client.get<CatalogueItem[]>('/catalogue'),
}

export const packCompletAPI = {
  create: (data: PackGraineCompletCreate) =>
    client.post<PackGraineCompletRead>('/packs/complet', data),
  update: (id: number, data: Omit<PackGraineCompletCreate, 'nbr_graines'> & { nbr_graines?: number }) =>
    client.put<PackGraineCompletRead>(`/packs/${id}/complet`, data),
  delete: (id: number) => client.delete(`/packs/${id}`),
  getGraines: (id: number) => client.get<GraineSimple[]>(`/packs/${id}/graines`),
}

export const graineActionAPI = {
  toggle: (id: number) => client.patch<GraineSimple>(`/graines/${id}/toggle`, {}),
  delete: (id: number) => client.delete(`/graines/${id}`),
}
