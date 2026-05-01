import { useState, useMemo } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { X, Loader2, Save, Plus, Trash2, GripVertical, Euro } from 'lucide-react'
import { recetteEngraisAPI, RecetteEngrais } from '../api/recetteEngrais'
import { engraisAPI, ProduitEngrais } from '../api/engrais'
import { useParametreListe } from '../api/parametres'

interface Props {
  editRecette?: RecetteEngrais | null
  onClose: () => void
}

const TYPES_RECETTE  = ['Arrosage', 'Pulvérisation']
const SEMAINES       = Array.from({ length: 20 }, (_, i) => i + 1)

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
function autoUnite(typeProduit?: string): string {
  return typeProduit === 'Liquide' ? 'mL/L' : 'g/L'
}

// ── Calcul coût/L ─────────────────────────────────────────────────────────────
function calcCoutParLitre(
  lignes: Array<{ dosage: number; unite?: string; id_produit: number }>,
  produits: ProduitEngrais[]
): number {
  return lignes.reduce((total, l) => {
    const p = produits.find(x => x.id_produit === l.id_produit)
    if (!p || !p.prix_achat || !p.volume_conditionnement) return total
    // Normalise en base mL ou g
    const volBase = p.unite_volume === 'L'  ? p.volume_conditionnement * 1000
                  : p.unite_volume === 'Kg' ? p.volume_conditionnement * 1000
                  : p.volume_conditionnement
    if (!volBase) return total
    const prixParUnit = p.prix_achat / volBase   // € par mL ou g
    return total + prixParUnit * l.dosage          // dosage = mL/L ou g/L
  }, 0)
}

interface LigneForm {
  id_produit: number | ''
  dosage:     string
  unite:      string
}

export default function NouvelleRecetteEngraisModal({ editRecette, onClose }: Props) {
  const qc     = useQueryClient()
  const isEdit = !!editRecette

  const { values: periodes } = useParametreListe('periodes_recette')
  const { data: produits = [] } = useQuery<ProduitEngrais[]>({
    queryKey: ['engrais'],
    queryFn:  async () => (await engraisAPI.getAll()).data,
  })

  const [form, setForm] = useState({
    nom_recette:  editRecette?.nom_recette  ?? '',
    type_recette: editRecette?.type_recette ?? 'Arrosage',
    periode:      editRecette?.periode      ?? '',
    semaine:      editRecette?.semaine      != null ? String(editRecette.semaine) : '',
    ph_cible:     editRecette?.ph_cible     != null ? String(editRecette.ph_cible) : '',
    notes:        editRecette?.notes        ?? '',
  })

  const [lignes, setLignes] = useState<LigneForm[]>(
    editRecette?.lignes.map(l => ({
      id_produit: l.id_produit,
      dosage:     String(l.dosage),
      unite:      l.unite ?? autoUnite(l.type_produit),
    })) ?? []
  )
  const [error, setError] = useState('')

  // Coût calculé
  const coutParLitre = useMemo(() => {
    const valid = lignes.filter(l => l.id_produit !== '' && parseFloat(l.dosage) > 0)
    return calcCoutParLitre(
      valid.map(l => ({ id_produit: l.id_produit as number, dosage: parseFloat(l.dosage), unite: l.unite })),
      produits
    )
  }, [lignes, produits])

  // ── Gestion lignes ──────────────────────────────────────────────────────────
  const addLigne = () => setLignes(prev => [...prev, { id_produit: '', dosage: '', unite: 'mL/L' }])

  const updateLigne = (i: number, field: keyof LigneForm, value: string | number) => {
    setLignes(prev => {
      const next = [...prev]
      if (field === 'id_produit' && typeof value === 'number') {
        const p = produits.find(x => x.id_produit === value)
        next[i] = { ...next[i], id_produit: value, unite: autoUnite(p?.type_produit) }
      } else {
        next[i] = { ...next[i], [field]: value }
      }
      return next
    })
  }

  const removeLigne = (i: number) => setLignes(prev => prev.filter((_, idx) => idx !== i))

  // ── Sauvegarde ──────────────────────────────────────────────────────────────
  const save = useMutation({
    mutationFn: () => {
      if (!form.nom_recette.trim()) throw new Error('Le nom est obligatoire')
      const lignesValid = lignes.filter(l => l.id_produit !== '')
      const payload = {
        nom_recette:  form.nom_recette.trim(),
        type_recette: form.type_recette || undefined,
        periode:      form.periode      || undefined,
        semaine:      form.semaine      ? parseInt(form.semaine)      : undefined,
        ph_cible:     form.ph_cible     ? parseFloat(form.ph_cible)   : undefined,
        notes:        form.notes.trim() || undefined,
        lignes:       lignesValid.map((l, i) => ({
          id_produit: l.id_produit as number,
          dosage:     parseFloat(l.dosage) || 0,
          unite:      l.unite,
          ordre:      i,
        })),
      }
      return isEdit
        ? recetteEngraisAPI.update(editRecette!.id_recette, payload)
        : recetteEngraisAPI.create(payload)
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['recettes-engrais'] }); onClose() },
    onError:   (e: any) => setError(e?.message ?? e?.response?.data?.detail ?? 'Erreur'),
  })

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-3xl max-h-[94vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-700">
          <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">
            {isEdit ? 'Modifier la recette' : 'Nouvelle recette engrais'}
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
              placeholder="Ex: Semaine 3 Veg — Aptus" className={inp} />
          </div>

          {/* Type + Période + Semaine */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label>Type</Label>
              <select value={form.type_recette}
                onChange={e => setForm(f => ({ ...f, type_recette: e.target.value }))}
                className={sel}>
                {TYPES_RECETTE.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <Label>Période</Label>
              <select value={form.periode}
                onChange={e => setForm(f => ({ ...f, periode: e.target.value }))}
                className={sel}>
                <option value="">—</option>
                {periodes.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <Label>Semaine</Label>
              <select value={form.semaine}
                onChange={e => setForm(f => ({ ...f, semaine: e.target.value }))}
                className={sel}>
                <option value="">—</option>
                {SEMAINES.map(s => <option key={s} value={s}>S{s}</option>)}
              </select>
            </div>
          </div>

          {/* pH cible + coût calculé */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>pH cible</Label>
              <input type="number" step="0.1" min="0" max="14"
                value={form.ph_cible}
                onChange={e => setForm(f => ({ ...f, ph_cible: e.target.value }))}
                placeholder="Ex: 6.2" className={inp} />
            </div>
            <div className="flex flex-col justify-end">
              <div className="bg-blue-50 rounded-lg px-4 py-2.5 flex items-center gap-2">
                <Euro size={15} className="text-blue-500" />
                <span className="text-xs text-blue-400 font-medium uppercase tracking-wide">Coût estimé</span>
                <span className="ml-auto text-lg font-bold text-blue-700">
                  {coutParLitre > 0 ? `${coutParLitre.toFixed(3)} €/L` : '—'}
                </span>
              </div>
            </div>
          </div>

          {/* Ingrédients */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label>Engrais &amp; amendements</Label>
              {produits.length === 0 && (
                <span className="text-xs text-amber-500">Aucun produit dans Sols &amp; Engrais</span>
              )}
            </div>

            {lignes.length === 0 && (
              <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-3 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-lg">
                Aucun ingrédient — cliquez sur "Ajouter" pour en ajouter
              </p>
            )}

            <div className="space-y-2">
              {lignes.map((l, i) => {
                const produit = produits.find(p => p.id_produit === l.id_produit)
                const unites  = produit?.type_produit === 'Liquide' ? ['mL/L'] : ['g/L']
                return (
                  <div key={i} className="flex items-center gap-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg p-2">
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

                    {/* Dosage */}
                    <input
                      type="number" step="any" min="0"
                      value={l.dosage}
                      onChange={e => updateLigne(i, 'dosage', e.target.value)}
                      placeholder="0"
                      className="w-20 px-2 py-1.5 border border-gray-200 dark:border-gray-700 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-grow-500 text-right"
                    />

                    {/* Unité */}
                    <select
                      value={l.unite}
                      onChange={e => updateLigne(i, 'unite', e.target.value)}
                      className="w-20 px-2 py-1.5 border border-gray-200 dark:border-gray-700 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-grow-500 bg-white dark:bg-gray-800"
                    >
                      {unites.includes(l.unite)
                        ? unites.map(u => <option key={u} value={u}>{u}</option>)
                        : ['mL/L', 'g/L'].map(u => <option key={u} value={u}>{u}</option>)
                      }
                    </select>

                    <button onClick={() => removeLigne(i)}
                      className="text-red-400 hover:text-red-600 p-1 rounded shrink-0">
                      <Trash2 size={14} />
                    </button>
                  </div>
                )
              })}
            </div>

            <button onClick={addLigne}
              className="mt-2 flex items-center gap-1.5 text-sm text-grow-600 hover:text-grow-800 font-medium">
              <Plus size={15} /> Ajouter un engrais
            </button>
          </div>

          {/* Notes */}
          <div>
            <Label>Notes</Label>
            <textarea rows={2} value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              placeholder="Observations, conseils d'application…"
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
