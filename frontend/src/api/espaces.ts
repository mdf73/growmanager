import client from './client'

export interface EspaceMateriel {
  id_espace_materiel: number
  id_materiel:        number
  date_assignation?:  string
  notes?:             string
  nom_materiel?:      string
  categorie?:         string
  marque?:            string
  etat?:              string
}

export interface EspaceCulture {
  id_espace:              number
  nom:                    string
  type_espace?:           string
  id_materiel_principal?: number
  nom_materiel_principal?: string
  dimensions?:            string
  surface_m2?:            number
  hauteur_cm?:            number
  statut?:                string   // Actif | Inactif | Maintenance
  notes?:                 string
  equipements:            EspaceMateriel[]
}

export type EspaceCultureCreate = Omit<EspaceCulture, 'id_espace' | 'nom_materiel_principal'> & {
  equipements: Omit<EspaceMateriel, 'id_espace_materiel' | 'nom_materiel' | 'categorie' | 'marque' | 'etat'>[]
}
export type EspaceCultureUpdate = Partial<EspaceCultureCreate>

export interface MaterielEnUse {
  id_materiel: number
  id_espace:   number
  nom_espace:  string
}

export const espacesAPI = {
  getAll:           ()                                              => client.get<EspaceCulture[]>('/espaces/'),
  getById:          (id: number)                                    => client.get<EspaceCulture>(`/espaces/${id}`),
  getMaterielEnUse: ()                                              => client.get<MaterielEnUse[]>('/espaces/materiel-en-use'),
  create:           (data: EspaceCultureCreate)                     => client.post<EspaceCulture>('/espaces/', data),
  update:           (id: number, data: EspaceCultureUpdate)         => client.put<EspaceCulture>(`/espaces/${id}`, data),
  delete:           (id: number)                                    => client.delete(`/espaces/${id}`),
  exportCSV:        ()                                              => client.get('/espaces/export/csv', { responseType: 'blob' }),
  importCSV: (file: File) => {
    const form = new FormData()
    form.append('file', file)
    return client.post('/espaces/import', form, { headers: { 'Content-Type': 'multipart/form-data' } })
  },
}
