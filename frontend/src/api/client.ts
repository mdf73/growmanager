import axios from 'axios'
import { localAdapter } from '../local/adapter'

// ── URL serveur configurable (PWA / app mobile Capacitor) ────────────────────
// Vide (défaut) = même origine que le frontend → '/api' (web classique, rien ne change).
// Renseignée = app mobile pointant vers un serveur distant → '<url>/api'.
const SERVER_URL_KEY = 'gm_server_url'

// ── Mode de fonctionnement (app mobile) ──────────────────────────────────────
// 'server'     = l'app parle à un serveur GrowManager local/distant (Phase A).
// 'standalone' = données 100% locales sur l'appareil, SQLite embarqué (Phase B).
// null         = pas encore choisi → écran ModeSetup au premier lancement natif.
const MODE_KEY = 'gm_mode'

export type AppMode = 'server' | 'standalone'

/** True si l'app tourne dans le runtime natif Capacitor (APK Android). */
export function isNativeApp(): boolean {
  const cap = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor
  return !!cap?.isNativePlatform?.()
}

/** Mode courant, ou null si pas encore choisi. Rétro-compat Phase A : URL serveur déjà configurée → 'server'. */
export function getAppMode(): AppMode | null {
  try {
    const m = localStorage.getItem(MODE_KEY)
    if (m === 'server' || m === 'standalone') return m
    return getServerUrl() ? 'server' : null
  } catch {
    return null
  }
}

/** Enregistre le mode (null → efface, réaffiche ModeSetup au prochain lancement). Recharger l'app ensuite. */
export function setAppMode(mode: AppMode | null) {
  if (mode) localStorage.setItem(MODE_KEY, mode)
  else localStorage.removeItem(MODE_KEY)
}

/** True si l'app fonctionne en mode autonome (backend local SQLite). */
export function isStandalone(): boolean {
  return getAppMode() === 'standalone'
}

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
  // Mode autonome : les requêtes sont servies par le backend local (SQLite), pas par le réseau.
  ...(isStandalone() ? { adapter: localAdapter } : {}),
})

// Certains fichiers src/api/ utilisent l'axios global ('/api/...') au lieu de ce client :
// en standalone, on branche aussi l'adapter local sur axios.defaults (les URLs absolues
// http(s):// passent quand même par le vrai réseau — voir adapter.ts).
if (isStandalone()) {
  axios.defaults.adapter = localAdapter
  // Prépare le dossier photos local + met en cache l'URI de base pour photoUrl()
  if (isNativeApp()) {
    import('../local/photos-fs').then(m => m.initPhotosDir()).catch(() => undefined)
  }
}

// Intercepteur pour les erreurs
client.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('Erreur API:', error.response?.data || error.message)
    return Promise.reject(error)
  }
)

export default client
