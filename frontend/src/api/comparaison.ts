import client from './client'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface HauteurPoint {
  jour_offset: number
  hauteur_cm:  number
  plante:      string
}

export interface ArrosageCumulPoint {
  jour_offset:      number
  volume_cumul_ml:  number
}

export interface LampeInfo {
  nom:         string
  marque:      string | null
  puissance_w: number | null
}

export interface RecetteCoutDetail {
  nom_recette:    string
  volume_l:       number
  cout:           number
  cout_par_litre: number | null
  nb_actions:     number
}

export interface CultureCompare {
  id_culture:              number
  nom:                     string
  statut:                  string
  date_debut:              string | null
  date_fin:                string | null
  type_culture:            string | null
  type_eclairage:          string | null
  nom_espace:              string | null
  lampes:                  LampeInfo[]
  puissance_w_total:       number | null
  is_lso:                  boolean
  tco_par_type:            Record<string, number>
  nb_tco_total:            number
  marques_engrais:         string[]
  nb_plantes:              number
  nb_plantes_recoltees:    number
  varietes:                string[]
  duree_totale_j:          number | null
  duree_veg_j:             number | null
  duree_flo_j:             number | null
  rendement_total_g:       number | null
  rendement_par_plante_g:  number | null
  cout_total:              number | null
  cout_par_gramme:         number | null
  cout_engrais:            number | null
  cout_electricite:        number | null
  cout_graines:            number | null
  volume_arrosage_total_l:   number | null
  volume_arrosage_engrais_l: number | null
  details_cout_engrais:    RecetteCoutDetail[]
  hauteurs:                HauteurPoint[]
  arrosages_cumules:       ArrosageCumulPoint[]
}

export interface CultureSelectItem {
  id_culture: number
  nom:        string
  statut:     string
  date_debut: string | null
}

// ─── API ──────────────────────────────────────────────────────────────────────

export async function compareCultures(ids: number[]): Promise<CultureCompare[]> {
  const res = await client.get<CultureCompare[]>('/cultures/compare', {
    params: { ids: ids.join(',') },
  })
  return res.data
}

export async function getAllCulturesForSelect(): Promise<CultureSelectItem[]> {
  const results = await Promise.allSettled([
    client.get('/cultures'),
    client.get('/cultures', { params: { statut: 'terminee' } }),
    client.get('/cultures', { params: { statut: 'sechage_curing' } }),
  ])

  const all: any[] = []
  for (const r of results) {
    if (r.status === 'fulfilled' && Array.isArray(r.value.data)) {
      all.push(...r.value.data)
    }
  }

  const seen = new Set<number>()
  return all
    .filter((c: any) => {
      if (seen.has(c.id_culture)) return false
      seen.add(c.id_culture)
      return true
    })
    .map((c: any) => ({
      id_culture: c.id_culture,
      nom:        c.nom || `Culture #${c.id_culture}`,
      statut:     c.statut,
      date_debut: c.date_debut || null,
    }))
    .sort((a, b) => {
      const order: Record<string, number> = { active: 0, sechage_curing: 1, terminee: 2 }
      const so = (order[a.statut] ?? 3) - (order[b.statut] ?? 3)
      if (so !== 0) return so
      return (b.date_debut || '').localeCompare(a.date_debut || '')
    })
}
