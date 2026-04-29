import { useState, useMemo } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { X, Loader2, Save, Plus, Trash2, GripVertical, Euro, Flower } from 'lucide-react'
import { recetteReamendementAPI, RecetteReamendement } from '../api/recetteReamendement'
import { engraisAPI, ProduitEngrais } from '../api/engrais'

interface Props {
  editRecette?: RecetteReamendement | null
  onClose: () => void
}

// Volumes de pot prédéfinis (en L)
const VOLUMES_POT = [5, 7, 10, 11, 15, 18, 20, 25, 30, 35, 45, 50, 65, 100]

const inp = "w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-grow-500"
const sel = "w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-grow-500"

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

export default function NouvelleRecetteReamendementModal({ editRecette, onClose }: Props) {
  const qc     = useQueryClient()
  const isEdit = !!editRecette

  const { data: produits = [] } = useQuery<ProduitEngrais[]>({
    queryKey: ['engrais'],
    queryFn:  async () => (await engraisAPI.getAll()).data,
  })

  // Volume pot : prédéfini ou "custom"
  const initVol = editRecette?.volume_pot != null ? String(editRecette.volume_pot) : ''
  const isCustomVol = initVol && !VOLUMES_POT.includes(Number(initVol))
  const [potSelect,  setPotSelect]  = useState(isCustomVol ? 'custom' : initVol)
  const [potCustom,  setPotCustom]  = useState(isCustomVol ? initVol : '')

  const volumePotValue = potSelect === 'custom' ? potCustom : potSelect

  const [form, setForm] = useState({
    nom_recette: editRecette?.nom_recette ?? '',
    notes:       editRecette?.notes       ?? '',
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
      const volNum = volumePotValue ? parseFloat(volumePotValue) : undefined
      const lignesValid = lignes.filter(l => l.id_produit !== '')
      const payload = {
        nom_recette: form.nom_recette.trim(),
        volume_pot:  volNum,
        unite_pot:   'L',
        notes:       form.notes.trim() || undefined,
        lignes: lignesValid.map((l, i) => ({
          id_produit: l.id_produit as number,
          quantite:   parseFloat(l.quantite) || 0,
          unite:      l.unite,
          note_ligne: l.note_ligne.trim() || undefined,
          ordre: i,
        })),
      }
      return isEdit
        ? recetteReamendementAPI.update(editRecette!.id_recette_reamend, payload)
        : recetteReamendementAPI.create(payload)
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['recettes-reamendement'] }); onClose() },
    onError:   (e: any) => setError(e?.message ?? e?.response?.data?.detail ?? 'Erreur'),
  })

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[94vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-900">
            {isEdit ? 'Modifier la recette réamendement' : 'Nouvelle recette réamendement'}
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
              placeholder="Ex: Réamendement floraison pot 15L" className={inp} />
          </div>

          {/* Volume pot */}
          <div>
            <Label>Volume du pot</Label>
            <div className="flex gap-2 items-center">
              <select value={potSelect}
                onChange={e => { setPotSelect(e.target.value); if (e.target.value !== 'custom') setPotCustom('') }}
                className={sel}>
                <option value="">—</option>
                {VOLUMES_POT.map(v => (
                  <option key={v} value={String(v)}>{v} L</option>
                ))}
                <option value="custom">Autre…</option>
              </select>
              {potSelect === 'custom' && (
                <div className="flex gap-2 items-center">
                  <input type="number" step="1" min="1"
                    value={potCustom}
                    onChange={e => setPotCustom(e.target.value)}
                    placeholder="Volume"
                    className="w-28 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-grow-500" />
                  <span className="text-sm text-gray-500 shrink-0">L</span>
                </div>
              )}
              {volumePotValue && potSelect !== 'custom' && (
                <div className="flex items-center gap-1.5 bg-amber-50 text-amber-700 rounded-lg px-3 py-1.5 text-sm font-medium shrink-0">
                  <Flower size={14} />
                  Pot de {volumePotValue} L
                </div>
              )}
            </div>
          </div>

          {/* Coût calculé */}
          <div className="bg-amber-50 rounded-lg px-4 py-2.5 flex items-center gap-2">
            <Euro size={15} className="text-amber-500" />
            <span className="text-xs text-amber-500 font-medium uppercase tracking-wide">Coût estimé par pot</span>
            <span className="ml-auto text-lg font-bold text-amber-700">
              {coutTotal > 0 ? `${coutTotal.toFixed(2)} €` : '—'}
            </span>
          </div>

          {/* Amendements */}
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
                      placeholder="Note (ex: mélanger uniformément dans le sol)"
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
