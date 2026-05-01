import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { X, Loader2, Save, Plus } from 'lucide-react'
import { stockAPI, Stock, BocalDisponible } from '../api/stock'
import { varieteAPI, Variete } from '../api/varietes'
import { useParametreListe } from '../api/parametres'

interface NouveauStockModalProps {
  editStock?: Stock | null
  onClose: () => void
}

// Types qui n'ont pas de lampe/engrais
const NO_CULTURE_INFO = ['Hash', 'Rosin', 'WPFF']

// Fallbacks statiques si les paramètres ne sont pas encore chargés
const TYPES_STOCK_FB  = ['Fleur', 'Trim', 'WPFF', 'Hash', 'Rosin', 'Autre']
const SOUS_TYPES_FB   = ['Indoor', 'Outdoor']

const today = () => new Date().toISOString().split('T')[0]

export default function NouveauStockModal({ editStock, onClose }: NouveauStockModalProps) {
  const queryClient = useQueryClient()
  const { values: typesHash }       = useParametreListe('types_hash')
  const { values: typesStockParam } = useParametreListe('types_stock')
  const { values: sousTypesParam }  = useParametreListe('sous_types_stock')
  const { values: maillagesParam }  = useParametreListe('maillages_iceolator')
  const { values: typesRosinParam } = useParametreListe('types_rosin')
  const { values: lampesParam }     = useParametreListe('lampes_stock')
  const { values: engraisParam }    = useParametreListe('engrais')

  const TYPES_STOCK = typesStockParam.length > 0 ? typesStockParam : TYPES_STOCK_FB
  const SOUS_TYPES  = sousTypesParam.length  > 0 ? sousTypesParam  : SOUS_TYPES_FB
  const MAILLAGES   = maillagesParam.length  > 0 ? maillagesParam  : ['15µ', '25µ', '45µ', '73µ', '90µ', '160µ', '190µ', '220µ']
  const TYPES_ROSIN = typesRosinParam.length > 0 ? typesRosinParam : ['Flower Rosin', 'Hash Rosin']
  const LAMPES      = lampesParam.length     > 0 ? lampesParam     : ['LED Crescience 500W', 'Soleil']
  const ENGRAIS_OPTS = engraisParam.length   > 0 ? engraisParam    : ['LSO', 'Aptus', 'Autre']

  const { data: varietes = [] } = useQuery<Variete[]>({
    queryKey: ['varietes'],
    queryFn: async () => (await varieteAPI.getAll()).data,
  })

  const { data: bocauxDisponibles = [] } = useQuery<BocalDisponible[]>({
    queryKey: ['bocaux-disponibles', editStock?.id_stock],
    queryFn: async () =>
      (await stockAPI.getBocauxDisponibles(editStock?.id_stock)).data,
  })

  const [form, setForm] = useState({
    id_variete:        editStock?.id_variete        ?? (undefined as number | undefined),
    id_materiel_bocal: editStock?.id_materiel_bocal ?? (undefined as number | undefined),
    type_stock:        editStock?.type_stock        ?? 'Fleur',
    sous_type_stock:   editStock?.sous_type_stock   ?? 'Indoor',
    lampe_type:        editStock?.lampe_type        ?? '',
    engrais_type:      editStock?.engrais_type      ?? '',
    maillage:          editStock?.maillage          ?? '',
    type_hash:         editStock?.type_hash         ?? '',
    type_rosin:        editStock?.type_rosin        ?? '',
    quantite_stock:    editStock ? String(editStock.quantite_stock) : '',
    date_stock:        editStock?.date_stock        ?? today(),
  })

  const [saveAndNewMode, setSaveAndNewMode] = useState(false)

  const isEdit = !!editStock
  const isHash  = form.type_stock === 'Hash'
  const isRosin = form.type_stock === 'Rosin'
  const showCultureInfo = !NO_CULTURE_INFO.includes(form.type_stock)

  // Changer le type_stock réinitialise les champs spéciaux
  const setType = (t: string) =>
    setForm(f => ({
      ...f,
      type_stock: t,
      maillage:   '',
      type_hash:  '',
      type_rosin: '',
      // Garder sous_type/lampe/engrais seulement si pertinent
      sous_type_stock: NO_CULTURE_INFO.includes(t) ? '' : f.sous_type_stock,
      lampe_type:      NO_CULTURE_INFO.includes(t) ? '' : f.lampe_type,
      engrais_type:    NO_CULTURE_INFO.includes(t) ? '' : f.engrais_type,
    }))

  const save = useMutation({
    mutationFn: () => {
      const payload = {
        id_variete:        form.id_variete ?? null,
        id_bocal:          editStock?.id_bocal ?? null,
        id_materiel_bocal: form.id_materiel_bocal ?? null,
        type_stock:      form.type_stock,
        sous_type_stock: showCultureInfo ? (form.sous_type_stock || null) : null,
        lampe_type:      showCultureInfo ? (form.lampe_type || null) : null,
        engrais_type:    showCultureInfo ? (form.engrais_type || null) : null,
        maillage:        (isHash || isRosin) ? (form.maillage || null) : null,
        type_hash:       isHash  ? (form.type_hash || null) : null,
        type_rosin:      isRosin ? (form.type_rosin || null) : null,
        date_stock:      form.date_stock || null,
        quantite_stock:  parseFloat(form.quantite_stock) || 0,
        variete_nom:     undefined,
        bocal_taille:    undefined,
      }
      return isEdit
        ? stockAPI.update(editStock!.id_stock, payload)
        : stockAPI.create(payload)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stock'] })
      if (saveAndNewMode) {
        // Réinitialise le formulaire en gardant le type et les infos culture
        setForm(f => ({
          ...f,
          id_variete:        undefined,
          id_materiel_bocal: undefined,
          quantite_stock:    '',
          date_stock:        today(),
        }))
        setSaveAndNewMode(false)
      } else {
        onClose()
      }
    },
  })

  const canSave = form.quantite_stock !== '' && parseFloat(form.quantite_stock) > 0

  const sel = "w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-grow-600"

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-700 sticky top-0 bg-white dark:bg-gray-800 z-10">
          <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">
            {isEdit ? 'Modifier le stock' : 'Ajouter du stock'}
          </h2>
          <button onClick={onClose} className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:text-gray-300">
            <X size={22} />
          </button>
        </div>

        {/* Formulaire */}
        <div className="px-6 py-5 space-y-4">

          {/* Variété */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Variété</label>
            <select
              value={form.id_variete ?? ''}
              onChange={e => setForm(f => ({ ...f, id_variete: e.target.value ? Number(e.target.value) : undefined }))}
              className={sel}
            >
              <option value="">— Non renseignée —</option>
              {varietes.map(v => (
                <option key={v.id_variete} value={v.id_variete}>{v.nom_variete}</option>
              ))}
            </select>
          </div>

          {/* Type de stock */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
              Type <span className="text-red-500">*</span>
            </label>
            <select value={form.type_stock} onChange={e => setType(e.target.value)} className={sel}>
              {TYPES_STOCK.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>

          {/* ── Champs spécifiques Hash ── */}
          {isHash && (
            <div className="rounded-xl bg-amber-50 border border-amber-100 p-4 space-y-3">
              <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide">Spécifications Hash</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Maillage</label>
                  <select value={form.maillage} onChange={e => setForm(f => ({ ...f, maillage: e.target.value }))} className={sel}>
                    <option value="">— Non renseigné —</option>
                    {MAILLAGES.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Type de hash</label>
                  <select value={form.type_hash} onChange={e => setForm(f => ({ ...f, type_hash: e.target.value }))} className={sel}>
                    <option value="">— Non renseigné —</option>
                    {typesHash.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* ── Champs spécifiques Rosin ── */}
          {isRosin && (
            <div className="rounded-xl bg-orange-50 border border-orange-100 p-4 space-y-3">
              <p className="text-xs font-semibold text-orange-700 uppercase tracking-wide">Spécifications Rosin</p>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Type de rosin</label>
                <select value={form.type_rosin} onChange={e => setForm(f => ({ ...f, type_rosin: e.target.value }))} className={sel}>
                  <option value="">— Non renseigné —</option>
                  {TYPES_ROSIN.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Maillage du bag (µ)</label>
                <input
                  type="text"
                  placeholder="ex: 90µ"
                  value={form.maillage}
                  onChange={e => setForm(f => ({ ...f, maillage: e.target.value }))}
                  className={sel}
                />
              </div>
            </div>
          )}

          {/* ── Infos culture (Fleur, Trim, Autre) ── */}
          {showCultureInfo && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Sous-type</label>
                  <select value={form.sous_type_stock} onChange={e => setForm(f => ({ ...f, sous_type_stock: e.target.value }))} className={sel}>
                    <option value="">—</option>
                    {SOUS_TYPES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Lampe</label>
                  <select value={form.lampe_type} onChange={e => setForm(f => ({ ...f, lampe_type: e.target.value }))} className={sel}>
                    <option value="">—</option>
                    {LAMPES.map(l => <option key={l} value={l}>{l}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Engrais</label>
                <select value={form.engrais_type} onChange={e => setForm(f => ({ ...f, engrais_type: e.target.value }))} className={sel}>
                  <option value="">—</option>
                  {ENGRAIS_OPTS.map(e => <option key={e} value={e}>{e}</option>)}
                </select>
              </div>
            </>
          )}

          {/* Bocal de stockage */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
              🫙 Bocal de stockage
            </label>
            <select
              value={form.id_materiel_bocal ?? ''}
              onChange={e => setForm(f => ({
                ...f,
                id_materiel_bocal: e.target.value ? Number(e.target.value) : undefined,
              }))}
              className={sel}
            >
              <option value="">— Aucun bocal —</option>
              {/* Bocal déjà affecté (mode édition) affiché même s'il est "occupé" par ce stock */}
              {editStock?.id_materiel_bocal && !bocauxDisponibles.find(b => b.id_materiel === editStock.id_materiel_bocal) && (
                <option value={editStock.id_materiel_bocal}>
                  {editStock.bocal_nom ?? `Bocal #${editStock.id_materiel_bocal}`}
                </option>
              )}
              {bocauxDisponibles.map(b => (
                <option key={b.id_materiel} value={b.id_materiel}>{b.label}</option>
              ))}
            </select>
            {bocauxDisponibles.length === 0 && (
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                Aucun bocal disponible — ajoutez des bocaux dans Matériel
              </p>
            )}
          </div>

          {/* Quantité + Date */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                Quantité (g) <span className="text-red-500">*</span>
              </label>
              <input
                type="number" step="0.1" min="0"
                value={form.quantite_stock}
                onChange={e => setForm(f => ({ ...f, quantite_stock: e.target.value }))}
                placeholder="0.0"
                className={sel}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Date</label>
              <input
                type="date"
                value={form.date_stock}
                onChange={e => setForm(f => ({ ...f, date_stock: e.target.value }))}
                className={sel}
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 dark:border-gray-700 flex justify-end gap-3 sticky bottom-0 bg-white dark:bg-gray-800">
          <button onClick={onClose} className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 text-sm rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/40">
            Annuler
          </button>
          {!isEdit && (
            <button
              onClick={() => { setSaveAndNewMode(true); save.mutate() }}
              disabled={save.isPending || !canSave}
              className="flex items-center gap-2 px-4 py-2 border border-grow-500 text-grow-700 text-sm rounded-lg hover:bg-grow-50 disabled:opacity-50"
            >
              {save.isPending && saveAndNewMode ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}
              + Nouveau
            </button>
          )}
          <button
            onClick={() => { setSaveAndNewMode(false); save.mutate() }}
            disabled={save.isPending || !canSave}
            className="flex items-center gap-2 px-4 py-2 bg-grow-600 text-white text-sm rounded-lg hover:bg-grow-700 disabled:opacity-50"
          >
            {save.isPending && !saveAndNewMode ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
            {isEdit ? 'Enregistrer' : 'Ajouter'}
          </button>
        </div>
      </div>
    </div>
  )
}
