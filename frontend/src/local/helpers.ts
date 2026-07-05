// ─── Helpers SQL pour les handlers locaux ─────────────────────────────────────
import { query, run } from './db'
import { LocalHttpError } from './router'

export { query, run, LocalHttpError }

type Row = Record<string, unknown>

/** Première ligne ou null. */
export async function one<T = Row>(sql: string, values: unknown[] = []): Promise<T | null> {
  const r = await query<T>(sql, values)
  return r.length ? r[0] : null
}

/** Première ligne ou 404. */
export async function oneOr404<T = Row>(sql: string, values: unknown[], detail: string): Promise<T> {
  const r = await one<T>(sql, values)
  if (!r) throw new LocalHttpError(404, detail)
  return r
}

/** COUNT(*) scalaire. */
export async function count(sql: string, values: unknown[] = []): Promise<number> {
  const r = await one<{ n: number }>(sql, values)
  return Number(r?.n ?? 0)
}

/** INSERT à partir d'un objet {colonne: valeur} (undefined ignorés). Retourne lastId. */
export async function insert(table: string, obj: Row): Promise<number> {
  const entries = Object.entries(obj).filter(([, v]) => v !== undefined)
  const cols = entries.map(([k]) => `"${k}"`).join(', ')
  const marks = entries.map(() => '?').join(', ')
  const vals = entries.map(([, v]) => sqlValue(v))
  const r = await run(`INSERT INTO "${table}" (${cols}) VALUES (${marks})`, vals)
  return r.lastId
}

/** UPDATE ... WHERE idCol = id à partir d'un objet (undefined ignorés). */
export async function updateById(table: string, idCol: string, id: number | string, obj: Row): Promise<void> {
  const entries = Object.entries(obj).filter(([, v]) => v !== undefined)
  if (!entries.length) return
  const sets = entries.map(([k]) => `"${k}" = ?`).join(', ')
  const vals = entries.map(([, v]) => sqlValue(v))
  await run(`UPDATE "${table}" SET ${sets} WHERE "${idCol}" = ?`, [...vals, id])
}

/** Convertit une valeur JS → valeur SQLite (booléens → 0/1, objets → JSON). */
export function sqlValue(v: unknown): unknown {
  if (typeof v === 'boolean') return v ? 1 : 0
  if (v !== null && typeof v === 'object') return JSON.stringify(v)
  return v
}

/** Convertit les colonnes 0/1 d'une ligne en booléens. */
export function boolify<T extends Row>(row: T, fields: string[]): T {
  for (const f of fields) {
    if (f in row && row[f] !== null && row[f] !== undefined) {
      ;(row as Row)[f] = !!Number(row[f])
    }
  }
  return row
}

/** Parse les colonnes JSON (string → objet). */
export function jsonify<T extends Row>(row: T, fields: string[]): T {
  for (const f of fields) {
    const v = row[f]
    if (typeof v === 'string' && v) {
      try { (row as Row)[f] = JSON.parse(v) } catch { /* laisse tel quel */ }
    }
  }
  return row
}

/** Nombre de jours entre une date (YYYY-MM-DD) et aujourd'hui, ou null. */
export function ageJours(d: unknown): number | null {
  if (!d || typeof d !== 'string') return null
  const t = new Date(d + 'T00:00:00')
  if (isNaN(t.getTime())) return null
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return Math.round((today.getTime() - t.getTime()) / 86400000)
}
