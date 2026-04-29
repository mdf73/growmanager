import client from './client'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PlanVariete {
  id_plan_variete: number
  id_packgraine: number
  nb_plantes: number
  taille_pot_l?: number
  ordre: number
  // Enrichis
  nom_variete?: string
  nom_breeder?: string
  type_graine?: string
  duree_flo_min?: number
  duree_flo_max?: number
  stock_disponible: number
  paquet_ouvert: boolean
  prix_achat_pack?: number
  date_achat_pack?: string
  duree_conservation_mois?: number
}

export interface PlanCulture {
  id_plan: number
  nom: string
  id_espace?: number
  nom_espace?: string
  surface_m2?: number
  statut: 'brouillon' | 'pret' | 'lance'
  notes?: string
  created_at?: string
  updated_at?: string
  varietes: PlanVariete[]
  nb_plantes_total: number
}

export interface PlanCultureCreate {
  nom: string
  id_espace?: number
  notes?: string
}

export interface PlanCultureUpdate {
  nom?: string
  id_espace?: number
  statut?: string
  notes?: string
}

export interface PlanVarieteCreate {
  id_packgraine: number
  nb_plantes?: number
  taille_pot_l?: number
}

export interface PlanVarieteUpdate {
  nb_plantes?: number
  taille_pot_l?: number
}

export interface CatalogueItem {
  id_packgraine: number
  nom_variete?: string
  nom_breeder?: string
  type_graine?: string
  duree_flo_min?: number
  duree_flo_max?: number
  stock_disponible: number
  paquet_ouvert: boolean
  prix_achat?: number
  date_achat?: string
  duree_conservation_mois?: number
  nbr_graines_total?: number
}

// ─── API calls ────────────────────────────────────────────────────────────────

export const planCultureAPI = {
  // Plans
  getAll: () => client.get<PlanCulture[]>('/plan-culture/'),
  getOne: (id: number) => client.get<PlanCulture>(`/plan-culture/${id}`),
  create: (data: PlanCultureCreate) => client.post<PlanCulture>('/plan-culture/', data),
  update: (id: number, data: PlanCultureUpdate) => client.put<PlanCulture>(`/plan-culture/${id}`, data),
  delete: (id: number) => client.delete(`/plan-culture/${id}`),

  // Variétés d'un plan
  addVariete: (planId: number, data: PlanVarieteCreate) =>
    client.post<PlanVariete>(`/plan-culture/${planId}/varietes`, data),
  updateVariete: (planId: number, pvId: number, data: PlanVarieteUpdate) =>
    client.put<PlanVariete>(`/plan-culture/${planId}/varietes/${pvId}`, data),
  removeVariete: (planId: number, pvId: number) =>
    client.delete(`/plan-culture/${planId}/varietes/${pvId}`),

  // Export CSV
  exportCSV: (planId: number) => {
    // Déclenche le téléchargement directement (pas d'axios — on veut un vrai download)
    const baseUrl = (client.defaults.baseURL || '').replace(/\/$/, '')
    const url = `${baseUrl}/plan-culture/${planId}/export/csv`
    const a = document.createElement('a')
    a.href = url
    a.download = ''
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  },

  // Calcul pots
  calcNbPots: (surface_m2: number, taille_pot_l: number) =>
    client.get<{ nb_pots_recommande: number }>('/plan-culture/utils/nb-pots', {
      params: { surface_m2, taille_pot_l },
    }),

  // Catalogue filtrable
  getCatalogue: (params?: {
    breeder?: string
    variete?: string
    type_graine?: string
    flo_min?: number
    flo_max?: number
    stock_seulement?: boolean
  }) => client.get<CatalogueItem[]>('/plan-culture/utils/catalogue', { params }),
}
