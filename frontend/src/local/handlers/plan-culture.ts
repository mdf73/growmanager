// ─── Handlers locaux : Plan de culture ────────────────────────────────────────
// Miroir de backend/app/routers/plan_culture.py (export CSV → non porté, 501)
import { route, LocalHttpError } from '../router'
import { query, one, oneOr404, insert, updateById, run } from '../helpers'

type Row = Record<string, unknown>

// Formule calibrée : nb_pots ≈ surface_m2 × 20.8 × volume_l^(-0.59)
const POT_K = 20.8
const POT_ALPHA = 0.59

function calcNbPots(surfaceM2: number, volumeL: number): number {
  if (volumeL <= 0 || surfaceM2 <= 0) return 0
  return Math.max(0, Math.round(surfaceM2 * POT_K * Math.pow(volumeL, -POT_ALPHA)))
}

async function enrichVariete(pv: Row): Promise<Row> {
  const pack = await one<Row>('SELECT * FROM "PackGraine" WHERE id_packgraine = ?', [pv.id_packgraine])
  const graines = await query<Row>(
    `SELECT g.*, v.nom_variete, b.nom_breeder FROM "Graine" g
     LEFT JOIN "Variete" v ON v.id_variete = g.id_variete
     LEFT JOIN "Breeder" b ON b.id_breeder = g.id_breeder
     WHERE g.id_packgraine = ? ORDER BY g.id_graine`, [pv.id_packgraine])

  const stockDisponible = graines.filter(g => !Number(g.utilisee)).length
  const paquetOuvert = graines.some(g => !!Number(g.utilisee))
  const first = graines[0]

  return {
    id_plan_variete: pv.id_plan_variete,
    id_packgraine: pv.id_packgraine,
    nb_plantes: pv.nb_plantes,
    taille_pot_l: pv.taille_pot_l !== null && pv.taille_pot_l !== undefined ? Number(pv.taille_pot_l) : null,
    ordre: pv.ordre ?? 0,
    nom_variete: first?.nom_variete ?? null,
    nom_breeder: first?.nom_breeder ?? null,
    type_graine: first?.types_graines ?? null,
    duree_flo_min: first?.duree_flo_min ?? null,
    duree_flo_max: first?.duree_flo_max ?? null,
    stock_disponible: stockDisponible,
    paquet_ouvert: paquetOuvert,
    prix_achat_pack: pack?.prix_achat ? Number(pack.prix_achat) : null,
    date_achat_pack: pack?.date_achat ? String(pack.date_achat) : null,
    duree_conservation_mois: pack?.duree_conservation_mois ?? null,
  }
}

async function enrichPlan(plan: Row): Promise<Row> {
  let nomEspace: unknown = null
  let surfaceM2: unknown = null
  if (plan.id_espace) {
    const esp = await one<Row>('SELECT nom, surface_m2 FROM "EspaceCulture" WHERE id_espace = ?', [plan.id_espace])
    if (esp) { nomEspace = esp.nom; surfaceM2 = esp.surface_m2 }
  }
  const varietes = await query<Row>(
    'SELECT * FROM "PlanCultureVariete" WHERE id_plan = ? ORDER BY ordre', [plan.id_plan])
  const enriched = await Promise.all(varietes.map(enrichVariete))
  return {
    id_plan: plan.id_plan,
    nom: plan.nom,
    id_espace: plan.id_espace,
    nom_espace: nomEspace,
    surface_m2: surfaceM2,
    statut: plan.statut ?? 'brouillon',
    notes: plan.notes,
    created_at: plan.created_at,
    updated_at: plan.updated_at,
    varietes: enriched,
    nb_plantes_total: varietes.reduce((s, v) => s + Number(v.nb_plantes ?? 0), 0),
  }
}

async function loadPlan(id: unknown): Promise<Row> {
  return oneOr404('SELECT * FROM "PlanCulture" WHERE id_plan = ?', [id], 'Plan introuvable')
}

// ── Utils (avant /:id) ────────────────────────────────────────────────────────

route('GET', '/plan-culture/utils/nb-pots', async ({ query: q }) => {
  const surface = Number(q.get('surface_m2'))
  const taille = Number(q.get('taille_pot_l'))
  if (!(surface > 0) || !(taille > 0)) throw new LocalHttpError(422, 'surface_m2 et taille_pot_l doivent être > 0')
  return {
    data: { surface_m2: surface, taille_pot_l: taille, nb_pots_recommande: calcNbPots(surface, taille) },
  }
})

route('GET', '/plan-culture/utils/catalogue', async ({ query: q }) => {
  const breeder = q.get('breeder')
  const variete = q.get('variete')
  const typeGraine = q.get('type_graine')
  const floMin = q.get('flo_min') ? Number(q.get('flo_min')) : null
  const floMax = q.get('flo_max') ? Number(q.get('flo_max')) : null
  const stockSeulement = q.get('stock_seulement') !== 'false'

  const packs = await query<Row>('SELECT * FROM "PackGraine"')
  const results: Row[] = []
  for (const pack of packs) {
    const graines = await query<Row>(
      `SELECT g.*, v.nom_variete, b.nom_breeder FROM "Graine" g
       LEFT JOIN "Variete" v ON v.id_variete = g.id_variete
       LEFT JOIN "Breeder" b ON b.id_breeder = g.id_breeder
       WHERE g.id_packgraine = ? ORDER BY g.id_graine`, [pack.id_packgraine])
    const stock = graines.filter(g => !Number(g.utilisee)).length
    if (stockSeulement && stock === 0) continue
    const first = graines[0]
    if (!first) continue

    const nomV = first.nom_variete ? String(first.nom_variete) : null
    const nomB = first.nom_breeder ? String(first.nom_breeder) : null
    const typeG = first.types_graines ? String(first.types_graines) : null
    const floMn = first.duree_flo_min !== null && first.duree_flo_min !== undefined ? Number(first.duree_flo_min) : null
    const floMx = first.duree_flo_max !== null && first.duree_flo_max !== undefined ? Number(first.duree_flo_max) : null

    if (breeder && nomB && !nomB.toLowerCase().includes(breeder.toLowerCase())) continue
    if (variete && nomV && !nomV.toLowerCase().includes(variete.toLowerCase())) continue
    if (typeGraine && typeG && !typeG.toLowerCase().includes(typeGraine.toLowerCase())) continue
    if (floMin && floMx && floMx < floMin) continue
    if (floMax && floMn && floMn > floMax) continue

    results.push({
      id_packgraine: pack.id_packgraine,
      nom_variete: nomV,
      nom_breeder: nomB,
      type_graine: typeG,
      duree_flo_min: floMn,
      duree_flo_max: floMx,
      stock_disponible: stock,
      paquet_ouvert: graines.some(g => !!Number(g.utilisee)),
      prix_achat: pack.prix_achat ? Number(pack.prix_achat) : null,
      date_achat: pack.date_achat ? String(pack.date_achat) : null,
      duree_conservation_mois: pack.duree_conservation_mois ?? null,
      nbr_graines_total: pack.nbr_graines,
    })
  }
  results.sort((a, b) =>
    String(a.nom_variete ?? '').localeCompare(String(b.nom_variete ?? '')) ||
    String(a.nom_breeder ?? '').localeCompare(String(b.nom_breeder ?? '')))
  return { data: results }
})

// ── Plans ─────────────────────────────────────────────────────────────────────

route('GET', '/plan-culture', async () => {
  const plans = await query<Row>('SELECT * FROM "PlanCulture" ORDER BY updated_at DESC')
  const out: Row[] = []
  for (const p of plans) out.push(await enrichPlan(p))
  return { data: out }
})

route('POST', '/plan-culture', async ({ body }) => {
  const p = body as Row
  const now = new Date().toISOString()
  const id = await insert('PlanCulture', {
    nom: p.nom,
    id_espace: p.id_espace ?? null,
    notes: p.notes ?? null,
    statut: 'brouillon',
    created_at: now,
    updated_at: now,
  })
  return { status: 201, data: await enrichPlan((await one<Row>('SELECT * FROM "PlanCulture" WHERE id_plan = ?', [id]))!) }
})

route('GET', '/plan-culture/:id', async ({ params }) => ({
  data: await enrichPlan(await loadPlan(params.id)),
}))

route('PUT', '/plan-culture/:id', async ({ params, body }) => {
  await loadPlan(params.id)
  const p = body as Row
  const upd: Row = { updated_at: new Date().toISOString() }
  for (const f of ['nom', 'id_espace', 'statut', 'notes']) {
    if (p[f] !== null && p[f] !== undefined) upd[f] = p[f]
  }
  await updateById('PlanCulture', 'id_plan', params.id, upd)
  return { data: await enrichPlan((await one<Row>('SELECT * FROM "PlanCulture" WHERE id_plan = ?', [params.id]))!) }
})

route('DELETE', '/plan-culture/:id', async ({ params }) => {
  await loadPlan(params.id)
  await run('DELETE FROM "PlanCultureVariete" WHERE id_plan = ?', [params.id])
  await run('DELETE FROM "PlanCulture" WHERE id_plan = ?', [params.id])
  return { status: 204 }
})

// ── Variétés d'un plan ────────────────────────────────────────────────────────

route('POST', '/plan-culture/:id/varietes', async ({ params, body }) => {
  await loadPlan(params.id)
  const p = body as Row
  const existing = await one<Row>(
    'SELECT id_plan_variete FROM "PlanCultureVariete" WHERE id_plan = ? AND id_packgraine = ?',
    [params.id, p.id_packgraine])
  if (existing) throw new LocalHttpError(409, 'Ce pack est déjà dans le plan.')
  const maxOrdre = await one<{ m: number | null }>(
    'SELECT MAX(ordre) AS m FROM "PlanCultureVariete" WHERE id_plan = ?', [params.id])
  const id = await insert('PlanCultureVariete', {
    id_plan: Number(params.id),
    id_packgraine: p.id_packgraine,
    nb_plantes: p.nb_plantes,
    taille_pot_l: p.taille_pot_l ?? null,
    ordre: (maxOrdre?.m ?? -1) + 1,
  })
  await run('UPDATE "PlanCulture" SET updated_at = ? WHERE id_plan = ?', [new Date().toISOString(), params.id])
  const pv = await one<Row>('SELECT * FROM "PlanCultureVariete" WHERE id_plan_variete = ?', [id])
  return { status: 201, data: await enrichVariete(pv!) }
})

route('PUT', '/plan-culture/:plan_id/varietes/:pv_id', async ({ params, body }) => {
  await oneOr404('SELECT * FROM "PlanCultureVariete" WHERE id_plan_variete = ? AND id_plan = ?',
    [params.pv_id, params.plan_id], 'Variété introuvable dans ce plan')
  const p = body as Row
  const upd: Row = {}
  for (const f of ['nb_plantes', 'taille_pot_l', 'ordre']) {
    if (p[f] !== null && p[f] !== undefined) upd[f] = p[f]
  }
  await updateById('PlanCultureVariete', 'id_plan_variete', params.pv_id, upd)
  const pv = await one<Row>('SELECT * FROM "PlanCultureVariete" WHERE id_plan_variete = ?', [params.pv_id])
  return { data: await enrichVariete(pv!) }
})

route('DELETE', '/plan-culture/:plan_id/varietes/:pv_id', async ({ params }) => {
  await oneOr404('SELECT * FROM "PlanCultureVariete" WHERE id_plan_variete = ? AND id_plan = ?',
    [params.pv_id, params.plan_id], 'Variété introuvable')
  await run('DELETE FROM "PlanCultureVariete" WHERE id_plan_variete = ?', [params.pv_id])
  return { status: 204 }
})
