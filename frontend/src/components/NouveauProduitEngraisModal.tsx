import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { X, Loader2, Save } from 'lucide-react'
import { engraisAPI, ProduitEngrais } from '../api/engrais'
import { useParametreListe } from '../api/parametres'

interface Props {
  editProduit?: ProduitEngrais | null
  onClose: () => void
}

const TYPES_PRODUIT    = ['Liquide', 'Solide', 'Poudre', 'Granulés', 'Feuilles', 'Autre']
const CONDITIONNEMENTS = ['Bouteille', 'Pot', 'Sachet', 'Bidon', 'Tube', 'Boîte', 'Autre']

// Unités selon le type
function getUnites(type: string) {
  if (type === 'Liquide') return { volume: ['mL', 'L'], qte: ['mL', 'L'] }
  return { volume: ['g', 'Kg'], qte: ['g', 'Kg'] }
}

const today = () => new Date().toISOString().split('T')[0]

const sel  = "w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-grow-500"
const inp  = "w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-grow-500"

function Label({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">
      {children}{required && <span className="text-red-400 ml-0.5">*</span>}
    </label>
  )
}

export default function NouveauProduitEngraisModal({ editProduit, onClose }: Props) {
  const qc    = useQueryClient()
  const isEdit = !!editProduit

  const { values: marques } = useParametreListe('marques')

  const [form, setForm] = useState({
    nom_produit:            editProduit?.nom_produit            ?? '',
    marque:                 editProduit?.marque                 ?? '',
    type_produit:           editProduit?.type_produit           ?? 'Liquide',
    conditionnement:        editProduit?.conditionnement        ?? '',
    volume_conditionnement: editProduit?.volume_conditionnement != null ? String(editProduit.volume_conditionnement) : '',
    unite_volume:           editProduit?.unite_volume           ?? 'mL',
    prix_achat:             editProduit?.prix_achat             != null ? String(editProduit.prix_achat) : '',
    date_achat:             editProduit?.date_achat             ?? today(),
    date_peremption:        editProduit?.date_peremption        ?? '',
    quantite_stock:         editProduit?.quantite_stock         != null ? String(editProduit.quantite_stock) : '',
    unite_quantite:         editProduit?.unite_quantite         ?? 'mL',
    dosage_conseille:       editProduit?.dosage_conseille       ?? '',
    notes:                  editProduit?.notes                  ?? '',
  })

  const [error, setError] = useState('')
  const unites = getUnites(form.type_produit)

  const setType = (t: string) => {
    const u = getUnites(t)
    setForm(f => ({
      ...f,
      type_produit:   t,
      unite_volume:   u.volume[0],
      unite_quantite: u.qte[0],
    }))
  }

  const save = useMutation({
    mutationFn: () => {
      if (!form.nom_produit.trim()) throw new Error('Le nom est obligatoire')
      const payload = {
        nom_produit:            form.nom_produit.trim(),
        marque:                 form.marque.trim()            || undefined,
        type_produit:           form.type_produit             || undefined,
        conditionnement:        form.conditionnement.trim()   || undefined,
        volume_conditionnement: form.volume_conditionnement   ? parseFloat(form.volume_conditionnement) : undefined,
        unite_volume:           form.unite_volume             || undefined,
        prix_achat:             form.prix_achat               ? parseFloat(form.prix_achat) : undefined,
        date_achat:             form.date_achat               || undefined,
        date_peremption:        form.date_peremption          || undefined,
        quantite_stock:         form.quantite_stock           ? parseFloat(form.quantite_stock) : undefined,
        unite_quantite:         form.unite_quantite           || undefined,
        dosage_conseille:       form.dosage_conseille.trim()  || undefined,
        notes:                  form.notes.trim()             || undefined,
      }
      return isEdit
        ? engraisAPI.update(editProduit!.id_produit, payload)
        : engraisAPI.create(payload as Omit<ProduitEngrais, 'id_produit'>)
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['engrais'] }); onClose() },
    onError: (e: any) => setError(e?.message ?? e?.response?.data?.detail ?? 'Erreur'),
  })

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-2xl max-h-[92vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-700">
          <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">
            {isEdit ? 'Modifier le produit' : 'Ajouter un produit'}
          </h2>
          <button onClick={onClose} className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:text-gray-300"><X size={22} /></button>
        </div>

        {/* Corps */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

          {/* Nom + Marque */}
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2 lg:col-span-1">
              <Label required>Nom du produit</Label>
              <input type="text" value={form.nom_produit}
                onChange={e => setForm(f => ({ ...f, nom_produit: e.target.value }))}
                placeholder="Ex: Guano bio, pH Down…" className={inp} />
            </div>
            <div>
              <Label>Marque</Label>
              <select
                value={form.marque}
                onChange={e => setForm(f => ({ ...f, marque: e.target.value }))}
                className={sel}
              >
                <option value="">—</option>
                {marques.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
              {marques.length === 0 && (
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                  Ajoutez des marques depuis la page <span className="font-medium">Paramétrage</span>.
                </p>
              )}
            </div>
          </div>

          {/* Type + Conditionnement */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Type</Label>
              <select value={form.type_produit} onChange={e => setType(e.target.value)} className={sel}>
                {TYPES_PRODUIT.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <Label>Conditionnement</Label>
              <select value={form.conditionnement}
                onChange={e => setForm(f => ({ ...f, conditionnement: e.target.value }))}
                className={sel}>
                <option value="">—</option>
                {CONDITIONNEMENTS.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>

          {/* Volume conditionnement */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Volume du conditionnement</Label>
              <div className="flex gap-2">
                <input type="number" step="any" min="0"
                  value={form.volume_conditionnement}
                  onChange={e => setForm(f => ({ ...f, volume_conditionnement: e.target.value }))}
                  placeholder="Ex: 500" className={inp} />
                <select value={form.unite_volume}
                  onChange={e => setForm(f => ({ ...f, unite_volume: e.target.value }))}
                  className="w-20 px-2 py-2 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-grow-500">
                  {unites.volume.map(u => <option key={u} value={u}>{u}</option>)}
                </select>
              </div>
            </div>
            <div>
              <Label>Prix d'achat (€)</Label>
              <input type="number" step="0.01" min="0"
                value={form.prix_achat}
                onChange={e => setForm(f => ({ ...f, prix_achat: e.target.value }))}
                placeholder="0.00" className={inp} />
            </div>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-4">
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

          {/* Quantité en stock */}
          <div>
            <Label>Quantité en stock</Label>
            <div className="flex gap-2 max-w-xs">
              <input type="number" step="any" min="0"
                value={form.quantite_stock}
                onChange={e => setForm(f => ({ ...f, quantite_stock: e.target.value }))}
                placeholder="Ex: 250" className={inp} />
              <select value={form.unite_quantite}
                onChange={e => setForm(f => ({ ...f, unite_quantite: e.target.value }))}
                className="w-20 px-2 py-2 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-grow-500">
                {unites.qte.map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
          </div>

          {/* Dosage conseillé */}
          <div>
            <Label>Dosage conseillé</Label>
            <input type="text" value={form.dosage_conseille}
              onChange={e => setForm(f => ({ ...f, dosage_conseille: e.target.value }))}
              placeholder="Ex: 2 mL/L en vég, 4 mL/L en floraison…" className={inp} />
          </div>

          {/* Notes */}
          <div>
            <Label>Notes</Label>
            <textarea rows={2} value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              placeholder="Informations complémentaires…"
              className={inp + ' resize-none'} />
          </div>

          {error && <p className="text-xs text-red-500">{error}</p>}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 dark:border-gray-700 flex justify-end gap-3">
          <button onClick={onClose}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 text-sm rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/40">
            Annuler
          </button>
          <button onClick={() => save.mutate()} disabled={save.isPending || !form.nom_produit.trim()}
            className="flex items-center gap-2 px-4 py-2 bg-grow-600 text-white text-sm rounded-lg hover:bg-grow-700 disabled:opacity-50">
            {save.isPending ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
            {isEdit ? 'Enregistrer' : 'Ajouter'}
          </button>
        </div>
      </div>
    </div>
  )
}
