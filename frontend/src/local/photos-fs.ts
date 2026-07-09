// ─── Stockage local des photos (mode standalone, Capacitor Filesystem) ────────
// Les fichiers sont stockés dans Directory.Data/photos/<uuid>.<ext> ;
// la DB conserve le chemin relatif 'photos/<nom>' (même convention que le backend).
import { Capacitor } from '@capacitor/core'
import { Filesystem, Directory } from '@capacitor/filesystem'

let baseUri: string | null = null
let initPromise: Promise<void> | null = null

/** Initialise le dossier photos et met en cache l'URI de base (pour photoUrl synchrone). */
export function initPhotosDir(): Promise<void> {
  if (initPromise) return initPromise
  initPromise = (async () => {
    try {
      await Filesystem.mkdir({ path: 'photos', directory: Directory.Data, recursive: true })
    } catch {
      /* existe déjà */
    }
    const uri = await Filesystem.getUri({ path: '', directory: Directory.Data })
    baseUri = uri.uri.replace(/\/+$/, '')
  })()
  return initPromise
}

/** URL affichable dans un <img> pour un chemin relatif DB ('photos/xxx.jpg'). */
export function localPhotoUrl(relPath: string): string {
  if (!baseUri) {
    // Init pas encore terminée — déclenche-la pour les prochains rendus
    void initPhotosDir()
    return ''
  }
  const clean = relPath.replace(/^\/+/, '')
  return Capacitor.convertFileSrc(`${baseUri}/${clean}`)
}

function uuid(): string {
  return 'xxxxxxxxxxxx4xxxyxxxxxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16)
  })
}

function safeExt(name: string): string {
  const m = /\.(jpe?g|png|webp|heic)$/i.exec(name)
  return m ? m[0].toLowerCase().replace('.jpeg', '.jpg') : '.jpg'
}

function fileToDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result))
    r.onerror = () => reject(r.error)
    r.readAsDataURL(file)
  })
}

async function imageDimensions(file: Blob): Promise<{ w: number | null; h: number | null }> {
  try {
    const bmp = await createImageBitmap(file)
    const dims = { w: bmp.width, h: bmp.height }
    bmp.close()
    return dims
  } catch {
    return { w: null, h: null }
  }
}

export interface SavedPhoto {
  filename: string
  filepath: string       // relatif : 'photos/<nom>'
  taille_ko: number
  largeur_px: number | null
  hauteur_px: number | null
}

/** Écrit le fichier photo dans Directory.Data/photos et retourne ses métadonnées.
 * Pas de compression ni de thumbnail en standalone v1 (le fichier original est conservé). */
export async function savePhotoFile(file: File): Promise<SavedPhoto> {
  await initPhotosDir()
  const filename = `${uuid()}${safeExt(file.name || 'photo.jpg')}`
  const dataUrl = await fileToDataUrl(file)
  const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1)
  await Filesystem.writeFile({
    path: `photos/${filename}`,
    directory: Directory.Data,
    data: base64,
    recursive: true,
  })
  const { w, h } = await imageDimensions(file)
  return {
    filename,
    filepath: `photos/${filename}`,
    taille_ko: Math.floor(file.size / 1024),
    largeur_px: w,
    hauteur_px: h,
  }
}

/** Supprime un fichier photo (chemin relatif DB). Silencieux si absent. */
export async function deletePhotoFile(relPath: string | null | undefined): Promise<void> {
  if (!relPath) return
  try {
    await Filesystem.deleteFile({ path: relPath.replace(/^\/+/, ''), directory: Directory.Data })
  } catch {
    /* déjà supprimé */
  }
}
