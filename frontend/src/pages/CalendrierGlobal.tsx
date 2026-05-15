/**
 * CalendrierGlobal — Vue mensuelle de tous les events de toutes les cultures
 * Route: /calendrier
 */
import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight, Calendar, Filter, FileDown } from 'lucide-react'
import { getCalendrierEvents, getCulturesRef, getCalendrierExport, CalendrierEvent, CultureRef } from '../api/calendrier'
import SensorDayChart from '../components/SensorDayChart'

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
      onClick={ev => { ev.stopPropagation(); onClick(event) }}
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

// ─── Modal vue journée ────────────────────────────────────────────────────────

function DayModal({
  dateStr,
  events,
  colorMap,
  onEventClick,
  onClose,
}: {
  dateStr: string
  events: CalendrierEvent[]
  colorMap: Map<number, typeof CULTURE_COLORS[0]>
  onEventClick: (e: CalendrierEvent) => void
  onClose: () => void
}) {
  const dateLabel = new Date(dateStr + 'T12:00:00').toLocaleDateString('fr-FR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })

  // Grouper les events par type_action
  const groups = useMemo(() => {
    const map = new Map<string, CalendrierEvent[]>()
    for (const evt of events) {
      if (!map.has(evt.type_action)) map.set(evt.type_action, [])
      map.get(evt.type_action)!.push(evt)
    }
    return map
  }, [events])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div
        className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col z-10"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-700 shrink-0">
          <div>
            <h2 className="font-bold text-gray-900 dark:text-white capitalize">{dateLabel}</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {events.length} événement{events.length > 1 ? 's' : ''}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-xl leading-none w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            ×
          </button>
        </div>

        {/* Corps : groupes par type + courbes capteurs */}
        <div className="overflow-y-auto flex-1 px-6 py-4 space-y-5">
          {[...groups.entries()].map(([type, evts]) => {
            const meta = actionMeta(type)
            return (
              <div key={type}>
                {/* Titre du groupe */}
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-base">{meta.emoji}</span>
                  <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">{meta.label}</span>
                  <span className="text-xs text-gray-400 dark:text-gray-500 ml-auto">
                    {evts.length} event{evts.length > 1 ? 's' : ''}
                  </span>
                </div>

                {/* Events du groupe */}
                <div className="space-y-1.5 pl-6">
                  {evts.map(evt => {
                    const color = colorMap.get(evt.id_culture) ?? CULTURE_COLORS[0]
                    return (
                      <button
                        key={evt.id_action}
                        onClick={() => { onClose(); onEventClick(evt) }}
                        className={`w-full text-left px-3 py-2 rounded-xl border text-sm flex items-center gap-2 hover:opacity-80 transition-opacity ${color.bg} ${color.text} ${color.border}`}
                      >
                        <span className={`w-2 h-2 rounded-full shrink-0 ${color.dot}`} />
                        <span className="font-medium">{evt.culture_nom}</span>
                        {evt.plant_nom && (
                          <span className="opacity-70 truncate">— {evt.plant_nom}</span>
                        )}
                        {evt.global_culture && (
                          <span className="opacity-50 text-xs ml-auto shrink-0">global</span>
                        )}
                      </button>
                    )
                  })}
                </div>
              </div>
            )
          })}

          {/* Courbes température / humidité / VPD du jour */}
          <SensorDayChart date={dateStr} />
        </div>
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
  onDayClick,
}: {
  day: number
  events: CalendrierEvent[]
  colorMap: Map<number, typeof CULTURE_COLORS[0]>
  isToday: boolean
  onEventClick: (e: CalendrierEvent) => void
  onDayClick: () => void
}) {
  const MAX_VISIBLE = 3

  // Grouper les events par type_action
  const groups = useMemo(() => {
    const map = new Map<string, CalendrierEvent[]>()
    for (const evt of events) {
      if (!map.has(evt.type_action)) map.set(evt.type_action, [])
      map.get(evt.type_action)!.push(evt)
    }
    return [...map.entries()] // [type_action, events[]]
  }, [events])

  const visibleGroups = groups.slice(0, MAX_VISIBLE)
  const overflow = groups.length - MAX_VISIBLE

  return (
    <div
      className={`min-h-[90px] p-1.5 border-b border-r border-gray-100 dark:border-gray-700 flex flex-col gap-0.5 cursor-pointer group ${isToday ? 'bg-grow-50 dark:bg-grow-900/20' : 'hover:bg-gray-50 dark:hover:bg-gray-700/30'} transition-colors`}
      onClick={onDayClick}
    >
      <span className={`text-xs font-semibold mb-0.5 w-6 h-6 flex items-center justify-center rounded-full ${
        isToday
          ? 'bg-grow-600 text-white'
          : 'text-gray-600 dark:text-gray-300 group-hover:bg-gray-200 dark:group-hover:bg-gray-600 transition-colors'
      }`}>
        {day}
      </span>

      {visibleGroups.map(([type, evts]) => {
        // Groupe unique → chip couleur culture, clic direct sur l'event
        if (evts.length === 1) {
          return (
            <EventChip
              key={type}
              event={evts[0]}
              color={colorMap.get(evts[0].id_culture) ?? CULTURE_COLORS[0]}
              onClick={onEventClick}
            />
          )
        }
        // Groupe multiple → chip neutre avec compteur, clic ouvre le day modal
        const meta = actionMeta(type)
        return (
          <button
            key={type}
            onClick={ev => { ev.stopPropagation(); onDayClick() }}
            className="w-full text-left text-xs px-1.5 py-0.5 rounded truncate flex items-center gap-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
          >
            <span className="shrink-0">{meta.emoji}</span>
            <span className="truncate flex-1">{meta.label}</span>
            <span className="shrink-0 font-semibold text-gray-500 dark:text-gray-400">×{evts.length}</span>
          </button>
        )
      })}

      {overflow > 0 && (
        <span className="text-xs text-gray-400 dark:text-gray-500 pl-1 hover:text-gray-600 dark:hover:text-gray-300">
          +{overflow} type{overflow > 1 ? 's' : ''}
        </span>
      )}
    </div>
  )
}

// ─── Génération HTML pour export PDF ─────────────────────────────────────────

const ACTION_COLORS_PDF: Record<string, string> = {
  graine_germee:    '#10b981',
  debut_croissance: '#22c55e',
  debut_floraison:  '#ec4899',
  passage_12_12:    '#f59e0b',
  arrosage_eau:     '#3b82f6',
  arrosage_engrais: '#8b5cf6',
  taille:           '#6b7280',
  defoliation:      '#f97316',
  recolte:          '#84cc16',
  observations:     '#fbbf24',
  traitement:       '#ef4444',
  debut_curing:     '#a78bfa',
  debut_sechage:    '#94a3b8',
  ouverture_bocal:  '#c084fc',
}

function generateCalendarPDF(
  events: CalendrierEvent[],
  dateDebut: string,
  dateFin: string,
) {
  // Grouper par jour
  const byDay = new Map<string, CalendrierEvent[]>()
  for (const evt of events) {
    const key = evt.date_action.slice(0, 10)
    if (!byDay.has(key)) byDay.set(key, [])
    byDay.get(key)!.push(evt)
  }

  // Générer la liste de tous les jours dans l'intervalle
  const days: string[] = []
  const cur = new Date(dateDebut + 'T12:00:00')
  const end = new Date(dateFin   + 'T12:00:00')
  while (cur <= end) {
    days.push(cur.toISOString().slice(0, 10))
    cur.setDate(cur.getDate() + 1)
  }

  const fmtDate = (iso: string) =>
    new Date(iso + 'T12:00:00').toLocaleDateString('fr-FR', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    })

  const fmtTime = (isoFull: string) => {
    const d = new Date(isoFull)
    const h = d.getHours(), m = d.getMinutes()
    return (h || m) ? `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}` : ''
  }

  const dayPages = days.map((day, idx) => {
    const evts = byDay.get(day) ?? []
    const isEmpty = evts.length === 0

    // Grouper par type
    const groups = new Map<string, CalendrierEvent[]>()
    for (const evt of evts) {
      if (!groups.has(evt.type_action)) groups.set(evt.type_action, [])
      groups.get(evt.type_action)!.push(evt)
    }

    const groupsHtml = [...groups.entries()].map(([type, gEvts]) => {
      const meta = ACTION_META[type] ?? { emoji: '📌', label: type }
      const color = ACTION_COLORS_PDF[type] ?? '#6b7280'

      const evtRows = gEvts.map(evt => {
        const time = fmtTime(evt.date_action)
        const params = evt.parametres && typeof evt.parametres === 'object'
          ? Object.entries(evt.parametres)
              .map(([k, v]) => `<span class="param">${k.replace(/_/g,' ')}: <b>${v}</b></span>`)
              .join(' · ')
          : ''
        const note = evt.note ? `<div class="evt-note">📝 ${evt.note}</div>` : ''

        return `
          <div class="evt-row">
            <div class="evt-meta">
              ${time ? `<span class="evt-time">${time}</span>` : ''}
              <span class="evt-culture">${evt.culture_nom}</span>
              ${evt.plant_nom ? `<span class="evt-plant">— ${evt.plant_nom}</span>` : ''}
              ${evt.global_culture ? `<span class="evt-global">culture entière</span>` : ''}
            </div>
            ${params ? `<div class="evt-params">${params}</div>` : ''}
            ${note}
          </div>`
      }).join('')

      return `
        <div class="group-block" style="border-left-color: ${color}">
          <div class="group-title">
            <span class="group-emoji">${meta.emoji}</span>
            <span class="group-label">${meta.label}</span>
            <span class="group-count">${gEvts.length} événement${gEvts.length > 1 ? 's' : ''}</span>
          </div>
          <div class="group-events">${evtRows}</div>
        </div>`
    }).join('')

    const isLast = idx === days.length - 1

    return `
      <div class="day-page${isLast ? ' last-page' : ''}">
        <div class="day-header">
          <div class="day-date">${fmtDate(day)}</div>
          <div class="day-count">${evts.length === 0 ? 'Aucun événement' : `${evts.length} événement${evts.length > 1 ? 's' : ''}`}</div>
        </div>
        ${isEmpty
          ? `<div class="empty-day"><span>🌙</span><span>Journée calme — aucune action enregistrée</span></div>`
          : `<div class="groups-container">${groupsHtml}</div>`
        }
      </div>`
  }).join('')

  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <title>Calendrier GrowManager — ${fmtDate(dateDebut)} → ${fmtDate(dateFin)}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      font-size: 13px;
      color: #1f2937;
      background: white;
    }

    /* ── Cover page ── */
    .cover {
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      page-break-after: always;
      padding: 60px 40px;
      background: #f9fafb;
    }
    .cover-logo { font-size: 64px; margin-bottom: 24px; }
    .cover-title { font-size: 36px; font-weight: 700; color: #111827; margin-bottom: 8px; text-align: center; }
    .cover-subtitle { font-size: 18px; color: #6b7280; text-align: center; margin-bottom: 32px; }
    .cover-range {
      background: white;
      border: 2px solid #e5e7eb;
      border-radius: 12px;
      padding: 20px 40px;
      text-align: center;
    }
    .cover-range-label { font-size: 12px; font-weight: 600; color: #9ca3af; text-transform: uppercase; letter-spacing: .05em; margin-bottom: 6px; }
    .cover-range-dates { font-size: 16px; font-weight: 600; color: #374151; }
    .cover-stats { margin-top: 24px; font-size: 14px; color: #6b7280; }

    /* ── Day pages ── */
    .day-page {
      page-break-after: always;
      padding: 32px 40px;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
    }
    .day-page.last-page { page-break-after: avoid; }

    .day-header {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      border-bottom: 2px solid #16a34a;
      padding-bottom: 10px;
      margin-bottom: 20px;
    }
    .day-date {
      font-size: 22px;
      font-weight: 700;
      color: #111827;
      text-transform: capitalize;
    }
    .day-count {
      font-size: 13px;
      color: #6b7280;
      font-weight: 500;
    }

    .empty-day {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 12px;
      color: #9ca3af;
      font-size: 15px;
    }
    .empty-day span:first-child { font-size: 40px; }

    /* ── Groupes ── */
    .groups-container { display: flex; flex-direction: column; gap: 16px; }

    .group-block {
      border-left: 4px solid #16a34a;
      padding-left: 14px;
    }
    .group-title {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 8px;
    }
    .group-emoji { font-size: 16px; }
    .group-label { font-size: 14px; font-weight: 700; color: #111827; }
    .group-count { margin-left: auto; font-size: 11px; color: #9ca3af; }

    /* ── Events ── */
    .group-events { display: flex; flex-direction: column; gap: 6px; }

    .evt-row {
      background: #f9fafb;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      padding: 8px 12px;
    }
    .evt-meta {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 6px;
      margin-bottom: 2px;
    }
    .evt-time {
      font-size: 11px;
      font-weight: 600;
      color: #6b7280;
      background: #e5e7eb;
      padding: 1px 6px;
      border-radius: 4px;
    }
    .evt-culture {
      font-weight: 600;
      color: #16a34a;
      font-size: 13px;
    }
    .evt-plant {
      font-size: 12px;
      color: #6b7280;
    }
    .evt-global {
      font-size: 10px;
      color: #9ca3af;
      background: #f3f4f6;
      padding: 1px 6px;
      border-radius: 10px;
    }
    .evt-params {
      font-size: 11px;
      color: #4b5563;
      margin-top: 3px;
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }
    .param { background: #eff6ff; color: #1d4ed8; padding: 1px 6px; border-radius: 4px; }
    .evt-note {
      font-size: 11px;
      color: #92400e;
      background: #fffbeb;
      border: 1px solid #fde68a;
      border-radius: 4px;
      padding: 4px 8px;
      margin-top: 4px;
    }

    /* ── Print ── */
    @media print {
      @page { size: A4; margin: 0; }
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
  </style>
</head>
<body>
  <!-- Cover -->
  <div class="cover">
    <div class="cover-logo">🌿</div>
    <div class="cover-title">Calendrier GrowManager</div>
    <div class="cover-subtitle">Export jour par jour</div>
    <div class="cover-range">
      <div class="cover-range-label">Période exportée</div>
      <div class="cover-range-dates">${fmtDate(dateDebut)} → ${fmtDate(dateFin)}</div>
    </div>
    <div class="cover-stats">${days.length} jour${days.length > 1 ? 's' : ''} · ${events.length} événement${events.length > 1 ? 's' : ''} au total</div>
  </div>

  <!-- Days -->
  ${dayPages}

  <script>window.onload = () => window.print()</script>
</body>
</html>`

  const win = window.open('', '_blank')
  if (win) {
    win.document.write(html)
    win.document.close()
  }
}

// ─── Modal Export PDF ─────────────────────────────────────────────────────────

function ExportPDFModal({ onClose }: { onClose: () => void }) {
  const today = new Date().toISOString().slice(0, 10)
  const firstOfMonth = today.slice(0, 8) + '01'

  const [dateDebut, setDateDebut] = useState(firstOfMonth)
  const [dateFin,   setDateFin]   = useState(today)
  const [loading,   setLoading]   = useState(false)
  const [error,     setError]     = useState<string | null>(null)

  const handleExport = async () => {
    if (!dateDebut || !dateFin) return
    if (dateDebut > dateFin) { setError('La date de début doit être avant la date de fin.'); return }
    setError(null)
    setLoading(true)
    try {
      const events = await getCalendrierExport(dateDebut, dateFin)
      generateCalendarPDF(events, dateDebut, dateFin)
      onClose()
    } catch {
      setError('Erreur lors du chargement des données.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div
        className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-sm p-6 z-10"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <span className="text-2xl">📄</span>
            <div>
              <h2 className="font-bold text-gray-900 dark:text-white">Export PDF</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">Calendrier jour par jour</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-xl w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">×</button>
        </div>

        {/* Sélecteurs dates */}
        <div className="space-y-4 mb-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              Date de début
            </label>
            <input
              type="date"
              value={dateDebut}
              onChange={e => setDateDebut(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-grow-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              Date de fin
            </label>
            <input
              type="date"
              value={dateFin}
              onChange={e => setDateFin(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-grow-500"
            />
          </div>
        </div>

        {/* Info */}
        <p className="text-xs text-gray-400 dark:text-gray-500 mb-4 flex items-start gap-1.5">
          <span className="mt-0.5">ℹ️</span>
          <span>Chaque jour de la période sera une page dans le PDF. Le navigateur ouvrira une fenêtre d'impression.</span>
        </p>

        {error && (
          <p className="text-xs text-red-600 dark:text-red-400 mb-4 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-lg">
            {error}
          </p>
        )}

        {/* Actions */}
        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 rounded-lg text-sm border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            Annuler
          </button>
          <button
            onClick={handleExport}
            disabled={loading || !dateDebut || !dateFin}
            className="flex-1 px-4 py-2 rounded-lg text-sm bg-grow-600 text-white hover:bg-grow-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <div className="w-3.5 h-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                Chargement…
              </>
            ) : (
              <>
                <FileDown size={14} />
                Exporter
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Page principale ──────────────────────────────────────────────────────────

export default function CalendrierGlobal() {
  const today = new Date()
  const [year,  setYear]  = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth() + 1)
  const [selectedEvent, setSelectedEvent] = useState<CalendrierEvent | null>(null)
  const [selectedDay, setSelectedDay] = useState<string | null>(null)
  const [filteredCultures, setFilteredCultures] = useState<Set<number>>(new Set())
  const [showFilters, setShowFilters] = useState(false)
  const [showExport, setShowExport] = useState(false)

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

          <button
            onClick={() => setShowExport(true)}
            className="ml-1 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            title="Exporter en PDF"
          >
            <FileDown size={16} />
            <span className="hidden sm:inline">Export PDF</span>
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
                  onDayClick={() => dayEvents.length > 0 && setSelectedDay(key)}
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

      {/* ── Modal vue journée ── */}
      {selectedDay && (
        <DayModal
          dateStr={selectedDay}
          events={eventsByDay.get(selectedDay) ?? []}
          colorMap={colorMap}
          onEventClick={setSelectedEvent}
          onClose={() => setSelectedDay(null)}
        />
      )}

      {/* ── Drawer event ── */}
      {selectedEvent && (
        <EventDrawer
          event={selectedEvent}
          color={selectedColor}
          onClose={() => setSelectedEvent(null)}
        />
      )}

      {/* ── Modal Export PDF ── */}
      {showExport && (
        <ExportPDFModal onClose={() => setShowExport(false)} />
      )}
    </div>
  )
}
