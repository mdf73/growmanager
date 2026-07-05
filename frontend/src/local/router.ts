// ─── Routeur du backend local (mode standalone) ──────────────────────────────
// Réimplémente le contrat REST de l'API FastAPI, route par route, en TypeScript.
// Les routes non encore portées répondent 501 (voir adapter.ts).

export interface LocalContext {
  method: string
  path: string
  params: Record<string, string>
  query: URLSearchParams
  body: unknown
}

export interface LocalResponse {
  status?: number // défaut 200
  data?: unknown
}

export type LocalHandler = (ctx: LocalContext) => Promise<LocalResponse> | LocalResponse

interface RouteDef {
  method: string
  pattern: RegExp
  keys: string[]
  handler: LocalHandler
}

const routes: RouteDef[] = []

/** Enregistre une route locale. Chemin style '/cultures/:id/plants' (sans préfixe /api).
 * Les paramètres nommés id* ou *_id ne matchent que des chiffres (évite que '/cultures/pots'
 * soit avalé par '/cultures/:id' — comme la validation int de FastAPI). */
export function route(method: string, path: string, handler: LocalHandler): void {
  const keys: string[] = []
  const pattern = new RegExp(
    '^' + path.replace(/:[^/]+/g, (m) => {
      const key = m.slice(1)
      keys.push(key)
      return key === 'id' || key.startsWith('id_') || key.endsWith('_id') ? '(\\d+)' : '([^/]+)'
    }) + '/?$'
  )
  routes.push({ method: method.toUpperCase(), pattern, keys, handler })
}

/** Erreur HTTP à lancer depuis un handler (équivalent HTTPException FastAPI). */
export class LocalHttpError extends Error {
  status: number
  detail: string
  constructor(status: number, detail: string) {
    super(detail)
    this.status = status
    this.detail = detail
  }
}

/** Résout et exécute la route correspondante. null si aucune route ne matche. */
export async function dispatch(
  method: string,
  path: string,
  query: URLSearchParams,
  body: unknown
): Promise<LocalResponse | null> {
  const m = method.toUpperCase()
  for (const r of routes) {
    if (r.method !== m) continue
    const match = r.pattern.exec(path)
    if (!match) continue
    const params: Record<string, string> = {}
    r.keys.forEach((k, i) => { params[k] = decodeURIComponent(match[i + 1]) })
    try {
      return await r.handler({ method: m, path, params, query, body })
    } catch (e) {
      if (e instanceof LocalHttpError) return { status: e.status, data: { detail: e.detail } }
      throw e
    }
  }
  return null
}

// ─── Routes de base (sprint B0) ───────────────────────────────────────────────

// GET /health — équivalent du /health du serveur, permet le badge "connecté".
route('GET', '/health', () => ({ data: { status: 'ok', mode: 'standalone' } }))
