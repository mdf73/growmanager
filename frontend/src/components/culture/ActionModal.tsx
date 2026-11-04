import { useState, useEffect } from 'react'
import { X, ChevronDown, Loader2 } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { Plant, ActionCreate } from '../../api/cultures'
import { engraisAPI } from '../../api/engrais'
import { espacesAPI, EspaceMateriel } from '../../api/espaces'
import { useParametreListe } from '../../api/parametres'
import {
  ACTIONS_BY_CATEGORY, ACTION_MAP,
  CATEGORY_COLORS, CATEGORY_LABELS, ActionCategory,
} from './actionTypes'

interface ProduitItem {
  id_produit: number
  quantite: number
}

interface Props {
  cultureId: number
  idEspace?: number
  plants: Plant[]
  initialDate: string
  initialPlantId?: number
  onClose: () => void
  onSubmit: (data: ActionCreate) => Promise<void>
}

// Catégories qui s'appliquent à l'espace (pas aux plantes individuelles) par défaut
const SPACE_CATEGORIES: ActionCategory[] = ['lampe']

export default function ActionModal({ plants, idEspace, initialDate, initialPlantId, onClose, onSubmit }: Props) {
  const [dateAction, setDateAction] = useState(initialDate)
  // target: 'space' (espace seul) | 'global' (toutes les plantes) | 'plants' (sélection dans selectedPlantIds)
  const [target, setTarget] = useState<'space' | 'global' | 'plants'>(
    initialPlantId !== undefined ? 'plants' : 'global'
  )
  const [selectedPlantIds, setSelectedPlantIds] = useState<Set<number>>(
    () => new Set(initialPlantId !== undefined ? [initialPlantId] : [])
  )
  const [selectedType, setSelectedType] = useState('')
  const [params, setParams] = useState<Record<string, unknown>>({})
  const [note, setNote] = useState('')
  const [loading, setLoading] = useState(false)
  const [openCategory, setOpenCategory] = useState<ActionCategory | null>('germination')
  const [produits, setProduits] = useState<ProduitItem[]>([])

  const { data: produitsEngrais = [] } = useQuery({
    queryKey: ['produits-engrais'],
    queryFn: async () => (await engraisAPI.getAll()).data,
  })

  // Lampes de l'espace de culture — utilisées pour la sélection lors d'un changement d'intensité
  const { data: lampesEspace = [] } = useQuery<EspaceMateriel[]>({
    queryKey: ['espace-lampes', idEspace],
    queryFn: async () => {
      if (!idEspace) return []
      const espace = await espacesAPI.getById(idEspace).then(r => r.data)
      return espace.equipements.filter(e => e.categorie === 'Lampes')
    },
    enabled: !!idEspace && selectedType === 'intensite_lampe',
  })

  // Auto-sélection si 1 seule lampe dans l'espace
  useEffect(() => {
    if (selectedType === 'intensite_lampe' && lampesEspace.length === 1) {
      setParam('id_lampe_materiel', lampesEspace[0].id_materiel)
    }
  }, [selectedType, lampesEspace])

  const actionDef = selectedType ? ACTION_MAP[selectedType] : null

  const plantesActives = plants.filter(p => !['recolte', 'abandonne'].includes(p.statut || ''))
  const plantesCiblees = target === 'plants' ? plants.filter(p => selectedPlantIds.has(p.id_plant)) : []

  /** Sélection plante par plante (comme ArrosageModal) — tout décoché → retour à "Toutes les plantes" */
  function togglePlant(id: number) {
    const next = new Set(target === 'plants' ? selectedPlantIds : [])
    if (next.has(id)) next.delete(id); else next.add(id)
    setSelectedPlantIds(next)
    setTarget(next.size === 0 ? 'global' : 'plants')
  }

  /** Filtre les actions selon les contraintes des plantes ciblées */
  function isActionVisible(action: (typeof ACTION_MAP)[string]): boolean {
    if (action.requiredPlantStatut) {
      // L'action nécessite un statut précis → toutes les plantes sélectionnées doivent l'avoir
      if (target !== 'plants' || plantesCiblees.length === 0) return false
      return plantesCiblees.every(p => p.statut === action.requiredPlantStatut)
    }
    return true
  }

  // Si la sélection change et que l'action choisie n'est plus compatible → on la désélectionne
  useEffect(() => {
    if (selectedType && ACTION_MAP[selectedType] && !isActionVisible(ACTION_MAP[selectedType])) {
      setSelectedType('')
      setParams({})
    }
  }, [target, selectedPlantIds])

  function setParam(key: string, value: unknown) {
    setParams(prev => ({ ...prev, [key]: value }))
  }

  function addProduit() {
    setProduits(prev => [...prev, { id_produit: 0, quantite: 0 }])
  }

  function updateProduit(idx: number, field: 'id_produit' | 'quantite', value: number) {
    setProduits(prev => prev.map((p, i) => i === idx ? { ...p, [field]: value } : p))
  }

  function removeProduit(idx: number) {
    setProduits(prev => prev.filter((_, i) => i !== idx))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedType) return
    setLoading(true)

    const finalParams: Record<string, unknown> = { ...params }
    if (selectedType === 'arrosage_engrais' && produits.length > 0) {
      finalParams.produits = produits.filter(p => p.id_produit > 0)
    }

    const isSpace  = target === 'space'
    const isGlobal = target === 'global'
    // undefined = une seule action (espace ou toutes les plantes) ; sinon une action par plante
    const plantIds: (number | undefined)[] = target === 'plants' ? Array.from(selectedPlantIds) : [undefined]

    try {
      // Enregistrement séquentiel : les effets d'action (changement de statut…) s'appliquent plante par plante
      for (const plantId of plantIds) {
        await onSubmit({
          id_plant: plantId,
          date_action: dateAction,
          type_action: selectedType,
          parametres: Object.keys(finalParams).length > 0 ? finalParams : undefined,
          note: note || undefined,
          global_culture: isGlobal,
          space_only: isSpace,
        })
      }
      onClose()
    } finally {
      setLoading(false)
    }
  }

  // Arrosages → ArrosageModal ; photos → ajout dédié (galerie). On les exclut ici.
  const categories = (Object.keys(ACTIONS_BY_CATEGORY) as ActionCategory[]).filter(c => c !== 'arrosage' && c !== 'photo')

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b sticky top-0 bg-white dark:bg-gray-800 z-10">
          <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">Ajouter une action</h2>
          <button onClick={onClose} className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:text-gray-300"><X size={20} /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Date */}
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">Date</label>
            <input type="date" value={dateAction} onChange={e => setDateAction(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:ring-2 focus:ring-grow-500 focus:border-transparent" />
          </div>

          {/* Cible : même fonctionnement que les arrosages (pills multi-sélection) */}
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1.5">
              Cible
              {target === 'plants' && selectedPlantIds.size > 0 && (
                <span className="ml-1.5 text-grow-600 dark:text-grow-400 font-normal">
                  ({selectedPlantIds.size} plante{selectedPlantIds.size > 1 ? 's' : ''} sélectionnée{selectedPlantIds.size > 1 ? 's' : ''})
                </span>
              )}
            </label>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => setTarget('space')}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-full border text-xs font-medium transition-colors
                  ${target === 'space'
                    ? 'bg-amber-500 border-amber-500 text-white'
                    : 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-700 text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/40'}`}
              >
                🏠 Espace uniquement
              </button>
              <button
                type="button"
                onClick={() => setTarget('global')}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-full border text-xs font-medium transition-colors
                  ${target === 'global'
                    ? 'bg-blue-600 border-blue-600 text-white'
                    : 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-700 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/40'}`}
              >
                🌿 Toutes les plantes
              </button>
              {plantesActives.map(p => {
                const selected = target === 'plants' && selectedPlantIds.has(p.id_plant)
                return (
                  <button
                    key={p.id_plant}
                    type="button"
                    onClick={() => togglePlant(p.id_plant)}
                    className={`flex items-center gap-1 px-3 py-1.5 rounded-full border text-xs font-medium transition-colors
                      ${selected
                        ? 'bg-grow-600 border-grow-600 text-white'
                        : 'bg-gray-50 dark:bg-gray-700/50 border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'}`}
                  >
                    {selected ? '✓ ' : ''}{p.nom_affichage}
                  </button>
                )
              })}
            </div>
            {target === 'space' && (
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Enregistré pour l'espace, sans impact sur les plantes</p>
            )}
          </div>

          {/* Sélection du type d'action */}
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-2">Type d'action <span className="text-red-500">*</span></label>
            <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
              {categories.map(cat => (
                <div key={cat}>
                  <button
                    type="button"
                    onClick={() => {
                      setOpenCategory(openCategory === cat ? null : cat)
                      // Suggérer "Espace uniquement" quand on ouvre une catégorie lampe
                      if (SPACE_CATEGORIES.includes(cat) && target === 'global') {
                        setTarget('space')
                      }
                    }}
                    className="w-full flex items-center justify-between px-3 py-2 bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700 border-b border-gray-200 dark:border-gray-700"
                  >
                    <div className="flex items-center gap-2">
                      <span className={`w-2.5 h-2.5 rounded-full ${CATEGORY_COLORS[cat]}`} />
                      <span className="text-xs font-semibold text-gray-700 dark:text-gray-200">{CATEGORY_LABELS[cat]}</span>
                    </div>
                    <ChevronDown size={14} className={`text-gray-400 dark:text-gray-500 transition-transform ${openCategory === cat ? 'rotate-180' : ''}`} />
                  </button>
                  {openCategory === cat && (
                    <div className="grid grid-cols-2 gap-0.5 p-1.5 bg-white dark:bg-gray-800">
                      {ACTIONS_BY_CATEGORY[cat].filter(isActionVisible).map(action => (
                        <button
                          key={action.key}
                          type="button"
                          onClick={() => {
                            setSelectedType(action.key)
                            setParams({})
                            // Auto-basculer sur "Espace uniquement" pour les actions lampe
                            if (SPACE_CATEGORIES.includes(cat) && target === 'global') {
                              setTarget('space')
                            }
                          }}
                          className={`flex items-center gap-1.5 px-2 py-1.5 rounded text-left text-xs transition-colors
                            ${selectedType === action.key
                              ? 'bg-grow-600 text-white'
                              : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200'}`}
                        >
                          <span>{action.icon}</span>
                          <span className="leading-tight">{action.label}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Sélection de la lampe (uniquement pour intensite_lampe avec plusieurs lampes) */}
          {selectedType === 'intensite_lampe' && lampesEspace.length > 0 && (
            <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-lg space-y-2">
              <p className="text-xs font-medium text-yellow-800 dark:text-yellow-300">💡 Lampe concernée</p>
              {lampesEspace.length === 1 ? (
                // Une seule lampe : sélection automatique via useEffect, juste affiché
                <p className="text-xs text-yellow-700 dark:text-yellow-400">
                  {lampesEspace[0].nom_materiel ?? 'Lampe'}{lampesEspace[0].marque ? ` — ${lampesEspace[0].marque}` : ''} (auto-sélectionnée)
                </p>
              ) : (
                // Plusieurs lampes : dropdown de sélection
                <select
                  value={(params.id_lampe_materiel as number) || ''}
                  onChange={e => setParam('id_lampe_materiel', e.target.value ? Number(e.target.value) : undefined)}
                  className="w-full px-2 py-1.5 border border-yellow-300 dark:border-yellow-600 rounded text-sm bg-white dark:bg-gray-800"
                >
                  <option value="">Toutes les lampes</option>
                  {lampesEspace.map(l => (
                    <option key={l.id_materiel} value={l.id_materiel}>
                      {l.nom_materiel ?? `Lampe #${l.id_materiel}`}{l.marque ? ` — ${l.marque}` : ''}
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}

          {/* Champs dynamiques selon le type */}
          {actionDef && actionDef.fields && actionDef.fields.length > 0 && (
            <div className="space-y-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
              <p className="text-xs font-medium text-gray-600 dark:text-gray-300">{actionDef.icon} {actionDef.label}</p>
              {actionDef.fields.map(field => (
                <div key={field.key}>
                  <label className="block text-xs text-gray-600 dark:text-gray-300 mb-1">{field.label}</label>
                  {field.type === 'produit_engrais' ? (
                    <div className="space-y-2">
                      {produits.map((prod, idx) => (
                        <div key={idx} className="flex gap-2">
                          <select
                            value={prod.id_produit}
                            onChange={e => updateProduit(idx, 'id_produit', Number(e.target.value))}
                            className="flex-1 px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded text-xs"
                          >
                            <option value={0}>Choisir un produit…</option>
                            {produitsEngrais.map((p: { id_produit: number; nom_produit: string; quantite_stock?: number; unite_quantite?: string }) => (
                              <option key={p.id_produit} value={p.id_produit}>
                                {p.nom_produit} {p.quantite_stock != null ? `(stock: ${p.quantite_stock}${p.unite_quantite || ''})` : ''}
                              </option>
                            ))}
                          </select>
                          <input
                            type="number"
                            value={prod.quantite || ''}
                            onChange={e => updateProduit(idx, 'quantite', Number(e.target.value))}
                            placeholder="qté"
                            className="w-16 px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded text-xs"
                          />
                          <button type="button" onClick={() => removeProduit(idx)} className="text-red-400 hover:text-red-600">
                            <X size={14} />
                          </button>
                        </div>
                      ))}
                      <button type="button" onClick={addProduit}
                        className="text-xs text-grow-600 hover:text-grow-700 flex items-center gap-1">
                        + Ajouter un produit
                      </button>
                    </div>
                  ) : field.type === 'multi_liste' ? (
                    <MultiListeField
                      listeNom={field.listeNom ?? ''}
                      value={Array.isArray(params[field.key]) ? (params[field.key] as string[]) : []}
                      onChange={v => setParam(field.key, v)}
                    />
                  ) : field.type === 'select' ? (
                    <select
                      value={(params[field.key] as string) || ''}
                      onChange={e => setParam(field.key, e.target.value)}
                      className="w-full px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded text-sm"
                    >
                      <option value="">Choisir…</option>
                      {field.options?.map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  ) : (
                    <div className="flex items-center gap-2">
                      <input
                        type={field.type}
                        value={(params[field.key] as string | number) || ''}
                        onChange={e => setParam(field.key, field.type === 'number' ? Number(e.target.value) : e.target.value)}
                        placeholder={field.placeholder}
                        className="flex-1 px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded text-sm"
                      />
                      {field.unit && <span className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500">{field.unit}</span>}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Note */}
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">
              Note (optionnelle)
            </label>
            <textarea
              value={note}
              onChange={e => setNote(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm resize-none"
              placeholder="Observations, détails…"
            />
          </div>

          {/* Submit */}
          <div className="flex gap-3">
            <button type="button" onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/40 text-sm">
              Annuler
            </button>
            <button
              type="submit"
              disabled={loading || !selectedType}
              className="flex-1 px-4 py-2 bg-grow-600 text-white rounded-lg hover:bg-grow-700 disabled:opacity-50 text-sm flex items-center justify-center gap-2"
            >
              {loading && <Loader2 size={14} className="animate-spin" />}
              {loading ? 'Enregistrement…' : 'Enregistrer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Sélection multiple dans une liste paramétrable (Paramétrage) ──────────────
function MultiListeField({ listeNom, value, onChange }: {
  listeNom: string
  value: string[]
  onChange: (v: string[]) => void
}) {
  const { values, isLoading } = useParametreListe(listeNom)
  if (isLoading) return <Loader2 size={14} className="animate-spin text-gray-400" />
  if (!values.length) {
    return <p className="text-xs text-gray-400 dark:text-gray-500">Aucune valeur : ajoute-les dans Paramétrage.</p>
  }
  const toggle = (v: string) => onChange(value.includes(v) ? value.filter(x => x !== v) : [...value, v])
  return (
    <div className="flex flex-wrap gap-1.5">
      {values.map(v => {
        const on = value.includes(v)
        return (
          <button key={v} type="button" onClick={() => toggle(v)}
            className={`px-2 py-1 rounded-full text-xs border transition-colors ${on
              ? 'bg-orange-500 border-orange-500 text-white'
              : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:border-orange-400'}`}>
            {v}
          </button>
        )
      })}
    </div>
  )
}
