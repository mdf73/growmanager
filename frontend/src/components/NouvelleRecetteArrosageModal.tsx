import { useState, useMemo } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { X, Loader2, Save, Plus, Trash2, GripVertical, Euro, Droplets } from 'lucide-react'
import { recetteArrosageAPI, RecetteArrosage } from '../api/recetteArrosage'
import { engraisAPI, ProduitEngrais } from '../api/engrais'

interface Props {
  editRecette?: RecetteArrosage | null
  onClose: () => void
}

const TYPES_ARROSAGE = ['Eau simple', 'Eau + amendements']
const UNITES_EAU = ['L', 'mL']

const sel = "w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-grow-500"
const inp = "w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-grow-500"

function Label({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label className="block text-xs font-medium text-gray-600 mb-1">
      {children}{required && <span className="text-red-400 ml-0.5">*</span>}
    </label>
  )
}

function autoUnite(typeProduit?: string): string {
  return typeProduit === 'Liquide' ? 'mL' : 'g'
}

function unitesPour(typeProduit?: string) {
  return typeProduit === 'Liquide' ? ['mL', 'L'] : ['g', 'Kg']
}

function calcCout(
  lignes: Array<{ quantite: number; unite?: string; id_produit: number }>,
  produits: ProduitEngrais[]
): number {
  const norm = (val: number, u?: string) => u === 'L' || u === 'Kg' ? val * 1000 : val
  return lignes.reduce((t, l) => {
    const p = produits.find(x => x.id_produit === l.id_produit)
    if (!p || !p.prix_achat || !p.volume_conditionnement) return t
    const base = norm(p.volume_conditionnement, p.unite_volume)
    if (!base) return t
    return t + (p.prix_achat / base) * norm(l.quantite, l.unite)
  }, 0)
}

interface LigneForm { id_produit: number | ''; quantite: string; unite: string; note_ligne: string }

export default function NouvelleRecetteArrosageModal({ editRecette, onClose }: Props) {
  const qc     = useQueryClient()
  const isEdit = !!editRecette

  const { data: produits = [] } = useQuery<ProduitEngrais[]>({
    queryKey: ['engrais'],
    queryFn:  async () => (await engraisAPI.getAll()).data,
  })

  const [form, setForm] = useState({
    nom_recette:   editRecette?.nom_recette   ?? '',
    type_arrosage: editRecette?.type_arrosage ?? 'Eau simple',
    quantite_eau:  editRecette?.quantite_eau != null ? String(editRecette.quantite_eau) : '',
    unite_eau:     editRecette?.unite_eau     ?? 'L',
    notes:         editRecette?.notes         ?? '',
  })

  const [lignes, setLignes] = useState<LigneForm[]>(
    editRecette?.lignes.map(l => ({
      id_produit: l.id_produit,
      quantite:   String(l.quantite),
      unite:      l.unite ?? autoUnite(l.type_produit),
      note_ligne: l.note_ligne ?? '',
    })) ?? []
  )
  const [error, setError] = useState('')

  const hasAmendements = form.type_arrosage === 'Eau + amendements'

  const coutTotal = useMemo(() => {
    const valid = lignes.filter(l => l.id_produit !== '' && parseFloat(l.quantite) > 0)
    return calcCout(
      valid.map(l => ({ id_produit: l.id_produit as number, quantite: parseFloat(l.quantite), unite: l.unite })),
      produits
    )
  }, [lignes, produits])

  const addLigne  = () => setLignes(p => [...p, { id_produit: '', quantite: '', unite: 'mL', note_ligne: '' }])
  const removeLigne = (i: number) => setLignes(p => p.filter((_, idx) => idx !== i))
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

  const save = useMutation({
    mutationFn: () => {
      if (!form.nom_recette.trim()) throw new Error('Le nom est obligatoire')
      const lignesValid = hasAmendements ? lignes.filter(l => l.id_produit !== '') : []
      const payload = {
        nom_recette:   form.nom_recette.trim(),
        type_arrosage: form.type_arrosage || undefined,
        quantite_eau:  form.quantite_eau ? parseFloat(form.quantite_eau) : undefined,
        unite_eau:     form.unite_eau || undefined,
        notes:         form.notes.trim() || undefined,
        lignes: lignesValid.map((l, i) => ({
          id_produit: l.id_produit as number,
          quantite:   parseFloat(l.quantite) || 0,
          unite:      l.unite,
          note_ligne: l.note_ligne.trim() || undefined,
          ordre: i,
        })),
      }
      return isEdit
        ? recetteArrosageAPI.update(editRecette!.id_recette_arrosage, payload)
        : recetteArrosageAPI.create(payload)
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['recettes-arrosage'] }); onClose() },
    onError:   (e: any) => setError(e?.message ?? e?.response?.data?.detail ?? 'Erreur'),
  })

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[94vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-900">
            {isEdit ? 'Modifier la recette arrosage' : 'Nouvelle recette arrosage'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={22} /></button>
        </div>

        {/* Corps */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {/* Nom */}
          <div>
            <Label required>Nom de la recette</Label>
            <input type="text" value={form.nom_recette}
              onChange={e => setForm(f => ({ ...f, nom_recette: e.target.value }))}
              placeholder="Ex: Arrosage semaine 3 floraison" className={inp} />
          </div>

          {/* Type + volume eau */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Type d'arrosage</Label>
              <select value={form.type_arrosage}
                onChange={e => setForm(f => ({ ...f, type_arrosage: e.target.value }))}
                className={sel}>
                {TYPES_ARROSAGE.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <Label>Volume d'eau de base</Label>
              <div className="flex gap-2">
                <input type="number" step="any" min="0"
                  value={form.quantite_eau}
                  onChange={e => setForm(f => ({ ...f, quantite_eau: e.target.value }))}
                  placeholder="Ex: 10" className={inp} />
                <select value={form.unite_eau}
                  onChange={e => setForm(f => ({ ...f, unite_eau: e.target.value }))}
                  className="w-20 px-2 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-grow-500">
                  {UNITES_EAU.map(u => <option key={u} value={u}>{u}</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* Coût calculé */}
          {hasAmendements && (
            <div className="bg-blue-50 rounded-lg px-4 py-2.5 flex items-center gap-2">
              <Euro size={15} className="text-blue-500" />
              <span className="text-xs text-blue-500 font-medium uppercase tracking-wide">Coût amendements</span>
              <span className="ml-auto text-lg font-bold text-blue-700">
                {coutTotal > 0 ? `${coutTotal.toFixed(2)} €` : '—'}
              </span>
            </div>
          )}

          {/* Résumé eau */}
          {form.quantite_eau && (
            <div className="flex items-center gap-2 bg-sky-50 rounded-lg px-4 py-2.5">
              <Droplets size={15} className="text-sky-500" />
              <span className="text-sm text-sky-700 font-medium">
                {form.quantite_eau} {form.unite_eau} d'eau de base
                {hasAmendements && lignes.filter(l => l.id_produit !== '').length > 0
                  ? ` + ${lignes.filter(l => l.id_produit !== '').length} amendement(s)`
                  : ''}
              </span>
            </div>
          )}

          {/* Amendements — seulement si type = Eau + amendements */}
          {hasAmendements && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label>Amendements &amp; intrants</Label>
                {produits.length === 0 && (
                  <span className="text-xs text-amber-500">Aucun produit dans Sols &amp; Engrais</span>
                )}
              </div>

              {lignes.length === 0 && (
                <p className="text-sm text-gray-400 text-center py-3 border-2 border-dashed border-gray-200 rounded-lg">
                  Aucun amendement — cliquez sur "Ajouter" pour en ajouter
                </p>
              )}

              <div className="space-y-3">
                {lignes.map((l, i) => {
                  const produit = produits.find(p => p.id_produit === l.id_produit)
                  const unites  = unitesPour(produit?.type_produit)
                  return (
                    <div key={i} className="bg-gray-50 rounded-lg p-3 space-y-2">
                      <div className="flex items-center gap-2">
                        <GripVertical size={14} className="text-gray-300 shrink-0" />
                        <select value={l.id_produit}
                          onChange={e => updateLigne(i, 'id_produit', parseInt(e.target.value))}
                          className="flex-1 px-2 py-1.5 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-grow-500 bg-white">
                          <option value="">— Choisir un produit —</option>
                          {produits.map(p => (
                            <option key={p.id_produit} value={p.id_produit}>
                              {p.nom_produit}{p.marque ? ` (${p.marque})` : ''}
                            </option>
                          ))}
                        </select>
                        <input type="number" step="any" min="0" value={l.quantite}
                          onChange={e => updateLigne(i, 'quantite', e.target.value)}
                          placeholder="0"
                          className="w-20 px-2 py-1.5 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-grow-500 text-right" />
                        <select value={l.unite}
                          onChange={e => updateLigne(i, 'unite', e.target.value)}
                          className="w-20 px-2 py-1.5 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-grow-500 bg-white">
                          {(unites.includes(l.unite) ? unites : ['g', 'Kg', 'mL', 'L']).map(u =>
                            <option key={u} value={u}>{u}</option>)}
                        </select>
                        <button onClick={() => removeLigne(i)}
                          className="text-red-400 hover:text-red-600 p-1 rounded shrink-0">
                          <Trash2 size={14} />
                        </button>
                      </div>
                      <input type="text" value={l.note_ligne}
                        onChange={e => updateLigne(i, 'note_ligne', e.target.value)}
                        placeholder="Note (ex: ajouter après agitation)"
                        className="w-full px-2 py-1.5 border border-gray-200 rounded-md text-xs focus:outline-none focus:ring-2 focus:ring-grow-500 text-gray-500" />
                    </div>
                  )
                })}
              </div>

              <button onClick={addLigne}
                className="mt-2 flex items-center gap-1.5 text-sm text-grow-600 hover:text-grow-800 font-medium">
                <Plus size={15} /> Ajouter un amendement
              </button>
            </div>
          )}

          {/* Notes */}
          <div>
            <Label>Notes générales</Label>
            <textarea rows={2} value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              placeholder="Fréquence, moment d'application, observations…"
              className={inp + ' resize-none'} />
          </div>

          {error && <p className="text-xs text-red-500">{error}</p>}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
          <button onClick={onClose}
            className="px-4 py-2 border border-gray-300 text-gray-600 text-sm rounded-lg hover:bg-gray-50">
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
