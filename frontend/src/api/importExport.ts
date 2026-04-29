export type ImportTarget = 'breeders' | 'varietes' | 'packs' | 'stock' | 'extractions' | 'extractions-hash' | 'historique-cultures' | 'materiel' | 'engrais'

export interface ImportResult {
  created: number
  skipped: number
  errors?: string[]
}

/** Déclenche le téléchargement d'un export CSV via une balise <a> */
export function triggerExport(target: ImportTarget) {
  const urls: Record<ImportTarget, string> = {
    breeders:              '/api/export/breeders',
    varietes:              '/api/export/varietes',
    packs:                 '/api/export/packs',
    stock:                 '/api/export/stock',
    extractions:           '/api/export/extractions',
    'extractions-hash':    '/api/export/extractions-hash',
    'historique-cultures': '/api/export/historique-cultures',
    'materiel':            '/api/export/materiel',
    'engrais':             '/api/export/engrais',
  }
  const a = document.createElement('a')
  a.href = urls[target]
  a.download = ''
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
}

/** Envoie un fichier CSV au backend pour import.
 *  Utilise fetch natif (pas Axios) pour éviter que le header
 *  Content-Type: application/json du client Axios n'écrase
 *  le boundary multipart généré par le navigateur.
 */
export async function importCSV(target: ImportTarget, file: File): Promise<ImportResult> {
  const urls: Record<ImportTarget, string> = {
    breeders:              '/api/import/breeders',
    varietes:              '/api/import/varietes',
    packs:                 '/api/import/packs',
    stock:                 '/api/import/stock',
    extractions:           '/api/import/extractions',
    'extractions-hash':    '/api/import/extractions-hash',
    'historique-cultures': '/api/import/historique-cultures',
    'materiel':            '/api/import/materiel',
    'engrais':             '/api/import/engrais',
  }
  const formData = new FormData()
  formData.append('file', file)
  // fetch avec FormData : le navigateur pose lui-même Content-Type + boundary
  const response = await fetch(urls[target], { method: 'POST', body: formData })
  if (!response.ok) {
    const text = await response.text()
    throw new Error(`${response.status}: ${text}`)
  }
  return response.json() as Promise<ImportResult>
}
