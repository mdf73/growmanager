// ─── Handlers locaux : Dashboard ──────────────────────────────────────────────
// Miroir de backend/app/routers/dashboard.py
// NB : sechage_temp_moy/hum_moy (capteurs Govee) → null en standalone (pas de capteurs).
import { route } from '../router'
import { query, one, count, jsonify } from '../helpers'
import { Row, todayISO, daysBetween } from './cultures-helpers'

const asDate = (v: unknown): string | null => (typeof v === 'string' && v ? v.slice(0, 10) : null)

function minmax(lst: number[]): [number | null, number | null] {
  if (!lst.length) return [null, null]
  return [Math.min(...lst), Math.max(...lst)]
}

/** Fréquence de burping selon l'âge du curing (aligné sur SechageCuring.tsx). */
function burpFrequency(joursCuring: number): [number, string] {
  if (joursCuring <= 7) return [1, '1x/jour']
  if (joursCuring <= 14) return [3, '1x/3j']
  if (joursCuring <= 28) return [7, '1x/7j']
  return [14, '1x/2sem']
}

route('GET', '/dashboard/stats', async () => {
  const today = todayISO()

  // Module 1 : cultures actives
  const nbCulturesActives = await count(`SELECT COUNT(*) AS n FROM "Culture" WHERE statut = 'active'`)
  const plantsVeg = await query<Row>(`SELECT * FROM "Plant" WHERE statut = 'veg'`)
  const plantsFlo = await query<Row>(`SELECT * FROM "Plant" WHERE statut = 'floraison'`)

  const vegDays = plantsVeg.filter(p => asDate(p.date_germination))
    .map(p => daysBetween(asDate(p.date_germination)!, today))

  const floDays: number[] = []
  const hrvMinList: number[] = []
  const hrvMaxList: number[] = []
  for (const p of plantsFlo) {
    const d = asDate(p.date_debut_flo)
    if (!d) continue
    const elapsed = daysBetween(d, today)
    floDays.push(elapsed)
    if (p.id_graine) {
      const g = await one<Row>('SELECT duree_flo_min, duree_flo_max FROM "Graine" WHERE id_graine = ?', [p.id_graine])
      if (g) {
        if (g.duree_flo_min) hrvMinList.push(Number(g.duree_flo_min) - elapsed)
        if (g.duree_flo_max) hrvMaxList.push(Number(g.duree_flo_max) - elapsed)
      }
    }
  }
  const [vegMin, vegMax] = minmax(vegDays)
  const [floMin, floMax] = minmax(floDays)

  // Module 2 : séchage
  const plantsSechage = await query<Row>(`SELECT * FROM "Plant" WHERE statut = 'sechage'`)
  const sechageDays = plantsSechage.filter(p => asDate(p.date_recolte))
    .map(p => daysBetween(asDate(p.date_recolte)!, today))
  const [sechMin, sechMax] = minmax(sechageDays)

  // Module 3 : curing
  const plantsCuring = await query<Row>(`SELECT * FROM "Plant" WHERE statut = 'curing'`)
  const curingDays = plantsCuring.filter(p => asDate(p.date_fin_sechage))
    .map(p => daysBetween(asDate(p.date_fin_sechage)!, today))
  const [curMin, curMax] = minmax(curingDays)

  // Module 4 : stock (Trim et WPFF exclus)
  const stocks = await query<Row>('SELECT type_stock, quantite_stock FROM "Stock"')
  const stocksOnly = stocks.filter(s => !['Trim', 'WPFF'].includes(String(s.type_stock)))
  const sumQ = (rows: Row[]) => rows.reduce((s, r) => s + Number(r.quantite_stock ?? 0), 0)
  const stockTotal = sumQ(stocksOnly)
  const stockHerbe = sumQ(stocksOnly.filter(s => ['Fleur', 'Poussière'].includes(String(s.type_stock))))
  const stockHash = sumQ(stocksOnly.filter(s => s.type_stock === 'Hash'))
  const stockRosin = sumQ(stocksOnly.filter(s => s.type_stock === 'Rosin'))

  // Module 5 : production (depuis HistoriqueCulture / HistoriquePlant)
  const year = today.slice(0, 4)
  const debutAnnee = `${year}-01-01`
  const finAnnee = `${year}-12-31`
  const debutMois = today.slice(0, 8) + '01'
  const d30 = new Date()
  d30.setDate(d30.getDate() - 30)
  const debut30j = d30.toISOString().slice(0, 10)

  async function sumRecolteHistorique(dateMin: string, dateMax: string): Promise<[number, number]> {
    const cultures = await query<Row>(
      `SELECT id_historique_culture FROM "HistoriqueCulture"
       WHERE date_fin IS NOT NULL AND date_fin >= ? AND date_fin <= ?`, [dateMin, dateMax])
    let total = 0
    for (const c of cultures) {
      const plants = await query<Row>(
        'SELECT quantite_recoltee FROM "HistoriquePlant" WHERE id_historique_culture = ?', [c.id_historique_culture])
      total += plants.reduce((s, p) => s + Number(p.quantite_recoltee ?? 0), 0)
    }
    return [total, cultures.length]
  }

  const [prodAnnee, nbRecoltesAnnee] = await sumRecolteHistorique(debutAnnee, finAnnee)
  const [prodMois] = await sumRecolteHistorique(debutMois, today)
  const [prod30j] = await sumRecolteHistorique(debut30j, today)

  // Module 6 : graines
  const packs = await query<Row>('SELECT * FROM "PackGraine"')
  let grainesDispo = 0, grainesFem = 0, grainesReg = 0
  const varietesIds = new Set<number>()
  let valeurTotal = 0
  let hasPrice = false
  for (const pack of packs) {
    const remaining = await count(
      'SELECT COUNT(*) AS n FROM "Graine" WHERE id_packgraine = ? AND (utilisee = 0 OR utilisee IS NULL)',
      [pack.id_packgraine])
    if (remaining === 0) continue
    grainesDispo += remaining
    const first = await one<Row>('SELECT * FROM "Graine" WHERE id_packgraine = ? ORDER BY id_graine LIMIT 1', [pack.id_packgraine])
    if (first) {
      const t = String(first.types_graines ?? '').trim().toLowerCase()
      if (t === 'féminisée') grainesFem += remaining
      else if (t === 'régulière') grainesReg += remaining
      if (first.id_variete) varietesIds.add(Number(first.id_variete))
    }
    if (pack.prix_achat && pack.nbr_graines) {
      valeurTotal += (Number(pack.prix_achat) / Number(pack.nbr_graines)) * remaining
      hasPrice = true
    }
  }

  // Module 3 extra : curing bocal (dernière ouverture ou fin de séchage)
  let curingJoursBocal: number | null = null
  if (plantsCuring.length) {
    let maxJours = 0
    for (const p of plantsCuring) {
      const ouv = await one<Row>(
        `SELECT date_action FROM "ActionCalendrier"
         WHERE id_plant = ? AND type_action = 'ouverture_bocal' ORDER BY date_action DESC LIMIT 1`, [p.id_plant])
      const ref = asDate(ouv?.date_action) ?? asDate(p.date_fin_sechage)
      if (ref) {
        const j = daysBetween(ref, today)
        if (j > maxJours) maxJours = j
      }
    }
    curingJoursBocal = maxJours
  }

  return {
    data: {
      nb_cultures_actives: nbCulturesActives,
      nb_plants_veg: plantsVeg.length,
      nb_plants_flo: plantsFlo.length,
      veg_jours_min: vegMin, veg_jours_max: vegMax,
      flo_jours_min: floMin, flo_jours_max: floMax,
      harvest_restant_jours_min: hrvMinList.length ? Math.min(...hrvMinList) : null,
      harvest_restant_jours_max: hrvMaxList.length ? Math.max(...hrvMaxList) : null,
      nb_plants_sechage: plantsSechage.length,
      sechage_jours_min: sechMin, sechage_jours_max: sechMax,
      nb_plants_curing: plantsCuring.length,
      curing_jours_min: curMin, curing_jours_max: curMax,
      stock_total_g: Math.round(stockTotal * 10) / 10,
      stock_herbe_g: Math.round(stockHerbe * 10) / 10,
      stock_hash_g: Math.round(stockHash * 10) / 10,
      stock_rosin_g: Math.round(stockRosin * 10) / 10,
      production_annee_g: Math.round(prodAnnee * 10) / 10,
      production_mois_g: Math.round(prodMois * 10) / 10,
      production_30j_g: Math.round(prod30j * 10) / 10,
      nb_recoltes_annee: nbRecoltesAnnee,
      graines_disponibles: grainesDispo,
      graines_regulieres: grainesReg,
      graines_feminisees: grainesFem,
      nb_varietes_graines: varietesIds.size,
      valeur_graines_eur: hasPrice ? Math.round(valeurTotal * 100) / 100 : null,
      sechage_temp_moy: null, // capteurs indisponibles en mode autonome
      sechage_hum_moy: null,
      curing_jours_bocal: curingJoursBocal,
    },
  }
})

route('GET', '/dashboard/arrosage-boxes', async () => {
  const today = todayISO()
  const cultures = await query<Row>(`SELECT * FROM "Culture" WHERE statut = 'active'`)
  const result: Row[] = []
  for (const culture of cultures) {
    let boxLabel: string | null = null
    if (culture.id_box) {
      const box = await one<Row>('SELECT * FROM "Box" WHERE id_box = ?', [culture.id_box])
      if (box?.largeur_tente && box.profondeur_tente && box.hauteur_tente) {
        boxLabel = `${box.largeur_tente}x${box.profondeur_tente}x${box.hauteur_tente} cm`
      }
    }
    const last = await one<Row>(
      `SELECT date_action FROM "ActionCalendrier"
       WHERE id_culture = ? AND type_action IN ('arrosage_eau','arrosage_engrais')
       ORDER BY date_action DESC LIMIT 1`, [culture.id_culture])
    const derniere = asDate(last?.date_action)
    const dateFlush = asDate(culture.date_debut_flush)
    result.push({
      id_culture: culture.id_culture,
      culture_nom: culture.nom ?? `Culture #${culture.id_culture}`,
      box_label: boxLabel,
      derniere_arrosage: derniere,
      jours_depuis_arrosage: derniere ? daysBetween(derniere, today) : null,
      date_debut_flush: dateFlush,
      jours_flush: dateFlush ? daysBetween(dateFlush, today) : null,
    })
  }
  result.sort((a, b) => {
    const aNull = a.jours_depuis_arrosage === null ? 1 : 0
    const bNull = b.jours_depuis_arrosage === null ? 1 : 0
    if (aNull !== bNull) return aNull - bNull
    return Number(b.jours_depuis_arrosage ?? 0) - Number(a.jours_depuis_arrosage ?? 0)
  })
  return { data: result }
})

route('GET', '/dashboard/burping-reminders', async () => {
  const today = todayISO()
  const sessions = await query<Row>(`SELECT * FROM "SessionCuring" WHERE statut = 'active'`)
  const result: Row[] = []
  for (const session of sessions) {
    const dateDebut = asDate(session.date_debut)
    const joursCuring = dateDebut ? daysBetween(dateDebut, today) : 0
    const plantCurings = await query<Row>(
      'SELECT id_plant FROM "PlantCuring" WHERE id_session_curing = ?', [session.id_session_curing])
    const plantIds = plantCurings.map(pc => Number(pc.id_plant))

    let derniereOuverture: string | null = null
    if (plantIds.length) {
      const last = await one<Row>(
        `SELECT date_action FROM "ActionCalendrier"
         WHERE id_plant IN (${plantIds.map(() => '?').join(',')}) AND type_action = 'ouverture_bocal'
         ORDER BY date_action DESC LIMIT 1`, plantIds)
      derniereOuverture = asDate(last?.date_action)
    }
    const refDate = derniereOuverture ?? dateDebut
    const joursDepuisOuverture = refDate ? daysBetween(refDate, today) : 0
    const [frequenceJ, frequenceLabel] = burpFrequency(joursCuring)

    result.push({
      id_session_curing: session.id_session_curing,
      nom: session.nom ?? `Session #${session.id_session_curing}`,
      type_contenant: session.type_contenant,
      date_debut: dateDebut,
      jours_curing: joursCuring,
      derniere_ouverture: derniereOuverture,
      jours_depuis_ouverture: joursDepuisOuverture,
      frequence_recommandee_j: frequenceJ,
      frequence_label: frequenceLabel,
      a_ouvrir_aujourd_hui: joursDepuisOuverture >= frequenceJ,
      nb_plantes: plantIds.length,
    })
  }
  result.sort((a, b) => {
    if (a.a_ouvrir_aujourd_hui !== b.a_ouvrir_aujourd_hui) return a.a_ouvrir_aujourd_hui ? -1 : 1
    return Number(b.jours_depuis_ouverture) - Number(a.jours_depuis_ouverture)
  })
  return { data: result }
})

route('GET', '/dashboard/ipm-warnings', async () => {
  const today = todayISO()
  const actions = await query<Row>(
    `SELECT * FROM "ActionCalendrier" WHERE type_action = 'traitement' ORDER BY date_action DESC`)
  const result: Row[] = []
  for (const action of actions) {
    jsonify(action, ['parametres'])
    const params = (action.parametres as Row | null) ?? {}
    const rawDelai = params.delai_recolte_j
    if (rawDelai === null || rawDelai === undefined) continue
    const delaiJ = Number(rawDelai)
    if (!delaiJ || delaiJ <= 0 || isNaN(delaiJ)) continue

    const dateAction = asDate(action.date_action)!
    const joursEcoules = daysBetween(dateAction, today)
    const joursRestants = delaiJ - joursEcoules
    if (joursRestants <= 0) continue

    const culture = await one<Row>('SELECT nom FROM "Culture" WHERE id_culture = ?', [action.id_culture])
    let plantNom: unknown = null
    if (action.id_plant) {
      const plant = await one<Row>('SELECT nom_affichage FROM "Plant" WHERE id_plant = ?', [action.id_plant])
      plantNom = plant?.nom_affichage ?? null
    }
    result.push({
      id_action: action.id_action,
      id_culture: action.id_culture,
      culture_nom: culture?.nom ?? `Culture #${action.id_culture}`,
      id_plant: action.id_plant,
      plant_nom: plantNom,
      date_traitement: dateAction,
      produit: params.produit ?? null,
      dose: params.dose !== null && params.dose !== undefined ? Number(params.dose) : null,
      methode: params.methode ?? null,
      delai_recolte_j: delaiJ,
      jours_ecoules: joursEcoules,
      jours_restants: joursRestants,
      alerte_rouge: joursRestants < 7,
    })
  }
  result.sort((a, b) => Number(a.jours_restants) - Number(b.jours_restants))
  return { data: result }
})

// Legacy
route('GET', '/dashboard', async () => {
  const plantsActifs = await count(
    `SELECT COUNT(*) AS n FROM "Plant" WHERE statut IN ('germination','veg','floraison')`)
  const stockTotal = await one<{ s: number | null }>(
    `SELECT SUM(quantite_stock) AS s FROM "Stock" WHERE type_stock NOT IN ('Trim','WPFF')`)
  const culturesEnCours = await count(`SELECT COUNT(*) AS n FROM "Culture" WHERE statut = 'active'`)
  const extractions = await query<Row>('SELECT quantite_utilisee, quantite_extraite FROM "RosinExtraction"')
  let ratioMoyen = 0
  if (extractions.length) {
    const totalPresse = extractions.reduce((s, e) => s + Number(e.quantite_utilisee ?? 0), 0)
    const totalExtrait = extractions.reduce((s, e) => s + Number(e.quantite_extraite ?? 0), 0)
    ratioMoyen = totalPresse > 0 ? (totalExtrait / totalPresse) * 100 : 0
  }
  const derniers = await query<Row>(
    'SELECT * FROM "RosinExtraction" ORDER BY date_rosinextraction DESC LIMIT 5')
  return {
    data: {
      plants_actifs: plantsActifs,
      stock_total_g: Number(stockTotal?.s ?? 0),
      cultures_en_cours: culturesEnCours,
      ratio_moyen_extraction: Math.round(ratioMoyen * 100) / 100,
      derniers_extractions: derniers.map(e => ({
        id: e.id_rosinextraction,
        variete: e.nom_variete_extract,
        quantite_utilisee: Number(e.quantite_utilisee ?? 0),
        quantite_extraite: Number(e.quantite_extraite ?? 0),
        date: e.date_rosinextraction ? String(e.date_rosinextraction) : null,
      })),
    },
  }
})

