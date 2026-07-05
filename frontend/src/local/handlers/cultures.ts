// ─── Handlers locaux : Cultures (CRUD, plants, actions, calendrier, stats) ─────
// Miroir de backend/app/routers/cultures.py.
// Non portés (501) : /compare (B5), /sechage/*, /curing/eligible, /plant/:id/stock-info,
// /plants-by-variete (B3), /export/pdf (B6).
import { route, LocalHttpError } from '../router'
import { query, one, oneOr404, insert, updateById, run, jsonify } from '../helpers'
import {
  Row, enrichCulture, enrichPlant, enrichAction, buildPlantName,
  maybeArchiveCulture, computeCultureCost, computeHarvestDate, handleActionEffects,
  todayISO, toSmallUnit, prixParPetiteUnite,
} from './cultures-helpers'

async function loadCulture(id: unknown): Promise<Row> {
  return oneOr404('SELECT * FROM "Culture" WHERE id_culture = ?', [id], 'Culture non trouvée')
}

function frDate(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split('-')
  return `${d}/${m}/${y}`
}

// ═══ Utils (chemins fixes — enregistrés avant /cultures/:id) ══════════════════

route('GET', '/cultures/pots', async () => {
  const pots = await query<Row>(
    `SELECT * FROM "Materiel" WHERE categorie = 'Pots' AND (etat IS NULL OR etat != 'Hors service') ORDER BY nom`)
  const occupied = await query<Row>(
    `SELECT p.id_pot, c.nom AS nom_culture FROM "Plant" p
     JOIN "Culture" c ON c.id_culture = p.id_culture
     WHERE p.id_pot IS NOT NULL AND p.statut NOT IN ('recolte','abandonne') AND c.statut != 'terminee'`)
  const enCours = new Map<number, string>()
  for (const o of occupied) enCours.set(Number(o.id_pot), String(o.nom_culture ?? ''))
  return {
    data: pots.map(p => {
      jsonify(p, ['caracteristiques'])
      const carac = (p.caracteristiques as Row | null) ?? {}
      return {
        id_pot: p.id_materiel,
        taille_pot: carac.volume ?? null,
        volume_l: carac.volume_l ?? null,
        dimension_pot: p.nom,
        etat: p.etat,
        en_cours: enCours.has(Number(p.id_materiel)),
        nom_culture_en_cours: enCours.get(Number(p.id_materiel)) ?? null,
      }
    }),
  }
})

route('GET', '/cultures/utils/transfer-targets', async ({ query: q }) => {
  const excludeId = Number(q.get('exclude_culture_id') ?? 0)
  const cultures = await query<Row>(
    `SELECT * FROM "Culture" WHERE statut = 'active' AND id_culture != ? ORDER BY date_debut DESC`, [excludeId])
  const culturesResult: Row[] = []
  for (const c of cultures) {
    let nomEspace: unknown = null
    if (c.id_espace) {
      const esp = await one<Row>('SELECT nom FROM "EspaceCulture" WHERE id_espace = ?', [c.id_espace])
      nomEspace = esp?.nom ?? null
    }
    culturesResult.push({
      id_culture: c.id_culture,
      nom: c.nom ?? `Culture #${c.id_culture}`,
      nom_espace: nomEspace,
      phase: c.phase,
    })
  }
  const espaces = await query<Row>(
    `SELECT id_espace, nom FROM "EspaceCulture"
     WHERE id_espace NOT IN (SELECT id_espace FROM "Culture" WHERE statut = 'active' AND id_espace IS NOT NULL)
     ORDER BY nom`)
  return { data: { cultures_actives: culturesResult, espaces_disponibles: espaces } }
})

route('GET', '/cultures/utils/espaces-clone', async () => {
  const espaces = await query<Row>(`SELECT * FROM "EspaceCulture" WHERE statut = 'Actif' ORDER BY nom`)
  const result: Row[] = []
  for (const esp of espaces) {
    const ca = await one<Row>(
      `SELECT id_culture, nom, phase FROM "Culture"
       WHERE id_espace = ? AND statut = 'active' ORDER BY date_debut DESC LIMIT 1`, [esp.id_espace])
    result.push({
      id_espace: esp.id_espace,
      nom: esp.nom,
      type_espace: esp.type_espace,
      culture_active: ca ? { id_culture: ca.id_culture, nom: ca.nom ?? `Culture #${ca.id_culture}`, phase: ca.phase } : null,
    })
  }
  // Boxes legacy
  const boxes = await query<Row>('SELECT * FROM "Box"')
  for (const box of boxes) {
    const ca = await one<Row>(
      `SELECT id_culture, nom, phase FROM "Culture"
       WHERE id_box = ? AND statut = 'active' ORDER BY date_debut DESC LIMIT 1`, [box.id_box])
    result.push({
      id_box: box.id_box,
      nom: box.largeur_tente ? `Box ${box.largeur_tente}x${box.profondeur_tente}` : `Box #${box.id_box}`,
      type_espace: 'Box',
      culture_active: ca ? { id_culture: ca.id_culture, nom: ca.nom ?? `Culture #${ca.id_culture}`, phase: ca.phase } : null,
    })
  }
  return { data: result }
})

route('GET', '/cultures/recettes-sol', async () => ({
  data: await query(
    `SELECT id_recette_lso, nom_recette, type_lso, quantite_totale, unite_quantite
     FROM "RecetteLSO" ORDER BY nom_recette`),
}))

route('GET', '/cultures/dernier-tco/:culture_id', async ({ params }) => {
  const action = await one<Row>(
    `SELECT * FROM "ActionCalendrier" WHERE id_culture = ? AND type_action = 'preparation_tco'
     ORDER BY date_action DESC, created_at DESC LIMIT 1`, [params.culture_id])
  if (!action) return { data: { found: false, is_ready: false } }
  jsonify(action, ['parametres'])
  const p = (action.parametres as Row | null) ?? {}
  const datePret = p.date_pret ? String(p.date_pret) : null
  let isReady = true
  if (datePret) {
    const t = Date.parse(datePret)
    isReady = isNaN(t) ? true : Date.now() >= t
  }
  return {
    data: {
      found: true,
      date_action: String(action.date_action),
      nom_recette: p.nom_recette ?? null,
      date_pret: datePret,
      is_ready: isReady,
    },
  }
})

// ═══ CRUD Cultures ═════════════════════════════════════════════════════════════

route('GET', '/cultures', async ({ query: q }) => {
  const statut = q.get('statut')
  const cultures = statut
    ? await query<Row>('SELECT * FROM "Culture" WHERE statut = ? ORDER BY date_debut DESC', [statut])
    : await query<Row>(`SELECT * FROM "Culture" WHERE statut IN ('active','sechage_curing') ORDER BY date_debut DESC`)
  const out: Row[] = []
  for (const c of cultures) out.push(await enrichCulture(c))
  return { data: out }
})

route('GET', '/cultures/:id', async ({ params }) => {
  const culture = await loadCulture(params.id)
  const data = await enrichCulture(culture)
  const plants = await query<Row>('SELECT * FROM "Plant" WHERE id_culture = ? ORDER BY numero_plant', [params.id])
  data.plants = await Promise.all(plants.map(enrichPlant))
  const actions = await query<Row>(
    'SELECT * FROM "ActionCalendrier" WHERE id_culture = ? ORDER BY date_action DESC LIMIT 10', [params.id])
  data.actions_recentes = await Promise.all(actions.map(enrichAction))
  return { data }
})

route('POST', '/cultures', async ({ body }) => {
  const payload = body as Row
  const grainesSelection = (payload.graines_selection as Row[] | undefined) ?? []
  const plantesExternes = (payload.plantes_externes as Row[] | undefined) ?? []
  const modeExterne = plantesExternes.length > 0

  const espace = await oneOr404<Row>('SELECT * FROM "EspaceCulture" WHERE id_espace = ?',
    [payload.id_espace], 'Espace de culture introuvable')

  if (!modeExterne && !grainesSelection.length) {
    throw new LocalHttpError(400, 'Au moins une variété de graine est requise.')
  }

  if (!modeExterne) {
    const existing = await one<Row>(
      `SELECT nom FROM "Culture" WHERE id_espace = ? AND statut = 'active'`, [payload.id_espace])
    if (existing) {
      throw new LocalHttpError(409,
        `L'espace « ${espace.nom} » a déjà une culture active : « ${existing.nom} ». ` +
        `Passez-la en séchage/curing ou clôturez-la avant d'en démarrer une nouvelle.`)
    }
  }

  const potsDemandes = grainesSelection.map(s => s.id_pot).filter(v => v !== null && v !== undefined)
  if (potsDemandes.length) {
    const conflict = await one<Row>(
      `SELECT p.nom_affichage, c.nom AS nom_culture FROM "Plant" p
       JOIN "Culture" c ON c.id_culture = p.id_culture
       WHERE p.id_pot IN (${potsDemandes.map(() => '?').join(',')})
       AND p.statut NOT IN ('recolte','abandonne') AND c.statut != 'terminee' LIMIT 1`, potsDemandes)
    if (conflict) {
      throw new LocalHttpError(409,
        `Le pot sélectionné est déjà utilisé par « ${conflict.nom_affichage} » dans la culture « ${conflict.nom_culture} ».`)
    }
  }

  const dateDebut = String(payload.date_debut)
  let cultureStatut: string, culturePhase: string, nom: unknown
  if (modeExterne) {
    cultureStatut = 'sechage_curing'
    culturePhase = 'sechage_curing'
    nom = payload.nom ?? `Import externe ${espace.nom} — ${frDate(dateDebut)}`
  } else {
    cultureStatut = 'active'
    culturePhase = 'germination'
    nom = payload.nom ?? `Culture ${espace.nom} — ${frDate(dateDebut)}`
  }

  const idCulture = await insert('Culture', {
    id_espace: payload.id_espace,
    nom,
    date_debut: dateDebut,
    statut: cultureStatut,
    type_culture: payload.type_culture ?? null,
    type_eclairage: payload.type_eclairage ?? null,
    but_culture: payload.but_culture ?? null,
    notes: payload.notes ?? null,
    phase: culturePhase,
  })

  let plantCounter = 1

  for (const sel of grainesSelection) {
    const nb = Number(sel.nb_plantes)
    const graines = await query<Row>(
      `SELECT * FROM "Graine" WHERE id_packgraine = ? AND (utilisee = 0 OR utilisee IS NULL)
       ORDER BY id_graine LIMIT ?`, [sel.id_packgraine, nb])
    if (graines.length < nb) {
      // Nettoyage : la culture vient d'être créée, on la supprime avant de rejeter
      await run('DELETE FROM "Culture" WHERE id_culture = ?', [idCulture])
      throw new LocalHttpError(400,
        `Pas assez de graines disponibles dans le paquet ${sel.id_packgraine} (demandé: ${nb}, disponible: ${graines.length})`)
    }
    for (const graine of graines) {
      const nomPlant = await buildPlantName(graine.id_graine, plantCounter)
      await insert('Plant', {
        id_culture: idCulture,
        id_graine: graine.id_graine,
        nom_affichage: nomPlant,
        numero_plant: plantCounter,
        origine: 'graine',
        statut: 'germination',
        substrat: payload.substrat_defaut ?? null,
        id_recette_sol: payload.id_recette_sol_defaut ?? null,
        id_pot: sel.id_pot ?? payload.id_pot_defaut ?? null,
        volume_pot_l: sel.volume_pot_l ?? payload.volume_pot_l_defaut ?? null,
      })
      await run('UPDATE "Graine" SET utilisee = 1 WHERE id_graine = ?', [graine.id_graine])
      plantCounter++
    }
  }

  for (const pe of plantesExternes) {
    const notesParts: string[] = []
    if (pe.provenance) notesParts.push(`Provenance: ${pe.provenance}`)
    if (pe.prix_g !== null && pe.prix_g !== undefined) notesParts.push(`Prix: ${Number(pe.prix_g).toFixed(2)}€/g`)
    if (pe.notes) notesParts.push(String(pe.notes))
    await insert('Plant', {
      id_culture: idCulture,
      nom_affichage: pe.nom_affichage,
      numero_plant: plantCounter,
      origine: 'graine', // enum contraint — "externe" stocké dans notes
      statut: pe.statut,
      date_recolte: pe.date_recolte ?? null,
      date_fin_sechage: pe.statut === 'curing' ? (pe.date_fin_sechage ?? null) : null,
      poids_recolte_g: pe.poids_g ?? null,
      notes: notesParts.join('\n') || null,
    })
    plantCounter++
  }

  const culture = await one<Row>('SELECT * FROM "Culture" WHERE id_culture = ?', [idCulture])
  return { status: 201, data: await enrichCulture(culture!) }
})

route('PUT', '/cultures/:id', async ({ params, body }) => {
  await loadCulture(params.id)
  const p = body as Row
  const upd: Row = {}
  for (const f of ['nom', 'id_espace', 'date_debut', 'statut', 'date_fin', 'date_recolte_estimee',
                   'date_passage_12_12', 'date_debut_floraison', 'phase',
                   'type_culture', 'type_eclairage', 'but_culture', 'notes']) {
    if (p[f] !== null && p[f] !== undefined) upd[f] = p[f]
  }
  await updateById('Culture', 'id_culture', params.id, upd)
  const updated = await one<Row>('SELECT * FROM "Culture" WHERE id_culture = ?', [params.id])
  if (p.date_passage_12_12) await computeHarvestDate(updated!)
  const final = await one<Row>('SELECT * FROM "Culture" WHERE id_culture = ?', [params.id])
  return { data: await enrichCulture(final!) }
})

route('DELETE', '/cultures/:id', async ({ params }) => {
  const culture = await loadCulture(params.id)
  if (!['terminee', 'sechage_curing'].includes(String(culture.statut))) {
    throw new LocalHttpError(400,
      'Seules les cultures terminées ou en séchage/curing peuvent être supprimées. ' +
      'Clôturez d\'abord la culture avant de la supprimer.')
  }
  await run('DELETE FROM "ActionCalendrier" WHERE id_culture = ?', [params.id])
  await run('DELETE FROM "Plant" WHERE id_culture = ?', [params.id])
  await run('DELETE FROM "Culture" WHERE id_culture = ?', [params.id])
  return { status: 204 }
})

route('GET', '/cultures/:id/cout', async ({ params }) => {
  await loadCulture(params.id)
  return { data: await computeCultureCost(Number(params.id)) }
})

route('POST', '/cultures/:id/close', async ({ params }) => {
  const culture = await loadCulture(params.id)
  await maybeArchiveCulture(culture, true)
  const c = await one<Row>('SELECT * FROM "Culture" WHERE id_culture = ?', [params.id])
  if (c && c.statut !== 'terminee') {
    await run('UPDATE "Culture" SET statut = ?, date_fin = COALESCE(date_fin, ?) WHERE id_culture = ?',
      ['terminee', todayISO(), params.id])
  }
  const final = await one<Row>('SELECT * FROM "Culture" WHERE id_culture = ?', [params.id])
  return { data: await enrichCulture(final!) }
})

// ═══ Plants ════════════════════════════════════════════════════════════════════

route('GET', '/cultures/:id/plants', async ({ params }) => {
  await loadCulture(params.id)
  const plants = await query<Row>('SELECT * FROM "Plant" WHERE id_culture = ? ORDER BY numero_plant', [params.id])
  return { data: await Promise.all(plants.map(enrichPlant)) }
})

route('POST', '/cultures/:id/plants', async ({ params, body }) => {
  await loadCulture(params.id)
  const p = body as Row
  let nomAffichage = p.nom_affichage
  if (p.id_graine) {
    nomAffichage = await buildPlantName(p.id_graine, Number(p.numero_plant ?? 1))
  }
  const idPlant = await insert('Plant', {
    id_culture: Number(params.id),
    id_graine: p.id_graine ?? null,
    nom_affichage: nomAffichage,
    numero_plant: p.numero_plant ?? null,
    origine: p.origine ?? null,
    statut: p.statut ?? null,
    date_germination: p.date_germination ?? null,
    date_debut_flo: p.date_debut_flo ?? null,
    date_recolte: p.date_recolte ?? null,
    date_fin_sechage: p.date_fin_sechage ?? null,
    poids_recolte_g: p.poids_recolte_g ?? null,
    notes: p.notes ?? null,
  })
  const plant = await one<Row>('SELECT * FROM "Plant" WHERE id_plant = ?', [idPlant])
  return { status: 201, data: await enrichPlant(plant!) }
})

async function loadPlant(cultureId: unknown, plantId: unknown): Promise<Row> {
  return oneOr404('SELECT * FROM "Plant" WHERE id_plant = ? AND id_culture = ?',
    [plantId, cultureId], 'Plant non trouvé')
}

route('PUT', '/cultures/:culture_id/plants/:plant_id', async ({ params, body }) => {
  const plant = await loadPlant(params.culture_id, params.plant_id)
  const p = body as Row
  if (p.id_pot !== null && p.id_pot !== undefined && p.id_pot !== plant.id_pot) {
    const conflict = await one<Row>(
      `SELECT pl.nom_affichage, c.nom AS nom_culture FROM "Plant" pl
       JOIN "Culture" c ON c.id_culture = pl.id_culture
       WHERE pl.id_pot = ? AND pl.id_plant != ? AND pl.statut NOT IN ('recolte','abandonne')
       AND c.statut != 'terminee' LIMIT 1`, [p.id_pot, params.plant_id])
    if (conflict) {
      throw new LocalHttpError(409,
        `Ce pot est déjà utilisé par « ${conflict.nom_affichage} » dans la culture « ${conflict.nom_culture} ».`)
    }
  }
  const upd: Row = {}
  for (const f of ['nom_affichage', 'statut', 'date_germination', 'date_debut_flo',
                   'date_recolte', 'date_fin_sechage', 'poids_recolte_g',
                   'substrat', 'id_recette_sol', 'id_pot', 'volume_pot_l', 'notes']) {
    if (p[f] !== null && p[f] !== undefined) upd[f] = p[f]
  }
  await updateById('Plant', 'id_plant', params.plant_id, upd)
  const updated = await one<Row>('SELECT * FROM "Plant" WHERE id_plant = ?', [params.plant_id])
  return { data: await enrichPlant(updated!) }
})

route('POST', '/cultures/:culture_id/plants/:plant_id/transfer', async ({ params, body }) => {
  await loadPlant(params.culture_id, params.plant_id)
  const p = body as Row
  if (!p.target_culture_id && !p.target_espace_id) {
    throw new LocalHttpError(400, 'Fournir target_culture_id ou target_espace_id')
  }
  let targetCultureId: number
  if (p.target_culture_id) {
    const target = await oneOr404<Row>('SELECT * FROM "Culture" WHERE id_culture = ?',
      [p.target_culture_id], 'Culture cible non trouvée')
    if (target.statut !== 'active') throw new LocalHttpError(400, 'La culture cible doit être active')
    targetCultureId = Number(target.id_culture)
  } else {
    const espace = await oneOr404<Row>('SELECT * FROM "EspaceCulture" WHERE id_espace = ?',
      [p.target_espace_id], 'Espace non trouvé')
    const existing = await one<Row>(
      `SELECT id_culture FROM "Culture" WHERE id_espace = ? AND statut = 'active'`, [p.target_espace_id])
    if (existing) throw new LocalHttpError(409, 'Cet espace a déjà une culture active')
    targetCultureId = await insert('Culture', {
      nom: `${espace.nom} — ${frDate(todayISO())}`,
      id_espace: p.target_espace_id,
      date_debut: todayISO(),
      statut: 'active',
    })
  }
  await run('UPDATE "Plant" SET id_culture = ? WHERE id_plant = ?', [targetCultureId, params.plant_id])
  await run('UPDATE "ActionCalendrier" SET id_culture = ? WHERE id_plant = ? AND id_culture = ?',
    [targetCultureId, params.plant_id, params.culture_id])
  const plant = await one<Row>('SELECT * FROM "Plant" WHERE id_plant = ?', [params.plant_id])
  return { data: await enrichPlant(plant!) }
})

route('DELETE', '/cultures/:culture_id/plants/:plant_id', async ({ params }) => {
  await loadPlant(params.culture_id, params.plant_id)
  await run('DELETE FROM "ActionCalendrier" WHERE id_plant = ?', [params.plant_id])
  await run('UPDATE "Plant" SET id_plant_mere = NULL WHERE id_plant_mere = ?', [params.plant_id])
  await run('DELETE FROM "Plant" WHERE id_plant = ?', [params.plant_id])
  return { status: 204 }
})

// ═══ Clonage ═══════════════════════════════════════════════════════════════════

route('POST', '/cultures/:culture_id/plants/:plant_id/clone', async ({ params, body }) => {
  const mere = await oneOr404<Row>('SELECT * FROM "Plant" WHERE id_plant = ? AND id_culture = ?',
    [params.plant_id, params.culture_id], 'Plante mere non trouvee')
  const p = body as Row
  const idEspace = p.id_espace
  const idBox = p.id_box

  let cultureCible: Row | null = null
  if (idEspace) {
    cultureCible = await one<Row>(
      `SELECT * FROM "Culture" WHERE id_espace = ? AND statut = 'active' ORDER BY date_debut DESC LIMIT 1`, [idEspace])
    if (!cultureCible) {
      const espace = await one<Row>('SELECT nom FROM "EspaceCulture" WHERE id_espace = ?', [idEspace])
      const idNew = await insert('Culture', {
        nom: `Boutures — ${espace?.nom ?? `Espace #${idEspace}`}`,
        id_espace: idEspace,
        statut: 'active',
        date_debut: todayISO(),
        type_culture: 'Indoor',
        type_eclairage: 'Autre',
        but_culture: 'Reproduction',
        phase: 'veg',
      })
      cultureCible = await one<Row>('SELECT * FROM "Culture" WHERE id_culture = ?', [idNew])
    }
  } else if (idBox) {
    cultureCible = await one<Row>(
      `SELECT * FROM "Culture" WHERE id_box = ? AND statut = 'active' ORDER BY date_debut DESC LIMIT 1`, [idBox])
    if (!cultureCible) {
      const idNew = await insert('Culture', {
        nom: `Boutures — Box #${idBox}`,
        id_box: idBox,
        statut: 'active',
        date_debut: todayISO(),
        type_culture: 'Indoor',
        type_eclairage: 'Autre',
        but_culture: 'Reproduction',
        phase: 'veg',
      })
      cultureCible = await one<Row>('SELECT * FROM "Culture" WHERE id_culture = ?', [idNew])
    }
  } else {
    cultureCible = await one<Row>('SELECT * FROM "Culture" WHERE id_culture = ?', [params.culture_id])
  }

  const idCultureCible = Number(cultureCible!.id_culture)
  const maxNumRow = await one<{ m: number | null }>(
    'SELECT MAX(numero_plant) AS m FROM "Plant" WHERE id_culture = ?', [idCultureCible])
  const maxNum = Number(maxNumRow?.m ?? 0)

  const datePrel = p.date_prelevement ? String(p.date_prelevement) : todayISO()
  const nomBase = p.nom_affichage ? String(p.nom_affichage) : `Clone de ${mere.nom_affichage}`
  const quantite = Math.max(1, Number(p.quantite ?? 1))

  const results: Row[] = []
  for (let i = 0; i < quantite; i++) {
    const nom = quantite > 1 ? `${nomBase} #${i + 1}` : nomBase
    const idClone = await insert('Plant', {
      id_culture: idCultureCible,
      id_graine: mere.id_graine ?? null,
      nom_affichage: nom,
      numero_plant: maxNum + i + 1,
      origine: 'clone',
      statut: 'germination',
      substrat: mere.substrat ?? null,
      id_recette_sol: mere.id_recette_sol ?? null,
      notes: p.notes ?? null,
      id_plant_mere: Number(params.plant_id),
      date_prelevement: datePrel,
      statut_clone: 'en_attente',
    })
    const clone = await one<Row>('SELECT * FROM "Plant" WHERE id_plant = ?', [idClone])
    const enriched = await enrichPlant(clone!)
    enriched.id_culture_cible = idCultureCible
    enriched.nom_culture_cible = cultureCible!.nom
    results.push(enriched)
  }
  return { status: 201, data: results }
})

route('PATCH', '/cultures/:culture_id/plants/:plant_id/enraciner', async ({ params, body }) => {
  const plant = await loadPlant(params.culture_id, params.plant_id)
  if (plant.origine !== 'clone') throw new LocalHttpError(400, "Ce plant n'est pas un clone")
  const dateEnr = (body as Row)?.date_enracinement ?? todayISO()
  await run('UPDATE "Plant" SET date_enracinement = ?, statut_clone = ? WHERE id_plant = ?',
    [dateEnr, 'enracine', params.plant_id])
  const updated = await one<Row>('SELECT * FROM "Plant" WHERE id_plant = ?', [params.plant_id])
  return { data: await enrichPlant(updated!) }
})

route('PATCH', '/cultures/:culture_id/plants/:plant_id/clone-rate', async ({ params }) => {
  const plant = await loadPlant(params.culture_id, params.plant_id)
  if (plant.origine !== 'clone') throw new LocalHttpError(400, "Ce plant n'est pas un clone")
  await run('UPDATE "Plant" SET statut_clone = ?, statut = ? WHERE id_plant = ?',
    ['rate', 'abandonne', params.plant_id])
  const updated = await one<Row>('SELECT * FROM "Plant" WHERE id_plant = ?', [params.plant_id])
  return { data: await enrichPlant(updated!) }
})

// ═══ Calendrier / Actions ══════════════════════════════════════════════════════

route('GET', '/cultures/:id/calendrier', async ({ params, query: q }) => {
  await loadCulture(params.id)
  const month = q.get('month')
  let year: number, m: number
  if (month) {
    year = Number(month.slice(0, 4))
    m = Number(month.slice(5, 7))
    if (!year || !m) throw new LocalHttpError(422, 'Format invalide, utiliser YYYY-MM')
  } else {
    const t = new Date()
    year = t.getFullYear()
    m = t.getMonth() + 1
  }
  const prefix = `${year}-${String(m).padStart(2, '0')}`
  const actions = await query<Row>(
    `SELECT * FROM "ActionCalendrier" WHERE id_culture = ? AND date_action LIKE ?
     ORDER BY date_action, created_at`, [params.id, `${prefix}%`])
  return { data: await Promise.all(actions.map(enrichAction)) }
})

async function insertAction(cultureId: number, plantId: number | null, p: Row, globalCulture: boolean): Promise<Row> {
  const id = await insert('ActionCalendrier', {
    id_culture: cultureId,
    id_plant: plantId,
    date_action: p.date_action,
    type_action: p.type_action,
    parametres: p.parametres ?? null,
    note: p.note ?? null,
    global_culture: globalCulture,
    created_at: new Date().toISOString(),
  })
  return (await one<Row>('SELECT * FROM "ActionCalendrier" WHERE id_action = ?', [id]))!
}

route('POST', '/cultures/:id/actions', async ({ params, body }) => {
  const culture = await loadCulture(params.id)
  const p = body as Row
  const cultureId = Number(params.id)
  const isGlobal = !!p.global_culture || p.id_plant === null || p.id_plant === undefined

  if (p.space_only) {
    const action = await insertAction(cultureId, null, p, true)
    await handleActionEffects(action, culture)
    return { status: 201, data: [await enrichAction(action)] }
  }

  if (isGlobal) {
    const plants = await query<Row>(
      `SELECT * FROM "Plant" WHERE id_culture = ? AND statut NOT IN ('recolte','curing','prete','abandonne','wpff')`,
      [cultureId])
    const created: Row[] = []
    for (const pl of plants) {
      const action = await insertAction(cultureId, Number(pl.id_plant), p, false)
      await handleActionEffects(action, culture)
      created.push(action)
    }
    if (!created.length) {
      const action = await insertAction(cultureId, null, p, true)
      await handleActionEffects(action, culture)
      created.push(action)
    }
    return { status: 201, data: await Promise.all(created.map(enrichAction)) }
  }

  const action = await insertAction(cultureId, Number(p.id_plant), p, false)
  await handleActionEffects(action, culture)
  return { status: 201, data: [await enrichAction(action)] }
})

route('PUT', '/cultures/:culture_id/actions/:action_id', async ({ params, body }) => {
  await oneOr404('SELECT * FROM "ActionCalendrier" WHERE id_action = ? AND id_culture = ?',
    [params.action_id, params.culture_id], 'Action non trouvée')
  const p = body as Row
  await updateById('ActionCalendrier', 'id_action', params.action_id, {
    date_action: p.date_action,
    type_action: p.type_action,
    parametres: p.parametres ?? null,
    note: p.note ?? null,
    id_plant: p.id_plant ?? null,
    global_culture: !!p.global_culture,
  })
  const updated = await one<Row>('SELECT * FROM "ActionCalendrier" WHERE id_action = ?', [params.action_id])
  return { data: await enrichAction(updated!) }
})

route('DELETE', '/cultures/:culture_id/actions/:action_id', async ({ params }) => {
  await oneOr404('SELECT * FROM "ActionCalendrier" WHERE id_action = ? AND id_culture = ?',
    [params.action_id, params.culture_id], 'Action non trouvée')
  await run('DELETE FROM "ActionCalendrier" WHERE id_action = ?', [params.action_id])
  return { status: 204 }
})

route('GET', '/cultures/:culture_id/actions/:action_id/cout', async ({ params }) => {
  const action = await oneOr404<Row>('SELECT * FROM "ActionCalendrier" WHERE id_action = ? AND id_culture = ?',
    [params.action_id, params.culture_id], 'Action non trouvée')
  jsonify(action, ['parametres'])
  const p = (action.parametres as Row | null) ?? {}
  const idRecette = p.id_recette
  if (!idRecette) return { data: { cout_total: null, par_produit: [] } }
  const volumeL = Number(p.volume_total_l ?? p.volume_l ?? 1)
  const recette = await one<Row>('SELECT * FROM "RecetteEngrais" WHERE id_recette = ?', [idRecette])
  if (!recette) return { data: { cout_total: null, par_produit: [] } }

  const lignes = await query<Row>('SELECT * FROM "RecetteEngraisLigne" WHERE id_recette = ?', [idRecette])
  const parProduit: Row[] = []
  let coutTotal = 0
  for (const ligne of lignes) {
    const prod = await one<Row>('SELECT * FROM "ProduitEngrais" WHERE id_produit = ?', [ligne.id_produit])
    const prix = prixParPetiteUnite(prod)
    if (prix === null) {
      parProduit.push({ nom: prod?.nom_produit ?? `Produit #${ligne.id_produit}`, cout: null })
      continue
    }
    const qte = toSmallUnit(Number(ligne.dosage) * volumeL, ligne.unite as string | null)
    const cout = qte * prix
    coutTotal += cout
    parProduit.push({ nom: prod!.nom_produit, cout: Math.round(cout * 10000) / 10000 })
  }
  return {
    data: {
      cout_total: parProduit.length ? Math.round(coutTotal * 10000) / 10000 : null,
      par_produit: parProduit,
    },
  }
})

// ═══ Stats ═════════════════════════════════════════════════════════════════════

route('GET', '/cultures/:id/stats', async ({ params }) => {
  await loadCulture(params.id)
  const actions = await query<Row>(
    'SELECT * FROM "ActionCalendrier" WHERE id_culture = ? ORDER BY date_action', [params.id])
  const plants = await query<Row>('SELECT id_plant, nom_affichage FROM "Plant" WHERE id_culture = ?', [params.id])
  const plantsMap = new Map(plants.map(pl => [Number(pl.id_plant), String(pl.nom_affichage)]))

  const hauteurs: Record<string, Row[]> = {}
  const arrosages: Row[] = []
  const intensites: Row[] = []

  for (const a of actions) {
    jsonify(a, ['parametres'])
    const params2 = (a.parametres as Row | null) ?? {}
    const d = String(a.date_action)
    const type = String(a.type_action)
    if (type === 'hauteur_plante') {
      const nom = a.id_plant ? (plantsMap.get(Number(a.id_plant)) ?? 'Global') : 'Global'
      ;(hauteurs[nom] = hauteurs[nom] ?? []).push({ date: d, hauteur_cm: params2.hauteur_cm ?? null })
    } else if (['arrosage_eau', 'arrosage_engrais', 'arrosage_tco', 'preparation_tco'].includes(type)) {
      const volL = params2.volume_l
      arrosages.push({ date: d, volume_ml: volL ? Math.round(Number(volL) * 1000) : null, type })
    } else if (type === 'intensite_lampe') {
      intensites.push({
        date: d,
        puissance_avant: params2.puissance_avant ?? null,
        puissance_apres: params2.puissance_apres ?? null,
      })
    }
  }
  return {
    data: {
      hauteurs,
      arrosages,
      intensites_lampe: intensites,
      nb_actions_total: actions.length,
    },
  }
})

