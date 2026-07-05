// ─── Handlers locaux : EspaceCulture + EspaceMateriel ─────────────────────────
// Miroir de backend/app/routers/espaces.py (export/import CSV → non portés, 501)
import { route } from '../router'
import { query, one, oneOr404, insert, updateById, run } from '../helpers'

type Row = Record<string, unknown>

async function enrichEquipements(idEspace: unknown): Promise<Row[]> {
  return query(
    `SELECT em.id_espace_materiel, em.id_materiel, em.date_assignation, em.notes,
            m.nom AS nom_materiel, m.categorie, m.marque, m.etat
     FROM "EspaceMateriel" em
     LEFT JOIN "Materiel" m ON m.id_materiel = em.id_materiel
     WHERE em.id_espace = ?`, [idEspace])
}

async function enrich(esp: Row): Promise<Row> {
  let nomMp: unknown = null
  if (esp.id_materiel_principal) {
    const m = await one<Row>('SELECT nom FROM "Materiel" WHERE id_materiel = ?', [esp.id_materiel_principal])
    nomMp = m?.nom ?? null
  }
  return {
    ...esp,
    surface_m2: esp.surface_m2 !== null && esp.surface_m2 !== undefined ? Number(esp.surface_m2) : null,
    nom_materiel_principal: nomMp,
    equipements: await enrichEquipements(esp.id_espace),
  }
}

// NB : routes spécifiques enregistrées avant '/espaces/:id' (ordre de matching).
route('GET', '/espaces/materiel-en-use', async () => ({
  data: await query(
    `SELECT em.id_materiel, ec.id_espace, ec.nom AS nom_espace
     FROM "EspaceMateriel" em
     JOIN "EspaceCulture" ec ON ec.id_espace = em.id_espace`),
}))

route('GET', '/espaces', async () => {
  const espaces = await query<Row>('SELECT * FROM "EspaceCulture" ORDER BY nom')
  return { data: await Promise.all(espaces.map(enrich)) }
})

route('GET', '/espaces/:id', async ({ params }) => ({
  data: await enrich(await oneOr404('SELECT * FROM "EspaceCulture" WHERE id_espace = ?',
    [params.id], 'Espace de culture introuvable')),
}))

route('POST', '/espaces', async ({ body }) => {
  const b = body as Row
  const id = await insert('EspaceCulture', {
    nom: b.nom,
    type_espace: b.type_espace ?? null,
    id_materiel_principal: b.id_materiel_principal ?? null,
    dimensions: b.dimensions ?? null,
    surface_m2: b.surface_m2 ?? null,
    hauteur_cm: b.hauteur_cm ?? null,
    statut: b.statut ?? 'Actif',
    notes: b.notes ?? null,
  })
  for (const eq of (b.equipements as Row[] | undefined) ?? []) {
    await insert('EspaceMateriel', {
      id_espace: id,
      id_materiel: eq.id_materiel,
      date_assignation: eq.date_assignation ?? null,
      notes: eq.notes ?? null,
    })
  }
  const esp = await one<Row>('SELECT * FROM "EspaceCulture" WHERE id_espace = ?', [id])
  return { status: 201, data: await enrich(esp!) }
})

route('PUT', '/espaces/:id', async ({ params, body }) => {
  await oneOr404('SELECT * FROM "EspaceCulture" WHERE id_espace = ?', [params.id], 'Espace de culture introuvable')
  const b = body as Row
  // Comme le backend : seuls les champs non-null sont mis à jour
  const upd: Row = {}
  for (const f of ['nom', 'type_espace', 'id_materiel_principal', 'dimensions', 'surface_m2', 'hauteur_cm', 'statut', 'notes']) {
    if (b[f] !== null && b[f] !== undefined) upd[f] = b[f]
  }
  await updateById('EspaceCulture', 'id_espace', params.id, upd)
  if (b.equipements !== null && b.equipements !== undefined) {
    await run('DELETE FROM "EspaceMateriel" WHERE id_espace = ?', [params.id])
    for (const eq of b.equipements as Row[]) {
      await insert('EspaceMateriel', {
        id_espace: Number(params.id),
        id_materiel: eq.id_materiel,
        date_assignation: eq.date_assignation ?? null,
        notes: eq.notes ?? null,
      })
    }
  }
  const esp = await one<Row>('SELECT * FROM "EspaceCulture" WHERE id_espace = ?', [params.id])
  return { data: await enrich(esp!) }
})

route('DELETE', '/espaces/:id', async ({ params }) => {
  await oneOr404('SELECT * FROM "EspaceCulture" WHERE id_espace = ?', [params.id], 'Espace de culture introuvable')
  await run('DELETE FROM "EspaceMateriel" WHERE id_espace = ?', [params.id])
  await run('DELETE FROM "EspaceCulture" WHERE id_espace = ?', [params.id])
  return { status: 204 }
})
