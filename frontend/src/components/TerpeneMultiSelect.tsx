/**
 * TerpeneMultiSelect
 * Sélecteur multi-choix des terpènes du cannabis.
 * Stocke la sélection en CSV (ex: "Myrcène,Limonène,Caryophyllène").
 */

// ── Liste complète des terpènes cannabis ─────────────────────────────────────

export interface TerpeneInfo {
  name: string
  emoji: string
  notes: string       // profil aromatique en quelques mots
  color: string       // classe Tailwind bg + text pour le badge
}

export const TERPENES: TerpeneInfo[] = [
  { name: 'Myrcène',        emoji: '🍇', notes: 'Musqué, terreux, raisin',         color: 'bg-purple-100 text-purple-800 border-purple-300' },
  { name: 'Limonène',       emoji: '🍋', notes: 'Citron, frais, vif',              color: 'bg-yellow-100 text-yellow-800 border-yellow-300' },
  { name: 'Caryophyllène',  emoji: '🌶️', notes: 'Poivre, épicé, boisé',           color: 'bg-orange-100 text-orange-800 border-orange-300' },
  { name: 'Linalol',        emoji: '💜', notes: 'Floral, lavande, doux',           color: 'bg-violet-100 text-violet-800 border-violet-300' },
  { name: 'α-Pinène',       emoji: '🌲', notes: 'Pin, forêt, frais',              color: 'bg-green-100 text-green-800 border-green-300' },
  { name: 'β-Pinène',       emoji: '🌿', notes: 'Pin, herbe, épicé',              color: 'bg-green-100 text-green-800 border-green-300' },
  { name: 'Terpinolène',    emoji: '🌸', notes: 'Floral, fruité, herbal',          color: 'bg-pink-100 text-pink-800 border-pink-300' },
  { name: 'Ocimène',        emoji: '🌼', notes: 'Sucré, herbacé, citronné',        color: 'bg-lime-100 text-lime-800 border-lime-300' },
  { name: 'Humulène',       emoji: '🍺', notes: 'Houblon, boisé, terreux',        color: 'bg-amber-100 text-amber-800 border-amber-300' },
  { name: 'Bisabolol',      emoji: '🌹', notes: 'Floral, sucré, camomille',        color: 'bg-rose-100 text-rose-800 border-rose-300' },
  { name: 'Géraniol',       emoji: '🌺', notes: 'Rose, géranium, fruité',          color: 'bg-fuchsia-100 text-fuchsia-800 border-fuchsia-300' },
  { name: 'Valencène',      emoji: '🍊', notes: 'Orange, agrume, sucré',           color: 'bg-orange-100 text-orange-800 border-orange-300' },
  { name: 'Nérolidol',      emoji: '🪵', notes: 'Boisé, floral, cire',            color: 'bg-stone-100 text-stone-800 border-stone-300' },
  { name: 'Guaïol',         emoji: '🌊', notes: 'Pin, rose, vert',                color: 'bg-teal-100 text-teal-800 border-teal-300' },
  { name: 'Eucalyptol',     emoji: '🫁', notes: 'Eucalyptus, menthol, frais',      color: 'bg-cyan-100 text-cyan-800 border-cyan-300' },
  { name: 'Farnésène',      emoji: '🍏', notes: 'Pomme verte, fruité, doux',       color: 'bg-emerald-100 text-emerald-800 border-emerald-300' },
  { name: 'Camphène',       emoji: '🏔️', notes: 'Terreux, boisé, herbacé',        color: 'bg-slate-100 text-slate-800 border-slate-300' },
  { name: '3-Carène',       emoji: '🌴', notes: 'Citronné, sucré, terreux',        color: 'bg-yellow-100 text-yellow-800 border-yellow-300' },
  { name: 'Sabinène',       emoji: '🫚', notes: 'Épicé, poivré, boisé',           color: 'bg-amber-100 text-amber-800 border-amber-300' },
  { name: 'Phytol',         emoji: '🍃', notes: 'Vert, herbacé, balsam',           color: 'bg-green-100 text-green-800 border-green-300' },
  { name: 'Cédrène',        emoji: '🪵', notes: 'Cèdre, boisé, fumé',             color: 'bg-stone-100 text-stone-800 border-stone-300' },
  { name: 'Borneol',        emoji: '🧊', notes: 'Mentholé, camphré, frais',        color: 'bg-sky-100 text-sky-800 border-sky-300' },
  { name: 'Pulegone',       emoji: '🌿', notes: 'Menthe poivrée, vif, frais',      color: 'bg-emerald-100 text-emerald-800 border-emerald-300' },
  { name: 'Isopulégol',     emoji: '🍵', notes: 'Menthe, herbacé, frais',          color: 'bg-teal-100 text-teal-800 border-teal-300' },
]

// ── Helpers CSV ───────────────────────────────────────────────────────────────

export function parseTerpenes(csv: string | null | undefined): string[] {
  if (!csv) return []
  return csv.split(',').map(t => t.trim()).filter(Boolean)
}

export function serializeTerpenes(names: string[]): string {
  return names.join(',')
}

// ── Composant ─────────────────────────────────────────────────────────────────

interface TerpeneMultiSelectProps {
  value: string | null | undefined   // CSV stocké en BDD
  onChange: (csv: string) => void
}

export default function TerpeneMultiSelect({ value, onChange }: TerpeneMultiSelectProps) {
  const selected = new Set(parseTerpenes(value))

  const toggle = (name: string) => {
    const next = new Set(selected)
    if (next.has(name)) {
      next.delete(name)
    } else {
      next.add(name)
    }
    // Conserver l'ordre de la liste officielle
    const ordered = TERPENES.map(t => t.name).filter(n => next.has(n))
    onChange(serializeTerpenes(ordered))
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {TERPENES.map(t => {
          const active = selected.has(t.name)
          return (
            <button
              key={t.name}
              type="button"
              onClick={() => toggle(t.name)}
              title={t.notes}
              className={`
                flex items-center gap-1.5 px-2.5 py-1.5 rounded-full border text-xs font-medium
                transition-all select-none
                ${active
                  ? `${t.color} shadow-sm ring-1 ring-offset-1 ring-current`
                  : 'bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 dark:text-gray-500 border-gray-200 dark:border-gray-700 hover:border-gray-400 hover:text-gray-700 dark:text-gray-200'
                }
              `}
            >
              <span>{t.emoji}</span>
              <span>{t.name}</span>
              {active && <span className="ml-0.5 font-bold">✓</span>}
            </button>
          )
        })}
      </div>

      {selected.size > 0 && (
        <p className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500">
          {selected.size} terpène{selected.size > 1 ? 's' : ''} sélectionné{selected.size > 1 ? 's' : ''} ·{' '}
          <button
            type="button"
            onClick={() => onChange('')}
            className="text-red-400 hover:text-red-600 underline"
          >
            Tout effacer
          </button>
        </p>
      )}
    </div>
  )
}


// ── Affichage badges (lecture seule) ─────────────────────────────────────────

export function TerpeneBadges({ csv }: { csv: string | null | undefined }) {
  const names = parseTerpenes(csv)
  if (names.length === 0) return null

  return (
    <div className="flex flex-wrap gap-1.5">
      {names.map(name => {
        const info = TERPENES.find(t => t.name === name)
        const color = info?.color ?? 'bg-gray-100 text-gray-700 dark:text-gray-200 border-gray-200 dark:border-gray-700'
        const emoji = info?.emoji ?? '🌿'
        return (
          <span
            key={name}
            title={info?.notes}
            className={`flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs font-medium ${color}`}
          >
            <span>{emoji}</span>
            <span>{name}</span>
          </span>
        )
      })}
    </div>
  )
}
