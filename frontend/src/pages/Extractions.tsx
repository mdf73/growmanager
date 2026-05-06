import { useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Sparkles, AlertTriangle, Loader2, Trash2, FlaskConical, TrendingUp, Weight, Percent, ArrowUpDown, Search, ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react'
import { rosinAPI, stockAPI } from '../api/stock'
import type { RosinExtraction, Stock } from '../api/stock'
import LoadingSpinner from '../components/LoadingSpinner'
import EmptyState from '../components/EmptyState'
import NouvelleExtractionModal from '../components/NouvelleExtractionModal'
import ExtractionDetailModal from '../components/ExtractionDetailModal'
import ImportExportModal from '../components/ImportExportModal'

// Types tri
type ExtractSortCol = 'variete' | 'maillage' | 'passes' | 'entree' | 'sortie' | 'rendement' | 'date'
type SortDir = 'asc' | 'desc'

function SortIcon({ col, current, dir }: { col: ExtractSortCol; current: ExtractSortCol | null; dir: SortDir }) {
  if (current !== col) return <ChevronsUpDown size={12} className="ml-1 text-gray-300 inline" />
  return dir === 'asc'
    ? <ChevronUp   size={12} className="ml-1 text-grow-600 inline" />
    : <ChevronDown size={12} className="ml-1 text-grow-600 inline" />
}

// Helpers
function rendementStr(utilisee: number, extraite: number): { txt: string; color: string } {
  if (!utilisee || utilisee <= 0) return { txt: '---', color: 'text-gray-400' }
  const pct = (extraite / utilisee) * 100
  const txt = pct.toFixed(1) + '%'
  const color = pct >= 20 ? 'text-green-600' : pct >= 12 ? 'text-amber-600' : 'text-red-500'
  return { txt, color }
}

function pressesCount(e: RosinExtraction): number {
  return [e.presse_1_poids, e.presse_2_poids, e.presse_3_poids, e.presse_4_poids]
    .filter(v => v != null && v > 0).length
}

// Composant ligne
function ExtractionRow({ item, onDeleted, onDetail }: { item: RosinExtraction; onDeleted: () => void; onDetail: () => void }) {
  const [confirm, setConfirm] = useState(false)
  const remove = useMutation({
    mutationFn: () => rosinAPI.delete(item.id_rosinextraction),
    onSuccess: onDeleted,
    onError: () => setConfirm(false),
  })
  const { txt: rdtTxt, color: rdtColor } = rendementStr(item.quantite_utilisee, item.quantite_extraite)
  const nbPresses = pressesCount(item)

  if (confirm) {
    return (
      <tr className="bg-red-50">
        <td colSpan={7} className="px-5 py-3 text-sm text-red-700">
          <span className="flex items-center gap-2">
            <AlertTriangle size={14} />
            Supprimer cette extraction ({item.variete_nom ?? 'sans variete'}) ?
          </span>
        </td>
        <td className="px-5 py-3 text-right">
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
    <tr className="hover:bg-gray-50 dark:hover:bg-gray-700/40 group cursor-pointer" onClick={onDetail}>
      <td className="px-5 py-3 text-sm font-medium text-gray-900 dark:text-gray-100">
        {item.variete_nom || item.nom_variete_extract || '---'}
      </td>
      <td className="px-5 py-3 text-sm text-gray-500 dark:text-gray-400">{item.maillage || '---'}</td>
      <td className="px-5 py-3 text-sm text-gray-500 dark:text-gray-400">{nbPresses > 0 ? nbPresses + 'x' : '---'}</td>
      <td className="px-5 py-3 text-sm font-semibold text-gray-700 dark:text-gray-200">{item.quantite_utilisee.toFixed(2)} g</td>
      <td className="px-5 py-3 text-sm font-semibold text-grow-700">{item.quantite_extraite.toFixed(2)} g</td>
      <td className={'px-5 py-3 text-sm font-bold ' + rdtColor}>{rdtTxt}</td>
      <td className="px-5 py-3 text-sm text-gray-400 dark:text-gray-500">
        {item.date_rosinextraction ? new Date(item.date_rosinextraction).toLocaleDateString('fr-FR') : '---'}
      </td>
      <td className="px-5 py-3 text-right" onClick={e => e.stopPropagation()}>
        <button onClick={() => setConfirm(true)}
          className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded opacity-0 group-hover:opacity-100 transition-opacity"
          title="Supprimer">
          <Trash2 size={14} />
        </button>
      </td>
    </tr>
  )
}

// Page principale
export default function ExtractionsPage() {
  const qc = useQueryClient()
  const [showModal,        setShowModal]        = useState(false)
  const [showImportExport, setShowImportExport] = useState(false)
  const [detailItem,       setDetailItem]       = useState<RosinExtraction | null>(null)
  const [selectedYear,     setSelectedYear]     = useState<number | 'all'>('all')
  const [searchVariete,    setSearchVariete]    = useState('')
  const [sortCol,          setSortCol]          = useState<ExtractSortCol | null>(null)
  const [sortDir,          setSortDir]          = useState<SortDir>('asc')

  const handleSort = (col: ExtractSortCol) => {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortCol(col); setSortDir('asc') }
  }

  const { data: extractions = [], isLoading: exLoading } = useQuery<RosinExtraction[]>({
    queryKey: ['rosin-extractions'],
    queryFn:  async () => (await rosinAPI.getAll()).data,
  })

  const { data: stocks = [], isLoading: stLoading } = useQuery<Stock[]>({
    queryKey: ['stock'],
    queryFn:  async () => (await stockAPI.getAll()).data,
  })

  const availableYears = useMemo(() => {
    const ys = new Set<number>()
    extractions.forEach(e => {
      if (e.date_rosinextraction) ys.add(new Date(e.date_rosinextraction).getFullYear())
    })
    return [...ys].sort((a, b) => b - a)
  }, [extractions])

  const filteredByYear = useMemo(() => {
    if (selectedYear === 'all') return extractions
    return extractions.filter(e =>
      e.date_rosinextraction && new Date(e.date_rosinextraction).getFullYear() === selectedYear
    )
  }, [extractions, selectedYear])

  const filtered = useMemo(() => {
    const q = searchVariete.trim().toLowerCase()
    let base = q
      ? filteredByYear.filter(e => (e.variete_nom ?? e.nom_variete_extract ?? '').toLowerCase().includes(q))
      : [...filteredByYear]

    if (!sortCol) {
      return base.sort((a, b) =>
        new Date(b.date_rosinextraction).getTime() - new Date(a.date_rosinextraction).getTime()
      )
    }

    return base.sort((a, b) => {
      let av: string | number = 0
      let bv: string | number = 0
      switch (sortCol) {
        case 'variete':
          av = (a.variete_nom ?? a.nom_variete_extract ?? '').toLowerCase()
          bv = (b.variete_nom ?? b.nom_variete_extract ?? '').toLowerCase()
          break
        case 'maillage':  av = a.maillage ?? '';  bv = b.maillage ?? '';  break
        case 'passes':    av = pressesCount(a);   bv = pressesCount(b);   break
        case 'entree':    av = a.quantite_utilisee;  bv = b.quantite_utilisee;  break
        case 'sortie':    av = a.quantite_extraite;  bv = b.quantite_extraite;  break
        case 'rendement':
          av = a.quantite_utilisee > 0 ? a.quantite_extraite / a.quantite_utilisee : 0
          bv = b.quantite_utilisee > 0 ? b.quantite_extraite / b.quantite_utilisee : 0
          break
        case 'date':
          av = new Date(a.date_rosinextraction).getTime()
          bv = new Date(b.date_rosinextraction).getTime()
          break
      }
      if (av < bv) return sortDir === 'asc' ? -1 : 1
      if (av > bv) return sortDir === 'asc' ?  1 : -1
      return 0
    })
  }, [filteredByYear, searchVariete, sortCol, sortDir])

  const stats = useMemo(() => {
    if (!filtered.length) return null
    const totalPresse  = filtered.reduce((s, e) => s + e.quantite_utilisee, 0)
    const totalExtrait = filtered.reduce((s, e) => s + e.quantite_extraite, 0)
    const ratios = filtered.filter(e => e.quantite_utilisee > 0).map(e => (e.quantite_extraite / e.quantite_utilisee) * 100)
    const ratioMoyen = ratios.length ? ratios.reduce((s, r) => s + r, 0) / ratios.length : 0
    return { nombre_extractions: filtered.length, total_presse_g: totalPresse, total_extrait_rosin_g: totalExtrait, ratio_moyen_rosin: ratioMoyen }
  }, [filtered])

  if (exLoading || stLoading) return <LoadingSpinner />

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['rosin-extractions'] })
    qc.invalidateQueries({ queryKey: ['rosin-stats'] })
    qc.invalidateQueries({ queryKey: ['stock'] })
  }

  const isFiltered = searchVariete.trim() !== ''
  const SORTABLE_COLS: [ExtractSortCol, string][] = [
    ['variete', 'Variete'], ['maillage', 'Maillage'], ['passes', 'Passes'],
    ['entree', 'Entree'], ['sortie', 'Sortie'], ['rendement', 'Rendement'], ['date', 'Date'],
  ]

  return (
    <div className="space-y-6">

      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Extractions Rosin</h1>
          <select
            value={selectedYear}
            onChange={e => setSelectedYear(e.target.value === 'all' ? 'all' : parseInt(e.target.value))}
            className="text-sm border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 bg-white dark:bg-gray-800 focus:ring-2 focus:ring-grow-400 shadow-sm"
          >
            <option value="all">Toutes les annees</option>
            {availableYears.map(y => (<option key={y} value={y}>{y}</option>))}
          </select>
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Filtrer par variete..."
              value={searchVariete}
              onChange={e => setSearchVariete(e.target.value)}
              className="pl-8 pr-7 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 focus:ring-2 focus:ring-grow-400 shadow-sm w-48"
            />
            {searchVariete && (
              <button onClick={() => setSearchVariete('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700 text-base leading-none">
                x
              </button>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowImportExport(true)}
            className="flex items-center gap-2 px-4 py-2.5 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700/40 transition-colors text-sm font-medium">
            <ArrowUpDown size={15} />
            Import / Export
          </button>
          <button onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-grow-600 text-white rounded-xl hover:bg-grow-700 transition-colors text-sm font-medium shadow-sm">
            <Plus size={16} />
            Nouvelle extraction
          </button>
        </div>
      </div>

      {stats ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { icon: Percent,      color: 'grow',   label: 'Rendement moyen', value: stats.ratio_moyen_rosin.toFixed(1) + '%' },
            { icon: Weight,       color: 'blue',   label: 'Total presse',    value: stats.total_presse_g.toFixed(1) + ' g' },
            { icon: FlaskConical, color: 'purple', label: 'Rosin extrait',   value: stats.total_extrait_rosin_g.toFixed(1) + ' g' },
            { icon: TrendingUp,   color: 'amber',  label: 'Extractions',     value: String(stats.nombre_extractions) },
          ].map(({ icon: Icon, color, label, value }) => (
            <div key={label} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-4 flex items-center gap-3">
              <div className={'p-2.5 rounded-xl bg-' + color + '-50'}>
                <Icon size={20} className={'text-' + color + '-600'} />
              </div>
              <div>
                <p className="text-xs text-gray-500">{label}</p>
                <p className={'text-xl font-bold text-' + color + '-700'}>{value}</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {isFiltered ? searchVariete.trim() : selectedYear !== 'all' ? String(selectedYear) : ''}
                </p>
              </div>
            </div>
          ))}
        </div>
      ) : (
        (selectedYear !== 'all' || isFiltered) && (
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm px-6 py-4 text-sm text-gray-400 text-center">
            {isFiltered ? 'Aucune extraction pour cette variete' : 'Aucune extraction en ' + String(selectedYear)}
          </div>
        )
      )}

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
        {filtered.length === 0 && !isFiltered && filteredByYear.length === 0 ? (
          <EmptyState
            icon={Sparkles}
            title={selectedYear === 'all' ? 'Aucune extraction enregistree' : 'Aucune extraction en ' + String(selectedYear)}
            description={selectedYear === 'all' ? 'Cliquez sur Nouvelle extraction pour commencer' : 'Selectionnez une autre annee'}
          />
        ) : filtered.length === 0 ? (
          <div className="px-6 py-10 text-center text-sm text-gray-400">
            {'Aucune extraction pour cette variete' + (selectedYear !== 'all' ? ' en ' + String(selectedYear) : '')}
          </div>
        ) : (
          <>
            <div className="px-5 pt-4 pb-1 flex items-center justify-between">
              <p className="text-xs text-gray-400">Cliquez sur une ligne pour voir les details</p>
              <p className="text-xs text-gray-400">
                {filtered.length + ' extraction' + (filtered.length > 1 ? 's' : '') + (isFiltered ? ' - ' + searchVariete.trim() : selectedYear !== 'all' ? ' en ' + String(selectedYear) : ' au total')}
              </p>
            </div>
            <div className="overflow-auto max-h-[calc(100vh-420px)]">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-10">
                  <tr>
                    {SORTABLE_COLS.map(([col, label]) => (
                      <th key={col} onClick={() => handleSort(col)}
                        className="px-5 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide cursor-pointer select-none hover:text-gray-700 whitespace-nowrap">
                        {label}<SortIcon col={col} current={sortCol} dir={sortDir} />
                      </th>
                    ))}
                    <th className="px-5 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {filtered.map(e => (
                    <ExtractionRow key={e.id_rosinextraction} item={e} onDeleted={invalidate} onDetail={() => setDetailItem(e)} />
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {showModal && <NouvelleExtractionModal stocks={stocks} onClose={() => setShowModal(false)} />}
      {showImportExport && <ImportExportModal onClose={() => setShowImportExport(false)} defaultTab="extractions" />}
      {detailItem && <ExtractionDetailModal extraction={detailItem} onClose={() => setDetailItem(null)} />}
    </div>
  )
}
