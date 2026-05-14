/**
 * ComparaisonCultures — Comparaison inter-cultures
 * Route: /comparaison-cultures
 */
import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  AreaChart, Area,
} from 'recharts'
import { GitCompare, TrendingUp, Droplets, Euro, Leaf, X, ChevronDown } from 'lucide-react'
import { compareCultures, getAllCulturesForSelect, CultureCompare, RecetteCoutDetail } from '../api/comparaison'


// ─── Palette de couleurs pour les cultures ───────────────────────────────────
const COLORS = [
  { stroke: '#10b981', fill: '#10b98120', badge: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300', dot: 'bg-emerald-500' },
  { stroke: '#6366f1', fill: '#6366f120', badge: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300',   dot: 'bg-indigo-500' },
  { stroke: '#f59e0b', fill: '#f59e0b20', badge: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',       dot: 'bg-amber-500' },
]

// ─── Helpers ─────────────────────────────────────────────────────────────────
const fmt = (n: number | null | undefined, unit = '', decimals = 0) =>
  n == null ? '—' : `${n.toLocaleString('fr-FR', { maximumFractionDigits: decimals })} ${unit}`.trim()

const fmtEur = (n: number | null | undefined) =>
  n == null ? '—' : `${n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`

function StatutBadge({ statut }: { statut: string }) {
  const cls =
    statut === 'active' ? 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300' :
    statut === 'sechage_curing' ? 'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300' :
    'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300'
  const label =
    statut === 'active' ? 'Active' :
    statut === 'sechage_curing' ? 'Séchage/Curing' : 'Terminée'
  return <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cls}`}>{label}</span>
}

// ─── Tableau comparatif ───────────────────────────────────────────────────────
function TableauComparaison({ cultures }: { cultures: CultureCompare[] }) {
  const rows: { label: string; icon?: string; values: (c: CultureCompare) => string }[] = [
    { label: 'Statut',              values: c => c.statut === 'active' ? 'Active' : c.statut === 'sechage_curing' ? 'Séchage/Curing' : 'Terminée' },
    { label: 'Variétés',            values: c => c.varietes.join(', ') || '—' },
    { label: 'Tente / espace',       values: c => c.nom_espace || '—' },
    { label: 'Lampe(s)',              values: c => c.lampes.length ? c.lampes.map(l => `${l.nom}${l.puissance_w ? ' · ' + l.puissance_w + 'W' : ''}`).join(', ') : '—' },
    { label: 'Puissance totale',      values: c => c.puissance_w_total ? `${c.puissance_w_total} W` : '—' },
    { label: 'Type engrais',          values: c => c.is_lso ? 'LSO (Sol Vivant)' : c.marques_engrais.length ? c.marques_engrais.join(', ') : 'Conventionnel' },
    { label: 'TCO total',             values: c => c.is_lso ? (c.nb_tco_total > 0 ? `${c.nb_tco_total} TCO` : '—') : '—' },
    { label: 'Type éclairage',        values: c => c.type_eclairage || '—' },
    { label: 'Nb plantes',          values: c => fmt(c.nb_plantes) },
    { label: 'Plantes récoltées',   values: c => fmt(c.nb_plantes_recoltees) },
    { label: 'Durée totale',        values: c => fmt(c.duree_totale_j, 'j') },
    { label: 'Phase végétative',    values: c => fmt(c.duree_veg_j, 'j') },
    { label: 'Phase floraison',     values: c => fmt(c.duree_flo_j, 'j') },
    { label: 'Rendement total',     values: c => fmt(c.rendement_total_g, 'g') },
    { label: 'Rendement / plante',  values: c => fmt(c.rendement_par_plante_g, 'g', 1) },
    { label: 'Vol. arrosage total',  values: c => fmt(c.volume_arrosage_total_l, 'L', 1) },
    { label: 'Vol. arrosage engrais', values: c => fmt(c.volume_arrosage_engrais_l, 'L', 1) },
    { label: 'Coût total',          values: c => fmtEur(c.cout_total) },
    { label: 'Coût / gramme',       values: c => fmtEur(c.cout_par_gramme) },
    { label: 'Coût engrais',        values: c => fmtEur(c.cout_engrais) },
    { label: 'Coût engrais / L',    values: c => (c.volume_arrosage_engrais_l && c.cout_engrais && c.volume_arrosage_engrais_l > 0) ? fmtEur(Math.round(c.cout_engrais / c.volume_arrosage_engrais_l * 100) / 100) + '/L' : '—' },
    { label: 'Coût électricité',    values: c => fmtEur(c.cout_electricite) },
    { label: 'Coût graines',        values: c => fmtEur(c.cout_graines) },
  ]

  // Highlight : meilleure valeur pour les métriques numériques
  const best = (key: keyof CultureCompare, higher = true): Set<number> => {
    const vals = cultures.map(c => c[key] as number | null)
    const valid = vals.filter(v => v != null) as number[]
    if (valid.length < 2) return new Set()
    const target = higher ? Math.max(...valid) : Math.min(...valid)
    return new Set(vals.map((v, i) => v === target ? i : -1).filter(i => i >= 0))
  }

  const bestSets: Record<string, Set<number>> = {
    'Rendement total':    best('rendement_total_g'),
    'Rendement / plante': best('rendement_par_plante_g'),
    'Coût total':         best('cout_total', false),
    'Coût / gramme':      best('cout_par_gramme', false),
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-slate-50 dark:bg-slate-800/60">
            <th className="text-left px-4 py-3 font-medium text-slate-500 dark:text-slate-400 w-40">Métrique</th>
            {cultures.map((c, i) => (
              <th key={c.id_culture} className="text-left px-4 py-3">
                <div className="flex items-center gap-2">
                  <span className={`w-3 h-3 rounded-full flex-shrink-0 ${COLORS[i].dot}`} />
                  <span className="font-semibold text-slate-800 dark:text-slate-100 truncate max-w-[180px]">{c.nom}</span>
                  <StatutBadge statut={c.statut} />
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr
              key={row.label}
              className={ri % 2 === 0
                ? 'bg-white dark:bg-slate-900'
                : 'bg-slate-50/50 dark:bg-slate-800/30'}
            >
              <td className="px-4 py-2.5 text-slate-500 dark:text-slate-400 font-medium">{row.label}</td>
              {cultures.map((c, ci) => {
                const isBest = bestSets[row.label]?.has(ci)
                return (
                  <td
                    key={c.id_culture}
                    className={`px-4 py-2.5 font-mono text-slate-800 dark:text-slate-200 ${isBest ? 'font-bold text-emerald-600 dark:text-emerald-400' : ''}`}
                  >
                    {row.values(c)}
                    {isBest && <span className="ml-1 text-xs">★</span>}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ─── Graphique Hauteurs superposées ──────────────────────────────────────────
function GraphiqueHauteurs({ cultures }: { cultures: CultureCompare[] }) {
  // On agrège par jour_offset, une série par plante de chaque culture
  const allPoints = useMemo(() => {
    const map = new Map<number, Record<string, number>>()

    cultures.forEach((culture, _ci) => {
      // Grouper les hauteurs de cette culture par plante
      const planteMap = new Map<string, Map<number, number>>()
      culture.hauteurs.forEach(pt => {
        if (!planteMap.has(pt.plante)) planteMap.set(pt.plante, new Map())
        // Garder la valeur max par jour pour chaque plante
        const existing = planteMap.get(pt.plante)!.get(pt.jour_offset) || 0
        planteMap.get(pt.plante)!.set(pt.jour_offset, Math.max(existing, pt.hauteur_cm))
      })

      // Calculer la hauteur moyenne de toutes les plantes par jour
      const dayMap = new Map<number, number[]>()
      planteMap.forEach((jours) => {
        jours.forEach((h, j) => {
          if (!dayMap.has(j)) dayMap.set(j, [])
          dayMap.get(j)!.push(h)
        })
      })

      dayMap.forEach((vals, j) => {
        if (!map.has(j)) map.set(j, {})
        const avg = vals.reduce((a, b) => a + b, 0) / vals.length
        map.get(j)![`culture_${culture.id_culture}`] = Math.round(avg * 10) / 10
      })
    })

    return Array.from(map.entries())
      .sort(([a], [b]) => a - b)
      .map(([jour_offset, vals]) => ({ jour_offset, ...vals }))
  }, [cultures])

  if (allPoints.length === 0) {
    return (
      <div className="flex items-center justify-center h-40 text-slate-400 text-sm">
        Aucune donnée de hauteur enregistrée
      </div>
    )
  }

  const xDomainH = useMemo(() => {
    const allDays = allPoints.map(p => p.jour_offset)
    if (allDays.length === 0) return [0, 100]
    return [0, Math.max(...allDays)]
  }, [allPoints])

  const xTicksH = useMemo(() => {
    const maxDay = xDomainH[1] as number
    const step = maxDay <= 60 ? 5 : maxDay <= 120 ? 10 : maxDay <= 200 ? 20 : 30
    const ticks = []
    for (let i = 0; i <= maxDay; i += step) ticks.push(i)
    if (ticks[ticks.length - 1] !== maxDay) ticks.push(maxDay)
    return ticks
  }, [xDomainH])

  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={allPoints} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis
          dataKey="jour_offset"
          type="number"
          domain={xDomainH}
          ticks={xTicksH}
          label={{ value: 'Jours depuis J0', position: 'insideBottom', offset: -4, fontSize: 11 }}
          tick={{ fontSize: 11 }}
        />
        <YAxis unit=" cm" tick={{ fontSize: 11 }} />
        <Tooltip
          formatter={(val: number, name: string) => {
            const ci = cultures.findIndex(c => `culture_${c.id_culture}` === name)
            return [`${val} cm`, ci >= 0 ? cultures[ci].nom : name]
          }}
          labelFormatter={(l) => `J+${l}`}
        />
        <Legend formatter={(val) => {
          const ci = cultures.findIndex(c => `culture_${c.id_culture}` === val)
          return ci >= 0 ? cultures[ci].nom : val
        }} />
        {cultures.map((c, i) => (
          <Line
            key={c.id_culture}
            type="monotone"
            dataKey={`culture_${c.id_culture}`}
            stroke={COLORS[i].stroke}
            strokeWidth={2}
            dot={false}
            connectNulls
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  )
}

// ─── Graphique Arrosages cumulés ─────────────────────────────────────────────
function GraphiqueArrosages({ cultures }: { cultures: CultureCompare[] }) {
  const allPoints = useMemo(() => {
    const map = new Map<number, Record<string, number>>()

    cultures.forEach((culture) => {
      culture.arrosages_cumules.forEach(pt => {
        if (!map.has(pt.jour_offset)) map.set(pt.jour_offset, {})
        map.get(pt.jour_offset)![`culture_${culture.id_culture}`] = pt.volume_cumul_ml
      })
    })

    return Array.from(map.entries())
      .sort(([a], [b]) => a - b)
      .map(([jour_offset, vals]) => ({ jour_offset, ...vals }))
  }, [cultures])

  // Calcul de l'axe X : ticks réguliers de J0 à J_max
  const xDomain = useMemo(() => {
    const allDays = allPoints.map(p => p.jour_offset)
    if (allDays.length === 0) return [0, 100]
    return [0, Math.max(...allDays)]
  }, [allPoints])

  const xTicks = useMemo(() => {
    const maxDay = xDomain[1] as number
    const step = maxDay <= 60 ? 5 : maxDay <= 120 ? 10 : maxDay <= 200 ? 20 : 30
    const ticks = []
    for (let i = 0; i <= maxDay; i += step) ticks.push(i)
    if (ticks[ticks.length - 1] !== maxDay) ticks.push(maxDay)
    return ticks
  }, [xDomain])

  if (allPoints.length === 0) {
    return (
      <div className="flex items-center justify-center h-40 text-slate-400 text-sm">
        Aucune donnée d'arrosage enregistrée
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={280}>
      <AreaChart data={allPoints} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis
          dataKey="jour_offset"
          type="number"
          domain={xDomain}
          ticks={xTicks}
          label={{ value: 'Jours depuis J0', position: 'insideBottom', offset: -4, fontSize: 11 }}
          tick={{ fontSize: 11 }}
        />
        <YAxis tickFormatter={(v) => v >= 1000 ? `${(v/1000).toFixed(1)}L` : `${v}ml`} tick={{ fontSize: 11 }} />
        <Tooltip
          formatter={(val: number, name: string) => {
            const ci = cultures.findIndex(c => `culture_${c.id_culture}` === name)
            const label = ci >= 0 ? cultures[ci].nom : name
            return [val >= 1000 ? `${(val/1000).toFixed(2)} L` : `${val} ml`, label]
          }}
          labelFormatter={(l) => `J+${l}`}
        />
        <Legend formatter={(val) => {
          const ci = cultures.findIndex(c => `culture_${c.id_culture}` === val)
          return ci >= 0 ? cultures[ci].nom : val
        }} />
        {cultures.map((c, i) => (
          <Area
            key={c.id_culture}
            type="monotone"
            dataKey={`culture_${c.id_culture}`}
            stroke={COLORS[i].stroke}
            fill={COLORS[i].fill}
            strokeWidth={2}
            dot={false}
            connectNulls
          />
        ))}
      </AreaChart>
    </ResponsiveContainer>
  )
}

// ─── Sélecteur de cultures ────────────────────────────────────────────────────
function CultureSelector({
  selected,
  onChange,
  allCultures,
}: {
  selected: number[]
  onChange: (ids: number[]) => void
  allCultures: { id_culture: number; nom: string; statut: string; date_debut: string | null }[]
}) {
  const [open, setOpen] = useState(false)

  const toggle = (id: number) => {
    if (selected.includes(id)) {
      onChange(selected.filter(x => x !== id))
    } else if (selected.length < 3) {
      onChange([...selected, id])
    }
  }

  const statut_label = (s: string) =>
    s === 'active' ? '🟢' : s === 'sechage_curing' ? '🟠' : '⚫'

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-700 dark:text-slate-200 hover:border-emerald-400 transition-colors shadow-sm"
      >
        <Leaf className="w-4 h-4 text-emerald-500" />
        {selected.length === 0
          ? 'Sélectionner des cultures…'
          : `${selected.length} culture${selected.length > 1 ? 's' : ''} sélectionnée${selected.length > 1 ? 's' : ''}`}
        <ChevronDown className={`w-4 h-4 ml-1 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute z-50 mt-2 w-96 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl overflow-hidden">
          <div className="p-3 border-b border-slate-100 dark:border-slate-700 text-xs text-slate-500 dark:text-slate-400">
            Sélectionnez 2 ou 3 cultures à comparer
          </div>
          <div className="max-h-72 overflow-y-auto">
            {allCultures.map(c => {
              const isSelected = selected.includes(c.id_culture)
              const isDisabled = !isSelected && selected.length >= 3
              const idx = selected.indexOf(c.id_culture)
              return (
                <button
                  key={c.id_culture}
                  onClick={() => !isDisabled && toggle(c.id_culture)}
                  disabled={isDisabled}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm text-left transition-colors
                    ${isSelected ? 'bg-emerald-50 dark:bg-emerald-900/20' : ''}
                    ${isDisabled ? 'opacity-40 cursor-not-allowed' : 'hover:bg-slate-50 dark:hover:bg-slate-700/50'}`}
                >
                  {isSelected ? (
                    <span className={`w-5 h-5 rounded flex items-center justify-center text-xs text-white flex-shrink-0 ${COLORS[idx]?.dot || 'bg-emerald-500'}`} style={{ background: COLORS[idx]?.stroke }}>
                      {idx + 1}
                    </span>
                  ) : (
                    <span className="w-5 h-5 rounded border-2 border-slate-300 dark:border-slate-600 flex-shrink-0" />
                  )}
                  <span className="flex-1 truncate text-slate-800 dark:text-slate-200">{c.nom}</span>
                  <span className="text-xs text-slate-400">{statut_label(c.statut)}</span>
                  {c.date_debut && (
                    <span className="text-xs text-slate-400 font-mono">{c.date_debut.slice(0, 7)}</span>
                  )}
                </button>
              )
            })}
          </div>
          <div className="p-3 border-t border-slate-100 dark:border-slate-700 flex justify-end">
            <button
              onClick={() => setOpen(false)}
              className="text-xs text-emerald-600 hover:text-emerald-700 font-medium"
            >
              Fermer
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Page principale ──────────────────────────────────────────────────────────
export default function ComparaisonCultures() {
  const [selectedIds, setSelectedIds] = useState<number[]>([])

  // Liste de toutes les cultures (actives + terminées)
  const { data: allCultures = [], isLoading: loadingList } = useQuery({
    queryKey: ['cultures-for-select'],
    queryFn: getAllCulturesForSelect,
  })

  // Comparaison (lancée dès que 2+ cultures sélectionnées)
  const readyToCompare = selectedIds.length >= 2
  const { data: compareData, isLoading: loadingCompare, error } = useQuery({
    queryKey: ['cultures-compare', selectedIds],
    queryFn: () => compareCultures(selectedIds),
    enabled: readyToCompare,
  })

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-100 dark:bg-emerald-900/30 rounded-xl">
              <GitCompare className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Comparaison inter-cultures</h1>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Sélectionnez 2 ou 3 cultures pour les comparer côte-à-côte</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {selectedIds.length > 0 && (
              <button
                onClick={() => setSelectedIds([])}
                className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
              >
                <X className="w-4 h-4" />
                Réinitialiser
              </button>
            )}
            {loadingList ? (
              <div className="text-sm text-slate-400">Chargement…</div>
            ) : (
              <CultureSelector
                selected={selectedIds}
                onChange={setSelectedIds}
                allCultures={allCultures}
              />
            )}
          </div>
        </div>

        {/* État vide */}
        {!readyToCompare && (
          <div className="flex flex-col items-center justify-center py-24 text-center gap-4">
            <div className="p-5 bg-slate-100 dark:bg-slate-800 rounded-2xl">
              <GitCompare className="w-12 h-12 text-slate-300 dark:text-slate-600" />
            </div>
            <div>
              <p className="text-slate-600 dark:text-slate-300 font-medium">Sélectionnez au moins 2 cultures</p>
              <p className="text-sm text-slate-400 dark:text-slate-500 mt-1">Le tableau et les graphiques apparaîtront ici</p>
            </div>
          </div>
        )}

        {/* Chargement */}
        {readyToCompare && loadingCompare && (
          <div className="flex items-center justify-center py-20 text-slate-400 text-sm gap-3">
            <div className="w-5 h-5 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
            Calcul en cours…
          </div>
        )}

        {/* Erreur */}
        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-xl p-4 text-red-700 dark:text-red-300 text-sm">
            Erreur lors du chargement de la comparaison.
          </div>
        )}

        {/* Résultats */}
        {compareData && compareData.length >= 2 && (
          <div className="space-y-6">

            {/* Légende cultures */}
            <div className="flex flex-wrap gap-3">
              {compareData.map((c, i) => (
                <div key={c.id_culture} className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium ${COLORS[i].badge}`}>
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: COLORS[i].stroke }} />
                  {c.nom}
                  <StatutBadge statut={c.statut} />
                </div>
              ))}
            </div>

            {/* Tableau comparatif */}
            <section className="space-y-3">
              <div className="flex items-center gap-2 text-slate-700 dark:text-slate-200 font-semibold">
                <TrendingUp className="w-5 h-5 text-emerald-500" />
                Tableau comparatif
              </div>
              <TableauComparaison cultures={compareData} />
            </section>

            {/* Détail TCO si LSO */}
            {compareData.some(c => c.is_lso && c.nb_tco_total > 0) && (
              <section className="space-y-3">
                <div className="flex items-center gap-2 text-slate-700 dark:text-slate-200 font-semibold">
                  <span className="text-lg">🍵</span>
                  Détail TCO (Sol Vivant)
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {compareData.filter(c => c.is_lso).map((c, _i) => {
                    const idx = compareData.indexOf(c)
                    const TCO_TYPES = ['Croissance', 'Stretch', 'Floraison', 'Correctif', 'Réamendement', 'Autre']
                    const present = TCO_TYPES.filter(t => c.tco_par_type[t])
                    const other = Object.entries(c.tco_par_type).filter(([k]) => !TCO_TYPES.includes(k))
                    return (
                      <div key={c.id_culture} className="bg-white dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 p-4 space-y-3">
                        <div className="flex items-center gap-2">
                          <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: COLORS[idx]?.stroke }} />
                          <span className="font-semibold text-slate-800 dark:text-slate-100 text-sm truncate">{c.nom}</span>
                          <span className="text-xs text-slate-400 font-mono">{c.nb_tco_total} TCO</span>
                        </div>
                        <div className="space-y-1.5 text-sm">
                          {present.map(type => (
                            <div key={type} className="flex justify-between items-center">
                              <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                                <span>{type === 'Croissance' ? '🌿' : type === 'Floraison' ? '🌸' : type === 'Stretch' ? '📈' : type === 'Correctif' ? '🔧' : '🍵'}</span>
                                {type}
                              </span>
                              <span className="font-mono font-semibold text-slate-800 dark:text-slate-200">{c.tco_par_type[type]}×</span>
                            </div>
                          ))}
                          {other.map(([k, v]) => (
                            <div key={k} className="flex justify-between items-center">
                              <span className="text-slate-500 dark:text-slate-400">🍵 {k}</span>
                              <span className="font-mono font-semibold text-slate-800 dark:text-slate-200">{v}×</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </section>
            )}

                        {/* Détail coût engrais par recette */}
            {compareData.some(c => c.details_cout_engrais && c.details_cout_engrais.length > 0) && (
              <section className="space-y-3">
                <div className="flex items-center gap-2 text-slate-700 dark:text-slate-200 font-semibold">
                  <Droplets className="w-5 h-5 text-indigo-500" />
                  Détail coût engrais par recette
                  <span className="ml-1 text-xs font-normal text-slate-400">— après correction du double-comptage</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {compareData.map((c, i) => (
                    <div key={c.id_culture} className="bg-white dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 p-4 space-y-3">
                      <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: COLORS[i].stroke }} />
                        <span className="font-semibold text-slate-800 dark:text-slate-100 text-sm truncate">{c.nom}</span>
                      </div>
                      {c.details_cout_engrais && c.details_cout_engrais.length > 0 ? (
                        <div className="space-y-2">
                          {c.details_cout_engrais.map((d: RecetteCoutDetail) => (
                            <div key={d.nom_recette} className="text-xs border border-slate-100 dark:border-slate-700 rounded-lg p-2.5 space-y-1">
                              <div className="font-medium text-slate-700 dark:text-slate-200 truncate">{d.nom_recette}</div>
                              <div className="grid grid-cols-2 gap-x-3 text-slate-500 dark:text-slate-400">
                                <span>Volume utilisé</span>
                                <span className="font-mono text-slate-700 dark:text-slate-200 text-right">{d.volume_l.toLocaleString('fr-FR', {maximumFractionDigits: 1})} L</span>
                                <span>Coût total</span>
                                <span className="font-mono text-slate-700 dark:text-slate-200 text-right">{d.cout.toLocaleString('fr-FR', {minimumFractionDigits: 2, maximumFractionDigits: 2})} €</span>
                                <span>Coût / L</span>
                                <span className={`font-mono text-right font-semibold ${d.cout_par_litre != null && d.cout_par_litre > 1 ? 'text-red-500' : 'text-emerald-600 dark:text-emerald-400'}`}>
                                  {d.cout_par_litre != null ? d.cout_par_litre.toLocaleString('fr-FR', {minimumFractionDigits: 2, maximumFractionDigits: 2}) + ' €/L' : '—'}
                                </span>
                                <span>Nb arrosages</span>
                                <span className="font-mono text-slate-700 dark:text-slate-200 text-right">{d.nb_actions}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-slate-400">Aucune recette engrais enregistrée</p>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Graphique hauteurs */}
            {compareData.some(c => c.hauteurs.length > 0) && (
              <section className="bg-white dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 p-5 space-y-3">
                <div className="flex items-center gap-2 text-slate-700 dark:text-slate-200 font-semibold">
                  <Leaf className="w-5 h-5 text-emerald-500" />
                  Hauteur des plantes (moyenne par culture)
                  <span className="ml-1 text-xs font-normal text-slate-400">— offset jours depuis J0</span>
                </div>
                <GraphiqueHauteurs cultures={compareData} />
              </section>
            )}

            {/* Graphique arrosages cumulés */}
            {compareData.some(c => c.arrosages_cumules.length > 0) && (
              <section className="bg-white dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 p-5 space-y-3">
                <div className="flex items-center gap-2 text-slate-700 dark:text-slate-200 font-semibold">
                  <Droplets className="w-5 h-5 text-blue-500" />
                  Volume d'arrosage cumulé
                  <span className="ml-1 text-xs font-normal text-slate-400">— offset jours depuis J0</span>
                </div>
                <GraphiqueArrosages cultures={compareData} />
              </section>
            )}

            {/* Récap coûts visuel */}
            {compareData.some(c => c.cout_total != null) && (
              <section className="space-y-3">
                <div className="flex items-center gap-2 text-slate-700 dark:text-slate-200 font-semibold">
                  <Euro className="w-5 h-5 text-amber-500" />
                  Coûts comparés
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {compareData.map((c, i) => (
                    <div key={c.id_culture} className="bg-white dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 p-4 space-y-3">
                      <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full" style={{ background: COLORS[i].stroke }} />
                        <span className="font-semibold text-slate-800 dark:text-slate-100 text-sm truncate">{c.nom}</span>
                      </div>
                      <div className="space-y-1.5 text-sm">
                        {[
                          { label: 'Total',        value: c.cout_total },
                          { label: 'Électricité',  value: c.cout_electricite },
                          { label: 'Engrais',      value: c.cout_engrais },
                          { label: 'Graines',      value: c.cout_graines },
                          { label: '/ gramme',     value: c.cout_par_gramme },
                        ].map(row => (
                          <div key={row.label} className="flex justify-between">
                            <span className="text-slate-500 dark:text-slate-400">{row.label}</span>
                            <span className="font-mono font-medium text-slate-800 dark:text-slate-200">{fmtEur(row.value)}</span>
                          </div>
                        ))}
                        <div className="pt-2 mt-1 border-t border-slate-100 dark:border-slate-700 space-y-1">
                          <div className="flex justify-between text-xs">
                            <span className="text-slate-400">Vol. arrosé total</span>
                            <span className="font-mono text-slate-600 dark:text-slate-300">{fmt(c.volume_arrosage_total_l, 'L', 1)}</span>
                          </div>
                          <div className="flex justify-between text-xs">
                            <span className="text-slate-400">dont arrosage engrais</span>
                            <span className="font-mono text-slate-600 dark:text-slate-300">{fmt(c.volume_arrosage_engrais_l, 'L', 1)}</span>
                          </div>
                          {c.volume_arrosage_engrais_l != null && c.cout_engrais != null && c.volume_arrosage_engrais_l > 0 && (
                            <div className="flex justify-between text-xs">
                              <span className="text-slate-400">Coût engrais / L</span>
                              <span className="font-mono text-slate-600 dark:text-slate-300">{fmtEur(Math.round(c.cout_engrais / c.volume_arrosage_engrais_l * 100) / 100)}/L</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

          </div>
        )}
  </div>
  )
}
