import { useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Sparkles, AlertTriangle, Loader2, Trash2, FlaskConical, TrendingUp, Weight, Percent, ArrowUpDown } from 'lucide-react'
import { rosinAPI, stockAPI } from '../api/stock'
import type { RosinExtraction, Stock } from '../api/stock'
import LoadingSpinner from '../components/LoadingSpinner'
import EmptyState from '../components/EmptyState'
import NouvelleExtractionModal from '../components/NouvelleExtractionModal'
import ExtractionDetailModal from '../components/ExtractionDetailModal'
import ImportExportModal from '../components/ImportExportModal'

// ── Helpers ───────────────────────────────────────────────────────────────────
function rendementStr(utilisee: number, extraite: number): { txt: string; color: string } {
  if (!utilisee || utilisee <= 0) return { txt: '—', color: 'text-gray-400' }
  const pct = (extraite / utilisee) * 100
  const txt = pct.toFixed(1) + '%'
  const color = pct >= 20 ? 'text-green-600' : pct >= 12 ? 'text-amber-600' : 'text-red-500'
  return { txt, color }
}

function pressesCount(e: RosinExtraction): number {
  return [e.presse_1_poids, e.presse_2_poids, e.presse_3_poids, e.presse_4_poids]
    .filter(v => v != null && v > 0).length
}

// ── Composant ligne ────────────────────────────────────────────────────────────
function ExtractionRow({
  item, onDeleted, onDetail,
}: {
  item: RosinExtraction
  onDeleted: () => void
  onDetail: () => void
}) {
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
            Supprimer cette extraction ({item.variete_nom ?? 'sans variété'}) ?
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
      <td className="px-5 py-3 text-sm font-medium text-gray-900">
        {item.variete_nom || item.nom_variete_extract || '—'}
      </td>
      <td className="px-5 py-3 text-sm text-gray-500">{item.maillage || '—'}</td>
      <td className="px-5 py-3 text-sm text-gray-500">{nbPresses > 0 ? `${nbPresses}×` : '—'}</td>
      <td className="px-5 py-3 text-sm font-semibold text-gray-700">{item.quantite_utilisee.toFixed(1)} g</td>
      <td className="px-5 py-3 text-sm font-semibold text-grow-700">{item.quantite_extraite.toFixed(2)} g</td>
      <td className={`px-5 py-3 text-sm font-bold ${rdtColor}`}>{rdtTxt}</td>
      <td className="px-5 py-3 text-sm text-gray-400">
        {item.date_rosinextraction
          ? new Date(item.date_rosinextraction).toLocaleDateString('fr-FR')
          : '—'}
      </td>
      <td className="px-5 py-3 text-right" onClick={e => e.stopPropagation()}>
        <button
          onClick={() => setConfirm(true)}
          className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded opacity-0 group-hover:opacity-100 transition-opacity"
          title="Supprimer"
        >
          <Trash2 size={14} />
        </button>
      </td>
    </tr>
  )
}

// ── Page principale ────────────────────────────────────────────────────────────
export default function ExtractionsPage() {
  const qc = useQueryClient()
  const [showModal,        setShowModal]        = useState(false)
  const [showImportExport, setShowImportExport] = useState(false)
  const [detailItem,       setDetailItem]       = useState<RosinExtraction | null>(null)
  const [selectedYear,     setSelectedYear]     = useState<number | 'all'>('all')

  const { data: extractions = [], isLoading: exLoading } = useQuery<RosinExtraction[]>({
    queryKey: ['rosin-extractions'],
    queryFn:  async () => (await rosinAPI.getAll()).data,
  })

  const { data: stocks = [], isLoading: stLoading } = useQuery<Stock[]>({
    queryKey: ['stock'],
    queryFn:  async () => (await stockAPI.getAll()).data,
  })

  // ── Années disponibles ────────────────────────────────────────────────────
  const availableYears = useMemo(() => {
    const ys = new Set<number>()
    extractions.forEach(e => {
      if (e.date_rosinextraction)
        ys.add(new Date(e.date_rosinextraction).getFullYear())
    })
    return [...ys].sort((a, b) => b - a)
  }, [extractions])

  // ── Extractions filtrées ──────────────────────────────────────────────────
  const filtered = useMemo(() => {
    const list = [...extractions].sort(
      (a, b) => new Date(b.date_rosinextraction).getTime() - new Date(a.date_rosinextraction).getTime()
    )
    if (selectedYear === 'all') return list
    return list.filter(
      e => e.date_rosinextraction && new Date(e.date_rosinextraction).getFullYear() === selectedYear
    )
  }, [extractions, selectedYear])

  // ── Stats calculées sur les extractions filtrées ──────────────────────────
  const stats = useMemo(() => {
    if (!filtered.length) return null
    const totalPresse  = filtered.reduce((s, e) => s + e.quantite_utilisee, 0)
    const totalExtrait = filtered.reduce((s, e) => s + e.quantite_extraite, 0)
    const ratios = filtered
      .filter(e => e.quantite_utilisee > 0)
      .map(e => (e.quantite_extraite / e.quantite_utilisee) * 100)
    const ratioMoyen = ratios.length ? ratios.reduce((s, r) => s + r, 0) / ratios.length : 0
    return {
      nombre_extractions:    filtered.length,
      total_presse_g:        totalPresse,
      total_extrait_rosin_g: totalExtrait,
      ratio_moyen_rosin:     ratioMoyen,
    }
  }, [filtered])

  if (exLoading || stLoading) return <LoadingSpinner />

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['rosin-extractions'] })
    qc.invalidateQueries({ queryKey: ['rosin-stats'] })
    qc.invalidateQueries({ queryKey: ['stock'] })
  }

  const COLS = ['Variété', 'Maillage', 'Passes', 'Entrée', 'Sortie', 'Rendement', 'Date', '']

  return (
    <div className="space-y-6">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="flex items-center gap-4">
          <h1 className="text-3xl font-bold text-gray-900">Extractions Rosin</h1>
          {/* Filtre année */}
          <select
            value={selectedYear}
            onChange={e => setSelectedYear(e.target.value === 'all' ? 'all' : parseInt(e.target.value))}
            className="text-sm border border-gray-200 rounded-xl px-3 py-2 bg-white focus:ring-2 focus:ring-grow-400 shadow-sm"
          >
            <option value="all">Toutes les années</option>
            {availableYears.map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowImportExport(true)}
            className="flex items-center gap-2 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors text-sm font-medium"
          >
            <ArrowUpDown size={15} />
            Import / Export
          </button>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-grow-600 text-white rounded-xl hover:bg-grow-700 transition-colors text-sm font-medium shadow-sm"
          >
            <Plus size={16} />
            Nouvelle extraction
          </button>
        </div>
      </div>

      {/* ── Stats ──────────────────────────────────────────────────────────── */}
      {stats ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { icon: Percent,      color: 'grow',   label: 'Rendement moyen', value: `${stats.ratio_moyen_rosin.toFixed(1)}%` },
            { icon: Weight,       color: 'blue',   label: 'Total pressé',    value: `${stats.total_presse_g.toFixed(1)} g` },
            { icon: FlaskConical, color: 'purple', label: 'Rosin extrait',   value: `${stats.total_extrait_rosin_g.toFixed(1)} g` },
            { icon: TrendingUp,   color: 'amber',  label: 'Extractions',     value: String(stats.nombre_extractions) },
          ].map(({ icon: Icon, color, label, value }) => (
            <div key={label} className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 flex items-center gap-3">
              <div className={`p-2.5 rounded-xl bg-${color}-50`}>
                <Icon size={20} className={`text-${color}-600`} />
              </div>
              <div>
                <p className="text-xs text-gray-500">{label}</p>
                <p className={`text-xl font-bold text-${color}-700`}>{value}</p>
                {selectedYear !== 'all' && (
                  <p className="text-xs text-gray-400 mt-0.5">{selectedYear}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        // Cartes vides quand aucune extraction pour l'année sélectionnée
        selectedYear !== 'all' && (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm px-6 py-4 text-sm text-gray-400 text-center">
            Aucune extraction en {selectedYear}
          </div>
        )
      )}

      {/* ── Table ──────────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {filtered.length === 0 ? (
          <EmptyState
            icon={Sparkles}
            title={selectedYear === 'all' ? 'Aucune extraction enregistrée' : `Aucune extraction en ${selectedYear}`}
            description={selectedYear === 'all' ? 'Cliquez sur « Nouvelle extraction » pour commencer' : 'Sélectionnez une autre année ou ajoutez une extraction'}
          />
        ) : (
          <>
            <div className="px-5 pt-4 pb-1 flex items-center justify-between">
              <p className="text-xs text-gray-400">
                Cliquez sur une ligne pour voir les détails
              </p>
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
                    <ExtractionRow
                      key={e.id_rosinextraction}
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
      {showModal && (
        <NouvelleExtractionModal stocks={stocks} onClose={() => setShowModal(false)} />
      )}
      {showImportExport && (
        <ImportExportModal onClose={() => setShowImportExport(false)} defaultTab="extractions" />
      )}
      {detailItem && (
        <ExtractionDetailModal extraction={detailItem} onClose={() => setDetailItem(null)} />
      )}
    </div>
  )
}
