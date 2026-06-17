import { useState, useMemo } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { X, Plus, Trash2, Loader2, AlertTriangle } from 'lucide-react'
import { rosinAPI } from '../api/stock'
import type { Stock } from '../api/stock'
import { useParametreListe } from '../api/parametres'

const MAILLAGES_FB = ['25µ', '36µ', '45µ', '72µ', '90µ', '120µ', '160µ', '220µ']

// Produit sélectionné en entrée (pas de quantité — elle découle des sacs)
interface SourceLine { stockId: string }
// Un sac d'entrée
interface SacLine { stockId: string; poids: string }

interface Props {
  stocks: Stock[]
  onClose: () => void
}

export default function NouvelleExtractionModal({ stocks, onClose }: Props) {
  const qc = useQueryClient()
  const { values: maillagesParam } = useParametreListe('maillages_rosin')
  const MAILLAGES = maillagesParam.length > 0 ? maillagesParam : MAILLAGES_FB
  const today = new Date().toISOString().split('T')[0]

  // Produits en entrée (selectors uniquement, pas de quantité)
  const [sources,     setSources]     = useState<SourceLine[]>([{ stockId: '' }])
  // Sacs d'entrée : stockId renseigné seulement en mode multi-produits
  const [sacs,        setSacs]        = useState<SacLine[]>([{ stockId: '', poids: '' }, { stockId: '', poids: '' }])
  const [presses,     setPresses]     = useState([''])
  const [date,        setDate]        = useState(today)
  const [temperature, setTemperature] = useState('')
  const [maillage,    setMaillage]    = useState('')
  const [preheat,     setPreheat]     = useState('')
  const [dureeExtr,   setDureeExtr]   = useState('')
  const [notes,       setNotes]       = useState('')
  const [error,       setError]       = useState<string | null>(null)

  const stocksDisponibles = stocks.filter(
    s => s.type_stock !== 'Rosin' && (s.quantite_stock ?? 0) > 0
  )

  const isSingle = sources.length === 1

  // ── Gestion sources ───────────────────────────────────────────────────────
  const selectedSourceIds = sources.map(s => s.stockId).filter(Boolean)
  const addSource    = () => setSources(p => [...p, { stockId: '' }])
  const removeSource = (i: number) => {
    if (sources.length <= 1) return
    setSources(p => p.filter((_, idx) => idx !== i))
  }
  const updateSource = (i: number, v: string) =>
    setSources(p => p.map((s, idx) => idx === i ? { stockId: v } : s))

  // ── Gestion sacs ──────────────────────────────────────────────────────────
  const addSac    = () => { if (sacs.length < 5) setSacs(p => [...p, { stockId: '', poids: '' }]) }
  const removeSac = (i: number) => { if (sacs.length > 1) setSacs(p => p.filter((_, idx) => idx !== i)) }
  const updateSac = (i: number, field: keyof SacLine, v: string) =>
    setSacs(p => p.map((s, idx) => idx === i ? { ...s, [field]: v } : s))

  // ── Calculs ───────────────────────────────────────────────────────────────
  // Total entrée = somme des poids de sacs
  const totalSacs = useMemo(
    () => sacs.reduce((sum, s) => sum + (parseFloat(s.poids) || 0), 0),
    [sacs]
  )

  // En mode multi : total par produit (pour vérification vs dispo)
  const totalParProduit = useMemo((): Record<string, number> => {
    if (isSingle) return {}
    const map: Record<string, number> = {}
    sacs.forEach(sac => {
      if (sac.stockId && parseFloat(sac.poids) > 0) {
        map[sac.stockId] = (map[sac.stockId] || 0) + (parseFloat(sac.poids) || 0)
      }
    })
    return map
  }, [sacs, isSingle])

  const poidsSortie = useMemo(
    () => presses.reduce((s, v) => s + (parseFloat(v) || 0), 0),
    [presses]
  )
  const rendement = useMemo(() => {
    if (totalSacs <= 0 || poidsSortie <= 0) return null
    return ((poidsSortie / totalSacs) * 100).toFixed(1)
  }, [totalSacs, poidsSortie])

  // ── Gestion presses ───────────────────────────────────────────────────────
  const addPresse    = () => { if (presses.length < 4) setPresses(p => [...p, '']) }
  const removePresse = (i: number) => { if (presses.length > 1) setPresses(p => p.filter((_, idx) => idx !== i)) }
  const updatePresse = (i: number, v: string) => setPresses(p => p.map((x, idx) => idx === i ? v : x))

  // ── Mutation ──────────────────────────────────────────────────────────────
  const mutation = useMutation({
    mutationFn: () => {
      // Validation sources
      if (!sources[0].stockId) throw new Error('Sélectionnez au moins un produit en entrée')
      if (!isSingle) {
        for (const s of sources) {
          if (!s.stockId) throw new Error('Tous les produits en entrée doivent être sélectionnés')
        }
      }

      // Validation sacs
      const sacsValides = sacs.filter(s => parseFloat(s.poids) > 0)
      if (sacsValides.length === 0) throw new Error('Renseignez au moins un sac avec un poids')
      if (totalSacs <= 0) throw new Error("Le poids total d'entrée (sacs) doit être > 0")

      // En mode multi : chaque sac doit avoir un produit assigné
      if (!isSingle) {
        const sacsAvecPoids = sacs.filter(s => parseFloat(s.poids) > 0)
        if (sacsAvecPoids.some(s => !s.stockId))
          throw new Error('Assignez un produit à chaque sac')

        // Vérifier dépassement dispo par produit
        for (const [stockId, total] of Object.entries(totalParProduit)) {
          const stock = stocksDisponibles.find(st => st.id_stock === parseInt(stockId))
          if (stock && total > Number(stock.quantite_stock))
            throw new Error(`Dépassement du stock disponible pour ${stock.variete_nom || 'un produit'} (${Number(stock.quantite_stock).toFixed(1)} g dispo)`)
        }
      } else {
        // Mode simple : vérifier dépassement du stock unique
        const stock = stocksDisponibles.find(st => st.id_stock === parseInt(sources[0].stockId))
        if (stock && totalSacs > Number(stock.quantite_stock))
          throw new Error(`Dépassement du stock disponible (${Number(stock.quantite_stock).toFixed(1)} g dispo)`)
      }

      if (!maillage)        throw new Error('Le maillage du sac est obligatoire')
      if (!presses[0])      throw new Error('La passe de presse 1 est obligatoire')
      if (poidsSortie <= 0) throw new Error('Le poids de sortie doit être > 0')

      const get = (arr: string[], i: number) =>
        arr[i] ? parseFloat(arr[i]) || undefined : undefined

      // Construction du payload sources depuis les sacs
      let sourcesPayload: { id_stock: number; quantite: number }[]
      if (isSingle) {
        sourcesPayload = [{ id_stock: parseInt(sources[0].stockId), quantite: totalSacs }]
      } else {
        sourcesPayload = Object.entries(totalParProduit).map(([id, qty]) => ({
          id_stock: parseInt(id),
          quantite: qty,
        }))
      }

      return rosinAPI.create({
        id_stock_source:        sourcesPayload[0].id_stock,
        date_rosinextraction:   date,
        sources:                sourcesPayload,
        temperature_extraction: temperature ? parseInt(temperature) : undefined,
        maillage:               maillage || undefined,
        duree_preheat:          preheat   ? parseInt(preheat)   : undefined,
        duree_extraction:       dureeExtr ? parseInt(dureeExtr) : undefined,
        sac_1_poids:            get(sacs.map(s => s.poids), 0),
        sac_2_poids:            get(sacs.map(s => s.poids), 1),
        sac_3_poids:            get(sacs.map(s => s.poids), 2),
        sac_4_poids:            get(sacs.map(s => s.poids), 3),
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
  const inputCls = "w-full rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm focus:ring-2 focus:ring-grow-500 focus:border-grow-500"

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[92vh]">

        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700 shrink-0">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Nouvelle extraction Rosin</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700">
            <X size={18} />
          </button>
        </div>

        <form
          onSubmit={e => { e.preventDefault(); setError(null); mutation.mutate() }}
          className="overflow-y-auto flex-1 px-6 py-5 space-y-5"
        >

          {/* ── Produits en entrée ─────────────────────────────────────── */}
          <div>
            <div className="flex items-center justify-between mb-2">
              {lbl('Produits en entrée', true)}
              <button type="button" onClick={addSource}
                className="flex items-center gap-1 text-xs text-grow-600 hover:text-grow-800 font-medium">
                <Plus size={12} /> Ajouter un produit
              </button>
            </div>
            <div className="space-y-2">
              {sources.map((src, i) => {
                const stockSel = stocksDisponibles.find(s => s.id_stock === parseInt(src.stockId))
                const dejaUtilise = totalParProduit[src.stockId] || 0
                const depasse = !isSingle && stockSel && dejaUtilise > Number(stockSel.quantite_stock)
                return (
                  <div key={i} className="space-y-1">
                    <div className="flex items-center gap-2">
                      <select
                        value={src.stockId}
                        onChange={e => updateSource(i, e.target.value)}
                        className="flex-1 rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm focus:ring-2 focus:ring-grow-500 bg-white dark:bg-gray-800"
                        required
                      >
                        <option value="">— Produit —</option>
                        {stocksDisponibles.map(s => {
                          const usedElsewhere = selectedSourceIds.includes(String(s.id_stock)) && src.stockId !== String(s.id_stock)
                          return (
                            <option key={s.id_stock} value={s.id_stock} disabled={usedElsewhere}>
                              {s.variete_nom || '(sans variété)'} — {s.type_stock}
                              {s.sous_type_stock ? ` ${s.sous_type_stock}` : ''}
                              {' '}({Number(s.quantite_stock).toFixed(1)} g dispo)
                            </option>
                          )
                        })}
                      </select>
                      {sources.length > 1 && (
                        <button type="button" onClick={() => removeSource(i)}
                          className="p-1 text-gray-300 hover:text-red-500 shrink-0">
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                    {/* Dispo + warning dépassement (calculé depuis les sacs) */}
                    {stockSel && (
                      <p className={`text-xs pl-1 ${depasse ? 'text-red-500' : 'text-gray-400 dark:text-gray-500'}`}>
                        {isSingle
                          ? `Dispo : ${Number(stockSel.quantite_stock).toFixed(1)} g`
                          : <>
                              Dispo : <span className="font-medium">{Number(stockSel.quantite_stock).toFixed(1)} g</span>
                              {dejaUtilise > 0 && (
                                <> · Mis en sacs : <span className={`font-medium ${depasse ? 'text-red-500' : 'text-gray-600 dark:text-gray-300'}`}>{dejaUtilise.toFixed(1)} g</span>
                                  {depasse && <> <AlertTriangle size={10} className="inline" /> Dépassement</>}
                                </>
                              )}
                            </>
                        }
                      </p>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* ── Date ──────────────────────────────────────────────────── */}
          <div>
            {lbl('Date')}
            <input type="date" value={date} onChange={e => setDate(e.target.value)} className={inputCls} required />
          </div>

          {/* ── Paramètres de presse ───────────────────────────────────── */}
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

          {/* ── Sacs d'entrée ──────────────────────────────────────────── */}
          <div>
            <div className="flex items-center justify-between mb-2">
              {lbl('Répartition par sac (g)', true)}
              {sacs.length < 5 && (
                <button type="button" onClick={addSac}
                  className="flex items-center gap-1 text-xs text-grow-600 hover:text-grow-800 font-medium">
                  <Plus size={12} /> Sac {sacs.length + 1}
                </button>
              )}
            </div>
            <div className="space-y-2">
              {sacs.map((sac, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="text-sm text-gray-500 dark:text-gray-400 w-12 shrink-0">Sac {i + 1}</span>

                  {/* Sélecteur produit par sac — uniquement en mode multi-produits */}
                  {!isSingle && (
                    <select
                      value={sac.stockId}
                      onChange={e => updateSac(i, 'stockId', e.target.value)}
                      className="w-36 rounded-lg border border-gray-300 dark:border-gray-600 px-2 py-2 text-xs focus:ring-2 focus:ring-grow-500 bg-white dark:bg-gray-800"
                      required={parseFloat(sac.poids) > 0}
                    >
                      <option value="">— Produit —</option>
                      {sources.filter(s => s.stockId).map(s => {
                        const st = stocksDisponibles.find(st => st.id_stock === parseInt(s.stockId))
                        return st ? (
                          <option key={st.id_stock} value={st.id_stock}>
                            {st.variete_nom || '(sans variété)'}
                          </option>
                        ) : null
                      })}
                    </select>
                  )}

                  <input
                    type="number" min="0" step="0.01" value={sac.poids}
                    onChange={e => updateSac(i, 'poids', e.target.value)}
                    placeholder="0.00"
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

          {/* ── Passes de presse ───────────────────────────────────────── */}
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
          </div>

          {/* ── Notes ─────────────────────────────────────────────────── */}
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
