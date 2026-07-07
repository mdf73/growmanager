// ─── Handlers locaux : Vaporisateurs + consommables ───────────────────────────
// Miroir de backend/app/routers/vaporisateur.py
import { route, LocalHttpError } from '../router'
import { query, one, oneOr404, insert, updateById, run, boolify } from '../helpers'
import { Row, todayISO } from './cultures-helpers'

const VAPO_FIELDS = [
  'nom', 'modele', 'marque', 'site_achat', 'date_achat', 'prix_achat', 'numero_serie',
  'type_chauffe', 'a_eau', 'temp_min', 'temp_max', 'compatibilites', 'type_batterie',
  'autonomie_sessions', 'autonomie_mah', 'temps_chauffe_s', 'type_charge', 'nbr_sessions', 'notes',
]
const CONSO_FIELDS = ['id_vaporisateur', 'type_consommable', 'diametre_mm', 'matiere', 'date_achat', 'prix_achat', 'notes']

async function vapoRead(v: Row): Promise<Row> {
  boolify(v, ['a_eau'])
  const consommables = await query<Row>(
    'SELECT * FROM "VapoConsommable" WHERE id_vaporisateur = ?', [v.id_vaporisateur])
  return { ...v, prix_achat: v.prix_achat !== null && v.prix_achat !== undefined ? Number(v.prix_achat) : null, consommables }
}

// ── Routes statiques avant /:id ───────────────────────────────────────────────

route('GET', '/vaporisateurs/stocks-vapo', async () => {
  const rows = await query<Row>(
    `SELECT * FROM "Stock" WHERE type_stock IN ('Fleur','Hash','Rosin','Trim','WPFF','Poussière')
     AND quantite_stock > 0 AND date_fin_stock IS NULL
     ORDER BY type_stock, date_stock DESC`)
  const result: Row[] = []
  for (const s of rows) {
    let varieteNom: unknown = null
    if (s.id_variete) {
      const v = await one<Row>('SELECT nom_variete FROM "Variete" WHERE id_variete = ?', [s.id_variete])
      varieteNom = v?.nom_variete ?? null
    }
    result.push({
      id_stock: s.id_stock,
      type_stock: s.type_stock,
      id_variete: s.id_variete,
      variete_nom: varieteNom,
      quantite_stock: Number(s.quantite_stock ?? 0),
      maillage: s.maillage,
      type_hash: s.type_hash,
      type_rosin: s.type_rosin,
    })
  }
  return { data: result }
})

route('GET', '/vaporisateurs/marques', async () => {
  const rows = await query<Row>(
    'SELECT DISTINCT marque FROM "Vaporisateur" WHERE marque IS NOT NULL ORDER BY marque')
  return { data: rows.map(r => r.marque).filter(Boolean) }
})

route('GET', '/vaporisateurs/modeles', async () => {
  const rows = await query<Row>(
    'SELECT DISTINCT modele FROM "Vaporisateur" WHERE modele IS NOT NULL ORDER BY modele')
  return { data: rows.map(r => r.modele).filter(Boolean) }
})

// ── Consommables (chemins fixes avant /:id) ───────────────────────────────────

route('POST', '/vaporisateurs/consommables', async ({ body }) => {
  const p = body as Row
  const obj: Row = { created_at: new Date().toISOString() }
  for (const f of CONSO_FIELDS) obj[f] = p[f] ?? null
  const id = await insert('VapoConsommable', obj)
  return { data: await one('SELECT * FROM "VapoConsommable" WHERE id_consommable = ?', [id]) }
})

route('PUT', '/vaporisateurs/consommables/:id', async ({ params, body }) => {
  await oneOr404('SELECT * FROM "VapoConsommable" WHERE id_consommable = ?', [params.id], 'Consommable non trouve')
  const p = body as Row
  const upd: Row = {}
  for (const f of CONSO_FIELDS) if (f in p) upd[f] = p[f]
  await updateById('VapoConsommable', 'id_consommable', params.id, upd)
  return { data: await one('SELECT * FROM "VapoConsommable" WHERE id_consommable = ?', [params.id]) }
})

route('DELETE', '/vaporisateurs/consommables/:id', async ({ params }) => {
  await oneOr404('SELECT * FROM "VapoConsommable" WHERE id_consommable = ?', [params.id], 'Consommable non trouve')
  await run('DELETE FROM "VapoConsommable" WHERE id_consommable = ?', [params.id])
  return { data: { message: 'Consommable supprime' } }
})

// ── CRUD Vaporisateurs ────────────────────────────────────────────────────────

route('GET', '/vaporisateurs', async () => {
  const vapos = await query<Row>('SELECT * FROM "Vaporisateur" ORDER BY marque, modele')
  return { data: await Promise.all(vapos.map(vapoRead)) }
})

route('GET', '/vaporisateurs/:id', async ({ params }) => ({
  data: await vapoRead(await oneOr404('SELECT * FROM "Vaporisateur" WHERE id_vaporisateur = ?',
    [params.id], 'Vaporisateur non trouve')),
}))

route('POST', '/vaporisateurs', async ({ body }) => {
  const p = body as Row
  const obj: Row = { created_at: new Date().toISOString() }
  for (const f of VAPO_FIELDS) obj[f] = p[f] ?? null
  const id = await insert('Vaporisateur', obj)
  const v = await one<Row>('SELECT * FROM "Vaporisateur" WHERE id_vaporisateur = ?', [id])
  return { data: await vapoRead(v!) }
})

route('PUT', '/vaporisateurs/:id', async ({ params, body }) => {
  await oneOr404('SELECT * FROM "Vaporisateur" WHERE id_vaporisateur = ?', [params.id], 'Vaporisateur non trouve')
  const p = body as Row
  const upd: Row = {}
  for (const f of VAPO_FIELDS) if (f in p) upd[f] = p[f]
  await updateById('Vaporisateur', 'id_vaporisateur', params.id, upd)
  const v = await one<Row>('SELECT * FROM "Vaporisateur" WHERE id_vaporisateur = ?', [params.id])
  return { data: await vapoRead(v!) }
})

route('DELETE', '/vaporisateurs/:id', async ({ params }) => {
  await oneOr404('SELECT * FROM "Vaporisateur" WHERE id_vaporisateur = ?', [params.id], 'Vaporisateur non trouve')
  await run('UPDATE "VapoConsommable" SET id_vaporisateur = NULL WHERE id_vaporisateur = ?', [params.id])
  await run('DELETE FROM "Vaporisateur" WHERE id_vaporisateur = ?', [params.id])
  return { data: { message: 'Vaporisateur supprime' } }
})

route('POST', '/vaporisateurs/:id/session', async ({ params, body }) => {
  const vapo = await oneOr404<Row>('SELECT * FROM "Vaporisateur" WHERE id_vaporisateur = ?',
    [params.id], 'Vaporisateur non trouve')
  const p = (body as Row) ?? {}
  const nbrSessions = Number(vapo.nbr_sessions ?? 0) + 1
  await run('UPDATE "Vaporisateur" SET nbr_sessions = ? WHERE id_vaporisateur = ?', [nbrSessions, params.id])

  if (p.id_stock && p.quantite_g) {
    const stock = await one<Row>('SELECT * FROM "Stock" WHERE id_stock = ?', [p.id_stock])
    if (!stock) throw new LocalHttpError(404, 'Stock non trouve')
    if (stock.date_fin_stock !== null && stock.date_fin_stock !== undefined) {
      throw new LocalHttpError(400, 'Ce stock est deja epuise')
    }
    const nouvelle = Number(stock.quantite_stock) - Number(p.quantite_g)
    if (nouvelle < 0) throw new LocalHttpError(400, 'Quantite insuffisante')
    const arrondie = Math.round(nouvelle * 1000) / 1000
    if (arrondie <= 0) {
      await run('UPDATE "Stock" SET quantite_stock = 0, date_fin_stock = ? WHERE id_stock = ?', [todayISO(), p.id_stock])
    } else {
      await run('UPDATE "Stock" SET quantite_stock = ? WHERE id_stock = ?', [arrondie, p.id_stock])
    }
  }
  return { data: { nbr_sessions: nbrSessions } }
})

// ── Consommables d'un vapo ────────────────────────────────────────────────────

route('GET', '/vaporisateurs/:id/consommables', async ({ params }) => ({
  data: await query('SELECT * FROM "VapoConsommable" WHERE id_vaporisateur = ? ORDER BY date_achat DESC', [params.id]),
}))
