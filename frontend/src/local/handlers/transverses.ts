// ─── Handlers locaux : Calendrier global, Recherche, Comparaison, Historique ──
// Miroir de backend/app/routers/{calendrier,search,historique_culture}.py + cultures.py /compare
import { route, LocalHttpError } from '../router'
import { query, one, oneOr404, insert, updateById, run, jsonify, boolify } from '../helpers'
import { Row, todayISO, daysBetween, computeCultureCost, toSmallUnit, prixParPetiteUnite } from './cultures-helpers'

const num = (v: unknown): number | null => (v === null || v === undefined ? null : Number(v))
const asDate = (v: unknown): string | null => (typeof v === 'string' && v ? v.slice(0, 10) : null)

// ═══ Calendrier global ═════════════════════════════════════════════════════════

async function enrichCalendrierActions(actions: Row[]): Promise<Row[]> {
  const cultureIds = [...new Set(actions.map(a => Number(a.id_culture)))]
  const plantIds = [...new Set(actions.filter(a => a.id_plant).map(a => Number(a.id_plant)))]

  const culturesMap = new Map<number, Row>()
  if (cultureIds.length) {
    const cultures = await query<Row>(
      `SELECT * FROM "Culture" WHERE id_culture IN (${cultureIds.map(() => '?').join(',')})`, cultureIds)
    for (const c of cultures) culturesMap.set(Number(c.id_culture), c)
  }
  const plantsMap = new Map<number, Row>()
  if (plantIds.length) {
    const plants = await query<Row>(
      `SELECT * FROM "Plant" WHERE id_plant IN (${plantIds.map(() => '?').join(',')})`, plantIds)
    for (const p of plants) plantsMap.set(Number(p.id_plant), p)
  }

  return actions.map(a => {
    jsonify(a, ['parametres'])
    boolify(a, ['global_culture'])
    const culture = culturesMap.get(Number(a.id_culture))
    const plant = a.id_plant ? plantsMap.get(Number(a.id_plant)) : undefined
    return {
      id_action: a.id_action,
      date_action: asDate(a.date_action),
      type_action: a.type_action,
      global_culture: a.global_culture,
      parametres: a.parametres,
      note: a.note,
      id_culture: a.id_culture,
      culture_nom: culture?.nom ?? `Culture #${a.id_culture}`,
      culture_statut: culture?.statut ?? null,
      id_plant: a.id_plant,
      plant_nom: plant?.nom_affichage ?? null,
    }
  })
}

// Routes fixes avant '/calendrier' paramétré (aucun :id ici, ordre sans enjeu)
route('GET', '/calendrier/cultures-actives', async () => {
  const cultures = await query<Row>('SELECT * FROM "Culture" ORDER BY date_debut DESC')
  return {
    data: cultures.map(c => ({
      id_culture: c.id_culture,
      nom: c.nom ?? `Culture #${c.id_culture}`,
      statut: c.statut,
      date_debut: asDate(c.date_debut),
      date_fin: asDate(c.date_fin),
    })),
  }
})

route('GET', '/calendrier/export', async ({ query: q }) => {
  const debut = q.get('date_debut')
  const fin = q.get('date_fin')
  if (!debut || !fin) throw new LocalHttpError(422, 'date_debut et date_fin requis (YYYY-MM-DD)')
  const idCulture = q.get('id_culture')
  let sql = 'SELECT * FROM "ActionCalendrier" WHERE date_action >= ? AND date_action <= ?'
  const vals: unknown[] = [debut, fin]
  if (idCulture !== null) { sql += ' AND id_culture = ?'; vals.push(Number(idCulture)) }
  sql += ' ORDER BY date_action'
  const actions = await query<Row>(sql, vals)
  return { data: await enrichCalendrierActions(actions) }
})

route('GET', '/calendrier', async ({ query: q }) => {
  const year = Number(q.get('year'))
  const month = Number(q.get('month'))
  if (!year || !month) throw new LocalHttpError(422, 'year et month requis')
  const prefix = `${year}-${String(month).padStart(2, '0')}`
  const actions = await query<Row>(
    'SELECT * FROM "ActionCalendrier" WHERE date_action LIKE ? ORDER BY date_action', [`${prefix}%`])
  return { data: await enrichCalendrierActions(actions) }
})

// ═══ Recherche globale ═════════════════════════════════════════════════════════

route('GET', '/search', async ({ query: q }) => {
  const term = q.get('q')
  if (!term) throw new LocalHttpError(422, 'q requis')
  const like = `%${term}%`

  const cultures = await query<Row>(
    `SELECT * FROM "Culture" WHERE nom LIKE ? COLLATE NOCASE LIMIT 8`, [like])
  const plants = await query<Row>(
    `SELECT * FROM "Plant" WHERE nom_affichage LIKE ? COLLATE NOCASE LIMIT 8`, [like])
  const varietes = await query<Row>(
    `SELECT * FROM "Variete" WHERE nom_variete LIKE ? COLLATE NOCASE LIMIT 8`, [like])
  const breeders = await query<Row>(
    `SELECT * FROM "Breeder" WHERE nom_breeder LIKE ? COLLATE NOCASE LIMIT 5`, [like])
  const stocks = await query<Row>(
    `SELECT s.*, v.nom_variete FROM "Stock" s
     LEFT JOIN "Variete" v ON v.id_variete = s.id_variete
     WHERE v.nom_variete LIKE ? COLLATE NOCASE AND s.date_fin_stock IS NULL LIMIT 8`, [like])

  return {
    data: {
      cultures: cultures.map(c => ({
        id: c.id_culture, label: c.nom ?? `Culture #${c.id_culture}`, sub: c.statut ?? '', url: '/culture',
      })),
      plantes: plants.map(p => ({
        id: p.id_plant, label: p.nom_affichage, sub: p.statut ?? '', url: '/culture',
      })),
      varietes: varietes.map(v => ({
        id: v.id_variete, label: v.nom_variete, sub: v.croisement_variete ?? '', url: '/graines',
      })),
      breeders: breeders.map(b => ({
        id: b.id_breeder, label: b.nom_breeder, sub: 'Breeder', url: '/graines',
      })),
      stock: stocks.map(s => ({
        id: s.id_stock,
        label: s.nom_variete ?? `Stock #${s.id_stock}`,
        sub: s.quantite_stock ? `${s.type_stock} · ${Math.round(Number(s.quantite_stock))}g` : (s.type_stock ?? ''),
        url: '/stock',
      })),
    },
  }
})

// ═══ Comparaison inter-cultures (GET /cultures/compare) ════════════════════════

route('GET', '/cultures/compare', async ({ query: q }) => {
  const idsRaw = q.get('ids') ?? ''
  const idList = idsRaw.split(',').map(s => s.trim()).filter(Boolean).map(Number)
  if (idList.some(isNaN)) throw new LocalHttpError(400, "ids doit être une liste d'entiers séparés par des virgules")
  if (idList.length < 2 || idList.length > 3) throw new LocalHttpError(400, 'Sélectionnez entre 2 et 3 cultures')

  const today = todayISO()
  const results: Row[] = []

  for (const cid of idList) {
    const culture = await one<Row>('SELECT * FROM "Culture" WHERE id_culture = ?', [cid])
    if (!culture) throw new LocalHttpError(404, `Culture ${cid} introuvable`)
    const plants = await query<Row>('SELECT * FROM "Plant" WHERE id_culture = ?', [cid])

    // Durées
    const dateDebut = asDate(culture.date_debut)
    const dateFin = asDate(culture.date_fin) ?? today
    const dateFlo = asDate(culture.date_debut_floraison) ?? asDate(culture.date_passage_12_12)
    const dureeTotale = dateDebut ? daysBetween(dateDebut, dateFin) : null
    const dureeVeg = dateDebut && dateFlo ? daysBetween(dateDebut, dateFlo) : null
    const dureeFlo = dateFlo ? daysBetween(dateFlo, dateFin) : null

    // Rendement
    const STATUTS_RECOLTE = ['recolte', 'prete', 'curing', 'wpff', 'sechage']
    const recoltees = plants.filter(p => STATUTS_RECOLTE.includes(String(p.statut)) && p.poids_recolte_g)
    const rendementTotal = recoltees.length
      ? recoltees.reduce((s, p) => s + Number(p.poids_recolte_g), 0) : null

    // Coûts
    const couts = await computeCultureCost(cid)

    // Espace
    let nomEspace: unknown = null
    if (culture.id_espace) {
      const esp = await one<Row>('SELECT nom FROM "EspaceCulture" WHERE id_espace = ?', [culture.id_espace])
      nomEspace = esp?.nom ?? null
    }

    // Lampes
    const lampesInfo: Row[] = []
    let puissanceWTotal = 0
    if (culture.id_espace) {
      const mats = await query<Row>(
        `SELECT m.* FROM "Materiel" m
         JOIN "EspaceMateriel" em ON em.id_materiel = m.id_materiel
         WHERE em.id_espace = ? AND m.categorie = 'Lampes'`, [culture.id_espace])
      for (const m of mats) {
        jsonify(m, ['caracteristiques'])
        const pw = Number(((m.caracteristiques as Row | null) ?? {}).puissance_w) || null
        if (pw) puissanceWTotal += pw
        lampesInfo.push({ nom: m.nom, marque: m.marque, puissance_w: pw })
      }
    }
    if (!lampesInfo.length) {
      const legacy = await query<Row>(
        `SELECT l.puissance_lampe FROM "Lampe" l
         JOIN "CultureLampe" cl ON cl.id_lampe = l.id_lampe WHERE cl.id_culture = ?`, [cid])
      for (const l of legacy) {
        const pw = Number(l.puissance_lampe ?? 0)
        puissanceWTotal += pw
        lampesInfo.push({ nom: `Lampe ${pw}W`, marque: null, puissance_w: pw })
      }
    }

    // Actions
    const actions = await query<Row>(
      'SELECT * FROM "ActionCalendrier" WHERE id_culture = ? ORDER BY date_action', [cid])
    actions.forEach(a => { jsonify(a, ['parametres']); boolify(a, ['global_culture']) })
    const plantsMap = new Map(plants.map(p => [Number(p.id_plant), String(p.nom_affichage)]))

    // LSO vs conventionnel
    let isLso = plants.some(p => p.substrat === 'sol_vivant' || p.id_recette_sol)
    if (!isLso) isLso = actions.some(a => a.type_action === 'preparation_tco')

    let tcoParType: Record<string, number> = {}
    let marquesEngrais: string[] = []
    if (isLso) {
      for (const a of actions) {
        if (a.type_action !== 'preparation_tco') continue
        const params = (a.parametres as Row | null) ?? {}
        let typeTco = 'Autre'
        if (params.id_recette_tco) {
          const rec = await one<Row>('SELECT type_tco FROM "RecetteTCO" WHERE id_recette_tco = ?', [params.id_recette_tco])
          if (rec?.type_tco) typeTco = String(rec.type_tco)
        }
        tcoParType[typeTco] = (tcoParType[typeTco] ?? 0) + 1
      }
    } else {
      const marquesSet = new Set<string>()
      for (const a of actions) {
        if (a.type_action !== 'arrosage_engrais') continue
        const params = (a.parametres as Row | null) ?? {}
        if (params.id_recette) {
          const produits = await query<Row>(
            `SELECT DISTINCT pe.marque FROM "RecetteEngraisLigne" rel
             JOIN "ProduitEngrais" pe ON pe.id_produit = rel.id_produit
             WHERE rel.id_recette = ? AND pe.marque IS NOT NULL`, [params.id_recette])
          for (const p2 of produits) marquesSet.add(String(p2.marque))
        }
        for (const item of (params.produits as Row[] | undefined) ?? []) {
          if (item.id_produit) {
            const prod = await one<Row>('SELECT marque FROM "ProduitEngrais" WHERE id_produit = ?', [item.id_produit])
            if (prod?.marque) marquesSet.add(String(prod.marque))
          }
        }
      }
      marquesEngrais = [...marquesSet].sort()
    }

    // Détail coût engrais par recette
    const recettesCout = new Map<string, { volume_l: number; cout: number; nb_actions: number }>()
    for (const a of actions) {
      if (a.type_action !== 'arrosage_engrais') continue
      const p2 = (a.parametres as Row | null) ?? {}
      const idR = p2.id_recette
      if (!idR) continue
      const vol2 = !a.global_culture && p2.volume_par_plante_l
        ? Number(p2.volume_par_plante_l) : Number(p2.volume_l ?? 0)
      if (!vol2) continue
      const rec2 = await one<Row>('SELECT * FROM "RecetteEngrais" WHERE id_recette = ?', [idR])
      if (!rec2) continue
      const nomRec = String(rec2.nom_recette ?? `Recette #${idR}`)
      let coutAction = 0
      const lignes = await query<Row>('SELECT * FROM "RecetteEngraisLigne" WHERE id_recette = ?', [idR])
      for (const ligne of lignes) {
        const prod = await one<Row>('SELECT * FROM "ProduitEngrais" WHERE id_produit = ?', [ligne.id_produit])
        const prix = prixParPetiteUnite(prod)
        if (prix === null) continue
        coutAction += toSmallUnit(Number(ligne.dosage) * vol2, ligne.unite as string | null) * prix
      }
      const entry = recettesCout.get(nomRec) ?? { volume_l: 0, cout: 0, nb_actions: 0 }
      entry.volume_l += vol2
      entry.cout += coutAction
      entry.nb_actions += 1
      recettesCout.set(nomRec, entry)
    }
    const detailsCoutEngrais = [...recettesCout.entries()]
      .sort((a, b) => b[1].cout - a[1].cout)
      .map(([k, v]) => ({
        nom_recette: k,
        volume_l: Math.round(v.volume_l * 100) / 100,
        cout: Math.round(v.cout * 100) / 100,
        cout_par_litre: v.volume_l > 0 ? Math.round((v.cout / v.volume_l) * 10000) / 10000 : null,
        nb_actions: v.nb_actions,
      }))

    // Hauteurs + arrosages
    const hauteurs: Row[] = []
    const arrosagePoints: { jour_offset: number; volume_ml: number; is_engrais: boolean }[] = []
    for (const a of actions) {
      if (!dateDebut) continue
      const params = (a.parametres as Row | null) ?? {}
      const offset = daysBetween(dateDebut, asDate(a.date_action)!)
      if (a.type_action === 'hauteur_plante') {
        if (params.hauteur_cm !== null && params.hauteur_cm !== undefined) {
          const nom = a.id_plant ? (plantsMap.get(Number(a.id_plant)) ?? 'Global') : 'Global'
          hauteurs.push({ jour_offset: offset, hauteur_cm: Number(params.hauteur_cm), plante: nom })
        }
      } else if (['arrosage_eau', 'arrosage_engrais', 'arrosage_tco'].includes(String(a.type_action))) {
        const vol = !a.global_culture && params.volume_par_plante_l ? params.volume_par_plante_l : params.volume_l
        if (vol !== null && vol !== undefined) {
          arrosagePoints.push({
            jour_offset: offset,
            volume_ml: Math.round(Number(vol) * 1000),
            is_engrais: a.type_action === 'arrosage_engrais',
          })
        }
      }
    }
    let cumul = 0
    let volumeEngraisMl = 0
    const arrosagesCumules: Row[] = []
    for (const pt of arrosagePoints.sort((a, b) => a.jour_offset - b.jour_offset)) {
      cumul += pt.volume_ml
      if (pt.is_engrais) volumeEngraisMl += pt.volume_ml
      arrosagesCumules.push({ jour_offset: pt.jour_offset, volume_cumul_ml: cumul })
    }

    // Variétés
    const varietes: string[] = []
    for (const p of plants) {
      if (!p.id_graine) continue
      const g = await one<Row>(
        `SELECT v.nom_variete FROM "Graine" g JOIN "Variete" v ON v.id_variete = g.id_variete
         WHERE g.id_graine = ?`, [p.id_graine])
      if (g?.nom_variete && !varietes.includes(String(g.nom_variete))) varietes.push(String(g.nom_variete))
    }

    results.push({
      id_culture: cid,
      nom: culture.nom ?? `Culture #${cid}`,
      statut: culture.statut,
      date_debut: dateDebut,
      date_fin: asDate(culture.date_fin),
      type_culture: culture.type_culture,
      type_eclairage: culture.type_eclairage,
      nom_espace: nomEspace,
      lampes: lampesInfo,
      puissance_w_total: puissanceWTotal || null,
      is_lso: isLso,
      tco_par_type: tcoParType,
      nb_tco_total: Object.values(tcoParType).reduce((a, b) => a + b, 0),
      marques_engrais: marquesEngrais,
      nb_plantes: plants.length,
      nb_plantes_recoltees: recoltees.length,
      varietes,
      duree_totale_j: dureeTotale,
      duree_veg_j: dureeVeg,
      duree_flo_j: dureeFlo,
      rendement_total_g: rendementTotal !== null ? Math.round(rendementTotal * 10) / 10 : null,
      rendement_par_plante_g: rendementTotal && recoltees.length
        ? Math.round((rendementTotal / recoltees.length) * 10) / 10 : null,
      cout_total: couts.cout_total,
      cout_par_gramme: couts.cout_par_gramme,
      cout_engrais: couts.cout_engrais,
      cout_electricite: couts.cout_electricite,
      cout_graines: couts.cout_graines,
      volume_arrosage_total_l: cumul ? Math.round(cumul / 100) / 10 : null,
      volume_arrosage_engrais_l: volumeEngraisMl ? Math.round(volumeEngraisMl / 100) / 10 : null,
      hauteurs,
      details_cout_engrais: detailsCoutEngrais,
      arrosages_cumules: arrosagesCumules,
    })
  }
  return { data: results }
})

// ═══ Historique cultures ═══════════════════════════════════════════════════════

async function enrichHistorique(row: Row): Promise<Row> {
  const plants = await query<Row>(
    'SELECT * FROM "HistoriquePlant" WHERE id_historique_culture = ?', [row.id_historique_culture])

  const recoltes = plants.filter(p => p.quantite_recoltee !== null && p.quantite_recoltee !== undefined)
    .map(p => Number(p.quantite_recoltee))
  const prix = plants.filter(p => p.prix_graine !== null && p.prix_graine !== undefined)
    .map(p => Number(p.prix_graine))

  const quantiteTotale = recoltes.length ? Math.round(recoltes.reduce((a, b) => a + b, 0) * 100) / 100 : null
  const dDebut = asDate(row.date_debut)
  const dFin = asDate(row.date_fin)

  const noms = [...new Set(plants.filter(p => p.variete_nom).map(p => String(p.variete_nom)))]

  return {
    ...row,
    cout_engrais: num(row.cout_engrais),
    cout_electricite: num(row.cout_electricite),
    cout_graines: num(row.cout_graines),
    cout_total: num(row.cout_total),
    cout_par_gramme: num(row.cout_par_gramme),
    duree_jours: dDebut && dFin ? Math.max(daysBetween(dDebut, dFin), 0) : null,
    nb_plants: plants.length,
    quantite_totale: quantiteTotale,
    prix_total_graines: prix.length ? Math.round(prix.reduce((a, b) => a + b, 0) * 100) / 100 : null,
    g_par_watt: quantiteTotale && row.puissance && Number(row.puissance) > 0
      ? Math.round((quantiteTotale / Number(row.puissance)) * 1000) / 1000 : null,
    varietes_label: noms.length ? noms.join(', ') : '—',
    plants: plants.map(p => ({ ...p, quantite_recoltee: num(p.quantite_recoltee), prix_graine: num(p.prix_graine) })),
  }
}

const HISTO_FIELDS = ['nom', 'date_debut', 'date_fin', 'tente', 'lampe', 'puissance', 'type_culture',
  'engrais', 'substrat', 'id_espace', 'notes', 'cout_engrais', 'cout_electricite', 'cout_graines',
  'cout_total', 'cout_par_gramme']
const HISTO_PLANT_FIELDS = ['id_variete', 'variete_nom', 'numero_plant', 'date_debut_plant',
  'date_fin_plant', 'prix_graine', 'quantite_recoltee', 'notes']

// prix-graine avant /:id
route('GET', '/historique-cultures/prix-graine/:id_variete', async ({ params }) => {
  let r = await one<{ m: number | null }>(
    `SELECT AVG(prix_achat) AS m FROM "Graine"
     WHERE id_variete = ? AND prix_achat IS NOT NULL AND utilisee = 0`, [params.id_variete])
  if (r?.m === null || r?.m === undefined) {
    r = await one<{ m: number | null }>(
      `SELECT AVG(prix_achat) AS m FROM "Graine" WHERE id_variete = ? AND prix_achat IS NOT NULL`,
      [params.id_variete])
  }
  return { data: { prix_graine: r?.m !== null && r?.m !== undefined ? Number(r.m) : null } }
})

route('GET', '/historique-cultures', async () => {
  const rows = await query<Row>('SELECT * FROM "HistoriqueCulture" ORDER BY date_debut DESC')
  const out: Row[] = []
  for (const r of rows) out.push(await enrichHistorique(r))
  return { data: out }
})

route('GET', '/historique-cultures/:id', async ({ params }) => ({
  data: await enrichHistorique(await oneOr404('SELECT * FROM "HistoriqueCulture" WHERE id_historique_culture = ?',
    [params.id], 'Culture introuvable')),
}))

route('POST', '/historique-cultures', async ({ body }) => {
  const p = body as Row
  const obj: Row = {}
  for (const f of HISTO_FIELDS) if (f in p) obj[f] = p[f]
  const id = await insert('HistoriqueCulture', obj)
  let i = 1
  for (const pl of (p.plants as Row[] | undefined) ?? []) {
    const data: Row = { id_historique_culture: id }
    for (const f of HISTO_PLANT_FIELDS) if (f in pl) data[f] = pl[f]
    if (data.numero_plant === undefined) data.numero_plant = i
    if (!data.variete_nom && data.id_variete) {
      const v = await one<Row>('SELECT nom_variete FROM "Variete" WHERE id_variete = ?', [data.id_variete])
      if (v) data.variete_nom = v.nom_variete
    }
    await insert('HistoriquePlant', data)
    i++
  }
  return { status: 201, data: await enrichHistorique((await one<Row>('SELECT * FROM "HistoriqueCulture" WHERE id_historique_culture = ?', [id]))!) }
})

route('PATCH', '/historique-cultures/:id', async ({ params, body }) => {
  await oneOr404('SELECT * FROM "HistoriqueCulture" WHERE id_historique_culture = ?', [params.id], 'Culture introuvable')
  const p = body as Row
  const upd: Row = {}
  for (const f of HISTO_FIELDS) if (f in p) upd[f] = p[f]
  await updateById('HistoriqueCulture', 'id_historique_culture', params.id, upd)
  return { data: await enrichHistorique((await one<Row>('SELECT * FROM "HistoriqueCulture" WHERE id_historique_culture = ?', [params.id]))!) }
})

route('DELETE', '/historique-cultures/:id', async ({ params }) => {
  await oneOr404('SELECT * FROM "HistoriqueCulture" WHERE id_historique_culture = ?', [params.id], 'Culture introuvable')
  await run('DELETE FROM "HistoriquePlant" WHERE id_historique_culture = ?', [params.id])
  await run('DELETE FROM "HistoriqueCulture" WHERE id_historique_culture = ?', [params.id])
  return { status: 204 }
})

route('POST', '/historique-cultures/:id/plants', async ({ params, body }) => {
  await oneOr404('SELECT * FROM "HistoriqueCulture" WHERE id_historique_culture = ?', [params.id], 'Culture introuvable')
  const p = body as Row
  const data: Row = { id_historique_culture: Number(params.id) }
  for (const f of HISTO_PLANT_FIELDS) if (f in p) data[f] = p[f]
  if (!data.variete_nom && data.id_variete) {
    const v = await one<Row>('SELECT nom_variete FROM "Variete" WHERE id_variete = ?', [data.id_variete])
    if (v) data.variete_nom = v.nom_variete
  }
  if (data.numero_plant === undefined) {
    const m = await one<{ m: number | null }>(
      'SELECT MAX(numero_plant) AS m FROM "HistoriquePlant" WHERE id_historique_culture = ?', [params.id])
    data.numero_plant = Number(m?.m ?? 0) + 1
  }
  const id = await insert('HistoriquePlant', data)
  const plant = await one<Row>('SELECT * FROM "HistoriquePlant" WHERE id_historique_plant = ?', [id])
  return { status: 201, data: { ...plant, quantite_recoltee: num(plant!.quantite_recoltee), prix_graine: num(plant!.prix_graine) } }
})

route('PATCH', '/historique-cultures/:culture_id/plants/:plant_id', async ({ params, body }) => {
  await oneOr404('SELECT * FROM "HistoriquePlant" WHERE id_historique_plant = ? AND id_historique_culture = ?',
    [params.plant_id, params.culture_id], 'Plante introuvable')
  const p = body as Row
  const upd: Row = {}
  for (const f of HISTO_PLANT_FIELDS) if (f in p) upd[f] = p[f]
  await updateById('HistoriquePlant', 'id_historique_plant', params.plant_id, upd)
  const plant = await one<Row>('SELECT * FROM "HistoriquePlant" WHERE id_historique_plant = ?', [params.plant_id])
  return { data: { ...plant, quantite_recoltee: num(plant!.quantite_recoltee), prix_graine: num(plant!.prix_graine) } }
})

route('DELETE', '/historique-cultures/:culture_id/plants/:plant_id', async ({ params }) => {
  await oneOr404('SELECT * FROM "HistoriquePlant" WHERE id_historique_plant = ? AND id_historique_culture = ?',
    [params.plant_id, params.culture_id], 'Plante introuvable')
  await run('DELETE FROM "HistoriquePlant" WHERE id_historique_plant = ?', [params.plant_id])
  return { status: 204 }
})

