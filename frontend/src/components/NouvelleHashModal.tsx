import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { X, Loader2, AlertTriangle, Plus, Trash2 } from 'lucide-react'
import { hashAPI, stockAPI } from '../api/stock'
import type { Stock } from '../api/stock'
import { useParametreListe } from '../api/parametres'

const MAILLAGES_ICEOLATOR_FB = ['15µ', '25µ', '45µ', '73µ', '90µ', '160µ', '190µ', '220µ']
const MAILLAGE_POLINATOR     = '120µ'

type TypeExtraction = 'Polinator' | 'Ice-o-lator'

interface Passage    { duree: string }
interface Sac        { maillage: string; poids: string }
interface SourceLine { stockId: string; quantite: string }

interface Props { onClose: () => void }

export default function NouvelleHashModal({ onClose }: Props) {
  const qc    = useQueryClient()
  const today = new Date().toISOString().split('T')[0]
  const { values: maillagesParam } = useParametreListe('maillages_iceolator')
  const MAILLAGES_ICEOLATOR = maillagesParam.length > 0 ? maillagesParam : MAILLAGES_ICEOLATOR_FB

  const { data: stocks = [] } = useQuery<Stock[]>({
    queryKey: ['stock'],
    queryFn:  async () => (await stockAPI.getAll()).data,
  })

  const stocksDispo = useMemo(
    () => stocks.filter(s => s.quantite_stock > 0 && !String(s.type_stock ?? '').startsWith('Hash')),
    [stocks]
  )

  const [typeExtraction, setTypeExtraction] = useState<TypeExtraction>('Polinator')
  const [sources,        setSources]        = useState<SourceLine[]>([{ stockId: '', quantite: '' }])
  const [date,           setDate]           = useState(today)
  const [notes,          setNotes]          = useState('')
  const [error,          setError]          = useState<string | null>(null)

  // Polinator
  const [dureePolinator, setDureePolinator] = useState('')
  const [poidsSortiePol, setPoidsSortiePol] = useState('')

  // Ice-o-lator
  const [sacs,     setSacs]     = useState<Sac[]>([{ maillage: '73µ', poids: '' }])
  const [passages, setPassages] = useState<Passage[]>([{ duree: '' }])

  const isSingle = sources.length === 1

  // ── Gestion sources ───────────────────────────────────────────────────────
  const addSource    = () => setSources(p => [...p, { stockId: '', quantite: '' }])
  const removeSource = (i: number) => { if (sources.length > 1) setSources(p => p.filter((_, x) => x !== i)) }
  const updateSource = (i: number, field: keyof SourceLine, v: string) =>
    setSources(p => p.map((s, x) => x === i ? { ...s, [field]: v } : s))

  const selectedStockIds = sources.map(s => s.stockId).filter(Boolean)

  // ── Calculs ───────────────────────────────────────────────────────────────
  // Si un seul produit → quantité = tout le dispo
  // Si plusieurs produits → somme des quantités saisies
  const poidsEntreeTotal = useMemo(() => {
    if (isSingle) {
      if (!sources[0].stockId) return 0
      const stock = stocksDispo.find(s => s.id_stock === parseInt(sources[0].stockId))
      return stock ? Number(stock.quantite_stock) : 0
    }
    return sources.reduce((sum, s) => sum + (parseFloat(s.quantite) || 0), 0)
  }, [sources, stocksDispo, isSingle])

  const totalSortieIceo = useMemo(
    () => sacs.reduce((s, r) => s + (parseFloat(r.poids) || 0), 0),
    [sacs]
  )
  const rendement = useMemo(() => {
    const sortie = typeExtraction === 'Polinator' ? parseFloat(poidsSortiePol) : totalSortieIceo
    if (!poidsEntreeTotal || !sortie || poidsEntreeTotal <= 0) return null
    return ((sortie / poidsEntreeTotal) * 100).toFixed(1)
  }, [typeExtraction, poidsEntreeTotal, poidsSortiePol, totalSortieIceo])

  // Warnings uniquement en mode multi
  const sourceWarnings = useMemo(() => {
    if (isSingle) return sources.map(() => null)
    return sources.map(s => {
      if (!s.stockId || !s.quantite) return null
      const stock = stocksDispo.find(st => st.id_stock === parseInt(s.stockId))
      if (!stock) return null
      const qty = parseFloat(s.quantite)
      if (qty > Number(stock.quantite_stock))
        return `Dépasse le stock dispo (${Number(stock.quantite_stock).toFixed(1)} g)`
      return null
    })
  }, [sources, stocksDispo, isSingle])

  // ── Gestion sacs Ice-o-lator ──────────────────────────────────────────────
  const addSac    = () => setSacs(p => [...p, { maillage: MAILLAGES_ICEOLATOR[0], poids: '' }])
  const removeSac = (i: number) => { if (sacs.length > 1) setSacs(p => p.filter((_, x) => x !== i)) }
  const updateSac = (i: number, field: keyof Sac, v: string) =>
    setSacs(p => p.map((s, x) => x === i ? { ...s, [field]: v } : s))

  // ── Gestion passages Ice-o-lator ──────────────────────────────────────────
  const addPassage    = () => setPassages(p => [...p, { duree: '' }])
  const removePassage = (i: number) => { if (passages.length > 1) setPassages(p => p.filter((_, x) => x !== i)) }
  const updatePassage = (i: number, v: string) =>
    setPassages(p => p.map((ps, x) => x === i ? { duree: v } : ps))

  // ── Mutation ──────────────────────────────────────────────────────────────
  const mutation = useMutation({
    mutationFn: () => {
      if (!date) throw new Error('La date est obligatoire')

      // Validation sources
      if (isSingle) {
        if (!sources[0].stockId) throw new Error('Sélectionnez un produit en entrée')
        if (poidsEntreeTotal <= 0) throw new Error('Le stock sélectionné est vide')
      } else {
        const sourcesValides = sources.filter(s => s.stockId && parseFloat(s.quantite) > 0)
        if (sourcesValides.length === 0)
          throw new Error('Sélectionnez au moins un produit avec une quantité')
        for (const s of sources) {
          if (s.stockId && !s.quantite)
            throw new Error('Renseignez la quantité pour chaque produit sélectionné')
        }
        if (poidsEntreeTotal <= 0) throw new Error("Le poids total d'entrée doit être > 0")
      }

      // Construction payload sources
      let sourcesPayload: { id_stock: number; quantite: number }[]
      if (isSingle) {
        sourcesPayload = [{ id_stock: parseInt(sources[0].stockId), quantite: poidsEntreeTotal }]
      } else {
        sourcesPayload = sources
          .filter(s => s.stockId && parseFloat(s.quantite) > 0)
          .map(s => ({ id_stock: parseInt(s.stockId), quantite: parseFloat(s.quantite) }))
      }

      if (typeExtraction === 'Polinator') {
        const sortie = parseFloat(poidsSortiePol)
        if (isNaN(sortie) || sortie <= 0) throw new Error('Le poids de sortie doit être > 0')
        return hashAPI.create({
          id_stock_source:     sourcesPayload[0].id_stock,
          date_hashextraction: date,
          type_extraction:     'Polinator',
          sources:             sourcesPayload,
          duree_polinator:     dureePolinator ? parseInt(dureePolinator) : undefined,
          quantite_utilisee:   poidsEntreeTotal,
          quantite_extraite:   sortie,
          info_hashextraction: notes || undefined,
        })
      } else {
        if (totalSortieIceo <= 0)         throw new Error('Au moins un sac doit avoir un poids de sortie')
        if (passages.some(p => !p.duree)) throw new Error('Renseignez la durée de chaque passage')

        const sacsData     = sacs.filter(s => parseFloat(s.poids) > 0)
                                  .map(s => ({ maillage: s.maillage, poids: parseFloat(s.poids) }))
        const passagesData = passages.filter(p => p.duree).map(p => ({ duree: parseInt(p.duree) }))

        return hashAPI.create({
          id_stock_source:     sourcesPayload[0].id_stock,
          date_hashextraction: date,
          type_extraction:     'Ice-o-lator',
          sources:             sourcesPayload,
          sacs:                sacsData,
          passages:            passagesData,
          quantite_utilisee:   poidsEntreeTotal,
          quantite_extraite:   totalSortieIceo,
          info_hashextraction: notes || undefined,
        })
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['hash-extractions'] })
      qc.invalidateQueries({ queryKey: ['hash-stats'] })
      qc.invalidateQueries({ queryKey: ['stock'] })
      onClose()
    },
    onError: (e: Error) => setError(e.message),
  })

  const inputCls = "w-full rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
  const lbl = (txt: string, req = false) => (
    <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
      {txt}{req && <span className="text-red-500 ml-0.5">*</span>}
    </label>
  )

  const maillagesDispos = MAILLAGES_ICEOLATOR.filter(m => !sacs.some(s => s.maillage === m))

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[94vh]">

        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700 shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🍫</span>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Nouvelle extraction Hash</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700">
            <X size={18} />
          </button>
        </div>

        <form
          onSubmit={e => { e.preventDefault(); setError(null); mutation.mutate() }}
          className="overflow-y-auto flex-1 px-6 py-5 space-y-5"
        >

          {/* Type d'extraction */}
          <div className="grid grid-cols-2 gap-2">
            {(['Polinator', 'Ice-o-lator'] as TypeExtraction[]).map(type => (
              <button key={type} type="button" onClick={() => setTypeExtraction(type)}
                className={`py-3 rounded-xl text-sm font-semibold border-2 transition-all ${
                  typeExtraction === type
                    ? 'border-amber-500 bg-amber-50 text-amber-800'
                    : 'border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:border-amber-300'
                }`}>
                {type === 'Polinator' ? '🥁 Polinator' : '🧊 Ice-o-lator'}
              </button>
            ))}
          </div>

          {/* Produits en entrée */}
          <div>
            <div className="flex items-center justify-between mb-2">
              {lbl('Produit(s) en entrée', true)}
              <button type="button" onClick={addSource}
                className="flex items-center gap-1 text-xs text-amber-600 hover:text-amber-800 font-medium">
                <Plus size={12} /> Ajouter un produit
              </button>
            </div>
            <div className="space-y-3">
              {sources.map((src, i) => {
                const stockSel = stocksDispo.find(s => s.id_stock === parseInt(src.stockId))
                return (
                  <div key={i} className="space-y-1">
                    <div className="flex items-center gap-2">
                      <select
                        value={src.stockId}
                        onChange={e => updateSource(i, 'stockId', e.target.value)}
                        className="flex-1 rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm focus:ring-2 focus:ring-amber-400 bg-white dark:bg-gray-800"
                        required
                      >
                        <option value="">— Produit —</option>
                        {stocksDispo.map(s => {
                          const used = selectedStockIds.includes(String(s.id_stock)) && src.stockId !== String(s.id_stock)
                          return (
                            <option key={s.id_stock} value={s.id_stock} disabled={used}>
                              {s.variete_nom || '(sans variété)'} — {s.type_stock}
                              {s.sous_type_stock ? ` ${s.sous_type_stock}` : ''}
                              {' '}({Number(s.quantite_stock).toFixed(1)} g)
                            </option>
                          )
                        })}
                      </select>

                      {/* Quantité saisie uniquement en mode multi-produits */}
                      {!isSingle && (
                        <>
                          <input
                            type="number" min="0" step="0.1" value={src.quantite}
                            onChange={e => updateSource(i, 'quantite', e.target.value)}
                            placeholder="0.0" required
                            className="w-24 rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm focus:ring-2 focus:ring-amber-400 dark:bg-gray-800"
                          />
                          <span className="text-sm text-gray-400 dark:text-gray-500 shrink-0">g</span>
                        </>
                      )}

                      {sources.length > 1 && (
                        <button type="button" onClick={() => removeSource(i)}
                          className="p-1 text-gray-300 hover:text-red-500 shrink-0">
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>

                    {/* En mode simple : affiche le dispo comme info principale */}
                    {isSingle && stockSel && (
                      <p className="text-xs pl-1 text-gray-500 dark:text-gray-400">
                        Total utilisé :{' '}
                        <span className="font-semibold text-gray-800 dark:text-gray-200">
                          {Number(stockSel.quantite_stock).toFixed(1)} g
                        </span>
                        {' '}(tout le stock disponible)
                      </p>
                    )}

                    {/* En mode multi : dispo + warning */}
                    {!isSingle && stockSel && (
                      <p className="text-xs text-gray-400 dark:text-gray-500 pl-1">
                        Dispo : <span className="font-medium text-gray-600 dark:text-gray-300">{Number(stockSel.quantite_stock).toFixed(1)} g</span>
                      </p>
                    )}
                    {sourceWarnings[i] && (
                      <p className="flex items-center gap-1 text-xs text-amber-600 pl-1">
                        <AlertTriangle size={11} /> {sourceWarnings[i]}
                      </p>
                    )}
                  </div>
                )
              })}
            </div>

            {/* Total entrée */}
            {(!isSingle || poidsEntreeTotal > 0) && (
              <div className="mt-3 flex justify-between bg-amber-50 dark:bg-amber-900/20 rounded-lg px-4 py-2">
                <span className="text-sm text-amber-700 dark:text-amber-400">Total entrée</span>
                <span className="text-sm font-semibold text-amber-900 dark:text-amber-200">{poidsEntreeTotal.toFixed(2)} g</span>
              </div>
            )}
          </div>

          {/* Date */}
          <div>
            {lbl('Date', true)}
            <input type="date" value={date} onChange={e => setDate(e.target.value)} className={inputCls} required />
          </div>

          {/* ════ POLINATOR ════ */}
          {typeExtraction === 'Polinator' && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  {lbl('Maillage')}
                  <input value={MAILLAGE_POLINATOR} readOnly
                    className={inputCls + ' bg-gray-50 dark:bg-gray-700/50 text-gray-500 cursor-not-allowed'} />
                </div>
                <div>
                  {lbl('Durée (min)')}
                  <input type="number" min="1" value={dureePolinator}
                    onChange={e => setDureePolinator(e.target.value)}
                    placeholder="ex: 15" className={inputCls} />
                </div>
              </div>
              <div>
                {lbl('Poids sortie (g)', true)}
                <input type="number" min="0" step="0.01" value={poidsSortiePol}
                  onChange={e => setPoidsSortiePol(e.target.value)}
                  placeholder="0.00" className={inputCls} required />
              </div>
            </>
          )}

          {/* ════ ICE-O-LATOR ════ */}
          {typeExtraction === 'Ice-o-lator' && (
            <>
              {/* Passages */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  {lbl('Passages de brassage', true)}
                  <button type="button" onClick={addPassage}
                    className="flex items-center gap-1 text-xs text-amber-600 hover:text-amber-800 font-medium">
                    <Plus size={12} /> Passage {passages.length + 1}
                  </button>
                </div>
                <div className="space-y-2">
                  {passages.map((p, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className="text-sm text-gray-500 dark:text-gray-400 w-20 shrink-0">Passage {i + 1}</span>
                      <input type="number" min="1" step="1" value={p.duree}
                        onChange={e => updatePassage(i, e.target.value)}
                        placeholder="min" required
                        className="flex-1 rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm focus:ring-2 focus:ring-amber-400" />
                      <span className="text-xs text-gray-400 dark:text-gray-500 shrink-0">min</span>
                      {i > 0 && (
                        <button type="button" onClick={() => removePassage(i)} className="p-1 text-gray-300 hover:text-red-500">
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Sacs filtrants */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  {lbl('Sacs filtrants (poids par maillage)', true)}
                  {(maillagesDispos.length > 0 || sacs.length < MAILLAGES_ICEOLATOR.length) && (
                    <button type="button" onClick={addSac}
                      disabled={sacs.length >= MAILLAGES_ICEOLATOR.length}
                      className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium disabled:opacity-40">
                      <Plus size={12} /> Ajouter un sac
                    </button>
                  )}
                </div>
                <div className="space-y-2">
                  {sacs.map((sac, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <select value={sac.maillage}
                        onChange={e => updateSac(i, 'maillage', e.target.value)}
                        className="w-28 shrink-0 rounded-lg border border-gray-300 dark:border-gray-600 px-2 py-2 text-sm focus:ring-2 focus:ring-blue-400">
                        {MAILLAGES_ICEOLATOR.map(m => (
                          (m === sac.maillage || !sacs.some((s, x) => x !== i && s.maillage === m)) && (
                            <option key={m} value={m}>{m}</option>
                          )
                        ))}
                      </select>
                      <input type="number" min="0" step="0.01" value={sac.poids}
                        onChange={e => updateSac(i, 'poids', e.target.value)}
                        placeholder="0.00 g"
                        className="flex-1 rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-400" />
                      <span className="text-sm text-gray-400 dark:text-gray-500 shrink-0">g</span>
                      {sacs.length > 1 && (
                        <button type="button" onClick={() => removeSac(i)} className="p-1 text-gray-300 hover:text-red-500">
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                <div className="mt-2 flex justify-between bg-amber-50 rounded-lg px-4 py-2">
                  <span className="text-sm text-amber-700">Total sortie</span>
                  <span className="text-sm font-semibold text-amber-900">{totalSortieIceo.toFixed(2)} g</span>
                </div>
              </div>
            </>
          )}

          {/* Rendement */}
          {rendement !== null && (
            <div className="flex items-center justify-between bg-green-50 rounded-xl px-4 py-3">
              <span className="text-sm text-green-700">Rendement calculé</span>
              <span className="text-xl font-bold text-green-800">{rendement}%</span>
            </div>
          )}

          {/* Notes */}
          <div>
            {lbl('Notes')}
            <textarea value={notes} onChange={e => setNotes(e.target.value)}
              rows={2} placeholder="Observations, qualité, remarques…"
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
              className="flex-1 px-4 py-2 rounded-xl bg-amber-600 text-white text-sm font-medium hover:bg-amber-700 disabled:opacity-50 flex items-center justify-center gap-2">
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
