// ─── Handlers locaux : Préparation substrat + Suivi sol vivant ────────────────
// Miroir de backend/app/routers/{preparation_substrat,suivi_sol_vivant}.py
import { route } from '../router'
import { query, one, oneOr404, insert, updateById, run, jsonify } from '../helpers'
import { Row, todayISO, toSmallUnit, deduireStock } from './cultures-helpers'

const num = (v: unknown): number | null => (v === null || v === undefined ? null : Number(v))

// ═══ Préparation substrat ══════════════════════════════════════════════════════

function prepRead(p: Row): Row {
  jsonify(p, ['configuration_pots', 'resultat'])
  return { ...p, volume_total_l: Number(p.volume_total_l ?? 0) }
}

route('GET', '/preparation-substrat', async () => {
  const items = await query<Row>(
    'SELECT * FROM "PreparationSubstrat" ORDER BY date_preparation DESC, created_at DESC')
  return { data: items.map(prepRead) }
})

route('GET', '/preparation-substrat/:id', async ({ params }) => ({
  data: prepRead(await oneOr404('SELECT * FROM "PreparationSubstrat" WHERE id_preparation = ?',
    [params.id], 'Préparation introuvable')),
}))

route('POST', '/preparation-substrat', async ({ body }) => {
  const p = body as Row
  const id = await insert('PreparationSubstrat', {
    date_preparation: p.date_preparation ?? todayISO(),
    volume_total_l: p.volume_total_l,
    type_sol: p.type_sol ?? null,
    id_recette_lso: p.id_recette_lso ?? null,
    nom_recette_lso: p.nom_recette_lso ?? null,
    configuration_pots: p.configuration_pots ?? null, // sqlValue → JSON string
    resultat: p.resultat ?? null,
    notes: p.notes ?? null,
    created_at: new Date().toISOString(),
  })
  return { status: 201, data: prepRead((await one<Row>('SELECT * FROM "PreparationSubstrat" WHERE id_preparation = ?', [id]))!) }
})

route('DELETE', '/preparation-substrat/:id', async ({ params }) => {
  await oneOr404('SELECT * FROM "PreparationSubstrat" WHERE id_preparation = ?', [params.id], 'Préparation introuvable')
  await run('DELETE FROM "PreparationSubstrat" WHERE id_preparation = ?', [params.id])
  return { status: 204 }
})

// ═══ Suivi sol vivant ══════════════════════════════════════════════════════════

/** Coût d'un ingrédient en € (normalisation des unités, comme le backend). */
async function ingredientCost(quantite: number, unite: string | null, prod: Row | null): Promise<number | null> {
  if (!prod || prod.prix_achat === null || prod.prix_achat === undefined
      || prod.volume_conditionnement === null || prod.volume_conditionnement === undefined) return null
  const vcSmall = toSmallUnit(Number(prod.volume_conditionnement), prod.unite_volume as string | null)
  if (vcSmall === 0) return null
  const qSmall = toSmallUnit(quantite, unite)
  return Math.round(qSmall * (Number(prod.prix_achat) / vcSmall) * 10000) / 10000
}

function baseUnit(unite: unknown): string | null {
  if (!unite) return null
  return String(unite).split('/')[0]
}

/** Coût total des lignes d'une recette (null si un ingrédient n'est pas calculable). */
async function recetteCost(ligneTable: string, fkCol: string, idRecette: unknown, qtyCol: string, volumeMult = 1): Promise<number | null> {
  const lignes = await query<Row>(`SELECT * FROM "${ligneTable}" WHERE "${fkCol}" = ?`, [idRecette])
  let total = 0
  for (const ligne of lignes) {
    const p = await one<Row>('SELECT * FROM "ProduitEngrais" WHERE id_produit = ?', [ligne.id_produit])
    const c = await ingredientCost(Number(ligne[qtyCol]) * volumeMult, baseUnit(ligne.unite), p)
    if (c === null) return null
    total += c
  }
  return Math.round(total * 100) / 100
}

async function enrichReamend(e: Row): Promise<Row> {
  let nom: unknown = null
  let cout: number | null = null
  if (e.id_recette_reamend) {
    const r = await one<Row>('SELECT * FROM "RecetteReamendement" WHERE id_recette_reamend = ?', [e.id_recette_reamend])
    nom = r?.nom_recette ?? null
    if (r) cout = await recetteCost('RecetteReamendementLigne', 'id_recette_reamend', r.id_recette_reamend, 'quantite')
  }
  return {
    id_suivi_reamend: e.id_suivi_reamend,
    id_recette_reamend: e.id_recette_reamend,
    date_application: e.date_application,
    notes: e.notes,
    nom_recette_reamend: nom,
    cout_estime: cout,
  }
}

async function enrichArrosage(e: Row): Promise<Row> {
  let nom: unknown = null
  let cout: number | null = null
  if (e.id_recette_engrais) {
    const r = await one<Row>('SELECT * FROM "RecetteEngrais" WHERE id_recette = ?', [e.id_recette_engrais])
    nom = r?.nom_recette ?? null
    if (r && e.volume_eau_l !== null && e.volume_eau_l !== undefined) {
      cout = await recetteCost('RecetteEngraisLigne', 'id_recette', r.id_recette, 'dosage', Number(e.volume_eau_l))
    }
  }
  return {
    id_suivi_arrosage: e.id_suivi_arrosage,
    id_recette_engrais: e.id_recette_engrais,
    volume_eau_l: num(e.volume_eau_l),
    date_application: e.date_application,
    notes: e.notes,
    nom_recette_arrosage: nom,
    cout_estime: cout,
  }
}

async function enrichTco(e: Row): Promise<Row> {
  let nom: unknown = null
  if (e.id_recette_tco) {
    const r = await one<Row>('SELECT nom_recette FROM "RecetteTCO" WHERE id_recette_tco = ?', [e.id_recette_tco])
    nom = r?.nom_recette ?? null
  }
  return {
    id_suivi_tco: e.id_suivi_tco,
    id_recette_tco: e.id_recette_tco,
    volume_applique: num(e.volume_applique),
    date_application: e.date_application,
    notes: e.notes,
    nom_recette_tco: nom,
  }
}

async function enrichFerm(e: Row): Promise<Row> {
  let nom: unknown = null
  if (e.id_recette_ferm) {
    const r = await one<Row>('SELECT nom_recette FROM "RecetteFermentation" WHERE id_recette_ferm = ?', [e.id_recette_ferm])
    nom = r?.nom_recette ?? null
  }
  return {
    id_suivi_ferm: e.id_suivi_ferm,
    id_recette_ferm: e.id_recette_ferm,
    volume_applique: num(e.volume_applique),
    date_application: e.date_application,
    notes: e.notes,
    nom_recette_ferm: nom,
  }
}

async function enrichSuivi(s: Row): Promise<Row> {
  let nomLso: unknown = null
  let coutLso: number | null = null
  if (s.id_recette_lso) {
    const lso = await one<Row>('SELECT * FROM "RecetteLSO" WHERE id_recette_lso = ?', [s.id_recette_lso])
    nomLso = lso?.nom_recette ?? null
    if (lso) coutLso = await recetteCost('RecetteLSOLigne', 'id_recette_lso', lso.id_recette_lso, 'quantite')
  }
  let nomMat: unknown = null
  if (s.id_materiel) {
    const mat = await one<Row>('SELECT nom FROM "Materiel" WHERE id_materiel = ?', [s.id_materiel])
    nomMat = mat?.nom ?? null
  }
  const reamendements = await Promise.all(
    (await query<Row>('SELECT * FROM "SuiviReamendement" WHERE id_suivi = ?', [s.id_suivi])).map(enrichReamend))
  const arrosages = await Promise.all(
    (await query<Row>('SELECT * FROM "SuiviArrosage" WHERE id_suivi = ?', [s.id_suivi])).map(enrichArrosage))
  const tcos = await Promise.all(
    (await query<Row>('SELECT * FROM "SuiviTCO" WHERE id_suivi = ?', [s.id_suivi])).map(enrichTco))
  const fermentations = await Promise.all(
    (await query<Row>('SELECT * FROM "SuiviFermentation" WHERE id_suivi = ?', [s.id_suivi])).map(enrichFerm))
  const cultures = await query<Row>('SELECT * FROM "SuiviCulture" WHERE id_suivi = ?', [s.id_suivi])

  const allParts: (number | null)[] = [coutLso,
    ...reamendements.map(r => r.cout_estime as number | null),
    ...arrosages.map(a => a.cout_estime as number | null)]
  const known = allParts.filter((v): v is number => v !== null)
  const coutTotal = known.length ? Math.round(known.reduce((a, b) => a + b, 0) * 100) / 100 : null

  return {
    id_suivi: s.id_suivi,
    nom_pot: s.nom_pot,
    id_materiel: s.id_materiel,
    id_recette_lso: s.id_recette_lso,
    volume_pot_l: num(s.volume_pot_l),
    date_preparation: s.date_preparation,
    commentaires: s.commentaires,
    nom_recette_lso: nomLso,
    nom_materiel: nomMat,
    cout_lso_estime: coutLso,
    cout_total_estime: coutTotal,
    reamendements,
    arrosages,
    tcos,
    fermentations,
    cultures: cultures.map(c => ({
      id_suivi_culture: c.id_suivi_culture,
      description: c.description,
      date_debut: c.date_debut,
      date_fin: c.date_fin,
      notes: c.notes,
    })),
  }
}

async function loadSuivi(id: unknown): Promise<Row> {
  return oneOr404('SELECT * FROM "SuiviSolVivant" WHERE id_suivi = ?', [id], 'Suivi sol vivant introuvable')
}

const CHILD_DEFS: { key: string; table: string; fields: string[] }[] = [
  { key: 'reamendements', table: 'SuiviReamendement', fields: ['id_recette_reamend', 'date_application', 'notes'] },
  { key: 'arrosages', table: 'SuiviArrosage', fields: ['id_recette_engrais', 'volume_eau_l', 'date_application', 'notes'] },
  { key: 'tcos', table: 'SuiviTCO', fields: ['id_recette_tco', 'volume_applique', 'date_application', 'notes'] },
  { key: 'fermentations', table: 'SuiviFermentation', fields: ['id_recette_ferm', 'volume_applique', 'date_application', 'notes'] },
  { key: 'cultures', table: 'SuiviCulture', fields: ['description', 'date_debut', 'date_fin', 'notes'] },
]

async function insertChild(table: string, fields: string[], idSuivi: number, e: Row): Promise<void> {
  const obj: Row = { id_suivi: idSuivi }
  for (const f of fields) obj[f] = e[f] ?? null
  await insert(table, obj)
}

route('GET', '/suivi-sols-vivants', async () => {
  const suivis = await query<Row>('SELECT * FROM "SuiviSolVivant" ORDER BY nom_pot')
  const out: Row[] = []
  for (const s of suivis) out.push(await enrichSuivi(s))
  return { data: out }
})

route('GET', '/suivi-sols-vivants/:id', async ({ params }) => ({
  data: await enrichSuivi(await loadSuivi(params.id)),
}))

route('POST', '/suivi-sols-vivants', async ({ body }) => {
  const p = body as Row
  const id = await insert('SuiviSolVivant', {
    nom_pot: p.nom_pot,
    id_materiel: p.id_materiel ?? null,
    id_recette_lso: p.id_recette_lso ?? null,
    volume_pot_l: p.volume_pot_l ?? null,
    date_preparation: p.date_preparation ?? null,
    commentaires: p.commentaires ?? null,
  })
  for (const def of CHILD_DEFS) {
    for (const e of (p[def.key] as Row[] | undefined) ?? []) {
      await insertChild(def.table, def.fields, id, e)
    }
  }
  return { status: 201, data: await enrichSuivi((await one<Row>('SELECT * FROM "SuiviSolVivant" WHERE id_suivi = ?', [id]))!) }
})

route('PUT', '/suivi-sols-vivants/:id', async ({ params, body }) => {
  await loadSuivi(params.id)
  const p = body as Row
  const upd: Row = {}
  for (const f of ['nom_pot', 'id_materiel', 'id_recette_lso', 'volume_pot_l', 'date_preparation', 'commentaires']) {
    if (p[f] !== null && p[f] !== undefined) upd[f] = p[f]
  }
  await updateById('SuiviSolVivant', 'id_suivi', params.id, upd)
  for (const def of CHILD_DEFS) {
    if (p[def.key] !== null && p[def.key] !== undefined) {
      await run(`DELETE FROM "${def.table}" WHERE id_suivi = ?`, [params.id])
      for (const e of p[def.key] as Row[]) {
        await insertChild(def.table, def.fields, Number(params.id), e)
      }
    }
  }
  return { data: await enrichSuivi((await one<Row>('SELECT * FROM "SuiviSolVivant" WHERE id_suivi = ?', [params.id]))!) }
})

route('DELETE', '/suivi-sols-vivants/:id', async ({ params }) => {
  await loadSuivi(params.id)
  for (const def of CHILD_DEFS) {
    await run(`DELETE FROM "${def.table}" WHERE id_suivi = ?`, [params.id])
  }
  await run('DELETE FROM "SuiviSolVivant" WHERE id_suivi = ?', [params.id])
  return { status: 204 }
})

// ── Ajouts individuels ────────────────────────────────────────────────────────

route('POST', '/suivi-sols-vivants/:id/reamendements', async ({ params, body }) => {
  await loadSuivi(params.id)
  await insertChild('SuiviReamendement', CHILD_DEFS[0].fields, Number(params.id), body as Row)
  return { status: 201, data: await enrichSuivi((await one<Row>('SELECT * FROM "SuiviSolVivant" WHERE id_suivi = ?', [params.id]))!) }
})

route('POST', '/suivi-sols-vivants/:id/arrosages', async ({ params, body }) => {
  await loadSuivi(params.id)
  const e = body as Row
  await insertChild('SuiviArrosage', CHILD_DEFS[1].fields, Number(params.id), e)
  // Déduction stock engrais (comme le backend)
  if (e.id_recette_engrais && e.volume_eau_l) {
    const volumeL = Number(e.volume_eau_l)
    const lignes = await query<Row>('SELECT * FROM "RecetteEngraisLigne" WHERE id_recette = ?', [e.id_recette_engrais])
    for (const ligne of lignes) {
      const qte = Number(ligne.dosage) * volumeL
      const prod = await one<Row>('SELECT * FROM "ProduitEngrais" WHERE id_produit = ?', [ligne.id_produit])
      await deduireStock(prod, qte, ligne.unite as string | null)
    }
  }
  return { status: 201, data: await enrichSuivi((await one<Row>('SELECT * FROM "SuiviSolVivant" WHERE id_suivi = ?', [params.id]))!) }
})

route('POST', '/suivi-sols-vivants/:id/tcos', async ({ params, body }) => {
  await loadSuivi(params.id)
  await insertChild('SuiviTCO', CHILD_DEFS[2].fields, Number(params.id), body as Row)
  return { status: 201, data: await enrichSuivi((await one<Row>('SELECT * FROM "SuiviSolVivant" WHERE id_suivi = ?', [params.id]))!) }
})

route('POST', '/suivi-sols-vivants/:id/fermentations', async ({ params, body }) => {
  await loadSuivi(params.id)
  await insertChild('SuiviFermentation', CHILD_DEFS[3].fields, Number(params.id), body as Row)
  return { status: 201, data: await enrichSuivi((await one<Row>('SELECT * FROM "SuiviSolVivant" WHERE id_suivi = ?', [params.id]))!) }
})

route('POST', '/suivi-sols-vivants/:id/cultures', async ({ params, body }) => {
  await loadSuivi(params.id)
  await insertChild('SuiviCulture', CHILD_DEFS[4].fields, Number(params.id), body as Row)
  return { status: 201, data: await enrichSuivi((await one<Row>('SELECT * FROM "SuiviSolVivant" WHERE id_suivi = ?', [params.id]))!) }
})
