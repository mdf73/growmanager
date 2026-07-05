// ─── Handlers locaux : AppSettings + ParametreListeValeur ─────────────────────
// Miroir de backend/app/routers/{app_settings,parametre}.py (seeds → local/seeds.ts)
import { route, LocalHttpError } from '../router'
import { query, one, oneOr404, insert, run } from '../helpers'

// ── AppSettings ───────────────────────────────────────────────────────────────

route('GET', '/app-settings', async () => ({
  data: await query('SELECT cle, valeur, label FROM "AppSettings" ORDER BY id'),
}))

route('GET', '/app-settings/:cle', async ({ params }) => ({
  data: await oneOr404('SELECT cle, valeur, label FROM "AppSettings" WHERE cle = ?',
    [params.cle], `Setting '${params.cle}' introuvable`),
}))

route('PUT', '/app-settings/:cle', async ({ params, body }) => {
  const valeur = String((body as { valeur: unknown }).valeur)
  const existing = await one('SELECT id FROM "AppSettings" WHERE cle = ?', [params.cle])
  if (existing) {
    await run('UPDATE "AppSettings" SET valeur = ? WHERE cle = ?', [valeur, params.cle])
  } else {
    await insert('AppSettings', { cle: params.cle, valeur })
  }
  return { data: await one('SELECT cle, valeur, label FROM "AppSettings" WHERE cle = ?', [params.cle]) }
})

// ── ParametreListeValeur ──────────────────────────────────────────────────────
// NB : GET/POST prennent :liste_nom, PATCH/DELETE prennent :id — mêmes chemins, méthodes différentes.

route('GET', '/parametres/:liste_nom', async ({ params }) => ({
  data: await query(
    'SELECT * FROM "ParametreListeValeur" WHERE liste_nom = ? ORDER BY ordre, valeur',
    [params.liste_nom]),
}))

route('POST', '/parametres/:liste_nom', async ({ params, body }) => {
  const valeur = String((body as { valeur: unknown }).valeur)
  const exists = await one(
    'SELECT id_parametre FROM "ParametreListeValeur" WHERE liste_nom = ? AND valeur = ?',
    [params.liste_nom, valeur])
  if (exists) throw new LocalHttpError(409, 'Cette valeur existe déjà dans la liste')
  const maxOrdre = await one<{ m: number | null }>(
    'SELECT MAX(ordre) AS m FROM "ParametreListeValeur" WHERE liste_nom = ?', [params.liste_nom])
  const id = await insert('ParametreListeValeur', {
    liste_nom: params.liste_nom,
    valeur,
    ordre: Number(maxOrdre?.m ?? 0) + 1,
  })
  return {
    status: 201,
    data: await one('SELECT * FROM "ParametreListeValeur" WHERE id_parametre = ?', [id]),
  }
})

route('PATCH', '/parametres/:id', async ({ params, body }) => {
  await oneOr404('SELECT * FROM "ParametreListeValeur" WHERE id_parametre = ?',
    [params.id], 'Paramètre introuvable')
  const b = body as { valeur?: unknown; ordre?: unknown }
  if (b.valeur !== undefined && b.valeur !== null) {
    await run('UPDATE "ParametreListeValeur" SET valeur = ? WHERE id_parametre = ?', [String(b.valeur), params.id])
  }
  if (b.ordre !== undefined && b.ordre !== null) {
    await run('UPDATE "ParametreListeValeur" SET ordre = ? WHERE id_parametre = ?', [Number(b.ordre), params.id])
  }
  return { data: await one('SELECT * FROM "ParametreListeValeur" WHERE id_parametre = ?', [params.id]) }
})

route('DELETE', '/parametres/:id', async ({ params }) => {
  await oneOr404('SELECT * FROM "ParametreListeValeur" WHERE id_parametre = ?',
    [params.id], 'Paramètre introuvable')
  await run('DELETE FROM "ParametreListeValeur" WHERE id_parametre = ?', [params.id])
  return { status: 204 }
})
