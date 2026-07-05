// ─── Base SQLite locale (mode standalone, Capacitor natif uniquement) ────────
import { CapacitorSQLite, SQLiteConnection, SQLiteDBConnection } from '@capacitor-community/sqlite'
import { SCHEMA_STATEMENTS, SCHEMA_VERSION } from './schema'
import { seedDefaults } from './seeds'

const DB_NAME = 'growmanager'

let sqlite: SQLiteConnection | null = null
let db: SQLiteDBConnection | null = null
let opening: Promise<SQLiteDBConnection> | null = null

/** Ouvre (ou retourne) la connexion SQLite locale, en créant le schéma au premier lancement. */
export async function getDb(): Promise<SQLiteDBConnection> {
  if (db) return db
  if (opening) return opening
  opening = (async () => {
    sqlite = sqlite ?? new SQLiteConnection(CapacitorSQLite)
    let conn: SQLiteDBConnection
    const consistency = await sqlite.checkConnectionsConsistency()
    const existing = await sqlite.isConnection(DB_NAME, false)
    if (consistency.result && existing.result) {
      conn = await sqlite.retrieveConnection(DB_NAME, false)
    } else {
      conn = await sqlite.createConnection(DB_NAME, false, 'no-encryption', 1, false)
    }
    await conn.open()
    await conn.execute('PRAGMA foreign_keys = ON;', false)
    await migrate(conn)
    db = conn
    return conn
  })()
  try {
    return await opening
  } finally {
    opening = null
  }
}

/** Crée / met à niveau le schéma (versionné via PRAGMA user_version). */
async function migrate(conn: SQLiteDBConnection): Promise<void> {
  const res = await conn.query('PRAGMA user_version;')
  const current = Number(res.values?.[0]?.user_version ?? 0)
  if (current < SCHEMA_VERSION) {
    if (current === 0) {
      // Premier lancement : création complète du schéma (78 tables)
      await conn.execute(SCHEMA_STATEMENTS.join('\n'), false)
    }
    // Futures migrations : if (current < 2) { ... }
    await conn.execute(`PRAGMA user_version = ${SCHEMA_VERSION};`, false)
  }
  // Seeds (AppSettings + listes paramétrables) — idempotent, comme au démarrage du backend
  await seedDefaults(conn)
}

/** SELECT → lignes. */
export async function query<T = Record<string, unknown>>(sql: string, values: unknown[] = []): Promise<T[]> {
  const conn = await getDb()
  const res = await conn.query(sql, values as never[])
  return (res.values ?? []) as T[]
}

/** INSERT/UPDATE/DELETE → { changes, lastId }. */
export async function run(sql: string, values: unknown[] = []): Promise<{ changes: number; lastId: number }> {
  const conn = await getDb()
  const res = await conn.run(sql, values as never[])
  return { changes: res.changes?.changes ?? 0, lastId: res.changes?.lastId ?? 0 }
}
