// ─── Handlers locaux : Graine, PackGraine, Catalogue ──────────────────────────
// Miroir de backend/app/routers/graines.py
import { route } from '../router'
import { query, one, oneOr404, count, insert, updateById, run, boolify } from '../helpers'

type Row = Record<string, unknown>

const GRAINE_BOOLS = ['edition_limite', 'utilisee']

async function graineEnrichie(row: Row): Promise<Row> {
  boolify(row, GRAINE_BOOLS)
  const breeder = row.id_breeder
    ? await one('SELECT * FROM "Breeder" WHERE id_breeder = ?', [row.id_breeder]) : null
  const variete = row.id_variete
    ? await one('SELECT * FROM "Variete" WHERE id_variete = ?', [row.id_variete]) : null
  return { ...row, breeder, variete }
}

// ── Packs ─────────────────────────────────────────────────────────────────────
// NB : '/packs/complet' enregistré avant '/packs/:id'.

route('GET', '/packs', async () => ({ data: await query('SELECT * FROM "PackGraine"') }))

route('POST', '/packs/complet', async ({ body }) => {
  const p = body as Row
  const breeder = await oneOr404<Row>('SELECT * FROM "Breeder" WHERE id_breeder = ?',
    [p.id_breeder], 'Breeder non trouvé')
  const variete = await oneOr404<Row>('SELECT * FROM "Variete" WHERE id_variete = ?',
    [p.id_variete], 'Variété non trouvée')

  if (p.croisement_variete !== null && p.croisement_variete !== undefined) {
    await run('UPDATE "Variete" SET croisement_variete = ? WHERE id_variete = ?',
      [p.croisement_variete, p.id_variete])
  }

  const nbr = Number(p.nbr_graines)
  const idPack = await insert('PackGraine', {
    id_fournisseur: p.id_fournisseur ?? null,
    nbr_graines: nbr,
    prix_achat: p.prix_achat ?? null,
    date_achat: p.date_achat ?? null,
  })

  const prixParGraine = p.prix_achat && nbr > 0 ? Number(p.prix_achat) / nbr : null
  for (let i = 0; i < nbr; i++) {
    await insert('Graine', {
      id_breeder: p.id_breeder,
      id_variete: p.id_variete,
      id_packgraine: idPack,
      types_graines: p.types_graines ?? null,
      duree_flo_min: p.duree_flo_min ?? null,
      duree_flo_max: p.duree_flo_max ?? null,
      prix_achat: prixParGraine,
      edition_limite: !!p.edition_limite,
      date_achat: p.date_achat ?? null,
      utilisee: false,
    })
  }

  return {
    data: {
      id_packgraine: idPack,
      nbr_graines: nbr,
      nbr_graines_crees: nbr,
      breeder_nom: breeder.nom_breeder,
      variete_nom: variete.nom_variete,
    },
  }
})

route('GET', '/packs/:id', async ({ params }) => ({
  data: await oneOr404('SELECT * FROM "PackGraine" WHERE id_packgraine = ?', [params.id], 'Pack non trouvé'),
}))

route('GET', '/packs/:id/graines', async ({ params }) => {
  await oneOr404('SELECT * FROM "PackGraine" WHERE id_packgraine = ?', [params.id], 'Pack non trouvé')
  const rows = await query<Row>(
    'SELECT id_graine, utilisee FROM "Graine" WHERE id_packgraine = ? ORDER BY id_graine', [params.id])
  return { data: rows.map(r => boolify(r, ['utilisee'])) }
})

route('POST', '/packs', async ({ body }) => {
  const p = body as Row
  const id = await insert('PackGraine', {
    id_fournisseur: p.id_fournisseur ?? null,
    nbr_graines: p.nbr_graines,
    prix_achat: p.prix_achat ?? null,
    date_achat: p.date_achat ?? null,
  })
  return { data: await one('SELECT * FROM "PackGraine" WHERE id_packgraine = ?', [id]) }
})

route('PUT', '/packs/:id/complet', async ({ params, body }) => {
  const packId = Number(params.id)
  const p = body as Row
  await oneOr404('SELECT * FROM "PackGraine" WHERE id_packgraine = ?', [packId], 'Pack non trouvé')
  const breeder = await oneOr404<Row>('SELECT * FROM "Breeder" WHERE id_breeder = ?',
    [p.id_breeder], 'Breeder non trouvé')
  const variete = await oneOr404<Row>('SELECT * FROM "Variete" WHERE id_variete = ?',
    [p.id_variete], 'Variété non trouvée')

  if (p.croisement_variete !== null && p.croisement_variete !== undefined) {
    await run('UPDATE "Variete" SET croisement_variete = ? WHERE id_variete = ?',
      [p.croisement_variete, p.id_variete])
  }

  await updateById('PackGraine', 'id_packgraine', packId, {
    id_fournisseur: p.id_fournisseur ?? null,
    prix_achat: p.prix_achat ?? null,
    date_achat: p.date_achat ?? null,
  })

  // Màj métadonnées de toutes les graines du pack
  await run(
    `UPDATE "Graine" SET id_breeder = ?, id_variete = ?, types_graines = ?,
     duree_flo_min = ?, duree_flo_max = ?, edition_limite = ?
     WHERE id_packgraine = ?`,
    [p.id_breeder, p.id_variete, p.types_graines ?? null,
     p.duree_flo_min ?? null, p.duree_flo_max ?? null, p.edition_limite ? 1 : 0, packId])

  // Ajustement du nombre de graines
  if (p.nbr_graines !== null && p.nbr_graines !== undefined && Number(p.nbr_graines) > 0) {
    const newTotal = Number(p.nbr_graines)
    const currentTotal = await count('SELECT COUNT(*) AS n FROM "Graine" WHERE id_packgraine = ?', [packId])

    if (newTotal > currentTotal) {
      const prixParGraine = p.prix_achat && newTotal > 0 ? Number(p.prix_achat) / newTotal : null
      for (let i = 0; i < newTotal - currentTotal; i++) {
        await insert('Graine', {
          id_breeder: p.id_breeder,
          id_variete: p.id_variete,
          id_packgraine: packId,
          types_graines: p.types_graines ?? null,
          duree_flo_min: p.duree_flo_min ?? null,
          duree_flo_max: p.duree_flo_max ?? null,
          prix_achat: prixParGraine,
          edition_limite: !!p.edition_limite,
          date_achat: p.date_achat ?? null,
          utilisee: false,
        })
      }
    } else if (newTotal < currentTotal) {
      // Supprimer des graines — non-utilisées en premier, puis utilisées si besoin
      let toRemove = currentTotal - newTotal
      const nonUtilisees = await query<Row>(
        `SELECT id_graine FROM "Graine" WHERE id_packgraine = ? AND (utilisee = 0 OR utilisee IS NULL)
         ORDER BY id_graine DESC LIMIT ?`, [packId, toRemove])
      for (const g of nonUtilisees) {
        await run('DELETE FROM "Graine" WHERE id_graine = ?', [g.id_graine])
        toRemove--
      }
      if (toRemove > 0) {
        const utilisees = await query<Row>(
          `SELECT id_graine FROM "Graine" WHERE id_packgraine = ? AND utilisee = 1
           ORDER BY id_graine DESC LIMIT ?`, [packId, toRemove])
        for (const g of utilisees) {
          await run('DELETE FROM "Graine" WHERE id_graine = ?', [g.id_graine])
        }
      }
    }
    await run('UPDATE "PackGraine" SET nbr_graines = ? WHERE id_packgraine = ?', [newTotal, packId])
  }

  const pack = await one<Row>('SELECT * FROM "PackGraine" WHERE id_packgraine = ?', [packId])
  const finalCount = await count('SELECT COUNT(*) AS n FROM "Graine" WHERE id_packgraine = ?', [packId])
  return {
    data: {
      id_packgraine: packId,
      nbr_graines: pack?.nbr_graines,
      nbr_graines_crees: finalCount,
      breeder_nom: breeder.nom_breeder,
      variete_nom: variete.nom_variete,
    },
  }
})

route('DELETE', '/packs/:id', async ({ params }) => {
  await oneOr404('SELECT * FROM "PackGraine" WHERE id_packgraine = ?', [params.id], 'Pack non trouvé')
  await run('UPDATE "Croisement" SET id_packgraine_resultat = NULL WHERE id_packgraine_resultat = ?', [params.id])
  await run('DELETE FROM "Graine" WHERE id_packgraine = ?', [params.id])
  await run('DELETE FROM "PackGraine" WHERE id_packgraine = ?', [params.id])
  return { data: { message: 'Pack supprimé' } }
})

// ── Graines individuelles ─────────────────────────────────────────────────────

route('GET', '/graines', async () => {
  const rows = await query<Row>('SELECT * FROM "Graine"')
  return { data: await Promise.all(rows.map(graineEnrichie)) }
})

route('GET', '/graines/:id', async ({ params }) => ({
  data: await graineEnrichie(
    await oneOr404('SELECT * FROM "Graine" WHERE id_graine = ?', [params.id], 'Graine non trouvée')),
}))

route('POST', '/graines', async ({ body }) => {
  const g = body as Row
  const id = await insert('Graine', {
    id_breeder: g.id_breeder,
    id_variete: g.id_variete,
    id_packgraine: g.id_packgraine,
    duree_flo_min: g.duree_flo_min ?? null,
    duree_flo_max: g.duree_flo_max ?? null,
    types_graines: g.types_graines ?? null,
    prix_achat: g.prix_achat ?? null,
    edition_limite: !!g.edition_limite,
    date_achat: g.date_achat ?? null,
    utilisee: !!g.utilisee,
  })
  const row = await one<Row>('SELECT * FROM "Graine" WHERE id_graine = ?', [id])
  return { data: await graineEnrichie(row!) }
})

route('PUT', '/graines/:id', async ({ params, body }) => {
  await oneOr404('SELECT * FROM "Graine" WHERE id_graine = ?', [params.id], 'Graine non trouvée')
  const g = body as Row
  await updateById('Graine', 'id_graine', params.id, {
    id_breeder: g.id_breeder,
    id_variete: g.id_variete,
    id_packgraine: g.id_packgraine,
    duree_flo_min: g.duree_flo_min ?? null,
    duree_flo_max: g.duree_flo_max ?? null,
    types_graines: g.types_graines ?? null,
    prix_achat: g.prix_achat ?? null,
    edition_limite: !!g.edition_limite,
    date_achat: g.date_achat ?? null,
    utilisee: !!g.utilisee,
  })
  const row = await one<Row>('SELECT * FROM "Graine" WHERE id_graine = ?', [params.id])
  return { data: await graineEnrichie(row!) }
})

route('PATCH', '/graines/:id/toggle', async ({ params }) => {
  const g = await oneOr404<Row>('SELECT * FROM "Graine" WHERE id_graine = ?', [params.id], 'Graine non trouvée')
  const nouvelle = Number(g.utilisee) ? 0 : 1
  await run('UPDATE "Graine" SET utilisee = ? WHERE id_graine = ?', [nouvelle, params.id])
  return { data: { id_graine: Number(params.id), utilisee: !!nouvelle } }
})

route('DELETE', '/graines/:id', async ({ params }) => {
  await oneOr404('SELECT * FROM "Graine" WHERE id_graine = ?', [params.id], 'Graine non trouvée')
  await run('DELETE FROM "Graine" WHERE id_graine = ?', [params.id])
  return { data: { message: 'Graine supprimée' } }
})

// ── Catalogue ─────────────────────────────────────────────────────────────────

route('GET', '/catalogue', async () => {
  const packs = await query<Row>('SELECT * FROM "PackGraine"')
  const catalogue: Row[] = []

  for (const pack of packs) {
    const remaining = await count(
      'SELECT COUNT(*) AS n FROM "Graine" WHERE id_packgraine = ? AND (utilisee = 0 OR utilisee IS NULL)',
      [pack.id_packgraine])
    const first = await one<Row>(
      'SELECT * FROM "Graine" WHERE id_packgraine = ? ORDER BY id_graine LIMIT 1',
      [pack.id_packgraine])
    if (!first) continue

    const breeder = first.id_breeder
      ? await one<Row>('SELECT * FROM "Breeder" WHERE id_breeder = ?', [first.id_breeder]) : null
    const variete = first.id_variete
      ? await one<Row>('SELECT * FROM "Variete" WHERE id_variete = ?', [first.id_variete]) : null
    const total = Number(pack.nbr_graines ?? 0)

    catalogue.push({
      id_packgraine: pack.id_packgraine,
      id_fournisseur: pack.id_fournisseur ?? null,
      id_breeder: first.id_breeder ?? null,
      id_variete: first.id_variete ?? null,
      breeder_nom: breeder?.nom_breeder ?? 'Inconnu',
      variete_nom: variete?.nom_variete ?? 'Inconnue',
      croisement_variete: variete?.croisement_variete ?? null,
      lien_web: variete?.lien_web ?? null,
      type_graines: first.types_graines ?? null,
      duree_flo_min: first.duree_flo_min ?? null,
      duree_flo_max: first.duree_flo_max ?? null,
      prix_par_graine: pack.prix_achat && total ? Number(pack.prix_achat) / total : null,
      nbr_graines_total: total,
      nbr_graines_restantes: remaining,
      paquet_ouvert: remaining < total,
      edition_limite: !!Number(first.edition_limite ?? 0),
      date_achat: pack.date_achat ?? null,
    })
  }
  return { data: catalogue }
})

