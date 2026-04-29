import client from './client'

export interface ProduitEngrais {
  id_produit:             number
  nom_produit:            string
  marque?:                string
  type_produit?:          string
  conditionnement?:       string
  volume_conditionnement?: number
  unite_volume?:          string   // mL | L | g | Kg
  prix_achat?:            number
  date_achat?:            string
  date_peremption?:       string
  quantite_stock?:        number
  unite_quantite?:        string   // g | mL
  dosage_conseille?:      string
  notes?:                 string
}

export interface AchatEngrais {
  id_achat:        number
  id_produit:      number
  date_achat?:     string
  volume_achat?:   number
  unite_volume?:   string
  prix_achat?:     number
  date_peremption?: string
  conditionnement?: string
  notes?:          string
  created_at?:     string
}

export interface RechargePayload {
  date_achat?:     string
  volume_achat?:   number
  unite_volume?:   string
  prix_achat?:     number
  date_peremption?: string
  conditionnement?: string
  notes?:          string
}

export const engraisAPI = {
  getAll: () => client.get<ProduitEngrais[]>('/engrais/'),
  getOne: (id: number) => client.get<ProduitEngrais>(`/engrais/${id}`),
  create: (data: Omit<ProduitEngrais, 'id_produit'>) =>
    client.post<ProduitEngrais>('/engrais/', data),
  update: (id: number, data: Partial<Omit<ProduitEngrais, 'id_produit'>>) =>
    client.put<ProduitEngrais>(`/engrais/${id}`, data),
  delete: (id: number) => client.delete(`/engrais/${id}`),

  // Gestion du stock
  getAchats:   (id: number) => client.get<AchatEngrais[]>(`/engrais/${id}/achats`),
  recharger:   (id: number, data: RechargePayload) =>
    client.post<ProduitEngrais>(`/engrais/${id}/recharger`, data),
  viderStock:  (id: number) =>
    client.post<ProduitEngrais>(`/engrais/${id}/vider-stock`, {}),
}
