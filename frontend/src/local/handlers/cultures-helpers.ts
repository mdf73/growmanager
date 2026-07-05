// ─── Helpers culture (mode standalone) ────────────────────────────────────────
// Miroir des helpers de backend/app/routers/cultures.py :
// enrichissements, coûts, dates de récolte, effets d'actions, archivage.
import { query, one, count, insert, run, boolify, jsonify } from '../helpers'

export type Row = Record<string, unknown>

// ── Unités ────────────────────────────────────────────────────────────────────

const UNIT_FACTORS: Record<string, number> = { mL: 1, L: 1000, cL: 10, g: 1, Kg: 1000, kg: 1000 }

export function toSmallUnit(value: number, unite: string | null | undefined): number {
  const base = (unite ?? '').split('/')[0]
  return Number(value) * (UNIT_FACTORS[base] ?? 1)
}

export function prixParPetiteUnite(prod: Row | null): number | null {
  if (!prod || !prod.prix_achat || !prod.volume_conditionnement) return null
  const base = toSmallUnit(Number(prod.volume_conditionnement), prod.unite_volume as string | null)
  if (!base) return null
  return Number(prod.prix_achat) / base
}

export async function deduireStock(prod: Row | null, quantite: number, uniteQuantite: string | null | undefined): Promise<void> {
  if (!prod || prod.quantite_stock === null || prod.quantite_stock === undefined) return
  const qteSmall = toSmallUnit(quantite, uniteQuantite)
  const stockFactor = UNIT_FACTORS[((prod.unite_quantite as string) ?? '').split('/')[0]] ?? 1
  const stockSmall = Number(prod.quantite_stock) * stockFactor
  const nouveau = Math.max(0, stockSmall - qteSmall) / stockFactor
  await run('UPDATE "ProduitEngrais" SET quantite_stock = ? WHERE id_produit = ?', [nouveau, prod.id_produit])
}

// ── Dates ─────────────────────────────────────────────────────────────────────

export function todayISO(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function daysBetween(fromISO: string, toISO: string): number {
  return Math.round((Date.parse(toISO + 'T00:00:00') - Date.parse(fromISO + 'T00:00:00')) / 86400000)
}

export function addDays(iso: string, days: number): string {
  const d = new Date(iso + 'T00:00:00')
  d.setDate(d.getDate() + days)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Normalise une valeur date SQLite (string ou null). */
function asDate(v: unknown): string | null {
  return typeof v === 'string' && v ? v.slice(0, 10) : null
}

// ── Enrichissements ───────────────────────────────────────────────────────────

export async function enrichPlant(plant: Row): Promise<Row> {
  boolify(plant, [])
  const data: Row = {
    id_plant: plant.id_plant,
    id_culture: plant.id_culture,
    id_graine: plant.id_graine,
    nom_affichage: plant.nom_affichage,
    numero_plant: plant.numero_plant,
    origine: plant.origine,
    statut: plant.statut,
    date_germination: plant.date_germination,
    date_debut_flo: plant.date_debut_flo,
    date_recolte: plant.date_recolte,
    date_fin_sechage: plant.date_fin_sechage,
    poids_recolte_g: plant.poids_recolte_g !== null && plant.poids_recolte_g !== undefined ? Number(plant.poids_recolte_g) : null,
    substrat: plant.substrat,
    id_recette_sol: plant.id_recette_sol,
    nom_recette_sol: null,
    id_pot: plant.id_pot,
    taille_pot: null,
    volume_pot_l: plant.volume_pot_l !== null && plant.volume_pot_l !== undefined ? Number(plant.volume_pot_l) : null,
    notes: plant.notes,
    nom_variete: null,
    nom_breeder: null,
    duree_flo_min: null,
    duree_flo_max: null,
    id_plant_mere: plant.id_plant_mere,
    nom_plant_mere: null,
    date_prelevement: plant.date_prelevement,
    date_enracinement: plant.date_enracinement,
    statut_clone: plant.statut_clone,
    nb_clones: 0,
  }
  if (plant.id_graine) {
    const g = await one<Row>(
      `SELECT g.duree_flo_min, g.duree_flo_max, v.nom_variete, b.nom_breeder
       FROM "Graine" g
       LEFT JOIN "Variete" v ON v.id_variete = g.id_variete
       LEFT JOIN "Breeder" b ON b.id_breeder = g.id_breeder
       WHERE g.id_graine = ?`, [plant.id_graine])
    if (g) {
      data.duree_flo_min = g.duree_flo_min
      data.duree_flo_max = g.duree_flo_max
      data.nom_variete = g.nom_variete
      data.nom_breeder = g.nom_breeder
    }
  }
  if (plant.id_recette_sol) {
    const r = await one<Row>('SELECT nom_recette FROM "RecetteLSO" WHERE id_recette_lso = ?', [plant.id_recette_sol])
    if (r) data.nom_recette_sol = r.nom_recette
  }
  if (plant.id_pot) {
    const pot = await one<Row>('SELECT caracteristiques FROM "Materiel" WHERE id_materiel = ?', [plant.id_pot])
    if (pot) {
      jsonify(pot, ['caracteristiques'])
      data.taille_pot = (pot.caracteristiques as Row | null)?.volume ?? null
    }
  }
  if (plant.id_plant_mere) {
    const mere = await one<Row>('SELECT nom_affichage FROM "Plant" WHERE id_plant = ?', [plant.id_plant_mere])
    if (mere) data.nom_plant_mere = mere.nom_affichage
  }
  data.nb_clones = await count('SELECT COUNT(*) AS n FROM "Plant" WHERE id_plant_mere = ?', [plant.id_plant])
  return data
}

export async function enrichAction(action: Row): Promise<Row> {
  jsonify(action, ['parametres'])
  boolify(action, ['global_culture'])
  const data: Row = { ...action, nom_plant: null }
  if (action.id_plant) {
    const p = await one<Row>('SELECT nom_affichage FROM "Plant" WHERE id_plant = ?', [action.id_plant])
    if (p) data.nom_plant = p.nom_affichage
  }
  return data
}

const ARROSAGE_TYPES = ['arrosage_eau', 'arrosage_engrais', 'arrosage_tco', 'preparation_tco']
const STATUTS_FINIS_ACTIFS = ['recolte', 'abandonne', 'wpff']

export async function enrichCulture(culture: Row): Promise<Row> {
  const plants = await query<Row>('SELECT * FROM "Plant" WHERE id_culture = ?', [culture.id_culture])
  // Auto-repair : culture active dont toutes les plantes sont finies
  if (culture.statut === 'active' && plants.length) {
    await maybeCloseCulture(culture)
  }
  const nbActives = plants.filter(p => !STATUTS_FINIS_ACTIFS.includes(String(p.statut))).length
  const today = todayISO()
  const jours = asDate(culture.date_debut) ? daysBetween(asDate(culture.date_debut)!, today) : null

  let nomEspace: unknown = null
  if (culture.id_espace) {
    const esp = await one<Row>('SELECT nom FROM "EspaceCulture" WHERE id_espace = ?', [culture.id_espace])
    nomEspace = esp?.nom ?? null
  }

  const lastArrosage = await one<Row>(
    `SELECT date_action FROM "ActionCalendrier"
     WHERE id_culture = ? AND type_action IN (${ARROSAGE_TYPES.map(() => '?').join(',')})
     ORDER BY date_action DESC LIMIT 1`, [culture.id_culture, ...ARROSAGE_TYPES])
  const joursArrosage = lastArrosage ? daysBetween(asDate(lastArrosage.date_action)!, today) : null

  const lastTco = await one<Row>(
    `SELECT date_action FROM "ActionCalendrier"
     WHERE id_culture = ? AND type_action = 'preparation_tco'
     ORDER BY date_action DESC LIMIT 1`, [culture.id_culture])
  const joursTco = lastTco ? daysBetween(asDate(lastTco.date_action)!, today) : null

  // Fenêtre de récolte (min des duree_flo_min / max des duree_flo_max)
  let dateRecolteMin: string | null = null
  let dateRecolteMax: string | null = null
  for (const p of plants) {
    if (!p.id_graine) continue
    const g = await one<Row>('SELECT duree_flo_min, duree_flo_max FROM "Graine" WHERE id_graine = ?', [p.id_graine])
    if (!g) continue
    const base = asDate(p.date_debut_flo) ?? asDate(culture.date_debut_floraison) ?? asDate(culture.date_passage_12_12)
    if (!base) continue
    if (g.duree_flo_min) {
      const cand = addDays(base, Number(g.duree_flo_min))
      if (dateRecolteMin === null || cand < dateRecolteMin) dateRecolteMin = cand
    }
    if (g.duree_flo_max) {
      const cand = addDays(base, Number(g.duree_flo_max))
      if (dateRecolteMax === null || cand > dateRecolteMax) dateRecolteMax = cand
    }
  }

  const totalRecolte = plants.reduce((s, p) => s + (p.poids_recolte_g ? Number(p.poids_recolte_g) : 0), 0)

  return {
    id_culture: culture.id_culture,
    nom: culture.nom,
    id_espace: culture.id_espace,
    nom_espace: nomEspace,
    statut: culture.statut,
    date_debut: culture.date_debut,
    date_fin: culture.date_fin,
    date_passage_12_12: culture.date_passage_12_12,
    date_debut_floraison: culture.date_debut_floraison,
    date_recolte_estimee: culture.date_recolte_estimee,
    date_recolte_min: dateRecolteMin,
    date_recolte_max: dateRecolteMax,
    phase: culture.phase,
    type_culture: culture.type_culture,
    type_eclairage: culture.type_eclairage,
    but_culture: culture.but_culture,
    notes: culture.notes,
    nb_plantes: plants.length,
    nb_plantes_actives: nbActives,
    jours_culture: jours,
    jours_depuis_dernier_arrosage: joursArrosage,
    jours_depuis_dernier_tco: joursTco,
    total_recolte_g: totalRecolte || null,
  }
}

export async function buildPlantName(idGraine: unknown, numero: number): Promise<string> {
  if (idGraine) {
    const g = await one<Row>(
      `SELECT g.id_graine, g.id_packgraine, v.nom_variete
       FROM "Graine" g LEFT JOIN "Variete" v ON v.id_variete = g.id_variete
       WHERE g.id_graine = ?`, [idGraine])
    if (g?.nom_variete) {
      let rank = numero
      if (g.id_packgraine) {
        const ids = await query<Row>(
          'SELECT id_graine FROM "Graine" WHERE id_packgraine = ? ORDER BY id_graine', [g.id_packgraine])
        const idx = ids.findIndex(r => r.id_graine === g.id_graine)
        if (idx >= 0) rank = idx + 1
      }
      return `${g.nom_variete} #${rank}`
    }
  }
  return `Plant #${numero}`
}

// ── Clôture / archivage ───────────────────────────────────────────────────────

export async function maybeCloseCulture(culture: Row): Promise<void> {
  const plants = await query<Row>('SELECT * FROM "Plant" WHERE id_culture = ?', [culture.id_culture])
  if (!plants.length) return
  const finis = ['sechage', 'recolte', 'curing', 'prete', 'abandonne', 'wpff']
  const allDone = plants.every(p => finis.includes(String(p.statut)))
  if (allDone && culture.statut === 'active') {
    const hasRecolte = plants.some(p => ['sechage', 'recolte', 'curing', 'prete', 'wpff'].includes(String(p.statut)))
    const statut = hasRecolte ? 'sechage_curing' : 'terminee'
    await run('UPDATE "Culture" SET statut = ?, date_fin = ? WHERE id_culture = ?',
      [statut, todayISO(), culture.id_culture])
    culture.statut = statut
    culture.date_fin = todayISO()
  }
}

export async function maybeArchiveCulture(culture: Row, force = false): Promise<void> {
  const plants = await query<Row>('SELECT * FROM "Plant" WHERE id_culture = ?', [culture.id_culture])
  if (!plants.length) return
  const STATUTS_ARCHIVES = ['curing', 'prete', 'abandonne', 'wpff']
  if (!force && !plants.every(p => STATUTS_ARCHIVES.includes(String(p.statut)))) return

  const existing = await one<Row>(
    'SELECT id_historique_culture FROM "HistoriqueCulture" WHERE id_espace IS ? AND date_debut IS ?',
    [culture.id_espace ?? null, culture.date_debut ?? null])
  if (existing) return

  const today = todayISO()

  let tente: unknown = null
  if (culture.id_espace) {
    const esp = await one<Row>('SELECT nom FROM "EspaceCulture" WHERE id_espace = ?', [culture.id_espace])
    tente = esp?.nom ?? null
  }

  // Substrat majoritaire parmi les plantes non abandonnées
  const substrats = plants.filter(p => p.substrat && p.statut !== 'abandonne').map(p => String(p.substrat))
  let substratAuto: string | null = null
  if (substrats.length) {
    const counts = new Map<string, number>()
    for (const s of substrats) counts.set(s, (counts.get(s) ?? 0) + 1)
    substratAuto = [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0]
  }

  const idHistorique = await insert('HistoriqueCulture', {
    date_debut: culture.date_debut ?? null,
    date_fin: culture.date_fin ?? today,
    id_espace: culture.id_espace ?? null,
    nom: culture.nom ?? null,
    type_culture: culture.type_eclairage ?? null,
    tente,
    substrat: substratAuto,
    notes: culture.notes ?? null,
  })

  for (const plant of plants) {
    if (plant.statut === 'abandonne') continue
    let nomVariete: unknown = null
    let idVariete: unknown = null
    let prixGraine: number | null = null
    if (plant.id_graine) {
      const g = await one<Row>(
        `SELECT g.id_variete, g.prix_achat, v.nom_variete
         FROM "Graine" g LEFT JOIN "Variete" v ON v.id_variete = g.id_variete
         WHERE g.id_graine = ?`, [plant.id_graine])
      if (g) {
        idVariete = g.id_variete
        nomVariete = g.nom_variete
        prixGraine = g.prix_achat ? Number(g.prix_achat) : null
      }
    }
    await insert('HistoriquePlant', {
      id_historique_culture: idHistorique,
      id_variete: idVariete ?? null,
      variete_nom: nomVariete ?? null,
      numero_plant: plant.numero_plant ?? null,
      date_debut_plant: plant.date_germination ?? culture.date_debut ?? null,
      date_fin_plant: plant.date_fin_sechage ?? today,
      prix_graine: prixGraine,
      quantite_recoltee: plant.poids_recolte_g ? Number(plant.poids_recolte_g) : null,
      notes: plant.notes ?? null,
    })
  }

  // Coûts à la clôture
  const couts = await computeCultureCost(Number(culture.id_culture), today)
  await run(
    `UPDATE "HistoriqueCulture" SET cout_engrais = ?, cout_electricite = ?, cout_graines = ?,
     cout_total = ?, cout_par_gramme = ?, puissance = COALESCE(?, puissance)
     WHERE id_historique_culture = ?`,
    [couts.cout_engrais, couts.cout_electricite, couts.cout_graines,
     couts.cout_total, couts.cout_par_gramme, couts.puissance_w || null, idHistorique])

  await run('UPDATE "Culture" SET statut = ?, date_fin = COALESCE(date_fin, ?) WHERE id_culture = ?',
    ['terminee', today, culture.id_culture])
  culture.statut = 'terminee'
}

// ── Coûts ─────────────────────────────────────────────────────────────────────

export interface CultureCost {
  cout_engrais: number | null
  cout_electricite: number | null
  cout_graines: number | null
  cout_total: number | null
  cout_par_gramme: number | null
  puissance_w: number
}

export async function computeCultureCost(idCulture: number, dateFinOverride?: string): Promise<CultureCost> {
  const culture = await one<Row>('SELECT * FROM "Culture" WHERE id_culture = ?', [idCulture])
  if (!culture) {
    return { cout_engrais: null, cout_electricite: null, cout_graines: null,
             cout_total: null, cout_par_gramme: null, puissance_w: 0 }
  }
  const today = todayISO()
  const dateDebut = asDate(culture.date_debut) ?? today
  const dateFin = dateFinOverride ?? asDate(culture.date_fin) ?? today

  const setting = await one<Row>('SELECT valeur FROM "AppSettings" WHERE cle = ?', ['prix_kwh'])
  const prixKwh = setting?.valeur ? Number(setting.valeur) : 0.18

  // Puissance : lampes de l'espace (caracteristiques.puissance_w)
  let puissanceW = 0
  let equipRows: Row[] = []
  if (culture.id_espace) {
    equipRows = await query<Row>(
      `SELECT m.* FROM "Materiel" m
       JOIN "EspaceMateriel" em ON em.id_materiel = m.id_materiel
       WHERE em.id_espace = ? AND m.categorie = 'Lampes'`, [culture.id_espace])
    for (const mat of equipRows) {
      jsonify(mat, ['caracteristiques'])
      const pw = (mat.caracteristiques as Row | null)?.puissance_w
      if (pw) puissanceW += Number(pw) || 0
    }
  }
  // Legacy : CultureLampe → Lampe.puissance_lampe
  if (puissanceW === 0) {
    const lampes = await query<Row>(
      `SELECT l.puissance_lampe FROM "Lampe" l
       JOIN "CultureLampe" cl ON cl.id_lampe = l.id_lampe
       WHERE cl.id_culture = ?`, [idCulture])
    puissanceW = lampes.reduce((s, l) => s + (Number(l.puissance_lampe) || 0), 0)
  }

  const dateFlo = asDate(culture.date_debut_floraison) ?? asDate(culture.date_passage_12_12)

  const actionsIntensite = await query<Row>(
    `SELECT * FROM "ActionCalendrier" WHERE id_culture = ? AND type_action = 'intensite_lampe'
     ORDER BY date_action`, [idCulture])
  actionsIntensite.forEach(a => jsonify(a, ['parametres']))

  const kwForLamp = (idMat: number, pwrW: number): number => {
    const lampActions = actionsIntensite.filter(a => {
      const p = (a.parametres as Row | null) ?? {}
      const id = p.id_lampe_materiel
      return id === null || id === undefined || id === idMat
    })
    const bkpts: [string, number | null][] = [[dateDebut, 100]]
    for (const act of lampActions) {
      const d = asDate(act.date_action)!
      const val = ((act.parametres as Row | null) ?? {}).puissance_apres
      if (val !== null && val !== undefined && d >= dateDebut && d <= dateFin) {
        const n = Number(val)
        if (!isNaN(n)) bkpts.push([d, n])
      }
    }
    bkpts.push([dateFin, null])

    const kw = pwrW / 1000
    let total = 0
    for (let i = 0; i < bkpts.length - 1; i++) {
      const [segStart, intensite] = bkpts[i]
      const segEnd = bkpts[i + 1][0]
      if (segStart >= segEnd || intensite === null) continue
      let subs: [string, string, number][]
      if (dateFlo && segStart < dateFlo && dateFlo < segEnd) {
        subs = [[segStart, dateFlo, 18], [dateFlo, segEnd, 12]]
      } else {
        const h = dateFlo && segStart >= dateFlo ? 12 : 18
        subs = [[segStart, segEnd, h]]
      }
      for (const [s, e, h] of subs) {
        const j = Math.max(daysBetween(s, e), 0)
        total += kw * (intensite / 100) * h * j * prixKwh
      }
    }
    return total
  }

  let coutElectricite = 0
  if (culture.id_espace) {
    for (const mat of equipRows) {
      const pw = (mat.caracteristiques as Row | null)?.puissance_w
      if (pw && Number(pw)) coutElectricite += kwForLamp(Number(mat.id_materiel), Number(pw))
    }
  } else if (puissanceW > 0) {
    coutElectricite = kwForLamp(-1, puissanceW)
  }
  coutElectricite = Math.round(coutElectricite * 100) / 100

  // Coût engrais (arrosages avec recette)
  const actionsArrosage = await query<Row>(
    `SELECT * FROM "ActionCalendrier" WHERE id_culture = ? AND type_action = 'arrosage_engrais'`, [idCulture])
  let coutEngrais = 0
  for (const action of actionsArrosage) {
    jsonify(action, ['parametres'])
    boolify(action, ['global_culture'])
    const p = (action.parametres as Row | null) ?? {}
    const idRecette = p.id_recette
    if (!idRecette) continue
    const rawVol = !action.global_culture && p.volume_par_plante_l ? p.volume_par_plante_l : p.volume_l
    if (!rawVol) continue
    const volumeL = Number(rawVol)
    const lignes = await query<Row>('SELECT * FROM "RecetteEngraisLigne" WHERE id_recette = ?', [idRecette])
    for (const ligne of lignes) {
      const prod = await one<Row>('SELECT * FROM "ProduitEngrais" WHERE id_produit = ?', [ligne.id_produit])
      const prix = prixParPetiteUnite(prod)
      if (prix === null) continue
      const qte = toSmallUnit(Number(ligne.dosage) * volumeL, ligne.unite as string | null)
      coutEngrais += qte * prix
    }
  }
  coutEngrais = Math.round(coutEngrais * 100) / 100

  // Coût graines
  const plants = await query<Row>('SELECT * FROM "Plant" WHERE id_culture = ?', [idCulture])
  let coutGraines = 0
  for (const plant of plants) {
    if (plant.id_graine) {
      const g = await one<Row>('SELECT prix_achat FROM "Graine" WHERE id_graine = ?', [plant.id_graine])
      if (g?.prix_achat) coutGraines += Number(g.prix_achat)
    }
  }
  coutGraines = Math.round(coutGraines * 100) / 100

  const coutTotal = Math.round((coutElectricite + coutEngrais + coutGraines) * 100) / 100
  const totalG = plants.reduce((s, p) => s + (p.poids_recolte_g ? Number(p.poids_recolte_g) : 0), 0)
  const coutParGramme = totalG > 0 ? Math.round((coutTotal / totalG) * 10000) / 10000 : null

  return {
    cout_engrais: coutEngrais > 0 ? coutEngrais : null,
    cout_electricite: coutElectricite,
    cout_graines: coutGraines > 0 ? coutGraines : null,
    cout_total: coutTotal > 0 ? coutTotal : null,
    cout_par_gramme: coutParGramme,
    puissance_w: puissanceW,
  }
}

// ── Date de récolte estimée ───────────────────────────────────────────────────

export async function computeHarvestDate(culture: Row): Promise<void> {
  const plants = await query<Row>('SELECT * FROM "Plant" WHERE id_culture = ?', [culture.id_culture])
  let latest: string | null = null
  for (const p of plants) {
    if (!p.id_graine) continue
    const g = await one<Row>('SELECT duree_flo_min, duree_flo_max FROM "Graine" WHERE id_graine = ?', [p.id_graine])
    if (!g) continue
    const dureeMax = Number(g.duree_flo_max ?? g.duree_flo_min ?? 0)
    if (!dureeMax) continue
    const base = asDate(p.date_debut_flo) ?? asDate(culture.date_debut_floraison) ?? asDate(culture.date_passage_12_12)
    if (!base) continue
    const cand = addDays(base, dureeMax)
    if (latest === null || cand > latest) latest = cand
  }
  if (latest) {
    await run('UPDATE "Culture" SET date_recolte_estimee = ? WHERE id_culture = ?', [latest, culture.id_culture])
    culture.date_recolte_estimee = latest
  }
}

// ── Effets des actions ────────────────────────────────────────────────────────

export async function handleActionEffects(action: Row, culture: Row): Promise<void> {
  const t = String(action.type_action)
  const p = ((typeof action.parametres === 'string'
    ? JSON.parse(action.parametres as string) : action.parametres) as Row | null) ?? {}
  const pid = action.id_plant

  const getPlant = async (plantId: unknown): Promise<Row | null> =>
    plantId ? one<Row>('SELECT * FROM "Plant" WHERE id_plant = ?', [plantId]) : null

  const setStatut = async (plantId: unknown, statut: string): Promise<void> => {
    if (plantId) await run('UPDATE "Plant" SET statut = ? WHERE id_plant = ?', [statut, plantId])
  }

  if (t === 'graine_germee') {
    await setStatut(pid, 'germination')
    if (pid) await run('UPDATE "Plant" SET date_germination = ? WHERE id_plant = ?', [action.date_action, pid])

  } else if (t === 'debut_croissance') {
    await setStatut(pid, 'veg')
    await run(
      'UPDATE "Culture" SET date_debut_croissance = COALESCE(date_debut_croissance, ?), phase = ? WHERE id_culture = ?',
      [action.date_action, 'croissance', culture.id_culture])
    culture.phase = 'croissance'

  } else if (t === 'debut_floraison') {
    await setStatut(pid, 'floraison')
    await run(
      'UPDATE "Culture" SET date_debut_floraison = COALESCE(date_debut_floraison, ?), phase = ? WHERE id_culture = ?',
      [action.date_action, 'floraison', culture.id_culture])
    if (!culture.date_debut_floraison) culture.date_debut_floraison = action.date_action
    culture.phase = 'floraison'

    const pl = await getPlant(pid)
    if (pl) {
      const baseDate = asDate(action.date_action)!
      if (!pl.date_debut_flo) {
        await run('UPDATE "Plant" SET date_debut_flo = ? WHERE id_plant = ?', [baseDate, pl.id_plant])
      }
      // Prévision de récolte
      let predictedMin: string | null = null
      let predictedMax: string | null = null
      let nomVariete: unknown = null
      if (pl.id_graine) {
        const g = await one<Row>(
          `SELECT g.duree_flo_min, g.duree_flo_max, v.nom_variete
           FROM "Graine" g LEFT JOIN "Variete" v ON v.id_variete = g.id_variete
           WHERE g.id_graine = ?`, [pl.id_graine])
        if (g) {
          if (g.duree_flo_min) predictedMin = addDays(baseDate, Number(g.duree_flo_min))
          if (g.duree_flo_max) predictedMax = addDays(baseDate, Number(g.duree_flo_max))
          nomVariete = g.nom_variete
        }
      }
      let predictedMid: string | null
      if (predictedMin && predictedMax) {
        const mid = Math.floor((Date.parse(predictedMin) + Date.parse(predictedMax)) / 2)
        predictedMid = new Date(mid).toISOString().slice(0, 10)
      } else {
        predictedMid = predictedMin ?? predictedMax ?? asDate(culture.date_recolte_estimee)
      }
      if (predictedMid) {
        await run(
          `DELETE FROM "ActionCalendrier" WHERE id_culture = ? AND id_plant = ? AND type_action = 'recolte_prevue'`,
          [culture.id_culture, pl.id_plant])
        const params: Row = {}
        if (predictedMin) params.date_min = predictedMin
        if (predictedMax) params.date_max = predictedMax
        if (nomVariete) params.nom_variete = nomVariete
        await insert('ActionCalendrier', {
          id_culture: culture.id_culture,
          id_plant: pl.id_plant,
          date_action: predictedMid,
          type_action: 'recolte_prevue',
          parametres: Object.keys(params).length ? params : null,
          global_culture: false,
          created_at: new Date().toISOString(),
        })
      }
    }
    await computeHarvestDate(culture)

  } else if (t === 'passage_12_12') {
    await run('UPDATE "Culture" SET date_passage_12_12 = ? WHERE id_culture = ?',
      [action.date_action, culture.id_culture])
    culture.date_passage_12_12 = action.date_action
    await computeHarvestDate(culture)

  } else if (t === 'deces_plante') {
    await setStatut(pid, 'abandonne')
    await maybeCloseCulture(culture)

  } else if (t === 'recolte') {
    if (action.global_culture) {
      await run(
        `UPDATE "Plant" SET statut = 'sechage', date_recolte = ?
         WHERE id_culture = ? AND statut IN ('germination','veg','floraison')`,
        [action.date_action, culture.id_culture])
    } else if (pid) {
      await run('UPDATE "Plant" SET statut = ?, date_recolte = ? WHERE id_plant = ?',
        ['sechage', action.date_action, pid])
    }
    await maybeCloseCulture(culture)

  } else if (t === 'debut_curing') {
    const pl = await getPlant(pid)
    if (pl) {
      const poids = p.poids_g ? Number(p.poids_g) : null
      await run(
        'UPDATE "Plant" SET statut = ?, date_fin_sechage = ?, poids_recolte_g = COALESCE(?, poids_recolte_g) WHERE id_plant = ?',
        ['curing', action.date_action, poids, pid])
    }
    await maybeCloseCulture(culture)

  } else if (t === 'fin_curing') {
    const pl = await getPlant(pid)
    if (pl) {
      await run('UPDATE "Plant" SET statut = ? WHERE id_plant = ?', ['prete', pid])
      const poids = pl.poids_recolte_g ? Number(pl.poids_recolte_g) : null
      if (poids && pl.id_graine) {
        const graine = await one<Row>('SELECT * FROM "Graine" WHERE id_graine = ?', [pl.id_graine])
        if (graine?.id_variete) {
          // 1. Sous-type stock
          const sousType = String(culture.type_culture ?? '').toLowerCase() || 'disponible'
          // 2. Lampe : dernière action mise_sous_led/neons
          const lampeAction = await one<Row>(
            `SELECT parametres FROM "ActionCalendrier"
             WHERE id_culture = ? AND type_action IN ('mise_sous_led','mise_sous_neons')
             ORDER BY date_action DESC LIMIT 1`, [culture.id_culture])
          let lampeType: unknown = null
          if (lampeAction) {
            jsonify(lampeAction, ['parametres'])
            lampeType = (lampeAction.parametres as Row | null)?.nom_lampe ?? null
          }
          // 3. Substrat
          let substratType: string | null = null
          if (pl.substrat === 'sol_vivant' && pl.id_recette_sol) {
            const rec = await one<Row>('SELECT nom_recette FROM "RecetteLSO" WHERE id_recette_lso = ?', [pl.id_recette_sol])
            substratType = rec ? `Sol Vivant — ${rec.nom_recette}` : 'Sol Vivant'
          } else if (pl.substrat) {
            const s = String(pl.substrat).replace(/_/g, ' ')
            substratType = s.charAt(0).toUpperCase() + s.slice(1)
          }
          // 4. Engrais : marques des produits des recettes d'arrosage de cette plante (+ globaux)
          const arrosages = await query<Row>(
            `SELECT parametres FROM "ActionCalendrier"
             WHERE id_culture = ? AND type_action = 'arrosage_engrais'
             AND (id_plant = ? OR id_plant IS NULL OR global_culture = 1)`,
            [culture.id_culture, pl.id_plant])
          const recetteIds = new Set<number>()
          for (const act of arrosages) {
            jsonify(act, ['parametres'])
            const idR = (act.parametres as Row | null)?.id_recette
            if (idR) recetteIds.add(Number(idR))
          }
          let engraisType: string | null = null
          if (recetteIds.size) {
            const marks = `(${[...recetteIds].map(() => '?').join(',')})`
            const produits = await query<Row>(
              `SELECT DISTINCT pe.marque FROM "RecetteEngraisLigne" rel
               JOIN "ProduitEngrais" pe ON pe.id_produit = rel.id_produit
               WHERE rel.id_recette IN ${marks} AND pe.marque IS NOT NULL`, [...recetteIds])
            const marques = produits.map(r => String(r.marque)).sort()
            engraisType = marques.length ? marques.join(', ') : null
          }
          // 5. Bocal depuis la session de curing
          let idMaterielBocal: unknown = null
          const plantCuring = await one<Row>(
            `SELECT sc.id_materiel_bocal FROM "PlantCuring" pc
             JOIN "SessionCuring" sc ON sc.id_session_curing = pc.id_session_curing
             WHERE pc.id_plant = ? ORDER BY pc.id_plant_curing DESC LIMIT 1`, [pl.id_plant])
          if (plantCuring) idMaterielBocal = plantCuring.id_materiel_bocal ?? null

          await insert('Stock', {
            id_variete: graine.id_variete,
            type_stock: 'Fleur',
            sous_type_stock: sousType,
            lampe_type: lampeType,
            engrais_type: engraisType,
            substrat_type: substratType,
            date_stock: action.date_action,
            quantite_stock: poids,
            quantite_initiale: poids,
            id_materiel_bocal: idMaterielBocal,
            id_plant: pl.id_plant,
          })
        }
      }
    }
    await maybeCloseCulture(culture)
    await maybeArchiveCulture(culture)

  } else if (t === 'prete') {
    await setStatut(pid, 'prete')
    await maybeCloseCulture(culture)
    await maybeArchiveCulture(culture)

  } else if (t === 'fin_sechage') {
    const pl = await getPlant(pid)
    if (pl) {
      const poids = p.poids_g ?? null
      await run(
        'UPDATE "Plant" SET statut = ?, date_fin_sechage = ?, poids_recolte_g = COALESCE(?, poids_recolte_g) WHERE id_plant = ?',
        ['recolte', action.date_action, poids, pid])
    }
    await maybeCloseCulture(culture)

  } else if (t === 'arrosage_engrais') {
    const idRecette = p.id_recette
    const volumeL = Number(p.volume_l ?? 1)
    if (idRecette) {
      const lignes = await query<Row>('SELECT * FROM "RecetteEngraisLigne" WHERE id_recette = ?', [idRecette])
      for (const ligne of lignes) {
        const qte = Number(ligne.dosage) * volumeL
        const prod = await one<Row>('SELECT * FROM "ProduitEngrais" WHERE id_produit = ?', [ligne.id_produit])
        await deduireStock(prod, qte, ligne.unite as string | null)
      }
    } else {
      for (const item of (p.produits as Row[] | undefined) ?? []) {
        if (item.id_produit && item.quantite) {
          const prod = await one<Row>('SELECT * FROM "ProduitEngrais" WHERE id_produit = ?', [item.id_produit])
          if (prod && prod.quantite_stock !== null && prod.quantite_stock !== undefined) {
            const nouveau = Math.max(0, Number(prod.quantite_stock) - Number(item.quantite))
            await run('UPDATE "ProduitEngrais" SET quantite_stock = ? WHERE id_produit = ?', [nouveau, prod.id_produit])
          }
        }
      }
    }

  } else if (t === 'preparation_tco') {
    const idRecetteTco = p.id_recette_tco
    const volumeL = Number(p.volume_l ?? 1)
    if (idRecetteTco) {
      const recette = await one<Row>('SELECT * FROM "RecetteTCO" WHERE id_recette_tco = ?', [idRecetteTco])
      if (recette?.quantite_tco && Number(recette.quantite_tco) > 0) {
        const scale = volumeL / Number(recette.quantite_tco)
        const lignes = await query<Row>('SELECT * FROM "RecetteTCOLigne" WHERE id_recette_tco = ?', [idRecetteTco])
        for (const ligne of lignes) {
          const qte = Number(ligne.quantite) * scale
          const prod = await one<Row>('SELECT * FROM "ProduitEngrais" WHERE id_produit = ?', [ligne.id_produit])
          await deduireStock(prod, qte, ligne.unite as string | null)
        }
      }
    }

  } else if (t === 'rempotage') {
    if (pid) {
      if (p.id_materiel_pot) await run('UPDATE "Plant" SET id_pot = ? WHERE id_plant = ?', [p.id_materiel_pot, pid])
      if (p.volume_pot_l) await run('UPDATE "Plant" SET volume_pot_l = ? WHERE id_plant = ?', [p.volume_pot_l, pid])
    }
  }
  // pincage / detection_maladie / detection_parasite / traitement / ouverture_bocal :
  // actions informationnelles, aucun effet de bord.
}
