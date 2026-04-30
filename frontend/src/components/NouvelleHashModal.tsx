import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { X, Loader2, AlertTriangle, Plus, Trash2 } from 'lucide-react'
import { hashAPI, stockAPI } from '../api/stock'
import type { Stock } from '../api/stock'
import { useParametreListe } from '../api/parametres'

// ── Fallbacks statiques ─────────────────────────────────────────────────────
const MAILLAGES_ICEOLATOR_FB = ['15µ', '25µ', '45µ', '73µ', '90µ', '160µ', '190µ', '220µ']
const MAILLAGE_POLINATOR     = '120µ'

type TypeExtraction = 'Polinator' | 'Ice-o-lator'

interface Passage { duree: string }
interface Sac     { maillage: string; poids: string }

interface Props { onClose: () => void }

export default function NouvelleHashModal({ onClose }: Props) {
  const qc    = useQueryClient()
  const today = new Date().toISOString().split('T')[0]
  const { values: maillagesParam }  = useParametreListe('maillages_iceolator')
  const MAILLAGES_ICEOLATOR = maillagesParam.length > 0 ? maillagesParam : MAILLAGES_ICEOLATOR_FB

  // ── Stock disponible ───────────────────────────────────────────────────
  const { data: stocks = [] } = useQuery<Stock[]>({
    queryKey: ['stock'],
    queryFn:  async () => (await stockAPI.getAll()).data,
  })

  // Stocks utilisables : tout sauf les types Hash
  const stocksDispo = useMemo(
    () => stocks.filter(s => s.quantite_stock > 0 && !String(s.type_stock ?? '').startsWith('Hash')),
    [stocks]
  )

  // ── Formulaire commun ─────────────────────────────────────────────────
  const [typeExtraction, setTypeExtraction] = useState<TypeExtraction>('Polinator')
  const [stockId,        setStockId]        = useState('')
  const [date,           setDate]           = useState(today)
  const [notes,          setNotes]          = useState('')
  const [error,          setError]          = useState<string | null>(null)

  // ── Polinator ─────────────────────────────────────────────────────────
  const [dureePolinator, setDureePolinator] = useState('')
  const [poidsEntreePol, setPoidsEntreePol] = useState('')
  const [poidsSortiePol, setPoidsSortiePol] = useState('')

  // ── Ice-o-lator ────────────────────────────────────────────────────────
  const [sacs,      setSacs]      = useState<Sac[]>([{ maillage: '73µ', poids: '' }])
  const [passages,  setPassages]  = useState<Passage[]>([{ duree: '' }])
  const [poidsEntreeIceo, setPoidsEntreeIceo] = useState('')

  // ── Stock sélectionné ─────────────────────────────────────────────────
  const stockSelected = useMemo(
    () => stocksDispo.find(s => s.id_stock === parseInt(stockId)),
    [stocksDispo, stockId]
  )

  // ── Calculs Ice-o-lator ────────────────────────────────────────────────
  const totalSortieIceo = useMemo(
    () => sacs.reduce((s, r) => s + (parseFloat(r.poids) || 0), 0),
    [sacs]
  )

  const rendement = useMemo(() => {
    const entree = typeExtraction === 'Polinator'
      ? parseFloat(poidsEntreePol)
      : parseFloat(poidsEntreeIceo)
    const sortie = typeExtraction === 'Polinator'
      ? parseFloat(poidsSortiePol)
      : totalSortieIceo
    if (!entree || !sortie || entree <= 0) return null
    return ((sortie / entree) * 100).toFixed(1)
  }, [typeExtraction, poidsEntreePol, poidsSortiePol, poidsEntreeIceo, totalSortieIceo])

  // ── Gestion sacs Ice-o-lator ───────────────────────────────────────────
  const addSac    = () => setSacs(p => [...p, { maillage: MAILLAGES_ICEOLATOR[0], poids: '' }])
  const removeSac = (i: number) => { if (sacs.length > 1) setSacs(p => p.filter((_, x) => x !== i)) }
  const updateSac = (i: number, field: keyof Sac, v: string) =>
    setSacs(p => p.map((s, x) => x === i ? { ...s, [field]: v } : s))

  // ── Gestion passages Ice-o-lator ───────────────────────────────────────
  const addPassage    = () => setPassages(p => [...p, { duree: '' }])
  const removePassage = (i: number) => { if (passages.length > 1) setPassages(p => p.filter((_, x) => x !== i)) }
  const updatePassage = (i: number, v: string) =>
    setPassages(p => p.map((ps, x) => x === i ? { duree: v } : ps))

  // ── Mutation ──────────────────────────────────────────────────────────
  const mutation = useMutation({
    mutationFn: () => {
      if (!stockId) throw new Error('Sélectionnez un produit en stock')
      if (!date)    throw new Error('La date est obligatoire')

      if (typeExtraction === 'Polinator') {
        const entree = parseFloat(poidsEntreePol)
        const sortie = parseFloat(poidsSortiePol)
        if (isNaN(entree) || entree <= 0) throw new Error('Le poids d\'entrée doit être > 0')
        if (isNaN(sortie) || sortie <= 0) throw new Error('Le poids de sortie doit être > 0')
        return hashAPI.create({
          id_stock_source:     parseInt(stockId),
          date_hashextraction: date,
          type_extraction:     'Polinator',
          duree_polinator:     dureePolinator ? parseInt(dureePolinator) : undefined,
          quantite_utilisee:   entree,
          quantite_extraite:   sortie,
          info_hashextraction: notes || undefined,
        })
      } else {
        const entree = parseFloat(poidsEntreeIceo)
        if (isNaN(entree) || entree <= 0)  throw new Error('Le poids d\'entrée doit être > 0')
        if (totalSortieIceo <= 0)          throw new Error('Au moins un sac doit avoir un poids de sortie')
        if (passages.some(p => !p.duree))  throw new Error('Renseignez la durée de chaque passage')

        const sacsData = sacs
          .filter(s => parseFloat(s.poids) > 0)
          .map(s => ({ maillage: s.maillage, poids: parseFloat(s.poids) }))

        const passagesData = passages
          .filter(p => p.duree)
          .map(p => ({ duree: parseInt(p.duree) }))

        return hashAPI.create({
          id_stock_source:     parseInt(stockId),
          date_hashextraction: date,
          type_extraction:     'Ice-o-lator',
          sacs:                sacsData,
          passages:            passagesData,
          quantite_utilisee:   entree,
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

  const inputCls = "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
  const lbl = (txt: string, req = false) => (
    <label className="block text-sm font-medium text-gray-700 mb-1">
      {txt}{req && <span className="text-red-500 ml-0.5">*</span>}
    </label>
  )

  const maillagesDispos = MAILLAGES_ICEOLATOR.filter(m => !sacs.some(s => s.maillage === m))

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[94vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🍫</span>
            <h2 className="text-lg font-semibold text-gray-900">Nouvelle extraction Hash</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100">
            <X size={18} />
          </button>
        </div>

        <form
          onSubmit={e => { e.preventDefault(); setError(null); mutation.mutate() }}
          className="overflow-y-auto flex-1 px-6 py-5 space-y-5"
        >

          {/* ── Sélection du type ──────────────────────────────────────── */}
          <div className="grid grid-cols-2 gap-2">
            {(['Polinator', 'Ice-o-lator'] as TypeExtraction[]).map(type => (
              <button
                key={type}
                type="button"
                onClick={() => setTypeExtraction(type)}
                className={`py-3 rounded-xl text-sm font-semibold border-2 transition-all ${
                  typeExtraction === type
                    ? 'border-amber-500 bg-amber-50 text-amber-800'
                    : 'border-gray-200 text-gray-500 hover:border-amber-300'
                }`}
              >
                {type === 'Polinator' ? '🥁 Polinator' : '🧊 Ice-o-lator'}
              </button>
            ))}
          </div>

          {/* ── Stock source ───────────────────────────────────────────── */}
          <div>
            {lbl('Produit en stock', true)}
            <select value={stockId} onChange={e => setStockId(e.target.value)} className={inputCls} required>
              <option value="">— Sélectionner —</option>
              {stocksDispo.map(s => (
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

          {/* ── Date ───────────────────────────────────────────────────── */}
          <div>
            {lbl('Date', true)}
            <input type="date" value={date} onChange={e => setDate(e.target.value)} className={inputCls} required />
          </div>

          {/* ════════════════ POLINATOR ════════════════ */}
          {typeExtraction === 'Polinator' && (
            <>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  {lbl('Maillage')}
                  <input
                    value={MAILLAGE_POLINATOR}
                    readOnly
                    className={inputCls + ' bg-gray-50 text-gray-500 cursor-not-allowed'}
                  />
                </div>
                <div>
                  {lbl('Durée (min)')}
                  <input
                    type="number" min="1" value={dureePolinator}
                    onChange={e => setDureePolinator(e.target.value)}
                    placeholder="ex: 15" className={inputCls}
                  />
                </div>
                <div>
                  {lbl('Entrée (g)', true)}
                  <input
                    type="number" min="0" step="0.1" value={poidsEntreePol}
                    onChange={e => setPoidsEntreePol(e.target.value)}
                    placeholder="0.0" className={inputCls} required
                  />
                </div>
              </div>

              <div>
                {lbl('Sortie (g)', true)}
                <input
                  type="number" min="0" step="0.01" value={poidsSortiePol}
                  onChange={e => setPoidsSortiePol(e.target.value)}
                  placeholder="0.00" className={inputCls} required
                />
              </div>

              {/* Avertissement stock */}
              {stockSelected && parseFloat(poidsEntreePol) > Number(stockSelected.quantite_stock) && (
                <div className="flex items-center gap-2 text-sm text-amber-600 bg-amber-50 rounded-lg px-4 py-2">
                  <AlertTriangle size={14} />
                  Poids entrée supérieur au stock disponible ({Number(stockSelected.quantite_stock).toFixed(1)} g)
                </div>
              )}
            </>
          )}

          {/* ════════════════ ICE-O-LATOR ════════════════ */}
          {typeExtraction === 'Ice-o-lator' && (
            <>
              {/* Poids d'entrée */}
              <div>
                {lbl('Poids d\'entrée total (g)', true)}
                <input
                  type="number" min="0" step="0.1" value={poidsEntreeIceo}
                  onChange={e => setPoidsEntreeIceo(e.target.value)}
                  placeholder="0.0" className={inputCls} required
                />
                {stockSelected && parseFloat(poidsEntreeIceo) > Number(stockSelected.quantite_stock) && (
                  <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
                    <AlertTriangle size={11} />
                    Supérieur au stock disponible ({Number(stockSelected.quantite_stock).toFixed(1)} g)
                  </p>
                )}
              </div>

              {/* Passages */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  {lbl('Passages de brassage', true)}
                  <button
                    type="button" onClick={addPassage}
                    className="flex items-center gap-1 text-xs text-amber-600 hover:text-amber-800 font-medium"
                  >
                    <Plus size={12} /> Passage {passages.length + 1}
                  </button>
                </div>
                <div className="space-y-2">
                  {passages.map((p, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className="text-sm text-gray-500 w-20 shrink-0">Passage {i + 1}</span>
                      <input
                        type="number" min="1" step="1" value={p.duree}
                        onChange={e => updatePassage(i, e.target.value)}
                        placeholder="min" required
                        className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-amber-400"
                      />
                      <span className="text-xs text-gray-400 shrink-0">min</span>
                      {i > 0 && (
                        <button type="button" onClick={() => removePassage(i)} className="p-1 text-gray-300 hover:text-red-500">
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Sacs / maillages */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  {lbl('Sacs filtrants (poids par maillage)', true)}
                  {(maillagesDispos.length > 0 || sacs.length < MAILLAGES_ICEOLATOR.length) && (
                    <button
                      type="button" onClick={addSac}
                      disabled={sacs.length >= MAILLAGES_ICEOLATOR.length}
                      className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium disabled:opacity-40"
                    >
                      <Plus size={12} /> Ajouter un sac
                    </button>
                  )}
                </div>
                <div className="space-y-2">
                  {sacs.map((sac, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <select
                        value={sac.maillage}
                        onChange={e => updateSac(i, 'maillage', e.target.value)}
                        className="w-28 shrink-0 rounded-lg border border-gray-300 px-2 py-2 text-sm focus:ring-2 focus:ring-blue-400"
                      >
                        {MAILLAGES_ICEOLATOR.map(m => (
                          // Afficher le maillage courant + ceux non encore utilisés
                          (m === sac.maillage || !sacs.some((s, x) => x !== i && s.maillage === m)) && (
                            <option key={m} value={m}>{m}</option>
                          )
                        ))}
                      </select>
                      <input
                        type="number" min="0" step="0.01" value={sac.poids}
                        onChange={e => updateSac(i, 'poids', e.target.value)}
                        placeholder="0.00 g"
                        className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-400"
                      />
                      <span className="text-sm text-gray-400 shrink-0">g</span>
                      {sacs.length > 1 && (
                        <button type="button" onClick={() => removeSac(i)} className="p-1 text-gray-300 hover:text-red-500">
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                {/* Total sortie */}
                <div className="mt-2 flex justify-between bg-amber-50 rounded-lg px-4 py-2">
                  <span className="text-sm text-amber-700">Total sortie</span>
                  <span className="text-sm font-semibold text-amber-900">{totalSortieIceo.toFixed(2)} g</span>
                </div>
              </div>
            </>
          )}

          {/* ── Rendement calculé ─────────────────────────────────────── */}
          {rendement !== null && (
            <div className="flex items-center justify-between bg-green-50 rounded-xl px-4 py-3">
              <span className="text-sm text-green-700">Rendement calculé</span>
              <span className="text-xl font-bold text-green-800">{rendement}%</span>
            </div>
          )}

          {/* ── Notes ─────────────────────────────────────────────────── */}
          <div>
            {lbl('Notes')}
            <textarea
              value={notes} onChange={e => setNotes(e.target.value)}
              rows={2} placeholder="Observations, qualité, remarques…"
              className={inputCls + ' resize-none'}
            />
          </div>

          {/* ── Erreur ────────────────────────────────────────────────── */}
          {error && (
            <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 rounded-lg px-4 py-2">
              <AlertTriangle size={14} /> {error}
            </div>
          )}

          {/* ── Actions ───────────────────────────────────────────────── */}
          <div className="flex gap-3 pt-1 pb-1">
            <button type="button" onClick={onClose}
              className="flex-1 px-4 py-2 rounded-xl border border-gray-300 text-gray-700 text-sm font-medium hover:bg-gray-50">
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
