import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Plus, ArrowLeft, Leaf, Calendar, Users, BarChart2,
  Flower2, Droplets, Sun, Clock, X, CheckCircle, Trash2, AlertTriangle, Loader2,
  Pencil, Check,
} from 'lucide-react'
import { cultureAPI, Culture, CultureWithDetails, CultureCreate } from '../api/cultures'
import LoadingSpinner from '../components/LoadingSpinner'
import CalendrierCulture from '../components/culture/CalendrierCulture'
import PlantesTab from '../components/culture/PlantesTab'
import StatsTab from '../components/culture/StatsTab'
import NouvellerCultureModal from '../components/culture/NouvellerCultureModal'

// ─── Statut badges ────────────────────────────────────────────────────────────
const STATUT_CONFIG = {
  active:          { label: 'Active',          className: 'bg-green-100 text-green-700' },
  sechage_curing:  { label: 'Séchage & Curing',className: 'bg-yellow-100 text-yellow-700' },
  terminee:        { label: 'Terminée',         className: 'bg-gray-100 text-gray-600' },
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
  const isDeletable = culture.statut === 'terminee' || culture.statut === 'sechage_curing'
  const statut = STATUT_CONFIG[culture.statut as keyof typeof STATUT_CONFIG] || STATUT_CONFIG.active

  return (
    <div
      onClick={confirmDelete ? undefined : onClick}
      className={`bg-white border border-gray-200 rounded-xl p-5 transition-all group ${confirmDelete ? '' : 'hover:shadow-md hover:border-grow-300 cursor-pointer'}`}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-gray-900 text-base truncate group-hover:text-grow-700 transition-colors">
            {culture.nom || `Culture #${culture.id_culture}`}
          </h3>
          {culture.nom_espace && (
            <p className="text-sm text-gray-500 mt-0.5">📦 {culture.nom_espace}</p>
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
        <div className="flex items-center gap-1.5 text-sm text-gray-600 mb-3">
          <span>{PHASE_CONFIG[culture.phase]?.icon ?? '📍'}</span>
          <span>{PHASE_CONFIG[culture.phase]?.label ?? culture.phase}</span>
        </div>
      )}

      {/* Métriques */}
      <div className="grid grid-cols-4 gap-1.5 text-center">
        <div className="bg-gray-50 rounded-lg p-2">
          <p className="text-lg font-bold text-gray-900">{culture.nb_plantes_actives}</p>
          <p className="text-xs text-gray-500">plantes</p>
        </div>
        <div className="bg-gray-50 rounded-lg p-2">
          <p className="text-lg font-bold text-gray-900">{culture.jours_culture ?? '—'}</p>
          <p className="text-xs text-gray-500">jours</p>
        </div>
        <div className={`rounded-lg p-2 ${culture.date_debut_floraison ? 'bg-purple-50' : 'bg-gray-50'}`}>
          <p className={`text-lg font-bold ${culture.date_debut_floraison ? 'text-purple-700' : 'text-gray-400'}`}>
            {culture.date_debut_floraison
              ? `${Math.max(0, Math.floor((Date.now() - new Date(culture.date_debut_floraison + 'T12:00').getTime()) / (1000*60*60*24)))}j`
              : '—'}
          </p>
          <p className="text-xs text-gray-500">🌸 flo.</p>
        </div>
        <div className={`rounded-lg p-2 col-span-1 ${culture.date_recolte_min ? 'bg-amber-50' : 'bg-gray-50'}`}>
          {culture.date_recolte_min ? (
            <>
              <p className="text-xs font-bold text-amber-800 leading-tight">
                {new Date(culture.date_recolte_min + 'T12:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
              </p>
              <p className="text-xs font-bold text-amber-900 leading-tight">
                → {culture.date_recolte_max
                  ? new Date(culture.date_recolte_max + 'T12:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
                  : '?'}
              </p>
            </>
          ) : (
            <p className="text-lg font-bold text-gray-400">—</p>
          )}
          <p className="text-xs text-gray-500 mt-0.5">🌾 récolte</p>
        </div>
      </div>

      {/* Badges arrosage + TCO */}
      <div className="flex flex-col gap-1 mt-2">
        {(() => {
          const j = culture.jours_depuis_dernier_arrosage
          if (j == null) return (
            <div className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg bg-gray-50 text-gray-400">
              <Droplets size={12} /> Aucun arrosage enregistré
            </div>
          )
          const cls = j === 0 ? 'bg-blue-50 text-blue-700'
            : j <= 2 ? 'bg-green-50 text-green-700'
            : j <= 5 ? 'bg-orange-50 text-orange-700'
            : 'bg-red-50 text-red-700'
          const label = j === 0 ? "Arrosé aujourd'hui" : `Dernier arrosage il y a ${j}j`
          return (
            <div className={`flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg font-medium ${cls}`}>
              <Droplets size={12} /> {label}
            </div>
          )
        })()}
        {(() => {
          const j = culture.jours_depuis_dernier_tco
          if (j == null) return (
            <div className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg bg-gray-50 text-gray-400">
              🫧 Aucun TCO enregistré
            </div>
          )
          const cls = j === 0 ? 'bg-blue-50 text-blue-700'
            : j <= 7  ? 'bg-green-50 text-green-700'
            : j <= 14 ? 'bg-orange-50 text-orange-700'
            : 'bg-red-50 text-red-700'
          const label = j === 0 ? 'TCO préparé aujourd\'hui' : `Dernier TCO il y a ${j}j`
          return (
            <div className={`flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg font-medium ${cls}`}>
              🫧 {label}
            </div>
          )
        })()}
      </div>

      {/* Date début */}
      {culture.date_debut && (
        <p className="text-xs text-gray-400 mt-3">
          Démarrée le {new Date(culture.date_debut + 'T12:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
        </p>
      )}

      {/* Confirmation suppression */}
      {confirmDelete && (
        <div
          className="mt-3 p-2.5 bg-red-50 border border-red-200 rounded-lg"
          onClick={e => e.stopPropagation()}
        >
          <div className="flex items-center gap-1.5 mb-2">
            <AlertTriangle size={13} className="text-red-600" />
            <span className="text-xs font-medium text-red-700">
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
              className="flex-1 px-2 py-1 border border-gray-300 text-gray-600 text-xs rounded hover:bg-gray-50"
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
function CultureDetail({ cultureId, onBack }: { cultureId: number; onBack: () => void }) {
  const [activeTab, setActiveTab] = useState<'calendrier' | 'plantes' | 'stats'>('calendrier')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [editingName, setEditingName] = useState(false)
  const [nameValue, setNameValue] = useState('')
  const qc = useQueryClient()

  const { data: culture, isLoading } = useQuery<CultureWithDetails>({
    queryKey: ['culture', cultureId],
    queryFn: async () => (await cultureAPI.getById(cultureId)).data,
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

  if (isLoading) return <LoadingSpinner />
  if (!culture) return <div className="text-gray-400 text-center py-12">Culture introuvable</div>

  const statut = STATUT_CONFIG[culture.statut as keyof typeof STATUT_CONFIG] || STATUT_CONFIG.active
  const pesoTotal = culture.plants
    .filter(p => p.poids_recolte_g != null)
    .reduce((sum, p) => sum + (p.poids_recolte_g || 0), 0)

  const tabs = [
    { key: 'calendrier' as const, label: 'Calendrier', icon: Calendar },
    { key: 'plantes' as const,    label: `Plantes (${culture.plants.length})`, icon: Leaf },
    { key: 'stats' as const,      label: 'Stats', icon: BarChart2 },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-3">
        <button onClick={onBack}
          className="mt-1 p-1.5 hover:bg-gray-100 rounded-lg transition-colors text-gray-500">
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
                  className="text-xl font-bold text-gray-900 border-b-2 border-grow-500 bg-transparent outline-none px-1"
                />
                <button onClick={() => renameCulture.mutate(nameValue)} disabled={renameCulture.isPending}
                  className="p-1 text-grow-600 hover:text-grow-800">
                  {renameCulture.isPending ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                </button>
                <button onClick={() => setEditingName(false)} className="p-1 text-gray-400 hover:text-gray-600">
                  <X size={16} />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold text-gray-900 truncate">
                  {culture.nom || `Culture #${culture.id_culture}`}
                </h1>
                <button
                  onClick={() => { setNameValue(culture.nom || ''); setEditingName(true) }}
                  className="p-1 text-gray-300 hover:text-gray-600 transition-colors"
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
            <p className="text-sm text-gray-500 mt-1">📦 {culture.nom_espace}</p>
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
          {culture.statut === 'active' && (
            <button
              onClick={() => { if (confirm('Clôturer cette culture manuellement ?')) closeCulture.mutate() }}
              className="flex items-center gap-1.5 px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50"
            >
              <CheckCircle size={15} /> Clôturer
            </button>
          )}
          {(culture.statut === 'terminee' || culture.statut === 'sechage_curing') && !confirmDelete && (
            <button
              onClick={() => setConfirmDelete(true)}
              className="flex items-center gap-1.5 px-3 py-2 border border-red-200 rounded-lg text-sm text-red-600 hover:bg-red-50"
              title="Supprimer la culture et toutes ses données"
            >
              <Trash2 size={15} /> Supprimer
            </button>
          )}
          {confirmDelete && (
            <div className="flex items-center gap-2 px-3 py-2 bg-red-50 border border-red-200 rounded-lg">
              <AlertTriangle size={14} className="text-red-600 flex-shrink-0" />
              <span className="text-xs text-red-700">Supprimer définitivement&nbsp;?</span>
              <button
                onClick={() => deleteCulture.mutate()}
                disabled={deleteCulture.isPending}
                className="px-2 py-1 bg-red-600 text-white text-xs rounded hover:bg-red-700 disabled:opacity-50"
              >
                {deleteCulture.isPending ? <Loader2 size={12} className="animate-spin" /> : 'Confirmer'}
              </button>
              <button
                onClick={() => setConfirmDelete(false)}
                className="px-2 py-1 border border-gray-300 text-gray-600 text-xs rounded hover:bg-gray-50"
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
          <div key={label} className="bg-white border border-gray-200 rounded-xl p-3 flex items-center gap-3">
            <div className="w-8 h-8 bg-grow-50 rounded-lg flex items-center justify-center flex-shrink-0">
              <Icon size={16} className="text-grow-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">{label}</p>
              <p className="text-sm font-bold text-gray-900">{value}</p>
            </div>
          </div>
        ))}

        {/* Fenêtre de récolte : première → dernière date */}
        <div className={`border rounded-xl p-3 flex items-center gap-3 ${culture.date_recolte_min ? 'bg-amber-50 border-amber-200' : 'bg-white border-gray-200'}`}>
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${culture.date_recolte_min ? 'bg-amber-100' : 'bg-grow-50'}`}>
            <Flower2 size={16} className={culture.date_recolte_min ? 'text-amber-700' : 'text-grow-600'} />
          </div>
          <div>
            <p className="text-xs text-gray-500">Fenêtre récolte</p>
            {culture.date_recolte_min ? (
              <p className="text-sm font-bold text-amber-800">
                {new Date(culture.date_recolte_min + 'T12:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                {' → '}
                {culture.date_recolte_max
                  ? new Date(culture.date_recolte_max + 'T12:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
                  : '?'}
              </p>
            ) : (
              <p className="text-sm font-bold text-gray-400">—</p>
            )}
          </div>
        </div>

        {/* Dernier arrosage */}
        {(() => {
          const j = culture.jours_depuis_dernier_arrosage
          const { bg, iconColor, text } = j == null
            ? { bg: 'bg-gray-50',    iconColor: 'text-gray-400',   text: '—' }
            : j === 0
            ? { bg: 'bg-blue-50',   iconColor: 'text-blue-600',   text: "Aujourd'hui" }
            : j <= 2
            ? { bg: 'bg-green-50',  iconColor: 'text-green-600',  text: `${j}j` }
            : j <= 5
            ? { bg: 'bg-orange-50', iconColor: 'text-orange-600', text: `${j}j` }
            : { bg: 'bg-red-50',    iconColor: 'text-red-600',    text: `${j}j` }
          return (
            <div className={`${bg} border border-gray-200 rounded-xl p-3 flex items-center gap-3`}>
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${bg}`}>
                <Droplets size={16} className={iconColor} />
              </div>
              <div>
                <p className="text-xs text-gray-500">Dernier arrosage</p>
                <p className={`text-sm font-bold ${iconColor}`}>{text}</p>
              </div>
            </div>
          )
        })()}

        {/* Dernier TCO */}
        {(() => {
          const j = culture.jours_depuis_dernier_tco
          const { bg, textColor, text } = j == null
            ? { bg: 'bg-gray-50',    textColor: 'text-gray-400',   text: '—' }
            : j === 0
            ? { bg: 'bg-blue-50',   textColor: 'text-blue-600',   text: "Aujourd'hui" }
            : j <= 7
            ? { bg: 'bg-green-50',  textColor: 'text-green-600',  text: `${j}j` }
            : j <= 14
            ? { bg: 'bg-orange-50', textColor: 'text-orange-600', text: `${j}j` }
            : { bg: 'bg-red-50',    textColor: 'text-red-600',    text: `${j}j` }
          return (
            <div className={`${bg} border border-gray-200 rounded-xl p-3 flex items-center gap-3`}>
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${bg} text-lg`}>
                🫧
              </div>
              <div>
                <p className="text-xs text-gray-500">Dernier TCO</p>
                <p className={`text-sm font-bold ${textColor}`}>{text}</p>
              </div>
            </div>
          )
        })()}
      </div>

      {/* Poids total si récoltes */}
      {pesoTotal > 0 && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center gap-3">
          <span className="text-2xl">⚖️</span>
          <div>
            <p className="text-sm font-bold text-green-800">Récolte totale : {pesoTotal.toFixed(1)} g</p>
            <p className="text-xs text-green-600">
              {culture.plants.filter(p => p.poids_recolte_g != null).length} plante(s) récoltée(s)
            </p>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <div className="flex gap-0">
          {tabs.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors
                ${activeTab === key
                  ? 'border-grow-600 text-grow-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'}`}
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
          <CalendrierCulture cultureId={cultureId} plants={culture.plants} />
        )}
        {activeTab === 'plantes' && (
          <PlantesTab cultureId={cultureId} plants={culture.plants} />
        )}
        {activeTab === 'stats' && (
          <StatsTab cultureId={cultureId} />
        )}
      </div>
    </div>
  )
}

// ─── Page principale ───────────────────────────────────────────────────────────
export default function CulturePage() {
  const [selectedCultureId, setSelectedCultureId] = useState<number | null>(null)
  const [showNewModal, setShowNewModal] = useState(false)
  const [filterStatut, setFilterStatut] = useState<'active' | 'terminee' | 'all'>('active')
  const qc = useQueryClient()

  const { data: cultures = [], isLoading } = useQuery<Culture[]>({
    queryKey: ['cultures', filterStatut],
    queryFn: async () => {
      const statut = filterStatut === 'all' ? undefined : filterStatut
      return (await cultureAPI.getAll(statut)).data
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
          <h1 className="text-2xl font-bold text-gray-900">Suivi de culture</h1>
          <p className="text-sm text-gray-500 mt-1">{cultures.length} culture{cultures.length > 1 ? 's' : ''}</p>
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
          { key: 'terminee', label: '✅ Terminées' },
          { key: 'all', label: 'Toutes' },
        ].map(f => (
          <button
            key={f.key}
            onClick={() => setFilterStatut(f.key as typeof filterStatut)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors
              ${filterStatut === f.key
                ? 'bg-grow-600 text-white'
                : 'bg-white border border-gray-200 text-gray-600 hover:border-grow-300'}`}
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
          <h3 className="text-lg font-semibold text-gray-700 mb-2">Aucune culture</h3>
          <p className="text-gray-400 mb-6">
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
