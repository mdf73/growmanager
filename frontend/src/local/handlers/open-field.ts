// ─── Handlers locaux : Open Field (projets, mères, pères, récolte) ────────────
// Miroir de backend/app/routers/open_field.py
import { route } from '../router'
import { query, one, oneOr404, insert, updateById, run, jsonify } from '../helpers'
import { Row, todayISO } from './cultures-helpers'

const num = (v: unknown): number | null => (v === null || v === undefined ? null : Number(v))

const PROJET_FIELDS = ['nom', 'saison', 'lieu', 'conditions', 'id_culture', 'statut', 'description', 'notes']
const MERE_FIELDS = ['id_variete', 'nom_phenotype', 'id_plant', 'date_pollinisation', 'methode_pollinisation',
  'pere_identifie', 'id_pollen', 'nom_pere_libre', 'id_peres', 'notes_pollinisation', 'date_recolte',
  'nb_graines', 'poids_graines_g', 'qualite_graines', 'id_packgraine', 'notes']
const PERE_FIELDS = ['id_variete', 'nom_libre', 'notes']

async function enrichProjet(p: Row): Promise<Row> {
  let cultureNom: unknown = null
  if (p.id_culture) {
    const c = await one<Row>('SELECT nom FROM "Culture" WHERE id_culture = ?', [p.id_culture])
    cultureNom = c?.nom ?? null
  }
  const peres = await query<Row>('SELECT * FROM "PlantePereOpenField" WHERE id_projet = ?', [p.id_projet])
  const peresOut: Row[] = []
  const peresMap = new Map<number, string>()
  for (const pe of peres) {
    let varieteNom: unknown = null
    if (pe.id_variete) {
      const v = await one<Row>('SELECT nom_variete FROM "Variete" WHERE id_variete = ?', [pe.id_variete])
      varieteNom = v?.nom_variete ?? null
    }
    peresMap.set(Number(pe.id_pere), String(varieteNom ?? pe.nom_libre ?? `Mâle #${pe.id_pere}`))
    peresOut.push({
      id_pere: pe.id_pere, id_projet: pe.id_projet, id_variete: pe.id_variete,
      nom_libre: pe.nom_libre, notes: pe.notes, created_at: pe.created_at,
      variete_nom: varieteNom,
    })
  }
  const meres = await query<Row>('SELECT * FROM "PlanteMereOpenField" WHERE id_projet = ?', [p.id_projet])
  const meresOut: Row[] = []
  for (const m of meres) {
    jsonify(m, ['id_peres'])
    let varieteNom: unknown = null
    if (m.id_variete) {
      const v = await one<Row>('SELECT nom_variete FROM "Variete" WHERE id_variete = ?', [m.id_variete])
      varieteNom = v?.nom_variete ?? null
    }
    let pollenNom: unknown = null
    if (m.id_pollen) {
      const po = await one<Row>('SELECT nom_pollen FROM "Pollen" WHERE id_pollen = ?', [m.id_pollen])
      pollenNom = po?.nom_pollen ?? null
    }
    let plantLabel: unknown = null
    if (m.id_plant) {
      const pl = await one<Row>('SELECT numero_plant FROM "Plant" WHERE id_plant = ?', [m.id_plant])
      if (pl) plantLabel = `Plant #${pl.numero_plant}`
    }
    const idPeres = (m.id_peres as number[] | null) ?? []
    meresOut.push({
      ...m,
      pere_identifie: !!Number(m.pere_identifie ?? 0),
      poids_graines_g: num(m.poids_graines_g),
      variete_nom: varieteNom,
      pollen_nom: pollenNom,
      plant_label: plantLabel,
      peres_labels: idPeres.map(pid => peresMap.get(Number(pid)) ?? `#${pid}`),
    })
  }
  return {
    ...p,
    culture_nom: cultureNom,
    peres: peresOut,
    meres: meresOut,
    nb_meres: meresOut.length,
    nb_peres: peresOut.length,
    nb_graines_total: meres.reduce((s, m) => s + Number(m.nb_graines ?? 0), 0),
  }
}

async function loadProjet(id: unknown): Promise<Row> {
  return oneOr404('SELECT * FROM "ProjetOpenField" WHERE id_projet = ?', [id], 'Projet open field non trouvé')
}

// ── Projets ───────────────────────────────────────────────────────────────────

route('GET', '/open-field', async ({ query: q }) => {
  const statut = q.get('statut')
  const projets = statut
    ? await query<Row>('SELECT * FROM "ProjetOpenField" WHERE statut = ? ORDER BY created_at DESC', [statut])
    : await query<Row>('SELECT * FROM "ProjetOpenField" ORDER BY created_at DESC')
  const out: Row[] = []
  for (const p of projets) out.push(await enrichProjet(p))
  return { data: out }
})

route('GET', '/open-field/:id', async ({ params }) => ({
  data: await enrichProjet(await loadProjet(params.id)),
}))

route('POST', '/open-field', async ({ body }) => {
  const p = body as Row
  const obj: Row = { created_at: new Date().toISOString() }
  for (const f of PROJET_FIELDS) obj[f] = p[f] ?? null
  const id = await insert('ProjetOpenField', obj)
  return { status: 201, data: await enrichProjet((await one<Row>('SELECT * FROM "ProjetOpenField" WHERE id_projet = ?', [id]))!) }
})

route('PATCH', '/open-field/:id', async ({ params, body }) => {
  await loadProjet(params.id)
  const p = body as Row
  const upd: Row = {}
  for (const f of PROJET_FIELDS) if (f in p) upd[f] = p[f]
  await updateById('ProjetOpenField', 'id_projet', params.id, upd)
  return { data: await enrichProjet((await one<Row>('SELECT * FROM "ProjetOpenField" WHERE id_projet = ?', [params.id]))!) }
})

route('DELETE', '/open-field/:id', async ({ params }) => {
  await loadProjet(params.id)
  await run('DELETE FROM "PlanteMereOpenField" WHERE id_projet = ?', [params.id])
  await run('DELETE FROM "PlantePereOpenField" WHERE id_projet = ?', [params.id])
  await run('DELETE FROM "ProjetOpenField" WHERE id_projet = ?', [params.id])
  return { status: 204 }
})

// ── Mères ─────────────────────────────────────────────────────────────────────

route('POST', '/open-field/:id/meres', async ({ params, body }) => {
  await loadProjet(params.id)
  const p = body as Row
  const obj: Row = { id_projet: Number(params.id), created_at: new Date().toISOString() }
  for (const f of MERE_FIELDS) obj[f] = p[f] ?? null
  await insert('PlanteMereOpenField', obj)
  return { status: 201, data: await enrichProjet((await one<Row>('SELECT * FROM "ProjetOpenField" WHERE id_projet = ?', [params.id]))!) }
})

route('PATCH', '/open-field/:projet_id/meres/:mere_id', async ({ params, body }) => {
  await oneOr404('SELECT * FROM "PlanteMereOpenField" WHERE id_mere = ? AND id_projet = ?',
    [params.mere_id, params.projet_id], 'Mère non trouvée')
  const p = body as Row
  const upd: Row = {}
  for (const f of MERE_FIELDS) if (f in p) upd[f] = p[f]
  await updateById('PlanteMereOpenField', 'id_mere', params.mere_id, upd)
  return { data: await enrichProjet((await one<Row>('SELECT * FROM "ProjetOpenField" WHERE id_projet = ?', [params.projet_id]))!) }
})

route('DELETE', '/open-field/:projet_id/meres/:mere_id', async ({ params }) => {
  await oneOr404('SELECT * FROM "PlanteMereOpenField" WHERE id_mere = ? AND id_projet = ?',
    [params.mere_id, params.projet_id], 'Mère non trouvée')
  await run('DELETE FROM "PlanteMereOpenField" WHERE id_mere = ?', [params.mere_id])
  return { status: 204 }
})

// ── Récolte d'une mère ────────────────────────────────────────────────────────

route('POST', '/open-field/:projet_id/meres/:mere_id/recolte', async ({ params, body }) => {
  const mere = await oneOr404<Row>('SELECT * FROM "PlanteMereOpenField" WHERE id_mere = ? AND id_projet = ?',
    [params.mere_id, params.projet_id], 'Mère non trouvée')
  jsonify(mere, ['id_peres'])
  const p = body as Row
  const dateRecolte = p.date_recolte ? String(p.date_recolte) : todayISO()

  await updateById('PlanteMereOpenField', 'id_mere', params.mere_id, {
    date_recolte: dateRecolte,
    nb_graines: p.nb_graines ?? null,
    poids_graines_g: p.poids_graines_g ?? null,
    qualite_graines: p.qualite_graines ?? null,
  })

  if (p.creer_pack && p.nb_graines) {
    const projet = await one<Row>('SELECT * FROM "ProjetOpenField" WHERE id_projet = ?', [params.projet_id])

    // Nom du croisement
    let nomMere = mere.nom_phenotype ? String(mere.nom_phenotype) : 'Inconnue'
    if (mere.id_variete) {
      const v = await one<Row>('SELECT nom_variete FROM "Variete" WHERE id_variete = ?', [mere.id_variete])
      if (v?.nom_variete) nomMere = String(v.nom_variete)
    }
    const peresNoms: string[] = []
    const idPeres = (mere.id_peres as number[] | null) ?? []
    if (idPeres.length) {
      const peres = await query<Row>(
        `SELECT pe.*, v.nom_variete FROM "PlantePereOpenField" pe
         LEFT JOIN "Variete" v ON v.id_variete = pe.id_variete
         WHERE pe.id_projet = ? AND pe.id_pere IN (${idPeres.map(() => '?').join(',')})`,
        [params.projet_id, ...idPeres])
      for (const pe of peres) {
        peresNoms.push(String(pe.nom_variete ?? pe.nom_libre ?? `Mâle #${pe.id_pere}`))
      }
    }
    if (!peresNoms.length && mere.nom_pere_libre) peresNoms.push(String(mere.nom_pere_libre))
    if (!peresNoms.length) peresNoms.push('inconnu')

    const saison = projet?.saison ? String(projet.saison) : String(new Date().getFullYear())
    const nomCroisement = p.nom_variete_croisement
      ? String(p.nom_variete_croisement)
      : `${nomMere} × ${peresNoms.join(' / ')} (OF ${saison})`
    const croisementDesc = `♀ ${nomMere}  ×  ♂ ${peresNoms.join(', ')} — Open Field ${saison}`

    const idVariete = await insert('Variete', {
      nom_variete: nomCroisement,
      croisement_variete: croisementDesc,
      informations_variete: `Issu du projet open field : ${projet?.nom ?? ''}`,
    })
    const idPack = await insert('PackGraine', {
      id_fournisseur: null,
      nbr_graines: p.nb_graines,
      prix_achat: 0,
      date_achat: dateRecolte,
    })
    await run('UPDATE "PlanteMereOpenField" SET id_packgraine = ? WHERE id_mere = ?', [idPack, params.mere_id])

    for (let i = 0; i < Number(p.nb_graines); i++) {
      await insert('Graine', {
        id_breeder: null,
        id_variete: idVariete,
        id_packgraine: idPack,
        types_graines: 'Régulière',
        date_achat: dateRecolte,
        prix_achat: 0,
        utilisee: false,
      })
    }
  }

  // Projet → "recolte" si toutes les mères sont récoltées
  const restantes = await query<Row>(
    'SELECT id_mere FROM "PlanteMereOpenField" WHERE id_projet = ? AND date_recolte IS NULL', [params.projet_id])
  if (!restantes.length) {
    await run('UPDATE "ProjetOpenField" SET statut = ? WHERE id_projet = ?', ['recolte', params.projet_id])
  }

  return { data: await enrichProjet((await one<Row>('SELECT * FROM "ProjetOpenField" WHERE id_projet = ?', [params.projet_id]))!) }
})

// ── Pères ─────────────────────────────────────────────────────────────────────

route('POST', '/open-field/:id/peres', async ({ params, body }) => {
  await loadProjet(params.id)
  const p = body as Row
  const obj: Row = { id_projet: Number(params.id), created_at: new Date().toISOString() }
  for (const f of PERE_FIELDS) obj[f] = p[f] ?? null
  await insert('PlantePereOpenField', obj)
  return { status: 201, data: await enrichProjet((await one<Row>('SELECT * FROM "ProjetOpenField" WHERE id_projet = ?', [params.id]))!) }
})

route('PATCH', '/open-field/:projet_id/peres/:pere_id', async ({ params, body }) => {
  await oneOr404('SELECT * FROM "PlantePereOpenField" WHERE id_pere = ? AND id_projet = ?',
    [params.pere_id, params.projet_id], 'Pere non trouve')
  const p = body as Row
  const upd: Row = {}
  for (const f of PERE_FIELDS) if (f in p) upd[f] = p[f]
  await updateById('PlantePereOpenField', 'id_pere', params.pere_id, upd)
  return { data: await enrichProjet((await one<Row>('SELECT * FROM "ProjetOpenField" WHERE id_projet = ?', [params.projet_id]))!) }
})

route('DELETE', '/open-field/:projet_id/peres/:pere_id', async ({ params }) => {
  await oneOr404('SELECT * FROM "PlantePereOpenField" WHERE id_pere = ? AND id_projet = ?',
    [params.pere_id, params.projet_id], 'Pere non trouve')
  await run('DELETE FROM "PlantePereOpenField" WHERE id_pere = ?', [params.pere_id])
  return { status: 204 }
})
