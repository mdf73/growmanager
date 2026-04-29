import client from './client'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface VapoConsommable {
  id_consommable:   number
  id_vaporisateur:  number | null
  type_consommable: string
  diametre_mm:      number | null
  matiere:          string | null
  date_achat:       string | null
  prix_achat:       number | null
  notes:            string | null
  created_at:       string | null
}

export interface Vaporisateur {
  id_vaporisateur:   number
  nom:               string
  modele:            string | null
  marque:            string | null
  date_achat:        string | null
  prix_achat:        number | null
  numero_serie:      string | null
  type_chauffe:      string | null
  a_eau:             boolean | null
  temp_min:          number | null
  temp_max:          number | null
  compatibilites:    string | null
  type_batterie:     string | null
  autonomie_sessions: number | null
  autonomie_mah:     number | null
  temps_chauffe_s:   number | null
  type_charge:       string | null
  nbr_sessions:      number
  notes:             string | null
  created_at:        string | null
  consommables:      VapoConsommable[]
}

export type VaporisateurCreate = Omit<Vaporisateur, 'id_vaporisateur' | 'created_at' | 'consommables'>
export type VapoConsommableCreate = Omit<VapoConsommable, 'id_consommable' | 'created_at'>

// ── API ───────────────────────────────────────────────────────────────────────

export const vaporisateurAPI = {
  getAll:  () => client.get<Vaporisateur[]>('/vaporisateurs/'),
  getOne:  (id: number) => client.get<Vaporisateur>(`/vaporisateurs/${id}`),
  create:  (data: VaporisateurCreate) => client.post<Vaporisateur>('/vaporisateurs/', data),
  update:  (id: number, data: VaporisateurCreate) => client.put<Vaporisateur>(`/vaporisateurs/${id}`, data),
  delete:  (id: number) => client.delete(`/vaporisateurs/${id}`),
  addSession: (id: number) => client.post(`/vaporisateurs/${id}/session`),

  // auto-complétion
  getMarques: () => client.get<string[]>('/vaporisateurs/marques'),
  getModeles: () => client.get<string[]>('/vaporisateurs/modeles'),

  // consommables
  createConsommable: (data: VapoConsommableCreate) =>
    client.post<VapoConsommable>('/vaporisateurs/consommables', data),
  updateConsommable: (id: number, data: VapoConsommableCreate) =>
    client.put<VapoConsommable>(`/vaporisateurs/consommables/${id}`, data),
  deleteConsommable: (id: number) =>
    client.delete(`/vaporisateurs/consommables/${id}`),
}
