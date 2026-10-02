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
    if (current < 4 && current > 0) {
      await conn.execute('ALTER TABLE "GoveeDevice" ADD COLUMN source VARCHAR(20);', false)
      await conn.execute(`CREATE TABLE IF NOT EXISTS "TapoConfig" (
        id_config INTEGER NOT NULL,
        enabled BOOLEAN NOT NULL,
        hub_ip VARCHAR(50),
        username VARCHAR(255),
        password_encrypted TEXT,
        last_status VARCHAR(50),
        last_error TEXT,
        last_poll_at DATETIME,
        updated_at DATETIME,
        PRIMARY KEY (id_config)
      );`, false)
      }
    if (current < 3 && current > 0) {
      await conn.execute(`CREATE TABLE IF NOT EXISTS "CultureEmplacement" (
        id_emplacement INTEGER NOT NULL,
        id_culture INTEGER NOT NULL,
        id_espace INTEGER NOT NULL,
        date_debut DATE NOT NULL,
        date_fin DATE,
        PRIMARY KEY (id_emplacement),
        FOREIGN KEY(id_culture) REFERENCES "Culture" (id_culture) ON DELETE CASCADE,
        FOREIGN KEY(id_espace) REFERENCES "EspaceCulture" (id_espace)
      );`, false)
      await conn.execute(`INSERT INTO "CultureEmplacement" (id_culture, id_espace, date_debut, date_fin)
        SELECT c.id_culture, c.id_espace, COALESCE(c.date_debut, date('now')), NULL
        FROM "Culture" c
        WHERE c.id_espace IS NOT NULL
          AND NOT EXISTS (
            SELECT 1 FROM "CultureEmplacement" e WHERE e.id_culture = c.id_culture
          );`, false)
    }
    if (current < 5 && current > 0) {
      // Refonte classement variétés : notes sur 5 étoiles (les anciennes colonnes /100 restent, ignorées)
      for (const col of ['note_gout', 'note_odeur', 'note_texture', 'note_extraction']) {
        await conn.execute(`ALTER TABLE "NotationVariete" ADD COLUMN ${col} FLOAT;`, false)
      }
      // Rattachement des archives à leur culture d'origine (évite le double comptage des rendements)
      await conn.execute('ALTER TABLE "HistoriqueCulture" ADD COLUMN id_culture INTEGER;', false)
      await conn.execute(`UPDATE "HistoriqueCulture" SET id_culture = (
          SELECT c.id_culture FROM "Culture" c
          WHERE c.date_debut = "HistoriqueCulture".date_debut
            AND (SELECT COUNT(*) FROM "Plant" p WHERE p.id_culture = c.id_culture AND p.statut <> 'abandonne')
              = (SELECT COUNT(*) FROM "HistoriquePlant" hp WHERE hp.id_historique_culture = "HistoriqueCulture".id_historique_culture)
        )
        WHERE id_culture IS NULL
          AND (SELECT COUNT(*) FROM "HistoriquePlant" hp WHERE hp.id_historique_culture = "HistoriqueCulture".id_historique_culture) > 0
          AND (SELECT COUNT(*) FROM "Culture" c
               WHERE c.date_debut = "HistoriqueCulture".date_debut
                 AND (SELECT COUNT(*) FROM "Plant" p WHERE p.id_culture = c.id_culture AND p.statut <> 'abandonne')
                   = (SELECT COUNT(*) FROM "HistoriquePlant" hp WHERE hp.id_historique_culture = "HistoriqueCulture".id_historique_culture)
              ) = 1;`, false)
    }
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
