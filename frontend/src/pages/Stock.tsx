import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Plus, Search, Package, Pencil, Trash2, Loader2, AlertTriangle,
  ChevronUp, ChevronDown, ChevronsUpDown, ArrowDownUp, LogOut,
} from 'lucide-react'
import { stockAPI, Stock } from '../api/stock'
import LoadingSpinner from '../components/LoadingSpinner'
import EmptyState from '../components/EmptyState'
import NouveauStockModal from '../components/NouveauStockModal'
import ImportExportModal from '../components/ImportExportModal'

// ── Tri ──────────────────────────────────────────────────────────────────────
type StockSortCol = 'variete' | 'type' | 'soustype' | 'engrais' | 'bocal' | 'quantite' | 'date' | 'age'
type SortDir = 'asc' | 'desc'

function SortIcon({ col, current, dir }: { col: StockSortCol; current: StockSortCol | null; dir: SortDir }) {
  if (current !== col) return <ChevronsUpDown size={12} className="ml-1 text-gray-300 inline" />
  return dir === 'asc'
    ? <ChevronUp   size={12} className="ml-1 text-grow-600 inline" />
    : <ChevronDown size={12} className="ml-1 text-grow-600 inline" />
}

// ── Age / durée ───────────────────────────────────────────────────────────────
function ageLabel(dateStr?: string): string {
  if (!dateStr) return '—'
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 86_400_000)
  if (diff < 0) return '—'
  if (diff < 30) return `${diff} j`
  if (diff < 365) {
    const m = Math.floor(diff / 30)
    return `${m} mois`
  }
  const y = Math.floor(diff / 365)
  return `${y} an${y > 1 ? 's' : ''}`
}

function durationLabel(start?: string, end?: string): string {
  if (!start || !end) return '—'
  const diff = Math.floor((new Date(end).getTime() - new Date(start).getTime()) / 86_400_000)
  if (diff <= 0) return '< 1 j'
  if (diff < 30) return `${diff} j`
  if (diff < 365) {
    const m = Math.floor(diff / 30)
    return `${m} mois`
  }
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
function TypeBadge({ type }: { type?: string }) {
  const label = type || 'Autre'
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${TYPE_COLORS[label] ?? TYPE_COLORS['Autre']}`}>
      {label}
    </span>
  )
}

// ── Ligne avec confirmation suppression ──────────────────────────────────────
function StockRow({
  item,
  onEdit,
  onDeleted,
  onSortie,
}: {
  item: Stock
  onEdit: (s: Stock) => void
  onDeleted: () => void
  onSortie: () => void
}) {
  const [confirmDelete,  setConfirmDelete]  = useState(false)
  const [confirmSortie,  setConfirmSortie]  = useState(false)

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

  if (confirmDelete) {
    return (
      <tr className="bg-red-50">
        <td colSpan={9} className="px-5 py-3 text-sm text-red-700">
          <span className="flex items-center gap-2">
            <AlertTriangle size={14} />
            Supprimer <strong>{item.variete_nom ?? 'ce stock'}</strong> ({item.quantite_stock}g) ?
          </span>
        </td>
        <td className="px-5 py-3 text-right">
          <div className="flex justify-end gap-2">
            <button
              onClick={() => remove.mutate()}
              disabled={remove.isPending}
              className="px-3 py-1 bg-red-600 text-white text-xs rounded hover:bg-red-700 disabled:opacity-50"
            >
              {remove.isPending ? <Loader2 size={12} className="animate-spin" /> : 'Confirmer'}
            </button>
            <button
              onClick={() => setConfirmDelete(false)}
              className="px-3 py-1 border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 text-xs rounded hover:bg-gray-50 dark:hover:bg-gray-700/40"
            >
              Annuler
            </button>
          </div>
        </td>
      </tr>
    )
  }

  if (confirmSortie) {
    return (
      <tr className="bg-amber-50">
        <td colSpan={9} className="px-5 py-3 text-sm text-amber-800">
          <span className="flex items-center gap-2">
            <LogOut size={14} />
            Déclarer <strong>{item.variete_nom ?? 'ce stock'}</strong> comme terminé (0 g restant) ?
          </span>
        </td>
        <td className="px-5 py-3 text-right">
          <div className="flex justify-end gap-2">
            <button
              onClick={() => sortie.mutate()}
              disabled={sortie.isPending}
              className="px-3 py-1 bg-amber-600 text-white text-xs rounded hover:bg-amber-700 disabled:opacity-50"
            >
              {sortie.isPending ? <Loader2 size={12} className="animate-spin" /> : 'Confirmer'}
            </button>
            <button
              onClick={() => setConfirmSortie(false)}
              className="px-3 py-1 border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 text-xs rounded hover:bg-gray-50 dark:hover:bg-gray-700/40"
            >
              Annuler
            </button>
          </div>
        </td>
      </tr>
    )
  }

  // Colonne "Spécifications" : selon le type
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
    if (t === 'WPFF')   return '—'
    return item.sous_type_stock || '—'
  })()

  // Bocal
  const bocalLabel = (() => {
    if (!item.bocal_nom && !item.id_materiel_bocal) return '—'
    const nom = item.bocal_nom ?? `Bocal #${item.id_materiel_bocal}`
    const vol = item.bocal_volume_ml
    if (vol) {
      const volStr = vol >= 1000 ? `${vol / 1000} L` : `${vol} mL`
      return `${nom} · ${volStr}`
    }
    return nom
  })()

  // Colonne âge / durée de consommation
  const ageCol = isCloture
    ? <span className="text-xs text-gray-400 dark:text-gray-500 italic">
        {durationLabel(item.date_stock ?? undefined, item.date_fin_stock ?? undefined)}
      </span>
    : <span className="text-sm text-gray-400 dark:text-gray-500">{ageLabel(item.date_stock ?? undefined)}</span>

  const rowClass = isCloture
    ? 'opacity-50 bg-gray-50 dark:bg-gray-700/30'
    : 'hover:bg-gray-50 dark:hover:bg-gray-700/40 dark:hover:bg-gray-700/40 group'

  return (
    <tr className={rowClass}>
      <td className="px-5 py-3 text-sm font-medium text-gray-900 dark:text-gray-100">
        {item.variete_nom || '—'}
        {isCloture && (
          <span className="ml-2 text-xs text-gray-400 dark:text-gray-500 font-normal">
            clôturé {item.date_fin_stock ? new Date(item.date_fin_stock).toLocaleDateString('fr-FR') : ''}
          </span>
        )}
      </td>
      <td className="px-5 py-3"><TypeBadge type={item.type_stock ?? undefined} /></td>
      <td className="px-5 py-3 text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500">{specs}</td>
      <td className="px-5 py-3 text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500">{item.engrais_type || '—'}</td>
      <td className="px-5 py-3 text-sm text-gray-400 dark:text-gray-500 max-w-[160px] truncate" title={bocalLabel !== '—' ? bocalLabel : undefined}>
        {bocalLabel}
      </td>
      <td className="px-5 py-3 text-sm font-semibold text-grow-700">
        {isCloture
          ? <span className="line-through text-gray-400 dark:text-gray-500">0 g</span>
          : `${item.quantite_stock.toFixed(1)} g`
        }
      </td>
      <td className="px-5 py-3 text-sm text-gray-400 dark:text-gray-500">
        {item.date_stock ? new Date(item.date_stock).toLocaleDateString('fr-FR') : '—'}
      </td>
      <td className="px-5 py-3">{ageCol}</td>
      <td className="px-5 py-3 text-right">
        <div className={`flex justify-end gap-1 ${isCloture ? 'opacity-0' : 'opacity-0 group-hover:opacity-100'} transition-opacity`}>
          {!isCloture && (
            <button
              onClick={() => setConfirmSortie(true)}
              className="p-1.5 text-gray-400 dark:text-gray-500 hover:text-amber-600 hover:bg-amber-50 rounded"
              title="Déclarer comme terminé"
            >
              <LogOut size={14} />
            </button>
          )}
          <button
            onClick={() => onEdit(item)}
            className="p-1.5 text-gray-400 dark:text-gray-500 hover:text-grow-600 hover:bg-grow-50 rounded"
            title="Modifier"
          >
            <Pencil size={14} />
          </button>
          <button
            onClick={() => setConfirmDelete(true)}
            className="p-1.5 text-gray-400 dark:text-gray-500 hover:text-red-600 hover:bg-red-50 rounded"
            title="Supprimer"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </td>
    </tr>
  )
}

// ── Page principale ───────────────────────────────────────────────────────────
export default function StockPage() {
  const queryClient = useQueryClient()

  const [searchTerm,  setSearchTerm]  = useState('')
  const [typeFilter,  setTypeFilter]  = useState('')
  const [showClotures, setShowClotures] = useState(false)
  const [sortCol,     setSortCol]     = useState<StockSortCol | null>(null)
  const [sortDir,     setSortDir]     = useState<SortDir>('asc')
  const [showModal,         setShowModal]         = useState(false)
  const [editStock,         setEditStock]         = useState<Stock | null>(null)
  const [showImportExport,  setShowImportExport]  = useState(false)

  const handleSort = (col: StockSortCol) => {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortCol(col); setSortDir('asc') }
  }

  const { data: stocks = [], isLoading } = useQuery<Stock[]>({
    queryKey: ['stock'],
    queryFn: async () => (await stockAPI.getAll()).data,
  })

  const filtered = useMemo(() => {
    const base = stocks.filter(s => {
      const q = searchTerm.toLowerCase()
      const matchSearch = (s.variete_nom || '').toLowerCase().includes(q)
        || (s.sous_type_stock || '').toLowerCase().includes(q)
      const matchType    = !typeFilter || s.type_stock === typeFilter
      const matchCloture = showClotures ? true : !s.date_fin_stock
      return matchSearch && matchType && matchCloture
    })

    if (!sortCol) return base
    return [...base].sort((a, b) => {
      let av: string | number, bv: string | number
      switch (sortCol) {
        case 'variete':   av = a.variete_nom      || ''; bv = b.variete_nom      || ''; break
        case 'type':      av = a.type_stock        || ''; bv = b.type_stock        || ''; break
        case 'soustype':  av = a.sous_type_stock   || ''; bv = b.sous_type_stock   || ''; break
        case 'engrais':   av = a.engrais_type      || ''; bv = b.engrais_type      || ''; break
        case 'bocal':     av = a.bocal_nom         || ''; bv = b.bocal_nom         || ''; break
        case 'quantite':  av = a.quantite_stock;          bv = b.quantite_stock;          break
        case 'date':      av = a.date_stock        || ''; bv = b.date_stock        || ''; break
        case 'age':       av = a.date_stock        || ''; bv = b.date_stock        || ''; break
        default: return 0
      }
      if (av < bv) return sortDir === 'asc' ? -1 : 1
      if (av > bv) return sortDir === 'asc' ? 1  : -1
      return 0
    })
  }, [stocks, searchTerm, typeFilter, showClotures, sortCol, sortDir])

  // Stats globales (stocks actifs seulement)
  const stats = useMemo(() => {
    const active = stocks.filter(s => !s.date_fin_stock)
    const total = active.reduce((s, i) => s + i.quantite_stock, 0)
    const byType = active.reduce((acc, s) => {
      const t = s.type_stock || 'Autre'
      acc[t] = (acc[t] || 0) + s.quantite_stock
      return acc
    }, {} as Record<string, number>)
    const nbClotures = stocks.filter(s => !!s.date_fin_stock).length
    return { total, byType, nbClotures }
  }, [stocks])

  const allTypes = Object.keys(stats.byType).sort()

  if (isLoading) return <LoadingSpinner />

  return (
    <div className="space-y-6">

      {/* Modals */}
      {(showModal || editStock) && (
        <NouveauStockModal
          editStock={editStock}
          onClose={() => { setShowModal(false); setEditStock(null) }}
        />
      )}
      {showImportExport && (
        <ImportExportModal onClose={() => setShowImportExport(false)} />
      )}

      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="flex items-center gap-4">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Stock</h1>
          {stats.total > 0 && (
            <div className="flex items-center gap-1 px-3 py-1.5 bg-grow-50 border border-grow-100 rounded-lg">
              <span className="text-xs text-grow-500">Total actif</span>
              <span className="text-sm font-semibold text-grow-700">{stats.total.toFixed(1)} g</span>
            </div>
          )}
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowImportExport(true)}
            className="flex items-center gap-2 px-3 py-2 border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/40 text-sm"
          >
            <ArrowDownUp size={15} />Import / Export
          </button>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-grow-600 text-white rounded-lg hover:bg-grow-700 text-sm font-medium"
          >
            <Plus size={18} />Nouveau stock
          </button>
        </div>
      </div>

      {/* Cartes par type (cliquables pour filtrer) */}
      {allTypes.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {allTypes.map(type => (
            <button
              key={type}
              onClick={() => setTypeFilter(typeFilter === type ? '' : type)}
              className={`text-left rounded-lg p-4 border-2 transition-colors ${
                typeFilter === type
                  ? 'border-grow-500 bg-grow-50'
                  : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-grow-300'
              }`}
            >
              <TypeBadge type={type} />
              <p className="text-xl font-bold text-gray-800 dark:text-gray-100 mt-2">
                {stats.byType[type].toFixed(1)} g
              </p>
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
            <input
              type="text"
              placeholder="Variété, sous-type..."
              className="w-full pl-9 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-grow-600 bg-white dark:bg-gray-800 dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
          {typeFilter && (
            <button
              onClick={() => setTypeFilter('')}
              className="px-3 py-2 text-sm text-grow-600 border border-grow-200 bg-grow-50 rounded-lg hover:bg-grow-100"
            >
              Type : {typeFilter} ✕
            </button>
          )}
          {stats.nbClotures > 0 && (
            <button
              onClick={() => setShowClotures(v => !v)}
              className={`px-3 py-2 text-sm rounded-lg border transition-colors ${
                showClotures
                  ? 'bg-gray-200 text-gray-700 dark:text-gray-200 border-gray-300 dark:border-gray-600'
                  : 'bg-white dark:bg-gray-800 text-gray-400 dark:text-gray-500 border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/40'
              }`}
            >
              {showClotures ? '🗃 Masquer clôturés' : `🗃 Voir clôturés (${stats.nbClotures})`}
            </button>
          )}
        </div>
        {(searchTerm || typeFilter) && (
          <p className="mt-2 text-xs text-gray-400 dark:text-gray-500">
            {filtered.length} résultat{filtered.length > 1 ? 's' : ''} sur {stocks.length}
          </p>
        )}
      </div>

      {/* Tableau */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={Package}
          title="Aucun stock"
          description='Cliquez sur "Nouveau stock" pour ajouter une entrée manuellement'
        />
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
                    ['bocal',    '🫙 Bocal'],
                    ['quantite', 'Quantité'],
                    ['date',     'Date'],
                    ['age',      'Âge / Durée'],
                  ] as [StockSortCol, string][]).map(([col, label]) => (
                    <th
                      key={col}
                      onClick={() => handleSort(col)}
                      className="px-5 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 dark:text-gray-500 uppercase cursor-pointer select-none hover:bg-gray-100 dark:hover:bg-gray-600 whitespace-nowrap"
                    >
                      {label}<SortIcon col={col} current={sortCol} dir={sortDir} />
                    </th>
                  ))}
                  <th className="px-5 py-3 w-24"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {filtered.map(item => (
                  <StockRow
                    key={item.id_stock}
                    item={item}
                    onEdit={s => setEditStock(s)}
                    onDeleted={() => queryClient.invalidateQueries({ queryKey: ['stock'] })}
                    onSortie={() => queryClient.invalidateQueries({ queryKey: ['stock'] })}
                  />
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-5 py-2 border-t border-gray-100 dark:border-gray-700 text-xs text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">
            {filtered.filter(s => !s.date_fin_stock).length} actif{filtered.filter(s => !s.date_fin_stock).length > 1 ? 's' : ''} · {filtered.filter(s => !s.date_fin_stock).reduce((s, i) => s + i.quantite_stock, 0).toFixed(1)} g affichés
          </div>
        </div>
      )}
    </div>
  )
}
