/**
 * CalendrierGlobal — Vue mensuelle de tous les events de toutes les cultures
 * Route: /calendrier
 */
import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight, Calendar, Filter } from 'lucide-react'
import { getCalendrierEvents, getCulturesRef, CalendrierEvent, CultureRef } from '../api/calendrier'

// ─── Palette couleurs par culture (cycle) ────────────────────────────────────
const CULTURE_COLORS = [
  { bg: 'bg-emerald-100 dark:bg-emerald-900/40', text: 'text-emerald-800 dark:text-emerald-200', dot: 'bg-emerald-500', border: 'border-emerald-300 dark:border-emerald-700' },
  { bg: 'bg-blue-100 dark:bg-blue-900/40',       text: 'text-blue-800 dark:text-blue-200',       dot: 'bg-blue-500',    border: 'border-blue-300 dark:border-blue-700' },
  { bg: 'bg-violet-100 dark:bg-violet-900/40',   text: 'text-violet-800 dark:text-violet-200',   dot: 'bg-violet-500',  border: 'border-violet-300 dark:border-violet-700' },
  { bg: 'bg-amber-100 dark:bg-amber-900/40',     text: 'text-amber-800 dark:text-amber-200',     dot: 'bg-amber-500',   border: 'border-amber-300 dark:border-amber-700' },
  { bg: 'bg-rose-100 dark:bg-rose-900/40',       text: 'text-rose-800 dark:text-rose-200',       dot: 'bg-rose-500',    border: 'border-rose-300 dark:border-rose-700' },
  { bg: 'bg-cyan-100 dark:bg-cyan-900/40',       text: 'text-cyan-800 dark:text-cyan-200',       dot: 'bg-cyan-500',    border: 'border-cyan-300 dark:border-cyan-700' },
  { bg: 'bg-orange-100 dark:bg-orange-900/40',   text: 'text-orange-800 dark:text-orange-200',   dot: 'bg-orange-500',  border: 'border-orange-300 dark:border-orange-700' },
  { bg: 'bg-teal-100 dark:bg-teal-900/40',       text: 'text-teal-800 dark:text-teal-200',       dot: 'bg-teal-500',    border: 'border-teal-300 dark:border-teal-700' },
]

// ─── Icônes / labels par type d'action ───────────────────────────────────────
const ACTION_META: Record<string, { emoji: string; label: string }> = {
  graine_germee:      { emoji: '🌱', label: 'Germination' },
  debut_croissance:   { emoji: '🌿', label: 'Début croissance' },
  debut_floraison:    { emoji: '🌸', label: 'Début floraison' },
  passage_12_12:      { emoji: '🔆', label: 'Passage 12/12' },
  arrosage_eau:       { emoji: '💧', label: 'Arrosage eau' },
  arrosage_engrais:   { emoji: '🧪', label: 'Arrosage engrais' },
  taille:             { emoji: '✂️', label: 'Taille' },
  defoliation:        { emoji: '🍂', label: 'Défoliation' },
  recolte:            { emoji: '🌾', label: 'Récolte' },
  observations:       { emoji: '📝', label: 'Observation' },
  traitement:         { emoji: '🔬', label: 'Traitement' },
  debut_curing:       { emoji: '🏺', label: 'Début curing' },
  debut_sechage:      { emoji: '🌬️', label: 'Début séchage' },
  ouverture_bocal:    { emoji: '🫙', label: 'Burping bocal' },
}

function actionMeta(type: string) {
  return ACTION_META[type] ?? { emoji: '📌', label: type }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function daysInMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate()
}

/** 0=Lun … 6=Dim (calendrier européen) */
function firstDayOfWeek(year: number, month: number) {
  const d = new Date(year, month - 1, 1).getDay() // 0=Sun
  return (d + 6) % 7
}

const MONTH_NAMES = [
  'Janvier','Février','Mars','Avril','Mai','Juin',
  'Juillet','Août','Septembre','Octobre','Novembre','Décembre',
]
const DAY_NAMES = ['Lun','Mar','Mer','Jeu','Ven','Sam','Dim']

function isoDate(year: number, month: number, day: number) {
  return `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`
}

function todayIso() {
  const d = new Date()
  return isoDate(d.getFullYear(), d.getMonth()+1, d.getDate())
}

// ─── Composant EventChip ─────────────────────────────────────────────────────

function EventChip({
  event,
  color,
  onClick,
}: {
  event: CalendrierEvent
  color: typeof CULTURE_COLORS[0]
  onClick: (e: CalendrierEvent) => void
}) {
  const meta = actionMeta(event.type_action)
  return (
    <button
      onClick={() => onClick(event)}
      title={`${event.culture_nom}${event.plant_nom ? ' — ' + event.plant_nom : ''} : ${meta.label}`}
      className={`w-full text-left text-xs px-1.5 py-0.5 rounded truncate flex items-center gap-1 ${color.bg} ${color.text} hover:opacity-80 transition-opacity`}
    >
      <span className="shrink-0">{meta.emoji}</span>
      <span className="truncate">{meta.label}</span>
    </button>
  )
}

// ─── Drawer détail d'un event ────────────────────────────────────────────────

function EventDrawer({
  event,
  color,
  onClose,
}: {
  event: CalendrierEvent
  color: typeof CULTURE_COLORS[0]
  onClose: () => void
}) {
  const meta = actionMeta(event.type_action)
  const dateLabel = new Date(event.date_action).toLocaleString('fr-FR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })

  const params = event.parametres
  const paramEntries = params && typeof params === 'object' ? Object.entries(params) : []

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40" />
      <div
        className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md p-6 z-10"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <span className="text-3xl">{meta.emoji}</span>
            <div>
              <p className="font-semibold text-gray-900 dark:text-white">{meta.label}</p>
              <p className="text-sm text-gray-500 dark:text-gray-400 capitalize">{dateLabel}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-xl leading-none">×</button>
        </div>

        {/* Culture badge */}
        <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium mb-4 ${color.bg} ${color.text}`}>
          <span className={`w-2 h-2 rounded-full ${color.dot}`} />
          {event.culture_nom}
          {event.plant_nom && <span className="opacity-70">— {event.plant_nom}</span>}
        </div>

        {/* Scope */}
        <div className="text-xs text-gray-500 dark:text-gray-400 mb-3">
          {event.global_culture ? '🌍 Action globale (toute la culture)' : `🪴 Plante : ${event.plant_nom ?? '—'}`}
        </div>

        {/* Paramètres */}
        {paramEntries.length > 0 && (
          <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-3 mb-3 text-sm space-y-1">
            {paramEntries.map(([k, v]) => (
              <div key={k} className="flex justify-between gap-2">
                <span className="text-gray-500 dark:text-gray-400 capitalize">{k.replace(/_/g,' ')}</span>
                <span className="font-medium text-gray-800 dark:text-gray-200">{String(v)}</span>
              </div>
            ))}
          </div>
        )}

        {/* Note */}
        {event.note && (
          <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-xl p-3 text-sm text-gray-700 dark:text-gray-300">
            📝 {event.note}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Composant DayCell ────────────────────────────────────────────────────────

function DayCell({
  day,
  events,
  colorMap,
  isToday,
  onEventClick,
}: {
  day: number
  events: CalendrierEvent[]
  colorMap: Map<number, typeof CULTURE_COLORS[0]>
  isToday: boolean
  onEventClick: (e: CalendrierEvent) => void
}) {
  const MAX_VISIBLE = 3
  const visible  = events.slice(0, MAX_VISIBLE)
  const overflow = events.length - MAX_VISIBLE

  return (
    <div className={`min-h-[90px] p-1.5 border-b border-r border-gray-100 dark:border-gray-700 flex flex-col gap-0.5 ${isToday ? 'bg-grow-50 dark:bg-grow-900/20' : ''}`}>
      <span className={`text-xs font-semibold mb-0.5 w-6 h-6 flex items-center justify-center rounded-full ${
        isToday
          ? 'bg-grow-600 text-white'
          : 'text-gray-600 dark:text-gray-300'
      }`}>
        {day}
      </span>

      {visible.map(evt => (
        <EventChip
          key={evt.id_action}
          event={evt}
          color={colorMap.get(evt.id_culture) ?? CULTURE_COLORS[0]}
          onClick={onEventClick}
        />
      ))}

      {overflow > 0 && (
        <span className="text-xs text-gray-400 dark:text-gray-500 pl-1">+{overflow} autre{overflow > 1 ? 's' : ''}</span>
      )}
    </div>
  )
}

// ─── Page principale ──────────────────────────────────────────────────────────

export default function CalendrierGlobal() {
  const today = new Date()
  const [year,  setYear]  = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth() + 1)
  const [selectedEvent, setSelectedEvent] = useState<CalendrierEvent | null>(null)
  const [filteredCultures, setFilteredCultures] = useState<Set<number>>(new Set())
  const [showFilters, setShowFilters] = useState(false)

  // ── Données ──────────────────────────────────────────────────────────────
  const { data: events = [], isLoading: loadingEvents } = useQuery({
    queryKey: ['calendrier', year, month],
    queryFn: () => getCalendrierEvents(year, month),
  })

  const { data: culturesRef = [] } = useQuery({
    queryKey: ['calendrier-cultures'],
    queryFn: getCulturesRef,
    staleTime: 5 * 60 * 1000,
  })

  // ── Map couleur par culture ───────────────────────────────────────────────
  const colorMap = useMemo<Map<number, typeof CULTURE_COLORS[0]>>(() => {
    const map = new Map<number, typeof CULTURE_COLORS[0]>()
    // Trier par date pour avoir des couleurs stables
    const sorted = [...culturesRef].sort((a, b) =>
      (a.date_debut ?? '').localeCompare(b.date_debut ?? '')
    )
    sorted.forEach((c, i) => {
      map.set(c.id_culture, CULTURE_COLORS[i % CULTURE_COLORS.length])
    })
    return map
  }, [culturesRef])

  // ── Cultures présentes ce mois ────────────────────────────────────────────
  const culturesThisMonth = useMemo<CultureRef[]>(() => {
    const ids = new Set(events.map(e => e.id_culture))
    return culturesRef.filter(c => ids.has(c.id_culture))
  }, [events, culturesRef])

  // ── Events filtrés ────────────────────────────────────────────────────────
  const visibleEvents = useMemo(() =>
    filteredCultures.size === 0
      ? events
      : events.filter(e => filteredCultures.has(e.id_culture)),
    [events, filteredCultures]
  )

  // ── Events par jour (clé: "YYYY-MM-DD") ──────────────────────────────────
  const eventsByDay = useMemo<Map<string, CalendrierEvent[]>>(() => {
    const map = new Map<string, CalendrierEvent[]>()
    for (const evt of visibleEvents) {
      const key = evt.date_action.slice(0, 10) // "2026-05-14"
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(evt)
    }
    return map
  }, [visibleEvents])

  // ── Grille calendrier ─────────────────────────────────────────────────────
  const nbDays   = daysInMonth(year, month)
  const startDay = firstDayOfWeek(year, month)  // 0=Lun
  const totalCells = Math.ceil((startDay + nbDays) / 7) * 7
  const todayStr = todayIso()

  // ── Navigation ────────────────────────────────────────────────────────────
  const prevMonth = () => {
    if (month === 1) { setMonth(12); setYear(y => y - 1) }
    else setMonth(m => m - 1)
  }
  const nextMonth = () => {
    if (month === 12) { setMonth(1); setYear(y => y + 1) }
    else setMonth(m => m + 1)
  }
  const goToday = () => { setYear(today.getFullYear()); setMonth(today.getMonth() + 1) }

  // ── Toggle filtre culture ─────────────────────────────────────────────────
  const toggleCulture = (id: number) => {
    setFilteredCultures(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  // ── Drawer de l'event sélectionné ────────────────────────────────────────
  const selectedColor = selectedEvent
    ? (colorMap.get(selectedEvent.id_culture) ?? CULTURE_COLORS[0])
    : CULTURE_COLORS[0]

  return (
    <div className="space-y-4">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Calendar className="text-grow-600 dark:text-grow-400" size={24} />
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Calendrier global
          </h1>
        </div>

        {/* Navigation mois */}
        <div className="flex items-center gap-2">
          <button
            onClick={prevMonth}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 transition-colors"
          >
            <ChevronLeft size={18} />
          </button>

          <span className="font-semibold text-lg text-gray-800 dark:text-white min-w-[160px] text-center">
            {MONTH_NAMES[month - 1]} {year}
          </span>

          <button
            onClick={nextMonth}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 transition-colors"
          >
            <ChevronRight size={18} />
          </button>

          <button
            onClick={goToday}
            className="ml-2 px-3 py-1.5 rounded-lg text-sm bg-grow-600 text-white hover:bg-grow-700 transition-colors"
          >
            Aujourd'hui
          </button>

          <button
            onClick={() => setShowFilters(f => !f)}
            className={`ml-1 p-2 rounded-lg transition-colors ${
              showFilters || filteredCultures.size > 0
                ? 'bg-grow-100 dark:bg-grow-900/40 text-grow-700 dark:text-grow-300'
                : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300'
            }`}
            title="Filtrer par culture"
          >
            <Filter size={18} />
            {filteredCultures.size > 0 && (
              <span className="ml-1 text-xs font-bold">{filteredCultures.size}</span>
            )}
          </button>
        </div>
      </div>

      {/* ── Filtres cultures ── */}
      {showFilters && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Filtrer par culture
              {culturesThisMonth.length === 0 && (
                <span className="ml-2 text-gray-400">— aucune culture ce mois</span>
              )}
            </p>
            {filteredCultures.size > 0 && (
              <button
                onClick={() => setFilteredCultures(new Set())}
                className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 underline"
              >
                Tout afficher
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {culturesRef.map(c => {
              const color = colorMap.get(c.id_culture) ?? CULTURE_COLORS[0]
              const active = filteredCultures.has(c.id_culture)
              return (
                <button
                  key={c.id_culture}
                  onClick={() => toggleCulture(c.id_culture)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium border transition-all ${
                    active
                      ? `${color.bg} ${color.text} ${color.border}`
                      : 'bg-gray-50 dark:bg-gray-700 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                  }`}
                >
                  <span className={`w-2.5 h-2.5 rounded-full ${color.dot}`} />
                  <span>{c.nom}</span>
                  {c.statut === 'terminee' && <span className="opacity-50 text-xs">(archivée)</span>}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Grille calendrier ── */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        {/* En-têtes jours */}
        <div className="grid grid-cols-7 bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700">
          {DAY_NAMES.map(d => (
            <div key={d} className="py-2 text-center text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
              {d}
            </div>
          ))}
        </div>

        {/* Cellules */}
        {loadingEvents ? (
          <div className="h-96 flex items-center justify-center text-gray-400">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-grow-600" />
          </div>
        ) : (
          <div className="grid grid-cols-7">
            {Array.from({ length: totalCells }, (_, i) => {
              const day = i - startDay + 1
              if (day < 1 || day > nbDays) {
                // Cellule vide (hors mois)
                return (
                  <div
                    key={`empty-${i}`}
                    className="min-h-[90px] p-1.5 border-b border-r border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50"
                  />
                )
              }
              const key = isoDate(year, month, day)
              const dayEvents = eventsByDay.get(key) ?? []
              return (
                <DayCell
                  key={key}
                  day={day}
                  events={dayEvents}
                  colorMap={colorMap}
                  isToday={key === todayStr}
                  onEventClick={setSelectedEvent}
                />
              )
            })}
          </div>
        )}
      </div>

      {/* ── Légende cultures ── */}
      {culturesRef.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
            Légende cultures
          </p>
          <div className="flex flex-wrap gap-3">
            {culturesRef.map(c => {
              const color = colorMap.get(c.id_culture) ?? CULTURE_COLORS[0]
              return (
                <div key={c.id_culture} className="flex items-center gap-2 text-sm">
                  <span className={`w-3 h-3 rounded-full ${color.dot}`} />
                  <span className="text-gray-700 dark:text-gray-300">{c.nom}</span>
                  {c.statut === 'terminee' && <span className="text-gray-400 text-xs">(archivée)</span>}
                  {c.statut === 'active' && <span className="text-emerald-500 text-xs">●</span>}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Stats rapides du mois ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Events ce mois', value: events.length, emoji: '📅' },
          { label: 'Cultures actives', value: culturesThisMonth.filter(c => c.statut === 'active').length, emoji: '🌿' },
          { label: 'Arrosages', value: events.filter(e => e.type_action.startsWith('arrosage')).length, emoji: '💧' },
          { label: 'Traitements', value: events.filter(e => e.type_action === 'traitement').length, emoji: '🔬' },
        ].map(stat => (
          <div key={stat.label} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 text-center">
            <div className="text-2xl mb-1">{stat.emoji}</div>
            <div className="text-2xl font-bold text-gray-900 dark:text-white">{stat.value}</div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* ── Drawer event ── */}
      {selectedEvent && (
        <EventDrawer
          event={selectedEvent}
          color={selectedColor}
          onClose={() => setSelectedEvent(null)}
        />
      )}
    </div>
  )
}
