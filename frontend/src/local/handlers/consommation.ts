// ─── Handlers locaux : Sessions de consommation + stats ───────────────────────
// Miroir de backend/app/routers/consommation.py
import { route } from '../router'
import { query, one, oneOr404, insert, updateById, run, jsonify } from '../helpers'

type Row = Record<string, unknown>

const FIELDS = ['date_heure', 'id_vaporisateur', 'type_produit', 'id_stock', 'quantite_g', 'options_vapo', 'notes']

async function enrichSession(s: Row): Promise<Row> {
  jsonify(s, ['options_vapo'])
  let nomVapo: unknown = null
  if (s.id_vaporisateur) {
    const v = await one<Row>('SELECT * FROM "Vaporisateur" WHERE id_vaporisateur = ?', [s.id_vaporisateur])
    if (v) nomVapo = v.nom ?? `${v.marque ?? ''} ${v.modele ?? ''}`.trim()
  }
  let nomVariete: unknown = null
  if (s.id_stock) {
    const st = await one<Row>(
      `SELECT v.nom_variete FROM "Stock" s LEFT JOIN "Variete" v ON v.id_variete = s.id_variete
       WHERE s.id_stock = ?`, [s.id_stock])
    nomVariete = st?.nom_variete ?? null
  }
  return {
    id_session: s.id_session,
    date_heure: s.date_heure,
    id_vaporisateur: s.id_vaporisateur,
    nom_vaporisateur: nomVapo,
    type_produit: s.type_produit,
    id_stock: s.id_stock,
    nom_variete: nomVariete,
    quantite_g: Number(s.quantite_g ?? 0),
    options_vapo: s.options_vapo,
    notes: s.notes,
    created_at: null,
  }
}

function isoLocal(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}T${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`
}

// /stats avant /:id
route('GET', '/consommation/stats', async () => {
  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const weekStart = new Date(todayStart)
  weekStart.setDate(weekStart.getDate() - ((todayStart.getDay() + 6) % 7)) // lundi
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const yearStart = new Date(now.getFullYear(), 0, 1)

  const sumPeriod = async (start: Date): Promise<number> => {
    const r = await one<{ s: number | null }>(
      'SELECT SUM(quantite_g) AS s FROM "SessionConsommation" WHERE date_heure >= ?', [isoLocal(start)])
    return Number(r?.s ?? 0)
  }

  const byTypeRows = await query<Row>(
    'SELECT type_produit, SUM(quantite_g) AS total FROM "SessionConsommation" GROUP BY type_produit')
  const byType: Row = {}
  for (const r of byTypeRows) byType[String(r.type_produit)] = Number(r.total ?? 0)

  const byVapoRows = await query<Row>(
    'SELECT id_vaporisateur, SUM(quantite_g) AS total FROM "SessionConsommation" GROUP BY id_vaporisateur')
  const byVapo: Row[] = []
  for (const r of byVapoRows) {
    let nom = 'Sans vapo'
    if (r.id_vaporisateur) {
      const v = await one<Row>('SELECT * FROM "Vaporisateur" WHERE id_vaporisateur = ?', [r.id_vaporisateur])
      if (v) nom = String(v.nom ?? `${v.marque ?? ''} ${v.modele ?? ''}`.trim())
    }
    byVapo.push({ id_vaporisateur: r.id_vaporisateur, nom, total_g: Number(r.total ?? 0) })
  }

  // 7 derniers jours
  const last7: Row[] = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date(todayStart)
    d.setDate(d.getDate() - i)
    const dEnd = new Date(d)
    dEnd.setDate(dEnd.getDate() + 1)
    const r = await one<{ s: number | null }>(
      'SELECT SUM(quantite_g) AS s FROM "SessionConsommation" WHERE date_heure >= ? AND date_heure < ?',
      [isoLocal(d), isoLocal(dEnd)])
    last7.push({
      date: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`,
      total_g: Number(r?.s ?? 0),
    })
  }
  const avg7j = last7.length ? last7.reduce((s, d) => s + Number(d.total_g), 0) / 7 : 0

  // Stock disponible par type
  const typeMap: Record<string, string[]> = {
    fleur: ['fleur', 'Fleur'],
    hash: ['hash', 'Hash'],
    rosin: ['rosin', 'Rosin'],
  }
  const stocksDispo: Record<string, number> = {}
  for (const [typeP, types] of Object.entries(typeMap)) {
    const r = await one<{ s: number | null }>(
      `SELECT SUM(quantite_stock) AS s FROM "Stock"
       WHERE type_stock IN (${types.map(() => '?').join(',')}) AND date_fin_stock IS NULL`, types)
    stocksDispo[typeP] = Number(r?.s ?? 0)
  }
  const totalStock = Object.values(stocksDispo).reduce((a, b) => a + b, 0)

  return {
    data: {
      periodes: {
        jour: await sumPeriod(todayStart),
        semaine: await sumPeriod(weekStart),
        mois: await sumPeriod(monthStart),
        annee: await sumPeriod(yearStart),
      },
      by_type: byType,
      by_vapo: byVapo,
      last7,
      avg_7j_g: Math.round(avg7j * 1000) / 1000,
      stock_dispo_g: stocksDispo,
      jours_restants: avg7j > 0 ? Math.round(totalStock / avg7j) : null,
    },
  }
})

route('GET', '/consommation', async ({ query: q }) => {
  const limit = Math.min(Math.max(Number(q.get('limit') ?? 100), 1), 500)
  const offset = Math.max(Number(q.get('offset') ?? 0), 0)
  const rows = await query<Row>(
    'SELECT * FROM "SessionConsommation" ORDER BY date_heure DESC LIMIT ? OFFSET ?', [limit, offset])
  const out: Row[] = []
  for (const r of rows) out.push(await enrichSession(r))
  return { data: out }
})

route('GET', '/consommation/:id', async ({ params }) => ({
  data: await enrichSession(await oneOr404('SELECT * FROM "SessionConsommation" WHERE id_session = ?',
    [params.id], 'Session introuvable')),
}))

route('POST', '/consommation', async ({ body }) => {
  const p = body as Row
  const id = await insert('SessionConsommation', {
    date_heure: p.date_heure ?? new Date().toISOString(),
    id_vaporisateur: p.id_vaporisateur ?? null,
    type_produit: p.type_produit,
    id_stock: p.id_stock ?? null,
    quantite_g: p.quantite_g,
    options_vapo: p.options_vapo ?? null,
    notes: p.notes ?? null,
  })
  return { status: 201, data: await enrichSession((await one<Row>('SELECT * FROM "SessionConsommation" WHERE id_session = ?', [id]))!) }
})

route('PUT', '/consommation/:id', async ({ params, body }) => {
  await oneOr404('SELECT * FROM "SessionConsommation" WHERE id_session = ?', [params.id], 'Session introuvable')
  const p = body as Row
  const upd: Row = {}
  for (const f of FIELDS) {
    if (p[f] !== null && p[f] !== undefined) upd[f] = p[f]
  }
  await updateById('SessionConsommation', 'id_session', params.id, upd)
  return { data: await enrichSession((await one<Row>('SELECT * FROM "SessionConsommation" WHERE id_session = ?', [params.id]))!) }
})

route('DELETE', '/consommation/:id', async ({ params }) => {
  await oneOr404('SELECT * FROM "SessionConsommation" WHERE id_session = ?', [params.id], 'Session introuvable')
  await run('DELETE FROM "SessionConsommation" WHERE id_session = ?', [params.id])
  return { status: 204 }
})
