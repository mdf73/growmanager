// ─── Handlers locaux : Stock + StockAlertSeuil ────────────────────────────────
// Miroir de backend/app/routers/{stock,stock_alert_seuils}.py (label PDF → 501)
import { route, LocalHttpError } from '../router'
import { query, one, oneOr404, insert, updateById, run, jsonify, boolify } from '../helpers'
import { Row, todayISO } from './cultures-helpers'

const num = (v: unknown): number | null => (v === null || v === undefined ? null : Number(v))

const STOCK_FIELDS = [
  'id_variete', 'id_bocal', 'id_materiel_bocal', 'id_plant', 'type_stock', 'sous_type_stock',
  'lampe_type', 'engrais_type', 'substrat_type', 'maillage', 'type_hash', 'type_rosin',
  'date_stock', 'date_fin_stock', 'quantite_stock',
]

async function enrichStock(s: Row): Promise<Row> {
  const variete = s.id_variete ? await one<Row>('SELECT * FROM "Variete" WHERE id_variete = ?', [s.id_variete]) : null
  const bocal = s.id_bocal ? await one<Row>('SELECT * FROM "Bocal" WHERE id_bocal = ?', [s.id_bocal]) : null
  const matBocal = s.id_materiel_bocal
    ? await one<Row>('SELECT * FROM "Materiel" WHERE id_materiel = ?', [s.id_materiel_bocal]) : null

  let bocalVolumeMl: unknown = null
  if (matBocal) {
    jsonify(matBocal, ['caracteristiques'])
    bocalVolumeMl = (matBocal.caracteristiques as Row | null)?.volume_ml ?? null
  }

  let plantNom: unknown = null
  let plantCultureNom: unknown = null
  if (s.id_plant) {
    const plant = await one<Row>('SELECT * FROM "Plant" WHERE id_plant = ?', [s.id_plant])
    if (plant) {
      plantNom = plant.nom_affichage
      const c = await one<Row>('SELECT nom FROM "Culture" WHERE id_culture = ?', [plant.id_culture])
      plantCultureNom = c?.nom ?? null
    }
  }

  return {
    id_stock: s.id_stock,
    id_variete: s.id_variete,
    id_bocal: s.id_bocal,
    id_materiel_bocal: s.id_materiel_bocal,
    id_plant: s.id_plant,
    type_stock: s.type_stock,
    sous_type_stock: s.sous_type_stock,
    lampe_type: s.lampe_type,
    engrais_type: s.engrais_type,
    substrat_type: s.substrat_type,
    maillage: s.maillage,
    type_hash: s.type_hash,
    type_rosin: s.type_rosin,
    date_stock: s.date_stock,
    date_fin_stock: s.date_fin_stock,
    quantite_stock: Number(s.quantite_stock ?? 0),
    variete_nom: variete?.nom_variete ?? null,
    bocal_taille: bocal?.taille_bocal ?? null,
    bocal_nom: matBocal?.nom ?? null,
    bocal_volume_ml: bocalVolumeMl,
    plant_nom: plantNom,
    plant_culture_nom: plantCultureNom,
  }
}

// ── Routes fixes avant /:id ───────────────────────────────────────────────────

route('GET', '/stock/bocaux-disponibles', async ({ query: q }) => {
  const currentStockId = q.get('current_stock_id')
  let occupiedSql = `SELECT id_materiel_bocal FROM "Stock"
    WHERE id_materiel_bocal IS NOT NULL AND quantite_stock > 0 AND date_fin_stock IS NULL`
  const vals: unknown[] = []
  if (currentStockId !== null) { occupiedSql += ' AND id_stock != ?'; vals.push(Number(currentStockId)) }
  const occupied = new Set((await query<Row>(occupiedSql, vals)).map(r => Number(r.id_materiel_bocal)))

  const bocaux = await query<Row>(`SELECT * FROM "Materiel" WHERE categorie = 'Bocaux' ORDER BY nom`)
  const result: Row[] = []
  for (const b of bocaux) {
    if (occupied.has(Number(b.id_materiel))) continue
    jsonify(b, ['caracteristiques'])
    result.push({
      id_materiel: b.id_materiel,
      nom: b.nom,
      volume_ml: (b.caracteristiques as Row | null)?.volume_ml ?? null,
      label: b.nom,
    })
  }
  return { data: result }
})

// ── CRUD ──────────────────────────────────────────────────────────────────────

route('GET', '/stock', async () => {
  const stocks = await query<Row>('SELECT * FROM "Stock"')
  const out: Row[] = []
  for (const s of stocks) out.push(await enrichStock(s))
  return { data: out }
})

route('GET', '/stock/:id', async ({ params }) => ({
  data: await enrichStock(await oneOr404('SELECT * FROM "Stock" WHERE id_stock = ?', [params.id], 'Stock non trouvé')),
}))

route('POST', '/stock', async ({ body }) => {
  const p = body as Row
  const obj: Row = {}
  for (const f of STOCK_FIELDS) obj[f] = p[f] ?? null
  obj.quantite_initiale = p.quantite_stock ?? null // V4-G — référence pour alertes %
  const id = await insert('Stock', obj)
  const s = await one<Row>('SELECT * FROM "Stock" WHERE id_stock = ?', [id])
  boolify(s!, [])
  return { data: s }
})

route('PUT', '/stock/:id', async ({ params, body }) => {
  const existing = await oneOr404<Row>('SELECT * FROM "Stock" WHERE id_stock = ?', [params.id], 'Stock non trouvé')
  const p = body as Row
  const upd: Row = {}
  for (const f of STOCK_FIELDS.filter(f => f !== 'date_fin_stock')) upd[f] = p[f] ?? null
  // Auto-clôture si quantité ≤ 0
  if (Number(p.quantite_stock ?? 0) <= 0 && !existing.date_fin_stock) {
    upd.quantite_stock = 0
    upd.date_fin_stock = todayISO()
  }
  await updateById('Stock', 'id_stock', params.id, upd)
  return { data: await one<Row>('SELECT * FROM "Stock" WHERE id_stock = ?', [params.id]) }
})

route('POST', '/stock/:id/sortie', async ({ params }) => {
  const s = await oneOr404<Row>('SELECT * FROM "Stock" WHERE id_stock = ?', [params.id], 'Stock non trouvé')
  if (s.date_fin_stock !== null && s.date_fin_stock !== undefined) {
    throw new LocalHttpError(400, 'Ce stock est déjà clôturé')
  }
  await run('UPDATE "Stock" SET quantite_stock = 0, date_fin_stock = ? WHERE id_stock = ?', [todayISO(), params.id])
  const updated = await one<Row>('SELECT * FROM "Stock" WHERE id_stock = ?', [params.id])
  return { data: await enrichStock(updated!) }
})

route('DELETE', '/stock/:id', async ({ params }) => {
  await oneOr404('SELECT * FROM "Stock" WHERE id_stock = ?', [params.id], 'Stock non trouvé')
  await run('DELETE FROM "Stock" WHERE id_stock = ?', [params.id])
  return { status: 204 }
})

// ── Origine (traçabilité) ─────────────────────────────────────────────────────

async function buildPlantOrigine(plant: Row): Promise<Row> {
  let graineOut: Row | null = null
  if (plant.id_graine) {
    const g = await one<Row>('SELECT * FROM "Graine" WHERE id_graine = ?', [plant.id_graine])
    if (g) {
      const b = g.id_breeder
        ? await one<Row>('SELECT id_breeder, nom_breeder FROM "Breeder" WHERE id_breeder = ?', [g.id_breeder]) : null
      graineOut = { id_graine: g.id_graine, types_graines: g.types_graines, breeder: b }
    }
  }

  let sechDebut: unknown = null, sechFin: unknown = null
  const ps = await one<Row>(
    'SELECT * FROM "PlantSechage" WHERE id_plant = ? ORDER BY date_mise_sechage DESC LIMIT 1', [plant.id_plant])
  if (ps) {
    const ss = await one<Row>('SELECT * FROM "SessionSechage" WHERE id_session_sechage = ?', [ps.id_session_sechage])
    if (ss) { sechDebut = ss.date_debut; sechFin = ss.date_fin }
  }

  let curDebut: unknown = null, poidsDebut: number | null = null, poidsFinal: number | null = null
  const pc = await one<Row>(
    'SELECT * FROM "PlantCuring" WHERE id_plant = ? ORDER BY date_mise_curing DESC LIMIT 1', [plant.id_plant])
  if (pc) {
    const sc = await one<Row>('SELECT date_debut FROM "SessionCuring" WHERE id_session_curing = ?', [pc.id_session_curing])
    if (sc) curDebut = sc.date_debut
    poidsDebut = num(pc.poids_debut_g)
    poidsFinal = num(pc.poids_final_g)
  }

  return {
    id_plant: plant.id_plant,
    nom_affichage: plant.nom_affichage,
    date_recolte: plant.date_recolte,
    poids_recolte_g: num(plant.poids_recolte_g),
    statut: plant.statut,
    graine: graineOut,
    sechage_date_debut: sechDebut,
    sechage_date_fin: sechFin,
    curing_date_debut: curDebut,
    poids_debut_curing_g: poidsDebut,
    poids_final_curing_g: poidsFinal,
  }
}

route('GET', '/stock/:id/origine', async ({ params }) => {
  const s = await oneOr404<Row>('SELECT * FROM "Stock" WHERE id_stock = ?', [params.id], 'Stock non trouvé')
  const enriched = await enrichStock(s)

  let varieteOut: Row | null = null
  if (s.id_variete) {
    const v = await one<Row>('SELECT * FROM "Variete" WHERE id_variete = ?', [s.id_variete])
    if (v) {
      varieteOut = {
        id_variete: v.id_variete, nom_variete: v.nom_variete,
        croisement_variete: v.croisement_variete, informations_variete: v.informations_variete,
        lien_web: v.lien_web,
      }
    }
  }

  let bocalOut: Row | null = null
  if (s.id_materiel_bocal) {
    const mat = await one<Row>('SELECT * FROM "Materiel" WHERE id_materiel = ?', [s.id_materiel_bocal])
    if (mat) {
      jsonify(mat, ['caracteristiques'])
      bocalOut = {
        id_materiel: mat.id_materiel, nom: mat.nom,
        volume_ml: (mat.caracteristiques as Row | null)?.volume_ml ?? null,
      }
    }
  }

  const culturesOut: Row[] = []
  if (s.id_plant) {
    const directPlant = await one<Row>('SELECT * FROM "Plant" WHERE id_plant = ?', [s.id_plant])
    if (directPlant?.id_culture) {
      const c = await one<Row>('SELECT * FROM "Culture" WHERE id_culture = ?', [directPlant.id_culture])
      if (c) {
        culturesOut.push({
          id_culture: c.id_culture, nom: c.nom, statut: c.statut,
          date_debut: c.date_debut, date_passage_12_12: c.date_passage_12_12,
          date_debut_floraison: c.date_debut_floraison,
          plants: [await buildPlantOrigine(directPlant)],
        })
      }
    }
  } else if (s.id_variete) {
    const plants = await query<Row>(
      `SELECT p.* FROM "Plant" p JOIN "Graine" g ON g.id_graine = p.id_graine
       WHERE g.id_variete = ?`, [s.id_variete])
    const cultureMap = new Map<number, Row[]>()
    for (const p of plants) {
      const key = Number(p.id_culture)
      if (!cultureMap.has(key)) cultureMap.set(key, [])
      cultureMap.get(key)!.push(p)
    }
    for (const [idCulture, culturePlants] of cultureMap) {
      const c = await one<Row>('SELECT * FROM "Culture" WHERE id_culture = ?', [idCulture])
      if (!c) continue
      culturesOut.push({
        id_culture: c.id_culture, nom: c.nom, statut: c.statut,
        date_debut: c.date_debut, date_passage_12_12: c.date_passage_12_12,
        date_debut_floraison: c.date_debut_floraison,
        plants: await Promise.all(culturePlants.map(buildPlantOrigine)),
      })
    }
    culturesOut.sort((a, b) => String(b.date_debut ?? '').localeCompare(String(a.date_debut ?? '')))
  }

  return {
    data: { stock: enriched, variete: varieteOut, bocal: bocalOut, cultures_source: culturesOut },
  }
})

// ═══ StockAlertSeuil ═══════════════════════════════════════════════════════════

function seuilRead(row: Row): Row {
  return {
    type_stock: row.type_stock,
    seuil_bocal_g: num(row.seuil_bocal_g),
    seuil_bocal_pct: num(row.seuil_bocal_pct),
    seuil_total_g: num(row.seuil_total_g),
    actif: !!Number(row.actif),
  }
}

// /check avant /:type_stock
route('GET', '/stock-alert-seuils/check', async () => {
  const seuils = await query<Row>('SELECT * FROM "StockAlertSeuil" WHERE actif = 1')
  const results: Row[] = []
  for (const seuil of seuils) {
    const stocks = await query<Row>(
      'SELECT * FROM "Stock" WHERE type_stock = ? AND date_fin_stock IS NULL AND quantite_stock > 0',
      [seuil.type_stock])
    const totalG = stocks.reduce((sum, s) => sum + Number(s.quantite_stock ?? 0), 0)

    const bocauxBas: Row[] = []
    for (const s of stocks) {
      const qte = Number(s.quantite_stock ?? 0)
      const initiale = s.quantite_initiale ? Number(s.quantite_initiale) : null
      const pct = initiale && initiale > 0 ? Math.round((qte / initiale) * 1000) / 10 : null

      const alerteG = seuil.seuil_bocal_g !== null && seuil.seuil_bocal_g !== undefined && qte < Number(seuil.seuil_bocal_g)
      const alertePct = seuil.seuil_bocal_pct !== null && seuil.seuil_bocal_pct !== undefined
        && pct !== null && pct < Number(seuil.seuil_bocal_pct)

      if (alerteG || alertePct) {
        let varieteNom: unknown = null
        if (s.id_variete) {
          const v = await one<Row>('SELECT nom_variete FROM "Variete" WHERE id_variete = ?', [s.id_variete])
          varieteNom = v?.nom_variete ?? null
        }
        bocauxBas.push({
          id_stock: s.id_stock,
          variete_nom: varieteNom,
          quantite_stock: qte,
          quantite_initiale: initiale,
          pct_restant: pct,
          raison: alerteG && alertePct ? 'g+pct' : (alerteG ? 'g' : 'pct'),
        })
      }
    }
    const alerteTotal = seuil.seuil_total_g !== null && seuil.seuil_total_g !== undefined
      && totalG < Number(seuil.seuil_total_g)

    results.push({
      type_stock: seuil.type_stock,
      seuil_bocal_g: num(seuil.seuil_bocal_g),
      seuil_bocal_pct: num(seuil.seuil_bocal_pct),
      seuil_total_g: num(seuil.seuil_total_g),
      nb_bocaux_bas: bocauxBas.length,
      bocaux_bas: bocauxBas,
      total_g: Math.round(totalG * 10) / 10,
      alerte_total: alerteTotal,
    })
  }
  return { data: results }
})

route('GET', '/stock-alert-seuils', async () => {
  const rows = await query<Row>('SELECT * FROM "StockAlertSeuil" ORDER BY type_stock')
  return { data: rows.map(seuilRead) }
})

route('PUT', '/stock-alert-seuils/:type_stock', async ({ params, body }) => {
  const p = body as Row
  const typeStock = params.type_stock
  const existing = await one<Row>('SELECT * FROM "StockAlertSeuil" WHERE type_stock = ?', [typeStock])
  if (existing) {
    await run(
      'UPDATE "StockAlertSeuil" SET seuil_bocal_g = ?, seuil_bocal_pct = ?, seuil_total_g = ?, actif = ? WHERE type_stock = ?',
      [p.seuil_bocal_g ?? null, p.seuil_bocal_pct ?? null, p.seuil_total_g ?? null, p.actif === false ? 0 : 1, typeStock])
  } else {
    await run(
      'INSERT INTO "StockAlertSeuil" (type_stock, seuil_bocal_g, seuil_bocal_pct, seuil_total_g, actif) VALUES (?,?,?,?,?)',
      [typeStock, p.seuil_bocal_g ?? null, p.seuil_bocal_pct ?? null, p.seuil_total_g ?? null, p.actif === false ? 0 : 1])
  }
  const row = await one<Row>('SELECT * FROM "StockAlertSeuil" WHERE type_stock = ?', [typeStock])
  return { data: seuilRead(row!) }
})

route('DELETE', '/stock-alert-seuils/:type_stock', async ({ params }) => {
  await oneOr404('SELECT * FROM "StockAlertSeuil" WHERE type_stock = ?', [params.type_stock], 'Seuil introuvable')
  await run('DELETE FROM "StockAlertSeuil" WHERE type_stock = ?', [params.type_stock])
  return { status: 204 }
})
