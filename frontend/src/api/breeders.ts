import client from './client'

export interface Breeder {
  id_breeder: number
  nom_breeder: string
  origine_breeder?: string
  information_breeder?: string
}

export const breederAPI = {
  getAll: () => client.get<Breeder[]>('/breeders/'),
  getById: (id: number) => client.get<Breeder>(`/breeders/${id}`),
  create: (data: Omit<Breeder, 'id_breeder'>) =>
    client.post<Breeder>('/breeders/', data),
  update: (id: number, data: Omit<Breeder, 'id_breeder'>) =>
    client.put<Breeder>(`/breeders/${id}`, data),
  delete: (id: number) => client.delete(`/breeders/${id}`),
}
