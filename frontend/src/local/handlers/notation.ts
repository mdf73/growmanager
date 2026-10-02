// ─── Handlers locaux : Classement des variétés (notations) ────────────────────
// Miroir de backend/app/routers/notation_variete.py (export CSV → 501)
import { route } from '../router'
import { query, one, oneOr404, insert, updateById, run, LocalHttpError } from '../helpers'
import { Row, todayISO } from './cultures-helpers'

const NOTE_FIELDS = ['note_gout', 'note_odeur', 'note_texture', 'note_extraction']
const FIELDS = ['nom_variete', 'breeder', 'date_notation', ...NOTE_FIELDS,
  'taux_thc', 'taux_cbd', 'terpene_dominant', 'commentaire_labo', 'notes_generales']

const HYDRO_KEYWORDS = ['hydro', 'nft', 'argile', 'dwc', 'aero', 'aéro', 'ebb']
const POT_HISTORIQUE_TERRE_L = 15
const STATUTS_GERMES = new Set(['veg', 'floraison', 'sechage', 'curing', 'prete', 'recolte', 'wpff'])

const clean = (s: unknown) => String(s ?? '').trim().split(/\s+/).filter(Boolean).join(' ')
const keyOf = (s: unknown) => clean(s).toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '')
const isHydro = (s: unknown) => { const v = String(s ?? '').toLowerCase(); return HYDRO_KEYWORDS.some(k => v.includes(k)) }
const r1 = (v: number) => Math.round(v * 10) / 10
const r2 = (v: number) => Math.round(v * 100) / 100

function toNum(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null
  const n = parseFloat(String(v).replace(',', '.').toLowerCase().replace('l', '').trim())
  return Number.isFinite(n) ? n : null
}

function noteMoyenne(n: Row): number | null {
  const vals = NOTE_FIELDS.map(f => n[f]).filter(v => v !== null && v !== undefined).map(Number)
  return vals.length ? r2(vals.reduce((a, b) => a + b, 0) / vals.length) : null
}

function toRead(n: Row): Row {
  return { ...n, note_moyenne: noteMoyenne(n) }
}

function bucketLabel(kind: string, vol: number | null): string {
  if (kind === 'hydro') return 'Hydro'
  if (kind === 'pot' && vol !== null) return `${vol} L`.replace('.', ',')
  return 'Pot non renseigné'
}

interface Acc {
  nom_variete: string; breeder: string | null
  yields: Map<string, { kind: string; vol: number | null; vals: number[] }>
  rosin: [number, number, number]; hash: [number, number, number]
  germ: [number, number]; notation: Row | null
}

async function buildClassement(): Promise<Row[]> {
  const varietes = new Map((await query<Row>('SELECT id_variete, nom_variete FROM "Variete"'))
    .map(v => [Number(v.id_variete), String(v.nom_variete)]))
  const breeders = new Map((await query<Row>('SELECT id_breeder, nom_breeder FROM "Breeder"'))
    .map(b => [Number(b.id_breeder), String(b.nom_breeder)]))
  const graines = new Map((await query<Row>('SELECT id_graine, id_variete, id_breeder FROM "Graine"'))
    .map(g => [Number(g.id_graine), { v: g.id_variete ? Number(g.id_variete) : null, b: g.id_breeder ? Number(g.id_breeder) : null }]))
  const stocks = new Map((await query<Row>('SELECT id_stock, id_variete FROM "Stock"'))
    .map(s => [Number(s.id_stock), s.id_variete ? Number(s.id_variete) : null]))
  const potsVolume = new Map<number, number | null>()
  for (const m of await query<Row>(`SELECT id_materiel, caracteristiques FROM "Materiel" WHERE categorie = 'Pots'`)) {
    let c: Row = {}
    try { c = typeof m.caracteristiques === 'string' ? JSON.parse(m.caracteristiques) : (m.caracteristiques as Row) ?? {} } catch { c = {} }
    potsVolume.set(Number(m.id_materiel), toNum(c.volume_l) ?? toNum(c.volume))
  }

  const rows = new Map<string, Acc>()
  const row = (name: string): Acc => {
    const k = keyOf(name)
    if (!rows.has(k)) rows.set(k, {
      nom_variete: clean(name), breeder: null, yields: new Map(),
      rosin: [0, 0, 0], hash: [0, 0, 0], germ: [0, 0], notation: null,
    })
    return rows.get(k)!
  }
  const addYield = (name: string, kind: string, vol: number | null, g: number) => {
    const y = row(name).yields
    const k = `${kind}|${vol ?? ''}`
    if (!y.has(k)) y.set(k, { kind, vol, vals: [] })
    y.get(k)!.vals.push(g)
  }

  // Plantes des cultures
  const mortes = new Set((await query<Row>(
    `SELECT id_plant FROM "ActionCalendrier" WHERE type_action = 'graine_morte' AND id_plant IS NOT NULL`))
    .map(a => Number(a.id_plant)))
  for (const p of await query<Row>('SELECT * FROM "Plant"')) {
    const g = p.id_graine ? graines.get(Number(p.id_graine)) : undefined
    const name = g?.v ? varietes.get(g.v) : undefined
    if (!name) continue
    const r = row(name)
    if (!r.breeder && g?.b) r.breeder = breeders.get(g.b) ?? null

    if ((p.origine ?? 'graine') === 'graine') {
      if (mortes.has(Number(p.id_plant))) r.germ[1] += 1
      else if (p.date_germination || STATUTS_GERMES.has(String(p.statut))) r.germ[0] += 1
    }

    const poids = Number(p.poids_recolte_g ?? 0)
    if (poids > 0 && p.statut !== 'abandonne') {
      if (isHydro(p.substrat)) addYield(name, 'hydro', null, poids)
      else {
        const vol = toNum(p.volume_pot_l) ?? (p.id_pot ? potsVolume.get(Number(p.id_pot)) ?? null : null)
        addYield(name, vol ? 'pot' : 'inconnu', vol, poids)
      }
    }
  }

  // Historique (sans les archives des cultures encore présentes)
  const culturesIds = new Set((await query<Row>('SELECT id_culture FROM "Culture"')).map(c => Number(c.id_culture)))
  const hists = new Map<number, Row>()
  for (const h of await query<Row>('SELECT * FROM "HistoriqueCulture"')) {
    if (h.id_culture && culturesIds.has(Number(h.id_culture))) continue
    hists.set(Number(h.id_historique_culture), h)
  }
  for (const hp of await query<Row>('SELECT * FROM "HistoriquePlant"')) {
    const h = hists.get(Number(hp.id_historique_culture))
    if (!h) continue
    const name = clean(hp.variete_nom) || (hp.id_variete ? varietes.get(Number(hp.id_variete)) : undefined)
    const qte = Number(hp.quantite_recoltee ?? 0)
    if (!name || qte <= 0) continue
    if (isHydro(h.substrat)) addYield(name, 'hydro', null, qte)
    else if (h.substrat) addYield(name, 'pot', POT_HISTORIQUE_TERRE_L, qte)
    else addYield(name, 'inconnu', null, qte)
  }

  // Extractions (cumul)
  const nomFromStock = (id: unknown): string | null => {
    if (!id) return null
    const v = stocks.get(Number(id))
    return v ? varietes.get(v) ?? null : null
  }
  for (const x of await query<Row>('SELECT * FROM "RosinExtraction"')) {
    const u = Number(x.quantite_utilisee ?? 0), e = Number(x.quantite_extraite ?? 0)
    if (u <= 0 || !e) continue
    const name = clean(x.nom_variete_extract) || nomFromStock(x.id_stock_source)
    if (!name) continue
    const a = row(name).rosin; a[0] += u; a[1] += e; a[2] += 1
  }
  for (const x of await query<Row>('SELECT * FROM "HashExtraction"')) {
    const u = Number(x.quantite_utilisee ?? 0), e = Number(x.quantite_extraite ?? 0)
    if (u <= 0 || !e) continue
    let name = clean(x.nom_variete_hash)
    if (!name && x.id_variete) name = varietes.get(Number(x.id_variete)) ?? ''
    if (!name) name = nomFromStock(x.id_stock_source) ?? ''
    if (!name) continue
    const a = row(name).hash; a[0] += u; a[1] += e; a[2] += 1
  }

  // Notations (la plus récente si doublon)
  for (const n of await query<Row>('SELECT * FROM "NotationVariete" ORDER BY updated_at, id_notation')) {
    const r = row(String(n.nom_variete))
    r.notation = toRead(n)
    if (n.breeder) r.breeder = String(n.breeder)
  }

  const order: Record<string, number> = { pot: 0, hydro: 1, inconnu: 2 }
  const extr = (a: [number, number, number]) => a[2]
    ? { nb: a[2], total_utilise_g: r1(a[0]), total_extrait_g: r2(a[1]), rendement_pct: r1(a[1] / a[0] * 100) }
    : null

  const result: Row[] = []
  for (const [k, r] of rows) {
    const all: number[] = []
    const buckets = [...r.yields.values()]
      .sort((a, b) => (order[a.kind] - order[b.kind]) || ((a.vol ?? 0) - (b.vol ?? 0)))
      .map(b => {
        all.push(...b.vals)
        const sum = b.vals.reduce((x, y) => x + y, 0)
        return {
          type: b.kind, volume_l: b.vol, label: bucketLabel(b.kind, b.vol), nb_pieds: b.vals.length,
          moyenne_g: r1(sum / b.vals.length), total_g: r1(sum),
          min_g: r1(Math.min(...b.vals)), max_g: r1(Math.max(...b.vals)),
        }
      })
    const [germees, mortesN] = r.germ
    const semees = germees + mortesN
    result.push({
      key: k, nom_variete: r.nom_variete, breeder: r.breeder, notation: r.notation,
      note_moyenne: r.notation ? r.notation.note_moyenne : null,
      rendement_culture: buckets, nb_pieds_recoltes: all.length,
      rendement_moyen_g: all.length ? r1(all.reduce((x, y) => x + y, 0) / all.length) : null,
      rosin: extr(r.rosin), hash: extr(r.hash),
      germination: semees ? { semees, germees, mortes: mortesN, taux_pct: r1(germees / semees * 100) } : null,
    })
  }
  result.sort((a, b) =>
    (Number(a.note_moyenne === null) - Number(b.note_moyenne === null))
    || (Number(b.note_moyenne ?? 0) - Number(a.note_moyenne ?? 0))
    || (Number(b.rendement_moyen_g ?? 0) - Number(a.rendement_moyen_g ?? 0))
    || String(a.nom_variete).localeCompare(String(b.nom_variete)))
  return result
}

// ── Routes utilitaires (avant /:id) ───────────────────────────────────────────

route('GET', '/notations/utils/classement', async () => ({ data: await buildClassement() }))

// ── CRUD ──────────────────────────────────────────────────────────────────────

route('GET', '/notations', async () => {
  const result = (await query<Row>('SELECT * FROM "NotationVariete"')).map(toRead)
  result.sort((a, b) => (Number(a.note_moyenne === null) - Number(b.note_moyenne === null))
    || (Number(b.note_moyenne ?? 0) - Number(a.note_moyenne ?? 0)))
  return { data: result }
})

route('POST', '/notations', async ({ body }) => {
  const p = body as Row
  const nom = clean(p.nom_variete)
  if (!nom) throw new LocalHttpError(422, 'Nom de variété obligatoire')
  const existing = (await query<Row>('SELECT * FROM "NotationVariete"')).find(n => keyOf(n.nom_variete) === keyOf(nom))
  const obj: Row = { updated_at: new Date().toISOString() }
  for (const f of FIELDS) if (f !== 'nom_variete') obj[f] = p[f] ?? null
  if (!obj.date_notation) obj.date_notation = todayISO()
  let id: number
  if (existing) {
    id = Number(existing.id_notation)
    await updateById('NotationVariete', 'id_notation', id, obj)
  } else {
    id = await insert('NotationVariete', { ...obj, nom_variete: nom, created_at: new Date().toISOString() })
  }
  return { status: 201, data: toRead((await one<Row>('SELECT * FROM "NotationVariete" WHERE id_notation = ?', [id]))!) }
})

route('GET', '/notations/:id', async ({ params }) => ({
  data: toRead(await oneOr404('SELECT * FROM "NotationVariete" WHERE id_notation = ?', [params.id], 'Notation introuvable')),
}))

route('PUT', '/notations/:id', async ({ params, body }) => {
  await oneOr404('SELECT * FROM "NotationVariete" WHERE id_notation = ?', [params.id], 'Notation introuvable')
  const p = body as Row
  const upd: Row = { updated_at: new Date().toISOString() }
  // Seuls les champs envoyés sont modifiés (une note peut être remise à null = non notée)
  for (const f of FIELDS) {
    if (!(f in p)) continue
    if (f === 'nom_variete' && !p[f]) continue
    upd[f] = p[f] ?? null
  }
  await updateById('NotationVariete', 'id_notation', params.id, upd)
  return { data: toRead((await one<Row>('SELECT * FROM "NotationVariete" WHERE id_notation = ?', [params.id]))!) }
})

route('DELETE', '/notations/:id', async ({ params }) => {
  await oneOr404('SELECT * FROM "NotationVariete" WHERE id_notation = ?', [params.id], 'Notation introuvable')
  await run('DELETE FROM "NotationVariete" WHERE id_notation = ?', [params.id])
  return { status: 204 }
})
