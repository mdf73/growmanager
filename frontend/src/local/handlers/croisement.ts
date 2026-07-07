// ─── Handlers locaux : Croisements + Pollen ───────────────────────────────────
// Miroir de backend/app/routers/croisement.py
import { route, LocalHttpError } from '../router'
import { query, one, oneOr404, count, insert, updateById, run } from '../helpers'
import { Row, todayISO, addDays } from './cultures-helpers'

const num = (v: unknown): number | null => (v === null || v === undefined ? null : Number(v))

const POLLEN_FIELDS = ['nom_pollen', 'id_variete_source', 'pheno_source', 'reverse', 'date_collecte',
  'quantite_initiale_g', 'quantite_restante_g', 'stockage', 'date_peremption', 'actif', 'notes']

const CROISEMENT_FIELDS = ['nom_croisement', 'type_croisement', 'id_variete_mere', 'pheno_mere', 'notes_mere',
  'id_pollen', 'id_variete_pere', 'pheno_pere', 'pere_reverse', 'notes_pere', 'date_pollinisation',
  'methode', 'zone_pollinisee', 'quantite_pollen_utilisee_g', 'date_recolte_graines', 'nb_graines',
  'qualite_graines', 'poids_graines_g', 'id_variete_resultat', 'id_packgraine_resultat', 'statut', 'notes']

function peremptionAuto(dateCollecte: unknown, stockage: unknown): string | null {
  if (!dateCollecte) return null
  const d = String(dateCollecte).slice(0, 10)
  if (stockage === 'frigo') return addDays(d, 180)
  if (stockage === 'congelateur') return addDays(d, 540)
  if (stockage === 'ambiant') return addDays(d, 30)
  return null
}

async function enrichPollen(p: Row): Promise<Row> {
  const today = todayISO()
  const perime = !!(p.date_peremption && String(p.date_peremption).slice(0, 10) < today)
  const epuise = p.quantite_restante_g !== null && p.quantite_restante_g !== undefined && Number(p.quantite_restante_g) <= 0
  let nomVariete: unknown = null
  if (p.id_variete_source) {
    const v = await one<Row>('SELECT nom_variete FROM "Variete" WHERE id_variete = ?', [p.id_variete_source])
    nomVariete = v?.nom_variete ?? null
  }
  return {
    id_pollen: p.id_pollen,
    nom_pollen: p.nom_pollen,
    id_variete_source: p.id_variete_source,
    nom_variete_source: nomVariete,
    pheno_source: p.pheno_source,
    reverse: !!Number(p.reverse ?? 0),
    date_collecte: p.date_collecte,
    quantite_initiale_g: num(p.quantite_initiale_g),
    quantite_restante_g: num(p.quantite_restante_g),
    stockage: p.stockage,
    date_peremption: p.date_peremption,
    actif: !!Number(p.actif ?? 0) && !perime && !epuise,
    notes: p.notes,
    created_at: p.created_at,
    perime,
    epuise,
  }
}

async function enrichCroisement(c: Row): Promise<Row> {
  const nomFor = async (id: unknown): Promise<unknown> => {
    if (!id) return null
    const v = await one<Row>('SELECT nom_variete FROM "Variete" WHERE id_variete = ?', [id])
    return v?.nom_variete ?? null
  }
  let nomPollen: unknown = null
  if (c.id_pollen) {
    const p = await one<Row>('SELECT nom_pollen FROM "Pollen" WHERE id_pollen = ?', [c.id_pollen])
    nomPollen = p?.nom_pollen ?? null
  }
  return {
    ...c,
    nom_variete_mere: await nomFor(c.id_variete_mere),
    nom_pollen: nomPollen,
    nom_variete_pere: await nomFor(c.id_variete_pere),
    pere_reverse: !!Number(c.pere_reverse ?? 0),
    quantite_pollen_utilisee_g: num(c.quantite_pollen_utilisee_g),
    poids_graines_g: num(c.poids_graines_g),
    statut: c.statut ?? 'planifie',
  }
}

// ═══ Pollen (routes statiques avant /:id) ═══════════════════════════════════════

route('GET', '/croisements/pollen', async ({ query: q }) => {
  const rows = await query<Row>('SELECT * FROM "Pollen" ORDER BY id_pollen DESC')
  let out = await Promise.all(rows.map(enrichPollen))
  if (q.get('actif_only') === 'true') out = out.filter(p => p.actif)
  return { data: out }
})

route('GET', '/croisements/pollen/:id', async ({ params }) => ({
  data: await enrichPollen(await oneOr404('SELECT * FROM "Pollen" WHERE id_pollen = ?', [params.id], 'Pollen non trouvé')),
}))

route('POST', '/croisements/pollen', async ({ body }) => {
  const p = body as Row
  const obj: Row = { created_at: new Date().toISOString() }
  for (const f of POLLEN_FIELDS) obj[f] = p[f] ?? null
  if (!obj.date_peremption) obj.date_peremption = peremptionAuto(p.date_collecte, p.stockage)
  if ((obj.quantite_restante_g === null || obj.quantite_restante_g === undefined)
      && obj.quantite_initiale_g !== null && obj.quantite_initiale_g !== undefined) {
    obj.quantite_restante_g = obj.quantite_initiale_g
  }
  if (obj.actif === null || obj.actif === undefined) obj.actif = true
  const id = await insert('Pollen', obj)
  return { data: await enrichPollen((await one<Row>('SELECT * FROM "Pollen" WHERE id_pollen = ?', [id]))!) }
})

route('PUT', '/croisements/pollen/:id', async ({ params, body }) => {
  await oneOr404('SELECT * FROM "Pollen" WHERE id_pollen = ?', [params.id], 'Pollen non trouvé')
  const p = body as Row
  const upd: Row = {}
  for (const f of POLLEN_FIELDS) if (f in p) upd[f] = p[f]
  await updateById('Pollen', 'id_pollen', params.id, upd)
  return { data: await enrichPollen((await one<Row>('SELECT * FROM "Pollen" WHERE id_pollen = ?', [params.id]))!) }
})

route('DELETE', '/croisements/pollen/:id', async ({ params }) => {
  await oneOr404('SELECT * FROM "Pollen" WHERE id_pollen = ?', [params.id], 'Pollen non trouvé')
  const used = await count('SELECT COUNT(*) AS n FROM "Croisement" WHERE id_pollen = ?', [params.id])
  if (used) throw new LocalHttpError(400, `Pollen utilisé par ${used} croisement(s), suppression bloquée`)
  await run('DELETE FROM "Pollen" WHERE id_pollen = ?', [params.id])
  return { data: { message: 'Pollen supprimé' } }
})

// ═══ Croisements ═══════════════════════════════════════════════════════════════

route('GET', '/croisements', async ({ query: q }) => {
  const statut = q.get('statut')
  const rows = statut
    ? await query<Row>('SELECT * FROM "Croisement" WHERE statut = ? ORDER BY id_croisement DESC', [statut])
    : await query<Row>('SELECT * FROM "Croisement" ORDER BY id_croisement DESC')
  const out: Row[] = []
  for (const c of rows) out.push(await enrichCroisement(c))
  return { data: out }
})

route('GET', '/croisements/:id', async ({ params }) => ({
  data: await enrichCroisement(await oneOr404('SELECT * FROM "Croisement" WHERE id_croisement = ?',
    [params.id], 'Croisement non trouvé')),
}))

route('POST', '/croisements', async ({ body }) => {
  const p = body as Row
  const obj: Row = { created_at: new Date().toISOString() }
  for (const f of CROISEMENT_FIELDS) obj[f] = p[f] ?? null
  const id = await insert('Croisement', obj)

  // Décrémenter le stock de pollen si utilisé
  if (p.id_pollen && p.quantite_pollen_utilisee_g) {
    const pollen = await one<Row>('SELECT * FROM "Pollen" WHERE id_pollen = ?', [p.id_pollen])
    if (pollen && pollen.quantite_restante_g !== null && pollen.quantite_restante_g !== undefined) {
      const newQty = Math.max(0, Number(pollen.quantite_restante_g) - Number(p.quantite_pollen_utilisee_g))
      await run('UPDATE "Pollen" SET quantite_restante_g = ?, actif = CASE WHEN ? <= 0 THEN 0 ELSE actif END WHERE id_pollen = ?',
        [newQty, newQty, p.id_pollen])
    }
  }
  return { data: await enrichCroisement((await one<Row>('SELECT * FROM "Croisement" WHERE id_croisement = ?', [id]))!) }
})

route('PUT', '/croisements/:id', async ({ params, body }) => {
  await oneOr404('SELECT * FROM "Croisement" WHERE id_croisement = ?', [params.id], 'Croisement non trouvé')
  const p = body as Row
  const upd: Row = {}
  for (const f of CROISEMENT_FIELDS) if (f in p) upd[f] = p[f]
  await updateById('Croisement', 'id_croisement', params.id, upd)
  return { data: await enrichCroisement((await one<Row>('SELECT * FROM "Croisement" WHERE id_croisement = ?', [params.id]))!) }
})

route('DELETE', '/croisements/:id', async ({ params }) => {
  await oneOr404('SELECT * FROM "Croisement" WHERE id_croisement = ?', [params.id], 'Croisement non trouvé')
  await run('DELETE FROM "Croisement" WHERE id_croisement = ?', [params.id])
  return { data: { message: 'Croisement supprimé' } }
})

// ── Finaliser la récolte de graines ───────────────────────────────────────────

route('POST', '/croisements/:id/recolte', async ({ params, body }) => {
  const c = await oneOr404<Row>('SELECT * FROM "Croisement" WHERE id_croisement = ?', [params.id], 'Croisement non trouvé')
  const p = body as Row

  await updateById('Croisement', 'id_croisement', params.id, {
    date_recolte_graines: p.date_recolte_graines,
    nb_graines: p.nb_graines,
    qualite_graines: p.qualite_graines ?? null,
    poids_graines_g: p.poids_graines_g ?? null,
    statut: 'recolte',
  })

  // Libellé du croisement (ex: "Mom x Dad")
  const mere = c.id_variete_mere
    ? await one<Row>('SELECT nom_variete FROM "Variete" WHERE id_variete = ?', [c.id_variete_mere]) : null
  let parentPere = '?'
  if (c.id_variete_pere) {
    const vp = await one<Row>('SELECT nom_variete FROM "Variete" WHERE id_variete = ?', [c.id_variete_pere])
    parentPere = String(vp?.nom_variete ?? '?')
  } else if (c.id_pollen) {
    const po = await one<Row>('SELECT nom_pollen FROM "Pollen" WHERE id_pollen = ?', [c.id_pollen])
    parentPere = String(po?.nom_pollen ?? '?')
  }
  const croisementLabel = `${mere?.nom_variete ?? '?'} x ${parentPere}`

  // Breeder
  let idBreeder = p.id_breeder ?? null
  if (p.nom_breeder_nouveau) {
    idBreeder = await insert('Breeder', { nom_breeder: p.nom_breeder_nouveau })
  }

  const nomVariete = p.nom_variete_resultat ?? c.nom_croisement

  // Variété résultante
  let idVarieteFinal: number | null = null
  if (p.creer_variete) {
    if (c.id_variete_resultat) {
      await run('UPDATE "Variete" SET nom_variete = ?, croisement_variete = ? WHERE id_variete = ?',
        [nomVariete, croisementLabel, c.id_variete_resultat])
      idVarieteFinal = Number(c.id_variete_resultat)
    } else {
      idVarieteFinal = await insert('Variete', {
        nom_variete: nomVariete,
        croisement_variete: croisementLabel,
        informations_variete: `Issu du croisement maison #${c.id_croisement} (${c.type_croisement ?? 'F1'})`,
      })
      await run('UPDATE "Croisement" SET id_variete_resultat = ? WHERE id_croisement = ?', [idVarieteFinal, params.id])
    }
  } else if (p.id_variete_existante) {
    idVarieteFinal = Number(p.id_variete_existante)
    await run('UPDATE "Croisement" SET id_variete_resultat = ? WHERE id_croisement = ?', [idVarieteFinal, params.id])
  }

  // PackGraine maison
  let idPackFinal: number | null = null
  if (p.creer_packgraine) {
    idPackFinal = await insert('PackGraine', {
      id_fournisseur: null,
      nbr_graines: p.nb_graines,
      prix_achat: 0,
      date_achat: p.date_recolte_graines ?? null,
    })
    await run('UPDATE "Croisement" SET id_packgraine_resultat = ? WHERE id_croisement = ?', [idPackFinal, params.id])
  }

  // Graines individuelles
  if (idPackFinal && Number(p.nb_graines) > 0) {
    await run('DELETE FROM "Graine" WHERE id_packgraine = ?', [idPackFinal])
    for (let i = 0; i < Number(p.nb_graines); i++) {
      await insert('Graine', {
        id_breeder: idBreeder,
        id_variete: idVarieteFinal,
        id_packgraine: idPackFinal,
        types_graines: p.types_graines ?? null,
        date_achat: p.date_recolte_graines ?? null,
        prix_achat: 0,
        utilisee: false,
        edition_limite: false,
      })
    }
  }

  return { data: await enrichCroisement((await one<Row>('SELECT * FROM "Croisement" WHERE id_croisement = ?', [params.id]))!) }
})

