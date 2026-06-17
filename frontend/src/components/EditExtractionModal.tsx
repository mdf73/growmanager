import { useState, useMemo } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { X, Plus, Trash2, Loader2, AlertTriangle } from 'lucide-react'
import { rosinAPI } from '../api/stock'
import type { RosinExtraction } from '../api/stock'
import { useParametreListe } from '../api/parametres'

const MAILLAGES_FB = ['25µ', '36µ', '45µ', '72µ', '90µ', '120µ', '160µ', '220µ']

interface Props {
  extraction: RosinExtraction
  onClose: () => void
}

const toStr = (v?: number | null) => (v != null ? String(v) : '')

export default function EditExtractionModal({ extraction, onClose }: Props) {
  const qc = useQueryClient()
  const { values: maillagesParam } = useParametreListe('maillages_rosin')
  const MAILLAGES = maillagesParam.length > 0 ? maillagesParam : MAILLAGES_FB

  // Préremplissage depuis l'extraction existante (on garde les valeurs renseignées)
  const initSacs = [extraction.sac_1_poids, extraction.sac_2_poids, extraction.sac_3_poids, extraction.sac_4_poids]
    .filter((v): v is number => v != null).map(toStr)
  const initPresses = [extraction.presse_1_poids, extraction.presse_2_poids, extraction.presse_3_poids, extraction.presse_4_poids]
    .filter((v): v is number => v != null).map(toStr)

  const [date,        setDate]        = useState(extraction.date_rosinextraction?.split('T')[0] ?? '')
  const [temperature, setTemperature] = useState(toStr(extraction.temperature_extraction))
  const [maillage,    setMaillage]    = useState(extraction.maillage ?? '')
  const [preheat,     setPreheat]     = useState(toStr(extraction.duree_preheat))
  const [dureeExtr,   setDureeExtr]   = useState(toStr(extraction.duree_extraction))
  const [sacs,        setSacs]        = useState<string[]>(initSacs.length ? initSacs : [''])
  const [presses,     setPresses]     = useState<string[]>(initPresses.length ? initPresses : [''])
  const [notes,       setNotes]       = useState(extraction.info_rosinextraction ?? '')
  const [error,       setError]       = useState<string | null>(null)

  const totalSacs = useMemo(
    () => sacs.reduce((s, v) => s + (parseFloat(v) || 0), 0),
    [sacs]
  )
  const poidsSortie = useMemo(
    () => presses.reduce((s, v) => s + (parseFloat(v) || 0), 0),
    [presses]
  )
  const rendement = useMemo(() => {
    if (totalSacs <= 0 || poidsSortie <= 0) return null
    return ((poidsSortie / totalSacs) * 100).toFixed(1)
  }, [totalSacs, poidsSortie])

  // ── Sacs ──
  const addSac    = () => { if (sacs.length < 4) setSacs(p => [...p, '']) }
  const removeSac = (i: number) => { if (sacs.length > 1) setSacs(p => p.filter((_, idx) => idx !== i)) }
  const updateSac = (i: number, v: string) => setSacs(p => p.map((x, idx) => idx === i ? v : x))
  // ── Presses ──
  const addPresse    = () => { if (presses.length < 4) setPresses(p => [...p, '']) }
  const removePresse = (i: number) => { if (presses.length > 1) setPresses(p => p.filter((_, idx) => idx !== i)) }
  const updatePresse = (i: number, v: string) => setPresses(p => p.map((x, idx) => idx === i ? v : x))

  const mutation = useMutation({
    mutationFn: () => {
      if (!maillage)        throw new Error('Le maillage du sac est obligatoire')
      if (totalSacs <= 0)   throw new Error("Le poids total d'entrée (sacs) doit être > 0")
      if (!presses[0])      throw new Error('La passe de presse 1 est obligatoire')
      if (poidsSortie <= 0) throw new Error('Le poids de sortie doit être > 0')

      const get = (arr: string[], i: number) =>
        arr[i] ? parseFloat(arr[i]) || undefined : undefined

      return rosinAPI.update(extraction.id_rosinextraction, {
        // Champs non éditables conservés tels quels
        id_bocal:               extraction.id_bocal,
        id_rosinbag:            extraction.id_rosinbag,
        id_press:               extraction.id_press,
        id_stock_source:        extraction.id_stock_source,
        nom_variete_extract:    extraction.nom_variete_extract,
        sources:                extraction.sources,
        // Champs éditables
        date_rosinextraction:   date,
        temperature_extraction: temperature ? parseInt(temperature) : undefined,
        maillage:               maillage,
        duree_preheat:          preheat   ? parseInt(preheat)   : undefined,
        duree_extraction:       dureeExtr ? parseInt(dureeExtr) : undefined,
        sac_1_poids:            get(sacs, 0),
        sac_2_poids:            get(sacs, 1),
        sac_3_poids:            get(sacs, 2),
        sac_4_poids:            get(sacs, 3),
        quantite_utilisee:      totalSacs,
        presse_1_poids:         get(presses, 0),
        presse_2_poids:         get(presses, 1),
        presse_3_poids:         get(presses, 2),
        presse_4_poids:         get(presses, 3),
        quantite_extraite:      poidsSortie,
        info_rosinextraction:   notes || undefined,
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

  const lbl = (txt: string, required = false) => (
    <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
      {txt}{required && <span className="text-red-500 ml-0.5">*</span>}
    </label>
  )
  const inputCls = "w-full rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm focus:ring-2 focus:ring-grow-500 focus:border-grow-500 dark:bg-gray-800"

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[92vh]">

        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700 shrink-0">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Modifier l'extraction</h2>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
              {extraction.variete_nom || extraction.nom_variete_extract || 'Sans variété'}
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700">
            <X size={18} />
          </button>
        </div>

        <form
          onSubmit={e => { e.preventDefault(); setError(null); mutation.mutate() }}
          className="overflow-y-auto flex-1 px-6 py-5 space-y-5"
        >
          {/* Date */}
          <div>
            {lbl('Date')}
            <input type="date" value={date} onChange={e => setDate(e.target.value)} className={inputCls} required />
          </div>

          {/* Paramètres */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              {lbl('Température (°C)')}
              <input type="number" min="0" max="300" value={temperature}
                onChange={e => setTemperature(e.target.value)} placeholder="ex: 80" className={inputCls} />
            </div>
            <div>
              {lbl('Maillage du sac', true)}
              <select value={maillage} onChange={e => setMaillage(e.target.value)} className={inputCls} required>
                <option value="">— Sélectionner —</option>
                {MAILLAGES.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div>
              {lbl('Pré-chauffe (sec)')}
              <input type="number" min="0" value={preheat}
                onChange={e => setPreheat(e.target.value)} placeholder="ex: 60" className={inputCls} />
            </div>
            <div>
              {lbl('Durée extraction (sec)')}
              <input type="number" min="0" value={dureeExtr}
                onChange={e => setDureeExtr(e.target.value)} placeholder="ex: 120" className={inputCls} />
            </div>
          </div>

          {/* Sacs d'entrée */}
          <div>
            <div className="flex items-center justify-between mb-2">
              {lbl('Répartition par sac (g)', true)}
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
                  <span className="text-sm text-gray-500 dark:text-gray-400 w-12 shrink-0">Sac {i + 1}</span>
                  <input type="number" min="0" step="0.01" value={v}
                    onChange={e => updateSac(i, e.target.value)} placeholder="0.00"
                    className="flex-1 rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm focus:ring-2 focus:ring-grow-500 dark:bg-gray-800" />
                  <span className="text-sm text-gray-400 dark:text-gray-500 shrink-0">g</span>
                  {sacs.length > 1 && (
                    <button type="button" onClick={() => removeSac(i)} className="p-1 text-gray-300 hover:text-red-500">
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              ))}
            </div>
            <div className="mt-3 flex justify-between bg-gray-50 dark:bg-gray-700/50 rounded-lg px-4 py-2">
              <span className="text-sm text-gray-500 dark:text-gray-400">Total entrée (sacs)</span>
              <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">{totalSacs.toFixed(2)} g</span>
            </div>
          </div>

          {/* Passes de presse */}
          <div>
            <div className="flex items-center justify-between mb-2">
              {lbl('Poids par passe de presse (g)', true)}
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
                  <span className="text-sm text-gray-500 dark:text-gray-400 w-16 shrink-0">Passe {i + 1}</span>
                  <input type="number" min="0" step="0.01" value={v}
                    onChange={e => updatePresse(i, e.target.value)} placeholder="0.00" required={i === 0}
                    className="flex-1 rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm focus:ring-2 focus:ring-purple-400 dark:bg-gray-800" />
                  <span className="text-sm text-gray-400 dark:text-gray-500 shrink-0">g</span>
                  {i > 0 && (
                    <button type="button" onClick={() => removePresse(i)} className="p-1 text-gray-300 hover:text-red-500">
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              ))}
            </div>
            <div className="mt-2 flex justify-between bg-purple-50 dark:bg-purple-900/20 rounded-lg px-4 py-2">
              <span className="text-sm text-purple-600 dark:text-purple-400">Total sortie</span>
              <div className="flex items-center gap-3">
                <span className="text-sm font-semibold text-purple-900 dark:text-purple-200">{poidsSortie.toFixed(2)} g</span>
                {rendement !== null && (
                  <span className="text-xs font-medium text-grow-600 bg-grow-50 px-2 py-0.5 rounded-full">
                    {rendement}%
                  </span>
                )}
              </div>
            </div>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1.5">
              Le stock Rosin produit est synchronisé automatiquement (quantité + maillage).
            </p>
          </div>

          {/* Notes */}
          <div>
            {lbl('Notes')}
            <textarea value={notes} onChange={e => setNotes(e.target.value)}
              rows={2} placeholder="Observations, remarques…"
              className={inputCls + ' resize-none'} />
          </div>

          {error && (
            <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 rounded-lg px-4 py-2">
              <AlertTriangle size={14} /> {error}
            </div>
          )}

          <div className="flex gap-3 pt-1 pb-1">
            <button type="button" onClick={onClose}
              className="flex-1 px-4 py-2 rounded-xl border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700/40">
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
