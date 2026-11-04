// ─── Seeds : valeurs par défaut insérées à la création de la base locale ──────
// Miroir de backend/app/routers/app_settings.py (SETTINGS_DEFAULTS)
// et backend/app/routers/parametre.py (LISTE_DEFAULTS).
import type { SQLiteDBConnection } from '@capacitor-community/sqlite'
import { LISTES_VERROUILLEES } from '../api/parametres'

const SETTINGS_DEFAULTS: { cle: string; valeur: string; label: string }[] = [
  { cle: 'prix_kwh', valeur: '0.18', label: 'Prix du kWh (€)' },
  { cle: 'devise', valeur: 'EUR', label: 'Devise' },
  { cle: 'vpd_leaf_offset', valeur: '2.0', label: 'Offset température foliaire VPD (°C)' },
]

const LISTE_DEFAULTS: Record<string, string[]> = {
  marques: [],
  fournisseurs: ['Amazon', 'Azaneo', 'Opengrow', 'Growshop', 'Cultura', 'eBay', 'AliExpress'],
  tentes: ['60x60x100', '60x120x150', '100x100x200', '120x120x200', 'Exterieur'],
  lampes_hc: ['LED Crescience', 'LED Marshydro', 'MH', 'HPS'],
  puissances_hc: ['110', '135', '150', '550', '600'],
  types_culture: ['Indoor', 'Outdoor'],
  engrais: ['Living Soil (LSO)', 'Aptus', 'Hesi', 'Aucun', 'Autre'],
  substrats: ['LSO', 'Terre', 'Terre+Coco', 'Coco', 'NFT', "Billes d'argile", 'Pleine terre'],
  materiel_categories: ['Bocaux', 'Lampes', 'Pots', 'Coupelles et bacs', 'Arrosage', 'Tentes',
                        'Pompes et Bulleurs', 'Ventilation', 'Filets', 'Séchage', 'Outils'],
  etats_materiel: ['Neuf', 'Bon état', 'Usagé', 'Hors service'],
  vapo_types_chauffe: ['Conduction', 'Convection', 'Mixte', 'Induction'],
  vapo_types_batterie: ['Intégrée', 'Amovible 18650'],
  vapo_types_charge: ['USB-C', 'Propriétaire', 'Micro-USB', 'Autre'],
  vapo_compatibilites: ['Fleurs séchées', 'Résines', 'Concentrés (Rosin)'],
  vapo_conso_types: ['Bol céramique', 'Bol saphir', 'Bol SiC', 'Bol quartz',
                     'Terps ball', 'Screen', 'Joint', 'Embout', 'Autre'],
  vapo_conso_matieres: ['Céramique', 'Saphir', 'SiC', 'Quartz', 'Titane', 'Acier inox', 'Verre', 'Autre'],
  lampes_types: ['LED', 'HPS', 'MH', 'CMH'],
  spectres: ['Full Spectrum', 'Veg', 'Bloom', '2700K', '3000K', '4000K', '5000K',
             '6500K', '254nm', '350nm', '450nm', '660nm', '730nm', '760nm'],
  pot_matieres: ['Plastique', 'Tissu', 'Céramique', 'Autre'],
  arrosage_types: ['Goutte-à-goutte', 'Arrosoir'],
  pompe_types: ['Pompe à eau', 'Bulleur', 'Pompe à air'],
  ventilation_types: ['Extracteur', 'Intracteur', 'Ventilateur', 'Ventilateur oscillant'],
  filet_types: ['LST', 'SCROG'],
  sechage_types: ['Filet', 'Penderie', 'Rack'],
  outil_types: ['Cisailles', 'Loupe', 'pH-mètre', 'EC-mètre',
                'Hygromètre', 'Thermomètre', 'Balance', 'Autre'],
  bocal_fermetures: ['Couvercle à vis', 'Bail clasp (Le Parfait)', 'Mason Jar', 'Flip-top', 'Autre'],
  bocal_couleurs: ['Clair', 'Ambré', 'Teinté'],
  bocal_usages: ['Curing', 'Stockage longue durée', 'Fermentation', 'Infusion', 'Autre'],
  types_hash: ['Ice-O-Lator Dry', 'Ice-o-Lator WPFF', 'Dry', 'FingerHash', 'Pollinator', 'Static'],
  types_stock: ['Fleur', 'Trim', 'WPFF', 'Hash', 'Rosin', 'Autre'],
  sous_types_stock: ['Indoor', 'Outdoor'],
  types_rosin: ['Flower Rosin', 'Hash Rosin'],
  lampes_stock: ['LED Crescience 500W', 'LED Crescience 110W', 'LED MarsHydro 135W', 'Soleil'],
  maillages_iceolator: ['15µ', '25µ', '45µ', '73µ', '90µ', '160µ', '190µ', '220µ'],
  maillages_rosin: ['25µ', '36µ', '45µ', '72µ', '90µ', '120µ', '160µ', '220µ'],
  periodes_recette: ['Veg', 'Early Flo', 'Flo', 'Late Flo', 'Maturation', 'Flush'],
  types_lso: ['Substrat de base', 'Super soil', 'Mix transplantation', 'Top dress', 'Correctif'],
  types_fermentation: ['AACT', 'Compost tea', 'Lactofermentation', 'Bokashi', 'JADAM JLF', 'Autre'],
  types_espace: ['Tente', 'Box', 'Armoire', 'Chambre', 'Outdoor', 'Serre', 'Autre'],
  buts_culture: ['Récolte', 'Hunt', 'Reproduction'],
  carences: ['Azote (N)', 'Phosphore (P)', 'Potassium (K)', 'Calcium (Ca)', 'Magnésium (Mg)',
    'Soufre (S)', 'Fer (Fe)', 'Manganèse (Mn)', 'Zinc (Zn)', 'Cuivre (Cu)', 'Bore (B)', 'Molybdène (Mo)'],
  types_sol_preparation: ['Sol vivant (LSO)', 'Coco seul', 'Terre seule', 'Coco + Terre'],
}

// Miroir de backend/app/routers/stock_alert_seuils.py (SEUILS_DEFAULTS)
const SEUILS_DEFAULTS = [
  { type_stock: 'Fleur', seuil_bocal_g: 10.0, seuil_bocal_pct: 10.0, seuil_total_g: 100.0, actif: 1 },
]

/** Insère les valeurs par défaut (AppSettings + listes paramétrables + seuils stock) si absentes. */
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
  for (const [listeNom, valeurs] of Object.entries(LISTE_DEFAULTS)) {
    const r = await conn.query(
      'SELECT COUNT(*) AS n FROM "ParametreListeValeur" WHERE liste_nom = ?', [listeNom])
    const n = Number((r.values?.[0] as { n?: number } | undefined)?.n ?? 0)
    if (n === 0) {
      for (let i = 0; i < valeurs.length; i++) {
        await conn.run('INSERT INTO "ParametreListeValeur" (liste_nom, valeur, ordre) VALUES (?, ?, ?)',
          [listeNom, valeurs[i], i])
      }
    }
  }
  // Les valeurs verrouillées doivent toujours exister (miroir backend seed_defaults)
  for (const [listeNom, valeurs] of Object.entries(LISTES_VERROUILLEES)) {
    const r = await conn.query('SELECT valeur FROM "ParametreListeValeur" WHERE liste_nom = ?', [listeNom])
    const existantes = new Set((r.values ?? []).map(v => (v as { valeur: string }).valeur))
    for (let i = 0; i < valeurs.length; i++) {
      if (!existantes.has(valeurs[i])) {
        await conn.run('INSERT INTO "ParametreListeValeur" (liste_nom, valeur, ordre) VALUES (?, ?, ?)',
          [listeNom, valeurs[i], i])
      }
    }
  }
  // Compatibilités vapo : clés techniques → libellés (miroir backend run_migrations). Idempotent.
  await conn.run(`UPDATE "Vaporisateur" SET compatibilites =
      REPLACE(REPLACE(REPLACE(compatibilites, 'fleurs_sechees', 'Fleurs séchées'),
        'concentres', 'Concentrés (Rosin)'), 'resines', 'Résines')
    WHERE compatibilites LIKE '%fleurs_sechees%' OR compatibilites LIKE '%concentres%'
       OR compatibilites LIKE '%resines%'`)
}
