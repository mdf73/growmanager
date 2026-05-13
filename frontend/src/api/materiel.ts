import axios from 'axios'

// ── Caractéristiques par catégorie ────────────────────────────────────────────
export interface CaractLampe {
  type?:      string          // LED | HPS | MH | CMH
  puissance_w?: number
  dimmer?:    boolean
  spectres?:  string[]        // max 5 entrées
}
export interface CaractPot {
  volume_l?:  number
  matiere?:   string          // plastique | tissu | céramique | autre
}
export interface CaractCoupelle {
  volume_l?:  number
  dimensions?: string         // ex: "30x20x10"
}
export interface CaractArrosage {
  type?:       string         // goutte-à-goutte | arrosoir
  debit_lh?:   number
  capacite_l?: number
}
export interface CaractTente {
  dimensions?: string         // ex: "120x120x200"
}
export interface CaractPompe {
  type?:      string          // pompe à eau | bulleur | pompe à air
  debit_lh?:  number
}
export interface CaractVentilation {
  type?:        string        // extracteur | intracteur | ventilateur | ventilateur oscillant
  debit_m3h?:   number
  diametre_mm?: number
}
export interface CaractFilet {
  type?:       string         // LST | SCROG
  maille_mm?:  number
  dimensions?: string
}
export interface CaractSechage {
  type?:       string         // filet | penderie | rack
  capacite?:   string         // ex: "10 couches" | "5 kg"
  dimensions?: string
}
export interface CaractOutil {
  type?: string               // cisailles | loupe | pH-mètre | EC-mètre | autre
}

export interface CaractBocal {
  volume_ml?:  number         // toujours stocké en mL
  fermeture?:  string         // Couvercle à vis | Bail clasp | Mason Jar | Autre
  couleur?:    string         // Clair | Ambré | Teinté
  usage?:      string         // Curing | Stockage | Fermentation | Autre
}

/** Génère le nom automatique d'un bocal/pot selon volume + marque + index */
export function genBocalNom(volumeMl: number | null, marque: string, index: number): string {
  const type   = volumeMl != null && volumeMl >= 500 ? 'Bocal' : 'Pot'
  const volStr = volumeMl != null
    ? (volumeMl >= 1000 ? `${volumeMl / 1000}L` : `${volumeMl}mL`)
    : ''
  const parts = [type, volStr, marque.trim()].filter(Boolean)
  return `${parts.join(' ')} #${index}`
}

export type Caracteristiques =
  | CaractLampe | CaractPot | CaractCoupelle | CaractArrosage
  | CaractTente | CaractPompe | CaractVentilation | CaractFilet
  | CaractSechage | CaractOutil | CaractBocal
  | Record<string, unknown>

// ── Types maîtres ─────────────────────────────────────────────────────────────
export const CATEGORIES = [
  'Bocaux',
  'Lampes',
  'Pots',
  'Coupelles et bacs',
  'Arrosage',
  'Tentes',
  'Pompes et Bulleurs',
  'Ventilation',
  'Filets',
  'Séchage',
  'Outils',
] as const
export type Categorie = typeof CATEGORIES[number]

export const ETATS = ['Neuf', 'Bon état', 'Usagé', 'Hors service'] as const

// ── Interface principale ───────────────────────────────────────────────────────
export interface Materiel {
  id_materiel:       number
  categorie:         string
  nom:               string
  marque:            string | null
  code_barre_serial: string | null
  date_achat:        string | null
  prix_achat:        number | null
  site_achat:        string | null
  etat:              string | null
  date_sortie_stock: string | null
  notes:             string | null
  caracteristiques:  Caracteristiques | null
  age_jours:         number | null
}

export interface MaterielCreate {
  categorie:         string
  nom:               string
  marque?:           string | null
  code_barre_serial?: string | null
  date_achat?:       string | null
  prix_achat?:       number | null
  site_achat?:       string | null
  etat?:             string | null
  date_sortie_stock?: string | null
  notes?:            string | null
  caracteristiques?: Caracteristiques | null
}

export type MaterielUpdate = Partial<MaterielCreate>

// ── Types timeline bocal ──────────────────────────────────────────────────────
export interface VarieteMin { id_variete: number; nom_variete: string }
export interface BreederMin { id_breeder: number; nom_breeder: string }
export interface GraineMin {
  id_graine: number
  types_graines: string | null
  variete: VarieteMin | null
  breeder: BreederMin | null
}
export interface CultureMin {
  id_culture: number
  nom: string
  date_debut: string | null
  date_passage_12_12: string | null
  date_debut_floraison: string | null
  date_recolte_estimee: string | null
}
export interface SechageMin {
  id_session_sechage: number
  nom: string | null
  date_debut: string | null
  date_fin: string | null
}
export interface PlantTimeline {
  id_plant: number
  nom_affichage: string
  date_recolte: string | null
  poids_recolte_g: number | null
  poids_debut_curing_g: number | null
  poids_final_curing_g: number | null
  graine: GraineMin | null
  culture: CultureMin | null
  sechage: SechageMin | null
}
export interface SessionCuringTimeline {
  id_session_curing: number
  nom: string | null
  date_debut: string | null
  date_fin: string | null
  statut: string | null
  plants: PlantTimeline[]
}
export interface StockTimeline {
  id_stock: number
  type_stock: string | null
  sous_type_stock: string | null
  quantite_stock: number | null
  date_stock: string | null
  date_fin_stock: string | null
  variete: VarieteMin | null
}
export interface BocalTimeline {
  bocal: Materiel
  sessions_curing: SessionCuringTimeline[]
  stocks: StockTimeline[]
}

// ── API ───────────────────────────────────────────────────────────────────────
export const materielAPI = {
  getAll: () =>
    axios.get<Materiel[]>('/api/materiel'),

  create: (payload: MaterielCreate) =>
    axios.post<Materiel>('/api/materiel', payload),

  update: (id: number, payload: MaterielUpdate) =>
    axios.patch<Materiel>(`/api/materiel/${id}`, payload),

  delete: (id: number) =>
    axios.delete(`/api/materiel/${id}`),

  exportCsv: () =>
    axios.get('/api/materiel/export/csv', { responseType: 'blob' }),

  bocalTimeline: (id: number) =>
    axios.get<BocalTimeline>(`/api/materiel/${id}/bocal-timeline`),
}
