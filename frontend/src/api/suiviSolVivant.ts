import client from './client'

export interface SuiviReamendement {
  id_suivi_reamend:     number
  id_recette_reamend?:  number
  date_application?:    string
  notes?:               string
  nom_recette_reamend?: string
  cout_estime?:         number
}

export interface SuiviArrosage {
  id_suivi_arrosage:     number
  id_recette_engrais?:   number
  volume_eau_l?:         number
  date_application?:     string
  notes?:                string
  nom_recette_arrosage?: string
  cout_estime?:          number
}

export interface SuiviTCO {
  id_suivi_tco:    number
  id_recette_tco?: number
  volume_applique?: number
  date_application?: string
  notes?:          string
  nom_recette_tco?: string
}

export interface SuiviFermentation {
  id_suivi_ferm:    number
  id_recette_ferm?: number
  volume_applique?: number
  date_application?: string
  notes?:           string
  nom_recette_ferm?: string
}

export interface SuiviCulture {
  id_suivi_culture: number
  description?:     string
  date_debut?:      string
  date_fin?:        string
  notes?:           string
}

export interface SuiviSolVivant {
  id_suivi:           number
  nom_pot:            string
  id_materiel?:       number
  id_recette_lso?:    number
  volume_pot_l?:      number
  date_preparation?:  string
  commentaires?:      string
  nom_recette_lso?:   string
  nom_materiel?:      string
  cout_lso_estime?:   number
  cout_total_estime?: number
  reamendements:      SuiviReamendement[]
  arrosages:          SuiviArrosage[]
  tcos:               SuiviTCO[]
  fermentations:      SuiviFermentation[]
  cultures:           SuiviCulture[]
}

export type SuiviSolVivantCreate = Omit<SuiviSolVivant, 'id_suivi' | 'nom_recette_lso' | 'nom_materiel' | 'cout_lso_estime' | 'cout_total_estime'> & {
  reamendements: Omit<SuiviReamendement, 'id_suivi_reamend' | 'nom_recette_reamend' | 'cout_estime'>[]
  arrosages:     Omit<SuiviArrosage, 'id_suivi_arrosage' | 'nom_recette_arrosage' | 'cout_estime'>[]
  tcos:          Omit<SuiviTCO, 'id_suivi_tco' | 'nom_recette_tco'>[]
  fermentations: Omit<SuiviFermentation, 'id_suivi_ferm' | 'nom_recette_ferm'>[]
  cultures:      Omit<SuiviCulture, 'id_suivi_culture'>[]
}

export const suiviSolVivantAPI = {
  getAll:  ()                                                => client.get<SuiviSolVivant[]>('/suivi-sols-vivants/'),
  getById: (id: number)                                      => client.get<SuiviSolVivant>(`/suivi-sols-vivants/${id}`),
  create:  (data: SuiviSolVivantCreate)                      => client.post<SuiviSolVivant>('/suivi-sols-vivants/', data),
  update:  (id: number, data: Partial<SuiviSolVivantCreate>) => client.put<SuiviSolVivant>(`/suivi-sols-vivants/${id}`, data),
  delete:  (id: number)                                      => client.delete(`/suivi-sols-vivants/${id}`),
  addReamendement: (id: number, data: object)  => client.post<SuiviSolVivant>(`/suivi-sols-vivants/${id}/reamendements`, data),
  addArrosage:     (id: number, data: object)  => client.post<SuiviSolVivant>(`/suivi-sols-vivants/${id}/arrosages`, data),
  addTCO:          (id: number, data: object)  => client.post<SuiviSolVivant>(`/suivi-sols-vivants/${id}/tcos`, data),
  addFermentation: (id: number, data: object)  => client.post<SuiviSolVivant>(`/suivi-sols-vivants/${id}/fermentations`, data),
  addCulture:      (id: number, data: object)  => client.post<SuiviSolVivant>(`/suivi-sols-vivants/${id}/cultures`, data),
}
