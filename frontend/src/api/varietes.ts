import client from './client'

export interface Variete {
  id_variete: number
  nom_variete: string
  croisement_variete?: string
  informations_variete?: string
  lien_web?: string
}

export const varieteAPI = {
  getAll: () => client.get<Variete[]>('/varietes/'),
  getById: (id: number) => client.get<Variete>(`/varietes/${id}`),
  create: (data: Omit<Variete, 'id_variete'>) =>
    client.post<Variete>('/varietes/', data),
  update: (id: number, data: Omit<Variete, 'id_variete'>) =>
    client.put<Variete>(`/varietes/${id}`, data),
  delete: (id: number) => client.delete(`/varietes/${id}`),
}
