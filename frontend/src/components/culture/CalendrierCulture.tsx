import { useState, useMemo } from 'react'
import { ChevronLeft, ChevronRight, Plus, Droplets } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { actionAPI, Action, ActionCreate, Plant } from '../../api/cultures'
import { ACTION_MAP, CATEGORY_COLORS } from './actionTypes'
import ActionModal from './ActionModal'
import ArrosageModal from './ArrosageModal'
import SensorDayChart from '../SensorDayChart'

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
  plants: Plant[]
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

export default function CalendrierCulture({ cultureId, idEspace, plants }: Props) {
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

  // Fenêtres de récolte prévues : pour chaque plante qui a date_debut_flo + durées (en jours)
  // Map : dateStr → { entries: { plantName, varName }[] }
  const harvestWindowByDay = useMemo(() => {
    const map: Record<string, { entries: { plantName: string; varName: string }[] }> = {}
    for (const plant of plants) {
      const base = plant.date_debut_flo
      if (!base) continue
      const minDays = plant.duree_flo_min ?? plant.duree_flo_max
      const maxDays = plant.duree_flo_max ?? plant.duree_flo_min
      if (!minDays || !maxDays) continue
      const baseDate = new Date(base + 'T12:00:00')
      const startDate = new Date(baseDate)
      startDate.setDate(startDate.getDate() + minDays)
      const endDate = new Date(baseDate)
      endDate.setDate(endDate.getDate() + maxDays)
      const varName = plant.nom_variete ?? plant.nom_affichage ?? `Plant #${plant.id_plant}`
      // Remplir chaque jour de la fenêtre
      const cursor = new Date(startDate)
      while (cursor <= endDate) {
        const ds = cursor.toISOString().slice(0, 10)
        if (!map[ds]) map[ds] = { entries: [] }
        map[ds].entries.push({ plantName: plant.nom_affichage ?? `Plant #${plant.id_plant}`, varName })
        cursor.setDate(cursor.getDate() + 1)
      }
    }
    return map
  }, [plants])

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

      {/* Légende */}
      <div className="flex flex-wrap gap-3 text-xs">
        {(['germination', 'lampe', 'arrosage', 'stade', 'mesure', 'recolte'] as const).map(cat => (
          <span key={cat} className="flex items-center gap-1 text-gray-600 dark:text-gray-300">
            <span className={`w-2.5 h-2.5 rounded-full ${CATEGORY_COLORS[cat]}`} />
            {cat}
          </span>
        ))}
        <span className="flex items-center gap-1 text-gray-600 dark:text-gray-300">
          <span className="opacity-40">⏳🌾</span>
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
            if (!day) return <div key={idx} className="border-r border-b border-gray-100 dark:border-gray-700 min-h-[80px] bg-gray-50 dark:bg-gray-700/50/30" />
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

                {/* Icône de fenêtre de récolte prévue (client-side range) */}
                {harvestWindow && !hasRealHarvest && (
                  <div className="opacity-50">
                    {harvestWindow.entries.map((e, i) => (
                      <div key={i} className="flex items-center gap-0.5 leading-tight"
                        title={`Récolte prévue — ${e.plantName}`}>
                        <span className="text-[10px]">⏳🌾</span>
                        <span className="text-[9px] text-amber-700 font-medium truncate max-w-[48px]">{e.varName}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Actions du jour */}
                <div className="flex flex-wrap gap-0.5">
                  {dayActions.slice(0, 8).map(action => {
                    const def = ACTION_MAP[action.type_action]
                    const isPrevue = action.type_action === 'recolte_prevue'
                    const params = (action.parametres ?? {}) as Record<string, string>
                    const varName = params.nom_variete ?? action.nom_plant ?? ''
                    const titlePrevue = `Récolte prévue${varName ? ` — ${varName}` : ''}${params.date_min ? ` · du ${params.date_min}` : ''}${params.date_max ? ` au ${params.date_max}` : ''}`
                    return isPrevue ? (
                      <div key={action.id_action}
                        className="flex items-center gap-0.5 opacity-60 leading-tight w-full"
                        title={titlePrevue}>
                        <span className="text-[10px]">⏳🌾</span>
                        {varName && (
                          <span className="text-[9px] text-amber-700 font-semibold truncate max-w-[48px]">{varName}</span>
                        )}
                      </div>
                    ) : (
                      <span
                        key={action.id_action}
                        title={`${def?.label || action.type_action}${action.nom_plant ? ` (${action.nom_plant})` : ''}${action.global_culture ? ' — espace' : ''}`}
                        className="text-[11px] leading-none flex-shrink-0"
                      >
                        {def?.icon ?? '•'}
                      </span>
                    )
                  })}
                  {dayActions.length > 8 && (
                    <span className="text-[10px] text-gray-400 dark:text-gray-500">+{dayActions.length - 8}</span>
                  )}
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
          <SensorDayChart date={selectedDay} idEspace={idEspace} />

          {actionsByDay[selectedDay]?.length ? (() => {
            const { wateringGroups, other } = groupWateringActions(actionsByDay[selectedDay])
            return (
              <div className="space-y-2">

                {/* ── Arrosages regroupés ─────────────────────────────── */}
                {wateringGroups.map((group, gi) => (
                  <div key={gi} className="flex items-start gap-2 p-3 bg-blue-50 rounded-lg border border-blue-100 group">
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
                        <p className="text-xs text-blue-700 font-medium">
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
                            {Object.entries(action.parametres)
                              .filter(([k]) => !['produits', 'produits_calcules', 'produits_consommes'].includes(k))
                              .map(([k, v]) => `${k}: ${v}`)
                              .join(' · ')}
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

      {/* ── Récoltes prévues (résumé par plante) ───────────────────────── */}
      {(() => {
        const plantsWithFlo = plants.filter(p =>
          p.date_debut_flo && (p.duree_flo_min || p.duree_flo_max) &&
          !['recolte', 'sechage', 'curing', 'prete', 'abandonne'].includes(p.statut || '')
        )
        if (plantsWithFlo.length === 0) return null
        return (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
            <h4 className="text-sm font-semibold text-amber-800 mb-3 flex items-center gap-2">
              <span>⏳🌾</span> Récoltes prévues
            </h4>
            <div className="space-y-2">
              {plantsWithFlo.map(plant => {
                const base = new Date(plant.date_debut_flo! + 'T12:00:00')
                const minD = plant.duree_flo_min ?? plant.duree_flo_max!
                const maxD = plant.duree_flo_max ?? plant.duree_flo_min!
                const dateMin = new Date(base)
                dateMin.setDate(dateMin.getDate() + minD)
                const dateMax = new Date(base)
                dateMax.setDate(dateMax.getDate() + maxD)
                const fmt = (d: Date) => d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
                const today2 = new Date()
                today2.setHours(12, 0, 0, 0)
                const daysUntilMin = Math.round((dateMin.getTime() - today2.getTime()) / (1000*60*60*24))
                const daysUntilMax = Math.round((dateMax.getTime() - today2.getTime()) / (1000*60*60*24))
                const isPast = daysUntilMax < 0
                const isNow = daysUntilMin <= 0 && daysUntilMax >= 0
                return (
                  <div key={plant.id_plant} className="flex items-center justify-between gap-2">
                    <div>
                      <span className="text-sm text-amber-900 font-semibold">
                        {plant.nom_variete ?? plant.nom_affichage}
                      </span>
                      {plant.nom_variete && plant.nom_variete !== plant.nom_affichage && (
                        <span className="text-xs text-amber-700 ml-1.5">({plant.nom_affichage})</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-amber-700">
                        {fmt(dateMin)} → {fmt(dateMax)}
                      </span>
                      {isNow && (
                        <span className="px-2 py-0.5 bg-amber-400 text-white rounded-full font-semibold animate-pulse">
                          Maintenant !
                        </span>
                      )}
                      {!isPast && !isNow && (
                        <span className="text-amber-600">dans {daysUntilMin}j</span>
                      )}
                      {isPast && (
                        <span className="text-red-500 font-medium">En retard</span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
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
