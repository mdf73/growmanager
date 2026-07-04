import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Plus, ArrowLeft, Leaf, Calendar, Users, BarChart2,
  Flower2, Droplets, Sun, Clock, X, CheckCircle, Trash2, AlertTriangle, Loader2,
  Pencil, Check, Camera, FileDown,
} from 'lucide-react'
import { cultureAPI, Culture, CultureWithDetails, CultureCreate } from '../api/cultures'
import { photosAPI } from '../api/photos'
import { getCalendrierExport } from '../api/calendrier'
import { capteursAPI } from '../api/capteurs'
import { generateCalendarPDF } from '../utils/calendarPdfExport'
import LoadingSpinner from '../components/LoadingSpinner'
import CalendrierCulture from '../components/culture/CalendrierCulture'
import PlantesTab from '../components/culture/PlantesTab'
import StatsTab from '../components/culture/StatsTab'
import NouvellerCultureModal from '../components/culture/NouvellerCultureModal'
import PhotoGallery from '../components/culture/PhotoGallery'

// ─── Statut badges ────────────────────────────────────────────────────────────
const STATUT_CONFIG = {
  active:          { label: 'Active',          className: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300' },
  sechage_curing:  { label: 'Séchage & Curing',className: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300' },
  terminee:        { label: 'Terminée',         className: 'bg-gray-100 text-gray-600 dark:text-gray-300' },
}

// Phase de la culture (culture.phase)
const PHASE_CONFIG: Record<string, { icon: string; label: string }> = {
  germination: { icon: '🌱', label: 'Germination' },
  croissance:  { icon: '🌿', label: 'Croissance' },
  veg:         { icon: '🌿', label: 'Végétation' },
  floraison:   { icon: '🌸', label: 'Floraison' },
  sechage:     { icon: '🌬️', label: 'Séchage' },
  curing:      { icon: '🏺', label: 'Curing' },
  prete:       { icon: '✅', label: 'Prête' },
  recolte:     { icon: '🌾', label: 'Récoltée' },
}

// ─── Card culture ─────────────────────────────────────────────────────────────
function CultureCard({
  culture, onClick, onDelete,
}: {
  culture: Culture
  onClick: () => void
  onDelete?: () => void
}) {
  const [confirmDelete, setConfirmDelete] = useState(false)
  const { data: photoCount = 0 } = useQuery({
    queryKey: ['photos-count', culture.id_culture],
    queryFn: () => photosAPI.list({ id_culture: culture.id_culture }).then(p => p.length),
    staleTime: 60_000,
  })
  const isDeletable = culture.statut === 'terminee' || culture.statut === 'sechage_curing'
  const statut = STATUT_CONFIG[culture.statut as keyof typeof STATUT_CONFIG] || STATUT_CONFIG.active

  return (
    <div
      onClick={confirmDelete ? undefined : onClick}
      className={`bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5 transition-all group ${confirmDelete ? '' : 'hover:shadow-md hover:border-grow-300 cursor-pointer'}`}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-gray-900 dark:text-gray-100 text-base truncate group-hover:text-grow-700 transition-colors">
            {culture.nom || `Culture #${culture.id_culture}`}
          </h3>
          {culture.nom_espace && (
            <p className="text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500 mt-0.5">📦 {culture.nom_espace}</p>
          )}
          {culture.but_culture && (
            <div className="flex flex-wrap gap-1 mt-1">
              {culture.but_culture.split(',').map(b => b.trim()).filter(Boolean).map(b => (
                <span key={b} className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-grow-50 text-grow-600 border border-grow-100">
                  {b === 'Récolte' ? '🌾' : b === 'Hunt' ? '🔍' : b === 'Reproduction' ? '🧬' : '🎯'} {b}
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0 ml-2">
          <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${statut.className}`}>
            {statut.label}
          </span>
          {isDeletable && onDelete && !confirmDelete && (
            <button
              onClick={e => { e.stopPropagation(); setConfirmDelete(true) }}
              className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded opacity-0 group-hover:opacity-100 transition-opacity"
              title="Supprimer cette culture"
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Phase */}
      {culture.phase && (
        <div className="flex items-center gap-1.5 text-sm text-gray-600 dark:text-gray-300 mb-3">
          <span>{PHASE_CONFIG[culture.phase]?.icon ?? '📍'}</span>
          <span>{PHASE_CONFIG[culture.phase]?.label ?? culture.phase}</span>
        </div>
      )}

      {/* Métriques */}
      <div className="grid grid-cols-4 gap-1.5 text-center">
        <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-2">
          <p className="text-lg font-bold text-gray-900 dark:text-gray-100">{culture.nb_plantes_actives}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500">plantes</p>
        </div>
        <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-2">
          <p className="text-lg font-bold text-gray-900 dark:text-gray-100">{culture.jours_culture ?? '—'}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500">jours</p>
        </div>
        <div className={`rounded-lg p-2 ${culture.date_debut_floraison ? 'bg-purple-50 dark:bg-purple-900/20' : 'bg-gray-50 dark:bg-gray-700/50'}`}>
          <p className={`text-lg font-bold ${culture.date_debut_floraison ? 'text-purple-700 dark:text-purple-300' : 'text-gray-400 dark:text-gray-500'}`}>
            {culture.date_debut_floraison
              ? `${Math.max(0, Math.floor((Date.now() - new Date(culture.date_debut_floraison + 'T12:00').getTime()) / (1000*60*60*24)))}j`
              : '—'}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500">🌸 flo.</p>
        </div>
        <div className={`rounded-lg p-2 col-span-1 ${culture.date_recolte_min ? 'bg-amber-50 dark:bg-amber-900/20' : 'bg-gray-50 dark:bg-gray-700/50'}`}>
          {culture.date_recolte_min ? (
            <>
              <p className="text-xs font-bold text-amber-800 dark:text-amber-300 leading-tight">
                {new Date(culture.date_recolte_min + 'T12:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
              </p>
              <p className="text-xs font-bold text-amber-900 leading-tight">
                → {culture.date_recolte_max
                  ? new Date(culture.date_recolte_max + 'T12:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
                  : '?'}
              </p>
            </>
          ) : (
            <p className="text-lg font-bold text-gray-400 dark:text-gray-500">—</p>
          )}
          <p className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500 mt-0.5">🌾 récolte</p>
        </div>
      </div>

      {/* Badge séchage (si récoltée) ou arrosage + TCO */}
      <div className="flex flex-col gap-1 mt-2">
        {(() => {
          if (culture.statut === 'terminee') {
            const poids = culture.total_recolte_g
            return (
              <div className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 font-medium">
                🌿 {poids != null ? `Récolte totale : ${poids.toFixed(1)} g` : 'Récolte clôturée'}
              </div>
            )
          }
          if (culture.statut === 'sechage_curing') {
            const msParJour = 1000 * 60 * 60 * 24
            const jours = culture.date_fin
              ? Math.floor((Date.now() - new Date(culture.date_fin + 'T12:00').getTime()) / msParJour)
              : null
            const txt = jours === 0 ? "Séchage démarré aujourd'hui"
              : jours != null ? `En séchage depuis ${jours}j`
              : 'En séchage'
            return (
              <div className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 font-medium">
                🌬️ {txt}
              </div>
            )
          }
          const j = culture.jours_depuis_dernier_arrosage
          if (j == null) return (
            <div className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg bg-gray-50 dark:bg-gray-700/50 text-gray-400 dark:text-gray-500">
              <Droplets size={12} /> Aucun arrosage enregistré
            </div>
          )
          const cls = j === 0 ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
            : j <= 2 ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300'
            : j <= 5 ? 'bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-300'
            : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300'
          const label = j === 0 ? "Arrosé aujourd'hui" : `Dernier arrosage il y a ${j}j`
          return (
            <div className={`flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg font-medium ${cls}`}>
              <Droplets size={12} /> {label}
            </div>
          )
        })()}
        {(() => {
          if (culture.statut === 'sechage_curing' || culture.statut === 'terminee') return null
          const j = culture.jours_depuis_dernier_tco
          if (j == null) return (
            <div className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg bg-gray-50 dark:bg-gray-700/50 text-gray-400 dark:text-gray-500">
              🫧 Aucun TCO enregistré
            </div>
          )
          const cls = j === 0 ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
            : j <= 7  ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300'
            : j <= 14 ? 'bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-300'
            : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300'
          const label = j === 0 ? 'TCO préparé aujourd\'hui' : `Dernier TCO il y a ${j}j`
          return (
            <div className={`flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg font-medium ${cls}`}>
              🫧 {label}
            </div>
          )
        })()}
      </div>

      {/* Date début + badge photos */}
      <div className="flex items-center justify-between mt-3">
        {culture.date_debut ? (
          <p className="text-xs text-gray-400 dark:text-gray-500">
            Démarrée le {new Date(culture.date_debut + 'T12:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        ) : <span />}
        {photoCount > 0 && (
          <span className="flex items-center gap-1 text-xs text-gray-400 dark:text-gray-500">
            <Camera size={11} />
            {photoCount}
          </span>
        )}
      </div>

      {/* Confirmation suppression */}
      {confirmDelete && (
        <div
          className="mt-3 p-2.5 bg-red-50 dark:bg-red-900/20 border border-red-200 rounded-lg"
          onClick={e => e.stopPropagation()}
        >
          <div className="flex items-center gap-1.5 mb-2">
            <AlertTriangle size={13} className="text-red-600 dark:text-red-400" />
            <span className="text-xs font-medium text-red-700 dark:text-red-300">
              Supprimer définitivement cette culture et toutes ses données ?
            </span>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => { onDelete?.(); setConfirmDelete(false) }}
              className="flex-1 px-2 py-1 bg-red-600 text-white text-xs rounded hover:bg-red-700"
            >
              Supprimer
            </button>
            <button
              onClick={() => setConfirmDelete(false)}
              className="flex-1 px-2 py-1 border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 text-xs rounded hover:bg-gray-50 dark:hover:bg-gray-700/40"
            >
              Annuler
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Vue détail d'une culture ─────────────────────────────────────────────────
// ─── Modal édition des dates clés ─────────────────────────────────────────────

interface DatesModalProps {
  culture: CultureWithDetails
  onClose: () => void
  onSave:  (data: Record<string, string | null>) => void
  isPending: boolean
}

function DatesModal({ culture, onClose, onSave, isPending }: DatesModalProps) {
  const [form, setForm] = useState({
    date_debut:           culture.date_debut?.slice(0, 10)           ?? '',
    date_passage_12_12:   culture.date_passage_12_12?.slice(0, 10)   ?? '',
    date_debut_floraison: culture.date_debut_floraison?.slice(0, 10) ?? '',
    date_recolte_estimee: culture.date_recolte_estimee?.slice(0, 10) ?? '',
    date_fin:             culture.date_fin?.slice(0, 10)             ?? '',
  })

  const handleSave = () => {
    const data: Record<string, string | null> = {}
    for (const [k, v] of Object.entries(form)) {
      data[k] = v.trim() || null
    }
    onSave(data)
  }

  const Field = ({ label, field, help }: { label: string; field: keyof typeof form; help?: string }) => (
    <div>
      <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">{label}</label>
      {help && <p className="text-xs text-gray-400 dark:text-gray-500 mb-1">{help}</p>}
      <input
        type="date"
        value={form[field]}
        onChange={e => setForm(f => ({ ...f, [field]: e.target.value }))}
        className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm
                   focus:outline-none focus:ring-2 focus:ring-grow-400 dark:bg-gray-700 dark:text-gray-100"
      />
    </div>
  )

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-700">
          <h2 className="text-base font-semibold text-gray-800 dark:text-gray-100">Dates clés de la culture</h2>
          <button onClick={onClose} className="p-1 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:text-gray-300">
            <X size={18} />
          </button>
        </div>
        <div className="p-6 space-y-4">
          <Field label="Date de démarrage" field="date_debut" />
          <Field
            label="Passage 12/12"
            field="date_passage_12_12"
            help="Date de basculement en cycle floraison (éclairage 12h/12h)"
          />
          <Field
            label="Début floraison (visible)"
            field="date_debut_floraison"
            help="Date où les premiers pistils apparaissent. Calculée automatiquement si vide."
          />
          <Field label="Récolte estimée" field="date_recolte_estimee" help="Override du calcul automatique (optionnel)" />
          {culture.statut !== 'active' && (
            <Field label="Date de fin" field="date_fin" />
          )}
        </div>
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100 dark:border-gray-700">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-600 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/40"
          >
            Annuler
          </button>
          <button
            onClick={handleSave}
            disabled={isPending}
            className="px-4 py-2 text-sm text-white bg-grow-600 rounded-lg hover:bg-grow-700 disabled:opacity-50 flex items-center gap-2"
          >
            {isPending ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
            Enregistrer
          </button>
        </div>
      </div>
    </div>
  )
}

function CultureDetail({ cultureId, onBack }: { cultureId: number; onBack: () => void }) {
  const [activeTab, setActiveTab] = useState<'calendrier' | 'plantes' | 'stats' | 'photos'>('calendrier')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [editingName, setEditingName] = useState(false)
  const [nameValue, setNameValue] = useState('')
  const [showDatesModal, setShowDatesModal] = useState(false)
  const qc = useQueryClient()

  const { data: culture, isLoading } = useQuery<CultureWithDetails>({
    queryKey: ['culture', cultureId],
    queryFn: async () => (await cultureAPI.getById(cultureId)).data,
  })

  const { data: photosCount = 0 } = useQuery({
    queryKey: ['photos-count', cultureId],
    queryFn: () => photosAPI.list({ id_culture: cultureId }).then(p => p.length),
  })

  const closeCulture = useMutation({
    mutationFn: () => cultureAPI.close(cultureId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cultures'] })
      qc.invalidateQueries({ queryKey: ['culture', cultureId] })
    },
  })

  const deleteCulture = useMutation({
    mutationFn: () => cultureAPI.delete(cultureId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cultures'] })
      onBack()
    },
    onError: () => setConfirmDelete(false),
  })

  const renameCulture = useMutation({
    mutationFn: (nom: string) => cultureAPI.update(cultureId, { nom }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cultures'] })
      qc.invalidateQueries({ queryKey: ['culture', cultureId] })
      setEditingName(false)
    },
  })

  const updateDates = useMutation({
    mutationFn: (data: Record<string, string | null>) => cultureAPI.update(cultureId, data as any),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cultures'] })
      qc.invalidateQueries({ queryKey: ['culture', cultureId] })
      setShowDatesModal(false)
    },
  })

  const toggleFlush = useMutation({
    mutationFn: (dateFlush: string | null) =>
      cultureAPI.update(cultureId, { date_debut_flush: dateFlush } as any),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['culture', cultureId] })
      qc.invalidateQueries({ queryKey: ['dashboard-arrosage-boxes'] })
    },
  })

  const [exportingPdf, setExportingPdf] = useState(false)
  const handleExportPdf = async () => {
    if (!culture) return
    setExportingPdf(true)
    try {
      // Dates auto : date_debut de la culture → date_fin (ou aujourd'hui si encore active)
      const today = new Date().toISOString().slice(0, 10)
      const dateDebut = culture.date_debut?.slice(0, 10) || today
      const dateFin   = culture.date_fin?.slice(0, 10)   || today

      // Chargement events + capteurs + photos en parallèle
      const [events, logsRes, photos] = await Promise.all([
        getCalendrierExport(dateDebut, dateFin, culture.id_culture),
        capteursAPI.getLogs({
          date_debut: `${dateDebut}T00:00:00`,
          date_fin:   `${dateFin}T23:59:59`,
          ...(culture.id_espace ? { id_espace: culture.id_espace } : {}),
        }),
        photosAPI.list({ id_culture: culture.id_culture }),
      ])

      generateCalendarPDF(events, dateDebut, dateFin, logsRes.data, {
        title:       `Journal — ${culture.nom}`,
        subtitle:    'Suivi de culture jour par jour',
        cultureName: culture.nom,
      }, photos)
    } catch {
      alert('Impossible de générer le PDF.')
    } finally {
      setExportingPdf(false)
    }
  }

  if (isLoading) return <LoadingSpinner />
  if (!culture) return <div className="text-gray-400 dark:text-gray-500 text-center py-12">Culture introuvable</div>

  const statut = STATUT_CONFIG[culture.statut as keyof typeof STATUT_CONFIG] || STATUT_CONFIG.active
  const pesoTotal = culture.plants
    .filter(p => p.poids_recolte_g != null)
    .reduce((sum, p) => sum + (p.poids_recolte_g || 0), 0)

  const tabs = [
    { key: 'calendrier' as const, label: 'Calendrier', icon: Calendar },
    { key: 'plantes' as const,    label: `Plantes (${culture.plants.length})`, icon: Leaf },
    { key: 'stats' as const,      label: 'Stats', icon: BarChart2 },
    { key: 'photos' as const,     label: photosCount > 0 ? `Photos (${photosCount})` : 'Photos', icon: Camera },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-3">
        <button onClick={onBack}
          className="mt-1 p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors text-gray-500 dark:text-gray-400 dark:text-gray-500">
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            {editingName ? (
              <div className="flex items-center gap-2">
                <input
                  autoFocus
                  value={nameValue}
                  onChange={e => setNameValue(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') renameCulture.mutate(nameValue)
                    if (e.key === 'Escape') setEditingName(false)
                  }}
                  className="text-xl font-bold text-gray-900 dark:text-gray-100 border-b-2 border-grow-500 bg-transparent outline-none px-1"
                />
                <button onClick={() => renameCulture.mutate(nameValue)} disabled={renameCulture.isPending}
                  className="p-1 text-grow-600 hover:text-grow-800">
                  {renameCulture.isPending ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                </button>
                <button onClick={() => setEditingName(false)} className="p-1 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:text-gray-300">
                  <X size={16} />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 truncate">
                  {culture.nom || `Culture #${culture.id_culture}`}
                </h1>
                <button
                  onClick={() => { setNameValue(culture.nom || ''); setEditingName(true) }}
                  className="p-1 text-gray-300 hover:text-gray-600 dark:text-gray-300 transition-colors"
                  title="Renommer la culture"
                >
                  <Pencil size={14} />
                </button>
              </div>
            )}
            <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${statut.className}`}>
              {statut.label}
            </span>
          </div>
          {culture.nom_espace && (
            <p className="text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500 mt-1">📦 {culture.nom_espace}</p>
          )}
          {culture.but_culture && (
            <div className="flex flex-wrap gap-1.5 mt-1.5">
              {culture.but_culture.split(',').map(b => b.trim()).filter(Boolean).map(b => (
                <span
                  key={b}
                  className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-grow-100 text-grow-700 border border-grow-200"
                >
                  {b === 'Récolte' ? '🌾' : b === 'Hunt' ? '🔍' : b === 'Reproduction' ? '🧬' : '🎯'} {b}
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {culture.statut === 'active' && culture.phase === 'floraison' && (
            culture.date_debut_flush ? (
              <button
                onClick={() => toggleFlush.mutate(null)}
                className="flex items-center gap-1.5 px-3 py-2 border border-blue-300 dark:border-blue-700 rounded-lg text-sm text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/30 hover:bg-blue-100 dark:hover:bg-blue-900/50"
                title="Arrêter le timer de flush"
              >
                <Droplets size={15} /> 🚿 J+{Math.floor((Date.now() - new Date(culture.date_debut_flush + 'T12:00').getTime()) / 86400000)}
              </button>
            ) : (
              <button
                onClick={() => toggleFlush.mutate(new Date().toISOString().slice(0, 10))}
                className="flex items-center gap-1.5 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-600 dark:text-gray-300 hover:bg-blue-50 dark:hover:bg-blue-900/30 hover:border-blue-300 hover:text-blue-700"
                title="Démarrer le flush"
              >
                <Droplets size={15} /> Flush
              </button>
            )
          )}
          {/* Bouton édition dates */}
          <button
            onClick={() => setShowDatesModal(true)}
            className="flex items-center gap-1.5 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/40"
            title="Éditer les dates clés de la culture"
          >
            <Calendar size={15} /> Dates
          </button>

          {/* Export PDF — toujours visible */}
          <button
            onClick={handleExportPdf}
            disabled={exportingPdf}
            className="flex items-center gap-1.5 px-3 py-2 border border-grow-300 dark:border-grow-700 rounded-lg text-sm text-grow-700 dark:text-grow-300 bg-grow-50 dark:bg-grow-900/20 hover:bg-grow-100 dark:hover:bg-grow-900/40 disabled:opacity-50"
            title="Exporter la fiche culture en PDF"
          >
            {exportingPdf
              ? <Loader2 size={15} className="animate-spin" />
              : <FileDown size={15} />
            }
            PDF
          </button>

          {(culture.statut === 'active' || culture.statut === 'sechage_curing') && (
            <button
              onClick={() => { if (confirm('Clôturer cette culture manuellement ?')) closeCulture.mutate() }}
              className="flex items-center gap-1.5 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/40"
            >
              <CheckCircle size={15} /> Clôturer
            </button>
          )}
          {(culture.statut === 'terminee' || culture.statut === 'sechage_curing') && !confirmDelete && (
            <button
              onClick={() => setConfirmDelete(true)}
              className="flex items-center gap-1.5 px-3 py-2 border border-red-200 rounded-lg text-sm text-red-600 dark:text-red-400 hover:bg-red-50"
              title="Supprimer la culture et toutes ses données"
            >
              <Trash2 size={15} /> Supprimer
            </button>
          )}
          {confirmDelete && (
            <div className="flex items-center gap-2 px-3 py-2 bg-red-50 dark:bg-red-900/20 border border-red-200 rounded-lg">
              <AlertTriangle size={14} className="text-red-600 dark:text-red-400 flex-shrink-0" />
              <span className="text-xs text-red-700 dark:text-red-300">Supprimer définitivement&nbsp;?</span>
              <button
                onClick={() => deleteCulture.mutate()}
                disabled={deleteCulture.isPending}
                className="px-2 py-1 bg-red-600 text-white text-xs rounded hover:bg-red-700 disabled:opacity-50"
              >
                {deleteCulture.isPending ? <Loader2 size={12} className="animate-spin" /> : 'Confirmer'}
              </button>
              <button
                onClick={() => setConfirmDelete(false)}
                className="px-2 py-1 border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 text-xs rounded hover:bg-gray-50 dark:hover:bg-gray-700/40"
              >
                Annuler
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Info bar */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { icon: Clock,  label: 'Jours',          value: culture.jours_culture != null ? `${culture.jours_culture}j` : '—' },
          { icon: Users,  label: 'Plantes actives', value: `${culture.nb_plantes_actives}/${culture.nb_plantes}` },
          { icon: Sun,    label: 'En floraison',    value: (() => {
              const base = culture.date_debut_floraison || culture.date_passage_12_12
              if (!base) return '—'
              const j = Math.floor((Date.now() - new Date(base + 'T12:00').getTime()) / (1000 * 60 * 60 * 24))
              return j >= 0 ? `${j}j` : '—'
            })() },
        ].map(({ icon: Icon, label, value }) => (
          <div key={label} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-3 flex items-center gap-3">
            <div className="w-8 h-8 bg-grow-50 rounded-lg flex items-center justify-center flex-shrink-0">
              <Icon size={16} className="text-grow-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500">{label}</p>
              <p className="text-sm font-bold text-gray-900 dark:text-gray-100">{value}</p>
            </div>
          </div>
        ))}

        {/* Fenêtre de récolte : première → dernière date */}
        <div className={`border rounded-xl p-3 flex items-center gap-3 ${culture.date_recolte_min ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-200' : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700'}`}>
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${culture.date_recolte_min ? 'bg-amber-100 dark:bg-amber-900/30' : 'bg-grow-50'}`}>
            <Flower2 size={16} className={culture.date_recolte_min ? 'text-amber-700 dark:text-amber-300' : 'text-grow-600'} />
          </div>
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500">Fenêtre récolte</p>
            {culture.date_recolte_min ? (
              <p className="text-sm font-bold text-amber-800 dark:text-amber-300">
                {new Date(culture.date_recolte_min + 'T12:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                {' → '}
                {culture.date_recolte_max
                  ? new Date(culture.date_recolte_max + 'T12:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
                  : '?'}
              </p>
            ) : (
              <p className="text-sm font-bold text-gray-400 dark:text-gray-500">—</p>
            )}
          </div>
        </div>

        {/* Dernier arrosage */}
        {(() => {
          const j = culture.jours_depuis_dernier_arrosage
          const { bg, iconColor, text } = j == null
            ? { bg: 'bg-gray-50 dark:bg-gray-700/50',    iconColor: 'text-gray-400 dark:text-gray-500',   text: '—' }
            : j === 0
            ? { bg: 'bg-blue-50 dark:bg-blue-900/20',   iconColor: 'text-blue-600 dark:text-blue-400',   text: "Aujourd'hui" }
            : j <= 2
            ? { bg: 'bg-green-50 dark:bg-green-900/20',  iconColor: 'text-green-600 dark:text-green-400',  text: `${j}j` }
            : j <= 5
            ? { bg: 'bg-orange-50 dark:bg-orange-900/20', iconColor: 'text-orange-600 dark:text-orange-400', text: `${j}j` }
            : { bg: 'bg-red-50 dark:bg-red-900/20',    iconColor: 'text-red-600 dark:text-red-400',    text: `${j}j` }
          return (
            <div className={`${bg} border border-gray-200 dark:border-gray-700 rounded-xl p-3 flex items-center gap-3`}>
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${bg}`}>
                <Droplets size={16} className={iconColor} />
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500">Dernier arrosage</p>
                <p className={`text-sm font-bold ${iconColor}`}>{text}</p>
              </div>
            </div>
          )
        })()}

        {/* Dernier TCO */}
        {(() => {
          const j = culture.jours_depuis_dernier_tco
          const { bg, textColor, text } = j == null
            ? { bg: 'bg-gray-50 dark:bg-gray-700/50',    textColor: 'text-gray-400 dark:text-gray-500',   text: '—' }
            : j === 0
            ? { bg: 'bg-blue-50 dark:bg-blue-900/20',   textColor: 'text-blue-600 dark:text-blue-400',   text: "Aujourd'hui" }
            : j <= 7
            ? { bg: 'bg-green-50 dark:bg-green-900/20',  textColor: 'text-green-600 dark:text-green-400',  text: `${j}j` }
            : j <= 14
            ? { bg: 'bg-orange-50 dark:bg-orange-900/20', textColor: 'text-orange-600 dark:text-orange-400', text: `${j}j` }
            : { bg: 'bg-red-50 dark:bg-red-900/20',    textColor: 'text-red-600 dark:text-red-400',    text: `${j}j` }
          return (
            <div className={`${bg} border border-gray-200 dark:border-gray-700 rounded-xl p-3 flex items-center gap-3`}>
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${bg} text-lg`}>
                🫧
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500">Dernier TCO</p>
                <p className={`text-sm font-bold ${textColor}`}>{text}</p>
              </div>
            </div>
          )
        })()}
      </div>

      {/* Poids total si récoltes */}
      {pesoTotal > 0 && (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 rounded-xl p-4 flex items-center gap-3">
          <span className="text-2xl">⚖️</span>
          <div>
            <p className="text-sm font-bold text-green-800 dark:text-green-300">Récolte totale : {pesoTotal.toFixed(1)} g</p>
            <p className="text-xs text-green-600 dark:text-green-400">
              {culture.plants.filter(p => p.poids_recolte_g != null).length} plante(s) récoltée(s)
            </p>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <div className="flex gap-0">
          {tabs.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors
                ${activeTab === key
                  ? 'border-grow-600 text-grow-600'
                  : 'border-transparent text-gray-500 dark:text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:text-gray-200'}`}
            >
              <Icon size={15} />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div>
        {activeTab === 'calendrier' && (
          <CalendrierCulture cultureId={cultureId} idEspace={culture.id_espace} plants={culture.plants} />
        )}
        {activeTab === 'plantes' && (
          <PlantesTab cultureId={cultureId} plants={culture.plants} />
        )}
        {activeTab === 'stats' && (
          <StatsTab cultureId={cultureId} idEspace={culture.id_espace} phase={culture.phase} />
        )}
        {activeTab === 'photos' && (
          <PhotoGallery idCulture={cultureId} plants={culture.plants} />
        )}
      </div>

      {/* ── Modal édition des dates clés ─────────────────────────────── */}
      {showDatesModal && (
        <DatesModal
          culture={culture}
          onClose={() => setShowDatesModal(false)}
          onSave={(data) => updateDates.mutate(data)}
          isPending={updateDates.isPending}
        />
      )}
    </div>
  )
}

// ─── Page principale ───────────────────────────────────────────────────────────
export default function CulturePage() {
  const [selectedCultureId, setSelectedCultureId] = useState<number | null>(null)
  const [showNewModal, setShowNewModal] = useState(false)
  const [filterStatut, setFilterStatut] = useState<'active' | 'terminee' | 'sechage_curing'>('active')
  const qc = useQueryClient()

  const { data: cultures = [], isLoading } = useQuery<Culture[]>({
    queryKey: ['cultures', filterStatut],
    queryFn: async () => {
      return (await cultureAPI.getAll(filterStatut)).data
    },
  })

  const deleteCultureMutation = useMutation({
    mutationFn: (id: number) => cultureAPI.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cultures'] })
    },
  })

  const createCulture = useMutation({
    mutationFn: (data: CultureCreate) => cultureAPI.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cultures'] })
      qc.invalidateQueries({ queryKey: ['catalogue'] }) // Les graines utilisées changent
    },
    onError: () => {}, // L'erreur est gérée dans le modal via mutateAsync
  })

  if (selectedCultureId !== null) {
    return (
      <CultureDetail
        cultureId={selectedCultureId}
        onBack={() => setSelectedCultureId(null)}
      />
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Suivi de culture</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500 mt-1">{cultures.length} culture{cultures.length > 1 ? 's' : ''}</p>
        </div>
        <button
          onClick={() => setShowNewModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-grow-600 text-white rounded-lg hover:bg-grow-700 transition-colors"
        >
          <Plus size={18} />
          Nouvelle culture
        </button>
      </div>

      {/* Filtres */}
      <div className="flex gap-2 flex-wrap">
        {[
          { key: 'active', label: '🌱 Actives' },
          { key: 'sechage_curing', label: '🌬️ Séchage & Curing' },
          { key: 'terminee', label: '✅ Terminées' },
        ].map(f => (
          <button
            key={f.key}
            onClick={() => setFilterStatut(f.key as 'active' | 'terminee' | 'sechage_curing')}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors
              ${filterStatut === f.key
                ? 'bg-grow-600 text-white'
                : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:border-grow-300'}`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Grille de cultures */}
      {isLoading ? (
        <LoadingSpinner />
      ) : cultures.length === 0 ? (
        <div className="text-center py-16">
          <div className="w-16 h-16 bg-grow-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <Leaf size={28} className="text-grow-400" />
          </div>
          <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-200 mb-2">Aucune culture</h3>
          <p className="text-gray-400 dark:text-gray-500 mb-6">
            {filterStatut === 'active'
              ? 'Aucune culture active. Créez votre première culture !'
              : 'Aucune culture dans cette catégorie'}
          </p>
          {filterStatut === 'active' && (
            <button
              onClick={() => setShowNewModal(true)}
              className="px-5 py-2.5 bg-grow-600 text-white rounded-lg hover:bg-grow-700 font-medium"
            >
              Créer une culture
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {cultures.map(culture => (
            <CultureCard
              key={culture.id_culture}
              culture={culture}
              onClick={() => setSelectedCultureId(culture.id_culture)}
              onDelete={() => deleteCultureMutation.mutate(culture.id_culture)}
            />
          ))}
        </div>
      )}

      {/* Modal nouvelle culture */}
      {showNewModal && (
        <NouvellerCultureModal
          onClose={() => setShowNewModal(false)}
          onSubmit={async (data) => { await createCulture.mutateAsync(data) }}
        />
      )}
    </div>
  )
}
