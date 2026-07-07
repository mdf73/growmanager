// ─── Handlers locaux : les 6 types de recettes (avec lignes produits) ─────────
// Miroir de backend/app/routers/recette_{engrais,tco,lso,reamendement,arrosage,fermentation}.py
// Tous suivent le même pattern CRUD + lignes → factory générique.
// Export/import CSV → non portés (501).
import { route } from '../router'
import { query, one, oneOr404, insert, updateById, run } from '../helpers'

type Row = Record<string, unknown>

interface RecetteDef {
  prefix: string        // ex: '/recettes-engrais'
  table: string         // ex: 'RecetteEngrais'
  idCol: string         // ex: 'id_recette'
  ligneTable: string    // ex: 'RecetteEngraisLigne'
  ligneFk: string       // ex: 'id_recette'
  fields: string[]      // champs de la recette (hors nom_recette/notes qui sont communs)
  qtyCol: 'dosage' | 'quantite'
  ligneHasNote: boolean
  notFound: string
  orderBy?: string
}

function defineRecette(def: RecetteDef): void {
  const allFields = ['nom_recette', ...def.fields, 'notes']

  async function enrichLigne(l: Row): Promise<Row> {
    const p = await one<Row>('SELECT nom_produit, type_produit FROM "ProduitEngrais" WHERE id_produit = ?', [l.id_produit])
    const base: Row = {
      id_ligne: l.id_ligne,
      id_produit: l.id_produit,
      [def.qtyCol]: Number(l[def.qtyCol]),
      unite: l.unite,
      ordre: l.ordre,
      nom_produit: p?.nom_produit ?? null,
      type_produit: p?.type_produit ?? null,
    }
    if (def.ligneHasNote) base.note_ligne = l.note_ligne
    return base
  }

  async function enrich(r: Row): Promise<Row> {
    const lignes = await query<Row>(
      `SELECT * FROM "${def.ligneTable}" WHERE "${def.ligneFk}" = ? ORDER BY ordre`, [r[def.idCol]])
    const out: Row = { ...r }
    // Normalisation numérique des champs décimaux éventuels
    for (const f of def.fields) {
      if (out[f] !== null && out[f] !== undefined && typeof out[f] === 'string' && !isNaN(Number(out[f]))) {
        // les champs texte restent tels quels — SQLite renvoie déjà les nombres en number
      }
    }
    out.lignes = await Promise.all(lignes.map(enrichLigne))
    return out
  }

  async function load(id: unknown): Promise<Row> {
    return oneOr404(`SELECT * FROM "${def.table}" WHERE "${def.idCol}" = ?`, [id], def.notFound)
  }

  async function insertLignes(idRecette: number, lignes: Row[]): Promise<void> {
    for (let i = 0; i < lignes.length; i++) {
      const l = lignes[i]
      const obj: Row = {
        [def.ligneFk]: idRecette,
        id_produit: l.id_produit,
        [def.qtyCol]: l[def.qtyCol],
        unite: l.unite ?? null,
        ordre: l.ordre ? l.ordre : i,
      }
      if (def.ligneHasNote) obj.note_ligne = l.note_ligne ?? null
      await insert(def.ligneTable, obj)
    }
  }

  route('GET', def.prefix, async () => {
    const recettes = await query<Row>(`SELECT * FROM "${def.table}" ORDER BY nom_recette`)
    const out: Row[] = []
    for (const r of recettes) out.push(await enrich(r))
    return { data: out }
  })

  route('GET', `${def.prefix}/:id`, async ({ params }) => ({ data: await enrich(await load(params.id)) }))

  route('POST', def.prefix, async ({ body }) => {
    const p = body as Row
    const obj: Row = {}
    for (const f of allFields) obj[f] = p[f] ?? null
    const id = await insert(def.table, obj)
    await insertLignes(id, (p.lignes as Row[] | undefined) ?? [])
    return { status: 201, data: await enrich((await one<Row>(`SELECT * FROM "${def.table}" WHERE "${def.idCol}" = ?`, [id]))!) }
  })

  route('PUT', `${def.prefix}/:id`, async ({ params, body }) => {
    await load(params.id)
    const p = body as Row
    const upd: Row = {}
    for (const f of allFields) {
      if (p[f] !== null && p[f] !== undefined) upd[f] = p[f]
    }
    await updateById(def.table, def.idCol, params.id, upd)
    if (p.lignes !== null && p.lignes !== undefined) {
      await run(`DELETE FROM "${def.ligneTable}" WHERE "${def.ligneFk}" = ?`, [params.id])
      await insertLignes(Number(params.id), p.lignes as Row[])
    }
    return { data: await enrich((await one<Row>(`SELECT * FROM "${def.table}" WHERE "${def.idCol}" = ?`, [params.id]))!) }
  })

  route('DELETE', `${def.prefix}/:id`, async ({ params }) => {
    await load(params.id)
    await run(`DELETE FROM "${def.ligneTable}" WHERE "${def.ligneFk}" = ?`, [params.id])
    await run(`DELETE FROM "${def.table}" WHERE "${def.idCol}" = ?`, [params.id])
    return { status: 204 }
  })
}

defineRecette({
  prefix: '/recettes-engrais',
  table: 'RecetteEngrais', idCol: 'id_recette',
  ligneTable: 'RecetteEngraisLigne', ligneFk: 'id_recette',
  fields: ['type_recette', 'periode', 'semaine', 'ph_cible'],
  qtyCol: 'dosage', ligneHasNote: false,
  notFound: 'Recette introuvable',
})

defineRecette({
  prefix: '/recettes-tco',
  table: 'RecetteTCO', idCol: 'id_recette_tco',
  ligneTable: 'RecetteTCOLigne', ligneFk: 'id_recette_tco',
  fields: ['type_tco', 'quantite_tco', 'unite_tco', 'duree_oxygenation_h'],
  qtyCol: 'quantite', ligneHasNote: true,
  notFound: 'Recette TCO introuvable',
})

defineRecette({
  prefix: '/recettes-lso',
  table: 'RecetteLSO', idCol: 'id_recette_lso',
  ligneTable: 'RecetteLSOLigne', ligneFk: 'id_recette_lso',
  fields: ['type_lso', 'quantite_totale', 'unite_quantite'],
  qtyCol: 'quantite', ligneHasNote: true,
  notFound: 'Recette LSO introuvable',
})

defineRecette({
  prefix: '/recettes-reamendement',
  table: 'RecetteReamendement', idCol: 'id_recette_reamend',
  ligneTable: 'RecetteReamendementLigne', ligneFk: 'id_recette_reamend',
  fields: ['volume_pot', 'unite_pot'],
  qtyCol: 'quantite', ligneHasNote: true,
  notFound: 'Recette réamendement introuvable',
})

defineRecette({
  prefix: '/recettes-arrosage',
  table: 'RecetteArrosage', idCol: 'id_recette_arrosage',
  ligneTable: 'RecetteArrosageLigne', ligneFk: 'id_recette_arrosage',
  fields: ['type_arrosage', 'quantite_eau', 'unite_eau'],
  qtyCol: 'quantite', ligneHasNote: true,
  notFound: 'Recette arrosage introuvable',
})

defineRecette({
  prefix: '/recettes-fermentation',
  table: 'RecetteFermentation', idCol: 'id_recette_ferm',
  ligneTable: 'RecetteFermentationLigne', ligneFk: 'id_recette_ferm',
  fields: ['type_fermentation', 'volume_total', 'unite_volume', 'duree_fermentation'],
  qtyCol: 'quantite', ligneHasNote: true,
  notFound: 'Recette fermentation introuvable',
})
