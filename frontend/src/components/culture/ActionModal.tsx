import { useState, useEffect, useRef } from 'react'
import { X, ChevronDown, Camera, Loader2 } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { Plant, ActionCreate } from '../../api/cultures'
import { engraisAPI } from '../../api/engrais'
import { espacesAPI, EspaceMateriel } from '../../api/espaces'
import { photosAPI } from '../../api/photos'
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
  // ── État pour l'upload photo ────────────────────────────────────────────────
  const [photoFiles, setPhotoFiles]   = useState<File[]>([])
  const [photoDrag,  setPhotoDrag]    = useState(false)
  const photoInputRef = useRef<HTMLInputElement>(null)

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
    // Pour le type photo, au moins une photo est requise
    if (selectedType === 'photo' && photoFiles.length === 0) return
    setLoading(true)

    const finalParams: Record<string, unknown> = { ...params }
    if (selectedType === 'arrosage_engrais' && produits.length > 0) {
      finalParams.produits = produits.filter(p => p.id_produit > 0)
    }

    const isSpace  = target === 'space'
    const isGlobal = target === 'global'
    const plantId  = (!isSpace && !isGlobal && target !== '') ? Number(target) : undefined

    try {
      // ── Si action photo : uploader les fichiers avec la date de l'action ────
      if (selectedType === 'photo' && photoFiles.length > 0) {
        for (const file of photoFiles) {
          await photosAPI.upload({
            file,
            id_culture: cultureId,
            ...(plantId !== undefined && { id_plant: plantId }),
            notes:      note || undefined,
            date_prise: dateAction,   // date de l'action = date de la photo
          })
        }
        // Stocker le nombre de photos dans les paramètres de l'action
        finalParams.nb_photos = photoFiles.length
      }

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

          {/* ── Zone upload photo (uniquement quand type=photo) ────────────────── */}
          {selectedType === 'photo' && (
            <div className="space-y-2">
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-300">
                Photos <span className="text-red-500">*</span>
                <span className="text-gray-400 font-normal ml-1">(JPG, PNG, WebP — la date est celle de l'action)</span>
              </label>

              {/* Drop zone */}
              <div
                className={`border-2 border-dashed rounded-xl p-5 flex flex-col items-center gap-2 cursor-pointer transition-colors
                  ${photoDrag
                    ? 'border-grow-400 bg-grow-50 dark:bg-grow-900/20'
                    : 'border-gray-200 dark:border-gray-700 hover:border-grow-300 dark:hover:border-grow-600'}`}
                onClick={() => photoInputRef.current?.click()}
                onDragOver={e => { e.preventDefault(); setPhotoDrag(true) }}
                onDragLeave={() => setPhotoDrag(false)}
                onDrop={e => {
                  e.preventDefault()
                  setPhotoDrag(false)
                  const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'))
                  if (files.length) setPhotoFiles(prev => [...prev, ...files])
                }}
              >
                <input
                  ref={photoInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={e => {
                    if (e.target.files) {
                      setPhotoFiles(prev => [...prev, ...Array.from(e.target.files!)])
                    }
                  }}
                />
                <Camera size={24} className="text-gray-400" />
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  Cliquer ou glisser des photos ici
                </span>
              </div>

              {/* Aperçu des fichiers sélectionnés */}
              {photoFiles.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-1">
                  {photoFiles.map((f, i) => (
                    <div key={i} className="relative group">
                      <img
                        src={URL.createObjectURL(f)}
                        alt={f.name}
                        className="w-16 h-16 object-cover rounded-lg border border-gray-200 dark:border-gray-600"
                      />
                      <button
                        type="button"
                        onClick={() => setPhotoFiles(prev => prev.filter((_, idx) => idx !== i))}
                        className="absolute -top-1.5 -right-1.5 bg-red-500 text-white rounded-full w-4 h-4 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        ×
                      </button>
                      <span className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-[9px] truncate px-1 rounded-b-lg">
                        {f.name}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Note */}
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">
              {selectedType === 'photo' ? 'Légende / note (optionnelle)' : 'Note (optionnelle)'}
            </label>
            <textarea
              value={note}
              onChange={e => setNote(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm resize-none"
              placeholder={selectedType === 'photo' ? 'Légende appliquée à toutes les photos…' : 'Observations, détails…'}
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
              disabled={loading || !selectedType || (selectedType === 'photo' && photoFiles.length === 0)}
              className="flex-1 px-4 py-2 bg-grow-600 text-white rounded-lg hover:bg-grow-700 disabled:opacity-50 text-sm flex items-center justify-center gap-2"
            >
              {loading && <Loader2 size={14} className="animate-spin" />}
              {loading
                ? (selectedType === 'photo' ? 'Upload en cours…' : 'Enregistrement…')
                : (selectedType === 'photo' && photoFiles.length > 0
                    ? `Uploader ${photoFiles.length} photo${photoFiles.length > 1 ? 's' : ''}`
                    : 'Enregistrer')
              }
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
