import { useState, useMemo } from 'react'
import { ChevronLeft, ChevronRight, Plus, Droplets } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { actionAPI, Action, ActionCreate, Plant } from '../../api/cultures'
import { ACTION_MAP, CATEGORY_COLORS, CATEGORY_LABELS, ActionCategory, formatActionParams } from './actionTypes'
import ActionModal from './ActionModal'
import ArrosageModal from './ArrosageModal'
import SensorDayChart from '../SensorDayChart'
import { CultureEmplacement } from '../../api/cultures'
import { espaceAtDate } from '../../utils/cultureEmplacement'

// ── Helpers arrosage ───────────────────────────────────────────────────────────

const WATERING_TYPES = ['arrosage_eau', 'arrosage_engrais', 'arrosage_tco']

function formatVolume(liters: number): string {
  if (liters < 1) return `${Math.round(liters * 1000)} mL`
  return `${Math.round(liters * 100) / 100} L`
}

interface WateringGroup {
  actions: Action[]
  type_action: string
  isGlobal: boolean
  volTotal: number | null
  volParPlante: number | null
  nbPlantes: number | null
  nomRecette: string | null
  phCible: string | number | null
  produitsCalcules: { nom: string; quantite: number; unite: string }[] | null
  plantNames: string[]
}

function groupWateringActions(dayActions: Action[]): { wateringGroups: WateringGroup[]; other: Action[] } {
  const watering = dayActions.filter(a => WATERING_TYPES.includes(a.type_action))
  const other = dayActions.filter(a => !WATERING_TYPES.includes(a.type_action))

  const groupMap = new Map<string, Action[]>()
  for (const a of watering) {
    const params = (a.parametres ?? {}) as Record<string, any>
    // Clé de regroupement : même type + même recette + même volume_par_plante
    const key = [
      a.type_action,
      params.nom_recette ?? '',
      params.volume_par_plante_l ?? params.volume_l ?? '',
      a.global_culture ? 'global' : '',
    ].join('|')
    if (!groupMap.has(key)) groupMap.set(key, [])
    groupMap.get(key)!.push(a)
  }

  const wateringGroups: WateringGroup[] = Array.from(groupMap.values()).map(actions => {
    const first = actions[0]
    const params = (first.parametres ?? {}) as Record<string, any>
    const isGlobal = first.global_culture

    // Volume total : pour global = volume_l stocké, pour multi-plantes = volume_par_plante × nb
    const volParPlante: number | null = params.volume_par_plante_l ?? null
    const nbPlantes: number | null = params.nb_plantes ?? (isGlobal ? null : actions.length) ?? null
    const volTotal: number | null = isGlobal
      ? (params.volume_l ?? null)
      : (params.volume_total_l ?? (volParPlante && nbPlantes ? volParPlante * nbPlantes : params.volume_l ?? null))

    const plantNames = isGlobal ? [] : actions.map(a => a.nom_plant).filter(Boolean) as string[]

    return {
      actions,
      type_action: first.type_action,
      isGlobal,
      volTotal,
      volParPlante,
      nbPlantes,
      nomRecette: params.nom_recette ?? null,
      phCible: params.ph_cible ?? null,
      produitsCalcules: (() => {
        const raw: { nom: string; quantite: number; unite: string }[] | null = params.produits_calcules ?? null
        if (!raw || isGlobal) return raw
        // Pour les arrosages par plante, les quantités stockées sont par plante → on recalcule le total
        const n = nbPlantes ?? actions.length ?? 1
        return raw.map(p => ({
          ...p,
          quantite: Math.round(p.quantite * n * 100) / 100,
        }))
      })(),
      plantNames,
    }
  })

  return { wateringGroups, other }
}

const WATERING_ICONS: Record<string, string> = {
  arrosage_eau: '💧',
  arrosage_engrais: '🧪',
  arrosage_tco: '🍵',
}

const WATERING_LABELS: Record<string, string> = {
  arrosage_eau: 'Arrosage eau pure',
  arrosage_engrais: 'Arrosage avec engrais',
  arrosage_tco: 'Arrosage TCO',
}

const WATERING_COLORS: Record<string, string> = {
  arrosage_eau: 'bg-blue-400',
  arrosage_engrais: 'bg-green-500',
  arrosage_tco: 'bg-amber-500',
}

interface Props {
  cultureId: number
  idEspace?: number
  emplacements?: CultureEmplacement[]
  plants: Plant[]
  /** Dates culture servant de repli quand la plante n'a pas sa propre date de début de floraison */
  dateDebutFloraison?: string | null
  datePassage1212?: string | null
}

// Plantes dont la récolte est déjà faite ou abandonnée : plus de fenêtre prévisionnelle
const STATUTS_SANS_PREVISION = ['recolte', 'sechage', 'curing', 'prete', 'abandonne']

const LEGEND_CATEGORIES: ActionCategory[] = ['germination', 'lampe', 'arrosage', 'stade', 'mesure', 'training', 'recolte', 'photo']

interface HarvestRange {
  plant: Plant
  varName: string
  dateMin: Date
  dateMax: Date
  /** true si la base vient de la culture (début flo / 12-12) et pas de la plante */
  baseCulture: boolean
}

/** Fenêtre de récolte d'une plante : même règle que le backend
 *  (date_debut_flo plante → date_debut_floraison culture → date_passage_12_12 culture) + durées de la variété. */
function computeHarvestRange(plant: Plant, dateDebutFloraison?: string | null, datePassage1212?: string | null): HarvestRange | null {
  if (STATUTS_SANS_PREVISION.includes(plant.statut || '')) return null
  const minDays = plant.duree_flo_min ?? plant.duree_flo_max
  const maxDays = plant.duree_flo_max ?? plant.duree_flo_min
  if (!minDays || !maxDays) return null
  const baseStr = plant.date_debut_flo || dateDebutFloraison || datePassage1212
  if (!baseStr) return null
  const base = new Date(baseStr.slice(0, 10) + 'T12:00:00')
  const dateMin = new Date(base); dateMin.setDate(dateMin.getDate() + minDays)
  const dateMax = new Date(base); dateMax.setDate(dateMax.getDate() + maxDays)
  return {
    plant,
    varName: plant.nom_variete ?? plant.nom_affichage ?? `Plant #${plant.id_plant}`,
    dateMin, dateMax,
    baseCulture: !plant.date_debut_flo,
  }
}

function localDateStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const JOURS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']
const MOIS_FR = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
                  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre']

function monthKey(year: number, month: number) {
  return `${year}-${String(month + 1).padStart(2, '0')}`
}

function dateStr(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

export default function CalendrierCulture({ cultureId, idEspace, emplacements, plants, dateDebutFloraison, datePassage1212 }: Props) {
  const today = new Date()
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth())    // 0-indexed
  const [selectedDay, setSelectedDay] = useState<string | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [showArrosageModal, setShowArrosageModal] = useState(false)
  const [modalDate, setModalDate] = useState(today.toISOString().slice(0, 10))

  const qc = useQueryClient()

  const { data: actions = [] } = useQuery<Action[]>({
    queryKey: ['calendrier', cultureId, monthKey(year, month)],
    queryFn: async () => (await actionAPI.getCalendrier(cultureId, monthKey(year, month))).data,
  })

  // Actions grouped by day
  const actionsByDay = useMemo(() => {
    const map: Record<string, Action[]> = {}
    for (const a of actions) {
      const d = a.date_action.slice(0, 10)
      if (!map[d]) map[d] = []
      map[d].push(a)
    }
    return map
  }, [actions])

  // Fenêtres de récolte prévues, une par plante active
  const harvestRanges = useMemo(
    () => plants.map(p => computeHarvestRange(p, dateDebutFloraison, datePassage1212)).filter((r): r is HarvestRange => r !== null),
    [plants, dateDebutFloraison, datePassage1212],
  )

  // dateStr → variétés à récolter ce jour-là (regroupées par variété, avec les plantes concernées)
  const harvestWindowByDay = useMemo(() => {
    const map: Record<string, { varName: string; plantNames: string[] }[]> = {}
    for (const r of harvestRanges) {
      const cursor = new Date(r.dateMin)
      while (cursor <= r.dateMax) {
        const ds = localDateStr(cursor)
        if (!map[ds]) map[ds] = []
        let entry = map[ds].find(e => e.varName === r.varName)
        if (!entry) { entry = { varName: r.varName, plantNames: [] }; map[ds].push(entry) }
        entry.plantNames.push(r.plant.nom_affichage ?? `Plant #${r.plant.id_plant}`)
        cursor.setDate(cursor.getDate() + 1)
      }
    }
    return map
  }, [harvestRanges])

  const deleteAction = useMutation({
    mutationFn: (actionId: number) => actionAPI.delete(cultureId, actionId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['calendrier', cultureId] }),
  })

  const createAction = useMutation({
    mutationFn: (data: ActionCreate) => actionAPI.create(cultureId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['calendrier', cultureId] })
      qc.invalidateQueries({ queryKey: ['culture', cultureId] })
      qc.invalidateQueries({ queryKey: ['produits-engrais'] })
    },
  })

  // Calendar grid computation
  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0)
  // Monday-first: 0=Mon ... 6=Sun
  const startOffset = (firstDay.getDay() + 6) % 7
  const daysInMonth = lastDay.getDate()

  function prevMonth() {
    if (month === 0) { setYear(y => y - 1); setMonth(11) }
    else setMonth(m => m - 1)
    setSelectedDay(null)
  }
  function nextMonth() {
    if (month === 11) { setYear(y => y + 1); setMonth(0) }
    else setMonth(m => m + 1)
    setSelectedDay(null)
  }

  function openAddAction(day: string) {
    setModalDate(day)
    setShowModal(true)
  }

  function openArrosageModal(day: string) {
    setModalDate(day)
    setShowArrosageModal(true)
  }

  const todayStr = today.toISOString().slice(0, 10)

  // Build grid cells (null = empty)
  const cells: (number | null)[] = [
    ...Array(startOffset).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]
  // Pad to complete rows of 7
  while (cells.length % 7 !== 0) cells.push(null)

  return (
    <div className="space-y-4">
      {/* Navigation mois */}
      <div className="flex items-center justify-between">
        <button onClick={prevMonth} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">
          <ChevronLeft size={20} />
        </button>
        <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100">
          {MOIS_FR[month]} {year}
        </h3>
        <button onClick={nextMonth} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">
          <ChevronRight size={20} />
        </button>
      </div>

      {/* Légende : la couleur est reprise sous chaque icône dans les cases */}
      <div className="flex flex-wrap gap-3 text-xs">
        {LEGEND_CATEGORIES.map(cat => (
          <span key={cat} className="flex items-center gap-1 text-gray-600 dark:text-gray-300">
            <span className={`w-2.5 h-2.5 rounded-full ${CATEGORY_COLORS[cat]}`} />
            {CATEGORY_LABELS[cat]}
          </span>
        ))}
        <span className="flex items-center gap-1 text-gray-600 dark:text-gray-300">
          <span>⏳</span>
          Récolte prévue
        </span>
      </div>

      {/* Grille */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
        {/* Jours de la semaine */}
        <div className="grid grid-cols-7 border-b border-gray-200 dark:border-gray-700">
          {JOURS.map(j => (
            <div key={j} className="text-center text-xs font-semibold text-gray-500 dark:text-gray-400 dark:text-gray-500 py-2">{j}</div>
          ))}
        </div>

        {/* Cases */}
        <div className="grid grid-cols-7">
          {cells.map((day, idx) => {
            if (!day) return <div key={idx} className="border-r border-b border-gray-100 dark:border-gray-700 min-h-[80px] bg-gray-50 dark:bg-gray-900/40" />
            const ds = dateStr(year, month, day)
            const dayActions = actionsByDay[ds] || []
            const isToday = ds === todayStr
            const isSelected = ds === selectedDay
            const isFuture = ds > todayStr

            const harvestWindow = harvestWindowByDay[ds]
            const hasRealHarvest = dayActions.some(a => a.type_action === 'recolte')

            return (
              <div
                key={ds}
                onClick={() => setSelectedDay(isSelected ? null : ds)}
                className={`border-r border-b border-gray-100 dark:border-gray-700 min-h-[80px] p-1.5 cursor-pointer transition-colors
                  ${isSelected ? 'bg-grow-50 border-grow-200' : 'hover:bg-gray-50 dark:hover:bg-gray-700/40'}
                  ${isFuture ? 'opacity-60' : ''}`}
              >
                {/* Numéro du jour */}
                <div className={`text-xs font-semibold mb-1 w-6 h-6 flex items-center justify-center rounded-full
                  ${isToday ? 'bg-grow-600 text-white' : 'text-gray-700 dark:text-gray-200'}`}>
                  {day}
                </div>

                {/* Fenêtre de récolte prévue : une ligne par variété */}
                {harvestWindow && !hasRealHarvest && (
                  <div className="mb-0.5">
                    {harvestWindow.slice(0, 3).map(e => (
                      <div key={e.varName}
                        className="flex items-center gap-0.5 leading-tight rounded bg-amber-100/80 dark:bg-amber-900/40 px-0.5 mb-0.5"
                        title={`Récolte prévue — ${e.varName} : ${e.plantNames.join(', ')}`}>
                        <span className="text-[10px]">⏳</span>
                        <span className="text-[9px] text-amber-800 dark:text-amber-300 font-semibold truncate">
                          {e.varName}{e.plantNames.length > 1 ? ` ×${e.plantNames.length}` : ''}
                        </span>
                      </div>
                    ))}
                    {harvestWindow.length > 3 && (
                      <span className="text-[9px] text-amber-700 dark:text-amber-400">+{harvestWindow.length - 3} variété(s)</span>
                    )}
                  </div>
                )}

                {/* Actions du jour, regroupées par type : icône + compteur + trait de couleur de la catégorie */}
                <div className="flex flex-wrap gap-1">
                  {(() => {
                    const groups: { type: string; actions: Action[] }[] = []
                    for (const a of dayActions) {
                      // Les récoltes prévues sont déjà affichées par la fenêtre ci-dessus
                      if (a.type_action === 'recolte_prevue' && harvestWindow) continue
                      const g = groups.find(x => x.type === a.type_action)
                      if (g) g.actions.push(a)
                      else groups.push({ type: a.type_action, actions: [a] })
                    }
                    return groups.slice(0, 6).map(g => {
                      const def = ACTION_MAP[g.type]
                      const isPrevue = g.type === 'recolte_prevue'
                      const color = isPrevue ? 'bg-amber-400' : def ? CATEGORY_COLORS[def.category] : 'bg-gray-400'
                      const label = isPrevue ? 'Récolte prévue' : (def?.label || g.type)
                      const cibles = g.actions.map(a => a.global_culture ? 'espace' : a.nom_plant).filter(Boolean)
                      return (
                        <span key={g.type}
                          title={`${label}${g.actions.length > 1 ? ` ×${g.actions.length}` : ''}${cibles.length ? ` (${[...new Set(cibles)].join(', ')})` : ''}`}
                          className="relative flex items-center gap-0.5 pb-1 leading-none flex-shrink-0">
                          <span className="text-[12px]">{isPrevue ? '⏳' : (def?.icon ?? '•')}</span>
                          {g.actions.length > 1 && (
                            <span className="text-[9px] font-semibold text-gray-500 dark:text-gray-400">×{g.actions.length}</span>
                          )}
                          <span className={`absolute left-0 right-0 bottom-0 h-[3px] rounded-full ${color}`} />
                        </span>
                      )
                    })
                  })()}
                  {(() => {
                    const nbTypes = new Set(dayActions.filter(a => !(a.type_action === 'recolte_prevue' && harvestWindow)).map(a => a.type_action)).size
                    return nbTypes > 6 ? <span className="text-[10px] text-gray-400 dark:text-gray-500">+{nbTypes - 6}</span> : null
                  })()}
                </div>

                {/* Boutons si jour sélectionné */}
                {isSelected && (
                  <div className="mt-1 flex gap-0.5">
                    <button
                      onClick={e => { e.stopPropagation(); openArrosageModal(ds) }}
                      className="flex-1 flex items-center justify-center gap-0.5 text-[10px] text-blue-500 hover:text-blue-700 font-medium"
                      title="Arrosage / Récolte / Rempotage"
                    >
                      💧
                    </button>
                    <button
                      onClick={e => { e.stopPropagation(); openAddAction(ds) }}
                      className="flex-1 flex items-center justify-center gap-0.5 text-[10px] text-grow-600 hover:text-grow-800 font-medium"
                      title="Autre action"
                    >
                      <Plus size={10} />
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Panneau du jour sélectionné */}
      {selectedDay && (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="font-semibold text-gray-800 dark:text-gray-100">
              {new Date(selectedDay + 'T12:00:00').toLocaleDateString('fr-FR', {
                weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
              })}
            </h4>
            <div className="flex items-center gap-2">
              <button
                onClick={() => openArrosageModal(selectedDay)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-500 text-white rounded-lg text-sm hover:bg-blue-600"
              >
                <Droplets size={14} /> Arrosage
              </button>
              <button
                onClick={() => openAddAction(selectedDay)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-grow-600 text-white rounded-lg text-sm hover:bg-grow-700"
              >
                <Plus size={14} /> Action
              </button>
            </div>
          </div>

          {/* Courbes température / humidité / VPD du jour */}
          <SensorDayChart
            date={selectedDay}
            idEspace={espaceAtDate(emplacements, selectedDay, idEspace)}
          />

          {actionsByDay[selectedDay]?.length ? (() => {
            const { wateringGroups, other } = groupWateringActions(actionsByDay[selectedDay])
            return (
              <div className="space-y-2">

                {/* ── Arrosages regroupés ─────────────────────────────── */}
                {wateringGroups.map((group, gi) => (
                  <div key={gi} className="flex items-start gap-2 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-100 dark:border-blue-800 group">
                    <span className={`w-2.5 h-2.5 rounded-full ${WATERING_COLORS[group.type_action] ?? 'bg-blue-400'} mt-1 flex-shrink-0`} />
                    <div className="flex-1 min-w-0 space-y-0.5">
                      {/* Titre */}
                      <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">
                        {WATERING_ICONS[group.type_action]} {WATERING_LABELS[group.type_action] ?? group.type_action}
                        {group.volTotal ? <span className="font-normal text-gray-600 dark:text-gray-300"> — {formatVolume(group.volTotal)}</span> : ''}
                      </p>

                      {/* Plantes */}
                      {group.isGlobal ? (
                        <p className="text-xs text-gray-600 dark:text-gray-300">
                          🌿 Tout l'espace{group.nbPlantes ? ` (${group.nbPlantes} plantes)` : ''}
                        </p>
                      ) : group.plantNames.length > 0 ? (
                        <p className="text-xs text-gray-600 dark:text-gray-300">
                          🌿 {group.plantNames.join(', ')} ({group.plantNames.length} plante{group.plantNames.length > 1 ? 's' : ''})
                        </p>
                      ) : null}

                      {/* Volume par plante */}
                      {group.volParPlante ? (
                        <p className="text-xs text-blue-700 dark:text-blue-300 font-medium">
                          🪴 {formatVolume(group.volParPlante)} par plante
                        </p>
                      ) : null}

                      {/* pH cible */}
                      {group.phCible ? (
                        <p className="text-xs text-gray-600 dark:text-gray-300">
                          <span className="font-medium">pH cible :</span> {group.phCible}
                        </p>
                      ) : null}

                      {/* Recette */}
                      {group.nomRecette ? (
                        <p className="text-xs text-gray-600 dark:text-gray-300">
                          <span className="font-medium">Recette :</span> {group.nomRecette}
                        </p>
                      ) : null}

                      {/* Produits utilisés */}
                      {group.produitsCalcules && group.produitsCalcules.length > 0 ? (
                        <p className="text-xs text-gray-600 dark:text-gray-300">
                          <span className="font-medium">Produits :</span>{' '}
                          {group.produitsCalcules.map((p: any) =>
                            `${p.nom} ${p.quantite}${(p.unite ?? '').replace('/L', '')}`
                          ).join(', ')}
                        </p>
                      ) : null}

                      {/* Note (première action du groupe) */}
                      {group.actions[0]?.note && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500 italic">📝 {group.actions[0].note}</p>
                      )}
                    </div>
                    <button
                      onClick={() => group.actions.forEach(a => deleteAction.mutate(a.id_action))}
                      className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 text-xs px-1 transition-opacity"
                      title="Supprimer"
                    >
                      ×
                    </button>
                  </div>
                ))}

                {/* ── Autres actions (non-arrosage) ──────────────────── */}
                {other.map(action => {
                  const def = ACTION_MAP[action.type_action]
                  const colorClass = def ? CATEGORY_COLORS[def.category] : 'bg-gray-400'
                  return (
                    <div key={action.id_action}
                      className="flex items-start gap-2 p-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg group">
                      <span className={`w-2.5 h-2.5 rounded-full ${colorClass} mt-1 flex-shrink-0`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-800 dark:text-gray-100">
                          {def?.icon} {def?.label || action.type_action}
                        </p>
                        {action.nom_plant && !action.global_culture && (
                          <p className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500">🌿 {action.nom_plant}</p>
                        )}
                        {action.global_culture && (
                          <p className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500">🌿 Tout l'espace</p>
                        )}
                        {action.parametres && Object.keys(action.parametres).length > 0 && (
                          <p className="text-xs text-gray-600 dark:text-gray-300 mt-0.5">
                            {formatActionParams(action.type_action, action.parametres as Record<string, unknown>)}
                          </p>
                        )}
                        {action.note && (
                          <p className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500 italic mt-0.5">📝 {action.note}</p>
                        )}
                      </div>
                      <button
                        onClick={() => deleteAction.mutate(action.id_action)}
                        className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 text-xs px-1 transition-opacity"
                        title="Supprimer"
                      >
                        ×
                      </button>
                    </div>
                  )
                })}
              </div>
            )
          })() : (
            <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-2">Aucune action ce jour</p>
          )}
        </div>
      )}

      {/* ── Récoltes prévues (résumé par variété) ───────────────────────── */}
      {(() => {
        const actives = plants.filter(p => !STATUTS_SANS_PREVISION.includes(p.statut || ''))
        if (actives.length === 0) return null
        const sansDuree = actives.filter(p => !p.duree_flo_min && !p.duree_flo_max)
        const fmt = (d: Date) => d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
        const today2 = new Date(); today2.setHours(12, 0, 0, 0)

        // Regroupement par variété + même fenêtre
        const byVar = new Map<string, { r: HarvestRange; plants: string[] }>()
        for (const r of harvestRanges) {
          const key = `${r.varName}|${localDateStr(r.dateMin)}|${localDateStr(r.dateMax)}`
          const e = byVar.get(key)
          const nom = r.plant.nom_affichage ?? `Plant #${r.plant.id_plant}`
          if (e) e.plants.push(nom); else byVar.set(key, { r, plants: [nom] })
        }
        const rows = [...byVar.values()].sort((a, b) => a.r.dateMin.getTime() - b.r.dateMin.getTime())
        const baseCulture = harvestRanges.some(r => r.baseCulture)

        return (
          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4">
            <h4 className="text-sm font-semibold text-amber-800 dark:text-amber-300 mb-3 flex items-center gap-2">
              <span>⏳</span> Récoltes prévues
            </h4>
            {rows.length === 0 ? (
              <p className="text-xs text-amber-800 dark:text-amber-300">
                Pas encore de date : la fenêtre de récolte se calcule à partir du début de floraison.
                Saisis l'action « Début floraison » (🌸) sur les plantes concernées pour la voir apparaître dans le calendrier.
              </p>
            ) : (
              <div className="space-y-2">
                {rows.map(({ r, plants: noms }) => {
                  const daysUntilMin = Math.round((r.dateMin.getTime() - today2.getTime()) / 86400000)
                  const daysUntilMax = Math.round((r.dateMax.getTime() - today2.getTime()) / 86400000)
                  const isPast = daysUntilMax < 0
                  const isNow = daysUntilMin <= 0 && daysUntilMax >= 0
                  return (
                    <div key={`${r.varName}-${r.dateMin.getTime()}`} className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <span className="text-sm text-amber-900 dark:text-amber-200 font-semibold">{r.varName}</span>
                        <span className="text-xs text-amber-700 dark:text-amber-400 ml-1.5">
                          ({noms.length > 1 ? `${noms.length} plantes` : noms[0]})
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-xs flex-shrink-0">
                        <span className="text-amber-700 dark:text-amber-400">{fmt(r.dateMin)} → {fmt(r.dateMax)}</span>
                        {isNow && (
                          <span className="px-2 py-0.5 bg-amber-400 text-white rounded-full font-semibold animate-pulse">Maintenant !</span>
                        )}
                        {!isPast && !isNow && <span className="text-amber-600 dark:text-amber-400">dans {daysUntilMin}j</span>}
                        {isPast && <span className="text-red-500 font-medium">En retard</span>}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
            {baseCulture && rows.length > 0 && (
              <p className="text-[11px] text-amber-700 dark:text-amber-400 mt-2 italic">
                Certaines plantes n'ont pas leur propre « Début floraison » : la date de floraison (ou de passage 12/12) de la culture est utilisée.
              </p>
            )}
            {sansDuree.length > 0 && (
              <p className="text-[11px] text-amber-700 dark:text-amber-400 mt-2 italic">
                Sans durée de floraison connue (variété non renseignée ou clone) : {sansDuree.map(p => p.nom_affichage ?? `#${p.id_plant}`).join(', ')}.
              </p>
            )}
          </div>
        )
      })()}

      {/* Modal d'ajout d'action */}
      {showModal && (
        <ActionModal
          cultureId={cultureId}
          idEspace={idEspace}
          plants={plants}
          initialDate={modalDate}
          onClose={() => setShowModal(false)}
          onSubmit={async (data) => { await createAction.mutateAsync(data) }}
        />
      )}

      {/* Modal arrosage / récolte / rempotage */}
      {showArrosageModal && (
        <ArrosageModal
          cultureId={cultureId}
          plants={plants}
          initialDate={modalDate}
          onClose={() => setShowArrosageModal(false)}
          onSubmit={async (data) => { await createAction.mutateAsync(data) }}
        />
      )}
    </div>
  )
}
