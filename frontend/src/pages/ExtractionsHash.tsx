import { useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, AlertTriangle, Loader2, Trash2, TrendingUp, Weight, Percent, ArrowUpDown } from 'lucide-react'
import { hashAPI } from '../api/stock'
import type { HashExtraction } from '../api/stock'
import LoadingSpinner from '../components/LoadingSpinner'
import EmptyState from '../components/EmptyState'
import NouvelleHashModal from '../components/NouvelleHashModal'
import HashDetailModal from '../components/HashDetailModal'
import ImportExportModal from '../components/ImportExportModal'

// ── Helpers ───────────────────────────────────────────────────────────────────
function rendementStr(utilisee: number, extraite: number) {
  if (!utilisee || utilisee <= 0) return { txt: '—', color: 'text-gray-400' }
  const pct = (extraite / utilisee) * 100
  return {
    txt:   pct.toFixed(1) + '%',
    color: pct >= 20 ? 'text-green-600' : pct >= 10 ? 'text-amber-600' : 'text-red-500',
  }
}

// ── Composant ligne ────────────────────────────────────────────────────────────
function HashRow({ item, onDeleted, onDetail }: {
  item: HashExtraction; onDeleted: () => void; onDetail: () => void
}) {
  const [confirm, setConfirm] = useState(false)
  const remove = useMutation({
    mutationFn: () => hashAPI.delete(item.id_hashextraction),
    onSuccess: onDeleted,
    onError:   () => setConfirm(false),
  })

  const { txt: rdtTxt, color: rdtColor } = rendementStr(item.quantite_utilisee, item.quantite_extraite)
  const varieteLabel = item.variete_nom || item.nom_variete_hash || '—'
  const typeLabel    = item.type_extraction === 'Polinator'
    ? <span className="text-xs px-1.5 py-0.5 bg-orange-100 text-orange-700 rounded-full">🥁 Polinator</span>
    : item.type_extraction === 'Ice-o-lator'
      ? <span className="text-xs px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded-full">🧊 Ice-o-lator</span>
      : null

  if (confirm) {
    return (
      <tr className="bg-red-50">
        <td colSpan={6} className="px-5 py-3 text-sm text-red-700">
          <span className="flex items-center gap-2">
            <AlertTriangle size={14} />
            Supprimer cette extraction ({varieteLabel}) ?
          </span>
        </td>
        <td className="px-5 py-3 text-right">
          <div className="flex justify-end gap-2">
            <button
              onClick={() => remove.mutate()} disabled={remove.isPending}
              className="px-3 py-1 bg-red-600 text-white text-xs rounded hover:bg-red-700 disabled:opacity-50"
            >
              {remove.isPending ? <Loader2 size={12} className="animate-spin" /> : 'Confirmer'}
            </button>
            <button onClick={() => setConfirm(false)}
              className="px-3 py-1 border border-gray-300 text-gray-600 text-xs rounded hover:bg-gray-50">
              Annuler
            </button>
          </div>
        </td>
      </tr>
    )
  }

  return (
    <tr className="hover:bg-gray-50 group cursor-pointer" onClick={onDetail}>
      <td className="px-5 py-3 text-sm font-medium text-gray-900">{varieteLabel}</td>
      <td className="px-5 py-3">{typeLabel}</td>
      <td className="px-5 py-3 text-sm font-semibold text-gray-700">{item.quantite_utilisee.toFixed(1)} g</td>
      <td className="px-5 py-3 text-sm font-semibold text-amber-700">{item.quantite_extraite.toFixed(2)} g</td>
      <td className={`px-5 py-3 text-sm font-bold ${rdtColor}`}>{rdtTxt}</td>
      <td className="px-5 py-3 text-sm text-gray-400">
        {item.date_hashextraction
          ? new Date(item.date_hashextraction).toLocaleDateString('fr-FR')
          : '—'}
      </td>
      <td className="px-5 py-3 text-right" onClick={e => e.stopPropagation()}>
        <button
          onClick={() => setConfirm(true)}
          className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <Trash2 size={14} />
        </button>
      </td>
    </tr>
  )
}

// ── Page principale ────────────────────────────────────────────────────────────
export default function ExtractionsHashPage() {
  const qc = useQueryClient()
  const [showModal,        setShowModal]        = useState(false)
  const [showImportExport, setShowImportExport] = useState(false)
  const [detailItem,       setDetailItem]       = useState<HashExtraction | null>(null)
  const [selectedYear,     setSelectedYear]     = useState<number | 'all'>('all')

  const { data: extractions = [], isLoading } = useQuery<HashExtraction[]>({
    queryKey: ['hash-extractions'],
    queryFn:  async () => (await hashAPI.getAll()).data,
  })

  // ── Années disponibles ────────────────────────────────────────────────────
  const availableYears = useMemo(() => {
    const ys = new Set<number>()
    extractions.forEach(e => {
      if (e.date_hashextraction)
        ys.add(new Date(e.date_hashextraction).getFullYear())
    })
    return [...ys].sort((a, b) => b - a)
  }, [extractions])

  // ── Extractions filtrées ──────────────────────────────────────────────────
  const filtered = useMemo(() => {
    const list = [...extractions].sort(
      (a, b) => new Date(b.date_hashextraction).getTime() - new Date(a.date_hashextraction).getTime()
    )
    if (selectedYear === 'all') return list
    return list.filter(
      e => e.date_hashextraction && new Date(e.date_hashextraction).getFullYear() === selectedYear
    )
  }, [extractions, selectedYear])

  // ── Stats calculées ───────────────────────────────────────────────────────
  const stats = useMemo(() => {
    if (!filtered.length) return null
    const totalEntree = filtered.reduce((s, e) => s + e.quantite_utilisee, 0)
    const totalHash   = filtered.reduce((s, e) => s + e.quantite_extraite, 0)
    const ratios      = filtered
      .filter(e => e.quantite_utilisee > 0)
      .map(e => (e.quantite_extraite / e.quantite_utilisee) * 100)
    const ratioMoyen  = ratios.length ? ratios.reduce((s, r) => s + r, 0) / ratios.length : 0
    const nbPoli      = filtered.filter(e => e.type_extraction === 'Polinator').length
    const nbIceo      = filtered.filter(e => e.type_extraction === 'Ice-o-lator').length
    return { nombre: filtered.length, totalEntree, totalHash, ratioMoyen, nbPoli, nbIceo }
  }, [filtered])

  if (isLoading) return <LoadingSpinner />

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['hash-extractions'] })
    qc.invalidateQueries({ queryKey: ['hash-stats'] })
    qc.invalidateQueries({ queryKey: ['stock'] })
  }

  const COLS = ['Variété', 'Type', 'Entrée', 'Hash extrait', 'Rendement', 'Date', '']

  return (
    <div className="space-y-6">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3">
            <span className="text-3xl">🍫</span>
            <h1 className="text-3xl font-bold text-gray-900">Extractions Hash</h1>
          </div>
          <select
            value={selectedYear}
            onChange={e => setSelectedYear(e.target.value === 'all' ? 'all' : parseInt(e.target.value))}
            className="text-sm border border-gray-200 rounded-xl px-3 py-2 bg-white focus:ring-2 focus:ring-amber-400 shadow-sm"
          >
            <option value="all">Toutes les années</option>
            {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowImportExport(true)}
            className="flex items-center gap-2 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 text-sm font-medium"
          >
            <ArrowUpDown size={15} /> Import / Export
          </button>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-amber-600 text-white rounded-xl hover:bg-amber-700 text-sm font-medium shadow-sm"
          >
            <Plus size={16} /> Nouvelle extraction
          </button>
        </div>
      </div>

      {/* ── Stats ──────────────────────────────────────────────────────────── */}
      {stats ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Rendement moyen', value: `${stats.ratioMoyen.toFixed(1)}%`,         icon: Percent,    color: 'amber' },
            { label: 'Total entrée',    value: `${stats.totalEntree.toFixed(1)} g`,        icon: Weight,     color: 'blue' },
            { label: 'Hash extrait',    value: `${stats.totalHash.toFixed(1)} g`,          icon: () => <span className="text-xl">🍫</span>, color: 'yellow' },
            { label: 'Extractions',     value: `${stats.nombre} (${stats.nbPoli}🥁 ${stats.nbIceo}🧊)`, icon: TrendingUp, color: 'grow' },
          ].map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 flex items-center gap-3">
              <div className={`p-2.5 rounded-xl bg-${color}-50`}>
                <Icon size={20} className={`text-${color}-600`} />
              </div>
              <div>
                <p className="text-xs text-gray-500">{label}</p>
                <p className={`text-lg font-bold text-${color}-700 leading-tight`}>{value}</p>
                {selectedYear !== 'all' && <p className="text-xs text-gray-400 mt-0.5">{selectedYear}</p>}
              </div>
            </div>
          ))}
        </div>
      ) : selectedYear !== 'all' && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm px-6 py-4 text-sm text-gray-400 text-center">
          Aucune extraction en {selectedYear}
        </div>
      )}

      {/* ── Table ──────────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {filtered.length === 0 ? (
          <EmptyState
            icon={() => <span className="text-5xl">🍫</span>}
            title={selectedYear === 'all' ? 'Aucune extraction enregistrée' : `Aucune extraction en ${selectedYear}`}
            description="Cliquez sur « Nouvelle extraction » pour commencer"
          />
        ) : (
          <>
            <div className="px-5 pt-4 pb-1 flex items-center justify-between">
              <p className="text-xs text-gray-400">Cliquez sur une ligne pour voir les détails</p>
              <p className="text-xs text-gray-400">
                {filtered.length} extraction{filtered.length > 1 ? 's' : ''}
                {selectedYear !== 'all' ? ` en ${selectedYear}` : ' au total'}
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    {COLS.map(h => (
                      <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filtered.map(e => (
                    <HashRow
                      key={e.id_hashextraction}
                      item={e}
                      onDeleted={invalidate}
                      onDetail={() => setDetailItem(e)}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* ── Modales ────────────────────────────────────────────────────────── */}
      {showModal && <NouvelleHashModal onClose={() => setShowModal(false)} />}
      {showImportExport && (
        <ImportExportModal onClose={() => setShowImportExport(false)} defaultTab="extractions-hash" />
      )}
      {detailItem && (
        <HashDetailModal extraction={detailItem} onClose={() => setDetailItem(null)} />
      )}
    </div>
  )
}
