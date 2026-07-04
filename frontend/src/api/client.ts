import axios from 'axios'

// ── URL serveur configurable (PWA / app mobile Capacitor) ────────────────────
// Vide (défaut) = même origine que le frontend → '/api' (web classique, rien ne change).
// Renseignée = app mobile pointant vers un serveur distant → '<url>/api'.
const SERVER_URL_KEY = 'gm_server_url'

/** URL du serveur configurée (sans slash final), ou '' si même origine. */
export function getServerUrl(): string {
  try {
    return localStorage.getItem(SERVER_URL_KEY) ?? ''
  } catch {
    return ''
  }
}

/** Enregistre l'URL serveur ('' ou null → retour à la même origine). Recharger l'app ensuite. */
export function setServerUrl(url: string | null) {
  const clean = (url ?? '').trim().replace(/\/+$/, '')
  if (clean) localStorage.setItem(SERVER_URL_KEY, clean)
  else localStorage.removeItem(SERVER_URL_KEY)
}

/** Base URL de l'API selon la config courante. */
export function apiBaseURL(): string {
  const s = getServerUrl()
  return s ? `${s}/api` : '/api'
}

/** Base URL pour les fichiers statiques servis par le backend (ex: /uploads/...). */
export function serverFileURL(path: string): string {
  const s = getServerUrl()
  if (!path.startsWith('/')) path = `/${path}`
  return s ? `${s}${path}` : path
}

/** Teste la connexion à un serveur GrowManager (GET <url>/health). */
export async function testServerConnection(url: string): Promise<boolean> {
  const clean = url.trim().replace(/\/+$/, '')
  if (!clean) return false
  try {
    const res = await axios.get(`${clean}/health`, { timeout: 5000 })
    return res.data?.status === 'ok'
  } catch {
    return false
  }
}

const client = axios.create({
  baseURL: apiBaseURL(),
  headers: {
    'Content-Type': 'application/json',
  },
})

// Intercepteur pour les erreurs
client.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('Erreur API:', error.response?.data || error.message)
    return Promise.reject(error)
  }
)

export default client
