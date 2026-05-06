import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { X, Zap, Loader2, Leaf, Hash, Droplets, ChevronDown } from 'lucide-react'
import client from '../api/client'

// ── Types ─────────────────────────────────────────────────────────────────────

interface StockVapo {
  id_stock:       number
  type_stock:     string | null
  id_variete:     number | null
  variete_nom:    string | null
  quantite_stock: number
  maillage?:      string | null
  type_hash?:     string | null
  type_rosin?:    string | null
}

// ── Config types ──────────────────────────────────────────────────────────────

const TYPES_VAPO = [
  { key: 'Fleur',     label: 'Fleur séchée',  icon: '🌿', color: 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-300 dark:border-green-700' },
  { key: 'Hash',      label: 'Hash',           icon: '🟤', color: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-300 dark:border-amber-700' },
  { key: 'Rosin',     label: 'Rosin',          icon: '💛', color: 'bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-900/20 dark:text-yellow-300 dark:border-yellow-700' },
  { key: 'Trim',      label: 'Trim',           icon: '🍃', color: 'bg-lime-50 text-lime-700 border-lime-200 dark:bg-lime-900/20 dark:text-lime-300 dark:border-lime-700' },
  { key: 'WPFF',      label: 'WPFF',           icon: '🌾', color: 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-900/20 dark:text-orange-300 dark:border-orange-700' },
  { key: 'Poussière', label: 'Poussière',      icon: '✨', color: 'bg-gray-50 text-gray-600 border-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600' },
]

const inputCls = 'w-full text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 focus:ring-2 focus:ring-grow-400 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100'

// ── Label stock dans le select ────────────────────────────────────────────────
function stockLabel(s: StockVapo): string {
  const parts: string[] = []
  if (s.variete_nom) parts.push(s.variete_nom)
  if (s.maillage) parts.push(s.maillage)
  if (s.type_hash) parts.push(s.type_hash)
  if (s.type_rosin) parts.push(s.type_rosin)
  const desc = parts.join(' · ')
  return `${desc || 'Sans variété'} — ${s.quantite_stock.toFixed(1)} g`
}

// ── Modal ─────────────────────────────────────────────────────────────────────

interface Props {
  vapoId:  number
  vapoNom: string
  onClose: () => void
}

export default function NouveauSessionVapoModal({ vapoId, vapoNom, onClose }: Props) {
  const qc = useQueryClient()

  const [typeSelectionne, setTypeSelectionne] = useState<string | null>(null)
  const [idStock, setIdStock]     = useState<number | null>(null)
  const [quantiteG, setQuantiteG] = useState<string>('')

  // Récupère tous les stocks vapo actifs
  const { data: stocks = [], isLoading: loadingStocks } = useQuery<StockVapo[]>({
    queryKey: ['stocks-vapo'],
    queryFn:  async () => (await client.get<StockVapo[]>('/vaporisateurs/stocks-vapo')).data,
  })

  // Stocks filtrés par type sélectionné
  const stocksFiltres = typeSelectionne
    ? stocks.filter(s => s.type_stock === typeSelectionne)
    : []

  const stockActuel = stocks.find(s => s.id_stock === idStock) ?? null

  // Reset le stock si on change de type
  const handleTypeChange = (key: string) => {
    setTypeSelectionne(prev => {
      if (prev === key) return null // toggle off
      return key
    })
    setIdStock(null)
    setQuantiteG('')
  }

  const handleStockChange = (val: string) => {
    setIdStock(val ? Number(val) : null)
    setQuantiteG('')
  }

  const addSession = useMutation({
    mutationFn: async () => {
      const body: { id_stock?: number; quantite_g?: number } = {}
      if (idStock && quantiteG) {
        body.id_stock   = idStock
        body.quantite_g = parseFloat(quantiteG)
      }
      await client.post(`/vaporisateurs/${vapoId}/session`, body)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['vaporisateurs'] })
      qc.invalidateQueries({ queryKey: ['stocks-vapo'] })
      qc.invalidateQueries({ queryKey: ['stock'] })
      onClose()
    },
  })

  const quantiteNum   = parseFloat(quantiteG) || 0
  const maxQuantite   = stockActuel?.quantite_stock ?? 0
  const quantiteOk    = !quantiteG || (quantiteNum > 0 && quantiteNum <= maxQuantite)
  const canSubmit     = !addSession.isPending && quantiteOk && (
    // soit on a choisi un stock + une quantité valide
    (idStock !== null && quantiteNum > 0 && quantiteNum <= maxQuantite)
    // soit on veut juste incrémenter sans déduire (pas de stock sélectionné)
    || idStock === null
  )

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-700">
          <div>
            <h2 className="text-base font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
              <Zap size={16} className="text-grow-600" /> Nouvelle session
            </h2>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{vapoNom}</p>
          </div>
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700">
            <X size={18} />
          </button>
        </div>

        <div className="p-6 space-y-5">

          {/* Étape 1 : Type de matériau */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-2 uppercase tracking-wide">
              1 — Type de matériau
            </label>
            <div className="grid grid-cols-3 gap-2">
              {TYPES_VAPO.map(t => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => handleTypeChange(t.key)}
                  className={`flex flex-col items-center gap-1 px-2 py-2.5 rounded-xl border-2 text-xs font-medium transition-all ${
                    typeSelectionne === t.key
                      ? t.color + ' border-current shadow-sm'
                      : 'bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                  }`}>
                  <span className="text-lg">{t.icon}</span>
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Étape 2 : Stock + variété (si type sélectionné) */}
          {typeSelectionne && (
            <div>
              <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-2 uppercase tracking-wide">
                2 — Variété / Stock
              </label>
              {loadingStocks ? (
                <div className="flex items-center gap-2 text-sm text-gray-400 dark:text-gray-500">
                  <Loader2 size={14} className="animate-spin" /> Chargement…
                </div>
              ) : stocksFiltres.length === 0 ? (
                <p className="text-sm text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 rounded-lg px-3 py-2">
                  Aucun stock de type <strong>{typeSelectionne}</strong> disponible.
                </p>
              ) : (
                <select
                  value={idStock ?? ''}
                  onChange={e => handleStockChange(e.target.value)}
                  className={inputCls}>
                  <option value="">— Sélectionner un stock —</option>
                  {stocksFiltres.map(s => (
                    <option key={s.id_stock} value={s.id_stock}>
                      {stockLabel(s)}
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}

          {/* Étape 3 : Quantité (si stock sélectionné) */}
          {idStock !== null && stockActuel && (
            <div>
              <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-2 uppercase tracking-wide">
                3 — Quantité utilisée
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="0.1"
                  min="0.1"
                  max={maxQuantite}
                  value={quantiteG}
                  onChange={e => setQuantiteG(e.target.value)}
                  placeholder={`max ${maxQuantite.toFixed(1)} g`}
                  className={`${inputCls} pr-10 ${!quantiteOk ? 'border-red-400 focus:ring-red-300' : ''}`}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-400 dark:text-gray-500 pointer-events-none">g</span>
              </div>

              {/* Jauge visuelle */}
              {quantiteNum > 0 && quantiteOk && (
                <div className="mt-2">
                  <div className="flex justify-between text-xs text-gray-400 dark:text-gray-500 mb-1">
                    <span>Restant après session</span>
                    <span className="font-medium text-gray-700 dark:text-gray-200">
                      {(maxQuantite - quantiteNum).toFixed(1)} g / {maxQuantite.toFixed(1)} g
                    </span>
                  </div>
                  <div className="h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-grow-500 rounded-full transition-all"
                      style={{ width: `${Math.max(0, ((maxQuantite - quantiteNum) / maxQuantite) * 100)}%` }}
                    />
                  </div>
                </div>
              )}

              {!quantiteOk && quantiteG && (
                <p className="text-xs text-red-500 mt-1">
                  Quantité trop élevée (max {maxQuantite.toFixed(1)} g)
                </p>
              )}
            </div>
          )}

          {/* Note si pas de stock sélectionné */}
          {typeSelectionne === null && (
            <p className="text-xs text-gray-400 dark:text-gray-500 italic text-center">
              Sélectionnez un type pour déduire du stock, ou confirmez directement sans déduction.
            </p>
          )}
          {typeSelectionne !== null && idStock === null && stocksFiltres.length > 0 && (
            <p className="text-xs text-gray-400 dark:text-gray-500 italic text-center">
              Sélectionnez un stock pour déduire la quantité, ou confirmez sans déduction.
            </p>
          )}

        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100 dark:border-gray-700">
          <button type="button" onClick={onClose}
            className="px-4 py-2 text-sm text-gray-600 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700/40">
            Annuler
          </button>
          <button
            type="button"
            onClick={() => addSession.mutate()}
            disabled={!canSubmit}
            className="px-5 py-2 bg-grow-600 text-white text-sm font-medium rounded-xl hover:bg-grow-700 disabled:opacity-50 flex items-center gap-2">
            {addSession.isPending
              ? <Loader2 size={14} className="animate-spin" />
              : <Zap size={14} />}
            {idStock && quantiteNum > 0 ? `+1 session · -${quantiteNum.toFixed(1)} g` : '+1 session'}
          </button>
        </div>
      </div>
    </div>
  )
}
