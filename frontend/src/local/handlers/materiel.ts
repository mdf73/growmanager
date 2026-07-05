// ─── Handlers locaux : Materiel ───────────────────────────────────────────────
// Miroir de backend/app/routers/materiel.py (bocal-timeline + export CSV → B3, 501)
import { route } from '../router'
import { query, oneOr404, insert, updateById, run, jsonify, ageJours } from '../helpers'

type Row = Record<string, unknown>

const FIELDS = [
  'categorie', 'nom', 'marque', 'code_barre_serial', 'date_achat', 'prix_achat',
  'site_achat', 'etat', 'date_sortie_stock', 'notes', 'caracteristiques',
]

function enrich(row: Row): Row {
  jsonify(row, ['caracteristiques'])
  row.age_jours = ageJours(row.date_achat)
  return row
}

async function load(id: unknown): Promise<Row> {
  const row = await oneOr404<Row>('SELECT * FROM "Materiel" WHERE id_materiel = ?', [id], 'Matériel introuvable')
  return enrich(row)
}

route('GET', '/materiel', async ({ query: q }) => {
  const categorie = q.get('categorie')
  const disponibles = q.get('disponibles_seulement') === 'true'
  const inclureId = q.get('inclure_id')

  let sql = 'SELECT * FROM "Materiel"'
  const where: string[] = []
  const vals: unknown[] = []
  if (categorie) { where.push('categorie = ?'); vals.push(categorie) }
  if (disponibles) {
    // Bocaux non occupés par un stock actif ni une session curing active (+ exception bocal en édition)
    let cond = `(
      id_materiel NOT IN (SELECT id_materiel_bocal FROM "Stock" WHERE id_materiel_bocal IS NOT NULL AND date_fin_stock IS NULL)
      AND id_materiel NOT IN (SELECT id_materiel_bocal FROM "SessionCuring" WHERE id_materiel_bocal IS NOT NULL AND statut = 'active')
    )`
    if (inclureId) { cond = `(${cond} OR id_materiel = ?)` }
    where.push(cond)
    if (inclureId) vals.push(Number(inclureId))
  }
  if (where.length) sql += ' WHERE ' + where.join(' AND ')
  sql += ' ORDER BY categorie, nom'

  const rows = await query<Row>(sql, vals)
  return { data: rows.map(enrich) }
})

route('GET', '/materiel/:id', async ({ params }) => ({ data: await load(params.id) }))

route('POST', '/materiel', async ({ body }) => {
  const b = body as Row
  const obj: Row = {}
  for (const f of FIELDS) obj[f] = b[f] ?? null
  const id = await insert('Materiel', obj)
  return { status: 201, data: await load(id) }
})

route('PATCH', '/materiel/:id', async ({ params, body }) => {
  await load(params.id)
  const b = body as Row
  const upd: Row = {}
  for (const f of FIELDS) if (f in b) upd[f] = b[f]
  await updateById('Materiel', 'id_materiel', params.id, upd)
  return { data: await load(params.id) }
})

route('DELETE', '/materiel/:id', async ({ params }) => {
  await load(params.id)
  await run('DELETE FROM "Materiel" WHERE id_materiel = ?', [params.id])
  return { status: 204 }
})
