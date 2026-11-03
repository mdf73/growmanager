// ─── Handlers locaux : Photos (galerie) ───────────────────────────────────────
// Miroir de backend/app/routers/photos.py — stockage via Capacitor Filesystem.
// Différence v1 standalone : pas de compression ni de thumbnail (original conservé,
// thumbnail_path = filepath).
import { route, LocalHttpError } from '../router'
import { query, one, oneOr404, insert, run, count } from '../helpers'
import { savePhotoFile, deletePhotoFile } from '../photos-fs'

type Row = Record<string, unknown>

/** Miroir de _sync_photo_action (backend) : une action 📷 « photo » par
 *  (culture, plante ou culture entière, jour), parametres.nb_photos = nb de photos du jour. */
async function syncPhotoAction(idCulture: number | null, idPlant: number | null, jour: string): Promise<void> {
  if (idCulture === null && idPlant !== null) {
    const pl = await one<Row>('SELECT id_culture FROM "Plant" WHERE id_plant = ?', [idPlant])
    idCulture = pl?.id_culture != null ? Number(pl.id_culture) : null
  }
  if (idCulture === null) return

  const nb = idPlant !== null
    ? await count('SELECT COUNT(*) AS n FROM "Photo" WHERE id_plant = ? AND substr(date_prise, 1, 10) = ?', [idPlant, jour])
    : await count('SELECT COUNT(*) AS n FROM "Photo" WHERE id_culture = ? AND id_plant IS NULL AND substr(date_prise, 1, 10) = ?', [idCulture, jour])

  const actions = idPlant !== null
    ? await query<Row>(`SELECT * FROM "ActionCalendrier" WHERE id_culture = ? AND type_action = 'photo' AND date_action = ? AND id_plant = ? ORDER BY id_action`, [idCulture, jour, idPlant])
    : await query<Row>(`SELECT * FROM "ActionCalendrier" WHERE id_culture = ? AND type_action = 'photo' AND date_action = ? AND id_plant IS NULL ORDER BY id_action`, [idCulture, jour])

  if (nb === 0) {
    for (const a of actions) await run('DELETE FROM "ActionCalendrier" WHERE id_action = ?', [a.id_action])
    return
  }
  if (actions.length) {
    const [principale, ...doublons] = actions
    let prev: Row = {}
    try { prev = typeof principale.parametres === 'string' ? JSON.parse(principale.parametres) : ((principale.parametres as Row) ?? {}) } catch { prev = {} }
    await run('UPDATE "ActionCalendrier" SET parametres = ? WHERE id_action = ?', [JSON.stringify({ ...prev, nb_photos: nb }), principale.id_action])
    for (const a of doublons) await run('DELETE FROM "ActionCalendrier" WHERE id_action = ?', [a.id_action])
  } else {
    await insert('ActionCalendrier', {
      id_culture: idCulture,
      id_plant: idPlant,
      date_action: jour,
      type_action: 'photo',
      parametres: { nb_photos: nb, auto: true },
      global_culture: idPlant === null,
      created_at: new Date().toISOString(),
    })
  }
}

route('GET', '/photos', async ({ query: q }) => {
  let sql = 'SELECT * FROM "Photo"'
  const where: string[] = []
  const vals: unknown[] = []
  if (q.get('id_culture') !== null) { where.push('id_culture = ?'); vals.push(Number(q.get('id_culture'))) }
  if (q.get('id_plant') !== null) { where.push('id_plant = ?'); vals.push(Number(q.get('id_plant'))) }
  const date = q.get('date')
  if (date) { where.push('date_prise LIKE ?'); vals.push(`${date.trim()}%`) }
  const dateDebut = q.get('date_debut')
  if (dateDebut) { where.push('date_prise >= ?'); vals.push(`${dateDebut.trim()}T00:00:00`) }
  const dateFin = q.get('date_fin')
  if (dateFin) { where.push('date_prise <= ?'); vals.push(`${dateFin.trim()}T23:59:59`) }
  if (where.length) sql += ' WHERE ' + where.join(' AND ')
  sql += ' ORDER BY date_prise DESC'
  return { data: await query(sql, vals) }
})

route('POST', '/photos/upload', async ({ body }) => {
  if (!(body instanceof FormData)) {
    throw new LocalHttpError(400, 'Upload attendu en multipart/form-data')
  }
  const file = body.get('file')
  if (!(file instanceof File) || file.size === 0) {
    throw new LocalHttpError(400, 'Fichier vide')
  }

  const saved = await savePhotoFile(file)

  // Résolution de la date (comme le backend : jour seul → midi)
  const rawDate = body.get('date_prise')
  let datePrise: string
  if (typeof rawDate === 'string' && rawDate.trim()) {
    const clean = rawDate.trim()
    datePrise = clean.includes('T') ? clean : `${clean}T12:00:00`
  } else {
    datePrise = new Date().toISOString()
  }

  const idCulture = body.get('id_culture')
  const idPlant = body.get('id_plant')
  const notes = body.get('notes')

  const idPlantNum = idPlant !== null && idPlant !== undefined && String(idPlant) !== '' ? Number(idPlant) : null
  const idCultureNum = idCulture !== null && idCulture !== undefined && String(idCulture) !== '' ? Number(idCulture) : null

  const id = await insert('Photo', {
    filename: saved.filename,
    filepath: saved.filepath,
    thumbnail_path: saved.filepath, // pas de thumbnail dédié en standalone v1
    date_prise: datePrise,
    notes: typeof notes === 'string' && notes ? notes : null,
    id_plant: idPlantNum,
    id_culture: idCultureNum,
    taille_ko: saved.taille_ko,
    largeur_px: saved.largeur_px,
    hauteur_px: saved.hauteur_px,
    created_at: new Date().toISOString(),
  })
  await syncPhotoAction(idCultureNum, idPlantNum, datePrise.slice(0, 10))
  return { status: 201, data: await one('SELECT * FROM "Photo" WHERE id_photo = ?', [id]) }
})

route('DELETE', '/photos/:id', async ({ params }) => {
  const photo = await oneOr404<Row>('SELECT * FROM "Photo" WHERE id_photo = ?', [params.id], 'Photo introuvable')
  await deletePhotoFile(photo.filepath as string)
  if (photo.thumbnail_path && photo.thumbnail_path !== photo.filepath) {
    await deletePhotoFile(photo.thumbnail_path as string)
  }
  await run('DELETE FROM "Photo" WHERE id_photo = ?', [params.id])
  if (photo.date_prise) {
    await syncPhotoAction(
      photo.id_culture != null ? Number(photo.id_culture) : null,
      photo.id_plant != null ? Number(photo.id_plant) : null,
      String(photo.date_prise).slice(0, 10),
    )
  }
  return { status: 204 }
})
