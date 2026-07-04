import { useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Wind, Plus, Trash2, Loader2, AlertTriangle,
  TrendingDown, BarChart2, Clock, Package,
  Leaf, Hash, Droplets, Calendar,
} from 'lucide-react'
import { consommationAPI } from '../api/consommation'
import type { SessionConsommation, SessionConsommationCreate } from '../api/consommation'
import { vaporisateurAPI } from '../api/vaporisateur'
import { stockAPI } from '../api/stock'
import type { Stock } from '../api/stock'
import LoadingSpinner from '../components/LoadingSpinner'

// ── Helpers ───────────────────────────────────────────────────────────────────
const TYPE_LABELS: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  fleur: { label: 'Fleur',  color: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',  icon: Leaf },
  hash:  { label: 'Hash',   color: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',  icon: Hash },
  rosin: { label: 'Rosin',  color: 'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300', icon: Droplets },
}

function fmtDateHeure(s: string) {
  const d = new Date(s)
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
    + ' ' + d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}

function StatCard({ label, value, sub, color = 'gray', icon: Icon }: {
  label: string; value: string; sub?: string; color?: string; icon?: React.ElementType
}) {
  const bg: Record<string, string> = {
    grow:   'bg-grow-50 dark:bg-grow-900/20',
    green:  'bg-green-50 dark:bg-green-900/20',
    amber:  'bg-amber-50 dark:bg-amber-900/20',
    orange: 'bg-orange-50 dark:bg-orange-900/20',
    blue:   'bg-blue-50 dark:bg-blue-900/20',
    gray:   'bg-gray-50 dark:bg-gray-700/50',
  }
  const txt: Record<string, string> = {
    grow:   'text-grow-700 dark:text-grow-400',
    green:  'text-green-700 dark:text-green-400',
    amber:  'text-amber-700 dark:text-amber-400',
    orange: 'text-orange-700 dark:text-orange-400',
    blue:   'text-blue-700 dark:text-blue-400',
    gray:   'text-gray-700 dark:text-gray-200',
  }
  const lbl: Record<string, string> = {
    grow:   'text-grow-500',
    green:  'text-green-500',
    amber:  'text-amber-500',
    orange: 'text-orange-500',
    blue:   'text-blue-500',
    gray:   'text-gray-500 dark:text-gray-400',
  }
  return (
    <div className={`${bg[color] ?? bg.gray} rounded-xl p-4`}>
      {Icon && (
        <div className={`flex items-center gap-1.5 mb-1 ${lbl[color] ?? lbl.gray}`}>
          <Icon size={13} />
          <span className="text-xs font-semibold uppercase tracking-wide">{label}</span>
        </div>
      )}
      <p className={`text-2xl font-bold ${txt[color] ?? txt.gray}`}>{value}</p>
      {sub && <p className={`text-xs mt-0.5 ${lbl[color] ?? lbl.gray}`}>{sub}</p>}
    </div>
  )
}

// ── Modal ajout session ───────────────────────────────────────────────────────
function NouvelleSessionModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState<SessionConsommationCreate>({
    type_produit: 'fleur',
    quantite_g: 0.1,
  })

  const { data: vapos = [] } = useQuery({
    queryKey: ['vaporisateurs'],
    queryFn: () => vaporisateurAPI.getAll().then(r => r.data),
  })

  const { data: allStocks = [] } = useQuery({
    queryKey: ['stocks'],
    queryFn: () => stockAPI.getAll().then(r => r.data),
  })

  // Stocks filtrés selon le type de produit choisi
  const stocksFiltres = useMemo(() => {
    const typeMap: Record<string, string[]> = {
      fleur: ['fleur', 'Fleur'],
      hash:  ['hash',  'Hash'],
      rosin: ['rosin', 'Rosin'],
    }
    const types = typeMap[form.type_produit] ?? [form.type_produit]
    return (allStocks as Stock[]).filter(
      s => types.some(t => (s.type_stock ?? '').toLowerCase() === t.toLowerCase())
        && !s.date_fin_stock
        && s.quantite_stock > 0
    )
  }, [allStocks, form.type_produit])

  const create = useMutation({
    mutationFn: () => consommationAPI.create(form),
    onSuccess: () => { onCreated(); onClose() },
  })

  const vapoSelectionne = vapos.find(v => v.id_vaporisateur === form.id_vaporisateur)

  const set = (k: keyof SessionConsommationCreate, v: unknown) =>
    setForm(f => ({ ...f, [k]: v }))

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <Wind size={18} className="text-grow-600" />
            <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">Nouvelle session</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-xl leading-none">&times;</button>
        </div>

        <div className="px-6 py-5 space-y-4">
          {/* Type de produit */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Type de produit</label>
            <div className="flex gap-2">
              {(['fleur', 'hash', 'rosin'] as const).map(t => {
                const { label, icon: Icon } = TYPE_LABELS[t]
                const active = form.type_produit === t
                return (
                  <button
                    key={t}
                    onClick={() => { set('type_produit', t); set('id_stock', undefined) }}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${
                      active
                        ? 'bg-grow-600 text-white border-grow-600'
                        : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/40'
                    }`}
                  >
                    <Icon size={14} />
                    {label}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Stock */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Stock utilisé <span className="text-gray-400 text-xs">(optionnel)</span>
            </label>
            <select
              value={form.id_stock ?? ''}
              onChange={e => set('id_stock', e.target.value ? Number(e.target.value) : undefined)}
              className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-grow-500"
            >
              <option value="">— Sans stock spécifique —</option>
              {stocksFiltres.map(s => (
                <option key={s.id_stock} value={s.id_stock}>
                  {s.variete_nom ?? '?'} — {Number(s.quantite_stock).toFixed(1)} g
                </option>
              ))}
            </select>
            {stocksFiltres.length === 0 && (
              <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">Aucun stock disponible pour ce type.</p>
            )}
          </div>

          {/* Quantité */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Quantité consommée (g)</label>
            <input
              type="number"
              min={0.01}
              step={0.01}
              value={form.quantite_g}
              onChange={e => set('quantite_g', parseFloat(e.target.value) || 0)}
              className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-grow-500"
            />
          </div>

          {/* Vaporisateur */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Vaporisateur <span className="text-gray-400 text-xs">(optionnel)</span>
            </label>
            <select
              value={form.id_vaporisateur ?? ''}
              onChange={e => {
                set('id_vaporisateur', e.target.value ? Number(e.target.value) : undefined)
                set('options_vapo', undefined)
              }}
              className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-grow-500"
            >
              <option value="">— Sans vapo —</option>
              {vapos.map(v => (
                <option key={v.id_vaporisateur} value={v.id_vaporisateur}>
                  {v.nom || `${v.marque ?? ''} ${v.modele ?? ''}`.trim()}
                </option>
              ))}
            </select>
          </div>

          {/* Options vapo */}
          {vapoSelectionne && (
            <div className="border border-gray-200 dark:border-gray-700 rounded-xl p-4 space-y-3 bg-gray-50 dark:bg-gray-700/30">
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Options — {vapoSelectionne.nom}</p>
              {/* Température */}
              {vapoSelectionne.temp_min != null && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Température (°C) {vapoSelectionne.temp_min}–{vapoSelectionne.temp_max}°C
                  </label>
                  <input
                    type="number"
                    min={vapoSelectionne.temp_min ?? 100}
                    max={vapoSelectionne.temp_max ?? 250}
                    value={(form.options_vapo?.temp_c as number) ?? vapoSelectionne.temp_min ?? 185}
                    onChange={e => set('options_vapo', { ...(form.options_vapo ?? {}), temp_c: Number(e.target.value) })}
                    className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  />
                </div>
              )}
              {/* Nb sessions / taffs */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nb taffs / ballons</label>
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={(form.options_vapo?.nb_taffs as number) ?? 1}
                  onChange={e => set('options_vapo', { ...(form.options_vapo ?? {}), nb_taffs: Number(e.target.value) })}
                  className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                />
              </div>
              {/* Notes session */}
            </div>
          )}

          {/* Date/heure */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Date & heure <span className="text-gray-400 text-xs">(vide = maintenant)</span>
            </label>
            <input
              type="datetime-local"
              value={form.date_heure ? form.date_heure.slice(0, 16) : ''}
              onChange={e => set('date_heure', e.target.value ? e.target.value + ':00' : undefined)}
              className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Notes</label>
            <textarea
              rows={2}
              value={form.notes ?? ''}
              onChange={e => set('notes', e.target.value || undefined)}
              placeholder="Effets, contexte…"
              className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 resize-none"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 dark:border-gray-700 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/40"
          >
            Annuler
          </button>
          <button
            onClick={() => create.mutate()}
            disabled={create.isPending || form.quantite_g <= 0}
            className="px-5 py-2 text-sm bg-grow-600 text-white rounded-lg hover:bg-grow-700 disabled:opacity-50 flex items-center gap-2"
          >
            {create.isPending && <Loader2 size={14} className="animate-spin" />}
            Enregistrer
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Ligne session ─────────────────────────────────────────────────────────────
function SessionRow({ s, onDeleted }: { s: SessionConsommation; onDeleted: () => void }) {
  const [confirm, setConfirm] = useState(false)
  const del = useMutation({
    mutationFn: () => consommationAPI.delete(s.id_session),
    onSuccess: onDeleted,
  })

  const { label, color, icon: Icon } = TYPE_LABELS[s.type_produit] ?? TYPE_LABELS.fleur

  if (confirm) {
    return (
      <tr className="bg-red-50 dark:bg-red-900/20">
        <td colSpan={5} className="px-4 py-2 text-sm text-red-700 dark:text-red-300">
          <span className="flex items-center gap-2"><AlertTriangle size={14} /> Supprimer cette session ?</span>
        </td>
        <td className="px-4 py-2 text-right">
          <div className="flex justify-end gap-2">
            <button
              onClick={() => del.mutate()}
              disabled={del.isPending}
              className="px-3 py-1 bg-red-600 text-white text-xs rounded hover:bg-red-700 disabled:opacity-50"
            >
              {del.isPending ? <Loader2 size={12} className="animate-spin" /> : 'Oui'}
            </button>
            <button
              onClick={() => setConfirm(false)}
              className="px-3 py-1 border border-gray-300 dark:border-gray-600 text-xs rounded"
            >
              Non
            </button>
          </div>
        </td>
      </tr>
    )
  }

  return (
    <tr className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
      <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">
        {fmtDateHeure(s.date_heure)}
      </td>
      <td className="px-4 py-3">
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${color}`}>
          <Icon size={11} />
          {label}
        </span>
      </td>
      <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">
        {s.nom_variete ?? <span className="text-gray-400">—</span>}
      </td>
      <td className="px-4 py-3 text-sm font-semibold text-grow-700 dark:text-grow-400">
        {s.quantite_g.toFixed(2)} g
      </td>
      <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
        {s.nom_vaporisateur ?? <span className="italic text-gray-300 dark:text-gray-600">—</span>}
      </td>
      <td className="px-4 py-3 text-right">
        <button
          onClick={() => setConfirm(true)}
          className="text-gray-300 hover:text-red-500 dark:text-gray-600 dark:hover:text-red-400"
        >
          <Trash2 size={14} />
        </button>
      </td>
    </tr>
  )
}

// ── Bar chart simple 7 jours ──────────────────────────────────────────────────
function MiniBar7j({ data }: { data: { date: string; total_g: number }[] }) {
  const max = Math.max(...data.map(d => d.total_g), 0.1)
  return (
    <div className="flex items-end gap-1 h-16">
      {data.map(d => {
        const pct = (d.total_g / max) * 100
        const short = d.date.slice(5) // MM-DD
        return (
          <div key={d.date} className="flex flex-col items-center flex-1 gap-0.5">
            <div
              className="w-full bg-grow-400 dark:bg-grow-600 rounded-t transition-all"
              style={{ height: `${Math.max(pct, 2)}%` }}
              title={`${d.date} : ${d.total_g.toFixed(2)} g`}
            />
            <span className="text-[9px] text-gray-400 dark:text-gray-500">{short}</span>
          </div>
        )
      })}
    </div>
  )
}

// ── Page principale ───────────────────────────────────────────────────────────
export default function Consommation() {
  const qc = useQueryClient()
  const [showModal, setShowModal] = useState(false)

  const { data: sessions = [], isLoading: loadingSessions } = useQuery({
    queryKey: ['consommation'],
    queryFn: () => consommationAPI.getAll(200),
  })

  const { data: stats, isLoading: loadingStats } = useQuery({
    queryKey: ['consommation-stats'],
    queryFn: () => consommationAPI.getStats(),
  })

  const refetch = () => {
    qc.invalidateQueries({ queryKey: ['consommation'] })
    qc.invalidateQueries({ queryKey: ['consommation-stats'] })
  }

  if (loadingSessions || loadingStats) return <LoadingSpinner />

  const totalStock = stats ? Object.values(stats.stock_dispo_g).reduce((a, b) => a + b, 0) : 0

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-grow-50 dark:bg-grow-900/30 rounded-xl">
            <Wind size={22} className="text-grow-600 dark:text-grow-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Consommation</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">{sessions.length} sessions enregistrées</p>
          </div>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-grow-600 text-white rounded-xl text-sm font-medium hover:bg-grow-700 transition-colors"
        >
          <Plus size={16} />
          Nouvelle session
        </button>
      </div>

      <div className="p-6 space-y-6 max-w-6xl mx-auto">

        {/* Stats périodes */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard label="Aujourd'hui" value={`${stats.periodes.jour.toFixed(2)} g`} color="grow" icon={Clock} />
            <StatCard label="Cette semaine" value={`${stats.periodes.semaine.toFixed(2)} g`} color="blue" icon={Calendar} />
            <StatCard label="Ce mois" value={`${stats.periodes.mois.toFixed(2)} g`} color="amber" icon={BarChart2} />
            <StatCard label="Cette année" value={`${stats.periodes.annee.toFixed(2)} g`} color="gray" icon={TrendingDown} />
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Graphique 7 jours */}
          {stats && stats.last7.length > 0 && (
            <div className="md:col-span-2 bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5">
              <div className="flex items-center gap-2 mb-4">
                <BarChart2 size={16} className="text-grow-600" />
                <h3 className="font-semibold text-gray-900 dark:text-gray-100 text-sm">7 derniers jours</h3>
                <span className="ml-auto text-xs text-gray-400">moy. {stats.avg_7j_g.toFixed(2)} g/j</span>
              </div>
              <MiniBar7j data={stats.last7} />
            </div>
          )}

          {/* Projection stock */}
          {stats && (
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 space-y-3">
              <div className="flex items-center gap-2 mb-2">
                <Package size={16} className="text-grow-600" />
                <h3 className="font-semibold text-gray-900 dark:text-gray-100 text-sm">Stock dispo</h3>
              </div>
              {(['fleur', 'hash', 'rosin'] as const).map(t => {
                const g = stats.stock_dispo_g[t] ?? 0
                const { label, icon: Icon, color } = TYPE_LABELS[t]
                return (
                  <div key={t} className="flex items-center justify-between">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${color}`}>
                      <Icon size={10} />{label}
                    </span>
                    <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">{g.toFixed(1)} g</span>
                  </div>
                )
              })}
              <div className="border-t border-gray-100 dark:border-gray-700 pt-2 flex items-center justify-between">
                <span className="text-xs text-gray-500 dark:text-gray-400">Total</span>
                <span className="text-sm font-bold text-gray-900 dark:text-gray-100">{totalStock.toFixed(1)} g</span>
              </div>
              {stats.jours_restants != null && (
                <div className="text-center py-2 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
                  <p className="text-xs text-amber-600 dark:text-amber-400">À ce rythme</p>
                  <p className="text-lg font-bold text-amber-700 dark:text-amber-300">~{stats.jours_restants} jours</p>
                  <p className="text-xs text-amber-500 dark:text-amber-500">de stock restant</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Par type & par vapo */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5">
              <h3 className="font-semibold text-gray-900 dark:text-gray-100 text-sm mb-3">Par type de produit</h3>
              <div className="space-y-2">
                {Object.entries(stats.by_type).map(([t, g]) => {
                  const info = TYPE_LABELS[t] ?? { label: t, color: 'bg-gray-100 text-gray-700', icon: Wind }
                  const Icon = info.icon
                  return (
                    <div key={t} className="flex items-center justify-between">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${info.color}`}>
                        <Icon size={10} />{info.label}
                      </span>
                      <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">{(g as number).toFixed(2)} g</span>
                    </div>
                  )
                })}
                {Object.keys(stats.by_type).length === 0 && (
                  <p className="text-sm text-gray-400 dark:text-gray-500 italic">Aucune donnée</p>
                )}
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5">
              <h3 className="font-semibold text-gray-900 dark:text-gray-100 text-sm mb-3">Par vaporisateur</h3>
              <div className="space-y-2">
                {stats.by_vapo.map((v, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <span className="text-sm text-gray-700 dark:text-gray-300 truncate max-w-[60%]">{v.nom}</span>
                    <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">{v.total_g.toFixed(2)} g</span>
                  </div>
                ))}
                {stats.by_vapo.length === 0 && (
                  <p className="text-sm text-gray-400 dark:text-gray-500 italic">Aucune donnée</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Tableau sessions */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700 flex items-center gap-2">
            <Wind size={16} className="text-grow-600" />
            <h2 className="font-bold text-gray-900 dark:text-gray-100">Historique des sessions</h2>
            <span className="ml-auto text-xs text-gray-400 dark:text-gray-500">{sessions.length} entrées</span>
          </div>
          {sessions.length === 0 ? (
            <div className="py-16 text-center">
              <Wind size={40} className="mx-auto text-gray-300 dark:text-gray-600 mb-3" />
              <p className="text-gray-400 dark:text-gray-500">Aucune session enregistrée</p>
              <p className="text-sm text-gray-300 dark:text-gray-600 mt-1">Clique sur "Nouvelle session" pour commencer.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="text-xs uppercase tracking-wide text-gray-400 dark:text-gray-500 bg-gray-50 dark:bg-gray-900/40">
                  <tr>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Type</th>
                    <th className="px-4 py-3">Variété</th>
                    <th className="px-4 py-3">Quantité</th>
                    <th className="px-4 py-3">Vapo</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {sessions.map(s => (
                    <SessionRow key={s.id_session} s={s} onDeleted={refetch} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {showModal && (
        <NouvelleSessionModal
          onClose={() => setShowModal(false)}
          onCreated={refetch}
        />
      )}
    </div>
  )
}
