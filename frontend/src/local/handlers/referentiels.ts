// ─── Handlers locaux : Breeders, Fournisseurs, Variétés ───────────────────────
// Miroir de backend/app/routers/{breeders,fournisseurs,varietes}.py
import { route, LocalHttpError } from '../router'
import { query, one, oneOr404, count, insert, updateById, run } from '../helpers'

// ── Breeders ──────────────────────────────────────────────────────────────────

route('GET', '/breeders', async () => ({ data: await query('SELECT * FROM "Breeder"') }))

route('GET', '/breeders/:id', async ({ params }) => ({
  data: await oneOr404('SELECT * FROM "Breeder" WHERE id_breeder = ?', [params.id], 'Breeder non trouvé'),
}))

route('POST', '/breeders', async ({ body }) => {
  const b = body as Record<string, unknown>
  const id = await insert('Breeder', {
    nom_breeder: b.nom_breeder,
    origine_breeder: b.origine_breeder ?? null,
    information_breeder: b.information_breeder ?? null,
  })
  return { data: await one('SELECT * FROM "Breeder" WHERE id_breeder = ?', [id]) }
})

route('PUT', '/breeders/:id', async ({ params, body }) => {
  await oneOr404('SELECT * FROM "Breeder" WHERE id_breeder = ?', [params.id], 'Breeder non trouvé')
  const b = body as Record<string, unknown>
  await updateById('Breeder', 'id_breeder', params.id, {
    nom_breeder: b.nom_breeder,
    origine_breeder: b.origine_breeder ?? null,
    information_breeder: b.information_breeder ?? null,
  })
  return { data: await one('SELECT * FROM "Breeder" WHERE id_breeder = ?', [params.id]) }
})

route('DELETE', '/breeders/:id', async ({ params }) => {
  await oneOr404('SELECT * FROM "Breeder" WHERE id_breeder = ?', [params.id], 'Breeder non trouvé')
  const nb = await count('SELECT COUNT(*) AS n FROM "Graine" WHERE id_breeder = ?', [params.id])
  if (nb) throw new LocalHttpError(400, `Breeder lié à ${nb} graine(s), suppression bloquée`)
  await run('DELETE FROM "Breeder" WHERE id_breeder = ?', [params.id])
  return { data: { message: 'Breeder supprimé' } }
})

// ── Fournisseurs ──────────────────────────────────────────────────────────────

route('GET', '/fournisseurs', async () => ({
  data: await query('SELECT * FROM "Fournisseur" ORDER BY nom_fournisseur'),
}))

route('GET', '/fournisseurs/:id', async ({ params }) => ({
  data: await oneOr404('SELECT * FROM "Fournisseur" WHERE id_fournisseur = ?', [params.id], 'Fournisseur non trouvé'),
}))

route('POST', '/fournisseurs', async ({ body }) => {
  const b = body as Record<string, unknown>
  const id = await insert('Fournisseur', {
    nom_fournisseur: b.nom_fournisseur,
    site_web: b.site_web ?? null,
  })
  return { data: await one('SELECT * FROM "Fournisseur" WHERE id_fournisseur = ?', [id]) }
})

route('PUT', '/fournisseurs/:id', async ({ params, body }) => {
  await oneOr404('SELECT * FROM "Fournisseur" WHERE id_fournisseur = ?', [params.id], 'Fournisseur non trouvé')
  const b = body as Record<string, unknown>
  await updateById('Fournisseur', 'id_fournisseur', params.id, {
    nom_fournisseur: b.nom_fournisseur,
    site_web: b.site_web ?? null,
  })
  return { data: await one('SELECT * FROM "Fournisseur" WHERE id_fournisseur = ?', [params.id]) }
})

route('DELETE', '/fournisseurs/:id', async ({ params }) => {
  await oneOr404('SELECT * FROM "Fournisseur" WHERE id_fournisseur = ?', [params.id], 'Fournisseur non trouvé')
  await run('DELETE FROM "Fournisseur" WHERE id_fournisseur = ?', [params.id])
  return { data: { message: 'Fournisseur supprimé' } }
})

// ── Variétés ──────────────────────────────────────────────────────────────────

route('GET', '/varietes', async () => ({ data: await query('SELECT * FROM "Variete"') }))

route('GET', '/varietes/:id', async ({ params }) => ({
  data: await oneOr404('SELECT * FROM "Variete" WHERE id_variete = ?', [params.id], 'Variété non trouvée'),
}))

route('POST', '/varietes', async ({ body }) => {
  const b = body as Record<string, unknown>
  const id = await insert('Variete', {
    nom_variete: b.nom_variete,
    croisement_variete: b.croisement_variete ?? null,
    informations_variete: b.informations_variete ?? null,
    lien_web: b.lien_web ?? null,
  })
  return { data: await one('SELECT * FROM "Variete" WHERE id_variete = ?', [id]) }
})

route('PUT', '/varietes/:id', async ({ params, body }) => {
  await oneOr404('SELECT * FROM "Variete" WHERE id_variete = ?', [params.id], 'Variété non trouvée')
  const b = body as Record<string, unknown>
  await updateById('Variete', 'id_variete', params.id, {
    nom_variete: b.nom_variete,
    croisement_variete: b.croisement_variete ?? null,
    informations_variete: b.informations_variete ?? null,
    lien_web: b.lien_web ?? null,
  })
  return { data: await one('SELECT * FROM "Variete" WHERE id_variete = ?', [params.id]) }
})

route('DELETE', '/varietes/:id', async ({ params }) => {
  const id = params.id
  await oneOr404('SELECT * FROM "Variete" WHERE id_variete = ?', [id], 'Variété non trouvée')

  // FK non-nullables : bloquer si des enregistrements existent
  const nbGraines = await count('SELECT COUNT(*) AS n FROM "Graine" WHERE id_variete = ?', [id])
  if (nbGraines) {
    throw new LocalHttpError(409,
      `Impossible de supprimer : ${nbGraines} graine(s) référencent cette variété. Supprimez ou réassignez-les d'abord.`)
  }
  const nbStocks = await count('SELECT COUNT(*) AS n FROM "Stock" WHERE id_variete = ?', [id])
  if (nbStocks) {
    throw new LocalHttpError(409,
      `Impossible de supprimer : ${nbStocks} entrée(s) de stock référencent cette variété. Supprimez ou réassignez-les d'abord.`)
  }

  // FK nullables : mettre à NULL avant suppression
  await run('UPDATE "Croisement" SET id_variete_mere = NULL WHERE id_variete_mere = ?', [id])
  await run('UPDATE "Croisement" SET id_variete_pere = NULL WHERE id_variete_pere = ?', [id])
  await run('UPDATE "Croisement" SET id_variete_resultat = NULL WHERE id_variete_resultat = ?', [id])
  await run('UPDATE "Pollen" SET id_variete_source = NULL WHERE id_variete_source = ?', [id])
  await run('UPDATE "HistoriquePlant" SET id_variete = NULL WHERE id_variete = ?', [id])
  await run('UPDATE "HashExtraction" SET id_variete = NULL WHERE id_variete = ?', [id])

  await run('DELETE FROM "Variete" WHERE id_variete = ?', [id])
  return { data: { message: 'Variété supprimée' } }
})
