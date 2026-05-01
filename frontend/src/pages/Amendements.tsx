import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Plus, Search, Pencil, Trash2, Loader2, AlertTriangle,
  ArrowDownUp, AlertCircle, Beaker, PackagePlus,
} from 'lucide-react'
import { engraisAPI, ProduitEngrais } from '../api/engrais'
import LoadingSpinner from '../components/LoadingSpinner'
import EmptyState from '../components/EmptyState'
import NouveauProduitEngraisModal from '../components/NouveauProduitEngraisModal'
import GestionStockEngraisModal from '../components/GestionStockEngraisModal'
import ImportExportModal from '../components/ImportExportModal'

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtDate(d?: string) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('fr-FR')
}

/** Convertit une valeur vers l'unité de base (mL pour liquides, g pour solides) */
function toBase(value: number, unit?: string): number {
  if (unit === 'L')  return value * 1000
  if (unit === 'Kg') return value * 1000
  return value // mL ou g déjà en base
}

/** Prix résiduel proportionnel au stock restant */
function prixResiduel(item: ProduitEngrais): number | null {
  if (item.prix_achat == null || item.volume_conditionnement == null || item.quantite_stock == null) return null
  const condBase  = toBase(item.volume_conditionnement, item.unite_volume)
  const stockBase = toBase(item.quantite_stock,         item.unite_quantite)
  if (condBase === 0) return null
  return item.prix_achat * (stockBase / condBase)
}

function isExpired(d?: string) {
  if (!d) return false
  return new Date(d) < new Date()
}

function isSoonExpired(d?: string) {
  if (!d) return false
  const diff = (new Date(d).getTime() - Date.now()) / 86_400_000
  return diff >= 0 && diff <= 60
}

/** Vrai si le stock est exactement à 0 (valeur déclarée ou calculée) */
function isStockZero(item: ProduitEngrais): boolean {
  return item.quantite_stock != null && Number(item.quantite_stock) === 0
}

/** Vrai si le stock restant est inférieur à 10 % du conditionnement de base */
function isLowStock(item: ProduitEngrais): boolean {
  if (isStockZero(item)) return false  // stock vide géré séparément
  if (item.quantite_stock == null || item.volume_conditionnement == null) return false
  const condBase  = toBase(item.volume_conditionnement, item.unite_volume)
  const stockBase = toBase(item.quantite_stock,         item.unite_quantite)
  if (condBase === 0) return false
  return stockBase < condBase * 0.1
}

// ── Badges type ───────────────────────────────────────────────────────────────
const TYPE_COLORS: Record<string, string> = {
  Liquide:   'bg-blue-100 text-blue-700',
  Solide:    'bg-stone-100 text-stone-700',
  Poudre:    'bg-yellow-100 text-yellow-700',
  Granulés:  'bg-amber-100 text-amber-700',
  Feuilles:  'bg-green-100 text-green-700',
  Autre:     'bg-gray-100 text-gray-600 dark:text-gray-300',
}
function TypeBadge({ type }: { type?: string }) {
  const label = type || 'Autre'
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${TYPE_COLORS[label] ?? TYPE_COLORS.Autre}`}>
      {label}
    </span>
  )
}

// ── Ligne ─────────────────────────────────────────────────────────────────────
function ProduitRow({
  item, onEdit, onDeleted, onGestionStock,
}: { item: ProduitEngrais; onEdit: () => void; onDeleted: () => void; onGestionStock: () => void }) {
  const [confirm, setConfirm] = useState(false)
  const remove = useMutation({
    mutationFn: () => engraisAPI.delete(item.id_produit),
    onSuccess: onDeleted,
    onError: () => setConfirm(false),
  })

  const expired     = isExpired(item.date_peremption)
  const soonExpired = !expired && isSoonExpired(item.date_peremption)
  const lowStock    = isLowStock(item)
  const stockZero   = isStockZero(item)

  if (confirm) {
    return (
      <tr className="bg-red-50">
        <td colSpan={9} className="px-4 py-2 text-sm text-red-700">
          <span className="flex items-center gap-2">
            <AlertTriangle size={14} />
            Supprimer <strong>{item.nom_produit}</strong> ?
          </span>
        </td>
        <td className="px-4 py-2 text-right">
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

  const rowClass = stockZero
    ? 'group bg-gray-50 dark:bg-gray-700/50 opacity-60 hover:opacity-100 hover:bg-gray-100 dark:hover:bg-gray-700'
    : lowStock
      ? 'group bg-amber-50 hover:bg-amber-100'
      : 'group hover:bg-gray-50 dark:hover:bg-gray-700/40'

  return (
    <tr className={rowClass}>
      {/* Nom + marque */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <div>
            <p className={`text-sm font-medium ${stockZero ? 'text-gray-500 dark:text-gray-400 dark:text-gray-500' : 'text-gray-900 dark:text-gray-100'}`}>
              {item.nom_produit}
            </p>
            {item.marque && <p className="text-xs text-gray-400 dark:text-gray-500">{item.marque}</p>}
          </div>
          {stockZero && (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-red-100 text-red-600 shrink-0">
              VIDE
            </span>
          )}
        </div>
      </td>
      {/* Type */}
      <td className="px-4 py-3"><TypeBadge type={item.type_produit} /></td>
      {/* Conditionnement */}
      <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500">
        {item.conditionnement
          ? <>{item.conditionnement}{item.volume_conditionnement ? ` · ${item.volume_conditionnement} ${item.unite_volume ?? ''}` : ''}</>
          : '—'
        }
      </td>
      {/* Stock */}
      <td className="px-4 py-3 text-sm font-semibold">
        {item.quantite_stock != null
          ? <span className={stockZero ? 'text-red-500' : 'text-grow-700'}>
              {item.quantite_stock} {item.unite_quantite ?? ''}
            </span>
          : <span className="text-gray-400 dark:text-gray-500">—</span>
        }
      </td>
      {/* Prix */}
      <td className="px-4 py-3 text-sm">
        {(() => {
          const residuel = prixResiduel(item)
          if (residuel == null) {
            return <span className="text-gray-400 dark:text-gray-500">—</span>
          }
          const condRef = item.volume_conditionnement != null
            ? `${item.volume_conditionnement} ${item.unite_volume ?? ''}`
            : null
          return (
            <div>
              <span className="font-semibold text-gray-800 dark:text-gray-100">{residuel.toFixed(2)} €</span>
              {condRef && (
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                  {Number(item.prix_achat).toFixed(2)} € / {condRef}
                </p>
              )}
            </div>
          )
        })()}
      </td>
      {/* Date achat */}
      <td className="px-4 py-3 text-sm text-gray-400 dark:text-gray-500">{fmtDate(item.date_achat)}</td>
      {/* Date péremption */}
      <td className="px-4 py-3 text-sm whitespace-nowrap">
        {item.date_peremption ? (
          <span className={`inline-flex items-center gap-1 ${expired ? 'text-red-600 font-semibold' : soonExpired ? 'text-amber-600' : 'text-gray-400 dark:text-gray-500'}`}>
            {(expired || soonExpired) && <AlertCircle size={13} />}
            {fmtDate(item.date_peremption)}
          </span>
        ) : '—'}
      </td>
      {/* Dosage */}
      <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500 max-w-[160px] truncate" title={item.dosage_conseille ?? ''}>
        {item.dosage_conseille || '—'}
      </td>
      {/* Actions */}
      <td className="px-4 py-3 text-right">
        <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {/* Recharger — toujours visible au hover */}
          <button onClick={onGestionStock}
            className="p-1.5 text-gray-400 dark:text-gray-500 hover:text-grow-600 hover:bg-grow-50 rounded" title="Gérer le stock">
            <PackagePlus size={14} />
          </button>
          <button onClick={onEdit}
            className="p-1.5 text-gray-400 dark:text-gray-500 hover:text-grow-600 hover:bg-grow-50 rounded" title="Modifier">
            <Pencil size={14} />
          </button>
          <button onClick={() => setConfirm(true)}
            className="p-1.5 text-gray-400 dark:text-gray-500 hover:text-red-600 hover:bg-red-50 rounded" title="Supprimer">
            <Trash2 size={14} />
          </button>
        </div>
      </td>
    </tr>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function SolsEngraisPage() {
  const qc = useQueryClient()
  const [search,           setSearch]           = useState('')
  const [typeFilter,       setTypeFilter]       = useState('')
  const [showModal,        setShowModal]        = useState(false)
  const [editProduit,      setEditProduit]      = useState<ProduitEngrais | null>(null)
  const [gestionStockProd, setGestionStockProd] = useState<ProduitEngrais | null>(null)
  const [showImportExport, setShowImportExport] = useState(false)

  const { data: produits = [], isLoading } = useQuery<ProduitEngrais[]>({
    queryKey: ['engrais'],
    queryFn: async () => (await engraisAPI.getAll()).data,
  })

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return produits.filter(p => {
      const matchSearch = p.nom_produit.toLowerCase().includes(q)
        || (p.marque ?? '').toLowerCase().includes(q)
        || (p.dosage_conseille ?? '').toLowerCase().includes(q)
      const matchType = !typeFilter || p.type_produit === typeFilter
      return matchSearch && matchType
    })
  }, [produits, search, typeFilter])

  const stats = useMemo(() => {
    const nbTotal    = produits.length
    const nbPerimes  = produits.filter(p => isExpired(p.date_peremption)).length
    const nbBientot  = produits.filter(p => isSoonExpired(p.date_peremption)).length
    const nbLowStock = produits.filter(p => isLowStock(p)).length
    const nbVides    = produits.filter(p => isStockZero(p)).length
    // Valeur résiduelle : prix proportionnel au stock restant
    const valeur = produits.reduce((s, p) => s + (prixResiduel(p) ?? 0), 0)
    return { nbTotal, nbPerimes, nbBientot, nbLowStock, nbVides, valeur }
  }, [produits])

  const allTypes = [...new Set(produits.map(p => p.type_produit).filter(Boolean))] as string[]
  const invalidate = () => qc.invalidateQueries({ queryKey: ['engrais'] })

  if (isLoading) return <LoadingSpinner />

  return (
    <div className="space-y-6">

      {/* Modales */}
      {(showModal || editProduit) && (
        <NouveauProduitEngraisModal
          editProduit={editProduit}
          onClose={() => { setShowModal(false); setEditProduit(null) }}
        />
      )}
      {gestionStockProd && (
        <GestionStockEngraisModal
          produit={gestionStockProd}
          onClose={() => setGestionStockProd(null)}
        />
      )}
      {showImportExport && (
        <ImportExportModal
          onClose={() => setShowImportExport(false)}
          defaultTab="engrais"
        />
      )}

      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Sols & Engrais</h1>
        <div className="flex gap-2">
          <button onClick={() => setShowImportExport(true)}
            className="flex items-center gap-2 px-3 py-2 border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/40 text-sm">
            <ArrowDownUp size={15} /> Import / Export
          </button>
          <button onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-grow-600 text-white rounded-lg hover:bg-grow-700 text-sm font-medium">
            <Plus size={17} /> Ajouter un produit
          </button>
        </div>
      </div>

      {/* Stats */}
      {produits.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Produits',      value: String(stats.nbTotal),          color: 'grow',  },
            { label: 'Stock vide',    value: String(stats.nbVides),           color: stats.nbVides > 0 ? 'red' : 'gray', },
            { label: 'Périmés',       value: String(stats.nbPerimes),         color: stats.nbPerimes > 0 ? 'red' : 'gray', },
            { label: 'Valeur stock',  value: `${stats.valeur.toFixed(2)} €`,  color: 'amber', },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-4">
              <p className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500">{label}</p>
              <p className={`text-2xl font-bold text-${color}-600 mt-1`}>{value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Alertes péremption */}
      {stats.nbPerimes > 0 && (
        <div className="flex items-center gap-2 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
          <AlertCircle size={16} />
          {stats.nbPerimes} produit{stats.nbPerimes > 1 ? 's' : ''} périmé{stats.nbPerimes > 1 ? 's' : ''}
          {stats.nbBientot > 0 && ` · ${stats.nbBientot} expire${stats.nbBientot > 1 ? 'nt' : ''} dans moins de 60 jours`}
        </div>
      )}

      {/* Alerte stock faible */}
      {stats.nbLowStock > 0 && (
        <div className="flex items-center gap-2 px-4 py-3 bg-amber-50 border border-amber-300 rounded-xl text-sm text-amber-800">
          <AlertTriangle size={16} className="shrink-0 text-amber-500" />
          <span>
            <strong>Attention :</strong> {stats.nbLowStock} produit{stats.nbLowStock > 1 ? 's ont' : ' a'} un stock faible{' '}
            <span className="text-amber-600 font-medium">(&lt; 10 % du conditionnement)</span>
          </span>
        </div>
      )}

      {/* Filtres */}
      {produits.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 flex flex-wrap gap-3">
          <div className="flex-1 min-w-[200px] relative">
            <Search className="absolute left-3 top-2.5 text-gray-400 dark:text-gray-500" size={16} />
            <input type="text" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Nom, marque, dosage…"
              className="w-full pl-9 pr-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-grow-500" />
          </div>
          <div className="flex gap-2 flex-wrap">
            {allTypes.map(t => (
              <button key={t} onClick={() => setTypeFilter(typeFilter === t ? '' : t)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${typeFilter === t ? 'bg-grow-600 text-white border-grow-600' : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:border-grow-300'}`}>
                {t}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Tableau */}
      {filtered.length === 0 ? (
        <EmptyState icon={Beaker} title="Aucun produit"
          description='Cliquez sur "Ajouter un produit" pour commencer votre inventaire' />
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700">
                <tr>
                  {['Produit', 'Type', 'Conditionnement', 'Stock', 'Valeur stock', 'Date achat', 'Péremption', 'Dosage conseillé', ''].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 dark:text-gray-500 uppercase tracking-wide whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {filtered.map(p => (
                  <ProduitRow
                    key={p.id_produit}
                    item={p}
                    onEdit={() => setEditProduit(p)}
                    onDeleted={invalidate}
                    onGestionStock={() => setGestionStockProd(p)}
                  />
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-2 border-t border-gray-100 dark:border-gray-700 text-xs text-gray-400 dark:text-gray-500">
            {filtered.length} produit{filtered.length > 1 ? 's' : ''}
            {(search || typeFilter) ? ` sur ${produits.length}` : ''}
          </div>
        </div>
      )}
    </div>
  )
}
