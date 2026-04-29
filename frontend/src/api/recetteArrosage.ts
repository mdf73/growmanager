import client from './client'

export interface RecetteArrosageLigne {
  id_ligne?:    number
  id_produit:   number
  quantite:     number
  unite?:       string   // g | Kg | mL | L
  note_ligne?:  string
  ordre:        number
  nom_produit?: string
  type_produit?: string
}

export interface RecetteArrosage {
  id_recette_arrosage: number
  nom_recette:   string
  type_arrosage?: string   // Eau simple | Eau + amendements
  quantite_eau?:  number
  unite_eau?:     string   // L | mL
  notes?:         string
  lignes:         RecetteArrosageLigne[]
}

export type RecetteArrosageCreate = Omit<RecetteArrosage, 'id_recette_arrosage'>
export type RecetteArrosageUpdate = Partial<RecetteArrosageCreate>

export const recetteArrosageAPI = {
  getAll:    ()                                              => client.get<RecetteArrosage[]>('/recettes-arrosage/'),
  getById:   (id: number)                                    => client.get<RecetteArrosage>(`/recettes-arrosage/${id}`),
  create:    (data: RecetteArrosageCreate)                   => client.post<RecetteArrosage>('/recettes-arrosage/', data),
  update:    (id: number, data: RecetteArrosageUpdate)       => client.put<RecetteArrosage>(`/recettes-arrosage/${id}`, data),
  delete:    (id: number)                                    => client.delete(`/recettes-arrosage/${id}`),
  exportCSV: ()                                              => client.get('/recettes-arrosage/export/csv', { responseType: 'blob' }),
  importCSV: (file: File) => {
    const form = new FormData(); form.append('file', file)
    return client.post('/recettes-arrosage/import', form, { headers: { 'Content-Type': 'multipart/form-data' } })
  },
}
