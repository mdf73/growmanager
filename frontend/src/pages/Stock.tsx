import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Plus, Search, Package, Pencil, Trash2, Loader2, AlertTriangle,
  ChevronUp, ChevronDown, ChevronsUpDown, ArrowDownUp, LogOut,
  FlaskConical, Snowflake,
} from 'lucide-react'
import { stockAPI, Stock } from '../api/stock'
import { curingAPI, SessionCuring, PlantCuring } from '../api/curing'
import LoadingSpinner from '../components/LoadingSpinner'
import EmptyState from '../components/EmptyState'
import NouveauStockModal from '../components/NouveauStockModal'
import ImportExportModal from '../components/ImportExportModal'

// ── Tri ──────────────────────────────────────────────────────────────────────
type StockSortCol = 'variete' | 'type' | 'soustype' | 'engrais' | 'bocal' | 'quantite' | 'date' | 'age'
type ExtractionSortCol = 'variete' | 'type' | 'quantite' | 'date' | 'age'
type SortDir = 'asc' | 'desc'
type CuringSortCol = 'plante' | 'variete' | 'culture' | 'bocal' | 'debut' | 'jours' | 'jours_recolte' | 'quantite'

function SortIcon({ col, current, dir }: { col: string; current: string | null; dir: SortDir }) {
  if (current !== col) return <ChevronsUpDown size={12} className="ml-1 text-gray-300 inline" />
  return dir === 'asc'
    ? <ChevronUp   size={12} className="ml-1 text-grow-600 inline" />
    : <ChevronDown size={12} className="ml-1 text-grow-600 inline" />
}

// ── Age / duree ───────────────────────────────────────────────────────────────
function ageLabel(dateStr?: string): string {
  if (!dateStr) return '—'
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 86_400_000)
  if (diff < 0) return '—'
  if (diff < 30) return `${diff} j`
  if (diff < 365) { const m = Math.floor(diff / 30); return `${m} mois` }
  const y = Math.floor(diff / 365)
  return `${y} an${y > 1 ? 's' : ''}`
}

function durationLabel(start?: string, end?: string): string {
  if (!start || !end) return '—'
  const diff = Math.floor((new Date(end).getTime() - new Date(start).getTime()) / 86_400_000)
  if (diff <= 0) return '< 1 j'
  if (diff < 30) return `${diff} j`
  if (diff < 365) { const m = Math.floor(diff / 30); return `${m} mois` }
  const y = Math.floor(diff / 365)
  return `${y} an${y > 1 ? 's' : ''}`
}

// ── Badges type ──────────────────────────────────────────────────────────────
const TYPE_COLORS: Record<string, string> = {
  Fleur:     'bg-green-100 text-green-700',
  Trim:      'bg-lime-100 text-lime-700',
  WPFF:      'bg-cyan-100 text-cyan-700',
  Hash:      'bg-amber-100 text-amber-700',
  Rosin:     'bg-orange-100 text-orange-700',
  Poussière: 'bg-yellow-100 text-yellow-700',
  Autre:     'bg-gray-100 text-gray-600 dark:text-gray-300',
}
const EXTRACTION_TYPES = ['Trim', 'WPFF']

function TypeBadge({ type }: { type?: string }) {
  const label = type || 'Autre'
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${TYPE_COLORS[label] ?? TYPE_COLORS['Autre']}`}>
      {label}
    </span>
  )
}

// ── Ligne stock avec confirmation ─────────────────────────────────────────────
function StockRow({ item, onEdit, onDeleted, onSortie }: {
  item: Stock
  onEdit: (s: Stock) => void
  onDeleted: () => void
  onSortie: () => void
}) {
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [confirmSortie, setConfirmSortie] = useState(false)
  const isCloture = !!item.date_fin_stock

  const remove = useMutation({
    mutationFn: () => stockAPI.delete(item.id_stock),
    onSuccess: onDeleted,
    onError: () => setConfirmDelete(false),
  })
  const sortie = useMutation({
    mutationFn: () => stockAPI.sortie(item.id_stock),
    onSuccess: () => { setConfirmSortie(false); onSortie() },
    onError: () => setConfirmSortie(false),
  })

  if (confirmDelete) return (
    <tr className="bg-red-50">
      <td colSpan={9} className="px-5 py-3 text-sm text-red-700">
        <span className="flex items-center gap-2">
          <AlertTriangle size={14} />
          Supprimer <strong>{item.variete_nom ?? 'ce stock'}</strong> ({item.quantite_stock}g) ?
        </span>
      </td>
      <td className="px-5 py-3 text-right">
        <div className="flex justify-end gap-2">
          <button onClick={() => remove.mutate()} disabled={remove.isPending}
            className="px-3 py-1 bg-red-600 text-white text-xs rounded hover:bg-red-700 disabled:opacity-50">
            {remove.isPending ? <Loader2 size={12} className="animate-spin" /> : 'Confirmer'}
          </button>
          <button onClick={() => setConfirmDelete(false)}
            className="px-3 py-1 border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 text-xs rounded hover:bg-gray-50">
            Annuler
          </button>
        </div>
      </td>
    </tr>
  )

  if (confirmSortie) return (
    <tr className="bg-amber-50">
      <td colSpan={9} className="px-5 py-3 text-sm text-amber-800">
        <span className="flex items-center gap-2">
          <LogOut size={14} />
          Déclarer <strong>{item.variete_nom ?? 'ce stock'}</strong> comme terminé (0 g restant) ?
        </span>
      </td>
      <td className="px-5 py-3 text-right">
        <div className="flex justify-end gap-2">
          <button onClick={() => sortie.mutate()} disabled={sortie.isPending}
            className="px-3 py-1 bg-amber-600 text-white text-xs rounded hover:bg-amber-700 disabled:opacity-50">
            {sortie.isPending ? <Loader2 size={12} className="animate-spin" /> : 'Confirmer'}
          </button>
          <button onClick={() => setConfirmSortie(false)}
            className="px-3 py-1 border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 text-xs rounded hover:bg-gray-50">
            Annuler
          </button>
        </div>
      </td>
    </tr>
  )

  const specs = (() => {
    const t = item.type_stock
    if (t === 'Hash') {
      const parts = [item.maillage, item.type_hash].filter(Boolean)
      return parts.length ? parts.join(' · ') : '—'
    }
    if (t === 'Rosin') {
      if (!item.type_rosin) return '—'
      return item.maillage ? `${item.type_rosin} - ${item.maillage}` : item.type_rosin
    }
    if (t === 'WPFF') return '—'
    return item.sous_type_stock || '—'
  })()

  const bocalLabel = (() => {
    if (!item.bocal_nom && !item.id_materiel_bocal) return '—'
    const nom = item.bocal_nom ?? `Bocal #${item.id_materiel_bocal}`
    const vol = item.bocal_volume_ml
    if (vol) { const volStr = vol >= 1000 ? `${vol / 1000} L` : `${vol} mL`; return `${nom} · ${volStr}` }
    return nom
  })()

  const ageCol = isCloture
    ? <span className="text-xs text-gray-400 dark:text-gray-500 italic">{durationLabel(item.date_stock ?? undefined, item.date_fin_stock ?? undefined)}</span>
    : <span className="text-sm text-gray-400 dark:text-gray-500">{ageLabel(item.date_stock ?? undefined)}</span>

  const rowClass = isCloture ? 'opacity-50 bg-gray-50 dark:bg-gray-700/30' : 'hover:bg-gray-50 dark:hover:bg-gray-700/40 group'

  return (
    <tr className={rowClass}>
      <td className="px-5 py-3 text-sm font-medium text-gray-900 dark:text-gray-100">
        {item.variete_nom || '—'}
        {isCloture && <span className="ml-2 text-xs text-gray-400 dark:text-gray-500 font-normal">clôturé {item.date_fin_stock ? new Date(item.date_fin_stock).toLocaleDateString('fr-FR') : ''}</span>}
      </td>
      <td className="px-5 py-3"><TypeBadge type={item.type_stock ?? undefined} /></td>
      <td className="px-5 py-3 text-sm text-gray-500 dark:text-gray-400">{specs}</td>
      <td className="px-5 py-3 text-sm text-gray-500 dark:text-gray-400">{item.engrais_type || '—'}</td>
      <td className="px-5 py-3 text-sm text-gray-400 dark:text-gray-500 max-w-[160px] truncate" title={bocalLabel !== '—' ? bocalLabel : undefined}>{bocalLabel}</td>
      <td className="px-5 py-3 text-sm font-semibold text-grow-700">
        {isCloture ? <span className="line-through text-gray-400 dark:text-gray-500">0 g</span> : `${item.quantite_stock.toFixed(1)} g`}
      </td>
      <td className="px-5 py-3 text-sm text-gray-400 dark:text-gray-500">{item.date_stock ? new Date(item.date_stock).toLocaleDateString('fr-FR') : '—'}</td>
      <td className="px-5 py-3">{ageCol}</td>
      <td className="px-5 py-3 text-right">
        <div className={`flex justify-end gap-1 ${isCloture ? 'opacity-0' : 'opacity-0 group-hover:opacity-100'} transition-opacity`}>
          {!isCloture && (
            <button onClick={() => setConfirmSortie(true)} className="p-1.5 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded" title="Déclarer comme terminé">
              <LogOut size={14} />
            </button>
          )}
          <button onClick={() => onEdit(item)} className="p-1.5 text-gray-400 hover:text-grow-600 hover:bg-grow-50 rounded" title="Modifier">
            <Pencil size={14} />
          </button>
          <button onClick={() => setConfirmDelete(true)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded" title="Supprimer">
            <Trash2 size={14} />
          </button>
        </div>
      </td>
    </tr>
  )
}

// ── Ligne extraction ──────────────────────────────────────────────────────────
function ExtractionRow({ item, onEdit, onDeleted, onSortie }: {
  item: Stock
  onEdit: (s: Stock) => void
  onDeleted: () => void
  onSortie: () => void
}) {
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [confirmSortie, setConfirmSortie] = useState(false)
  const isCloture = !!item.date_fin_stock

  const remove = useMutation({
    mutationFn: () => stockAPI.delete(item.id_stock),
    onSuccess: onDeleted,
    onError: () => setConfirmDelete(false),
  })
  const sortie = useMutation({
    mutationFn: () => stockAPI.sortie(item.id_stock),
    onSuccess: () => { setConfirmSortie(false); onSortie() },
    onError: () => setConfirmSortie(false),
  })

  if (confirmDelete) return (
    <tr className="bg-red-50">
      <td colSpan={5} className="px-5 py-3 text-sm text-red-700">
        <span className="flex items-center gap-2">
          <AlertTriangle size={14} />
          Supprimer <strong>{item.variete_nom ?? 'cette extraction'}</strong> ({item.quantite_stock}g) ?
        </span>
      </td>
      <td className="px-5 py-3 text-right">
        <div className="flex justify-end gap-2">
          <button onClick={() => remove.mutate()} disabled={remove.isPending}
            className="px-3 py-1 bg-red-600 text-white text-xs rounded hover:bg-red-700 disabled:opacity-50">
            {remove.isPending ? <Loader2 size={12} className="animate-spin" /> : 'Confirmer'}
          </button>
          <button onClick={() => setConfirmDelete(false)}
            className="px-3 py-1 border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 text-xs rounded hover:bg-gray-50">
            Annuler
          </button>
        </div>
      </td>
    </tr>
  )

  if (confirmSortie) return (
    <tr className="bg-amber-50">
      <td colSpan={5} className="px-5 py-3 text-sm text-amber-800">
        <span className="flex items-center gap-2">
          <LogOut size={14} />
          Déclarer <strong>{item.variete_nom ?? 'cette extraction'}</strong> comme terminé (0 g restant) ?
        </span>
      </td>
      <td className="px-5 py-3 text-right">
        <div className="flex justify-end gap-2">
          <button onClick={() => sortie.mutate()} disabled={sortie.isPending}
            className="px-3 py-1 bg-amber-600 text-white text-xs rounded hover:bg-amber-700 disabled:opacity-50">
            {sortie.isPending ? <Loader2 size={12} className="animate-spin" /> : 'Confirmer'}
          </button>
          <button onClick={() => setConfirmSortie(false)}
            className="px-3 py-1 border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 text-xs rounded hover:bg-gray-50">
            Annuler
          </button>
        </div>
      </td>
    </tr>
  )

  const rowClass = isCloture ? 'opacity-50 bg-gray-50 dark:bg-gray-700/30' : 'hover:bg-gray-50 dark:hover:bg-gray-700/40 group'

  return (
    <tr className={rowClass}>
      <td className="px-5 py-3 text-sm font-medium text-gray-900 dark:text-gray-100">
        {item.variete_nom || '—'}
        {isCloture && <span className="ml-2 text-xs text-gray-400 dark:text-gray-500 font-normal">clôturé</span>}
      </td>
      <td className="px-5 py-3"><TypeBadge type={item.type_stock ?? undefined} /></td>
      <td className="px-5 py-3 text-sm font-semibold text-grow-700">
        {isCloture ? <span className="line-through text-gray-400 dark:text-gray-500">0 g</span> : `${item.quantite_stock.toFixed(1)} g`}
      </td>
      <td className="px-5 py-3 text-sm text-gray-500 dark:text-gray-400">
        {item.date_stock ? new Date(item.date_stock).toLocaleDateString('fr-FR') : '—'}
      </td>
      <td className="px-5 py-3 text-sm text-gray-400 dark:text-gray-500">
        {ageLabel(item.date_stock ?? undefined)}
      </td>
      <td className="px-5 py-3 text-right">
        <div className={`flex justify-end gap-1 ${isCloture ? 'opacity-0' : 'opacity-0 group-hover:opacity-100'} transition-opacity`}>
          {!isCloture && (
            <button onClick={() => setConfirmSortie(true)} className="p-1.5 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded" title="Déclarer comme terminé">
              <LogOut size={14} />
            </button>
          )}
          <button onClick={() => onEdit(item)} className="p-1.5 text-gray-400 hover:text-grow-600 hover:bg-grow-50 rounded" title="Modifier">
            <Pencil size={14} />
          </button>
          <button onClick={() => setConfirmDelete(true)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded" title="Supprimer">
            <Trash2 size={14} />
          </button>
        </div>
      </td>
    </tr>
  )
}

// ── Curing helpers ────────────────────────────────────────────────────────────
interface PlantWithSession extends PlantCuring {
  _session: SessionCuring
}

function curingDaysAgo(dateStr: string): number {
  const ref = new Date(dateStr + 'T00:00:00')
  const today = new Date()
  const a = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate())
  const b = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  return Math.max(0, Math.floor((b.getTime() - a.getTime()) / 86_400_000))
}

function joursCuringLabel(dateStr?: string): string {
  if (!dateStr) return '—'
  return `J${curingDaysAgo(dateStr)}`
}

function curingBadgeClass(dateStr?: string): string {
  if (!dateStr) return 'bg-gray-100 text-gray-500'
  const j = curingDaysAgo(dateStr)
  if (j <= 7)  return 'bg-blue-50 text-blue-700'
  if (j <= 14) return 'bg-purple-50 text-purple-700'
  if (j <= 28) return 'bg-violet-50 text-violet-700'
  return 'bg-indigo-50 text-indigo-700'
}

const CURING_SORTABLE: [CuringSortCol, string][] = [
  ['plante',       'Plante'],
  ['variete',      'Variete'],
  ['culture',      'Culture'],
  ['bocal',        'Bocal'],
  ['debut',        'Debut Curing'],
  ['jours',        'Jours de curing'],
  ['jours_recolte','Jours depuis récolte'],
  ['quantite',     'Quantité'],
]

// ── Onglet curing ─────────────────────────────────────────────────────────────
function CuringTab({ plants, isLoading }: { plants: PlantWithSession[]; isLoading: boolean }) {
  const totalPoids = plants.reduce((sum, p) => sum + (p.poids_debut_g ?? 0), 0)
  const [sortCol, setSortCol] = useState<CuringSortCol | null>(null)
  const [sortDir, setSortDir] = useState<SortDir>('asc')
  const handleSort = (col: CuringSortCol) => {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortCol(col); setSortDir('asc') }
  }
  const sortedPlants = useMemo(() => {
    if (!sortCol) return plants
    return [...plants].sort((a, b) => {
      const sess_a = a._session
      const sess_b = b._session
      const labelA = sess_a.nom || (sess_a.type_contenant ? sess_a.type_contenant : 'Session #' + sess_a.id_session_curing)
      const labelB = sess_b.nom || (sess_b.type_contenant ? sess_b.type_contenant : 'Session #' + sess_b.id_session_curing)
      let av: string | number = 0
      let bv: string | number = 0
      switch (sortCol) {
        case 'plante':        av = (a.nom_plant || '').toLowerCase();    bv = (b.nom_plant || '').toLowerCase();    break
        case 'variete':       av = (a.nom_variete || '').toLowerCase();  bv = (b.nom_variete || '').toLowerCase();  break
        case 'culture':       av = (a.nom_culture || '').toLowerCase();  bv = (b.nom_culture || '').toLowerCase();  break
        case 'bocal':         av = labelA.toLowerCase();                  bv = labelB.toLowerCase();                  break
        case 'debut':         av = a.date_mise_curing || '';             bv = b.date_mise_curing || '';             break
        case 'jours':         av = curingDaysAgo(a.date_mise_curing || ''); bv = curingDaysAgo(b.date_mise_curing || ''); break
        case 'jours_recolte': av = a.date_recolte ? curingDaysAgo(a.date_recolte) : 0; bv = b.date_recolte ? curingDaysAgo(b.date_recolte) : 0; break
        case 'quantite':      av = a.poids_debut_g ?? 0;                bv = b.poids_debut_g ?? 0;                break
      }
      if (av < bv) return sortDir === 'asc' ? -1 : 1
      if (av > bv) return sortDir === 'asc' ?  1 : -1
      return 0
    })
  }, [plants, sortCol, sortDir])

  if (isLoading) return (
    <div className="flex items-center justify-center py-16 text-sm text-gray-400 gap-2">
      <Loader2 size={16} className="animate-spin" /> Chargement…
    </div>
  )

  if (plants.length === 0) return (
    <EmptyState icon={FlaskConical} title="Aucune plante en curing" description="Les plantes passeront ici dès qu'elles entrent en phase de curing" />
  )

  return (
    <div className="space-y-4">
      {/* Carte total */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1 px-3 py-1.5 bg-purple-50 border border-purple-100 rounded-lg">
          <span className="text-xs text-purple-500">Total en curing</span>
          <span className="text-sm font-semibold text-purple-700">{totalPoids.toFixed(1)} g</span>
        </div>
        <div className="flex items-center gap-1 px-3 py-1.5 bg-gray-50 border border-gray-200 dark:border-gray-700 dark:bg-gray-800 rounded-lg">
          <span className="text-xs text-gray-400 dark:text-gray-500">{plants.length} plante{plants.length > 1 ? 's' : ''}</span>
        </div>
      </div>

      {/* Tableau */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
        <div className="overflow-auto max-h-[calc(100vh-380px)]">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-10">
              <tr>
                {CURING_SORTABLE.map(([col, label]) => (
                  <th key={col} onClick={() => handleSort(col)}
                    className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase whitespace-nowrap cursor-pointer select-none hover:text-gray-700 dark:hover:text-gray-200">
                    {label}<SortIcon col={col} current={sortCol} dir={sortDir} />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {sortedPlants.map(p => {
                const sess = p._session
                const sessLabel = sess.nom
                  || (sess.type_contenant ? `${sess.type_contenant}${sess.volume_contenant_l ? ` ${sess.volume_contenant_l}L` : ''}` : `Session #${sess.id_session_curing}`)
                const bovedaInfo = sess.boveda_rh ? ` · Boveda ${sess.boveda_rh}%` : ''
                const poidsDebut = p.poids_debut_g != null ? `${p.poids_debut_g.toFixed(1)} g` : '—'

                return (
                  <tr key={p.id_plant_curing} className="hover:bg-gray-50 dark:hover:bg-gray-700/40">
                    <td className="px-4 py-2.5 text-sm font-medium text-gray-800 dark:text-gray-100 whitespace-nowrap">
                      {p.nom_plant || `Plant #${p.id_plant}`}
                    </td>
                    <td className="px-4 py-2.5 text-sm text-gray-600 dark:text-gray-300 whitespace-nowrap">
                      {p.nom_variete || '—'}
                    </td>
                    <td className="px-4 py-2.5 text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">
                      {p.nom_culture || '—'}
                    </td>
                    <td className="px-4 py-2.5 text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">
                      {sessLabel}
                      {bovedaInfo && <span className="ml-1 text-xs text-gray-400 dark:text-gray-500">{bovedaInfo}</span>}
                    </td>
                    <td className="px-4 py-2.5 text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">
                      {p.date_mise_curing ? new Date(p.date_mise_curing).toLocaleDateString('fr-FR') : '—'}
                    </td>
                    <td className="px-4 py-2.5 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${curingBadgeClass(p.date_mise_curing)}`}>
                        {joursCuringLabel(p.date_mise_curing)}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 whitespace-nowrap">
                      {p.date_recolte
                        ? <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${curingBadgeClass(p.date_recolte)}`}>
                            J{curingDaysAgo(p.date_recolte)}
                          </span>
                        : <span className="text-gray-400 dark:text-gray-500 text-sm">—</span>
                      }
                    </td>
                    <td className="px-4 py-2.5 text-sm font-semibold text-grow-700 whitespace-nowrap">
                      {poidsDebut}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// ── Page principale ───────────────────────────────────────────────────────────
export default function StockPage() {
  const queryClient = useQueryClient()

  const [activeTab,    setActiveTab]    = useState<'stock' | 'curing' | 'extractions'>('stock')
  const [searchTerm,   setSearchTerm]   = useState('')
  const [typeFilter,   setTypeFilter]   = useState('')
  const [showClotures, setShowClotures] = useState(false)
  const [sortCol,      setSortCol]      = useState<StockSortCol | null>(null)
  const [sortDir,      setSortDir]      = useState<SortDir>('asc')
  const [extSortCol,   setExtSortCol]   = useState<ExtractionSortCol | null>(null)
  const [extSortDir,   setExtSortDir]   = useState<SortDir>('asc')
  const [extTypeFilter, setExtTypeFilter] = useState('')
  const [showModal,        setShowModal]        = useState(false)
  const [editStock,        setEditStock]        = useState<Stock | null>(null)
  const [showImportExport, setShowImportExport] = useState(false)

  const handleSort = (col: StockSortCol) => {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortCol(col); setSortDir('asc') }
  }

  // ── Data ───────────────────────────────────────────────────────────────────
  const { data: stocks = [], isLoading: stockLoading } = useQuery({
    queryKey: ['stock'],
    queryFn: async (): Promise<Stock[]> => (await stockAPI.getAll()).data,
  })

  const { data: curingSessions = [], isLoading: curingLoading } = useQuery({
    queryKey: ['curing-sessions-active'],
    queryFn: (): Promise<SessionCuring[]> => curingAPI.list('active'),
  })

  const curingPlants = useMemo((): PlantWithSession[] => {
    const result: PlantWithSession[] = []
    curingSessions.forEach(session => {
      session.plants.forEach(p => { result.push({ ...p, _session: session }) })
    })
    return result
  }, [curingSessions])

  // ── Stock filtre + tri ─────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    const base = stocks.filter(s => {
      const q = searchTerm.toLowerCase()
      const matchSearch   = (s.variete_nom || '').toLowerCase().includes(q) || (s.sous_type_stock || '').toLowerCase().includes(q)
      const matchType     = !typeFilter || s.type_stock === typeFilter
      const matchCloture  = showClotures ? true : !s.date_fin_stock
      const notExtraction = !EXTRACTION_TYPES.includes(s.type_stock || '')
      return matchSearch && matchType && matchCloture && notExtraction
    })
    if (!sortCol) return base
    return [...base].sort((a, b) => {
      let av: string | number, bv: string | number
      switch (sortCol) {
        case 'variete':  av = a.variete_nom    || ''; bv = b.variete_nom    || ''; break
        case 'type':     av = a.type_stock     || ''; bv = b.type_stock     || ''; break
        case 'soustype': av = a.sous_type_stock || ''; bv = b.sous_type_stock || ''; break
        case 'engrais':  av = a.engrais_type   || ''; bv = b.engrais_type   || ''; break
        case 'bocal':    av = a.bocal_nom      || ''; bv = b.bocal_nom      || ''; break
        case 'quantite': av = a.quantite_stock;        bv = b.quantite_stock;        break
        case 'date':     av = a.date_stock     || ''; bv = b.date_stock     || ''; break
        case 'age':      av = a.date_stock     || ''; bv = b.date_stock     || ''; break
        default: return 0
      }
      if (av < bv) return sortDir === 'asc' ? -1 : 1
      if (av > bv) return sortDir === 'asc' ? 1  : -1
      return 0
    })
  }, [stocks, searchTerm, typeFilter, showClotures, sortCol, sortDir])

  const extractionFiltered = useMemo(() => {
    return stocks.filter(s => {
      const q = searchTerm.toLowerCase()
      const matchSearch   = (s.variete_nom || '').toLowerCase().includes(q)
      const matchCloture  = showClotures ? true : !s.date_fin_stock
      const matchExtType  = !extTypeFilter || s.type_stock === extTypeFilter
      return matchSearch && matchCloture && matchExtType && EXTRACTION_TYPES.includes(s.type_stock || '')
    })
  }, [stocks, searchTerm, showClotures, extTypeFilter])

  const stats = useMemo(() => {
    const active     = stocks.filter(s => !s.date_fin_stock && !EXTRACTION_TYPES.includes(s.type_stock || ''))
    const total      = active.reduce((s, i) => s + i.quantite_stock, 0)
    const byType     = active.reduce((acc, s) => { const t = s.type_stock || 'Autre'; acc[t] = (acc[t] || 0) + s.quantite_stock; return acc }, {} as Record<string, number>)
    const nbClotures = stocks.filter(s => !!s.date_fin_stock && !EXTRACTION_TYPES.includes(s.type_stock || '')).length

    const activeExt     = stocks.filter(s => !s.date_fin_stock && EXTRACTION_TYPES.includes(s.type_stock || ''))
    const totalExt      = activeExt.reduce((s, i) => s + i.quantite_stock, 0)
    const byTypeExt     = activeExt.reduce((acc, s) => { const t = s.type_stock || 'Autre'; acc[t] = (acc[t] || 0) + s.quantite_stock; return acc }, {} as Record<string, number>)
    const nbCloturesExt = stocks.filter(s => !!s.date_fin_stock && EXTRACTION_TYPES.includes(s.type_stock || '')).length

    return { total, byType, nbClotures, totalExt, byTypeExt, nbCloturesExt }
  }, [stocks])

  const allTypes = Object.keys(stats.byType).sort()
  const allExtractionTypes = Object.keys(stats.byTypeExt).sort()

  if (stockLoading) return <LoadingSpinner />

  return (
    <div className="space-y-6">

      {/* Modals */}
      {(showModal || editStock) && (
        <NouveauStockModal editStock={editStock} onClose={() => { setShowModal(false); setEditStock(null) }} />
      )}
      {showImportExport && <ImportExportModal onClose={() => setShowImportExport(false)} />}

      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="flex items-center gap-4">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Stock</h1>
          {activeTab === 'stock' && stats.total > 0 && (
            <div className="flex items-center gap-1 px-3 py-1.5 bg-grow-50 border border-grow-100 rounded-lg">
              <span className="text-xs text-grow-500">Total actif</span>
              <span className="text-sm font-semibold text-grow-700">{stats.total.toFixed(1)} g</span>
            </div>
          )}
          {activeTab === 'curing' && curingPlants.length > 0 && (
            <div className="flex items-center gap-1 px-3 py-1.5 bg-purple-50 border border-purple-100 rounded-lg">
              <span className="text-xs text-purple-500">Total en curing</span>
              <span className="text-sm font-semibold text-purple-700">{curingPlants.reduce((s, p) => s + (p.poids_debut_g ?? 0), 0).toFixed(1)} g</span>
            </div>
          )}
          {activeTab === 'extractions' && stats.totalExt > 0 && (
            <div className="flex items-center gap-1 px-3 py-1.5 bg-cyan-50 border border-cyan-100 rounded-lg">
              <span className="text-xs text-cyan-500">Total extractions</span>
              <span className="text-sm font-semibold text-cyan-700">{stats.totalExt.toFixed(1)} g</span>
            </div>
          )}
        </div>
        <div className="flex gap-2">
          {activeTab === 'stock' && (
            <>
              <button onClick={() => setShowImportExport(true)}
                className="flex items-center gap-2 px-3 py-2 border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/40 text-sm">
                <ArrowDownUp size={15} />Import / Export
              </button>
              <button onClick={() => setShowModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-grow-600 text-white rounded-lg hover:bg-grow-700 text-sm font-medium">
                <Plus size={18} />Nouveau stock
              </button>
            </>
          )}
        </div>
      </div>

      {/* Toggle tabs */}
      <div className="inline-flex items-center gap-1 bg-gray-100 dark:bg-gray-700 rounded-xl p-1">
        <button
          onClick={() => setActiveTab('stock')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            activeTab === 'stock'
              ? 'bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 shadow'
              : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
          }`}
        >
          <Package size={14} />
          En stock
          <span className={`px-1.5 py-0.5 rounded-full text-xs ${
            activeTab === 'stock' ? 'bg-grow-100 text-grow-700' : 'bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-300'
          }`}>{stocks.filter(s => !s.date_fin_stock && !EXTRACTION_TYPES.includes(s.type_stock || '')).length}</span>
        </button>
        <button
          onClick={() => setActiveTab('extractions')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            activeTab === 'extractions'
              ? 'bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 shadow'
              : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
          }`}
        >
          <Snowflake size={14} />
          Pour extraction
          <span className={`px-1.5 py-0.5 rounded-full text-xs ${
            activeTab === 'extractions' ? 'bg-cyan-100 text-cyan-700' : 'bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-300'
          }`}>{stocks.filter(s => !s.date_fin_stock && EXTRACTION_TYPES.includes(s.type_stock || '')).length}</span>
        </button>
        <button
          onClick={() => setActiveTab('curing')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            activeTab === 'curing'
              ? 'bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 shadow'
              : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
          }`}
        >
          <FlaskConical size={14} />
          En curing
          <span className={`px-1.5 py-0.5 rounded-full text-xs ${
            activeTab === 'curing' ? 'bg-purple-100 text-purple-700' : 'bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-300'
          }`}>{curingPlants.length}</span>
        </button>
      </div>

      {/* ── Onglet Stock ─────────────────────────────────────────────────────── */}
      {activeTab === 'stock' && (
        <>
          {/* Cartes par type */}
          {allTypes.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              {allTypes.map(type => (
                <button key={type}
                  onClick={() => setTypeFilter(typeFilter === type ? '' : type)}
                  className={`text-left rounded-lg p-4 border-2 transition-colors ${
                    typeFilter === type ? 'border-grow-500 bg-grow-50' : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-grow-300'
                  }`}
                >
                  <TypeBadge type={type} />
                  <p className="text-xl font-bold text-gray-800 dark:text-gray-100 mt-2">{stats.byType[type].toFixed(1)} g</p>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                    {stocks.filter(s => (s.type_stock || 'Autre') === type && !s.date_fin_stock).length} actif{stocks.filter(s => (s.type_stock || 'Autre') === type && !s.date_fin_stock).length > 1 ? 's' : ''}
                  </p>
                </button>
              ))}
            </div>
          )}

          {/* Barre de recherche */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
            <div className="flex flex-col lg:flex-row gap-3">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-2.5 text-gray-400 dark:text-gray-500" size={17} />
                <input type="text" placeholder="Variété, sous-type..."
                  className="w-full pl-9 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-grow-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
              </div>
              {typeFilter && (
                <button onClick={() => setTypeFilter('')} className="px-3 py-2 text-sm text-grow-600 border border-grow-200 bg-grow-50 rounded-lg hover:bg-grow-100">
                  Type : {typeFilter} ✕
                </button>
              )}
              {stats.nbClotures > 0 && (
                <button onClick={() => setShowClotures(v => !v)}
                  className={`px-3 py-2 text-sm rounded-lg border transition-colors ${
                    showClotures ? 'bg-gray-200 text-gray-700 border-gray-300' : 'bg-white dark:bg-gray-800 text-gray-400 dark:text-gray-500 border-gray-200 dark:border-gray-700 hover:bg-gray-50'
                  }`}>
                  {showClotures ? 'Masquer clôturés' : `Voir clôturés (${stats.nbClotures})`}
                </button>
              )}
            </div>
            {(searchTerm || typeFilter) && (
              <p className="mt-2 text-xs text-gray-400 dark:text-gray-500">
                {filtered.length} résultat{filtered.length > 1 ? 's' : ''} sur {stocks.length}
              </p>
            )}
          </div>

          {/* Tableau stock */}
          {filtered.length === 0 ? (
            <EmptyState icon={Package} title="Aucun stock" description='Cliquez sur "Nouveau stock" pour ajouter une entrée manuellement' />
          ) : (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
              <div className="overflow-auto max-h-[calc(100vh-380px)]">
                <table className="w-full">
                  <thead className="bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-10">
                    <tr>
                      {([
                        ['variete',  'Variété'],
                        ['type',     'Type'],
                        ['soustype', 'Spécifications'],
                        ['engrais',  'Engrais'],
                        ['bocal',    'Bocal'],
                        ['quantite', 'Quantité'],
                        ['date',     'Date'],
                        ['age',      'Âge / Durée'],
                      ] as [StockSortCol, string][]).map(([col, label]) => (
                        <th key={col} onClick={() => handleSort(col)}
                          className="px-5 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase cursor-pointer select-none hover:bg-gray-100 dark:hover:bg-gray-600 whitespace-nowrap">
                          {label}<SortIcon col={col} current={sortCol} dir={sortDir} />
                        </th>
                      ))}
                      <th className="px-5 py-3 w-24"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                    {filtered.map(item => (
                      <StockRow key={item.id_stock} item={item}
                        onEdit={s => setEditStock(s)}
                        onDeleted={() => queryClient.invalidateQueries({ queryKey: ['stock'] })}
                        onSortie={() => queryClient.invalidateQueries({ queryKey: ['stock'] })}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="px-5 py-2 border-t border-gray-100 dark:border-gray-700 text-xs text-gray-400 dark:text-gray-500">
                {filtered.filter(s => !s.date_fin_stock).length} actif{filtered.filter(s => !s.date_fin_stock).length > 1 ? 's' : ''} · {filtered.filter(s => !s.date_fin_stock).reduce((s, i) => s + i.quantite_stock, 0).toFixed(1)} g affichés
              </div>
            </div>
          )}
        </>
      )}

      {/* ── Onglet Extractions ───────────────────────────────────────────────── */}
      {activeTab === 'extractions' && (
        <>
          {/* Cartes par type */}
          {allExtractionTypes.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              {allExtractionTypes.map(type => (
                <button key={type}
                  onClick={() => setExtTypeFilter(extTypeFilter === type ? '' : type)}
                  className={`text-left rounded-lg p-4 border-2 transition-colors ${
                    extTypeFilter === type ? 'border-cyan-500 bg-cyan-50' : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-cyan-300'
                  }`}
                >
                  <TypeBadge type={type} />
                  <p className="text-xl font-bold text-gray-800 dark:text-gray-100 mt-2">{stats.byTypeExt[type].toFixed(1)} g</p>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                    {stocks.filter(s => s.type_stock === type && !s.date_fin_stock).length} actif{stocks.filter(s => s.type_stock === type && !s.date_fin_stock).length > 1 ? 's' : ''}
                  </p>
                </button>
              ))}
            </div>
          )}

          {/* Barre de recherche */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
            <div className="flex flex-col lg:flex-row gap-3">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-2.5 text-gray-400 dark:text-gray-500" size={17} />
                <input type="text" placeholder="Variété..."
                  className="w-full pl-9 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-grow-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
              </div>
              {extTypeFilter && (
                <button onClick={() => setExtTypeFilter('')} className="px-3 py-2 text-sm text-cyan-600 border border-cyan-200 bg-cyan-50 rounded-lg hover:bg-cyan-100">
                  Type : {extTypeFilter} ✕
                </button>
              )}
              {stats.nbCloturesExt > 0 && (
                <button onClick={() => setShowClotures(v => !v)}
                  className={`px-3 py-2 text-sm rounded-lg border transition-colors ${
                    showClotures ? 'bg-gray-200 text-gray-700 border-gray-300' : 'bg-white dark:bg-gray-800 text-gray-400 dark:text-gray-500 border-gray-200 dark:border-gray-700 hover:bg-gray-50'
                  }`}>
                  {showClotures ? 'Masquer clôturés' : `Voir clôturés (${stats.nbCloturesExt})`}
                </button>
              )}
            </div>
          </div>

          {/* Tableau extractions */}
          {extractionFiltered.length === 0 ? (
            <EmptyState icon={Snowflake} title="Aucune extraction" description="Le Trim et le WPFF apparaîtront ici" />
          ) : (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
              <div className="overflow-auto max-h-[calc(100vh-380px)]">
                <table className="w-full">
                  <thead className="bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-10">
                    <tr>
                      {([
                        ['variete',  'Variété'],
                        ['type',     'Type'],
                        ['quantite', 'Quantité'],
                        ['date',     'Date de récolte'],
                        ['age',      'Jours depuis la récolte'],
                      ] as [ExtractionSortCol, string][]).map(([col, label]) => (
                        <th key={col}
                          onClick={() => {
                            if (extSortCol === col) setExtSortDir(d => d === 'asc' ? 'desc' : 'asc')
                            else { setExtSortCol(col); setExtSortDir('asc') }
                          }}
                          className="px-5 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase cursor-pointer select-none hover:bg-gray-100 dark:hover:bg-gray-600 whitespace-nowrap">
                          {label}<SortIcon col={col} current={extSortCol} dir={extSortDir} />
                        </th>
                      ))}
                      <th className="px-5 py-3 w-24"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                    {[...extractionFiltered].sort((a, b) => {
                      if (!extSortCol) return 0
                      let av: string | number, bv: string | number
                      switch (extSortCol) {
                        case 'variete':  av = a.variete_nom    || ''; bv = b.variete_nom    || ''; break
                        case 'type':     av = a.type_stock     || ''; bv = b.type_stock     || ''; break
                        case 'quantite': av = a.quantite_stock;        bv = b.quantite_stock;        break
                        case 'date':     av = a.date_stock     || ''; bv = b.date_stock     || ''; break
                        case 'age':      av = a.date_stock     || ''; bv = b.date_stock     || ''; break
                        default: return 0
                      }
                      if (av < bv) return extSortDir === 'asc' ? -1 : 1
                      if (av > bv) return extSortDir === 'asc' ?  1 : -1
                      return 0
                    }).map(item => (
                      <ExtractionRow key={item.id_stock} item={item}
                        onEdit={s => setEditStock(s)}
                        onDeleted={() => queryClient.invalidateQueries({ queryKey: ['stock'] })}
                        onSortie={() => queryClient.invalidateQueries({ queryKey: ['stock'] })}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="px-5 py-2 border-t border-gray-100 dark:border-gray-700 text-xs text-gray-400 dark:text-gray-500">
                {extractionFiltered.filter(s => !s.date_fin_stock).length} actif{extractionFiltered.filter(s => !s.date_fin_stock).length > 1 ? 's' : ''} · {extractionFiltered.filter(s => !s.date_fin_stock).reduce((s, i) => s + i.quantite_stock, 0).toFixed(1)} g affichés
              </div>
            </div>
          )}
        </>
      )}

      {/* ── Onglet Curing ────────────────────────────────────────────────────── */}
      {activeTab === 'curing' && (
        <CuringTab plants={curingPlants} isLoading={curingLoading} />
      )}

    </div>
  )
}
