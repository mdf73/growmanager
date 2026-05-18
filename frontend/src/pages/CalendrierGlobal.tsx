/**
 * CalendrierGlobal — Vue mensuelle de tous les events de toutes les cultures
 * Route: /calendrier
 */
import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight, Calendar, Filter, FileDown, ArrowLeft, X } from 'lucide-react'
import { getCalendrierEvents, getCulturesRef, getCalendrierExport, getActionCout, CalendrierEvent, CultureRef } from '../api/calendrier'
import { capteursAPI, TemperatureLog } from '../api/capteurs'
import { photosAPI, photoUrl } from '../api/photos'
import SensorDayChart from '../components/SensorDayChart'
import { generateCalendarPDF as _generateCalendarPDF } from '../utils/calendarPdfExport'

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
  photo:              { emoji: '📷', label: 'Photo' },
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
  onBack,
}: {
  event: CalendrierEvent
  color: typeof CULTURE_COLORS[0]
  onClose: () => void
  onBack?: () => void
}) {
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null)

  const meta = actionMeta(event.type_action)
  const dateLabel = new Date(event.date_action.slice(0, 10) + 'T12:00:00').toLocaleDateString('fr-FR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })

  const params = event.parametres
  const isEngrais = event.type_action === 'arrosage_engrais'

  // ── Pour arrosage_engrais : 3 encarts dédiés ─────────────────────────────
  // Encart 1 — info recette (ph_cible, nom_recette, volume_par_plante_l)
  const engraisInfo = isEngrais && params ? {
    phCible:       params.ph_cible     as number | null | undefined,
    nomRecette:    params.nom_recette  as string | null | undefined,
    // volume par plante = volume_par_plante_l si dispo, sinon volume_l
    volParPlante:  (params.volume_par_plante_l ?? params.volume_l) as number | null | undefined,
  } : null

  // Encart 2 — produits utilisés
  type ProduitCalc = { nom: string; quantite: number; unite?: string }
  const produitsCalcules: ProduitCalc[] | null =
    params && Array.isArray(params.produits_calcules)
      ? (params.produits_calcules as ProduitCalc[])
      : params && Array.isArray(params.calculs)
        ? (params.calculs as ProduitCalc[])
        : null

  // Encart 3 — coût (fetch depuis l'API)
  const { data: coutData } = useQuery({
    queryKey: ['action-cout', event.id_culture, event.id_action],
    queryFn:  () => getActionCout(event.id_culture, event.id_action),
    enabled:  isEngrais,
    staleTime: 5 * 60_000,
  })

  // ── Paramètres génériques (tout sauf arrosage_engrais et valeurs complexes) ─
  const SKIP_KEYS_ENGRAIS = ['ph_cible', 'nom_recette', 'id_recette', 'volume_l',
    'volume_total_l', 'volume_par_plante_l', 'nb_plantes',
    'produits', 'produits_calcules', 'produits_consommes', 'calculs']

  const paramEntries = params && typeof params === 'object'
    ? Object.entries(params).filter(([k, v]) =>
        k !== 'count' &&
        !(isEngrais && SKIP_KEYS_ENGRAIS.includes(k)) &&
        !Array.isArray(v) &&
        typeof v !== 'object'
      )
    : []

  // ── Chargement des photos si type === 'photo' ─────────────────────────────
  const isPhoto = event.type_action === 'photo'
  const eventDate = event.date_action.slice(0, 10)

  const { data: allCulturePhotos = [], isLoading: photosLoading } = useQuery({
    queryKey: ['photos-culture', event.id_culture, event.id_plant ?? null],
    queryFn: () => photosAPI.list({
      id_culture: event.id_culture,
      ...(event.id_plant ? { id_plant: event.id_plant } : {}),
    }),
    enabled: isPhoto,
    staleTime: 60_000,
  })

  // Filtre par date de l'event ; fallback sur toutes si aucune correspondance
  const dayPhotos    = allCulturePhotos.filter(p => p.date_prise.slice(0, 10) === eventDate)
  const photosToShow = dayPhotos.length > 0 ? dayPhotos : allCulturePhotos
  const isFallback   = dayPhotos.length === 0 && allCulturePhotos.length > 0

  return (
    <>
      {/* ── Lightbox photo ── */}
      {lightboxSrc && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/90"
          onClick={() => setLightboxSrc(null)}
        >
          <button
            onClick={() => setLightboxSrc(null)}
            className="absolute top-4 right-4 text-white/70 hover:text-white bg-black/40 rounded-full p-2"
          >
            <X size={22} />
          </button>
          <img
            src={lightboxSrc}
            alt="Photo"
            className="max-w-[92vw] max-h-[90vh] rounded-xl object-contain shadow-2xl"
            onClick={e => e.stopPropagation()}
          />
        </div>
      )}

      {/* ── Modal ── */}
      <div className="fixed inset-0 flex items-end sm:items-center justify-center p-4" style={{ zIndex: 60 }} onClick={onClose}>
        <div className="absolute inset-0 bg-black/50" />
        <div
          className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md z-10 flex flex-col max-h-[85vh]"
          onClick={e => e.stopPropagation()}
        >
          {/* ── Header ── */}
          <div className="flex items-start justify-between p-6 pb-4 shrink-0">
            <div className="flex items-center gap-3">
              {/* Bouton retour si ouvert depuis DayModal */}
              {onBack && (
                <button
                  onClick={onBack}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors shrink-0"
                  title="Retour à la journée"
                >
                  <ArrowLeft size={18} />
                </button>
              )}
              <span className="text-3xl">{meta.emoji}</span>
              <div>
                <p className="font-semibold text-gray-900 dark:text-white">{meta.label}</p>
                <p className="text-sm text-gray-500 dark:text-gray-400 capitalize">{dateLabel}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors shrink-0"
              title="Fermer"
            >
              <X size={18} />
            </button>
          </div>

          {/* ── Corps scrollable ── */}
          <div className="overflow-y-auto flex-1 px-6 pb-6 space-y-3">
            {/* Culture badge */}
            <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium ${color.bg} ${color.text}`}>
              <span className={`w-2 h-2 rounded-full ${color.dot}`} />
              {event.culture_nom}
              {event.plant_nom && <span className="opacity-70">— {event.plant_nom}</span>}
            </div>

            {/* Scope */}
            <div className="text-xs text-gray-500 dark:text-gray-400">
              {event.global_culture ? '🌍 Action globale (toute la culture)' : `🪴 Plante : ${event.plant_nom ?? '—'}`}
            </div>

            {/* ── Encart 1 : infos recette engrais ── */}
            {engraisInfo && (
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-3 text-sm space-y-1">
                {engraisInfo.nomRecette && (
                  <div className="flex justify-between gap-2">
                    <span className="text-gray-500 dark:text-gray-400">Recette</span>
                    <span className="font-medium text-gray-800 dark:text-gray-200 text-right">{engraisInfo.nomRecette}</span>
                  </div>
                )}
                {engraisInfo.phCible != null && (
                  <div className="flex justify-between gap-2">
                    <span className="text-gray-500 dark:text-gray-400">pH cible</span>
                    <span className="font-medium text-gray-800 dark:text-gray-200">{engraisInfo.phCible}</span>
                  </div>
                )}
                {engraisInfo.volParPlante != null && (
                  <div className="flex justify-between gap-2">
                    <span className="text-gray-500 dark:text-gray-400">Volume / plante</span>
                    <span className="font-medium text-gray-800 dark:text-gray-200">{engraisInfo.volParPlante} L</span>
                  </div>
                )}
              </div>
            )}

            {/* ── Encart 2 : produits utilisés ── */}
            {produitsCalcules && produitsCalcules.length > 0 && (
              <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-xl p-3 text-sm space-y-1">
                <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 uppercase tracking-wide mb-2">
                  🧪 Produits utilisés
                </p>
                {produitsCalcules.map((p, i) => (
                  <div key={i} className="flex justify-between gap-2">
                    <span className="text-gray-600 dark:text-gray-300">{p.nom}</span>
                    <span className="font-medium text-gray-800 dark:text-gray-200">
                      {p.quantite}{(p.unite ?? '').replace('/L', '')}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* ── Encart 3 : coût ── */}
            {isEngrais && coutData && coutData.cout_total != null && (
              <div className="bg-amber-50 dark:bg-amber-900/20 rounded-xl p-3 text-sm space-y-1">
                <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-wide mb-2">
                  💰 Coût de l'arrosage
                </p>
                {coutData.par_produit.map((p, i) => p.cout != null && (
                  <div key={i} className="flex justify-between gap-2">
                    <span className="text-gray-600 dark:text-gray-300">{p.nom}</span>
                    <span className="text-gray-700 dark:text-gray-300">{p.cout.toFixed(4)} €</span>
                  </div>
                ))}
                <div className="flex justify-between gap-2 pt-1 mt-1 border-t border-amber-200 dark:border-amber-800">
                  <span className="font-semibold text-gray-700 dark:text-gray-200">Total</span>
                  <span className="font-bold text-amber-700 dark:text-amber-400">
                    {coutData.cout_total.toFixed(4)} €
                  </span>
                </div>
              </div>
            )}

            {/* ── Paramètres génériques (autres types d'action) ── */}
            {paramEntries.length > 0 && (
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-3 text-sm space-y-1">
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

            {/* ── Section photos ── */}
            {isPhoto && (
              <div>
                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
                  Photos du jour
                </p>
                {isFallback && (
                  <p className="text-xs text-amber-500 dark:text-amber-400 italic mb-2">
                    ⚠️ Photos de la culture (date non correspondante)
                  </p>
                )}
                {photosLoading ? (
                  <div className="flex justify-center py-6">
                    <div className="w-6 h-6 rounded-full border-2 border-grow-600 border-t-transparent animate-spin" />
                  </div>
                ) : photosToShow.length === 0 ? (
                  <div className="text-sm text-gray-400 dark:text-gray-500 italic py-3 text-center">
                    Aucune photo pour cette culture
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    {photosToShow.map(photo => {
                      const thumbSrc = photo.thumbnail_path
                        ? photoUrl(photo.thumbnail_path)
                        : photoUrl(photo.filepath)
                      const fullSrc = photoUrl(photo.filepath)
                      return (
                        <button
                          key={photo.id_photo}
                          onClick={() => setLightboxSrc(fullSrc)}
                          className="relative group rounded-xl overflow-hidden aspect-square bg-gray-100 dark:bg-gray-700 hover:opacity-90 transition-opacity"
                          title={photo.notes ?? photo.filename}
                        >
                          <img
                            src={thumbSrc}
                            alt={photo.notes ?? photo.filename}
                            className="w-full h-full object-cover"
                          />
                          {/* Overlay note */}
                          {photo.notes && (
                            <div className="absolute inset-x-0 bottom-0 bg-black/50 px-2 py-1 text-white text-xs truncate opacity-0 group-hover:opacity-100 transition-opacity">
                              {photo.notes}
                            </div>
                          )}
                          {/* Icône loupe */}
                          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                            <div className="bg-black/40 rounded-full p-2">
                              <span className="text-white text-lg">🔍</span>
                            </div>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
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
                        onClick={() => onEventClick(evt)}
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

// ─── generateCalendarPDF — délégué à utils/calendarPdfExport ────────────────
function generateCalendarPDF(
  events: CalendrierEvent[],
  dateDebut: string,
  dateFin: string,
  sensorLogs: TemperatureLog[] = [],
  photos: import('../api/photos').Photo[] = [],
) {
  return _generateCalendarPDF(events, dateDebut, dateFin, sensorLogs, {}, photos)
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
      const [events, logsRes, photos] = await Promise.all([
        getCalendrierExport(dateDebut, dateFin),
        capteursAPI.getLogs({
          date_debut: `${dateDebut}T00:00:00`,
          date_fin:   `${dateFin}T23:59:59`,
        }),
        photosAPI.list({ date_debut: dateDebut, date_fin: dateFin }),
      ])
      generateCalendarPDF(events, dateDebut, dateFin, logsRes.data, photos)
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
  const [eventFromDay, setEventFromDay] = useState(false)  // true si EventDrawer ouvert depuis DayModal
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

      {/* ── Modal vue journée (masqué si EventDrawer est ouvert par-dessus) ── */}
      {selectedDay && !selectedEvent && (
        <DayModal
          dateStr={selectedDay}
          events={eventsByDay.get(selectedDay) ?? []}
          colorMap={colorMap}
          onEventClick={evt => {
            setEventFromDay(true)
            setSelectedEvent(evt)
          }}
          onClose={() => setSelectedDay(null)}
        />
      )}

      {/* ── Drawer event ── */}
      {selectedEvent && (
        <EventDrawer
          event={selectedEvent}
          color={selectedColor}
          onClose={() => {
            setSelectedEvent(null)
            setSelectedDay(null)
            setEventFromDay(false)
          }}
          onBack={eventFromDay ? () => {
            setSelectedEvent(null)
            setEventFromDay(false)
          } : undefined}
        />
      )}

      {/* ── Modal Export PDF ── */}
      {showExport && (
        <ExportPDFModal onClose={() => setShowExport(false)} />
      )}
    </div>
  )
}
