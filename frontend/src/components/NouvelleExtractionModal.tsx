import { useState, useMemo } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { X, Plus, Trash2, Loader2, AlertTriangle } from 'lucide-react'
import { rosinAPI } from '../api/stock'
import type { Stock } from '../api/stock'
import { useParametreListe } from '../api/parametres'

const MAILLAGES_FB = ['25µ', '36µ', '45µ', '72µ', '90µ', '120µ', '160µ', '220µ']

interface Props {
  stocks: Stock[]
  onClose: () => void
}

export default function NouvelleExtractionModal({ stocks, onClose }: Props) {
  const qc = useQueryClient()
  const { values: maillagesParam } = useParametreListe('maillages_rosin')
  const MAILLAGES = maillagesParam.length > 0 ? maillagesParam : MAILLAGES_FB
  const today = new Date().toISOString().split('T')[0]

  // ── Formulaire ────────────────────────────────────────────────────────────
  const [stockId,       setStockId]       = useState('')
  const [date,          setDate]          = useState(today)
  const [temperature,   setTemperature]   = useState('')
  const [maillage,      setMaillage]      = useState('')
  const [preheat,       setPreheat]       = useState('')
  const [dureeExtr,     setDureeExtr]     = useState('')
  const [sacs,          setSacs]          = useState(['', ''])       // min 2
  const [presses,       setPresses]       = useState([''])           // min 1
  const [notes,         setNotes]         = useState('')
  const [error,         setError]         = useState<string | null>(null)

  // ── Calculs automatiques ──────────────────────────────────────────────────
  const poidsEntree = useMemo(
    () => sacs.reduce((s, v) => s + (parseFloat(v) || 0), 0),
    [sacs]
  )
  const poidsSortie = useMemo(
    () => presses.reduce((s, v) => s + (parseFloat(v) || 0), 0),
    [presses]
  )
  const rendement = useMemo(() => {
    if (poidsEntree <= 0 || poidsSortie <= 0) return null
    return ((poidsSortie / poidsEntree) * 100).toFixed(1)
  }, [poidsEntree, poidsSortie])

  const stockSelected = useMemo(
    () => stocks.find(s => s.id_stock === parseInt(stockId)),
    [stocks, stockId]
  )

  // ── Gestion sacs ─────────────────────────────────────────────────────────
  const addSac    = () => { if (sacs.length < 4) setSacs(p => [...p, '']) }
  const removeSac = (i: number) => { if (sacs.length > 2) setSacs(p => p.filter((_, idx) => idx !== i)) }
  const updateSac = (i: number, v: string) => setSacs(p => p.map((x, idx) => idx === i ? v : x))

  // ── Gestion passes de presse ──────────────────────────────────────────────
  const addPresse    = () => { if (presses.length < 4) setPresses(p => [...p, '']) }
  const removePresse = (i: number) => { if (presses.length > 1) setPresses(p => p.filter((_, idx) => idx !== i)) }
  const updatePresse = (i: number, v: string) => setPresses(p => p.map((x, idx) => idx === i ? v : x))

  // ── Mutation ──────────────────────────────────────────────────────────────
  const mutation = useMutation({
    mutationFn: () => {
      if (!stockId)             throw new Error('Sélectionnez un produit en stock')
      if (!sacs[0] || !sacs[1]) throw new Error('Les sacs 1 et 2 sont obligatoires')
      if (!presses[0])          throw new Error('La passe de presse 1 est obligatoire')
      if (poidsEntree <= 0)     throw new Error('Le poids total d\'entrée doit être > 0')
      if (poidsSortie <= 0)     throw new Error('Le poids de sortie doit être > 0')

      const get = (arr: string[], i: number) =>
        arr[i] ? parseFloat(arr[i]) || undefined : undefined

      return rosinAPI.create({
        id_stock_source:       parseInt(stockId),
        date_rosinextraction:  date,
        temperature_extraction: temperature ? parseInt(temperature) : undefined,
        maillage:              maillage || undefined,
        duree_preheat:         preheat   ? parseInt(preheat)   : undefined,
        duree_extraction:      dureeExtr ? parseInt(dureeExtr) : undefined,
        sac_1_poids:           get(sacs, 0),
        sac_2_poids:           get(sacs, 1),
        sac_3_poids:           get(sacs, 2),
        sac_4_poids:           get(sacs, 3),
        quantite_utilisee:     poidsEntree,
        presse_1_poids:        get(presses, 0),
        presse_2_poids:        get(presses, 1),
        presse_3_poids:        get(presses, 2),
        presse_4_poids:        get(presses, 3),
        quantite_extraite:     poidsSortie,
        info_rosinextraction:  notes || undefined,
      })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['rosin-extractions'] })
      qc.invalidateQueries({ queryKey: ['rosin-stats'] })
      qc.invalidateQueries({ queryKey: ['stock'] })
      onClose()
    },
    onError: (e: Error) => setError(e.message),
  })

  const stocksDisponibles = stocks.filter(
    s => s.type_stock !== 'Rosin' && (s.quantite_stock ?? 0) > 0
  )

  // ── Helpers UI ────────────────────────────────────────────────────────────
  const label = (txt: string, required = false) => (
    <label className="block text-sm font-medium text-gray-700 mb-1">
      {txt}{required && <span className="text-red-500 ml-0.5">*</span>}
    </label>
  )
  const inputCls = "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-grow-500 focus:border-grow-500"

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[92vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 shrink-0">
          <h2 className="text-lg font-semibold text-gray-900">Nouvelle extraction Rosin</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100">
            <X size={18} />
          </button>
        </div>

        <form
          onSubmit={e => { e.preventDefault(); setError(null); mutation.mutate() }}
          className="overflow-y-auto flex-1 px-6 py-5 space-y-5"
        >

          {/* Produit source */}
          <div>
            {label('Produit en stock', true)}
            <select value={stockId} onChange={e => setStockId(e.target.value)} className={inputCls} required>
              <option value="">— Sélectionner —</option>
              {stocksDisponibles.map(s => (
                <option key={s.id_stock} value={s.id_stock}>
                  {s.variete_nom || '(sans variété)'} — {s.type_stock}
                  {s.sous_type_stock ? ` ${s.sous_type_stock}` : ''}
                  {' '}({Number(s.quantite_stock).toFixed(1)} g)
                </option>
              ))}
            </select>
            {stockSelected && (
              <p className="mt-1 text-xs text-gray-400">
                Stock dispo : <span className="font-medium text-gray-600">{Number(stockSelected.quantite_stock).toFixed(1)} g</span>
              </p>
            )}
          </div>

          {/* Date */}
          <div>
            {label('Date')}
            <input type="date" value={date} onChange={e => setDate(e.target.value)} className={inputCls} required />
          </div>

          {/* Paramètres d'extraction */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              {label('Température (°C)')}
              <input type="number" min="0" max="300" value={temperature}
                onChange={e => setTemperature(e.target.value)}
                placeholder="ex: 80" className={inputCls} />
            </div>
            <div>
              {label('Maillage du sac')}
              <select value={maillage} onChange={e => setMaillage(e.target.value)} className={inputCls}>
                <option value="">— Sélectionner —</option>
                {MAILLAGES.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div>
              {label('Pré-chauffe (sec)')}
              <input type="number" min="0" value={preheat}
                onChange={e => setPreheat(e.target.value)}
                placeholder="ex: 60" className={inputCls} />
            </div>
            <div>
              {label('Durée extraction (sec)')}
              <input type="number" min="0" value={dureeExtr}
                onChange={e => setDureeExtr(e.target.value)}
                placeholder="ex: 120" className={inputCls} />
            </div>
          </div>

          {/* Sacs d'entrée */}
          <div>
            <div className="flex items-center justify-between mb-2">
              {label('Poids par sac (g)', true)}
              {sacs.length < 4 && (
                <button type="button" onClick={addSac}
                  className="flex items-center gap-1 text-xs text-grow-600 hover:text-grow-800 font-medium">
                  <Plus size={12} /> Sac {sacs.length + 1}
                </button>
              )}
            </div>
            <div className="space-y-2">
              {sacs.map((v, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="text-sm text-gray-500 w-12 shrink-0">Sac {i + 1}</span>
                  <input type="number" min="0" step="0.1" value={v}
                    onChange={e => updateSac(i, e.target.value)}
                    placeholder="0.0" required={i < 2}
                    className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-grow-500" />
                  <span className="text-sm text-gray-400">g</span>
                  {i >= 2 && (
                    <button type="button" onClick={() => removeSac(i)} className="p-1 text-gray-300 hover:text-red-500">
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              ))}
            </div>
            <div className="mt-2 flex justify-between bg-gray-50 rounded-lg px-4 py-2">
              <span className="text-sm text-gray-500">Total entrée</span>
              <span className="text-sm font-semibold text-gray-900">{poidsEntree.toFixed(1)} g</span>
            </div>
          </div>

          {/* Passes de presse */}
          <div>
            <div className="flex items-center justify-between mb-2">
              {label('Poids par passe de presse (g)', true)}
              {presses.length < 4 && (
                <button type="button" onClick={addPresse}
                  className="flex items-center gap-1 text-xs text-purple-600 hover:text-purple-800 font-medium">
                  <Plus size={12} /> Passe {presses.length + 1}
                </button>
              )}
            </div>
            <div className="space-y-2">
              {presses.map((v, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="text-sm text-gray-500 w-16 shrink-0">Passe {i + 1}</span>
                  <input type="number" min="0" step="0.01" value={v}
                    onChange={e => updatePresse(i, e.target.value)}
                    placeholder="0.00" required={i === 0}
                    className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-purple-400" />
                  <span className="text-sm text-gray-400">g</span>
                  {i > 0 && (
                    <button type="button" onClick={() => removePresse(i)} className="p-1 text-gray-300 hover:text-red-500">
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              ))}
            </div>
            <div className="mt-2 flex justify-between bg-purple-50 rounded-lg px-4 py-2">
              <span className="text-sm text-purple-600">Total sortie</span>
              <div className="flex items-center gap-3">
                <span className="text-sm font-semibold text-purple-900">{poidsSortie.toFixed(2)} g</span>
                {rendement !== null && (
                  <span className="text-xs font-medium text-grow-600 bg-grow-50 px-2 py-0.5 rounded-full">
                    {rendement}%
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Notes */}
          <div>
            {label('Notes')}
            <textarea value={notes} onChange={e => setNotes(e.target.value)}
              rows={2} placeholder="Observations, remarques…"
              className={inputCls + ' resize-none'} />
          </div>

          {/* Avertissement stock */}
          {stockSelected && poidsEntree > Number(stockSelected.quantite_stock) && (
            <div className="flex items-center gap-2 text-sm text-amber-600 bg-amber-50 rounded-lg px-4 py-2">
              <AlertTriangle size={14} />
              Poids entrée ({poidsEntree.toFixed(1)} g) supérieur au stock ({Number(stockSelected.quantite_stock).toFixed(1)} g)
            </div>
          )}

          {/* Erreur */}
          {error && (
            <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 rounded-lg px-4 py-2">
              <AlertTriangle size={14} /> {error}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-1 pb-1">
            <button type="button" onClick={onClose}
              className="flex-1 px-4 py-2 rounded-xl border border-gray-300 text-gray-700 text-sm font-medium hover:bg-gray-50">
              Annuler
            </button>
            <button type="submit" disabled={mutation.isPending}
              className="flex-1 px-4 py-2 rounded-xl bg-grow-600 text-white text-sm font-medium hover:bg-grow-700 disabled:opacity-50 flex items-center justify-center gap-2">
              {mutation.isPending
                ? <><Loader2 size={15} className="animate-spin" /> Enregistrement…</>
                : 'Enregistrer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
