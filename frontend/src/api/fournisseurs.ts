import client from './client'

export interface Fournisseur {
  id_fournisseur: number
  nom_fournisseur: string
  site_web?: string
}

export const fournisseurAPI = {
  getAll: () => client.get<Fournisseur[]>('/fournisseurs/'),
  create: (data: Omit<Fournisseur, 'id_fournisseur'>) =>
    client.post<Fournisseur>('/fournisseurs/', data),
}
