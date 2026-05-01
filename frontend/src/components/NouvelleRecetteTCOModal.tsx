import { useState, useMemo } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { X, Loader2, Save, Plus, Trash2, GripVertical, Euro } from 'lucide-react'
import { recetteTCOAPI, RecetteTCO } from '../api/recetteTCO'
import { engraisAPI, ProduitEngrais } from '../api/engrais'

interface Props {
  editRecette?: RecetteTCO | null
  onClose: () => void
}

const TYPES_TCO   = ['Croissance', 'Stretch', 'Floraison', 'Correctif']
const UNITES_TCO  = ['L', 'mL']

const sel = "w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-grow-500"
const inp = "w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-grow-500"

function Label({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">
      {children}{required && <span className="text-red-400 ml-0.5">*</span>}
    </label>
  )
}

// ── Unité auto selon type produit ─────────────────────────────────────────────
function autoUniteLigne(typeProduit?: string): string {
  return typeProduit === 'Liquide' ? 'mL' : 'g'
}

// ── Calcul coût recette ───────────────────────────────────────────────────────
function calcCoutRecette(
  lignes: Array<{ quantite: number; unite?: string; id_produit: number }>,
  produits: ProduitEngrais[]
): number {
  return lignes.reduce((total, l) => {
    const p = produits.find(x => x.id_produit === l.id_produit)
    if (!p || !p.prix_achat || !p.volume_conditionnement) return total
    // Normalise en mL ou g selon l'unité
    const normalize = (val: number, unite?: string) => {
      if (unite === 'L')  return val * 1000
      if (unite === 'Kg') return val * 1000
      return val
    }
    const volBase   = normalize(p.volume_conditionnement, p.unite_volume)
    const qteNorm   = normalize(l.quantite, l.unite)
    if (!volBase) return total
    return total + (p.prix_achat / volBase) * qteNorm
  }, 0)
}

interface LigneForm {
  id_produit: number | ''
  quantite:   string
  unite:      string
  note_ligne: string
}

export default function NouvelleRecetteTCOModal({ editRecette, onClose }: Props) {
  const qc     = useQueryClient()
  const isEdit = !!editRecette

  const { data: produits = [] } = useQuery<ProduitEngrais[]>({
    queryKey: ['engrais'],
    queryFn:  async () => (await engraisAPI.getAll()).data,
  })

  const [form, setForm] = useState({
    nom_recette:  editRecette?.nom_recette  ?? '',
    type_tco:     editRecette?.type_tco     ?? 'Croissance',
    quantite_tco: editRecette?.quantite_tco != null ? String(editRecette.quantite_tco) : '',
    unite_tco:    editRecette?.unite_tco    ?? 'L',
    notes:        editRecette?.notes        ?? '',
  })

  const [lignes, setLignes] = useState<LigneForm[]>(
    editRecette?.lignes.map(l => ({
      id_produit: l.id_produit,
      quantite:   String(l.quantite),
      unite:      l.unite ?? autoUniteLigne(l.type_produit),
      note_ligne: l.note_ligne ?? '',
    })) ?? []
  )
  const [error, setError] = useState('')

  // Coût calculé
  const coutRecette = useMemo(() => {
    const valid = lignes.filter(l => l.id_produit !== '' && parseFloat(l.quantite) > 0)
    return calcCoutRecette(
      valid.map(l => ({ id_produit: l.id_produit as number, quantite: parseFloat(l.quantite), unite: l.unite })),
      produits
    )
  }, [lignes, produits])

  // ── Gestion lignes ──────────────────────────────────────────────────────────
  const addLigne = () => setLignes(prev => [...prev, { id_produit: '', quantite: '', unite: 'mL', note_ligne: '' }])

  const updateLigne = (i: number, field: keyof LigneForm, value: string | number) => {
    setLignes(prev => {
      const next = [...prev]
      if (field === 'id_produit' && typeof value === 'number') {
        const p = produits.find(x => x.id_produit === value)
        next[i] = { ...next[i], id_produit: value, unite: autoUniteLigne(p?.type_produit) }
      } else {
        next[i] = { ...next[i], [field]: value }
      }
      return next
    })
  }

  const removeLigne = (i: number) => setLignes(prev => prev.filter((_, idx) => idx !== i))

  // ── Unités disponibles par produit ─────────────────────────────────────────
  const unitesPour = (typeProduit?: string) =>
    typeProduit === 'Liquide' ? ['mL', 'L'] : ['g', 'Kg']

  // ── Sauvegarde ──────────────────────────────────────────────────────────────
  const save = useMutation({
    mutationFn: () => {
      if (!form.nom_recette.trim()) throw new Error('Le nom est obligatoire')
      const lignesValid = lignes.filter(l => l.id_produit !== '')
      const payload = {
        nom_recette:  form.nom_recette.trim(),
        type_tco:     form.type_tco     || undefined,
        quantite_tco: form.quantite_tco ? parseFloat(form.quantite_tco) : undefined,
        unite_tco:    form.unite_tco    || undefined,
        notes:        form.notes.trim() || undefined,
        lignes:       lignesValid.map((l, i) => ({
          id_produit: l.id_produit as number,
          quantite:   parseFloat(l.quantite) || 0,
          unite:      l.unite,
          note_ligne: l.note_ligne.trim() || undefined,
          ordre:      i,
        })),
      }
      return isEdit
        ? recetteTCOAPI.update(editRecette!.id_recette_tco, payload)
        : recetteTCOAPI.create(payload)
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['recettes-tco'] }); onClose() },
    onError:   (e: any) => setError(e?.message ?? e?.response?.data?.detail ?? 'Erreur'),
  })

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-3xl max-h-[94vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-700">
          <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">
            {isEdit ? 'Modifier la recette TCO' : 'Nouvelle recette TCO'}
          </h2>
          <button onClick={onClose} className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:text-gray-300"><X size={22} /></button>
        </div>

        {/* Corps */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

          {/* Nom */}
          <div>
            <Label required>Nom de la recette</Label>
            <input type="text" value={form.nom_recette}
              onChange={e => setForm(f => ({ ...f, nom_recette: e.target.value }))}
              placeholder="Ex: TCO Floraison — Semaine 4" className={inp} />
          </div>

          {/* Type TCO + Volume */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Type de TCO</Label>
              <select value={form.type_tco}
                onChange={e => setForm(f => ({ ...f, type_tco: e.target.value }))}
                className={sel}>
                <option value="">—</option>
                {TYPES_TCO.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <Label>Volume du TCO</Label>
              <div className="flex gap-2">
                <input type="number" step="any" min="0"
                  value={form.quantite_tco}
                  onChange={e => setForm(f => ({ ...f, quantite_tco: e.target.value }))}
                  placeholder="Ex: 10" className={inp} />
                <select value={form.unite_tco}
                  onChange={e => setForm(f => ({ ...f, unite_tco: e.target.value }))}
                  className="w-20 px-2 py-2 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-grow-500">
                  {UNITES_TCO.map(u => <option key={u} value={u}>{u}</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* Coût calculé */}
          <div className="bg-blue-50 rounded-lg px-4 py-2.5 flex items-center gap-2">
            <Euro size={15} className="text-blue-500" />
            <span className="text-xs text-blue-400 font-medium uppercase tracking-wide">Coût estimé de la recette</span>
            <span className="ml-auto text-lg font-bold text-blue-700">
              {coutRecette > 0 ? `${coutRecette.toFixed(2)} €` : '—'}
            </span>
          </div>

          {/* Ingrédients */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label>Ingrédients</Label>
              {produits.length === 0 && (
                <span className="text-xs text-amber-500">Aucun produit dans Sols &amp; Engrais</span>
              )}
            </div>

            {lignes.length === 0 && (
              <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-3 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-lg">
                Aucun ingrédient — cliquez sur "Ajouter" pour en ajouter
              </p>
            )}

            <div className="space-y-3">
              {lignes.map((l, i) => {
                const produit = produits.find(p => p.id_produit === l.id_produit)
                const unites  = unitesPour(produit?.type_produit)
                return (
                  <div key={i} className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <GripVertical size={14} className="text-gray-300 shrink-0" />

                      {/* Produit */}
                      <select
                        value={l.id_produit}
                        onChange={e => updateLigne(i, 'id_produit', parseInt(e.target.value))}
                        className="flex-1 px-2 py-1.5 border border-gray-200 dark:border-gray-700 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-grow-500 bg-white dark:bg-gray-800"
                      >
                        <option value="">— Choisir un produit —</option>
                        {produits.map(p => (
                          <option key={p.id_produit} value={p.id_produit}>
                            {p.nom_produit}{p.marque ? ` (${p.marque})` : ''}
                          </option>
                        ))}
                      </select>

                      {/* Quantité */}
                      <input
                        type="number" step="any" min="0"
                        value={l.quantite}
                        onChange={e => updateLigne(i, 'quantite', e.target.value)}
                        placeholder="0"
                        className="w-20 px-2 py-1.5 border border-gray-200 dark:border-gray-700 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-grow-500 text-right"
                      />

                      {/* Unité */}
                      <select
                        value={l.unite}
                        onChange={e => updateLigne(i, 'unite', e.target.value)}
                        className="w-20 px-2 py-1.5 border border-gray-200 dark:border-gray-700 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-grow-500 bg-white dark:bg-gray-800"
                      >
                        {(unites.includes(l.unite) ? unites : ['mL', 'L', 'g', 'Kg']).map(u =>
                          <option key={u} value={u}>{u}</option>
                        )}
                      </select>

                      <button onClick={() => removeLigne(i)}
                        className="text-red-400 hover:text-red-600 p-1 rounded shrink-0">
                        <Trash2 size={14} />
                      </button>
                    </div>

                    {/* Note de ligne */}
                    <input
                      type="text"
                      value={l.note_ligne}
                      onChange={e => updateLigne(i, 'note_ligne', e.target.value)}
                      placeholder="Note (ex: ajouter après 30 min de brassage)"
                      className="w-full px-2 py-1.5 border border-gray-200 dark:border-gray-700 rounded-md text-xs focus:outline-none focus:ring-2 focus:ring-grow-500 text-gray-500 dark:text-gray-400 dark:text-gray-500"
                    />
                  </div>
                )
              })}
            </div>

            <button onClick={addLigne}
              className="mt-2 flex items-center gap-1.5 text-sm text-grow-600 hover:text-grow-800 font-medium">
              <Plus size={15} /> Ajouter un ingrédient
            </button>
          </div>

          {/* Notes */}
          <div>
            <Label>Notes générales</Label>
            <textarea rows={2} value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              placeholder="Protocole, durée de brassage, utilisation…"
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
          <button onClick={() => save.mutate()} disabled={save.isPending || !form.nom_recette.trim()}
            className="flex items-center gap-2 px-4 py-2 bg-grow-600 text-white text-sm rounded-lg hover:bg-grow-700 disabled:opacity-50">
            {save.isPending ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
            {isEdit ? 'Enregistrer' : 'Créer la recette'}
          </button>
        </div>
      </div>
    </div>
  )
}
