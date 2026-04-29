/**
 * GestionStockEngraisModal
 * Permet de recharger le stock d'un produit (avec historique des achats)
 * et de déclarer manuellement le stock à 0.
 */
import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { X, Loader2, PackagePlus, History, AlertTriangle, Trash2 } from 'lucide-react'
import { engraisAPI, ProduitEngrais, AchatEngrais } from '../api/engrais'

interface Props {
  produit: ProduitEngrais
  onClose: () => void
}

const inp = "w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-grow-500"
const sel = "w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-grow-500"

function Label({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label className="block text-xs font-medium text-gray-600 mb-1">
      {children}{required && <span className="text-red-400 ml-0.5">*</span>}
    </label>
  )
}

function fmtDate(d?: string) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('fr-FR')
}

const today = () => new Date().toISOString().split('T')[0]

const UNITES_LIQUIDE = ['mL', 'L']
const UNITES_SOLIDE  = ['g', 'Kg']

function getUnites(type?: string) {
  return type === 'Liquide' ? UNITES_LIQUIDE : UNITES_SOLIDE
}

// ── Onglet Recharger ──────────────────────────────────────────────────────────
function TabRecharger({ produit, onDone }: { produit: ProduitEngrais; onDone: () => void }) {
  const qc = useQueryClient()
  const unites = getUnites(produit.type_produit)

  const [form, setForm] = useState({
    date_achat:      today(),
    volume_achat:    produit.volume_conditionnement != null ? String(produit.volume_conditionnement) : '',
    unite_volume:    produit.unite_volume ?? unites[0],
    prix_achat:      produit.prix_achat   != null ? String(produit.prix_achat) : '',
    date_peremption: '',
    conditionnement: produit.conditionnement ?? '',
    notes:           '',
  })
  const [error, setError] = useState('')

  const save = useMutation({
    mutationFn: () => {
      if (!form.volume_achat) throw new Error('Le volume est obligatoire')
      return engraisAPI.recharger(produit.id_produit, {
        date_achat:      form.date_achat      || undefined,
        volume_achat:    parseFloat(form.volume_achat),
        unite_volume:    form.unite_volume    || undefined,
        prix_achat:      form.prix_achat      ? parseFloat(form.prix_achat) : undefined,
        date_peremption: form.date_peremption || undefined,
        conditionnement: form.conditionnement || undefined,
        notes:           form.notes           || undefined,
      })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['engrais'] })
      qc.invalidateQueries({ queryKey: ['achats-engrais', produit.id_produit] })
      onDone()
    },
    onError: (e: any) => setError(e?.message ?? e?.response?.data?.detail ?? 'Erreur'),
  })

  const stockActuel = produit.quantite_stock ?? 0
  const nouveauStock = form.volume_achat
    ? stockActuel + parseFloat(form.volume_achat)
    : stockActuel

  return (
    <div className="space-y-4">

      {/* Info stock actuel */}
      <div className="flex items-center justify-between px-4 py-3 bg-gray-50 rounded-lg">
        <span className="text-sm text-gray-600">Stock actuel</span>
        <span className={`text-sm font-bold ${stockActuel === 0 ? 'text-red-600' : 'text-grow-700'}`}>
          {stockActuel} {produit.unite_quantite ?? ''}
        </span>
      </div>

      {/* Volume du nouveau contenant */}
      <div>
        <Label required>Volume du contenant acheté</Label>
        <div className="flex gap-2">
          <input type="number" step="any" min="0"
            value={form.volume_achat}
            onChange={e => setForm(f => ({ ...f, volume_achat: e.target.value }))}
            placeholder="Ex: 500" className={inp} />
          <select value={form.unite_volume}
            onChange={e => setForm(f => ({ ...f, unite_volume: e.target.value }))}
            className="w-20 px-2 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-grow-500">
            {unites.map(u => <option key={u} value={u}>{u}</option>)}
          </select>
        </div>
      </div>

      {/* Aperçu nouveau stock */}
      {form.volume_achat && (
        <div className="flex items-center justify-between px-4 py-3 bg-grow-50 border border-grow-200 rounded-lg">
          <span className="text-sm text-grow-700">Nouveau stock après recharge</span>
          <span className="text-sm font-bold text-grow-700">
            {nouveauStock.toFixed(nouveauStock % 1 === 0 ? 0 : 1)} {form.unite_volume}
          </span>
        </div>
      )}

      {/* Prix + conditionnement */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Prix d'achat (€)</Label>
          <input type="number" step="0.01" min="0"
            value={form.prix_achat}
            onChange={e => setForm(f => ({ ...f, prix_achat: e.target.value }))}
            placeholder="0.00" className={inp} />
        </div>
        <div>
          <Label>Conditionnement</Label>
          <select value={form.conditionnement}
            onChange={e => setForm(f => ({ ...f, conditionnement: e.target.value }))}
            className={sel}>
            <option value="">—</option>
            {['Bouteille', 'Pot', 'Sachet', 'Bidon', 'Tube', 'Boîte', 'Autre'].map(c =>
              <option key={c} value={c}>{c}</option>
            )}
          </select>
        </div>
      </div>

      {/* Dates */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Date d'achat</Label>
          <input type="date" value={form.date_achat}
            onChange={e => setForm(f => ({ ...f, date_achat: e.target.value }))}
            className={inp} />
        </div>
        <div>
          <Label>Date de péremption</Label>
          <input type="date" value={form.date_peremption}
            onChange={e => setForm(f => ({ ...f, date_peremption: e.target.value }))}
            className={inp} />
        </div>
      </div>

      {/* Notes */}
      <div>
        <Label>Notes</Label>
        <input type="text" value={form.notes}
          onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
          placeholder="Ex: Lot B24, acheté chez…" className={inp} />
      </div>

      {error && <p className="text-xs text-red-500">{error}</p>}

      <button
        onClick={() => save.mutate()}
        disabled={save.isPending || !form.volume_achat}
        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-grow-600 text-white text-sm rounded-lg hover:bg-grow-700 disabled:opacity-50 font-medium">
        {save.isPending ? <Loader2 size={15} className="animate-spin" /> : <PackagePlus size={15} />}
        Ajouter la recharge au stock
      </button>
    </div>
  )
}

// ── Onglet Historique ─────────────────────────────────────────────────────────
function TabHistorique({ produit }: { produit: ProduitEngrais }) {
  const { data: achats = [], isLoading } = useQuery<AchatEngrais[]>({
    queryKey: ['achats-engrais', produit.id_produit],
    queryFn: async () => (await engraisAPI.getAchats(produit.id_produit)).data,
  })

  if (isLoading) return (
    <div className="flex justify-center py-8">
      <Loader2 size={20} className="animate-spin text-gray-400" />
    </div>
  )

  if (achats.length === 0) return (
    <div className="text-center py-10 text-gray-400">
      <History size={32} className="mx-auto mb-2 opacity-40" />
      <p className="text-sm">Aucun achat enregistré</p>
      <p className="text-xs mt-1">Les recharges apparaîtront ici</p>
    </div>
  )

  return (
    <div className="space-y-2">
      {achats.map(a => (
        <div key={a.id_achat} className="flex items-start justify-between px-4 py-3 bg-gray-50 rounded-lg">
          <div className="space-y-0.5">
            <p className="text-sm font-medium text-gray-800">
              {a.volume_achat != null ? `${a.volume_achat} ${a.unite_volume ?? ''}` : '—'}
              {a.conditionnement ? <span className="text-gray-400 font-normal"> · {a.conditionnement}</span> : null}
            </p>
            <p className="text-xs text-gray-500">
              Acheté le {fmtDate(a.date_achat)}
              {a.date_peremption ? ` · Péremption : ${fmtDate(a.date_peremption)}` : ''}
            </p>
            {a.notes && <p className="text-xs text-gray-400 italic">{a.notes}</p>}
          </div>
          <div className="text-right shrink-0 ml-4">
            {a.prix_achat != null
              ? <p className="text-sm font-semibold text-gray-700">{Number(a.prix_achat).toFixed(2)} €</p>
              : <p className="text-sm text-gray-400">—</p>
            }
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Composant principal ───────────────────────────────────────────────────────
export default function GestionStockEngraisModal({ produit, onClose }: Props) {
  const qc = useQueryClient()
  const [tab, setTab] = useState<'recharger' | 'historique'>('recharger')
  const [confirmVider, setConfirmVider] = useState(false)

  const vider = useMutation({
    mutationFn: () => engraisAPI.viderStock(produit.id_produit),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['engrais'] })
      setConfirmVider(false)
      onClose()
    },
  })

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-base font-bold text-gray-900">Gestion du stock</h2>
            <p className="text-xs text-gray-500 mt-0.5">{produit.nom_produit}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-100 px-6">
          {([
            { key: 'recharger',  label: 'Recharger',  icon: PackagePlus },
            { key: 'historique', label: 'Historique',  icon: History },
          ] as const).map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                tab === key
                  ? 'border-grow-600 text-grow-700'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}>
              <Icon size={14} />
              {label}
            </button>
          ))}
        </div>

        {/* Corps */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {tab === 'recharger'
            ? <TabRecharger produit={produit} onDone={onClose} />
            : <TabHistorique produit={produit} />
          }
        </div>

        {/* Footer — Déclarer stock vide */}
        <div className="px-6 py-4 border-t border-gray-100">
          {confirmVider ? (
            <div className="flex items-center gap-3 p-3 bg-red-50 border border-red-200 rounded-lg">
              <AlertTriangle size={15} className="text-red-500 shrink-0" />
              <p className="text-xs text-red-700 flex-1">
                Confirmer la mise à zéro du stock de <strong>{produit.nom_produit}</strong> ?
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => vider.mutate()}
                  disabled={vider.isPending}
                  className="px-3 py-1 bg-red-600 text-white text-xs rounded hover:bg-red-700 disabled:opacity-50">
                  {vider.isPending ? <Loader2 size={12} className="animate-spin" /> : 'Confirmer'}
                </button>
                <button
                  onClick={() => setConfirmVider(false)}
                  className="px-3 py-1 border border-gray-300 text-gray-600 text-xs rounded hover:bg-gray-50">
                  Annuler
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setConfirmVider(true)}
              className="flex items-center gap-2 text-xs text-gray-400 hover:text-red-600 transition-colors">
              <Trash2 size={13} />
              Déclarer le stock vide
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
