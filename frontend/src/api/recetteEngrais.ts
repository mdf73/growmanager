import client from './client'

export interface RecetteEngraisLigne {
  id_ligne?:    number
  id_produit:   number
  dosage:       number
  unite?:       string   // mL/L | g/L
  ordre:        number
  // enrichis depuis le backend
  nom_produit?: string
  type_produit?: string
}

export interface RecetteEngrais {
  id_recette:   number
  nom_recette:  string
  type_recette?: string   // Arrosage | Pulvérisation
  periode?:     string
  semaine?:     number
  ph_cible?:    number
  notes?:       string
  lignes:       RecetteEngraisLigne[]
}

export type RecetteEngraisCreate = Omit<RecetteEngrais, 'id_recette'>
export type RecetteEngraisUpdate = Partial<RecetteEngraisCreate>

export const recetteEngraisAPI = {
  getAll:    ()                                             => client.get<RecetteEngrais[]>('/recettes-engrais/'),
  getById:   (id: number)                                   => client.get<RecetteEngrais>(`/recettes-engrais/${id}`),
  create:    (data: RecetteEngraisCreate)                   => client.post<RecetteEngrais>('/recettes-engrais/', data),
  update:    (id: number, data: RecetteEngraisUpdate)       => client.put<RecetteEngrais>(`/recettes-engrais/${id}`, data),
  delete:    (id: number)                                   => client.delete(`/recettes-engrais/${id}`),
  exportCSV: ()                                             => client.get('/recettes-engrais/export/csv', { responseType: 'blob' }),
  importCSV: (file: File) => {
    const form = new FormData(); form.append('file', file)
    return client.post('/recettes-engrais/import', form, { headers: { 'Content-Type': 'multipart/form-data' } })
  },
}
