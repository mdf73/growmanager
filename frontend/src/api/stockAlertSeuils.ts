import client from './client'

// ── Types ────────────────────────────────────────────────────────────────────

export interface StockAlertSeuil {
  type_stock: string
  seuil_bocal_g?: number | null
  seuil_bocal_pct?: number | null
  seuil_total_g?: number | null
  actif: boolean
}

export interface SeuilUpsert {
  seuil_bocal_g?: number | null
  seuil_bocal_pct?: number | null
  seuil_total_g?: number | null
  actif: boolean
}

export interface BocalAlertDetail {
  id_stock: number
  variete_nom?: string | null
  quantite_stock: number
  quantite_initiale?: number | null
  pct_restant?: number | null
  raison: 'g' | 'pct' | 'g+pct'
}

export interface StockAlertResult {
  type_stock: string
  seuil_bocal_g?: number | null
  seuil_bocal_pct?: number | null
  seuil_total_g?: number | null
  nb_bocaux_bas: number
  bocaux_bas: BocalAlertDetail[]
  total_g: number
  alerte_total: boolean
}

// ── API ──────────────────────────────────────────────────────────────────────

export const stockAlertSeuilsAPI = {
  getAll: () =>
    client.get<StockAlertSeuil[]>('/stock-alert-seuils'),

  upsert: (type_stock: string, payload: SeuilUpsert) =>
    client.put<StockAlertSeuil>(`/stock-alert-seuils/${encodeURIComponent(type_stock)}`, payload),

  delete: (type_stock: string) =>
    client.delete(`/stock-alert-seuils/${encodeURIComponent(type_stock)}`),

  check: () =>
    client.get<StockAlertResult[]>('/stock-alert-seuils/check'),
}
