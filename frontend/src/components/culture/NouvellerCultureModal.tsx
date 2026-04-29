import { useState } from 'react'
import { X, Plus, Minus, Leaf, PackageOpen } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { espacesAPI, EspaceCulture } from '../../api/espaces'
import { catalogueAPI, CatalogueItem } from '../../api/graines'
import { CultureCreate, PlantExterneCreate, cultureUtilsAPI, cultureAPI, Culture, PotItem } from '../../api/cultures'
import { parametresAPI, ParametreValeur } from '../../api/parametres'

const TYPE_CULTURE_OPTIONS = [
  { value: 'indoor',     label: '🏠 Indoor' },
  { value: 'outdoor',    label: '☀️ Outdoor' },
  { value: 'greenhouse', label: '🌿 Greenhouse' },
]

const TYPE_ECLAIRAGE_OPTIONS = [
  { value: 'LED',         label: '💡 LED' },
  { value: 'HPS',         label: '🔆 HPS' },
  { value: 'CMH',         label: '🌟 CMH / LEC' },
  { value: 'fluorescent', label: '🕯️ Fluorescent / CFL' },
  { value: 'soleil',      label: '☀️ Lumière naturelle' },
]

const SUBSTRAT_OPTIONS = [
  { value: 'terre',      label: '🌱 Terre classique' },
  { value: 'sol_vivant', label: '🦠 Sol vivant' },
  { value: 'coco',       label: '🥥 Coco' },
  { value: 'hydro',      label: '💧 Hydroponique' },
  { value: 'autre',      label: '📦 Autre' },
]

export interface InitialCultureData {
  id_espace?: number
  selections?: { id_packgraine: number; nb_plantes: number; variete_nom: string }[]
}

interface Props {
  onClose: () => void
  onSubmit: (data: CultureCreate) => Promise<void>
  initialData?: InitialCultureData
}

// ── Plante externe (séchage ou curing) ────────────────────────────────────────
interface PlantExterneForm {
  nom_affichage: string
  date_recolte: string
  date_fin_sechage: string
  poids_g: string
  provenance: string
  prix_g: string
}

function emptyPlantExterne(): PlantExterneForm {
  return { nom_affichage: '', date_recolte: new Date().toISOString().slice(0,10), date_fin_sechage: new Date().toISOString().slice(0,10), poids_g: '', provenance: '', prix_g: '' }
}

export default function NouvellerCultureModal({ onClose, onSubmit, initialData }: Props) {
  // ── mode: 'interne' (graines catalogue) | 'externe' (import séchage/curing)
  const [mode, setMode] = useState<'interne' | 'externe'>('interne')
  const [stageExterne, setStageExterne] = useState<'sechage' | 'curing'>('sechage')
  const [plantesExternes, setPlantesExternes] = useState<PlantExterneForm[]>([emptyPlantExterne()])

  const [nom, setNom] = useState('')
  const [idEspace, setIdEspace] = useState<number | ''>(initialData?.id_espace ?? '')
  const [dateDebut, setDateDebut] = useState(new Date().toISOString().slice(0, 10))
  const [typeCulture, setTypeCulture] = useState('')
  const [typeEclairage, setTypeEclairage] = useState('')
  const [substratDefaut, setSubstratDefaut] = useState('')
  const [idRecetteSolDefaut, setIdRecetteSolDefaut] = useState<number | ''>('')
  const [idPotDefaut, setIdPotDefaut] = useState<number | ''>('')
  const [volumePotDefaut, setVolumePotDefaut] = useState<number | ''>('')
  const [selectedButs, setSelectedButs] = useState<string[]>([])
  const [notes, setNotes] = useState('')
  const [selections, setSelections] = useState<{ id_packgraine: number; nb_plantes: number; variete_nom: string; id_pot?: number; volume_pot_l?: number }[]>(
    initialData?.selections ?? []
  )
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  // Si des variétés sont pré-chargées depuis un plan, on saute à l'étape 2
  const [step, setStep] = useState<1 | 2>(initialData?.selections?.length ? 2 : 1)
  const [searchGraine, setSearchGraine] = useState('')

  function toggleBut(valeur: string) {
    setSelectedButs(prev =>
      prev.includes(valeur) ? prev.filter(b => b !== valeur) : [...prev, valeur]
    )
  }

  function updatePlantExterne(idx: number, field: keyof PlantExterneForm, val: string) {
    setPlantesExternes(prev => prev.map((p, i) => i === idx ? { ...p, [field]: val } : p))
  }
  function addPlantExterne() { setPlantesExternes(prev => [...prev, emptyPlantExterne()]) }
  function removePlantExterne(idx: number) { setPlantesExternes(prev => prev.filter((_, i) => i !== idx)) }

  const { data: espaces = [] } = useQuery<EspaceCulture[]>({
    queryKey: ['espaces'],
    queryFn: async () => (await espacesAPI.getAll()).data,
  })

  const { data: catalogue = [] } = useQuery<CatalogueItem[]>({
    queryKey: ['catalogue'],
    queryFn: async () => (await catalogueAPI.get()).data,
  })

  const { data: pots = [] } = useQuery<PotItem[]>({
    queryKey: ['pots'],
    queryFn: async () => (await cultureUtilsAPI.getPots()).data,
  })

  // recettesSol n'est plus utilisé à l'étape 1 (recette assignée par pot à l'étape 2)
  // const { data: recettesSol = [] } = useQuery…

  const { data: butsCulture = [] } = useQuery<ParametreValeur[]>({
    queryKey: ['parametres', 'buts_culture'],
    queryFn: async () => (await parametresAPI.getList('buts_culture')).data,
  })

  // Cultures actives — pour bloquer les espaces déjà occupés
  const { data: culturesActives = [] } = useQuery<Culture[]>({
    queryKey: ['cultures', 'active'],
    queryFn: async () => (await cultureAPI.getAll('active')).data,
  })
  const espacesOccupes = new Set(culturesActives.map(c => c.id_espace).filter(Boolean) as number[])

  const espacesActifs = espaces.filter(e => e.statut === 'Actif' || !e.statut)
  const showEclairage = typeCulture === 'indoor' || typeCulture === 'greenhouse'
  const showPot = substratDefaut === 'sol_vivant' || substratDefaut === 'terre' || substratDefaut === 'coco'

  function addGraine(item: CatalogueItem) {
    const existing = selections.find(s => s.id_packgraine === item.id_packgraine)
    if (existing) return
    setSelections(prev => [...prev, {
      id_packgraine: item.id_packgraine,
      nb_plantes: 1,
      variete_nom: `${item.breeder_nom} — ${item.variete_nom}`,
    }])
  }

  function updateNb(id: number, delta: number) {
    setSelections(prev => prev.map(s =>
      s.id_packgraine === id ? { ...s, nb_plantes: Math.max(1, s.nb_plantes + delta) } : s
    ))
  }

  function remove(id: number) {
    setSelections(prev => prev.filter(s => s.id_packgraine !== id))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!idEspace) return
    if (mode === 'interne' && selections.length === 0) return
    if (mode === 'externe' && plantesExternes.every(p => !p.nom_affichage.trim())) return
    setLoading(true)
    setError('')
    try {
      const payload: CultureCreate = {
        nom: nom || undefined,
        id_espace: idEspace as number,
        date_debut: dateDebut,
        graines_selection: mode === 'interne'
          ? selections.map(s => ({
              id_packgraine: s.id_packgraine,
              nb_plantes: s.nb_plantes,
              id_pot: s.id_pot || undefined,
              volume_pot_l: s.volume_pot_l || undefined,
            }))
          : [],
        type_culture: typeCulture || undefined,
        type_eclairage: typeEclairage || undefined,
        but_culture: selectedButs.length > 0 ? selectedButs.join(',') : undefined,
        substrat_defaut: substratDefaut || undefined,
        id_recette_sol_defaut: idRecetteSolDefaut ? Number(idRecetteSolDefaut) : undefined,
        notes: notes || undefined,
      }
      if (mode === 'externe') {
        payload.plantes_externes = plantesExternes
          .filter(p => p.nom_affichage.trim())
          .map(p => ({
            nom_affichage: p.nom_affichage.trim(),
            statut: stageExterne,
            date_recolte: p.date_recolte || undefined,
            date_fin_sechage: stageExterne === 'curing' ? (p.date_fin_sechage || undefined) : undefined,
            poids_g: p.poids_g ? parseFloat(p.poids_g) : undefined,
            provenance: p.provenance.trim() || undefined,
            prix_g: p.prix_g ? parseFloat(p.prix_g) : undefined,
          } as PlantExterneCreate))
      }
      await onSubmit(payload)
      onClose()
    } catch (err: any) {
      const detail = err?.response?.data?.detail
      setError(
        typeof detail === 'string'
          ? detail
          : err?.message ?? 'Erreur lors de la création de la culture'
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b sticky top-0 bg-white z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-grow-100 rounded-lg flex items-center justify-center">
              {mode === 'interne' ? <Leaf size={20} className="text-grow-600" /> : <PackageOpen size={20} className="text-amber-600" />}
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">Nouvelle culture</h2>
              <p className="text-xs text-gray-500">Étape {step} / 2</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1"><X size={20} /></button>
        </div>

        {/* Mode toggle */}
        <div className="px-6 pt-4 pb-0">
          <div className="flex rounded-lg border border-gray-200 overflow-hidden text-sm">
            <button type="button"
              onClick={() => { setMode('interne'); setStep(1) }}
              className={`flex-1 py-2 flex items-center justify-center gap-2 transition-colors
                ${mode === 'interne' ? 'bg-grow-600 text-white font-medium' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>
              <Leaf size={14} /> Culture interne (graines)
            </button>
            <button type="button"
              onClick={() => setMode('externe')}
              className={`flex-1 py-2 flex items-center justify-center gap-2 transition-colors
                ${mode === 'externe' ? 'bg-amber-500 text-white font-medium' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>
              <PackageOpen size={14} /> Import externe
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          {/* ── ÉTAPE 1 : infos culture ── */}
          {step === 1 && (
            <div className="p-6 space-y-5">
              {/* Espace + Date */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Espace de culture <span className="text-red-500">*</span>
                  </label>
                  <select value={idEspace} onChange={e => setIdEspace(Number(e.target.value) || '')} required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-grow-500 focus:border-transparent">
                    <option value="">Sélectionner…</option>
                    {espacesActifs.map(e => {
                      const occupe = espacesOccupes.has(e.id_espace)
                      const culture = culturesActives.find(c => c.id_espace === e.id_espace)
                      return (
                        <option key={e.id_espace} value={e.id_espace} disabled={occupe}>
                          {occupe ? '🔒 ' : ''}{e.nom}{e.surface_m2 ? ` (${e.surface_m2} m²)` : ''}{occupe && culture ? ` — ${culture.nom}` : ''}
                        </option>
                      )
                    })}
                  </select>
                  {idEspace && espacesOccupes.has(idEspace as number) && (
                    <p className="text-xs text-red-500 mt-1">⚠️ Cet espace a déjà une culture active.</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Date de début <span className="text-red-500">*</span>
                  </label>
                  <input type="date" value={dateDebut} onChange={e => setDateDebut(e.target.value)} required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-grow-500 focus:border-transparent" />
                </div>
              </div>

              {/* Type culture + Éclairage */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Type de culture</label>
                  <select value={typeCulture} onChange={e => { setTypeCulture(e.target.value); if (e.target.value !== 'indoor' && e.target.value !== 'greenhouse') setTypeEclairage('') }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-grow-500 focus:border-transparent">
                    <option value="">Non spécifié</option>
                    {TYPE_CULTURE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                {showEclairage && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Type d'éclairage</label>
                    <select value={typeEclairage} onChange={e => setTypeEclairage(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-grow-500 focus:border-transparent">
                      <option value="">Non spécifié</option>
                      {TYPE_ECLAIRAGE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </div>
                )}
              </div>

              {/* But de culture (multi-sélection) */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  But de la culture <span className="text-xs text-gray-400">(sélection multiple)</span>
                </label>
                <div className="flex flex-wrap gap-2">
                  {butsCulture.map(b => (
                    <button key={b.id} type="button"
                      onClick={() => toggleBut(b.valeur)}
                      className={`px-3 py-1.5 rounded-full border text-sm transition-colors
                        ${selectedButs.includes(b.valeur)
                          ? 'bg-grow-600 border-grow-600 text-white'
                          : 'border-gray-300 text-gray-700 hover:border-grow-400 hover:bg-grow-50'}`}>
                      {b.valeur === 'Récolte' ? '🌾' : b.valeur === 'Hunt' ? '🔍' : b.valeur === 'Reproduction' ? '🧬' : '🎯'} {b.valeur}
                    </button>
                  ))}
                  {butsCulture.length === 0 && (
                    <span className="text-xs text-gray-400 italic">Aucun but défini — configurable dans Paramétrage</span>
                  )}
                </div>
              </div>

              {/* Substrat par défaut */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Substrat par défaut <span className="text-xs text-gray-400">(appliqué à toutes les plantes)</span>
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {SUBSTRAT_OPTIONS.map(o => (
                    <button key={o.value} type="button"
                      onClick={() => setSubstratDefaut(substratDefaut === o.value ? '' : o.value)}
                      className={`px-3 py-2 rounded-lg border text-xs text-left transition-colors
                        ${substratDefaut === o.value
                          ? 'bg-grow-600 border-grow-600 text-white'
                          : 'border-gray-200 hover:border-grow-300 hover:bg-grow-50 text-gray-700'}`}>
                      {o.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Sol vivant : note recette assignée par pot */}
              {substratDefaut === 'sol_vivant' && (
                <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                  🦠 <strong>Sol vivant :</strong> la recette LSO sera assignée individuellement par pot à l'étape suivante.
                </p>
              )}

              {/* Le pot est assigné par variété à l'étape 2 */}
              {showPot && (
                <p className="text-xs text-grow-600 bg-grow-50 border border-grow-200 rounded-lg px-3 py-2">
                  🪴 Les pots seront assignés par variété à l'étape suivante.
                </p>
              )}

              {/* Nom optionnel */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nom de la culture <span className="text-gray-400 text-xs">(optionnel — auto-généré si vide)</span>
                </label>
                <input type="text" value={nom} onChange={e => setNom(e.target.value)} placeholder="ex: Batch OG Kush #3"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-grow-500 focus:border-transparent" />
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm resize-none focus:ring-2 focus:ring-grow-500 focus:border-transparent" />
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={onClose}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 text-sm">
                  Annuler
                </button>
                {mode === 'interne' ? (
                  <button type="button" disabled={!idEspace}
                    onClick={() => setStep(2)}
                    className="flex-1 px-4 py-2 bg-grow-600 text-white rounded-lg hover:bg-grow-700 disabled:opacity-50 text-sm">
                    Suivant → Choisir les graines
                  </button>
                ) : (
                  <button type="button" disabled={!idEspace}
                    onClick={() => setStep(2)}
                    className="flex-1 px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 disabled:opacity-50 text-sm">
                    Suivant → Saisir les plantes
                  </button>
                )}
              </div>
            </div>
          )}

          {/* ── ÉTAPE 2 : import externe ── */}
          {step === 2 && mode === 'externe' && (
            <div className="p-6 space-y-4">
              {/* Stage selector */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Étape d'entrée</label>
                <div className="flex rounded-lg border border-gray-200 overflow-hidden text-sm">
                  <button type="button"
                    onClick={() => setStageExterne('sechage')}
                    className={`flex-1 py-2 transition-colors ${stageExterne === 'sechage' ? 'bg-blue-500 text-white font-medium' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>
                    🌿 Séchage
                  </button>
                  <button type="button"
                    onClick={() => setStageExterne('curing')}
                    className={`flex-1 py-2 transition-colors ${stageExterne === 'curing' ? 'bg-purple-500 text-white font-medium' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>
                    🏺 Curing
                  </button>
                </div>
              </div>

              {/* Liste des plantes */}
              <div className="space-y-3">
                {plantesExternes.map((p, idx) => (
                  <div key={idx} className={`rounded-lg border p-3 space-y-2 ${stageExterne === 'sechage' ? 'border-blue-200 bg-blue-50' : 'border-purple-200 bg-purple-50'}`}>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Plante {idx + 1}</span>
                      {plantesExternes.length > 1 && (
                        <button type="button" onClick={() => removePlantExterne(idx)} className="text-red-400 hover:text-red-600"><X size={14} /></button>
                      )}
                    </div>

                    {/* Variété */}
                    <input type="text" placeholder="Variété (ex: OG Kush, Limon Haze…)" required
                      value={p.nom_affichage}
                      onChange={e => updatePlantExterne(idx, 'nom_affichage', e.target.value)}
                      className="w-full px-3 py-1.5 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-grow-500 focus:border-transparent bg-white" />

                    <div className="grid grid-cols-2 gap-2">
                      {/* Date récolte */}
                      <div>
                        <label className="text-xs text-gray-500 block mb-0.5">Date de récolte</label>
                        <input type="date" value={p.date_recolte}
                          onChange={e => updatePlantExterne(idx, 'date_recolte', e.target.value)}
                          className="w-full px-2 py-1.5 border border-gray-300 rounded-md text-sm bg-white" />
                      </div>
                      {/* Poids frais (séchage) ou sec (curing) */}
                      <div>
                        <label className="text-xs text-gray-500 block mb-0.5">
                          {stageExterne === 'sechage' ? 'Poids frais (g)' : 'Poids sec (g)'}
                        </label>
                        <input type="number" step="0.1" min="0" placeholder="0.0"
                          value={p.poids_g}
                          onChange={e => updatePlantExterne(idx, 'poids_g', e.target.value)}
                          className="w-full px-2 py-1.5 border border-gray-300 rounded-md text-sm bg-white" />
                      </div>
                    </div>

                    {stageExterne === 'curing' && (
                      <div className="grid grid-cols-2 gap-2">
                        {/* Date entrée curing */}
                        <div>
                          <label className="text-xs text-gray-500 block mb-0.5">Début curing</label>
                          <input type="date" value={p.date_fin_sechage}
                            onChange={e => updatePlantExterne(idx, 'date_fin_sechage', e.target.value)}
                            className="w-full px-2 py-1.5 border border-gray-300 rounded-md text-sm bg-white" />
                        </div>
                        {/* Prix/g */}
                        <div>
                          <label className="text-xs text-gray-500 block mb-0.5">Prix (€/g)</label>
                          <input type="number" step="0.01" min="0" placeholder="0.00"
                            value={p.prix_g}
                            onChange={e => updatePlantExterne(idx, 'prix_g', e.target.value)}
                            className="w-full px-2 py-1.5 border border-gray-300 rounded-md text-sm bg-white" />
                        </div>
                      </div>
                    )}

                    {stageExterne === 'curing' && (
                      <div>
                        <label className="text-xs text-gray-500 block mb-0.5">Provenance</label>
                        <input type="text" placeholder="ex: Club social, Ami, Dispensaire…"
                          value={p.provenance}
                          onChange={e => updatePlantExterne(idx, 'provenance', e.target.value)}
                          className="w-full px-3 py-1.5 border border-gray-300 rounded-md text-sm bg-white" />
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <button type="button" onClick={addPlantExterne}
                className="w-full py-2 border-2 border-dashed border-gray-300 rounded-lg text-sm text-gray-500 hover:border-grow-400 hover:text-grow-600 flex items-center justify-center gap-2">
                <Plus size={14} /> Ajouter une variété
              </button>

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3">
                  <p className="text-sm text-red-700">⚠️ {error}</p>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setStep(1)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 text-sm">
                  ← Retour
                </button>
                <button type="submit"
                  disabled={loading || !idEspace || plantesExternes.every(p => !p.nom_affichage.trim())}
                  className="flex-1 px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed text-sm flex items-center justify-center gap-2">
                  {loading ? 'Création en cours…' : `📦 Importer (${stageExterne === 'sechage' ? 'Séchage' : 'Curing'})`}
                </button>
              </div>
            </div>
          )}

          {/* ── ÉTAPE 2 : sélection graines ── */}
          {step === 2 && mode === 'interne' && (
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Variétés à cultiver <span className="text-red-500">*</span>
                </label>

                {/* Graines sélectionnées */}
                {selections.length > 0 && (
                  <div className="space-y-2 mb-3">
                    {selections.map(s => (
                      <div key={s.id_packgraine} className="bg-grow-50 border border-grow-200 rounded-lg px-3 py-2 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-grow-800">{s.variete_nom}</span>
                          <div className="flex items-center gap-2">
                            <button type="button" onClick={() => updateNb(s.id_packgraine, -1)}
                              className="w-6 h-6 bg-white border border-gray-300 rounded flex items-center justify-center hover:bg-gray-50">
                              <Minus size={12} />
                            </button>
                            <span className="text-sm font-bold w-4 text-center">{s.nb_plantes}</span>
                            <button type="button" onClick={() => updateNb(s.id_packgraine, 1)}
                              className="w-6 h-6 bg-white border border-gray-300 rounded flex items-center justify-center hover:bg-gray-50">
                              <Plus size={12} />
                            </button>
                            <span className="text-xs text-gray-500 ml-1">plant{s.nb_plantes > 1 ? 's' : ''}</span>
                            <button type="button" onClick={() => remove(s.id_packgraine)}
                              className="ml-2 text-red-400 hover:text-red-600">
                              <X size={14} />
                            </button>
                          </div>
                        </div>
                        {/* Sélecteur de pot par variété */}
                        {showPot && (
                          <div className="flex items-center gap-2">
                            <select
                              value={s.id_pot ?? ''}
                              onChange={e => {
                                const potId = Number(e.target.value) || undefined
                                const pot = pots.find(p => p.id_pot === potId)
                                const vol = pot ? (pot.volume_l ?? pot.taille_pot) : undefined
                                setSelections(prev => prev.map(sel =>
                                  sel.id_packgraine === s.id_packgraine
                                    ? { ...sel, id_pot: potId, volume_pot_l: vol ?? sel.volume_pot_l }
                                    : sel
                                ))
                              }}
                              className="flex-1 px-2 py-1.5 border border-gray-200 rounded-md text-xs focus:outline-none focus:ring-2 focus:ring-grow-500 bg-white">
                              <option value="">🪴 Pot (optionnel)</option>
                              {pots.map(p => {
                                const vol = p.volume_l ?? p.taille_pot
                                return (
                                  <option key={p.id_pot} value={p.id_pot} disabled={p.en_cours}>
                                    {p.en_cours ? '🔒 ' : ''}{p.dimension_pot}{vol ? ` — ${vol} L` : ''}{p.en_cours ? ` (${p.nom_culture_en_cours})` : p.etat ? ` (${p.etat})` : ''}
                                  </option>
                                )
                              })}
                            </select>
                            <input type="number" step="0.5" min="0"
                              value={s.volume_pot_l ?? ''}
                              onChange={e => setSelections(prev => prev.map(sel =>
                                sel.id_packgraine === s.id_packgraine
                                  ? { ...sel, volume_pot_l: Number(e.target.value) || undefined }
                                  : sel
                              ))}
                              placeholder="Vol. (L)"
                              className="w-24 px-2 py-1.5 border border-gray-200 rounded-md text-xs focus:outline-none focus:ring-2 focus:ring-grow-500 text-right" />
                          </div>
                        )}
                      </div>
                    ))}
                    <p className="text-xs text-gray-500 text-right">
                      Total : {selections.reduce((s, i) => s + i.nb_plantes, 0)} plante{selections.reduce((s, i) => s + i.nb_plantes, 0) > 1 ? 's' : ''}
                    </p>
                  </div>
                )}

                {/* Recherche + Catalogue trié alphabétiquement */}
                <div>
                  <input
                    type="text"
                    value={searchGraine}
                    onChange={e => setSearchGraine(e.target.value)}
                    placeholder="🔍 Rechercher une variété…"
                    className="w-full px-3 py-2 border border-gray-300 rounded-t-lg text-sm focus:ring-2 focus:ring-grow-500 focus:border-transparent border-b-0"
                  />
                  <div className="border border-gray-200 rounded-b-lg overflow-hidden max-h-56 overflow-y-auto">
                    {(() => {
                      const available = catalogue
                        .filter(c => c.nbr_graines_restantes > 0)
                        .filter(c => !searchGraine || `${c.variete_nom} ${c.breeder_nom}`.toLowerCase().includes(searchGraine.toLowerCase()))
                        .sort((a, b) => a.variete_nom.localeCompare(b.variete_nom, 'fr', { sensitivity: 'base' }))
                      if (available.length === 0) {
                        return <p className="text-sm text-gray-400 p-4 text-center">
                          {searchGraine ? 'Aucune variété trouvée' : 'Aucune graine disponible dans le stock'}
                        </p>
                      }
                      return available.map(item => (
                        <button key={item.id_packgraine} type="button" onClick={() => addGraine(item)}
                          disabled={selections.some(s => s.id_packgraine === item.id_packgraine)}
                          className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-gray-50 border-b border-gray-100 last:border-0 disabled:opacity-40 disabled:cursor-not-allowed text-left">
                          <div>
                            <span className="text-sm font-medium text-gray-900">{item.variete_nom}</span>
                            <span className="text-xs text-gray-500 ml-2">{item.breeder_nom}</span>
                            {item.duree_flo_min && (
                              <span className="text-xs text-purple-600 ml-2">
                                {item.duree_flo_min}{item.duree_flo_max ? `–${item.duree_flo_max}` : ''}sem
                              </span>
                            )}
                          </div>
                          <span className="text-xs text-emerald-600 font-medium">{item.nbr_graines_restantes} dispo</span>
                        </button>
                      ))
                    })()}
                  </div>
                </div>
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3">
                  <p className="text-sm text-red-700">⚠️ {error}</p>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setStep(1)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 text-sm">
                  ← Retour
                </button>
                <button type="submit" disabled={loading || !idEspace || selections.length === 0}
                  className="flex-1 px-4 py-2 bg-grow-600 text-white rounded-lg hover:bg-grow-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm flex items-center justify-center gap-2">
                  {loading ? 'Création en cours…' : '🌱 Créer la culture'}
                </button>
              </div>
            </div>
          )}
        </form>
      </div>
    </div>
  )
}
