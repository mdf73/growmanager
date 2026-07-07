// ─── Handlers locaux : Extractions Rosin & Hash ───────────────────────────────
// Miroir de backend/app/routers/extractions.py
import { route, LocalHttpError } from '../router'
import { query, one, oneOr404, insert, updateById, run, jsonify } from '../helpers'
import { Row, daysBetween } from './cultures-helpers'

const num = (v: unknown): number | null => (v === null || v === undefined ? null : Number(v))

// ── Helpers ───────────────────────────────────────────────────────────────────

interface SourceDeduction { stock: Row; quantite: number }

async function deductSources(sources: Row[]): Promise<SourceDeduction[]> {
  const out: SourceDeduction[] = []
  for (const src of sources) {
    const idStock = src.id_stock
    const quantite = Number(src.quantite)
    const stock = await one<Row>('SELECT * FROM "Stock" WHERE id_stock = ?', [idStock])
    if (!stock) throw new LocalHttpError(404, `Stock ${idStock} introuvable`)
    if (Number(stock.quantite_stock) < quantite) {
      throw new LocalHttpError(400,
        `Stock insuffisant pour ${stock.id_stock} : ${Number(stock.quantite_stock).toFixed(1)}g disponibles, ${quantite.toFixed(1)}g demandés`)
    }
    out.push({ stock, quantite })
  }
  return out
}

async function applyDeductions(deductions: SourceDeduction[], dateFin: string): Promise<void> {
  for (const { stock, quantite } of deductions) {
    let nouvelle = Number(stock.quantite_stock) - quantite
    if (nouvelle <= 0) {
      nouvelle = 0
      await run(
        'UPDATE "Stock" SET quantite_stock = 0, date_fin_stock = COALESCE(date_fin_stock, ?) WHERE id_stock = ?',
        [dateFin, stock.id_stock])
    } else {
      await run('UPDATE "Stock" SET quantite_stock = ? WHERE id_stock = ?', [nouvelle, stock.id_stock])
    }
  }
}

async function ageSourceForStock(idStock: number, dateExtraction: string | null): Promise<Row | null> {
  const stock = await one<Row>('SELECT * FROM "Stock" WHERE id_stock = ?', [idStock])
  if (!stock) return null
  let nom: unknown = null
  let dateFinCuring: string | null = null
  let ageJours: number | null = null
  if (stock.id_plant) {
    const plant = await one<Row>('SELECT * FROM "Plant" WHERE id_plant = ?', [stock.id_plant])
    if (plant) {
      nom = plant.nom_affichage
      const pc = await one<Row>(
        `SELECT date_fin_curing FROM "PlantCuring"
         WHERE id_plant = ? AND date_fin_curing IS NOT NULL ORDER BY date_fin_curing DESC LIMIT 1`, [plant.id_plant])
      if (pc?.date_fin_curing) {
        dateFinCuring = String(pc.date_fin_curing).slice(0, 10)
        if (dateExtraction) ageJours = daysBetween(dateFinCuring, dateExtraction.slice(0, 10))
      }
    }
  }
  if (!nom && stock.id_variete) {
    const v = await one<Row>('SELECT nom_variete FROM "Variete" WHERE id_variete = ?', [stock.id_variete])
    nom = v?.nom_variete ?? null
  }
  return { id_stock: idStock, nom, date_fin_curing: dateFinCuring, age_jours: ageJours }
}

async function enrichRosin(e: Row): Promise<Row> {
  jsonify(e, ['sources'])
  let varieteNom: unknown = null
  if (e.id_stock_source) {
    const stock = await one<Row>('SELECT id_variete FROM "Stock" WHERE id_stock = ?', [e.id_stock_source])
    if (stock?.id_variete) {
      const v = await one<Row>('SELECT nom_variete FROM "Variete" WHERE id_variete = ?', [stock.id_variete])
      varieteNom = v?.nom_variete ?? null
    }
  }
  if (!varieteNom) varieteNom = e.nom_variete_extract ?? null

  const ids: number[] = []
  for (const src of (e.sources as Row[] | null) ?? []) {
    const sid = src.id_stock
    if (sid !== null && sid !== undefined && !ids.includes(Number(sid))) ids.push(Number(sid))
  }
  if (!ids.length && e.id_stock_source) ids.push(Number(e.id_stock_source))
  const agesSources: Row[] = []
  for (const sid of ids) {
    const age = await ageSourceForStock(sid, e.date_rosinextraction ? String(e.date_rosinextraction) : null)
    if (age) agesSources.push(age)
  }

  return {
    ...e,
    sac_1_poids: num(e.sac_1_poids), sac_2_poids: num(e.sac_2_poids),
    sac_3_poids: num(e.sac_3_poids), sac_4_poids: num(e.sac_4_poids),
    presse_1_poids: num(e.presse_1_poids), presse_2_poids: num(e.presse_2_poids),
    presse_3_poids: num(e.presse_3_poids), presse_4_poids: num(e.presse_4_poids),
    quantite_utilisee: Number(e.quantite_utilisee ?? 0),
    quantite_extraite: Number(e.quantite_extraite ?? 0),
    variete_nom: varieteNom,
    ages_sources: agesSources,
  }
}

function resolveSources(p: Row): Row[] {
  let sources = (p.sources as Row[] | undefined) ?? []
  if (!sources.length && p.id_stock_source) {
    sources = [{ id_stock: p.id_stock_source, quantite: p.quantite_utilisee }]
  }
  return sources
}

// ═══ Rosin ═════════════════════════════════════════════════════════════════════

// /rosin/stats avant /rosin/:id
route('GET', '/rosin/stats', async () => {
  const extractions = await query<Row>('SELECT * FROM "RosinExtraction"')
  if (!extractions.length) {
    return { data: { ratio_moyen_rosin: 0, total_presse_g: 0, total_extrait_rosin_g: 0, total_extrait_hash_g: 0, nombre_extractions: 0 } }
  }
  const totalPresse = extractions.reduce((s, e) => s + Number(e.quantite_utilisee ?? 0), 0)
  const totalRosin = extractions.reduce((s, e) => s + Number(e.quantite_extraite ?? 0), 0)
  const hashExtractions = await query<Row>('SELECT quantite_extraite FROM "HashExtraction"')
  const totalHash = hashExtractions.reduce((s, e) => s + Number(e.quantite_extraite ?? 0), 0)
  return {
    data: {
      ratio_moyen_rosin: totalPresse > 0 ? (totalRosin / totalPresse) * 100 : 0,
      total_presse_g: totalPresse,
      total_extrait_rosin_g: totalRosin,
      total_extrait_hash_g: totalHash,
      nombre_extractions: extractions.length,
    },
  }
})

route('GET', '/rosin', async () => {
  const extractions = await query<Row>('SELECT * FROM "RosinExtraction" ORDER BY date_rosinextraction DESC')
  const out: Row[] = []
  for (const e of extractions) out.push(await enrichRosin(e))
  return { data: out }
})

route('POST', '/rosin', async ({ body }) => {
  const p = body as Row
  if (!String(p.maillage ?? '').trim()) throw new LocalHttpError(400, 'Le maillage du sac est obligatoire')

  const sources = resolveSources(p)
  if (!sources.length) throw new LocalHttpError(400, 'Aucun produit source sélectionné')

  const deductions = await deductSources(sources)
  const stockRef = deductions[0]?.stock ?? null
  const idStockSourceSave = stockRef?.id_stock ?? p.id_stock_source ?? null

  const idExtraction = await insert('RosinExtraction', {
    id_bocal: p.id_bocal ?? null,
    id_rosinbag: p.id_rosinbag ?? null,
    id_press: p.id_press ?? null,
    id_stock_source: idStockSourceSave,
    nom_variete_extract: p.nom_variete_extract ?? null,
    date_rosinextraction: p.date_rosinextraction ?? null,
    sources: sources.map(s => ({ id_stock: s.id_stock, quantite: Number(s.quantite) })),
    temperature_extraction: p.temperature_extraction ?? null,
    maillage: p.maillage,
    duree_preheat: p.duree_preheat ?? null,
    duree_extraction: p.duree_extraction ?? null,
    sac_1_poids: p.sac_1_poids ?? null,
    sac_2_poids: p.sac_2_poids ?? null,
    sac_3_poids: p.sac_3_poids ?? null,
    sac_4_poids: p.sac_4_poids ?? null,
    quantite_utilisee: p.quantite_utilisee,
    presse_1_poids: p.presse_1_poids ?? null,
    presse_2_poids: p.presse_2_poids ?? null,
    presse_3_poids: p.presse_3_poids ?? null,
    presse_4_poids: p.presse_4_poids ?? null,
    quantite_extraite: p.quantite_extraite,
    info_rosinextraction: p.info_rosinextraction ?? null,
  })

  await applyDeductions(deductions, String(p.date_rosinextraction ?? ''))

  let typeRosin: string | null = null
  if (stockRef) {
    typeRosin = String(stockRef.type_stock ?? '').toLowerCase().includes('hash') ? 'Hash Rosin' : 'Flower Rosin'
  }

  const idStockProduit = await insert('Stock', {
    id_variete: stockRef?.id_variete ?? null,
    type_stock: 'Rosin',
    sous_type_stock: stockRef?.sous_type_stock ?? null,
    lampe_type: stockRef?.lampe_type ?? null,
    engrais_type: stockRef?.engrais_type ?? null,
    type_rosin: typeRosin,
    maillage: p.maillage,
    date_stock: p.date_rosinextraction ?? null,
    quantite_stock: p.quantite_extraite,
  })
  await run('UPDATE "RosinExtraction" SET id_stock_produit = ? WHERE id_rosinextraction = ?', [idStockProduit, idExtraction])

  const e = await one<Row>('SELECT * FROM "RosinExtraction" WHERE id_rosinextraction = ?', [idExtraction])
  return { data: await enrichRosin(e!) }
})

route('PUT', '/rosin/:id', async ({ params, body }) => {
  const existing = await oneOr404<Row>('SELECT * FROM "RosinExtraction" WHERE id_rosinextraction = ?',
    [params.id], 'Extraction introuvable')
  const p = body as Row
  if (!String(p.maillage ?? '').trim()) throw new LocalHttpError(400, 'Le maillage du sac est obligatoire')

  const oldQuantite = Number(existing.quantite_extraite ?? 0)
  const oldMaillage = existing.maillage

  await updateById('RosinExtraction', 'id_rosinextraction', params.id, {
    date_rosinextraction: p.date_rosinextraction ?? null,
    temperature_extraction: p.temperature_extraction ?? null,
    maillage: p.maillage,
    duree_preheat: p.duree_preheat ?? null,
    duree_extraction: p.duree_extraction ?? null,
    sac_1_poids: p.sac_1_poids ?? null,
    sac_2_poids: p.sac_2_poids ?? null,
    sac_3_poids: p.sac_3_poids ?? null,
    sac_4_poids: p.sac_4_poids ?? null,
    quantite_utilisee: p.quantite_utilisee,
    presse_1_poids: p.presse_1_poids ?? null,
    presse_2_poids: p.presse_2_poids ?? null,
    presse_3_poids: p.presse_3_poids ?? null,
    presse_4_poids: p.presse_4_poids ?? null,
    quantite_extraite: p.quantite_extraite,
    info_rosinextraction: p.info_rosinextraction ?? null,
  })

  // Synchroniser le stock Rosin produit
  let stockProduit: Row | null = null
  if (existing.id_stock_produit) {
    stockProduit = await one<Row>('SELECT * FROM "Stock" WHERE id_stock = ?', [existing.id_stock_produit])
  }
  if (!stockProduit) {
    stockProduit = await one<Row>(
      `SELECT * FROM "Stock" WHERE type_stock = 'Rosin' AND date_stock = ? AND maillage IS ? AND quantite_stock = ?`,
      [existing.date_rosinextraction ?? null, oldMaillage ?? null, oldQuantite])
    if (stockProduit) {
      await run('UPDATE "RosinExtraction" SET id_stock_produit = ? WHERE id_rosinextraction = ?',
        [stockProduit.id_stock, params.id])
    }
  }
  if (stockProduit) {
    const delta = Number(p.quantite_extraite) - oldQuantite
    const nouvelle = Math.max(Number(stockProduit.quantite_stock ?? 0) + delta, 0)
    await run('UPDATE "Stock" SET quantite_stock = ?, maillage = ? WHERE id_stock = ?',
      [nouvelle, p.maillage, stockProduit.id_stock])
  }

  const e = await one<Row>('SELECT * FROM "RosinExtraction" WHERE id_rosinextraction = ?', [params.id])
  return { data: await enrichRosin(e!) }
})

route('DELETE', '/rosin/:id', async ({ params }) => {
  await oneOr404('SELECT * FROM "RosinExtraction" WHERE id_rosinextraction = ?', [params.id], 'Extraction introuvable')
  await run('DELETE FROM "RosinExtraction" WHERE id_rosinextraction = ?', [params.id])
  return { status: 204 }
})

// ═══ Hash ══════════════════════════════════════════════════════════════════════

async function enrichHash(e: Row): Promise<Row> {
  jsonify(e, ['passages', 'sacs', 'sources'])
  let varieteNom: unknown = null
  if (e.id_stock_source) {
    const stock = await one<Row>('SELECT id_variete FROM "Stock" WHERE id_stock = ?', [e.id_stock_source])
    if (stock?.id_variete) {
      const v = await one<Row>('SELECT nom_variete FROM "Variete" WHERE id_variete = ?', [stock.id_variete])
      varieteNom = v?.nom_variete ?? null
    }
  }
  if (!varieteNom && e.id_variete) {
    const v = await one<Row>('SELECT nom_variete FROM "Variete" WHERE id_variete = ?', [e.id_variete])
    varieteNom = v?.nom_variete ?? null
  }
  if (!varieteNom) varieteNom = e.nom_variete_hash ?? null
  return {
    ...e,
    quantite_utilisee: Number(e.quantite_utilisee ?? 0),
    quantite_extraite: Number(e.quantite_extraite ?? 0),
    variete_nom: varieteNom,
  }
}

// /hash/stats avant /hash/:id
route('GET', '/hash/stats', async () => {
  const extractions = await query<Row>('SELECT * FROM "HashExtraction"')
  if (!extractions.length) {
    return { data: { nombre_extractions: 0, total_entree_g: 0, total_hash_g: 0, ratio_moyen: 0 } }
  }
  const totalEntree = extractions.reduce((s, e) => s + Number(e.quantite_utilisee ?? 0), 0)
  const totalHash = extractions.reduce((s, e) => s + Number(e.quantite_extraite ?? 0), 0)
  return {
    data: {
      nombre_extractions: extractions.length,
      total_entree_g: totalEntree,
      total_hash_g: totalHash,
      ratio_moyen: totalEntree > 0 ? (totalHash / totalEntree) * 100 : 0,
    },
  }
})

route('GET', '/hash', async () => {
  const extractions = await query<Row>('SELECT * FROM "HashExtraction" ORDER BY date_hashextraction DESC')
  const out: Row[] = []
  for (const e of extractions) out.push(await enrichHash(e))
  return { data: out }
})

route('POST', '/hash', async ({ body }) => {
  const p = body as Row
  const sources = resolveSources(p)
  if (!sources.length) throw new LocalHttpError(400, 'Aucun produit source sélectionné')

  const deductions = await deductSources(sources)
  const stockRef = deductions[0]?.stock ?? null
  const idStockSourceSave = stockRef?.id_stock ?? p.id_stock_source ?? null

  let idVariete = p.id_variete ?? null
  if (!idVariete && stockRef?.id_variete) idVariete = stockRef.id_variete

  const srcType = String(stockRef?.type_stock ?? '').toLowerCase()
  let autoTypeHash: string | null = null
  if (p.type_extraction === 'Polinator') autoTypeHash = 'Pollinator'
  else if (p.type_extraction === 'Ice-o-lator') autoTypeHash = srcType.includes('wpff') ? 'Ice-o-Lator WPFF' : 'Ice-O-Lator Dry'

  const idExtraction = await insert('HashExtraction', {
    id_variete: idVariete,
    id_iceobag: p.id_iceobag ?? null,
    id_stock_source: idStockSourceSave,
    nom_variete_hash: p.nom_variete_hash ?? null,
    date_hashextraction: p.date_hashextraction ?? null,
    type_extraction: p.type_extraction ?? null,
    duree_polinator: p.duree_polinator ?? null,
    passages: p.passages ?? null,
    sacs: p.sacs ?? null,
    sources: sources.map(s => ({ id_stock: s.id_stock, quantite: Number(s.quantite) })),
    quantite_utilisee: p.quantite_utilisee,
    quantite_extraite: p.quantite_extraite,
    info_hashextraction: p.info_hashextraction ?? null,
  })

  await applyDeductions(deductions, String(p.date_hashextraction ?? ''))

  const stockKwargs: Row = {
    id_variete: idVariete,
    date_stock: p.date_hashextraction ?? null,
    sous_type_stock: stockRef?.sous_type_stock ?? null,
    lampe_type: stockRef?.lampe_type ?? null,
    engrais_type: stockRef?.engrais_type ?? null,
  }

  if (p.type_extraction === 'Polinator') {
    await insert('Stock', {
      type_stock: 'Hash',
      quantite_stock: p.quantite_extraite,
      maillage: '120µ',
      type_hash: autoTypeHash,
      ...stockKwargs,
    })
  } else if (p.type_extraction === 'Ice-o-lator' && p.sacs) {
    for (const sac of (p.sacs as Row[]) ?? []) {
      const poids = Number(sac.poids ?? 0)
      if (poids > 0) {
        await insert('Stock', {
          type_stock: 'Hash',
          quantite_stock: poids,
          maillage: sac.maillage ?? '',
          type_hash: autoTypeHash,
          ...stockKwargs,
        })
      }
    }
  }

  const e = await one<Row>('SELECT * FROM "HashExtraction" WHERE id_hashextraction = ?', [idExtraction])
  return { data: await enrichHash(e!) }
})

route('DELETE', '/hash/:id', async ({ params }) => {
  await oneOr404('SELECT * FROM "HashExtraction" WHERE id_hashextraction = ?', [params.id], 'Extraction hash introuvable')
  await run('DELETE FROM "HashExtraction" WHERE id_hashextraction = ?', [params.id])
  return { status: 204 }
})
