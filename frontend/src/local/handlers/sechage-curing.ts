// ─── Handlers locaux : Séchage, Curing, WPFF + routes cultures liées ──────────
// Miroir de backend/app/routers/{sechage,curing}.py + cultures.py (sechage/plants,
// eligible, plants-by-variete, stock-info) + materiel.py (bocal-timeline).
import { route, LocalHttpError } from '../router'
import { query, one, oneOr404, insert, updateById, run, jsonify } from '../helpers'
import { Row, maybeCloseCulture, maybeArchiveCulture, todayISO, daysBetween } from './cultures-helpers'

const num = (v: unknown): number | null => (v === null || v === undefined ? null : Number(v))

// ── Enrichissements ───────────────────────────────────────────────────────────

async function plantInfos(idPlant: unknown): Promise<{ plant: Row | null; nomVariete: unknown; nomCulture: unknown }> {
  const plant = await one<Row>('SELECT * FROM "Plant" WHERE id_plant = ?', [idPlant])
  let nomVariete: unknown = null
  let nomCulture: unknown = null
  if (plant) {
    const c = await one<Row>('SELECT nom FROM "Culture" WHERE id_culture = ?', [plant.id_culture])
    nomCulture = c?.nom ?? null
    if (plant.id_graine) {
      const g = await one<Row>(
        `SELECT v.nom_variete FROM "Graine" g LEFT JOIN "Variete" v ON v.id_variete = g.id_variete
         WHERE g.id_graine = ?`, [plant.id_graine])
      nomVariete = g?.nom_variete ?? null
    }
  }
  return { plant, nomVariete, nomCulture }
}

async function enrichPlantSechage(ps: Row): Promise<Row> {
  const { plant, nomVariete, nomCulture } = await plantInfos(ps.id_plant)
  return {
    id_plant_sechage: ps.id_plant_sechage,
    id_plant: ps.id_plant,
    id_session_sechage: ps.id_session_sechage,
    date_mise_sechage: ps.date_mise_sechage,
    date_fin_sechage: ps.date_fin_sechage,
    poids_humide_g: num(ps.poids_humide_g),
    poids_sec_g: num(ps.poids_sec_g),
    notes: ps.notes,
    nom_plant: plant?.nom_affichage ?? null,
    nom_variete: nomVariete,
    id_culture: plant?.id_culture ?? null,
    nom_culture: nomCulture,
  }
}

async function enrichSessionSechage(s: Row): Promise<Row> {
  const esp = s.id_espace ? await one<Row>('SELECT nom FROM "EspaceCulture" WHERE id_espace = ?', [s.id_espace]) : null
  const plants = await query<Row>('SELECT * FROM "PlantSechage" WHERE id_session_sechage = ?', [s.id_session_sechage])
  const enriched = await Promise.all(plants.map(enrichPlantSechage))
  return {
    ...s,
    temperature_cible: num(s.temperature_cible),
    humidite_cible: num(s.humidite_cible),
    nom_espace: esp?.nom ?? null,
    nb_plants: enriched.length,
    plants: enriched,
  }
}

async function enrichPlantCuring(pc: Row): Promise<Row> {
  const { plant, nomVariete, nomCulture } = await plantInfos(pc.id_plant)
  return {
    id_plant_curing: pc.id_plant_curing,
    id_plant: pc.id_plant,
    id_session_curing: pc.id_session_curing,
    date_mise_curing: pc.date_mise_curing,
    date_fin_curing: pc.date_fin_curing,
    poids_debut_g: num(pc.poids_debut_g),
    poids_final_g: num(pc.poids_final_g),
    notes: pc.notes,
    nom_plant: plant?.nom_affichage ?? null,
    nom_variete: nomVariete,
    id_culture: plant?.id_culture ?? null,
    nom_culture: nomCulture,
    date_recolte: plant?.date_recolte ?? null,
  }
}

async function enrichSessionCuring(s: Row): Promise<Row> {
  const esp = s.id_espace ? await one<Row>('SELECT nom FROM "EspaceCulture" WHERE id_espace = ?', [s.id_espace]) : null
  const mat = s.id_materiel_bocal ? await one<Row>('SELECT nom FROM "Materiel" WHERE id_materiel = ?', [s.id_materiel_bocal]) : null
  const plants = await query<Row>('SELECT * FROM "PlantCuring" WHERE id_session_curing = ?', [s.id_session_curing])
  const enriched = await Promise.all(plants.map(enrichPlantCuring))
  return {
    ...s,
    volume_contenant_l: num(s.volume_contenant_l),
    nom_espace: esp?.nom ?? null,
    nom_materiel_bocal: mat?.nom ?? null,
    nb_plants: enriched.length,
    plants: enriched,
  }
}

async function verifierCulture(idCulture: unknown): Promise<void> {
  if (!idCulture) return
  const culture = await one<Row>('SELECT * FROM "Culture" WHERE id_culture = ?', [idCulture])
  if (culture) {
    await maybeCloseCulture(culture)
    await maybeArchiveCulture(culture)
  }
}

// ═══ Séchage — sessions ════════════════════════════════════════════════════════

// WPFF avant /:id (chemin fixe /sechage/plants/:id/wpff — 3 segments, pas de conflit,
// mais on l'enregistre en premier par prudence)
route('POST', '/sechage/plants/:id_plant/wpff', async ({ params, body }) => {
  const plant = await oneOr404<Row>('SELECT * FROM "Plant" WHERE id_plant = ?', [params.id_plant], 'Plante introuvable')
  const p = (body as Row) ?? {}
  const actionDate = p.date_action ? String(p.date_action) : todayISO()
  const poids = Number(p.poids_g ?? 0)
  const idCulture = plant.id_culture

  // 1. Statut plante + poids sec estimé (humide / 5)
  await run('UPDATE "Plant" SET statut = ?, poids_recolte_g = CASE WHEN ? > 0 THEN ? ELSE poids_recolte_g END WHERE id_plant = ?',
    ['wpff', poids, Math.round((poids / 5) * 100) / 100, params.id_plant])

  // 2. Clôturer la session de séchage active éventuelle
  const ps = await one<Row>(
    'SELECT * FROM "PlantSechage" WHERE id_plant = ? AND date_fin_sechage IS NULL', [params.id_plant])
  if (ps) {
    await run('UPDATE "PlantSechage" SET date_fin_sechage = ?, poids_sec_g = CASE WHEN ? > 0 THEN ? ELSE poids_sec_g END WHERE id_plant_sechage = ?',
      [actionDate, poids, poids, ps.id_plant_sechage])
  }

  // 3. Variété via graine
  let idVariete: unknown = null
  if (plant.id_graine) {
    const g = await one<Row>('SELECT id_variete FROM "Graine" WHERE id_graine = ?', [plant.id_graine])
    idVariete = g?.id_variete ?? null
  }

  // 4. Stock WPFF (poids humide réel)
  const idStock = await insert('Stock', {
    id_variete: idVariete,
    type_stock: 'WPFF',
    date_stock: actionDate,
    quantite_stock: poids,
  })

  // 5. Action calendrier
  await insert('ActionCalendrier', {
    id_plant: Number(params.id_plant),
    id_culture: idCulture,
    date_action: actionDate,
    type_action: 'wpff',
    parametres: { poids_g: poids, id_stock: idStock },
    global_culture: false,
    created_at: new Date().toISOString(),
  })

  // 6. Lifecycle culture
  await verifierCulture(idCulture)

  return { data: { ok: true, id_stock: idStock, quantite_g: poids } }
})

route('GET', '/sechage', async ({ query: q }) => {
  const statut = q.get('statut')
  const sessions = statut
    ? await query<Row>('SELECT * FROM "SessionSechage" WHERE statut = ? ORDER BY date_debut DESC', [statut])
    : await query<Row>('SELECT * FROM "SessionSechage" ORDER BY date_debut DESC')
  const out: Row[] = []
  for (const s of sessions) out.push(await enrichSessionSechage(s))
  return { data: out }
})

route('GET', '/sechage/:id', async ({ params }) => ({
  data: await enrichSessionSechage(await oneOr404('SELECT * FROM "SessionSechage" WHERE id_session_sechage = ?',
    [params.id], 'Session de séchage introuvable')),
}))

route('POST', '/sechage', async ({ body }) => {
  const p = body as Row
  const id = await insert('SessionSechage', {
    id_espace: p.id_espace ?? null,
    nom: p.nom ?? null,
    methode_sechage: p.methode_sechage ?? null,
    temperature_cible: p.temperature_cible ?? null,
    humidite_cible: p.humidite_cible ?? null,
    date_debut: p.date_debut ?? null,
    notes: p.notes ?? null,
    statut: 'active',
    created_at: new Date().toISOString(),
  })
  for (const pl of (p.plants as Row[] | undefined) ?? []) {
    await oneOr404('SELECT id_plant FROM "Plant" WHERE id_plant = ?', [pl.id_plant], `Plant ${pl.id_plant} introuvable`)
    await insert('PlantSechage', {
      id_plant: pl.id_plant,
      id_session_sechage: id,
      date_mise_sechage: pl.date_mise_sechage ?? p.date_debut ?? null,
      poids_humide_g: pl.poids_humide_g ?? null,
      poids_sec_g: pl.poids_sec_g ?? null,
      notes: pl.notes ?? null,
    })
    const dateRecolte = pl.date_mise_sechage ?? p.date_debut
    await run('UPDATE "Plant" SET statut = ?, date_recolte = COALESCE(?, date_recolte) WHERE id_plant = ?',
      ['sechage', dateRecolte ?? null, pl.id_plant])
  }
  const s = await one<Row>('SELECT * FROM "SessionSechage" WHERE id_session_sechage = ?', [id])
  return { data: await enrichSessionSechage(s!) }
})

route('PUT', '/sechage/:id', async ({ params, body }) => {
  await oneOr404('SELECT * FROM "SessionSechage" WHERE id_session_sechage = ?', [params.id], 'Session de séchage introuvable')
  const p = body as Row
  const upd: Row = {}
  for (const f of ['id_espace', 'nom', 'methode_sechage', 'temperature_cible', 'humidite_cible', 'statut', 'date_debut', 'date_fin', 'notes']) {
    if (f in p) upd[f] = p[f]
  }
  await updateById('SessionSechage', 'id_session_sechage', params.id, upd)
  const s = await one<Row>('SELECT * FROM "SessionSechage" WHERE id_session_sechage = ?', [params.id])
  return { data: await enrichSessionSechage(s!) }
})

route('DELETE', '/sechage/:id', async ({ params }) => {
  await oneOr404('SELECT * FROM "SessionSechage" WHERE id_session_sechage = ?', [params.id], 'Session de séchage introuvable')
  await run('DELETE FROM "PlantSechage" WHERE id_session_sechage = ?', [params.id])
  await run('DELETE FROM "SessionSechage" WHERE id_session_sechage = ?', [params.id])
  return { data: { ok: true } }
})

// ── Séchage — plantes d'une session ───────────────────────────────────────────

route('POST', '/sechage/:id/plants', async ({ params, body }) => {
  const s = await oneOr404<Row>('SELECT * FROM "SessionSechage" WHERE id_session_sechage = ?',
    [params.id], 'Session de séchage introuvable')
  const p = body as Row
  await oneOr404('SELECT id_plant FROM "Plant" WHERE id_plant = ?', [p.id_plant], `Plant ${p.id_plant} introuvable`)
  const existing = await one<Row>(
    'SELECT id_session_sechage FROM "PlantSechage" WHERE id_plant = ? AND date_fin_sechage IS NULL', [p.id_plant])
  if (existing) {
    throw new LocalHttpError(400, `Plant ${p.id_plant} est déjà en séchage (session #${existing.id_session_sechage})`)
  }
  const id = await insert('PlantSechage', {
    id_plant: p.id_plant,
    id_session_sechage: Number(params.id),
    date_mise_sechage: p.date_mise_sechage ?? s.date_debut ?? null,
    poids_humide_g: p.poids_humide_g ?? null,
    poids_sec_g: p.poids_sec_g ?? null,
    notes: p.notes ?? null,
  })
  const dateRecolte = p.date_mise_sechage ?? s.date_debut
  await run('UPDATE "Plant" SET statut = ?, date_recolte = COALESCE(?, date_recolte) WHERE id_plant = ?',
    ['sechage', dateRecolte ?? null, p.id_plant])
  const ps = await one<Row>('SELECT * FROM "PlantSechage" WHERE id_plant_sechage = ?', [id])
  return { data: await enrichPlantSechage(ps!) }
})

route('PUT', '/sechage/:session_id/plants/:ps_id', async ({ params, body }) => {
  const ps = await oneOr404<Row>(
    'SELECT * FROM "PlantSechage" WHERE id_plant_sechage = ? AND id_session_sechage = ?',
    [params.ps_id, params.session_id], 'Entrée de séchage introuvable')
  const p = body as Row
  const upd: Row = {}
  for (const f of ['date_mise_sechage', 'date_fin_sechage', 'poids_humide_g', 'poids_sec_g', 'notes']) {
    if (f in p) upd[f] = p[f]
  }
  await updateById('PlantSechage', 'id_plant_sechage', params.ps_id, upd)
  if (p.date_fin_sechage) {
    await run('UPDATE "Plant" SET date_fin_sechage = ?, poids_recolte_g = COALESCE(?, poids_recolte_g) WHERE id_plant = ?',
      [p.date_fin_sechage, p.poids_sec_g ?? null, ps.id_plant])
  }
  const updated = await one<Row>('SELECT * FROM "PlantSechage" WHERE id_plant_sechage = ?', [params.ps_id])
  return { data: await enrichPlantSechage(updated!) }
})

route('DELETE', '/sechage/:session_id/plants/:ps_id', async ({ params }) => {
  await oneOr404('SELECT * FROM "PlantSechage" WHERE id_plant_sechage = ? AND id_session_sechage = ?',
    [params.ps_id, params.session_id], 'Entrée de séchage introuvable')
  // NB : le backend d'origine ne supprime pas la ligne (bug historique conservé côté serveur),
  // mais l'intention de la route est la suppression → on l'applique en local.
  await run('DELETE FROM "PlantSechage" WHERE id_plant_sechage = ?', [params.ps_id])
  return { data: { ok: true } }
})

// ═══ Curing — sessions ═════════════════════════════════════════════════════════

route('GET', '/curing', async ({ query: q }) => {
  const statut = q.get('statut')
  const sessions = statut
    ? await query<Row>('SELECT * FROM "SessionCuring" WHERE statut = ? ORDER BY date_debut DESC', [statut])
    : await query<Row>('SELECT * FROM "SessionCuring" ORDER BY date_debut DESC')
  const out: Row[] = []
  for (const s of sessions) out.push(await enrichSessionCuring(s))
  return { data: out }
})

route('GET', '/curing/:id', async ({ params }) => ({
  data: await enrichSessionCuring(await oneOr404('SELECT * FROM "SessionCuring" WHERE id_session_curing = ?',
    [params.id], 'Session de curing introuvable')),
}))

route('POST', '/curing', async ({ body }) => {
  const p = body as Row
  const id = await insert('SessionCuring', {
    nom: p.nom ?? null,
    type_contenant: p.type_contenant ?? null,
    volume_contenant_l: p.volume_contenant_l ?? null,
    boveda_rh: p.boveda_rh ?? null,
    id_espace: p.id_espace ?? null,
    id_materiel_bocal: p.id_materiel_bocal ?? null,
    date_debut: p.date_debut ?? null,
    notes: p.notes ?? null,
    statut: 'active',
    created_at: new Date().toISOString(),
  })
  const culturesAVerifier = new Set<number>()
  for (const pl of (p.plants as Row[] | undefined) ?? []) {
    const plant = await oneOr404<Row>('SELECT * FROM "Plant" WHERE id_plant = ?', [pl.id_plant], `Plant ${pl.id_plant} introuvable`)
    await insert('PlantCuring', {
      id_plant: pl.id_plant,
      id_session_curing: id,
      date_mise_curing: pl.date_mise_curing ?? p.date_debut ?? null,
      poids_debut_g: pl.poids_debut_g ?? null,
      poids_final_g: pl.poids_final_g ?? null,
      notes: pl.notes ?? null,
    })
    await run('UPDATE "Plant" SET statut = ? WHERE id_plant = ?', ['curing', pl.id_plant])
    if (plant.id_culture) culturesAVerifier.add(Number(plant.id_culture))
  }
  for (const idCulture of culturesAVerifier) await verifierCulture(idCulture)
  const s = await one<Row>('SELECT * FROM "SessionCuring" WHERE id_session_curing = ?', [id])
  return { data: await enrichSessionCuring(s!) }
})

route('PUT', '/curing/:id', async ({ params, body }) => {
  await oneOr404('SELECT * FROM "SessionCuring" WHERE id_session_curing = ?', [params.id], 'Session de curing introuvable')
  const p = body as Row
  const upd: Row = {}
  for (const f of ['nom', 'type_contenant', 'volume_contenant_l', 'boveda_rh', 'id_espace', 'id_materiel_bocal',
                   'statut', 'date_debut', 'date_fin', 'notes']) {
    if (f in p) upd[f] = p[f]
  }
  await updateById('SessionCuring', 'id_session_curing', params.id, upd)
  const s = await one<Row>('SELECT * FROM "SessionCuring" WHERE id_session_curing = ?', [params.id])
  return { data: await enrichSessionCuring(s!) }
})

route('DELETE', '/curing/:id', async ({ params }) => {
  await oneOr404('SELECT * FROM "SessionCuring" WHERE id_session_curing = ?', [params.id], 'Session de curing introuvable')
  await run('DELETE FROM "PlantCuring" WHERE id_session_curing = ?', [params.id])
  await run('DELETE FROM "SessionCuring" WHERE id_session_curing = ?', [params.id])
  return { data: { ok: true } }
})

// ── Curing — plantes d'une session ────────────────────────────────────────────

route('POST', '/curing/:id/plants', async ({ params, body }) => {
  const s = await oneOr404<Row>('SELECT * FROM "SessionCuring" WHERE id_session_curing = ?',
    [params.id], 'Session de curing introuvable')
  const p = body as Row
  const plant = await oneOr404<Row>('SELECT * FROM "Plant" WHERE id_plant = ?', [p.id_plant], `Plant ${p.id_plant} introuvable`)
  const existing = await one<Row>(
    'SELECT id_session_curing FROM "PlantCuring" WHERE id_plant = ? AND date_fin_curing IS NULL', [p.id_plant])
  if (existing) {
    throw new LocalHttpError(400, `Plant ${p.id_plant} est déjà en curing (session #${existing.id_session_curing})`)
  }
  const id = await insert('PlantCuring', {
    id_plant: p.id_plant,
    id_session_curing: Number(params.id),
    date_mise_curing: p.date_mise_curing ?? s.date_debut ?? null,
    poids_debut_g: p.poids_debut_g ?? null,
    poids_final_g: p.poids_final_g ?? null,
    notes: p.notes ?? null,
  })
  await run('UPDATE "Plant" SET statut = ? WHERE id_plant = ?', ['curing', p.id_plant])
  await verifierCulture(plant.id_culture)
  const pc = await one<Row>('SELECT * FROM "PlantCuring" WHERE id_plant_curing = ?', [id])
  return { data: await enrichPlantCuring(pc!) }
})

route('PUT', '/curing/:session_id/plants/:pc_id', async ({ params, body }) => {
  const pc = await oneOr404<Row>(
    'SELECT * FROM "PlantCuring" WHERE id_plant_curing = ? AND id_session_curing = ?',
    [params.pc_id, params.session_id], 'Entrée de curing introuvable')
  const p = body as Row
  const upd: Row = {}
  for (const f of ['date_mise_curing', 'date_fin_curing', 'poids_debut_g', 'poids_final_g', 'notes']) {
    if (f in p) upd[f] = p[f]
  }
  await updateById('PlantCuring', 'id_plant_curing', params.pc_id, upd)
  if (p.date_fin_curing) {
    await run('UPDATE "Plant" SET statut = ?, poids_recolte_g = COALESCE(?, poids_recolte_g) WHERE id_plant = ?',
      ['prete', p.poids_final_g ?? null, pc.id_plant])
  }
  const updated = await one<Row>('SELECT * FROM "PlantCuring" WHERE id_plant_curing = ?', [params.pc_id])
  return { data: await enrichPlantCuring(updated!) }
})

route('DELETE', '/curing/:session_id/plants/:pc_id', async ({ params }) => {
  await oneOr404('SELECT * FROM "PlantCuring" WHERE id_plant_curing = ? AND id_session_curing = ?',
    [params.pc_id, params.session_id], 'Entrée de curing introuvable')
  await run('DELETE FROM "PlantCuring" WHERE id_plant_curing = ?', [params.pc_id])
  return { data: { ok: true } }
})

// ═══ Routes cultures liées (sechage/plants, eligible, picker, stock-info) ═══════

route('GET', '/cultures/sechage/plants', async () => {
  const today = todayISO()
  const plants = await query<Row>(
    `SELECT * FROM "Plant" WHERE statut IN ('sechage','curing') ORDER BY date_recolte ASC`)
  const result: Row[] = []
  for (const plant of plants) {
    const culture = await one<Row>('SELECT * FROM "Culture" WHERE id_culture = ?', [plant.id_culture])
    let nomEspace: unknown = null, idEspace: unknown = null
    if (culture?.id_espace) {
      idEspace = culture.id_espace
      const esp = await one<Row>('SELECT nom FROM "EspaceCulture" WHERE id_espace = ?', [culture.id_espace])
      nomEspace = esp?.nom ?? null
    }
    let nomVariete: unknown = null, nomBreeder: unknown = null
    if (plant.id_graine) {
      const g = await one<Row>(
        `SELECT v.nom_variete, b.nom_breeder FROM "Graine" g
         LEFT JOIN "Variete" v ON v.id_variete = g.id_variete
         LEFT JOIN "Breeder" b ON b.id_breeder = g.id_breeder
         WHERE g.id_graine = ?`, [plant.id_graine])
      nomVariete = g?.nom_variete ?? null
      nomBreeder = g?.nom_breeder ?? null
    }
    let dureeSechageJ: number | null = null
    if (plant.date_recolte) {
      const end = plant.date_fin_sechage ? String(plant.date_fin_sechage).slice(0, 10) : today
      dureeSechageJ = daysBetween(String(plant.date_recolte).slice(0, 10), end)
    }
    // Session séchage assignée
    let psInfo: Row = {}
    const ps = await one<Row>(
      'SELECT * FROM "PlantSechage" WHERE id_plant = ? ORDER BY id_plant_sechage DESC LIMIT 1', [plant.id_plant])
    if (ps) {
      psInfo = {
        id_plant_sechage: ps.id_plant_sechage,
        id_session_sechage: ps.id_session_sechage,
        poids_humide_g: num(ps.poids_humide_g),
      }
      const ss = await one<Row>('SELECT * FROM "SessionSechage" WHERE id_session_sechage = ?', [ps.id_session_sechage])
      if (ss) {
        psInfo.methode_sechage = ss.methode_sechage
        if (ss.id_espace) {
          psInfo.id_espace_sechage = ss.id_espace
          const espS = await one<Row>('SELECT nom FROM "EspaceCulture" WHERE id_espace = ?', [ss.id_espace])
          psInfo.nom_espace_sechage = espS?.nom ?? null
        }
      }
    }
    // Session curing assignée
    let pcInfo: Row = {}
    const pc = await one<Row>(
      'SELECT * FROM "PlantCuring" WHERE id_plant = ? ORDER BY id_plant_curing DESC LIMIT 1', [plant.id_plant])
    if (pc) {
      pcInfo = { id_plant_curing: pc.id_plant_curing, id_session_curing: pc.id_session_curing }
      const sc = await one<Row>('SELECT * FROM "SessionCuring" WHERE id_session_curing = ?', [pc.id_session_curing])
      if (sc) {
        pcInfo.type_contenant = sc.type_contenant
        pcInfo.volume_contenant_l = num(sc.volume_contenant_l)
        pcInfo.boveda_rh = sc.boveda_rh
        if (sc.id_espace) {
          pcInfo.id_espace_curing = sc.id_espace
          const espC = await one<Row>('SELECT nom FROM "EspaceCulture" WHERE id_espace = ?', [sc.id_espace])
          pcInfo.nom_espace_curing = espC?.nom ?? null
        }
        if (sc.id_materiel_bocal) {
          pcInfo.id_materiel_bocal = sc.id_materiel_bocal
          const mat = await one<Row>('SELECT nom FROM "Materiel" WHERE id_materiel = ?', [sc.id_materiel_bocal])
          pcInfo.nom_materiel_bocal = mat?.nom ?? null
        }
      }
    }
    // Dernière ouverture bocal
    let derniereOuverture: string | null = null
    if (plant.statut === 'curing') {
      const lastOuv = await one<Row>(
        `SELECT date_action FROM "ActionCalendrier"
         WHERE id_plant = ? AND type_action = 'ouverture_bocal' ORDER BY date_action DESC LIMIT 1`, [plant.id_plant])
      if (lastOuv) derniereOuverture = String(lastOuv.date_action)
    }

    result.push({
      id_plant: plant.id_plant,
      id_culture: plant.id_culture,
      nom_affichage: plant.nom_affichage,
      statut: plant.statut,
      date_recolte: plant.date_recolte ? String(plant.date_recolte) : null,
      date_fin_sechage: plant.date_fin_sechage ? String(plant.date_fin_sechage) : null,
      poids_recolte_g: num(plant.poids_recolte_g),
      nom_variete: nomVariete,
      nom_breeder: nomBreeder,
      nom_culture: culture?.nom ?? null,
      nom_espace: nomEspace,
      id_espace: idEspace,
      duree_sechage_j: dureeSechageJ,
      id_plant_sechage: null, id_session_sechage: null, id_espace_sechage: null,
      nom_espace_sechage: null, methode_sechage: null, poids_humide_g: null,
      id_plant_curing: null, id_session_curing: null, type_contenant: null,
      volume_contenant_l: null, boveda_rh: null, id_espace_curing: null,
      nom_espace_curing: null, id_materiel_bocal: null, nom_materiel_bocal: null,
      derniere_ouverture_bocal: derniereOuverture,
      ...psInfo,
      ...pcInfo,
    })
  }
  return { data: result }
})

async function eligibleList(statuts: string[], excludeTable: string, excludeDateCol: string): Promise<Row[]> {
  const plants = await query<Row>(
    `SELECT * FROM "Plant" WHERE statut IN (${statuts.map(() => '?').join(',')})
     AND id_plant NOT IN (SELECT id_plant FROM "${excludeTable}" WHERE ${excludeDateCol} IS NULL)
     ORDER BY id_plant ASC`, statuts)
  const result: Row[] = []
  for (const plant of plants) {
    const culture = await one<Row>('SELECT nom FROM "Culture" WHERE id_culture = ?', [plant.id_culture])
    let nomVariete: unknown = null
    if (plant.id_graine) {
      const g = await one<Row>(
        `SELECT v.nom_variete FROM "Graine" g LEFT JOIN "Variete" v ON v.id_variete = g.id_variete
         WHERE g.id_graine = ?`, [plant.id_graine])
      nomVariete = g?.nom_variete ?? null
    }
    result.push({
      id_plant: plant.id_plant,
      nom_affichage: plant.nom_affichage,
      statut: plant.statut,
      id_culture: plant.id_culture,
      nom_culture: culture?.nom ?? null,
      nom_variete: nomVariete,
      poids_recolte_g: num(plant.poids_recolte_g),
      date_recolte: plant.date_recolte ? String(plant.date_recolte) : null,
    })
  }
  return result
}

route('GET', '/cultures/sechage/eligible', async () => ({
  data: await eligibleList(['floraison', 'recolte'], 'PlantSechage', 'date_fin_sechage'),
}))

route('GET', '/cultures/curing/eligible', async () => ({
  data: await eligibleList(['sechage'], 'PlantCuring', 'date_fin_curing'),
}))

route('GET', '/cultures/plants-by-variete/:id_variete', async ({ params }) => {
  const plants = await query<Row>(
    `SELECT p.* FROM "Plant" p JOIN "Graine" g ON g.id_graine = p.id_graine
     WHERE g.id_variete = ? ORDER BY p.id_plant ASC`, [params.id_variete])
  const result: Row[] = []
  for (const plant of plants) {
    const culture = await one<Row>('SELECT nom FROM "Culture" WHERE id_culture = ?', [plant.id_culture])
    result.push({
      id_plant: plant.id_plant,
      nom_affichage: plant.nom_affichage,
      statut: plant.statut,
      id_culture: plant.id_culture,
      nom_culture: culture?.nom ?? null,
    })
  }
  return { data: result }
})

route('GET', '/cultures/plant/:id_plant/stock-info', async ({ params }) => {
  const plant = await oneOr404<Row>('SELECT * FROM "Plant" WHERE id_plant = ?', [params.id_plant], 'Plante introuvable')
  const culture = await one<Row>('SELECT * FROM "Culture" WHERE id_culture = ?', [plant.id_culture])

  const sousTypeStock = culture ? String(culture.type_culture ?? '').toLowerCase() || null : null

  let lampeType: unknown = null
  if (culture) {
    const lampeAction = await one<Row>(
      `SELECT parametres FROM "ActionCalendrier"
       WHERE id_culture = ? AND type_action IN ('mise_sous_led','mise_sous_neons')
       ORDER BY date_action DESC LIMIT 1`, [culture.id_culture])
    if (lampeAction) {
      jsonify(lampeAction, ['parametres'])
      lampeType = (lampeAction.parametres as Row | null)?.nom_lampe ?? null
    }
  }

  let substratType: string | null = null
  if (plant.substrat === 'sol_vivant' && plant.id_recette_sol) {
    const rec = await one<Row>('SELECT nom_recette FROM "RecetteLSO" WHERE id_recette_lso = ?', [plant.id_recette_sol])
    substratType = rec ? `Sol Vivant — ${rec.nom_recette}` : 'Sol Vivant'
  } else if (plant.substrat) {
    const s = String(plant.substrat).replace(/_/g, ' ')
    substratType = s.charAt(0).toUpperCase() + s.slice(1)
  }

  let engraisType: string | null = null
  if (culture) {
    const arrosages = await query<Row>(
      `SELECT parametres FROM "ActionCalendrier"
       WHERE id_culture = ? AND type_action = 'arrosage_engrais'
       AND (id_plant = ? OR id_plant IS NULL OR global_culture = 1)`,
      [culture.id_culture, plant.id_plant])
    const recetteIds = new Set<number>()
    for (const act of arrosages) {
      jsonify(act, ['parametres'])
      const idR = (act.parametres as Row | null)?.id_recette
      if (idR) recetteIds.add(Number(idR))
    }
    if (recetteIds.size) {
      const marks = `(${[...recetteIds].map(() => '?').join(',')})`
      const produits = await query<Row>(
        `SELECT DISTINCT pe.marque FROM "RecetteEngraisLigne" rel
         JOIN "ProduitEngrais" pe ON pe.id_produit = rel.id_produit
         WHERE rel.id_recette IN ${marks} AND pe.marque IS NOT NULL`, [...recetteIds])
      const marques = produits.map(r => String(r.marque)).sort()
      engraisType = marques.length ? marques.join(', ') : null
    }
  }

  return {
    data: {
      sous_type_stock: sousTypeStock,
      lampe_type: lampeType,
      substrat_type: substratType,
      engrais_type: engraisType,
    },
  }
})

// ═══ Bocal timeline (materiel.py) ══════════════════════════════════════════════

route('GET', '/materiel/:id/bocal-timeline', async ({ params }) => {
  const bocal = await oneOr404<Row>('SELECT * FROM "Materiel" WHERE id_materiel = ?', [params.id], 'Matériel introuvable')
  jsonify(bocal, ['caracteristiques'])

  const sessions = await query<Row>(
    'SELECT * FROM "SessionCuring" WHERE id_materiel_bocal = ? ORDER BY date_debut DESC', [params.id])
  const sessionsOut: Row[] = []
  for (const sc of sessions) {
    const pcs = await query<Row>('SELECT * FROM "PlantCuring" WHERE id_session_curing = ?', [sc.id_session_curing])
    const plantsOut: Row[] = []
    for (const pcRow of pcs) {
      const plant = await one<Row>('SELECT * FROM "Plant" WHERE id_plant = ?', [pcRow.id_plant])
      if (!plant) continue

      let graineOut: Row | null = null
      if (plant.id_graine) {
        const g = await one<Row>('SELECT * FROM "Graine" WHERE id_graine = ?', [plant.id_graine])
        if (g) {
          const v = g.id_variete
            ? await one<Row>('SELECT id_variete, nom_variete FROM "Variete" WHERE id_variete = ?', [g.id_variete]) : null
          const b = g.id_breeder
            ? await one<Row>('SELECT id_breeder, nom_breeder FROM "Breeder" WHERE id_breeder = ?', [g.id_breeder]) : null
          graineOut = { id_graine: g.id_graine, types_graines: g.types_graines, variete: v, breeder: b }
        }
      }

      let cultureOut: Row | null = null
      if (plant.id_culture) {
        const c = await one<Row>('SELECT * FROM "Culture" WHERE id_culture = ?', [plant.id_culture])
        if (c) {
          cultureOut = {
            id_culture: c.id_culture, nom: c.nom, date_debut: c.date_debut,
            date_passage_12_12: c.date_passage_12_12, date_debut_floraison: c.date_debut_floraison,
            date_recolte_estimee: c.date_recolte_estimee,
          }
        }
      }

      let sechageOut: Row | null = null
      const ps = await one<Row>(
        'SELECT * FROM "PlantSechage" WHERE id_plant = ? ORDER BY date_mise_sechage DESC LIMIT 1', [plant.id_plant])
      if (ps) {
        const ss = await one<Row>('SELECT * FROM "SessionSechage" WHERE id_session_sechage = ?', [ps.id_session_sechage])
        if (ss) {
          sechageOut = {
            id_session_sechage: ss.id_session_sechage,
            nom: ss.nom,
            date_debut: ss.date_debut,
            date_fin: ss.date_fin ?? sc.date_debut ?? null,
          }
        }
      }

      plantsOut.push({
        id_plant: plant.id_plant,
        nom_affichage: plant.nom_affichage,
        date_recolte: plant.date_recolte,
        poids_recolte_g: num(plant.poids_recolte_g),
        poids_debut_curing_g: num(pcRow.poids_debut_g),
        poids_final_curing_g: num(pcRow.poids_final_g),
        graine: graineOut,
        culture: cultureOut,
        sechage: sechageOut,
      })
    }
    sessionsOut.push({
      id_session_curing: sc.id_session_curing,
      nom: sc.nom,
      date_debut: sc.date_debut,
      date_fin: sc.date_fin,
      statut: sc.statut,
      plants: plantsOut,
    })
  }

  const stocks = await query<Row>(
    'SELECT * FROM "Stock" WHERE id_materiel_bocal = ? ORDER BY date_stock DESC', [params.id])
  const stocksOut: Row[] = []
  for (const s of stocks) {
    const v = s.id_variete
      ? await one<Row>('SELECT id_variete, nom_variete FROM "Variete" WHERE id_variete = ?', [s.id_variete]) : null
    stocksOut.push({
      id_stock: s.id_stock,
      type_stock: s.type_stock,
      sous_type_stock: s.sous_type_stock,
      quantite_stock: num(s.quantite_stock),
      date_stock: s.date_stock,
      date_fin_stock: s.date_fin_stock,
      variete: v,
    })
  }

  return { data: { bocal, sessions_curing: sessionsOut, stocks: stocksOut } }
})

