import { useState } from 'react'
import { X, ChevronDown } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { Plant, ActionCreate } from '../../api/cultures'
import { engraisAPI } from '../../api/engrais'
import {
  ACTION_TYPES, ACTIONS_BY_CATEGORY, ACTION_MAP,
  CATEGORY_COLORS, CATEGORY_LABELS, ActionCategory,
} from './actionTypes'

interface ProduitItem {
  id_produit: number
  quantite: number
}

interface Props {
  cultureId: number
  plants: Plant[]
  initialDate: string
  initialPlantId?: number
  onClose: () => void
  onSubmit: (data: ActionCreate) => Promise<void>
}

// Catégories qui s'appliquent à l'espace (pas aux plantes individuelles) par défaut
const SPACE_CATEGORIES: ActionCategory[] = ['lampe']

export default function ActionModal({ plants, initialDate, initialPlantId, onClose, onSubmit }: Props) {
  const [dateAction, setDateAction] = useState(initialDate)
  // target: 'space' | 'global' | plant id (string)
  const [target, setTarget] = useState<'space' | 'global' | string>(
    initialPlantId !== undefined ? String(initialPlantId) : 'global'
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

  const actionDef = selectedType ? ACTION_MAP[selectedType] : null

  // Statut de la plante actuellement ciblée (null si global/space)
  const selectedPlantStatut = (target !== 'global' && target !== 'space')
    ? (plants.find(p => p.id_plant === Number(target))?.statut ?? null)
    : null

  /** Filtre les actions selon les contraintes de la plante cible */
  function isActionVisible(action: (typeof ACTION_MAP)[string]): boolean {
    if (action.requiredPlantStatut) {
      // L'action nécessite un statut précis → masquée si global/space ou statut différent
      if (target === 'global' || target === 'space') return false
      return selectedPlantStatut === action.requiredPlantStatut
    }
    return true
  }

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
    const plantId  = (!isSpace && !isGlobal && target !== '') ? Number(target) : undefined

    try {
      await onSubmit({
        id_plant: plantId,
        date_action: dateAction,
        type_action: selectedType,
        parametres: Object.keys(finalParams).length > 0 ? finalParams : undefined,
        note: note || undefined,
        global_culture: isGlobal,
        space_only: isSpace,
      })
      onClose()
    } finally {
      setLoading(false)
    }
  }

  // Les actions d'arrosage sont gérées par ArrosageModal — on les exclut ici
  const categories = (Object.keys(ACTIONS_BY_CATEGORY) as ActionCategory[]).filter(c => c !== 'arrosage')

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
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">Date</label>
              <input type="date" value={dateAction} onChange={e => setDateAction(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:ring-2 focus:ring-grow-500 focus:border-transparent" />
            </div>
            {/* Cible */}
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">Cible</label>
              <select
                value={target}
                onChange={e => setTarget(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:ring-2 focus:ring-grow-500 focus:border-transparent"
              >
                <option value="space">🏠 Espace uniquement</option>
                <option value="global">🌿 Toutes les plantes</option>
                {plants.filter(p => !['recolte', 'abandonne'].includes(p.statut || '')).map(p => (
                  <option key={p.id_plant} value={p.id_plant}>{p.nom_affichage}</option>
                ))}
              </select>
              {target === 'space' && (
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Enregistré pour l'espace, sans impact sur les plantes</p>
              )}
            </div>
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
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">Note (optionnelle)</label>
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
              className="flex-1 px-4 py-2 bg-grow-600 text-white rounded-lg hover:bg-grow-700 disabled:opacity-50 text-sm"
            >
              {loading ? 'Enregistrement…' : 'Enregistrer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
