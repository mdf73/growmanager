import client from './client'

export interface RecetteLSOLigne {
  id_ligne?:    number
  id_produit:   number
  quantite:     number
  unite?:       string   // mL | L | g | Kg
  note_ligne?:  string
  ordre:        number
  nom_produit?: string
  type_produit?: string
}

export interface RecetteLSO {
  id_recette_lso:  number
  nom_recette:     string
  type_lso?:       string
  quantite_totale?: number
  unite_quantite?:  string   // L | Kg
  notes?:          string
  lignes:          RecetteLSOLigne[]
}

export type RecetteLSOCreate = Omit<RecetteLSO, 'id_recette_lso'>
export type RecetteLSOUpdate = Partial<RecetteLSOCreate>

export const recetteLSOAPI = {
  getAll:    ()                                       => client.get<RecetteLSO[]>('/recettes-lso/'),
  getById:   (id: number)                             => client.get<RecetteLSO>(`/recettes-lso/${id}`),
  create:    (data: RecetteLSOCreate)                 => client.post<RecetteLSO>('/recettes-lso/', data),
  update:    (id: number, data: RecetteLSOUpdate)     => client.put<RecetteLSO>(`/recettes-lso/${id}`, data),
  delete:    (id: number)                             => client.delete(`/recettes-lso/${id}`),
  exportCSV: ()                                       => client.get('/recettes-lso/export/csv', { responseType: 'blob' }),
  importCSV: (file: File) => {
    const form = new FormData(); form.append('file', file)
    return client.post('/recettes-lso/import', form, { headers: { 'Content-Type': 'multipart/form-data' } })
  },
}
