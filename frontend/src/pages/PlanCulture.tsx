import { useState, useMemo, useEffect } from 'react'
import { Plus, Trash2, AlertTriangle, X, Search, ChevronUp, ChevronDown, ChevronsUpDown, Rocket, ChevronLeft, ChevronRight, CalendarDays, Scissors } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { planCultureAPI, PlanCulture, PlanVariete } from '../api/planCulture'
import { catalogueAPI, CatalogueItem } from '../api/graines'
import { espacesAPI, EspaceCulture } from '../api/espaces'
import { cultureAPI, CultureCreate } from '../api/cultures'
import NouvellerCultureModal from '../components/culture/NouvellerCultureModal'

// ── Constantes ────────────────────────────────────────────────────────────────
const POT_K = 20.8
const POT_ALPHA = 0.59
const POT_SIZES = [1, 3, 5, 7, 11, 16, 25, 35, 50]

function calcNbPots(surface: number, vol: number) {
  if (!surface || !vol) return 0
  return Math.max(0, Math.round(surface * POT_K * Math.pow(vol, -POT_ALPHA)))
}

function typeGraineBadge(type?: string) {
  if (!type) return null
  // Normalize: strip accents then lowercase for robust matching
  // Values stored in DB: "Féminisée", "Régulière", "Auto"
  const t = type.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
  if (t.includes('auto'))
    return <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-100 text-amber-700">AUTO</span>
  if (t.includes('fem'))
    return <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-pink-100 text-pink-700">FEM</span>
  return <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-gray-100 text-gray-600">REG</span>
}

function floAlert(varietes: PlanVariete[]) {
  const withFlo = varietes.filter(v => v.duree_flo_min || v.duree_flo_max)
  if (withFlo.length < 2) return null
  const mins = withFlo.map(v => v.duree_flo_min ?? v.duree_flo_max ?? 0)
  const maxs = withFlo.map(v => v.duree_flo_max ?? v.duree_flo_min ?? 0)
  const ecart = Math.max(...maxs) - Math.min(...mins)
  if (ecart <= 14) return null
  return `Écart de floraison de ${Math.round(ecart / 7)} semaines entre les variétés les plus rapides et les plus lentes.`
}

// ── Helpers tri ──────────────────────────────────────────────────────────────
type SortCol = 'breeder' | 'variete' | 'croisement' | 'type' | 'flo' | 'stock' | 'prix' | 'age'
type SortDir = 'asc' | 'desc'

function SortIcon({ col, current, dir }: { col: SortCol; current: SortCol | null; dir: SortDir }) {
  if (current !== col) return <ChevronsUpDown size={11} className="ml-1 text-gray-300 inline" />
  return dir === 'asc'
    ? <ChevronUp size={11} className="ml-1 text-grow-600 inline" />
    : <ChevronDown size={11} className="ml-1 text-grow-600 inline" />
}

function ageLabel(dateAchat?: string): string {
  if (!dateAchat) return '—'
  const days = Math.floor((Date.now() - new Date(dateAchat).getTime()) / 86400000)
  if (days < 30)  return `${days}j`
  if (days < 365) return `${Math.floor(days / 30)} mois`
  const ans = Math.floor(days / 365)
  const mois = Math.floor((days % 365) / 30)
  return mois > 0 ? `${ans}a ${mois}m` : `${ans} an${ans > 1 ? 's' : ''}`
}

// ── Modal sélection graine ────────────────────────────────────────────────────
interface GraineSelectorModalProps {
  planId: number
  existingPackIds: number[]
  onClose: () => void
}

function GraineSelectorModal({ planId, existingPackIds, onClose }: GraineSelectorModalProps) {
  const qc = useQueryClient()

  // Filtres
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [stockFilter, setStockFilter] = useState('dispo')
  const [sortCol, setSortCol] = useState<SortCol | null>(null)
  const [sortDir, setSortDir] = useState<SortDir>('asc')

  // Sélection
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [isSubmitting, setIsSubmitting] = useState(false)

  const { data: catalogue = [], isLoading } = useQuery<CatalogueItem[]>({
    queryKey: ['catalogue'],
    queryFn: async () => (await catalogueAPI.get()).data,
  })

  const handleSort = (col: SortCol) => {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortCol(col); setSortDir('asc') }
  }

  const filtered = useMemo(() => {
    const base = catalogue.filter(item => {
      const q = search.toLowerCase()
      const matchSearch =
        !q ||
        item.breeder_nom.toLowerCase().includes(q) ||
        item.variete_nom.toLowerCase().includes(q) ||
        (item.croisement_variete || '').toLowerCase().includes(q)
      const matchType = !typeFilter || item.type_graines === typeFilter
      const matchStock =
        !stockFilter ||
        (stockFilter === 'dispo'   && item.nbr_graines_restantes > 0) ||
        (stockFilter === 'rupture' && item.nbr_graines_restantes === 0) ||
        (stockFilter === 'ouvert'  && item.paquet_ouvert) ||
        (stockFilter === 'ferme'   && !item.paquet_ouvert)
      return matchSearch && matchType && matchStock
    })
    if (!sortCol) return base
    return [...base].sort((a, b) => {
      let av: string | number, bv: string | number
      switch (sortCol) {
        case 'breeder':    av = a.breeder_nom;              bv = b.breeder_nom;              break
        case 'variete':    av = a.variete_nom;              bv = b.variete_nom;              break
        case 'croisement': av = a.croisement_variete || ''; bv = b.croisement_variete || ''; break
        case 'type':       av = a.type_graines || '';       bv = b.type_graines || '';       break
        case 'flo':        av = a.duree_flo_min ?? 9999;    bv = b.duree_flo_min ?? 9999;    break
        case 'stock':      av = a.nbr_graines_restantes;    bv = b.nbr_graines_restantes;    break
        case 'prix':       av = a.prix_par_graine ?? 9999;  bv = b.prix_par_graine ?? 9999;  break
        case 'age':        av = a.date_achat || '';         bv = b.date_achat || '';         break
        default:           return 0
      }
      if (av < bv) return sortDir === 'asc' ? -1 : 1
      if (av > bv) return sortDir === 'asc' ? 1 : -1
      return 0
    })
  }, [catalogue, search, typeFilter, stockFilter, sortCol, sortDir])

  // Sélectables (pas déjà dans le plan)
  const selectables = filtered.filter(item => !existingPackIds.includes(item.id_packgraine))
  const allSelected = selectables.length > 0 && selectables.every(item => selected.has(item.id_packgraine))

  const toggleAll = () => {
    if (allSelected) {
      setSelected(new Set())
    } else {
      setSelected(new Set(selectables.map(i => i.id_packgraine)))
    }
  }

  const toggleItem = (id: number) => {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const getStockBadge = (n: number) => {
    if (n === 0) return <span className="px-1.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">0</span>
    if (n <= 1)  return <span className="px-1.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">{n}</span>
    if (n <= 3)  return <span className="px-1.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-700">{n}</span>
    return <span className="px-1.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">{n}</span>
  }

  const handleConfirm = async () => {
    if (selected.size === 0) return
    setIsSubmitting(true)
    try {
      await Promise.all(
        Array.from(selected).map(packId =>
          planCultureAPI.addVariete(planId, { id_packgraine: packId, nb_plantes: 1 })
            .catch(() => {/* ignore 409 si déjà présent */})
        )
      )
      qc.invalidateQueries({ queryKey: ['plans-culture'] })
      onClose()
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-3">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Catalogue Graines</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              Sélectionnez une ou plusieurs variétés à ajouter au plan
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Filtres */}
        <div className="px-4 py-3 border-b bg-gray-50 flex flex-wrap gap-2 items-center">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={14} className="absolute left-2.5 top-2.5 text-gray-400" />
            <input
              type="text"
              placeholder="Breeder, variété, croisement..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-grow-600"
            />
          </div>
          <select
            value={typeFilter}
            onChange={e => setTypeFilter(e.target.value)}
            className="px-3 py-1.5 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-grow-600"
          >
            <option value="">Tous les types</option>
            <option value="Régulière">Régulière</option>
            <option value="Féminisée">Féminisée</option>
            <option value="Auto">Auto</option>
          </select>
          <select
            value={stockFilter}
            onChange={e => setStockFilter(e.target.value)}
            className="px-3 py-1.5 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-grow-600"
          >
            <option value="">Tous les stocks</option>
            <option value="dispo">Disponibles</option>
            <option value="rupture">En rupture</option>
            <option value="ouvert">Paquet ouvert</option>
            <option value="ferme">Paquet fermé</option>
          </select>
          {(search || typeFilter || stockFilter) && (
            <span className="text-xs text-gray-400">
              {filtered.length} résultat{filtered.length > 1 ? 's' : ''}
            </span>
          )}
        </div>

        {/* Tableau */}
        <div className="overflow-auto flex-1">
          {isLoading ? (
            <div className="p-10 text-center text-gray-400 text-sm">Chargement du catalogue...</div>
          ) : filtered.length === 0 ? (
            <div className="p-10 text-center text-gray-400 text-sm">Aucun résultat pour ces critères</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-gray-50 border-b z-10">
                <tr>
                  <th className="px-3 py-2.5 w-8">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={toggleAll}
                      className="rounded accent-grow-600"
                      title="Tout sélectionner / désélectionner"
                    />
                  </th>
                  {([
                    ['breeder',    'Breeder'],
                    ['variete',    'Variété'],
                    ['croisement', 'Croisement'],
                    ['type',       'Type'],
                    ['flo',        'Floraison'],
                    ['stock',      'Stock'],
                    ['age',        'Âge'],
                    ['prix',       'Prix/Graine'],
                  ] as [SortCol, string][]).map(([col, label]) => (
                    <th
                      key={col}
                      onClick={() => handleSort(col)}
                      className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer select-none hover:bg-gray-100 whitespace-nowrap"
                    >
                      {label}<SortIcon col={col} current={sortCol} dir={sortDir} />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map(item => {
                  const alreadyIn = existingPackIds.includes(item.id_packgraine)
                  const isChecked = selected.has(item.id_packgraine)
                  return (
                    <tr
                      key={item.id_packgraine}
                      onClick={() => !alreadyIn && toggleItem(item.id_packgraine)}
                      className={`transition-colors ${
                        alreadyIn
                          ? 'bg-gray-50 opacity-50 cursor-not-allowed'
                          : isChecked
                            ? 'bg-grow-50 cursor-pointer'
                            : 'hover:bg-gray-50 cursor-pointer'
                      }`}
                    >
                      <td className="px-3 py-2.5" onClick={e => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={isChecked}
                          disabled={alreadyIn}
                          onChange={() => !alreadyIn && toggleItem(item.id_packgraine)}
                          className="rounded accent-grow-600 disabled:cursor-not-allowed"
                        />
                      </td>
                      <td className="px-4 py-2.5 font-medium text-gray-800 whitespace-nowrap">
                        {item.breeder_nom}
                      </td>
                      <td className="px-4 py-2.5 text-gray-700 whitespace-nowrap">
                        <span className="flex items-center gap-1.5">
                          {item.variete_nom}
                          {item.edition_limite && (
                            <span className="px-1 py-0.5 rounded text-[9px] font-bold bg-purple-100 text-purple-700 uppercase">
                              LE
                            </span>
                          )}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-gray-500 text-xs max-w-[160px] truncate">
                        {item.croisement_variete ?? '—'}
                      </td>
                      <td className="px-4 py-2.5">
                        {typeGraineBadge(item.type_graines)}
                      </td>
                      <td className="px-4 py-2.5 text-gray-600 whitespace-nowrap text-center">
                        {item.duree_flo_min && item.duree_flo_max
                          ? `${item.duree_flo_min}–${item.duree_flo_max}j`
                          : (item.duree_flo_min ?? item.duree_flo_max
                              ? `${item.duree_flo_min ?? item.duree_flo_max}j` : '—')}
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        {getStockBadge(item.nbr_graines_restantes)}
                        {item.paquet_ouvert && (
                          <span className="ml-1 text-[10px] text-amber-600 bg-amber-50 px-1 rounded">ouvert</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-gray-500 text-center text-xs">
                        {ageLabel(item.date_achat)}
                      </td>
                      <td className="px-4 py-2.5 text-gray-600 text-center text-xs whitespace-nowrap">
                        {item.prix_par_graine != null ? `${item.prix_par_graine.toFixed(2)} €` : '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t bg-gray-50 flex items-center justify-between">
          <span className="text-sm text-gray-500">
            {selected.size > 0
              ? `${selected.size} variété${selected.size > 1 ? 's' : ''} sélectionnée${selected.size > 1 ? 's' : ''}`
              : 'Aucune sélection'}
          </span>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-600 border rounded-lg hover:bg-gray-100 transition-colors"
            >
              Annuler
            </button>
            <button
              onClick={handleConfirm}
              disabled={selected.size === 0 || isSubmitting}
              className="px-4 py-2 text-sm font-medium bg-grow-600 text-white rounded-lg hover:bg-grow-700 disabled:opacity-40 transition-colors"
            >
              {isSubmitting
                ? 'Ajout en cours...'
                : `Ajouter ${selected.size > 0 ? `(${selected.size})` : ''}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Tableau des variétés d'un plan ────────────────────────────────────────────
interface PlanTableProps {
  plan: PlanCulture
}

function PlanTable({ plan }: PlanTableProps) {
  const qc = useQueryClient()
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editValues, setEditValues] = useState<{ nb_plantes: number; taille_pot_l: number | '' }>({
    nb_plantes: 1,
    taille_pot_l: '',
  })
  const [showModal, setShowModal] = useState(false)

  const updateVarieteMut = useMutation({
    mutationFn: ({ pvId, data }: { pvId: number; data: { nb_plantes?: number; taille_pot_l?: number } }) =>
      planCultureAPI.updateVariete(plan.id_plan, pvId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['plans-culture'] })
      setEditingId(null)
    },
  })

  const removeVarieteMut = useMutation({
    mutationFn: (pvId: number) => planCultureAPI.removeVariete(plan.id_plan, pvId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['plans-culture'] }),
  })

  const startEdit = (pv: PlanVariete) => {
    setEditingId(pv.id_plan_variete)
    setEditValues({ nb_plantes: pv.nb_plantes, taille_pot_l: pv.taille_pot_l ?? '' })
  }

  const saveEdit = (pvId: number) => {
    updateVarieteMut.mutate({
      pvId,
      data: {
        nb_plantes: editValues.nb_plantes,
        taille_pot_l: editValues.taille_pot_l !== '' ? Number(editValues.taille_pot_l) : undefined,
      },
    })
  }

  const alert = floAlert(plan.varietes)
  const existingPackIds = plan.varietes.map(v => v.id_packgraine)
  const hasEspace = !!plan.surface_m2

  return (
    <div className="mt-3 space-y-3">
      {/* Alerte floraison */}
      {alert && (
        <div className="flex items-start gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700">
          <AlertTriangle size={14} className="mt-0.5 shrink-0" />
          <span>{alert}</span>
        </div>
      )}

      {/* Tableau */}
      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b">
              <th className="px-3 py-2 text-left font-medium text-gray-500">Breeder</th>
              <th className="px-3 py-2 text-left font-medium text-gray-500">Variété</th>
              <th className="px-3 py-2 text-center font-medium text-gray-500">Type</th>
              <th className="px-3 py-2 text-center font-medium text-gray-500">Flo (j)</th>
              <th className="px-3 py-2 text-center font-medium text-gray-500">Conserv.</th>
              <th className="px-3 py-2 text-center font-medium text-gray-500">Stock</th>
              <th className="px-3 py-2 text-center font-medium text-gray-500">Nb plantes</th>
              <th className="px-3 py-2 text-center font-medium text-gray-500">Taille pot</th>
              {hasEspace && (
                <th className="px-3 py-2 text-center font-medium text-gray-500">Nb pots</th>
              )}
              <th className="px-3 py-2 w-28"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {plan.varietes.length === 0 ? (
              <tr>
                <td
                  colSpan={hasEspace ? 10 : 9}
                  className="px-4 py-8 text-center text-gray-400 text-sm"
                >
                  Aucune variété — ajoutez-en via le bouton ci-dessous
                </td>
              </tr>
            ) : (
              plan.varietes.map(pv => {
                const isEditing = editingId === pv.id_plan_variete
                const nbPots =
                  hasEspace && pv.taille_pot_l
                    ? calcNbPots(plan.surface_m2!, pv.taille_pot_l)
                    : null

                return (
                  <tr key={pv.id_plan_variete} className="hover:bg-gray-50 transition-colors">
                    <td className="px-3 py-2.5 text-gray-500 whitespace-nowrap">
                      {pv.nom_breeder ?? '—'}
                    </td>
                    <td className="px-3 py-2.5 font-medium text-gray-900 whitespace-nowrap">
                      {pv.nom_variete ?? '—'}
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      {typeGraineBadge(pv.type_graine)}
                    </td>
                    <td className="px-3 py-2.5 text-center text-gray-600 whitespace-nowrap">
                      {pv.duree_flo_min && pv.duree_flo_max
                        ? `${pv.duree_flo_min}–${pv.duree_flo_max}`
                        : (pv.duree_flo_min ?? pv.duree_flo_max ?? '—')}
                    </td>
                    <td className="px-3 py-2.5 text-center text-gray-600">
                      {pv.duree_conservation_mois ? `${pv.duree_conservation_mois} mois` : '—'}
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <span
                        className={`font-semibold ${pv.stock_disponible > 0 ? 'text-green-600' : 'text-red-500'}`}
                      >
                        {pv.stock_disponible}
                      </span>
                      {pv.paquet_ouvert && (
                        <span className="ml-1 text-[10px] text-amber-600 bg-amber-50 px-1 rounded">
                          ouvert
                        </span>
                      )}
                    </td>

                    {/* Nb plantes — éditable */}
                    <td className="px-3 py-2.5 text-center">
                      {isEditing ? (
                        <input
                          type="number"
                          min={1}
                          value={editValues.nb_plantes}
                          onChange={e =>
                            setEditValues(v => ({ ...v, nb_plantes: Number(e.target.value) }))
                          }
                          className="w-16 px-2 py-0.5 text-sm border rounded text-center focus:outline-none focus:ring-2 focus:ring-grow-600"
                        />
                      ) : (
                        <span className="font-semibold text-gray-800">{pv.nb_plantes}</span>
                      )}
                    </td>

                    {/* Taille pot — éditable */}
                    <td className="px-3 py-2.5 text-center">
                      {isEditing ? (
                        <select
                          value={editValues.taille_pot_l}
                          onChange={e =>
                            setEditValues(v => ({
                              ...v,
                              taille_pot_l: e.target.value === '' ? '' : Number(e.target.value),
                            }))
                          }
                          className="px-2 py-0.5 text-sm border rounded focus:outline-none focus:ring-2 focus:ring-grow-600"
                        >
                          <option value="">—</option>
                          {POT_SIZES.map(s => (
                            <option key={s} value={s}>
                              {s} L
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span className="text-gray-700">
                          {pv.taille_pot_l ? `${pv.taille_pot_l} L` : '—'}
                        </span>
                      )}
                    </td>

                    {/* Nb pots calculé */}
                    {hasEspace && (
                      <td className="px-3 py-2.5 text-center text-gray-400 text-xs">
                        {nbPots !== null ? `≈ ${nbPots}` : '—'}
                      </td>
                    )}

                    {/* Actions ligne */}
                    <td className="px-3 py-2.5 text-right">
                      {isEditing ? (
                        <div className="flex items-center gap-1 justify-end">
                          <button
                            onClick={() => saveEdit(pv.id_plan_variete)}
                            disabled={updateVarieteMut.isPending}
                            className="px-2.5 py-1 bg-grow-600 text-white rounded text-xs hover:bg-grow-700 disabled:opacity-50"
                          >
                            ✓ Sauver
                          </button>
                          <button
                            onClick={() => setEditingId(null)}
                            className="px-2 py-1 text-gray-500 border rounded text-xs hover:bg-gray-100"
                          >
                            ✕
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 justify-end">
                          <button
                            onClick={() => startEdit(pv)}
                            className="px-2 py-1 text-xs text-gray-500 border rounded hover:bg-gray-50 hover:text-gray-700 transition-colors"
                          >
                            Éditer
                          </button>
                          <button
                            onClick={() => removeVarieteMut.mutate(pv.id_plan_variete)}
                            disabled={removeVarieteMut.isPending}
                            className="p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors disabled:opacity-50"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>

          {/* Footer totaux */}
          {plan.varietes.length > 0 && (() => {
            const totalSubstrat = plan.varietes.reduce((sum, pv) =>
              pv.taille_pot_l ? sum + pv.nb_plantes * pv.taille_pot_l : sum, 0
            )
            return (
              <tfoot>
                <tr className="bg-gray-50 border-t font-medium">
                  <td colSpan={6} className="px-3 py-2 text-right text-sm text-gray-500">
                    Total :
                  </td>
                  <td className="px-3 py-2 text-center text-gray-900 font-bold">
                    {plan.nb_plantes_total}
                  </td>
                  <td className="px-3 py-2 text-center font-bold text-grow-700">
                    {totalSubstrat > 0 ? `${totalSubstrat} L` : ''}
                  </td>
                  {hasEspace && <td colSpan={2}></td>}
                </tr>
              </tfoot>
            )
          })()}
        </table>
      </div>

      {/* Bouton ajouter */}
      <div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-grow-600 text-white rounded-lg hover:bg-grow-700 transition-colors"
        >
          <Plus size={14} /> Ajouter une variété
        </button>
      </div>

      {/* Modal sélection graine */}
      {showModal && (
        <GraineSelectorModal
          planId={plan.id_plan}
          existingPackIds={existingPackIds}
          onClose={() => setShowModal(false)}
        />
      )}
    </div>
  )
}

// ── Section par espace ────────────────────────────────────────────────────────
interface EspaceSectionProps {
  espace: EspaceCulture | null
  plans: PlanCulture[]
}

// ── Helpers date récolte ──────────────────────────────────────────────────────
function formatDate(d: Date): string {
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
}

function EspaceSection({ espace, plans }: EspaceSectionProps) {
  const qc = useQueryClient()
  const navigate = useNavigate()
  const [selectedPlanId, setSelectedPlanId] = useState<number | null>(
    () => plans[0]?.id_plan ?? null,
  )
  const [showNewPlanInput, setShowNewPlanInput] = useState(false)
  const [newPlanNom, setNewPlanNom] = useState('')
  const [showLancerModal, setShowLancerModal] = useState(false)

  // ── Simulateur de récolte ─────────────────────────────────────────────────
  const [dateDebut, setDateDebut] = useState('')
  const [dureeVeg, setDureeVeg] = useState('')

  // Reset simulateur si on change de plan
  useEffect(() => {
    setDateDebut('')
    setDureeVeg('')
  }, [selectedPlanId])

  // Sync sélection quand la liste change
  useEffect(() => {
    if (selectedPlanId === null && plans.length > 0) {
      setSelectedPlanId(plans[0].id_plan)
    } else if (selectedPlanId !== null && !plans.find(p => p.id_plan === selectedPlanId)) {
      setSelectedPlanId(plans[0]?.id_plan ?? null)
    }
  }, [plans])

  const createPlanMut = useMutation({
    mutationFn: (nom: string) =>
      planCultureAPI.create({ nom, id_espace: espace?.id_espace }),
    onSuccess: res => {
      qc.invalidateQueries({ queryKey: ['plans-culture'] })
      setSelectedPlanId(res.data.id_plan)
      setShowNewPlanInput(false)
      setNewPlanNom('')
    },
  })

  const deletePlanMut = useMutation({
    mutationFn: (id: number) => planCultureAPI.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['plans-culture'] }),
  })

  const selectedPlan = plans.find(p => p.id_plan === selectedPlanId) ?? null

  // Calcul fourchette de récolte
  const harvestRange = useMemo(() => {
    if (!selectedPlan || !dateDebut || !dureeVeg) return null
    const plantesAvecFlo = selectedPlan.varietes.filter(v => v.duree_flo_min || v.duree_flo_max)
    if (plantesAvecFlo.length === 0) return null

    const start = new Date(dateDebut)
    const growDays = Number(dureeVeg) * 7

    const allMins = plantesAvecFlo.map(v => v.duree_flo_min ?? v.duree_flo_max ?? 0)
    const allMaxs = plantesAvecFlo.map(v => v.duree_flo_max ?? v.duree_flo_min ?? 0)

    const minFlo = Math.min(...allMins)
    const maxFlo = Math.max(...allMaxs)

    const earliest = new Date(start.getTime() + (growDays + minFlo) * 86_400_000)
    const latest   = new Date(start.getTime() + (growDays + maxFlo) * 86_400_000)

    return { earliest, latest, same: minFlo === maxFlo }
  }, [selectedPlan, dateDebut, dureeVeg])

  // Bloc récolte estimée (extrait pour éviter les ternaires imbriqués en JSX)
  const harvestBlock = (() => {
    if (!dateDebut || !dureeVeg) return null
    if (!harvestRange) {
      if (!selectedPlan || selectedPlan.varietes.length === 0) return null
      return (
        <div className="flex flex-col gap-0.5">
          <label className="text-[11px] font-medium text-gray-500 uppercase tracking-wide flex items-center gap-1">
            <Scissors size={11} /> Récolte estimée
          </label>
          <div className="px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-400 italic">
            Durées de floraison manquantes
          </div>
        </div>
      )
    }
    const label = harvestRange.same
      ? formatDate(harvestRange.earliest)
      : formatDate(harvestRange.earliest) + ' \u2192 ' + formatDate(harvestRange.latest)
    return (
      <div className="flex flex-col gap-0.5">
        <label className="text-[11px] font-medium text-gray-500 uppercase tracking-wide flex items-center gap-1">
          <Scissors size={11} /> Récolte estimée
        </label>
        <div className="px-3 py-1.5 bg-green-50 border border-green-200 rounded-lg text-sm font-medium text-green-800 whitespace-nowrap">
          {label}
        </div>
      </div>
    )
  })()

  const headerLabel = espace
    ? `${espace.nom}${espace.surface_m2 ? ` · ${espace.surface_m2} m²` : ''}${espace.dimensions ? ` (${espace.dimensions})` : ''}`
    : 'Sans espace'

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      {/* Header espace */}
      <div className="px-5 py-3 bg-grow-600 flex items-center justify-between">
        <span className="font-semibold text-white">{headerLabel}</span>
        <span className="text-grow-100 text-sm">
          {plans.length} plan{plans.length !== 1 ? 's' : ''}
        </span>
      </div>

      <div className="p-5">
        {/* Navigation pagination + bouton nouveau plan */}
        {(() => {
          const currentIndex = plans.findIndex(p => p.id_plan === selectedPlanId)
          const hasPrev = currentIndex > 0
          const hasNext = currentIndex < plans.length - 1

          const goTo = (idx: number) => {
            if (idx >= 0 && idx < plans.length) setSelectedPlanId(plans[idx].id_plan)
          }

          return (
            <div className="flex items-center gap-2 flex-wrap">
              {/* Pagination : seulement si > 1 plan */}
              {plans.length > 1 && (
                <div className="flex items-center gap-1 bg-gray-50 border border-gray-200 rounded-lg px-1 py-1">
                  <button
                    onClick={() => goTo(currentIndex - 1)}
                    disabled={!hasPrev}
                    className="p-1 rounded text-gray-500 hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    title="Plan précédent"
                  >
                    <ChevronLeft size={15} />
                  </button>

                  <div className="px-2 text-center min-w-[120px]">
                    <span className="text-sm font-semibold text-gray-800 truncate block max-w-[160px]">
                      {selectedPlan?.nom ?? '—'}
                    </span>
                    <span className="text-[10px] text-gray-400">
                      {currentIndex + 1} / {plans.length}
                      {selectedPlan && selectedPlan.nb_plantes_total > 0 && (
                        <> · {selectedPlan.nb_plantes_total} plante{selectedPlan.nb_plantes_total > 1 ? 's' : ''}</>
                      )}
                    </span>
                  </div>

                  <button
                    onClick={() => goTo(currentIndex + 1)}
                    disabled={!hasNext}
                    className="p-1 rounded text-gray-500 hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    title="Plan suivant"
                  >
                    <ChevronRight size={15} />
                  </button>
                </div>
              )}

              {/* Plan unique : afficher juste le nom */}
              {plans.length === 1 && selectedPlan && (
                <div className="px-3 py-1.5 bg-grow-600 text-white rounded-lg text-sm font-medium shadow-sm">
                  {selectedPlan.nom}
                  {selectedPlan.nb_plantes_total > 0 && (
                    <span className="ml-1.5 text-xs text-grow-100">
                      ({selectedPlan.nb_plantes_total})
                    </span>
                  )}
                </div>
              )}

              {/* Supprimer le plan courant */}
              {selectedPlan && (
                <button
                  onClick={() => {
                    if (confirm(`Supprimer le plan "${selectedPlan.nom}" ?`))
                      deletePlanMut.mutate(selectedPlan.id_plan)
                  }}
                  className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  title="Supprimer ce plan"
                >
                  <Trash2 size={14} />
                </button>
              )}

              {/* Nouveau plan */}
              {showNewPlanInput ? (
                <div className="flex items-center gap-1">
                  <input
                    autoFocus
                    type="text"
                    value={newPlanNom}
                    onChange={e => setNewPlanNom(e.target.value)}
                    placeholder="Nom du plan..."
                    onKeyDown={e => {
                      if (e.key === 'Enter' && newPlanNom.trim())
                        createPlanMut.mutate(newPlanNom.trim())
                      if (e.key === 'Escape') {
                        setShowNewPlanInput(false)
                        setNewPlanNom('')
                      }
                    }}
                    className="px-3 py-1.5 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-grow-600 w-44"
                  />
                  <button
                    onClick={() => { if (newPlanNom.trim()) createPlanMut.mutate(newPlanNom.trim()) }}
                    disabled={!newPlanNom.trim() || createPlanMut.isPending}
                    className="px-2.5 py-1.5 bg-grow-600 text-white rounded-lg text-xs disabled:opacity-40 hover:bg-grow-700"
                  >
                    ✓
                  </button>
                  <button
                    onClick={() => { setShowNewPlanInput(false); setNewPlanNom('') }}
                    className="px-2 py-1.5 text-gray-500 border rounded-lg text-xs hover:bg-gray-100"
                  >
                    ✕
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setShowNewPlanInput(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-500 border border-dashed rounded-lg hover:border-grow-600 hover:text-grow-600 transition-colors"
                >
                  <Plus size={12} /> Nouveau plan
                </button>
              )}
            </div>
          )
        })()}

        {/* Contenu plan sélectionné */}
        {selectedPlan ? (
          <>
            {/* ── Simulateur de récolte ── */}
            <div className="mt-4 flex flex-wrap items-center gap-3">
              {/* Date de début */}
              <div className="flex flex-col gap-0.5">
                <label className="text-[11px] font-medium text-gray-500 uppercase tracking-wide flex items-center gap-1">
                  <CalendarDays size={11} /> Date de début
                </label>
                <input
                  type="date"
                  value={dateDebut}
                  onChange={e => setDateDebut(e.target.value)}
                  className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-grow-600 bg-white"
                />
              </div>

              {/* Durée de croissance */}
              <div className="flex flex-col gap-0.5">
                <label className="text-[11px] font-medium text-gray-500 uppercase tracking-wide">
                  Durée vég. depuis germination
                </label>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    min={1}
                    max={52}
                    placeholder="—"
                    value={dureeVeg}
                    onChange={e => setDureeVeg(e.target.value)}
                    className="w-20 px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-grow-600 bg-white text-center"
                  />
                  <span className="text-sm text-gray-500">sem.</span>
                </div>
              </div>

              {/* Fourchette de récolte */}
              {harvestBlock}
            </div>

            <PlanTable plan={selectedPlan} />

            {/* Bouton lancer */}
            {selectedPlan.varietes.length > 0 && (
              <div className="mt-4 flex justify-end">
                <button
                  onClick={() => setShowLancerModal(true)}
                  className="flex items-center gap-2 px-4 py-2.5 bg-green-600 text-white rounded-lg font-medium text-sm hover:bg-green-700 active:scale-95 transition-all shadow-sm"
                >
                  <Rocket size={16} />
                  Lancer cette culture
                </button>
              </div>
            )}
          </>
        ) : (
          <div className="mt-4 py-6 text-center text-gray-400 text-sm">
            Créez un plan pour commencer à planifier vos variétés
          </div>
        )}
      </div>

      {/* Modal lancer culture (pré-rempli depuis le plan) */}
      {showLancerModal && selectedPlan && (
        <NouvellerCultureModal
          onClose={() => setShowLancerModal(false)}
          onSubmit={async (data: CultureCreate) => {
            await cultureAPI.create(data)
            qc.invalidateQueries({ queryKey: ['cultures'] })
            setShowLancerModal(false)
            navigate('/culture')
          }}
          initialData={{
            id_espace: espace?.id_espace,
            selections: selectedPlan.varietes.map(v => ({
              id_packgraine: v.id_packgraine,
              nb_plantes: v.nb_plantes,
              variete_nom: [v.nom_breeder, v.nom_variete].filter(Boolean).join(' — '),
            })),
          }}
        />
      )}
    </div>
  )
}

// ── Page principale ──────────────────────────────────────────────
export default function PlanCulturePage() {
  const { data: plans = [], isLoading } = useQuery<PlanCulture[]>({
    queryKey: ['plans-culture'],
    queryFn: async () => (await planCultureAPI.getAll()).data,
  })

  const { data: espaces = [] } = useQuery<EspaceCulture[]>({
    queryKey: ['espaces'],
    queryFn: async () => (await espacesAPI.getAll()).data,
  })

  // Grouper plans par espace
  const plansByEspace = useMemo(() => {
    const map = new Map<number | null, PlanCulture[]>()
    for (const plan of plans) {
      const key = plan.id_espace ?? null
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(plan)
    }
    return map
  }, [plans])

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-gray-400 text-sm">Chargement...</div>
      </div>
    )
  }

  const plansWithoutEspace = plansByEspace.get(null) ?? []

  return (
    <div className="flex-1 overflow-auto p-6 space-y-6">
      {/* Titre */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Préparer une culture</h1>
        <p className="text-sm text-gray-500 mt-1">
          Planifiez vos prochaines cultures par espace · variétés et quantités
        </p>
      </div>

      {/* Un bloc par espace */}
      {espaces.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-10 text-center">
          <p className="text-gray-500 text-sm">Aucun espace de culture configuré.</p>
          <p className="text-gray-400 text-xs mt-1">
            Créez des espaces de culture dans les paramètres pour commencer.
          </p>
        </div>
      ) : (
        espaces.map(espace => (
          <EspaceSection
            key={espace.id_espace}
            espace={espace}
            plans={plansByEspace.get(espace.id_espace) ?? []}
          />
        ))
      )}

      {/* Plans sans espace associé */}
      {plansWithoutEspace.length > 0 && (
        <EspaceSection espace={null} plans={plansWithoutEspace} />
      )}
    </div>
  )
}
