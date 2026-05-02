// ─── Définition de tous les types d'action V2 ────────────────────────────────

export type ActionCategory =
  | 'germination'
  | 'lampe'
  | 'arrosage'
  | 'stade'
  | 'mesure'
  | 'recolte'

export interface ActionTypeDef {
  key: string
  label: string
  category: ActionCategory
  icon: string        // emoji
  fields?: FieldDef[] // champs dynamiques du formulaire
  /** Si true, action masquée sauf si la plante cible a le statut requis */
  requiredPlantStatut?: string
}

export interface FieldDef {
  key: string
  label: string
  type: 'number' | 'text' | 'select' | 'produit_engrais'
  options?: { value: string; label: string }[]
  unit?: string
  placeholder?: string
}

// ─── Catalogue complet ────────────────────────────────────────────────────────

export const ACTION_TYPES: ActionTypeDef[] = [
  // ── Germination ──────────────────────────────────────────────────────────────
  { key: 'graine_verre_eau',      label: 'Graine dans un verre d\'eau',     category: 'germination', icon: '🥛' },
  { key: 'graine_fond_verre',     label: 'Graine au fond du verre',          category: 'germination', icon: '⬇️' },
  { key: 'graine_cube_rootriot',  label: 'Graine dans cube Rootriot',        category: 'germination', icon: '🟫' },
  { key: 'graine_sopalin',        label: 'Graine entre 2 sopalins',          category: 'germination', icon: '🧻' },
  { key: 'graine_ouverte',        label: 'Graine ouverte',                   category: 'germination', icon: '✂️' },
  { key: 'graine_germee',         label: 'Graine germée',                    category: 'germination', icon: '🌱' },
  { key: 'graine_prete_plantation', label: 'Graine prête à être plantée',   category: 'germination', icon: '✅' },
  { key: 'graine_plantee',        label: 'Graine plantée en terre',          category: 'germination', icon: '🌿' },
  { key: 'graine_morte',          label: 'Graine morte',                     category: 'germination', icon: '💀' },
  { key: 'sortie_terre',          label: 'Sortie de terre',                  category: 'germination', icon: '🌱' },
  { key: 'repiquage_rootriot',    label: 'Repiquage rootriot en terre',       category: 'germination', icon: '🔁' },
  { key: 'debut_germination',     label: 'Début germination',                category: 'germination', icon: '🚀' },

  // ── Lampe ────────────────────────────────────────────────────────────────────
  { key: 'mise_sous_led',         label: 'Mise sous lampe LED',              category: 'lampe', icon: '💡',
    fields: [
      { key: 'nom_lampe', label: 'Lampe', type: 'text', placeholder: 'Nom de la lampe LED' },
      { key: 'puissance_pct', label: 'Intensité', type: 'number', unit: '%', placeholder: '75' },
    ] },
  { key: 'mise_sous_neons',       label: 'Mise sous néons',                  category: 'lampe', icon: '🔦',
    fields: [
      { key: 'nom_lampe', label: 'Lampe', type: 'text', placeholder: 'Nom des néons' },
      { key: 'puissance_pct', label: 'Intensité', type: 'number', unit: '%', placeholder: '100' },
    ] },
  { key: 'duree_eclairage',       label: 'Durée d\'éclairage',               category: 'lampe', icon: '⏱️',
    fields: [{ key: 'programme', label: 'Programme', type: 'select',
      options: [{ value: '18/6', label: '18/6 (croissance)' }, { value: '12/12', label: '12/12 (floraison)' },
                { value: '20/4', label: '20/4' }, { value: '16/8', label: '16/8' }] }] },
  { key: 'horaires_lampe',        label: 'Horaires de la lampe',             category: 'lampe', icon: '🕐',
    fields: [
      { key: 'heure_debut', label: 'Allumage', type: 'text', placeholder: '07:00' },
      { key: 'heure_fin',   label: 'Extinction', type: 'text', placeholder: '19:00' },
    ] },
  { key: 'intensite_lampe',       label: 'Intensité de la lampe',            category: 'lampe', icon: '🔆',
    fields: [
      { key: 'puissance_apres', label: 'Intensité (%)', type: 'number', unit: '%', placeholder: '100' },
    ] },
  { key: 'hauteur_lampe',         label: 'Hauteur de la lampe',              category: 'lampe', icon: '📏',
    fields: [{ key: 'hauteur_cm', label: 'Hauteur', type: 'number', unit: 'cm' }] },

  // ── Arrosage ─────────────────────────────────────────────────────────────────
  { key: 'arrosage_eau',          label: 'Arrosage eau pure',                category: 'arrosage', icon: '💧',
    fields: [{ key: 'volume_ml', label: 'Volume', type: 'number', unit: 'mL' }] },
  { key: 'arrosage_engrais',      label: 'Arrosage avec engrais',            category: 'arrosage', icon: '🧪',
    fields: [
      { key: 'volume_ml', label: 'Volume', type: 'number', unit: 'mL' },
      { key: 'produits',  label: 'Produits utilisés', type: 'produit_engrais' },
    ] },
  { key: 'arrosage_tco',          label: 'Arrosage avec TCO',                category: 'arrosage', icon: '🍵',
    fields: [
      { key: 'volume_ml',    label: 'Volume', type: 'number', unit: 'mL' },
      { key: 'nom_recette',  label: 'Recette TCO', type: 'text', placeholder: 'Nom de la recette' },
    ] },
  { key: 'preparation_tco',       label: 'Préparation TCO',                  category: 'arrosage', icon: '🫧',
    fields: [
      { key: 'volume_l',     label: 'Volume', type: 'number', unit: 'L' },
      { key: 'nom_recette',  label: 'Recette TCO', type: 'text', placeholder: 'Nom de la recette' },
    ] },

  // ── Stades du cycle ───────────────────────────────────────────────────────────
  { key: 'debut_croissance',      label: 'Début croissance',                 category: 'stade', icon: '🌿' },
  { key: 'debut_floraison',       label: 'Début floraison',                  category: 'stade', icon: '🌸' },
  { key: 'debut_stretch',         label: 'Début stretch',                    category: 'stade', icon: '📈' },
  { key: 'fin_stretch',           label: 'Fin stretch',                      category: 'stade', icon: '📉',
    fields: [
      { key: 'hauteur_avant_cm', label: 'Hauteur début stretch (cm)', type: 'number', unit: 'cm' },
      { key: 'hauteur_apres_cm', label: 'Hauteur fin stretch (cm)',   type: 'number', unit: 'cm' },
    ] },

  // ── Mesures & Soins ────────────────────────────────────────────────────────
  { key: 'hauteur_plante',        label: 'Hauteur plante',                   category: 'mesure', icon: '📐',
    fields: [{ key: 'hauteur_cm', label: 'Hauteur', type: 'number', unit: 'cm' }] },
  { key: 'defoliation',           label: 'Défoliation',                      category: 'mesure', icon: '✂️',
    fields: [{ key: 'intensite', label: 'Intensité', type: 'select',
      options: [{ value: 'legere', label: 'Légère' }, { value: 'normale', label: 'Normale' }, { value: 'lourde', label: 'Lourde' }] }] },
  { key: 'etetage',               label: 'Étêtage',                          category: 'mesure', icon: '✂️' },
  { key: 'pincage',               label: 'Pinçage',                          category: 'mesure', icon: '🤏' },
  { key: 'rempotage',             label: 'Rempotage',                        category: 'mesure', icon: '🪴',
    fields: [{ key: 'volume_pot_l', label: 'Volume du pot', type: 'number', unit: 'L' }] },
  { key: 'apparition_etage',      label: 'Apparition d\'un étage',           category: 'mesure', icon: '🌿',
    fields: [{ key: 'numero_etage', label: 'Étage n°', type: 'number' }] },
  { key: 'mise_en_place_filet',   label: 'Mise en place du filet',           category: 'mesure', icon: '🕸️' },
  { key: 'detection_maladie',     label: 'Détection de maladie',             category: 'mesure', icon: '🦠',
    fields: [{ key: 'note', label: 'Description', type: 'text', placeholder: 'Type de maladie observée…' }] },
  { key: 'detection_parasite',    label: 'Détection de parasite',            category: 'mesure', icon: '🐛',
    fields: [{ key: 'note', label: 'Description', type: 'text', placeholder: 'Type de parasite observé…' }] },
  { key: 'traitement',            label: 'Traitement',                       category: 'mesure', icon: '💊',
    fields: [{ key: 'note', label: 'Description', type: 'text', placeholder: 'Traitement appliqué…' }] },
  { key: 'deces_plante',          label: 'Décès de la plante',               category: 'mesure', icon: '💀' },

  // ── Récolte ───────────────────────────────────────────────────────────────────
  { key: 'recolte',               label: 'Récolte → Séchage',                category: 'recolte', icon: '🌾' },
  { key: 'debut_curing',          label: 'Début curing',                     category: 'recolte', icon: '🏺',
    requiredPlantStatut: 'sechage',
    fields: [{ key: 'poids_g', label: 'Poids sec (g)', type: 'number', unit: 'g' }] },
  { key: 'fin_curing',            label: 'Terminer le curing',               category: 'recolte', icon: '✅',
    requiredPlantStatut: 'curing' },
]

// ─── Index rapide ──────────────────────────────────────────────────────────────
export const ACTION_MAP = Object.fromEntries(ACTION_TYPES.map(a => [a.key, a]))

// ─── Couleurs par catégorie ────────────────────────────────────────────────────
export const CATEGORY_COLORS: Record<ActionCategory, string> = {
  germination: 'bg-green-500',
  lampe:       'bg-yellow-400',
  arrosage:    'bg-blue-500',
  stade:       'bg-purple-500',
  mesure:      'bg-orange-500',
  recolte:     'bg-red-500',
}

export const CATEGORY_LABELS: Record<ActionCategory, string> = {
  germination: 'Germination',
  lampe:       'Lampe',
  arrosage:    'Arrosage',
  stade:       'Stade du cycle',
  mesure:      'Mesures & Soins',
  recolte:     'Récolte',
}

// ─── Actions groupées par catégorie ───────────────────────────────────────────
export const ACTIONS_BY_CATEGORY = ACTION_TYPES.reduce<Record<ActionCategory, ActionTypeDef[]>>(
  (acc, action) => {
    if (!acc[action.category]) acc[action.category] = []
    acc[action.category].push(action)
    return acc
  },
  {} as Record<ActionCategory, ActionTypeDef[]>
)
