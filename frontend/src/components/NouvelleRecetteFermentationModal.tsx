import { useState, useMemo } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { X, Loader2, Save, Plus, Trash2, GripVertical, Euro, Clock } from 'lucide-react'
import { recetteFermentationAPI, RecetteFermentation } from '../api/recetteFermentation'
import { engraisAPI, ProduitEngrais } from '../api/engrais'
import { useParametreListe } from '../api/parametres'

interface Props {
  editRecette?: RecetteFermentation | null
  onClose: () => void
}

const UNITES_VOL = ['L', 'mL']

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

export default function NouvelleRecetteFermentationModal({ editRecette, onClose }: Props) {
  const qc     = useQueryClient()
  const isEdit = !!editRecette

  const { values: typesFerm } = useParametreListe('types_fermentation')
  const { data: produits = [] } = useQuery<ProduitEngrais[]>({
    queryKey: ['engrais'],
    queryFn:  async () => (await engraisAPI.getAll()).data,
  })

  const [form, setForm] = useState({
    nom_recette:       editRecette?.nom_recette       ?? '',
    type_fermentation: editRecette?.type_fermentation ?? '',
    volume_total:      editRecette?.volume_total != null ? String(editRecette.volume_total) : '',
    unite_volume:      editRecette?.unite_volume      ?? 'L',
    duree_fermentation: editRecette?.duree_fermentation != null ? String(editRecette.duree_fermentation) : '',
    notes:             editRecette?.notes             ?? '',
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

  const coutTotal = useMemo(() => {
    const valid = lignes.filter(l => l.id_produit !== '' && parseFloat(l.quantite) > 0)
    return calcCout(
      valid.map(l => ({ id_produit: l.id_produit as number, quantite: parseFloat(l.quantite), unite: l.unite })),
      produits
    )
  }, [lignes, produits])

  const addLigne  = () => setLignes(p => [...p, { id_produit: '', quantite: '', unite: 'g', note_ligne: '' }])
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
      const lignesValid = lignes.filter(l => l.id_produit !== '')
      const payload = {
        nom_recette:       form.nom_recette.trim(),
        type_fermentation: form.type_fermentation || undefined,
        volume_total:      form.volume_total ? parseFloat(form.volume_total) : undefined,
        unite_volume:      form.unite_volume || undefined,
        duree_fermentation: form.duree_fermentation ? parseInt(form.duree_fermentation) : undefined,
        notes:             form.notes.trim() || undefined,
        lignes: lignesValid.map((l, i) => ({
          id_produit: l.id_produit as number,
          quantite:   parseFloat(l.quantite) || 0,
          unite:      l.unite,
          note_ligne: l.note_ligne.trim() || undefined,
          ordre: i,
        })),
      }
      return isEdit
        ? recetteFermentationAPI.update(editRecette!.id_recette_ferm, payload)
        : recetteFermentationAPI.create(payload)
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['recettes-fermentation'] }); onClose() },
    onError:   (e: any) => setError(e?.message ?? e?.response?.data?.detail ?? 'Erreur'),
  })

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[94vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-900">
            {isEdit ? 'Modifier la recette fermentation' : 'Nouvelle recette fermentation'}
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
              placeholder="Ex: AACT floraison" className={inp} />
          </div>

          {/* Type + Volume + Durée */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label>Type de fermentation</Label>
              <select value={form.type_fermentation}
                onChange={e => setForm(f => ({ ...f, type_fermentation: e.target.value }))}
                className={sel}>
                <option value="">—</option>
                {typesFerm.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <Label>Volume préparé</Label>
              <div className="flex gap-2">
                <input type="number" step="any" min="0"
                  value={form.volume_total}
                  onChange={e => setForm(f => ({ ...f, volume_total: e.target.value }))}
                  placeholder="Ex: 10" className={inp} />
                <select value={form.unite_volume}
                  onChange={e => setForm(f => ({ ...f, unite_volume: e.target.value }))}
                  className="w-20 px-2 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-grow-500">
                  {UNITES_VOL.map(u => <option key={u} value={u}>{u}</option>)}
                </select>
              </div>
            </div>
            <div>
              <Label>Durée de fermentation</Label>
              <div className="relative">
                <Clock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input type="number" step="1" min="0"
                  value={form.duree_fermentation}
                  onChange={e => setForm(f => ({ ...f, duree_fermentation: e.target.value }))}
                  placeholder="heures"
                  className="w-full pl-8 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-grow-500" />
              </div>
              <p className="text-xs text-gray-400 mt-0.5">en heures</p>
            </div>
          </div>

          {/* Coût calculé */}
          <div className="bg-purple-50 rounded-lg px-4 py-2.5 flex items-center gap-2">
            <Euro size={15} className="text-purple-500" />
            <span className="text-xs text-purple-500 font-medium uppercase tracking-wide">Coût estimé du batch</span>
            <span className="ml-auto text-lg font-bold text-purple-700">
              {coutTotal > 0 ? `${coutTotal.toFixed(2)} €` : '—'}
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
              <p className="text-sm text-gray-400 text-center py-3 border-2 border-dashed border-gray-200 rounded-lg">
                Aucun ingrédient — cliquez sur "Ajouter" pour en ajouter
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
                      placeholder="Note (ex: ajouter en dernier, mélanger doucement)"
                      className="w-full px-2 py-1.5 border border-gray-200 rounded-md text-xs focus:outline-none focus:ring-2 focus:ring-grow-500 text-gray-500" />
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
              placeholder="Protocole de préparation, conditions, observations…"
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
