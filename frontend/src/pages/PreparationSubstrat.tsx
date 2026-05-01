import { useState, useMemo } from 'react'
import { Plus, Trash2, ChevronRight, ChevronLeft, Save, Printer, History, X } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { recetteLSOAPI, RecetteLSO } from '../api/recetteLSO'
import { parametresAPI, ParametreValeur } from '../api/parametres'
import {
  preparationSubstratAPI,
  PreparationSubstrat as PreparationSubstratRecord,
  PotConfig,
  IngredientResult,
  PreparationSubstratCreate,
} from '../api/preparationSubstrat'

// ─── Constantes coco ──────────────────────────────────────────────────────────
const COCO_EXPANSION_RATIO = 5     // 1 cm³ compressé → 5 cm³ expansé (estimation standard)
const COCO_L_PER_KG       = 6     // ~6 L de coco expansé par kg de brique

// ─── Types locaux ─────────────────────────────────────────────────────────────
interface PotRow {
  id: number
  volume_l: string
  nb: string
}

interface CocoConfig {
  type: 'vrac' | 'brique'
  // brique dimensions
  brique_l_cm: string
  brique_w_cm: string
  brique_h_cm: string
  // brique poids
  brique_poids_g: string
  // input mode
  brique_input: 'dimensions' | 'poids'
}

function emptyCocoConfig(): CocoConfig {
  return {
    type: 'vrac',
    brique_l_cm: '', brique_w_cm: '', brique_h_cm: '',
    brique_poids_g: '',
    brique_input: 'dimensions',
  }
}

// ─── Calcul volume brique → litres expansés ───────────────────────────────────
function calcBriqueL(cfg: CocoConfig): number {
  if (cfg.brique_input === 'poids') {
    const g = parseFloat(cfg.brique_poids_g)
    if (!g || g <= 0) return 0
    return (g / 1000) * COCO_L_PER_KG
  }
  const l = parseFloat(cfg.brique_l_cm)
  const w = parseFloat(cfg.brique_w_cm)
  const h = parseFloat(cfg.brique_h_cm)
  if (!l || !w || !h) return 0
  return (l * w * h * COCO_EXPANSION_RATIO) / 1000   // cm³ → L
}

// ─── Badge type sol ───────────────────────────────────────────────────────────
function TypeSolBadge({ type }: { type: string }) {
  const cls =
    type.toLowerCase().includes('vivant') || type.toLowerCase().includes('lso')
      ? 'bg-green-100 text-green-700'
      : type.toLowerCase().includes('coco') && type.toLowerCase().includes('terre')
      ? 'bg-amber-100 text-amber-700'
      : type.toLowerCase().includes('coco')
      ? 'bg-orange-100 text-orange-700'
      : 'bg-stone-100 text-stone-700'
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${cls}`}>
      {type}
    </span>
  )
}

// ─── Historique modal ─────────────────────────────────────────────────────────
function HistoriqueModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient()
  const { data: history = [], isLoading } = useQuery<PreparationSubstratRecord[]>({
    queryKey: ['prep-substrat'],
    queryFn: async () => (await preparationSubstratAPI.getAll()).data,
  })

  const deleteMut = useMutation({
    mutationFn: (id: number) => preparationSubstratAPI.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['prep-substrat'] }),
  })

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-3">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Historique des préparations</h2>
          <button onClick={onClose} className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:text-gray-300"><X size={20} /></button>
        </div>
        <div className="overflow-y-auto flex-1 p-4 space-y-3">
          {isLoading ? (
            <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-8">Chargement...</p>
          ) : history.length === 0 ? (
            <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-8">Aucune préparation enregistrée</p>
          ) : (
            history.map(h => (
              <div key={h.id_preparation} className="border border-gray-200 dark:border-gray-700 rounded-xl p-4">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                        {new Date(h.date_preparation + 'T12:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
                      </span>
                      <span className="text-sm font-bold text-grow-600">{h.volume_total_l} L</span>
                      {h.type_sol && <TypeSolBadge type={h.type_sol} />}
                    </div>
                    {h.nom_recette_lso && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500 mt-0.5">🌿 {h.nom_recette_lso}</p>
                    )}
                  </div>
                  <button
                    onClick={() => { if (confirm('Supprimer cette préparation ?')) deleteMut.mutate(h.id_preparation) }}
                    className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
                {/* Config pots */}
                {h.configuration_pots && h.configuration_pots.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {h.configuration_pots.map((p, i) => (
                      <span key={i} className="px-2 py-0.5 rounded bg-gray-100 text-xs text-gray-600 dark:text-gray-300">
                        {p.nb} × {p.volume_l} L
                      </span>
                    ))}
                  </div>
                )}
                {/* Ingrédients */}
                {h.resultat && h.resultat.length > 0 && (
                  <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
                    {h.resultat.map((r, i) => (
                      <div key={i} className="flex items-center justify-between text-xs">
                        <span className="text-gray-600 dark:text-gray-300">{r.label}</span>
                        <span className="font-mono font-semibold text-gray-800 dark:text-gray-100">
                          {r.quantite % 1 === 0 ? r.quantite : r.quantite.toFixed(2)} {r.unite}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
                {h.notes && <p className="text-xs text-gray-400 dark:text-gray-500 mt-2 italic">{h.notes}</p>}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Page principale ──────────────────────────────────────────────────────────
export default function PreparationSubstrat() {
  const qc = useQueryClient()

  // ── Étape du wizard ──
  const [step, setStep] = useState<1 | 2>(1)
  const [showHistorique, setShowHistorique] = useState(false)
  const [saved, setSaved] = useState(false)

  // ── Étape 1 : pots ──
  const [pots, setPots] = useState<PotRow[]>([
    { id: 1, volume_l: '11', nb: '1' },
  ])
  const nextId = () => Date.now()

  function addPot() {
    setPots(prev => [...prev, { id: nextId(), volume_l: '', nb: '1' }])
  }
  function removePot(id: number) {
    setPots(prev => prev.filter(p => p.id !== id))
  }
  function updatePot(id: number, field: 'volume_l' | 'nb', val: string) {
    setPots(prev => prev.map(p => p.id === id ? { ...p, [field]: val } : p))
  }

  const volumeTotal = useMemo(() => {
    return pots.reduce((sum, p) => {
      const v = parseFloat(p.volume_l)
      const n = parseInt(p.nb)
      if (!v || !n) return sum
      return sum + v * n
    }, 0)
  }, [pots])

  // ── Étape 2 : recette ──
  const [typeSol, setTypeSol] = useState('')
  const [idRecetteLSO, setIdRecetteLSO] = useState<number | ''>('')
  const [percentCoco, setPercentCoco] = useState('50')
  const [cocoConfig, setCocoConfig] = useState<CocoConfig>(emptyCocoConfig())
  const [notes, setNotes] = useState('')

  const { data: typesSol = [] } = useQuery<ParametreValeur[]>({
    queryKey: ['parametres', 'types_sol_preparation'],
    queryFn: async () => (await parametresAPI.getList('types_sol_preparation')).data,
  })

  const { data: recettesLSO = [] } = useQuery<RecetteLSO[]>({
    queryKey: ['recettes-lso'],
    queryFn: async () => (await recetteLSOAPI.getAll()).data,
  })

  // ── Calcul résultats ──
  const result = useMemo<IngredientResult[]>(() => {
    if (!typeSol || volumeTotal <= 0) return []

    const isLSO   = typeSol.toLowerCase().includes('vivant') || typeSol.toLowerCase().includes('lso')
    const isCoco  = typeSol.toLowerCase().includes('coco')
    const isTerre = typeSol.toLowerCase().includes('terre') && !isCoco
    const isMix   = typeSol.toLowerCase().includes('coco') && typeSol.toLowerCase().includes('terre')

    if (isLSO && !isMix) {
      // ── Sol vivant → scale recette LSO ──
      const recette = recettesLSO.find(r => r.id_recette_lso === idRecetteLSO)
      if (!recette) return [{ label: 'Sélectionnez une recette LSO', quantite: 0, unite: '' }]
      const baseVol = recette.quantite_totale
      if (!baseVol || baseVol <= 0) return [{ label: '⚠️ Volume de base manquant dans la recette', quantite: 0, unite: '' }]
      const factor = volumeTotal / baseVol
      return recette.lignes.map(l => ({
        label: l.nom_produit ?? `Produit #${l.id_produit}`,
        quantite: parseFloat((l.quantite * factor).toFixed(3)),
        unite: l.unite ?? 'unité',
      }))
    }

    if (isMix) {
      // ── Coco + Terre ──
      const pctCoco  = Math.min(100, Math.max(0, parseFloat(percentCoco) || 50))
      const volCoco  = volumeTotal * pctCoco / 100
      const volTerre = volumeTotal - volCoco
      const cocoResults = buildCocoResult(volCoco, cocoConfig)
      return [
        ...cocoResults,
        { label: '🌱 Terre', quantite: parseFloat(volTerre.toFixed(2)), unite: 'L' },
      ]
    }

    if (isCoco) {
      // ── Coco seul ──
      return buildCocoResult(volumeTotal, cocoConfig)
    }

    if (isTerre) {
      // ── Terre seule ──
      return [{ label: '🌱 Terre', quantite: parseFloat(volumeTotal.toFixed(2)), unite: 'L' }]
    }

    return []
  }, [typeSol, volumeTotal, idRecetteLSO, recettesLSO, percentCoco, cocoConfig])

  function buildCocoResult(volCoco: number, cfg: CocoConfig): IngredientResult[] {
    if (cfg.type === 'vrac') {
      return [{ label: '🥥 Coco (vrac)', quantite: parseFloat(volCoco.toFixed(2)), unite: 'L' }]
    }
    // Brique
    const litresParBrique = calcBriqueL(cfg)
    if (litresParBrique <= 0) {
      return [
        { label: '🥥 Coco (briques)', quantite: parseFloat(volCoco.toFixed(2)), unite: 'L' },
        { label: '⚠️ Saisissez les dimensions ou le poids de la brique', quantite: 0, unite: '' },
      ]
    }
    const nbBriques = Math.ceil(volCoco / litresParBrique)
    return [
      { label: '🥥 Coco (briques)', quantite: parseFloat(volCoco.toFixed(2)), unite: 'L' },
      {
        label: `   ↳ briques (≈${litresParBrique.toFixed(1)} L/brique)`,
        quantite: nbBriques,
        unite: 'brique' + (nbBriques > 1 ? 's' : ''),
      },
    ]
  }

  // ── Sauvegarde ──
  const saveMut = useMutation({
    mutationFn: (data: PreparationSubstratCreate) => preparationSubstratAPI.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['prep-substrat'] })
      setSaved(true)
    },
  })

  function handleSave() {
    const recette = recettesLSO.find(r => r.id_recette_lso === idRecetteLSO)
    const potsConfig: PotConfig[] = pots
      .filter(p => parseFloat(p.volume_l) > 0 && parseInt(p.nb) > 0)
      .map(p => ({ volume_l: parseFloat(p.volume_l), nb: parseInt(p.nb) }))

    saveMut.mutate({
      volume_total_l: volumeTotal,
      type_sol: typeSol || undefined,
      id_recette_lso: idRecetteLSO !== '' ? idRecetteLSO : undefined,
      nom_recette_lso: recette?.nom_recette,
      configuration_pots: potsConfig,
      resultat: result.filter(r => r.quantite > 0),
      notes: notes || undefined,
    })
  }

  function handlePrint() {
    const potsResume = pots
      .filter(p => parseFloat(p.volume_l) > 0 && parseInt(p.nb) > 0)
      .map(p => `${p.nb} × ${p.volume_l} L`)
      .join('  |  ')

    const recette = recettesLSO.find(r => r.id_recette_lso === idRecetteLSO)

    const lignesHtml = result
      .filter(r => r.quantite > 0)
      .map(r => {
        const isSubline = r.label.startsWith('   ↳')
        const qty = r.quantite % 1 === 0 ? r.quantite : r.quantite.toFixed(2)
        return `
          <tr style="page-break-inside:avoid; break-inside:avoid; border-bottom:1px solid #e5e7eb;">
            <td style="padding:8px 4px; color:${isSubline ? '#9ca3af' : '#111827'}; padding-left:${isSubline ? '24px' : '4px'};">
              ${r.label.trim()}
            </td>
            <td style="padding:8px 4px; text-align:right; font-weight:600; font-family:monospace; color:#16a34a;">
              ${qty} ${r.unite}
            </td>
          </tr>`
      }).join('')

    const html = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <title>Préparer un substrat — GrowManager</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, sans-serif; font-size: 12pt; color: #111; padding: 32px; }
    h1 { font-size: 20pt; font-weight: bold; margin-bottom: 4px; }
    .subtitle { color: #6b7280; font-size: 10pt; margin-bottom: 24px; }
    .meta { display: flex; gap: 24px; background: #f0fdf4; border: 1px solid #bbf7d0;
            border-radius: 8px; padding: 16px 20px; margin-bottom: 20px; }
    .meta-item { display: flex; flex-direction: column; gap: 2px; }
    .meta-label { font-size: 9pt; color: #6b7280; }
    .meta-value { font-size: 14pt; font-weight: bold; color: #15803d; }
    .meta-pots  { font-size: 9pt; color: #374151; margin-top: 4px; }
    h2 { font-size: 13pt; font-weight: 600; margin-bottom: 12px; color: #111; }
    table { width: 100%; border-collapse: collapse; }
    thead th { background: #f9fafb; padding: 8px 4px; text-align: left;
               font-size: 9pt; color: #6b7280; text-transform: uppercase; border-bottom: 2px solid #e5e7eb; }
    thead th:last-child { text-align: right; }
    .footer { margin-top: 24px; font-size: 9pt; color: #9ca3af; border-top: 1px solid #e5e7eb; padding-top: 10px; }
    @media print {
      body { padding: 16px; }
      @page { margin: 16mm; size: A4; }
    }
  </style>
</head>
<body>
  <h1>🪴 Préparer un substrat</h1>
  <p class="subtitle">GrowManager — ${new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}</p>

  <div class="meta">
    <div class="meta-item">
      <span class="meta-label">Volume total</span>
      <span class="meta-value">${volumeTotal.toFixed(1)} L</span>
    </div>
    <div class="meta-item">
      <span class="meta-label">Type de sol</span>
      <span class="meta-value" style="font-size:12pt;">${typeSol || '—'}</span>
      ${recette ? `<span class="meta-pots">🌿 ${recette.nom_recette}</span>` : ''}
    </div>
    <div class="meta-item" style="flex:1;">
      <span class="meta-label">Configuration pots</span>
      <span class="meta-pots" style="font-size:11pt; margin-top:2px;">${potsResume}</span>
    </div>
  </div>

  <h2>✅ Ingrédients à préparer</h2>
  <table>
    <thead>
      <tr>
        <th>Ingrédient</th>
        <th style="text-align:right;">Quantité</th>
      </tr>
    </thead>
    <tbody>${lignesHtml}</tbody>
  </table>

  ${notes ? `<div class="footer">📝 Notes : ${notes}</div>` : ''}
  <div class="footer" style="margin-top:${notes ? '8px' : '24px'};">Généré par GrowManager</div>
</body>
</html>`

    const win = window.open('', '_blank', 'width=800,height=900')
    if (!win) return
    win.document.write(html)
    win.document.close()
    win.focus()
    setTimeout(() => { win.print() }, 400)
  }

  // ── Helpers affichage ──
  const isLSOMode = typeSol.toLowerCase().includes('vivant') || typeSol.toLowerCase().includes('lso')
  const isCocoMode = typeSol.toLowerCase().includes('coco')
  const isMixMode = isCocoMode && typeSol.toLowerCase().includes('terre')
  const step1Valid = volumeTotal > 0 && pots.every(p => !p.volume_l || parseFloat(p.volume_l) > 0)

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      {/* ── Titre + bouton historique ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Préparer un substrat</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500 mt-0.5">
            Calculez les quantités de sol et ingrédients à préparer
          </p>
        </div>
        <button
          onClick={() => setShowHistorique(true)}
          className="flex items-center gap-1.5 px-3 py-2 text-sm text-gray-600 dark:text-gray-300 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/40 transition-colors"
        >
          <History size={15} />
          Historique
        </button>
      </div>

      {/* ── Indicateur étapes ── */}
      <div className="flex items-center gap-3">
        {[1, 2].map(s => (
          <div key={s} className="flex items-center gap-2">
            <div
              className={`w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${
                step === s ? 'bg-grow-600 text-white' : step > s ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-500 dark:text-gray-400 dark:text-gray-500'
              }`}
            >
              {step > s ? '✓' : s}
            </div>
            <span className={`text-sm ${step === s ? 'font-medium text-gray-900 dark:text-gray-100' : 'text-gray-400 dark:text-gray-500'}`}>
              {s === 1 ? 'Configuration des pots' : 'Recette & résultat'}
            </span>
            {s < 2 && <ChevronRight size={14} className="text-gray-300" />}
          </div>
        ))}
      </div>

      {/* ════════════════════════════════════════════════════════════
          ÉTAPE 1 — Configuration des pots
      ════════════════════════════════════════════════════════════ */}
      {step === 1 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-6 space-y-5">
          <h2 className="text-base font-semibold text-gray-800 dark:text-gray-100">🪴 Combien de pots, de quel volume ?</h2>

          {/* Tableau des pots */}
          <div className="space-y-2">
            {pots.map((pot, idx) => (
              <div key={pot.id} className="flex items-center gap-3">
                <span className="text-xs text-gray-400 dark:text-gray-500 w-5 text-right">{idx + 1}.</span>

                {/* Nombre */}
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => {
                      const n = Math.max(1, parseInt(pot.nb || '1') - 1)
                      updatePot(pot.id, 'nb', String(n))
                    }}
                    className="w-7 h-7 rounded border border-gray-300 dark:border-gray-600 flex items-center justify-center text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 text-lg font-light"
                  >−</button>
                  <input
                    type="number"
                    min={1}
                    value={pot.nb}
                    onChange={e => updatePot(pot.id, 'nb', e.target.value)}
                    className="w-12 text-center px-1 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:ring-2 focus:ring-grow-500 focus:border-transparent"
                  />
                  <button
                    onClick={() => updatePot(pot.id, 'nb', String(parseInt(pot.nb || '0') + 1))}
                    className="w-7 h-7 rounded border border-gray-300 dark:border-gray-600 flex items-center justify-center text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 text-lg font-light"
                  >+</button>
                  <span className="text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500">pot{parseInt(pot.nb) > 1 ? 's' : ''} de</span>
                </div>

                {/* Volume */}
                <div className="flex items-center gap-1.5 flex-1">
                  <input
                    type="number"
                    min={0.5}
                    step={0.5}
                    value={pot.volume_l}
                    onChange={e => updatePot(pot.id, 'volume_l', e.target.value)}
                    placeholder="Volume"
                    className="w-24 px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:ring-2 focus:ring-grow-500 focus:border-transparent"
                  />
                  <span className="text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500">L</span>
                  {pot.volume_l && pot.nb && (
                    <span className="text-xs text-gray-400 dark:text-gray-500 ml-1">
                      = {(parseFloat(pot.volume_l) * parseInt(pot.nb)).toFixed(1)} L
                    </span>
                  )}
                </div>

                {/* Supprimer */}
                {pots.length > 1 && (
                  <button
                    onClick={() => removePot(pot.id)}
                    className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            ))}
          </div>

          {/* Ajouter une ligne */}
          <button
            onClick={addPot}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500 border border-dashed rounded-lg hover:border-grow-600 hover:text-grow-600 transition-colors"
          >
            <Plus size={13} /> Ajouter un format de pot
          </button>

          {/* Résumé volume total */}
          {volumeTotal > 0 && (
            <div className="bg-grow-50 border border-grow-200 rounded-xl p-4">
              <p className="text-sm text-gray-600 dark:text-gray-300">Volume total de substrat à préparer :</p>
              <p className="text-3xl font-bold text-grow-700 mt-1">{volumeTotal.toFixed(1)} L</p>
              <div className="flex flex-wrap gap-1.5 mt-2">
                {pots.filter(p => parseFloat(p.volume_l) > 0 && parseInt(p.nb) > 0).map((p, i) => (
                  <span key={i} className="px-2 py-0.5 rounded-full bg-white dark:bg-gray-800 border border-grow-200 text-xs text-gray-600 dark:text-gray-300">
                    {p.nb} × {p.volume_l} L
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Navigation */}
          <div className="flex justify-end pt-2">
            <button
              onClick={() => setStep(2)}
              disabled={!step1Valid || volumeTotal <= 0}
              className="flex items-center gap-2 px-5 py-2.5 bg-grow-600 text-white rounded-lg font-medium text-sm hover:bg-grow-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Choisir la recette <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════
          ÉTAPE 2 — Recette & résultat
      ════════════════════════════════════════════════════════════ */}
      {step === 2 && (
        <div className="space-y-4">
          {/* Rappel volume */}
          <div className="bg-grow-50 border border-grow-200 rounded-xl p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500">Volume total à préparer</p>
              <p className="text-2xl font-bold text-grow-700">{volumeTotal.toFixed(1)} L</p>
            </div>
            <button
              onClick={() => { setStep(1); setSaved(false) }}
              className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:text-gray-200"
            >
              <ChevronLeft size={15} /> Modifier les pots
            </button>
          </div>

          {/* Sélection type de sol */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-6 space-y-4">
            <h2 className="text-base font-semibold text-gray-800 dark:text-gray-100">🧱 Type de sol</h2>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {typesSol.map(ts => (
                <button
                  key={ts.id_parametre}
                  onClick={() => { setTypeSol(ts.valeur); setSaved(false) }}
                  className={`px-3 py-2 rounded-lg border text-sm font-medium transition-colors text-center ${
                    typeSol === ts.valeur
                      ? 'border-grow-500 bg-grow-50 text-grow-700'
                      : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700/40'
                  }`}
                >
                  {ts.valeur}
                </button>
              ))}
            </div>

            {/* ── Sol vivant → choix recette LSO ── */}
            {isLSOMode && !isMixMode && (
              <div className="pt-2 space-y-3">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200">
                  🌿 Recette Living Soil Organique
                </label>
                <select
                  value={idRecetteLSO}
                  onChange={e => { setIdRecetteLSO(e.target.value === '' ? '' : Number(e.target.value)); setSaved(false) }}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:ring-2 focus:ring-grow-500 focus:border-transparent"
                >
                  <option value="">— Sélectionnez une recette —</option>
                  {recettesLSO.map(r => (
                    <option key={r.id_recette_lso} value={r.id_recette_lso}>
                      {r.nom_recette}
                      {r.quantite_totale ? ` (base ${r.quantite_totale} ${r.unite_quantite ?? 'L'})` : ''}
                    </option>
                  ))}
                </select>
                {idRecetteLSO !== '' && (
                  <p className="text-xs text-gray-400 dark:text-gray-500">
                    Les quantités seront proportionnées à votre volume ({volumeTotal.toFixed(1)} L)
                  </p>
                )}
              </div>
            )}

            {/* ── Coco + Terre → % coco ── */}
            {isMixMode && (
              <div className="pt-2 space-y-3">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200">
                  Proportion de coco
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min={10} max={90} step={5}
                    value={percentCoco}
                    onChange={e => { setPercentCoco(e.target.value); setSaved(false) }}
                    className="flex-1 accent-grow-600"
                  />
                  <span className="text-lg font-bold text-grow-700 w-14 text-right">
                    {percentCoco}%
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="bg-orange-50 border border-orange-200 rounded-lg p-2 text-center">
                    <p className="text-orange-700 font-bold">{(volumeTotal * parseFloat(percentCoco) / 100).toFixed(1)} L</p>
                    <p className="text-xs text-orange-500">🥥 Coco</p>
                  </div>
                  <div className="bg-stone-50 border border-stone-200 rounded-lg p-2 text-center">
                    <p className="text-stone-700 font-bold">{(volumeTotal * (1 - parseFloat(percentCoco) / 100)).toFixed(1)} L</p>
                    <p className="text-xs text-stone-500">🌱 Terre</p>
                  </div>
                </div>
              </div>
            )}

            {/* ── Config coco (coco seul ou coco+terre) ── */}
            {isCocoMode && (
              <div className="pt-2 space-y-3 border-t border-gray-100 dark:border-gray-700">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200">Type de coco</label>

                <div className="grid grid-cols-2 gap-2">
                  {(['vrac', 'brique'] as const).map(t => (
                    <button
                      key={t}
                      onClick={() => setCocoConfig(prev => ({ ...prev, type: t }))}
                      className={`px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${
                        cocoConfig.type === t
                          ? 'border-orange-400 bg-orange-50 text-orange-700'
                          : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/40'
                      }`}
                    >
                      {t === 'vrac' ? '📦 Vrac (non compressé)' : '🧱 Briques (compressé)'}
                    </button>
                  ))}
                </div>

                {cocoConfig.type === 'brique' && (
                  <div className="space-y-3 p-3 bg-orange-50 rounded-xl border border-orange-100">
                    {/* Choix mode de saisie */}
                    <div className="flex gap-2">
                      {(['dimensions', 'poids'] as const).map(m => (
                        <button
                          key={m}
                          onClick={() => setCocoConfig(prev => ({ ...prev, brique_input: m }))}
                          className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                            cocoConfig.brique_input === m
                              ? 'bg-orange-500 text-white'
                              : 'bg-white dark:bg-gray-800 border border-orange-200 text-orange-600 hover:bg-orange-100'
                          }`}
                        >
                          {m === 'dimensions' ? '📐 Dimensions (cm)' : '⚖️ Poids (grammes)'}
                        </button>
                      ))}
                    </div>

                    {cocoConfig.brique_input === 'dimensions' ? (
                      <div>
                        <p className="text-xs text-orange-600 mb-2">Dimensions de la brique compressée</p>
                        <div className="grid grid-cols-3 gap-2">
                          {(['brique_l_cm', 'brique_w_cm', 'brique_h_cm'] as const).map((field, i) => (
                            <div key={field}>
                              <label className="block text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500 mb-0.5">
                                {['Longueur', 'Largeur', 'Hauteur'][i]} (cm)
                              </label>
                              <input
                                type="number"
                                min={1}
                                value={cocoConfig[field]}
                                onChange={e => setCocoConfig(prev => ({ ...prev, [field]: e.target.value }))}
                                className="w-full px-2 py-1.5 border border-orange-200 rounded-lg text-sm focus:ring-2 focus:ring-orange-400 focus:border-transparent bg-white dark:bg-gray-800"
                                placeholder="0"
                              />
                            </div>
                          ))}
                        </div>
                        {calcBriqueL(cocoConfig) > 0 && (
                          <p className="text-xs text-orange-500 mt-1.5">
                            ≈ {calcBriqueL(cocoConfig).toFixed(1)} L par brique (ratio expansion ×{COCO_EXPANSION_RATIO})
                          </p>
                        )}
                      </div>
                    ) : (
                      <div>
                        <label className="block text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500 mb-1">Poids de la brique (grammes)</label>
                        <input
                          type="number"
                          min={100}
                          value={cocoConfig.brique_poids_g}
                          onChange={e => setCocoConfig(prev => ({ ...prev, brique_poids_g: e.target.value }))}
                          className="w-full px-3 py-2 border border-orange-200 rounded-lg text-sm focus:ring-2 focus:ring-orange-400 focus:border-transparent bg-white dark:bg-gray-800"
                          placeholder="ex: 650"
                        />
                        {calcBriqueL(cocoConfig) > 0 && (
                          <p className="text-xs text-orange-500 mt-1.5">
                            ≈ {calcBriqueL(cocoConfig).toFixed(1)} L par brique (~{COCO_L_PER_KG} L/kg)
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ── Résultat ── */}
          {typeSol && result.length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-6 space-y-4">
              <h2 className="text-base font-semibold text-gray-800 dark:text-gray-100">✅ Ingrédients à préparer</h2>

              <div className="divide-y divide-gray-100 dark:divide-gray-700">
                {result.map((r, i) => (
                  r.quantite > 0 ? (
                    <div key={i} className="flex items-center justify-between py-2.5">
                      <span className={`text-sm ${r.label.startsWith('   ↳') ? 'text-gray-400 dark:text-gray-500 pl-4' : 'text-gray-800 dark:text-gray-100 font-medium'}`}>
                        {r.label}
                      </span>
                      <span className="font-mono font-semibold text-grow-700">
                        {r.quantite % 1 === 0 ? r.quantite : r.quantite.toFixed(2)} {r.unite}
                      </span>
                    </div>
                  ) : (
                    <div key={i} className="py-2.5">
                      <p className="text-xs text-amber-600">{r.label}</p>
                    </div>
                  )
                ))}
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">Notes (optionnel)</label>
                <textarea
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:ring-2 focus:ring-grow-500 focus:border-transparent resize-none"
                  placeholder="Observations, ajustements..."
                />
              </div>

              {/* Actions */}
              <div className="flex items-center gap-3 pt-2">
                <button
                  onClick={handleSave}
                  disabled={saveMut.isPending || saved}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    saved
                      ? 'bg-green-100 text-green-700 border border-green-200'
                      : 'bg-grow-600 text-white hover:bg-grow-700 disabled:opacity-50'
                  }`}
                >
                  <Save size={15} />
                  {saved ? '✓ Sauvegardé' : saveMut.isPending ? 'Sauvegarde...' : 'Sauvegarder'}
                </button>
                <button
                  onClick={handlePrint}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/40 transition-colors"
                >
                  <Printer size={15} />
                  Imprimer
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Historique modal ── */}
      {showHistorique && <HistoriqueModal onClose={() => setShowHistorique(false)} />}
    </div>
  )
}
