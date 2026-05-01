import { useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Plus, ArrowUpDown, AlertTriangle, Loader2, Trash2,
  Leaf, Scale, Zap, ChevronRight, Dna,
} from 'lucide-react'
import { historiqueCultureAPI } from '../api/historiqueCulture'
import type { HistoriqueCulture } from '../api/historiqueCulture'
import LoadingSpinner from '../components/LoadingSpinner'
import EmptyState from '../components/EmptyState'
import NouvelleCultureHistoriqueModal from '../components/NouvelleCultureHistoriqueModal'
import CultureHistoriqueDetailModal from '../components/CultureHistoriqueDetailModal'
import ImportExportModal from '../components/ImportExportModal'

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtDate(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('fr-FR')
}

// ── Colonnes triables ─────────────────────────────────────────────────────────
type SortCol =
  | 'num' | 'varietes' | 'date_debut' | 'date_fin' | 'duree'
  | 'plants' | 'prix_total' | 'tente' | 'lampe' | 'puissance'
  | 'type' | 'substrat' | 'engrais' | 'qte_total' | 'gpw'
  | 'cout_total' | 'cout_pg'

// ── Ligne ─────────────────────────────────────────────────────────────────────
function CultureRow({
  item, onDetail, onDeleted,
}: {
  item: HistoriqueCulture
  onDetail: () => void
  onDeleted: () => void
}) {
  const [confirm, setConfirm] = useState(false)
  const remove = useMutation({
    mutationFn: () => historiqueCultureAPI.delete(item.id_historique_culture),
    onSuccess: onDeleted,
    onError: () => setConfirm(false),
  })

  if (confirm) {
    return (
      <tr className="bg-red-50">
        <td colSpan={15} className="px-2 py-2 text-sm text-red-700">
          <span className="flex items-center gap-2">
            <AlertTriangle size={14} />
            Supprimer la culture #{item.id_historique_culture}
            {item.varietes_label !== '—' ? ` (${item.varietes_label})` : ''} et ses {item.nb_plants} plante(s) ?
          </span>
        </td>
        <td className="px-2 py-2 text-right">
          <div className="flex justify-end gap-2">
            <button onClick={() => remove.mutate()} disabled={remove.isPending}
              className="px-3 py-1 bg-red-600 text-white text-xs rounded hover:bg-red-700 disabled:opacity-50">
              {remove.isPending ? <Loader2 size={12} className="animate-spin" /> : 'Confirmer'}
            </button>
            <button onClick={() => setConfirm(false)}
              className="px-3 py-1 border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 text-xs rounded hover:bg-gray-50 dark:hover:bg-gray-700/40">
              Annuler
            </button>
          </div>
        </td>
      </tr>
    )
  }

  return (
    <tr
      className="hover:bg-gray-50 dark:hover:bg-gray-700/40 group cursor-pointer"
      onClick={onDetail}
    >
      <td className="px-2 py-2 text-xs text-gray-400 dark:text-gray-500 font-mono">#{item.id_historique_culture}</td>
      <td className="px-2 py-2 text-xs font-medium text-gray-900 dark:text-gray-100 max-w-[120px] truncate"
          title={item.nom ?? item.varietes_label}>
        {item.nom
          ? item.nom
          : (item.plants && [...new Set(item.plants.map(p => p.variete_nom).filter(Boolean))].length > 1
              ? 'Multivar'
              : item.varietes_label)
        }
      </td>
      <td className="px-2 py-2 text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500 whitespace-nowrap">{fmtDate(item.date_debut)}</td>
      <td className="px-2 py-2 text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500 whitespace-nowrap">{fmtDate(item.date_fin)}</td>
      <td className="px-2 py-2 text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500 text-right">
        {item.duree_jours != null ? `${item.duree_jours} j` : '—'}
      </td>
      <td className="px-2 py-2 text-xs text-center">
        <span className="inline-flex items-center px-1.5 py-0.5 rounded-full bg-grow-50 text-grow-700 text-xs font-semibold">
          {item.nb_plants}
        </span>
      </td>
      <td className="px-2 py-2 text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500 text-right">
        {item.prix_total_graines != null ? `${Number(item.prix_total_graines).toFixed(2)} €` : '—'}
      </td>
      <td className="px-2 py-2 text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500 max-w-[80px] truncate" title={item.tente ?? ''}>{item.tente || '—'}</td>
      <td className="px-2 py-2 text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500 max-w-[90px] truncate" title={item.lampe ?? ''}>
        {item.lampe ? (item.lampe.toUpperCase().startsWith('LED') ? 'LED' : item.lampe) : '—'}
      </td>
      <td className="px-2 py-2 text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500 text-right">
        {item.puissance != null ? `${item.puissance}` : '—'}
      </td>
      <td className="px-2 py-2 text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500 max-w-[70px] truncate" title={item.substrat ?? ''}>{item.substrat || '—'}</td>
      <td className="px-2 py-2 text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500 max-w-[70px] truncate" title={item.engrais ?? ''}>{item.engrais || '—'}</td>
      <td className="px-2 py-2 text-xs font-bold text-grow-700 text-right">
        {item.quantite_totale != null ? `${Number(item.quantite_totale).toFixed(1)} g` : '—'}
      </td>
      <td className="px-2 py-2 text-xs font-semibold text-amber-600 text-right">
        {item.g_par_watt != null ? item.g_par_watt.toFixed(3) : '—'}
      </td>
      <td className="px-2 py-2 text-xs font-semibold text-indigo-600 dark:text-indigo-400 text-right">
        {item.cout_total != null ? `${Number(item.cout_total).toFixed(2)} €` : '—'}
      </td>
      <td className="px-2 py-2 text-xs font-semibold text-purple-600 dark:text-purple-400 text-right">
        {item.cout_par_gramme != null ? `${Number(item.cout_par_gramme).toFixed(2)} €/g` : '—'}
      </td>
      <td className="px-2 py-2 text-right" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-end gap-1">
          <button onClick={e => { e.stopPropagation(); onDetail() }}
            className="p-1.5 text-gray-300 hover:text-grow-600 hover:bg-grow-50 rounded transition-colors"
            title="Voir le détail">
            <ChevronRight size={14} />
          </button>
          <button onClick={e => { e.stopPropagation(); setConfirm(true) }}
            className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded opacity-0 group-hover:opacity-100 transition-opacity"
            title="Supprimer">
            <Trash2 size={14} />
          </button>
        </div>
      </td>
    </tr>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function HistoriqueCulturesPage() {
  const qc = useQueryClient()
  const [showModal,        setShowModal]        = useState(false)
  const [showImportExport, setShowImportExport] = useState(false)
  const [detailCultureId,  setDetailCultureId]  = useState<number | null>(null)
  const [selectedYear,     setSelectedYear]     = useState<number | 'all'>('all')
  const [sortCol,          setSortCol]          = useState<SortCol>('date_debut')
  const [sortAsc,          setSortAsc]          = useState(false)

  const { data: cultures = [], isLoading } = useQuery<HistoriqueCulture[]>({
    queryKey: ['historique-cultures'],
    queryFn:  async () => (await historiqueCultureAPI.getAll()).data,
  })

  // Années dispo
  const availableYears = useMemo(() => {
    const ys = new Set<number>()
    cultures.forEach(c => {
      if (c.date_debut) ys.add(new Date(c.date_debut).getFullYear())
    })
    return [...ys].sort((a, b) => b - a)
  }, [cultures])

  // Filtrage + tri
  const filtered = useMemo(() => {
    let list = [...cultures]
    if (selectedYear !== 'all') {
      list = list.filter(
        c => c.date_debut && new Date(c.date_debut).getFullYear() === selectedYear
      )
    }
    const dir = sortAsc ? 1 : -1
    const val = (c: HistoriqueCulture): string | number => {
      switch (sortCol) {
        case 'num':        return c.id_historique_culture
        case 'varietes':   return c.varietes_label
        case 'date_debut': return c.date_debut ?? ''
        case 'date_fin':   return c.date_fin ?? ''
        case 'duree':      return c.duree_jours ?? -1
        case 'plants':     return c.nb_plants
        case 'prix_total': return c.prix_total_graines ?? -1
        case 'tente':      return c.tente ?? ''
        case 'lampe':      return c.lampe ?? ''
        case 'puissance':  return c.puissance ?? -1
        case 'type':       return c.type_culture ?? ''
        case 'substrat':   return c.substrat ?? ''
        case 'engrais':    return c.engrais ?? ''
        case 'qte_total':  return c.quantite_totale ?? -1
        case 'gpw':        return c.g_par_watt ?? -1
        case 'cout_total': return c.cout_total ?? -1
        case 'cout_pg':    return c.cout_par_gramme ?? -1
        default:           return ''
      }
    }
    list.sort((a, b) => {
      const va = val(a), vb = val(b)
      if (va < vb) return -dir
      if (va > vb) return dir
      return 0
    })
    return list
  }, [cultures, selectedYear, sortCol, sortAsc])

  // Stats
  const stats = useMemo(() => {
    if (!filtered.length) return null
    const withQte  = filtered.filter(c => c.quantite_totale != null)
    const withGpW  = filtered.filter(c => c.g_par_watt != null)
    const totalG   = withQte.reduce((s, c) => s + Number(c.quantite_totale), 0)
    const avgGpW   = withGpW.length
      ? withGpW.reduce((s, c) => s + c.g_par_watt!, 0) / withGpW.length
      : null
    const totalPlants = filtered.reduce((s, c) => s + c.nb_plants, 0)
    const allVarietes = new Set<string>()
    filtered.forEach(c => c.plants?.forEach(p => { if (p.variete_nom) allVarietes.add(p.variete_nom) }))
    const nbVarietes = allVarietes.size
    return { nb: filtered.length, totalG, avgGpW, totalPlants, nbVarietes }
  }, [filtered])

  const toggleSort = (col: SortCol) => {
    if (sortCol === col) setSortAsc(a => !a)
    else { setSortCol(col); setSortAsc(false) }
  }

  const Th = ({ col, children, right = false }: { col: SortCol; children: React.ReactNode; right?: boolean }) => (
    <th onClick={() => toggleSort(col)}
      className={`px-2 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 dark:text-gray-500 uppercase tracking-wide cursor-pointer select-none whitespace-nowrap ${right ? 'text-right' : 'text-left'}`}>
      <span className="inline-flex items-center gap-1">
        {children}
        {sortCol === col && <span className="text-grow-500">{sortAsc ? '↑' : '↓'}</span>}
      </span>
    </th>
  )

  const invalidate = () => qc.invalidateQueries({ queryKey: ['historique-cultures'] })

  if (isLoading) return <LoadingSpinner />

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="flex items-center gap-4">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Historique cultures</h1>
          <select
            value={selectedYear}
            onChange={e => setSelectedYear(e.target.value === 'all' ? 'all' : parseInt(e.target.value))}
            className="text-sm border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 bg-white dark:bg-gray-800 focus:ring-2 focus:ring-grow-400 shadow-sm"
          >
            <option value="all">Toutes les années</option>
            {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowImportExport(true)}
            className="flex items-center gap-2 px-4 py-2.5 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700/40 text-sm font-medium">
            <ArrowUpDown size={15} />
            Import / Export
          </button>
          <button onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-grow-600 text-white rounded-xl hover:bg-grow-700 text-sm font-medium shadow-sm">
            <Plus size={16} />
            Nouvelle culture
          </button>
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          {[
            { icon: Leaf,  color: 'grow',   label: 'Cultures',        value: String(stats.nb) },
            { icon: Dna,   color: 'teal',   label: 'Variétés',        value: String(stats.nbVarietes) },
            { icon: Leaf,  color: 'blue',   label: 'Plants total',    value: String(stats.totalPlants) },
            { icon: Scale, color: 'purple', label: 'Récolte totale',  value: `${stats.totalG.toFixed(1)} g` },
            { icon: Zap,   color: 'amber',  label: 'g/W moyen',       value: stats.avgGpW != null ? stats.avgGpW.toFixed(3) : '—' },
          ].map(({ icon: Icon, color, label, value }) => (
            <div key={label} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-4 flex items-center gap-3">
              <div className={`p-2.5 rounded-xl bg-${color}-50`}>
                <Icon size={20} className={`text-${color}-600`} />
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500">{label}</p>
                <p className={`text-xl font-bold text-${color}-700`}>{value}</p>
                {selectedYear !== 'all' && (
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{selectedYear}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tableau */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
        {filtered.length === 0 ? (
          <EmptyState
            icon={Leaf}
            title={selectedYear === 'all' ? 'Aucune culture enregistrée' : `Aucune culture en ${selectedYear}`}
            description="Cliquez sur « Nouvelle culture » pour commencer"
          />
        ) : (
          <>
            <div className="px-5 pt-4 pb-1 flex justify-end">
              <p className="text-xs text-gray-400 dark:text-gray-500">
                {filtered.length} culture{filtered.length > 1 ? 's' : ''}
                {selectedYear !== 'all' ? ` en ${selectedYear}` : ''} — cliquer sur une ligne pour voir le détail
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700">
                    <Th col="num">#</Th>
                    <Th col="varietes">Culture</Th>
                    <Th col="date_debut">Début</Th>
                    <Th col="date_fin">Fin</Th>
                    <Th col="duree" right>Durée</Th>
                    <Th col="plants" right>Plants</Th>
                    <Th col="prix_total" right>Prix graines</Th>
                    <Th col="tente">Tente</Th>
                    <Th col="lampe">Lampe</Th>
                    <Th col="puissance" right>W</Th>
                    <Th col="substrat">Substrat</Th>
                    <Th col="engrais">Engrais</Th>
                    <Th col="qte_total" right>Récolte</Th>
                    <Th col="gpw" right>g/W</Th>
                    <Th col="cout_total" right>Coût €</Th>
                    <Th col="cout_pg" right>€/g</Th>
                    <th className="px-2 py-2"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {filtered.map(c => (
                    <CultureRow
                      key={c.id_historique_culture}
                      item={c}
                      onDetail={() => setDetailCultureId(c.id_historique_culture)}
                      onDeleted={invalidate}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* Modales */}
      {showModal && (
        <NouvelleCultureHistoriqueModal onClose={() => setShowModal(false)} />
      )}
      {showImportExport && (
        <ImportExportModal onClose={() => setShowImportExport(false)} />
      )}
      {detailCultureId != null && (() => {
        const liveCulture = cultures.find(c => c.id_historique_culture === detailCultureId)
        return liveCulture
          ? <CultureHistoriqueDetailModal
              culture={liveCulture}
              onClose={() => setDetailCultureId(null)}
            />
          : null
      })()}
    </div>
  )
}
