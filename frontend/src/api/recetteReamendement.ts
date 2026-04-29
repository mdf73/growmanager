import client from './client'

export interface RecetteReamendementLigne {
  id_ligne?:    number
  id_produit:   number
  quantite:     number
  unite?:       string   // g | Kg | mL | L
  note_ligne?:  string
  ordre:        number
  nom_produit?: string
  type_produit?: string
}

export interface RecetteReamendement {
  id_recette_reamend: number
  nom_recette:        string
  volume_pot?:        number   // volume du pot en L
  unite_pot?:         string   // L
  notes?:             string
  lignes:             RecetteReamendementLigne[]
}

export type RecetteReamendementCreate = Omit<RecetteReamendement, 'id_recette_reamend'>
export type RecetteReamendementUpdate = Partial<RecetteReamendementCreate>

export const recetteReamendementAPI = {
  getAll:    ()                                               => client.get<RecetteReamendement[]>('/recettes-reamendement/'),
  getById:   (id: number)                                     => client.get<RecetteReamendement>(`/recettes-reamendement/${id}`),
  create:    (data: RecetteReamendementCreate)                => client.post<RecetteReamendement>('/recettes-reamendement/', data),
  update:    (id: number, data: RecetteReamendementUpdate)    => client.put<RecetteReamendement>(`/recettes-reamendement/${id}`, data),
  delete:    (id: number)                                     => client.delete(`/recettes-reamendement/${id}`),
  exportCSV: ()                                               => client.get('/recettes-reamendement/export/csv', { responseType: 'blob' }),
  importCSV: (file: File) => {
    const form = new FormData(); form.append('file', file)
    return client.post('/recettes-reamendement/import', form, { headers: { 'Content-Type': 'multipart/form-data' } })
  },
}
