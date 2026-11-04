// ─── Seeds : valeurs par défaut insérées à l'ouverture de la base locale ───────
// Miroir de backend/app/routers/app_settings.py (SETTINGS_DEFAULTS)
// et backend/app/routers/parametre.py (seed_defaults, charger_valeurs, migrer_fournisseurs_vers_liste).
// Listes paramétrables : démarrage vide (ADR-011), seules les valeurs verrouillées sont seedées.
import type { SQLiteDBConnection } from '@capacitor-community/sqlite'
import { LISTES_VERROUILLEES, normaliserValeur } from '../api/parametres'

// Listes techniques stockées dans la même table : jamais touchées par le chargement du standard
const LISTES_TECHNIQUES = new Set(['govee_config'])

/** Insère les valeurs absentes (comparaison normalisée). Jamais d'UPDATE ni de DELETE.
 *  Retourne le nombre de valeurs ajoutées par liste. */
export async function chargerValeurs(
  conn: SQLiteDBConnection, listes: Record<string, string[]>,
): Promise<Record<string, number>> {
  const ajouts: Record<string, number> = {}
  for (const [listeNom, valeurs] of Object.entries(listes)) {
    if (LISTES_TECHNIQUES.has(listeNom) || !Array.isArray(valeurs)) continue
    const r = await conn.query('SELECT valeur, ordre FROM "ParametreListeValeur" WHERE liste_nom = ?', [listeNom])
    const rows = (r.values ?? []) as { valeur: string; ordre: number | null }[]
    const existantes = new Set(rows.map(x => normaliserValeur(x.valeur)))
    let ordre = rows.reduce((m, x) => Math.max(m, Number(x.ordre ?? 0)), -1) + 1
    let n = 0
    for (const brut of valeurs) {
      const v = String(brut ?? '').trim()
      if (!v || existantes.has(normaliserValeur(v))) continue
      await conn.run('INSERT INTO "ParametreListeValeur" (liste_nom, valeur, ordre) VALUES (?, ?, ?)',
        [listeNom, v, ordre++])
      existantes.add(normaliserValeur(v))
      n++
    }
    ajouts[listeNom] = n
  }
  return ajouts
}

const SETTINGS_DEFAULTS: { cle: string; valeur: string; label: string }[] = [
  { cle: 'prix_kwh', valeur: '0.18', label: 'Prix du kWh (€)' },
  { cle: 'devise', valeur: 'EUR', label: 'Devise' },
  { cle: 'vpd_leaf_offset', valeur: '2.0', label: 'Offset température foliaire VPD (°C)' },
]

// Miroir de backend/app/routers/stock_alert_seuils.py (SEUILS_DEFAULTS)
const SEUILS_DEFAULTS = [
  { type_stock: 'Fleur', seuil_bocal_g: 10.0, seuil_bocal_pct: 10.0, seuil_total_g: 100.0, actif: 1 },
]

/** Insère les valeurs par défaut (AppSettings, seuils stock, valeurs verrouillées) si absentes. */
export async function seedDefaults(conn: SQLiteDBConnection): Promise<void> {
  for (const s of SEUILS_DEFAULTS) {
    const r = await conn.query('SELECT type_stock FROM "StockAlertSeuil" WHERE type_stock = ?', [s.type_stock])
    if (!r.values?.length) {
      await conn.run(
        'INSERT INTO "StockAlertSeuil" (type_stock, seuil_bocal_g, seuil_bocal_pct, seuil_total_g, actif) VALUES (?,?,?,?,?)',
        [s.type_stock, s.seuil_bocal_g, s.seuil_bocal_pct, s.seuil_total_g, s.actif])
    }
  }
  for (const s of SETTINGS_DEFAULTS) {
    const r = await conn.query('SELECT id FROM "AppSettings" WHERE cle = ?', [s.cle])
    if (!r.values?.length) {
      await conn.run('INSERT INTO "AppSettings" (cle, valeur, label) VALUES (?, ?, ?)',
        [s.cle, s.valeur, s.label])
    }
  }
  // Les valeurs verrouillées doivent toujours exister (miroir backend seed_defaults)
  await chargerValeurs(conn, Object.fromEntries(
    Object.entries(LISTES_VERROUILLEES).map(([k, v]) => [k, [...v]])))
  // Migration unique : fournisseurs de la table Fournisseur (packs) → liste paramétrable
  const migr = await conn.query('SELECT id FROM "AppSettings" WHERE cle = ?', ['migr_fournisseurs_liste'])
  if (!migr.values?.length) {
    const f = await conn.query('SELECT nom_fournisseur FROM "Fournisseur"')
    const noms = ((f.values ?? []) as { nom_fournisseur: string | null }[])
      .map(x => x.nom_fournisseur ?? '').filter(Boolean)
    await chargerValeurs(conn, { fournisseurs: noms })
    await conn.run('INSERT INTO "AppSettings" (cle, valeur, label) VALUES (?, ?, NULL)',
      ['migr_fournisseurs_liste', '1'])
  }
  // Compatibilités vapo : clés techniques → libellés (miroir backend run_migrations). Idempotent.
  await conn.run(`UPDATE "Vaporisateur" SET compatibilites =
      REPLACE(REPLACE(REPLACE(compatibilites, 'fleurs_sechees', 'Fleurs séchées'),
        'concentres', 'Concentrés (Rosin)'), 'resines', 'Résines')
    WHERE compatibilites LIKE '%fleurs_sechees%' OR compatibilites LIKE '%concentres%'
       OR compatibilites LIKE '%resines%'`)
}
