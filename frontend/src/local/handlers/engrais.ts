// ─── Handlers locaux : ProduitEngrais + AchatEngrais ──────────────────────────
// Miroir de backend/app/routers/engrais.py
import { route } from '../router'
import { query, oneOr404, insert, updateById, run } from '../helpers'

type Row = Record<string, unknown>

const PRODUIT_FIELDS = [
  'nom_produit', 'marque', 'type_produit', 'conditionnement', 'volume_conditionnement',
  'unite_volume', 'prix_achat', 'date_achat', 'date_peremption', 'quantite_stock',
  'unite_quantite', 'dosage_conseille', 'notes',
]

async function getProduit(id: unknown): Promise<Row> {
  return oneOr404('SELECT * FROM "ProduitEngrais" WHERE id_produit = ?', [id], 'Produit introuvable')
}

route('GET', '/engrais', async () => ({
  data: await query('SELECT * FROM "ProduitEngrais" ORDER BY nom_produit'),
}))

route('GET', '/engrais/:id', async ({ params }) => ({ data: await getProduit(params.id) }))

route('POST', '/engrais', async ({ body }) => {
  const b = body as Row
  const obj: Row = {}
  for (const f of PRODUIT_FIELDS) obj[f] = b[f] ?? null
  const id = await insert('ProduitEngrais', obj)
  return { status: 201, data: await getProduit(id) }
})

route('PUT', '/engrais/:id', async ({ params, body }) => {
  await getProduit(params.id)
  const b = body as Row
  const upd: Row = {}
  for (const f of PRODUIT_FIELDS) if (f in b) upd[f] = b[f]
  await updateById('ProduitEngrais', 'id_produit', params.id, upd)
  return { data: await getProduit(params.id) }
})

route('DELETE', '/engrais/:id', async ({ params }) => {
  await getProduit(params.id)
  await run('DELETE FROM "AchatEngrais" WHERE id_produit = ?', [params.id])
  await run('DELETE FROM "ProduitEngrais" WHERE id_produit = ?', [params.id])
  return { status: 204 }
})

// ── Gestion du stock ──────────────────────────────────────────────────────────

route('GET', '/engrais/:id/achats', async ({ params }) => {
  await getProduit(params.id)
  return {
    data: await query(
      'SELECT * FROM "AchatEngrais" WHERE id_produit = ? ORDER BY date_achat DESC, id_achat DESC',
      [params.id]),
  }
})

route('POST', '/engrais/:id/recharger', async ({ params, body }) => {
  const prod = await getProduit(params.id)
  const p = body as Row

  await insert('AchatEngrais', {
    id_produit: Number(params.id),
    date_achat: p.date_achat ?? null,
    volume_achat: p.volume_achat ?? null,
    unite_volume: p.unite_volume ?? null,
    prix_achat: p.prix_achat ?? null,
    date_peremption: p.date_peremption ?? null,
    conditionnement: p.conditionnement ?? null,
    notes: p.notes ?? null,
    created_at: new Date().toISOString(),
  })

  const upd: Row = {}
  if (p.volume_achat !== null && p.volume_achat !== undefined) {
    upd.quantite_stock = Number(prod.quantite_stock ?? 0) + Number(p.volume_achat)
    upd.volume_conditionnement = p.volume_achat
  }
  if (p.prix_achat !== null && p.prix_achat !== undefined) upd.prix_achat = p.prix_achat
  if (p.date_achat !== null && p.date_achat !== undefined) upd.date_achat = p.date_achat
  if (p.date_peremption !== null && p.date_peremption !== undefined) upd.date_peremption = p.date_peremption
  if (p.conditionnement !== null && p.conditionnement !== undefined) upd.conditionnement = p.conditionnement
  if (p.unite_volume !== null && p.unite_volume !== undefined) {
    upd.unite_volume = p.unite_volume
    upd.unite_quantite = p.unite_volume // même unité pour le stock
  }
  await updateById('ProduitEngrais', 'id_produit', params.id, upd)
  return { data: await getProduit(params.id) }
})

route('POST', '/engrais/:id/vider-stock', async ({ params }) => {
  await getProduit(params.id)
  await run('UPDATE "ProduitEngrais" SET quantite_stock = 0 WHERE id_produit = ?', [params.id])
  return { data: await getProduit(params.id) }
})
