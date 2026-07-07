// ─── Handlers locaux : Classement des variétés (notations) ────────────────────
// Miroir de backend/app/routers/notation_variete.py (export/import CSV → 501)
import { route } from '../router'
import { query, one, oneOr404, insert, updateById, run } from '../helpers'
import { Row, todayISO } from './cultures-helpers'

const FIELDS = ['nom_variete', 'breeder', 'date_notation',
  'vigueur_sante', 'productivite_structure', 'soif',
  'apparence_structure', 'profil_aromatique', 'saveur_qualite', 'effet_puissance',
  'taux_thc', 'taux_cbd', 'terpene_dominant', 'commentaire_labo', 'notes_generales']

function calcScores(n: Row): { total_culture: number; total_consommation: number; note_finale: number } {
  const tc = Number(n.vigueur_sante ?? 0) + Number(n.productivite_structure ?? 0) + Number(n.soif ?? 0)
  const tco = Number(n.apparence_structure ?? 0) + Number(n.profil_aromatique ?? 0)
    + Number(n.saveur_qualite ?? 0) + Number(n.effet_puissance ?? 0)
  return {
    total_culture: Math.round(tc * 100) / 100,
    total_consommation: Math.round(tco * 100) / 100,
    note_finale: Math.round((tc + tco) * 100) / 100,
  }
}

function toRead(n: Row): Row {
  return { ...n, ...calcScores(n) }
}

// ── Stats d'extraction par variété (avant /:id) ───────────────────────────────

route('GET', '/notations/utils/extraction-stats', async () => {
  const varietes = await query<Row>('SELECT id_variete, nom_variete FROM "Variete"')
  const varietesMap = new Map(varietes.map(v => [Number(v.id_variete), String(v.nom_variete)]))
  const stocks = await query<Row>('SELECT id_stock, id_variete FROM "Stock"')
  const stocksMap = new Map(stocks.map(s => [Number(s.id_stock), s.id_variete ? Number(s.id_variete) : null]))

  const nomFromStock = (idStock: unknown): string | null => {
    if (!idStock) return null
    const idVariete = stocksMap.get(Number(idStock))
    return idVariete ? (varietesMap.get(idVariete) ?? null) : null
  }

  const rosinBuckets = new Map<string, number[]>()
  for (const r of await query<Row>('SELECT * FROM "RosinExtraction"')) {
    if (!r.quantite_utilisee || !r.quantite_extraite || Number(r.quantite_utilisee) <= 0) continue
    const name = String(r.nom_variete_extract ?? '').trim() || nomFromStock(r.id_stock_source)
    if (!name) continue
    const rate = Math.round((Number(r.quantite_extraite) / Number(r.quantite_utilisee)) * 10000) / 100
    if (!rosinBuckets.has(name)) rosinBuckets.set(name, [])
    rosinBuckets.get(name)!.push(rate)
  }

  const hashBuckets = new Map<string, number[]>()
  for (const h of await query<Row>('SELECT * FROM "HashExtraction"')) {
    if (!h.quantite_utilisee || !h.quantite_extraite || Number(h.quantite_utilisee) <= 0) continue
    let name = String(h.nom_variete_hash ?? '').trim()
    if (!name && h.id_variete) name = varietesMap.get(Number(h.id_variete)) ?? ''
    if (!name) name = nomFromStock(h.id_stock_source) ?? ''
    if (!name) continue
    const rate = Math.round((Number(h.quantite_extraite) / Number(h.quantite_utilisee)) * 10000) / 100
    if (!hashBuckets.has(name)) hashBuckets.set(name, [])
    hashBuckets.get(name)!.push(rate)
  }

  const allNames = new Set([...rosinBuckets.keys(), ...hashBuckets.keys()])
  const result: Row = {}
  for (const name of allNames) {
    const rosinRates = rosinBuckets.get(name) ?? []
    const hashRates = hashBuckets.get(name) ?? []
    result[name] = {
      avg_rosin_pct: rosinRates.length ? Math.round((rosinRates.reduce((a, b) => a + b, 0) / rosinRates.length) * 10) / 10 : null,
      nb_rosin: rosinRates.length,
      avg_hash_pct: hashRates.length ? Math.round((hashRates.reduce((a, b) => a + b, 0) / hashRates.length) * 10) / 10 : null,
      nb_hash: hashRates.length,
    }
  }
  return { data: result }
})

// ── CRUD ──────────────────────────────────────────────────────────────────────

route('GET', '/notations', async () => {
  const notations = await query<Row>('SELECT * FROM "NotationVariete" ORDER BY nom_variete')
  const result = notations.map(toRead)
  result.sort((a, b) => Number(b.note_finale) - Number(a.note_finale))
  return { data: result }
})

route('POST', '/notations', async ({ body }) => {
  const p = body as Row
  const obj: Row = { created_at: new Date().toISOString(), updated_at: new Date().toISOString() }
  for (const f of FIELDS) obj[f] = p[f] ?? null
  if (!obj.date_notation) obj.date_notation = todayISO()
  const id = await insert('NotationVariete', obj)
  return { status: 201, data: toRead((await one<Row>('SELECT * FROM "NotationVariete" WHERE id_notation = ?', [id]))!) }
})

route('GET', '/notations/:id', async ({ params }) => ({
  data: toRead(await oneOr404('SELECT * FROM "NotationVariete" WHERE id_notation = ?', [params.id], 'Notation introuvable')),
}))

route('PUT', '/notations/:id', async ({ params, body }) => {
  await oneOr404('SELECT * FROM "NotationVariete" WHERE id_notation = ?', [params.id], 'Notation introuvable')
  const p = body as Row
  const upd: Row = { updated_at: new Date().toISOString() }
  for (const f of FIELDS) {
    if (p[f] !== null && p[f] !== undefined) upd[f] = p[f]
  }
  await updateById('NotationVariete', 'id_notation', params.id, upd)
  return { data: toRead((await one<Row>('SELECT * FROM "NotationVariete" WHERE id_notation = ?', [params.id]))!) }
})

route('DELETE', '/notations/:id', async ({ params }) => {
  await oneOr404('SELECT * FROM "NotationVariete" WHERE id_notation = ?', [params.id], 'Notation introuvable')
  await run('DELETE FROM "NotationVariete" WHERE id_notation = ?', [params.id])
  return { status: 204 }
})
