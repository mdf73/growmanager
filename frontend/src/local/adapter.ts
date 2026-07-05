// ─── Adapter Axios → backend local (mode standalone) ─────────────────────────
// Branché sur le client Axios (et axios.defaults) quand gm_mode = 'standalone' :
// les appels /api sont interceptés et servis par le routeur local (SQLite embarqué).
// Les URLs absolues (http://…) passent par le vrai réseau (ex: test de connexion serveur).
// Zéro changement dans les pages ni dans les fichiers src/api/*.ts.

import axios, { AxiosError, AxiosHeaders } from 'axios'
import type { AxiosAdapter, AxiosResponse, InternalAxiosRequestConfig } from 'axios'
import { dispatch } from './router'
import './handlers'

function resolvePath(config: InternalAxiosRequestConfig): { path: string; search: URLSearchParams } {
  const raw = `${config.baseURL ?? ''}${config.url ?? ''}`
  const u = new URL(raw, 'http://localhost')
  let path = u.pathname
  if (path.startsWith('/api')) path = path.slice(4) || '/'
  const search = u.searchParams
  // Params Axios (config.params) → fusion dans la query string
  if (config.params) {
    for (const [k, v] of Object.entries(config.params as Record<string, unknown>)) {
      if (v === undefined || v === null) continue
      if (Array.isArray(v)) v.forEach((item) => search.append(k, String(item)))
      else search.append(k, String(v))
    }
  }
  return { path, search }
}

function parseBody(config: InternalAxiosRequestConfig): unknown {
  const d = config.data
  if (d === undefined || d === null) return undefined
  if (typeof d === 'string') {
    try { return JSON.parse(d) } catch { return d }
  }
  return d // FormData & co passés tels quels (photos → sprint B2)
}

export const localAdapter: AxiosAdapter = async (config) => {
  // URL absolue → vraie requête réseau (test /health d'un serveur distant, etc.)
  if (/^https?:\/\//i.test(config.url ?? '')) {
    const real = axios.getAdapter(['xhr', 'fetch', 'http'])
    return real(config)
  }

  const { path, search } = resolvePath(config)
  const method = config.method ?? 'get'
  const result = await dispatch(method, path, search, parseBody(config))

  const status = result === null ? 501 : (result.status ?? 200)
  const data = result === null
    ? { detail: `Route ${method.toUpperCase()} ${path} pas encore disponible en mode autonome (portage en cours — voir roadmap Phase B).` }
    : result.data

  const response: AxiosResponse = {
    data,
    status,
    statusText: status === 501 ? 'Not Implemented' : '',
    headers: {},
    config,
    request: {},
  }

  if (status >= 400) {
    throw new AxiosError(
      `Request failed with status code ${status}`,
      status >= 500 ? AxiosError.ERR_BAD_RESPONSE : AxiosError.ERR_BAD_REQUEST,
      { ...config, headers: config.headers ?? new AxiosHeaders() },
      response.request,
      response
    )
  }
  return response
}
