import client from './client'

export interface RecetteFermentationLigne {
  id_ligne?:    number
  id_produit:   number
  quantite:     number
  unite?:       string
  note_ligne?:  string
  ordre:        number
  nom_produit?: string
  type_produit?: string
}

export interface RecetteFermentation {
  id_recette_ferm:    number
  nom_recette:        string
  type_fermentation?: string
  volume_total?:      number
  unite_volume?:      string   // L | mL
  duree_fermentation?: number  // heures
  notes?:             string
  lignes:             RecetteFermentationLigne[]
}

export type RecetteFermentationCreate = Omit<RecetteFermentation, 'id_recette_ferm'>
export type RecetteFermentationUpdate = Partial<RecetteFermentationCreate>

export const recetteFermentationAPI = {
  getAll:    ()                                                => client.get<RecetteFermentation[]>('/recettes-fermentation/'),
  getById:   (id: number)                                      => client.get<RecetteFermentation>(`/recettes-fermentation/${id}`),
  create:    (data: RecetteFermentationCreate)                 => client.post<RecetteFermentation>('/recettes-fermentation/', data),
  update:    (id: number, data: RecetteFermentationUpdate)     => client.put<RecetteFermentation>(`/recettes-fermentation/${id}`, data),
  delete:    (id: number)                                      => client.delete(`/recettes-fermentation/${id}`),
  exportCSV: ()                                                => client.get('/recettes-fermentation/export/csv', { responseType: 'blob' }),
  importCSV: (file: File) => {
    const form = new FormData(); form.append('file', file)
    return client.post('/recettes-fermentation/import', form, { headers: { 'Content-Type': 'multipart/form-data' } })
  },
}
