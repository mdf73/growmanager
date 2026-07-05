// ─── Seeds : valeurs par défaut insérées à la création de la base locale ──────
// Miroir de backend/app/routers/app_settings.py (SETTINGS_DEFAULTS)
// et backend/app/routers/parametre.py (LISTE_DEFAULTS).
import type { SQLiteDBConnection } from '@capacitor-community/sqlite'

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
  types_sol_preparation: ['Sol vivant (LSO)', 'Coco seul', 'Terre seule', 'Coco + Terre'],
}

/** Insère les valeurs par défaut (AppSettings + listes paramétrables) si absentes. */
export async function seedDefaults(conn: SQLiteDBConnection): Promise<void> {
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
}
