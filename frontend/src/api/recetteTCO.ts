import client from './client'

export interface RecetteTCOLigne {
  id_ligne?:    number
  id_produit:   number
  quantite:     number
  unite?:       string   // mL | L | g | Kg
  note_ligne?:  string
  ordre:        number
  // enrichis depuis le backend
  nom_produit?: string
  type_produit?: string
}

export interface RecetteTCO {
  id_recette_tco:       number
  nom_recette:          string
  type_tco?:            string   // Croissance | Stretch | Floraison | Correctif
  quantite_tco?:        number
  unite_tco?:           string   // L | mL
  duree_oxygenation_h?: number   // heures d'oxygénation avant utilisation
  notes?:               string
  lignes:               RecetteTCOLigne[]
}

export type RecetteTCOCreate = Omit<RecetteTCO, 'id_recette_tco'>
export type RecetteTCOUpdate = Partial<RecetteTCOCreate>

export const recetteTCOAPI = {
  getAll:    ()                                           => client.get<RecetteTCO[]>('/recettes-tco/'),
  getById:   (id: number)                                 => client.get<RecetteTCO>(`/recettes-tco/${id}`),
  create:    (data: RecetteTCOCreate)                     => client.post<RecetteTCO>('/recettes-tco/', data),
  update:    (id: number, data: RecetteTCOUpdate)         => client.put<RecetteTCO>(`/recettes-tco/${id}`, data),
  delete:    (id: number)                                 => client.delete(`/recettes-tco/${id}`),
  exportCSV: ()                                           => client.get('/recettes-tco/export/csv', { responseType: 'blob' }),
  importCSV: (file: File) => {
    const form = new FormData(); form.append('file', file)
    return client.post('/recettes-tco/import', form, { headers: { 'Content-Type': 'multipart/form-data' } })
  },
}
