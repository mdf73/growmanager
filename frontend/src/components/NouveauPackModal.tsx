import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { X, Plus, Loader2, CheckCircle, Save } from 'lucide-react'
import { packCompletAPI, PackGraineCompletCreate, CatalogueItem } from '../api/graines'
import { fournisseurAPI } from '../api/fournisseurs'
import client from '../api/client'

interface Breeder { id_breeder: number; nom_breeder: string }
interface Variete  { id_variete: number; nom_variete: string; croisement_variete?: string }

interface NouveauPackModalProps {
  onClose: () => void
  editPack?: CatalogueItem
}

type Step = 'form' | 'success'

export default function NouveauPackModal({ onClose, editPack }: NouveauPackModalProps) {
  const isEdit = !!editPack
  const queryClient = useQueryClient()
  const [step, setStep] = useState<Step>('form')
  const [successMsg, setSuccessMsg] = useState('')

  const [form, setForm] = useState({
    id_breeder:        editPack?.id_breeder   ?? ('' as number | ''),
    id_variete:        editPack?.id_variete   ?? ('' as number | ''),
    id_fournisseur:    editPack?.id_fournisseur ?? ('' as number | ''),
    nbr_graines:       editPack?.nbr_graines_total ?? 1,
    prix_achat:        editPack?.prix_par_graine
                         ? String((editPack.prix_par_graine * editPack.nbr_graines_total).toFixed(2))
                         : '',
    date_achat:        editPack?.date_achat ?? new Date().toISOString().split('T')[0],
    types_graines:     editPack?.type_graines ?? 'Féminisée',
    croisement_variete: editPack?.croisement_variete ?? '',
    duree_flo_min:     editPack?.duree_flo_min ? String(editPack.duree_flo_min) : '',
    duree_flo_max:     editPack?.duree_flo_max ? String(editPack.duree_flo_max) : '',
    edition_limite:    editPack?.edition_limite ?? false,
  })

  const [newBreederName, setNewBreederName]       = useState('')
  const [newVarieteName, setNewVarieteName]       = useState('')
  const [newFournisseurName, setNewFournisseurName] = useState('')
  const [showNewBreeder, setShowNewBreeder]       = useState(false)
  const [showNewVariete, setShowNewVariete]       = useState(false)
  const [showNewFournisseur, setShowNewFournisseur] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const { data: breeders = [] }     = useQuery<Breeder[]>({ queryKey: ['breeders'],     queryFn: async () => (await client.get<Breeder[]>('/breeders/')).data })
  const { data: varietes = [] }     = useQuery<Variete[]>({ queryKey: ['varietes'],     queryFn: async () => (await client.get<Variete[]>('/varietes/')).data })
  const { data: fournisseurs = [] } = useQuery({            queryKey: ['fournisseurs'],  queryFn: async () => (await fournisseurAPI.getAll()).data })

  // Auto-remplir le croisement quand une variété est sélectionnée
  useEffect(() => {
    if (!form.id_variete) return
    const v = varietes.find(v => v.id_variete === Number(form.id_variete))
    if (v) setForm(f => ({ ...f, croisement_variete: v.croisement_variete ?? '' }))
  }, [form.id_variete, varietes])

  const addBreeder = useMutation({
    mutationFn: (nom: string) => client.post<Breeder>('/breeders/', { nom_breeder: nom }),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['breeders'] })
      setForm(f => ({ ...f, id_breeder: res.data.id_breeder }))
      setNewBreederName(''); setShowNewBreeder(false)
    },
  })
  const addVariete = useMutation({
    mutationFn: (nom: string) => client.post<Variete>('/varietes/', { nom_variete: nom }),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['varietes'] })
      setForm(f => ({ ...f, id_variete: res.data.id_variete, croisement_variete: '' }))
      setNewVarieteName(''); setShowNewVariete(false)
    },
  })
  const addFournisseur = useMutation({
    mutationFn: (nom: string) => fournisseurAPI.create({ nom_fournisseur: nom }),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['fournisseurs'] })
      setForm(f => ({ ...f, id_fournisseur: res.data.id_fournisseur }))
      setNewFournisseurName(''); setShowNewFournisseur(false)
    },
  })

  const createPack = useMutation({
    mutationFn: (data: PackGraineCompletCreate) => packCompletAPI.create(data),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['catalogue'] })
      queryClient.invalidateQueries({ queryKey: ['varietes'] })
      setSuccessMsg(`Pack créé ! ${res.data.nbr_graines_crees} graine${res.data.nbr_graines_crees > 1 ? 's' : ''} ajoutée${res.data.nbr_graines_crees > 1 ? 's' : ''} — ${res.data.breeder_nom} · ${res.data.variete_nom}`)
      setStep('success')
    },
  })

  const updatePack = useMutation({
    mutationFn: (data: Omit<PackGraineCompletCreate, 'nbr_graines'> & { nbr_graines?: number }) =>
      packCompletAPI.update(editPack!.id_packgraine, data),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['catalogue'] })
      queryClient.invalidateQueries({ queryKey: ['varietes'] })
      queryClient.invalidateQueries({ queryKey: ['pack-graines', editPack!.id_packgraine] })
      setSuccessMsg(`Pack mis à jour — ${res.data.breeder_nom} · ${res.data.variete_nom}`)
      setStep('success')
    },
  })

  const isPending = createPack.isPending || updatePack.isPending
  const isError   = createPack.isError   || updatePack.isError

  const validate = () => {
    const e: Record<string, string> = {}
    if (!form.id_breeder) e.id_breeder = 'Sélectionne un breeder'
    if (!form.id_variete) e.id_variete = 'Sélectionne une variété'
    if (!isEdit && (!form.nbr_graines || form.nbr_graines < 1)) e.nbr_graines = 'Au moins 1 graine'
    if (form.duree_flo_min && form.duree_flo_max && Number(form.duree_flo_min) > Number(form.duree_flo_max))
      e.duree_flo = 'Min doit être ≤ Max'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const buildPayload = () => ({
    id_breeder:         Number(form.id_breeder),
    id_variete:         Number(form.id_variete),
    id_fournisseur:     form.id_fournisseur ? Number(form.id_fournisseur) : undefined,
    nbr_graines:        form.nbr_graines,
    prix_achat:         form.prix_achat ? Number(form.prix_achat) : undefined,
    date_achat:         form.date_achat || undefined,
    croisement_variete: form.croisement_variete || undefined,
    types_graines:      form.types_graines || undefined,
    duree_flo_min:      form.duree_flo_min ? Number(form.duree_flo_min) : undefined,
    duree_flo_max:      form.duree_flo_max ? Number(form.duree_flo_max) : undefined,
    edition_limite:     form.edition_limite,
  })

  const handleSubmit = () => {
    if (!validate()) return
    isEdit
      ? updatePack.mutate(buildPayload())
      : createPack.mutate({ ...buildPayload(), nbr_graines: form.nbr_graines })
  }

  const ic = (field?: string) =>
    `w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-grow-600 ${field && errors[field] ? 'border-red-400' : 'border-gray-300 dark:border-gray-600'}`

  // ---- Succès ----
  if (step === 'success') {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-sm p-8 text-center space-y-4">
          <CheckCircle className="mx-auto text-green-500" size={56} />
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">{isEdit ? 'Pack modifié !' : 'Pack ajouté !'}</h2>
          <p className="text-gray-600 dark:text-gray-300 text-sm">{successMsg}</p>
          <div className="flex gap-3 mt-6">
            {!isEdit && (
              <button
                onClick={() => { setStep('form'); setForm(f => ({ ...f, id_breeder: '', id_variete: '', croisement_variete: '' })) }}
                className="flex-1 px-4 py-2 border border-grow-600 text-grow-600 rounded-lg hover:bg-grow-50 text-sm font-medium"
              >
                Nouveau pack
              </button>
            )}
            <button onClick={onClose} className="flex-1 px-4 py-2 bg-grow-600 text-white rounded-lg hover:bg-grow-700 text-sm font-medium">
              Fermer
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ---- Formulaire ----
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-700">
          <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">
            {isEdit ? `Modifier — ${editPack!.variete_nom}` : 'Nouveau pack de graines'}
          </h2>
          <button onClick={onClose} className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:text-gray-300"><X size={22} /></button>
        </div>

        <div className="px-6 py-5 space-y-5">

          {/* Breeder */}
          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200">Breeder <span className="text-red-500">*</span></label>
            {!showNewBreeder ? (
              <div className="flex gap-2">
                <select value={form.id_breeder} onChange={e => setForm(f => ({ ...f, id_breeder: e.target.value ? Number(e.target.value) : '' }))} className={ic('id_breeder')}>
                  <option value="">— Sélectionner —</option>
                  {breeders.map(b => <option key={b.id_breeder} value={b.id_breeder}>{b.nom_breeder}</option>)}
                </select>
                <button onClick={() => setShowNewBreeder(true)} className="shrink-0 px-3 py-2 border border-grow-600 text-grow-600 rounded-lg hover:bg-grow-50"><Plus size={16} /></button>
              </div>
            ) : (
              <div className="flex gap-2">
                <input autoFocus type="text" placeholder="Nom du breeder" value={newBreederName} onChange={e => setNewBreederName(e.target.value)} onKeyDown={e => e.key === 'Enter' && newBreederName && addBreeder.mutate(newBreederName)} className={ic()} />
                <button onClick={() => newBreederName && addBreeder.mutate(newBreederName)} disabled={addBreeder.isPending} className="shrink-0 px-3 py-2 bg-grow-600 text-white rounded-lg hover:bg-grow-700 text-sm">
                  {addBreeder.isPending ? <Loader2 size={16} className="animate-spin" /> : 'OK'}
                </button>
                <button onClick={() => setShowNewBreeder(false)} className="shrink-0 px-3 py-2 border border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400 dark:text-gray-500 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/40 text-sm">✕</button>
              </div>
            )}
            {errors.id_breeder && <p className="text-xs text-red-500">{errors.id_breeder}</p>}
          </div>

          {/* Variété */}
          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200">Variété <span className="text-red-500">*</span></label>
            {!showNewVariete ? (
              <div className="flex gap-2">
                <select value={form.id_variete} onChange={e => setForm(f => ({ ...f, id_variete: e.target.value ? Number(e.target.value) : '' }))} className={ic('id_variete')}>
                  <option value="">— Sélectionner —</option>
                  {varietes.map(v => <option key={v.id_variete} value={v.id_variete}>{v.nom_variete}</option>)}
                </select>
                <button onClick={() => setShowNewVariete(true)} className="shrink-0 px-3 py-2 border border-grow-600 text-grow-600 rounded-lg hover:bg-grow-50"><Plus size={16} /></button>
              </div>
            ) : (
              <div className="flex gap-2">
                <input autoFocus type="text" placeholder="Nom de la variété" value={newVarieteName} onChange={e => setNewVarieteName(e.target.value)} onKeyDown={e => e.key === 'Enter' && newVarieteName && addVariete.mutate(newVarieteName)} className={ic()} />
                <button onClick={() => newVarieteName && addVariete.mutate(newVarieteName)} disabled={addVariete.isPending} className="shrink-0 px-3 py-2 bg-grow-600 text-white rounded-lg hover:bg-grow-700 text-sm">
                  {addVariete.isPending ? <Loader2 size={16} className="animate-spin" /> : 'OK'}
                </button>
                <button onClick={() => setShowNewVariete(false)} className="shrink-0 px-3 py-2 border border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400 dark:text-gray-500 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/40 text-sm">✕</button>
              </div>
            )}
            {errors.id_variete && <p className="text-xs text-red-500">{errors.id_variete}</p>}
          </div>

          {/* Croisement — toujours visible, auto-rempli depuis la variété */}
          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200">
              Croisement
              <span className="ml-1 text-xs font-normal text-gray-400 dark:text-gray-500">(ex: OG Kush × Durban Poison)</span>
            </label>
            <input
              type="text"
              placeholder="Croisement génétique"
              value={form.croisement_variete}
              onChange={e => setForm(f => ({ ...f, croisement_variete: e.target.value }))}
              className={ic()}
            />
            <p className="text-xs text-gray-400 dark:text-gray-500">Mis à jour sur la variété si renseigné</p>
          </div>

          {/* Type + Floraison */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200">Type</label>
              <select value={form.types_graines} onChange={e => setForm(f => ({ ...f, types_graines: e.target.value }))} className={ic()}>
                <option value="Féminisée">Féminisée</option>
                <option value="Régulière">Régulière</option>
                <option value="Auto">Auto</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200">Floraison (jours)</label>
              <div className="flex gap-1 items-center">
                <input type="number" placeholder="Min" min={1} value={form.duree_flo_min} onChange={e => setForm(f => ({ ...f, duree_flo_min: e.target.value }))} className={`w-full px-2 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-grow-600 ${errors.duree_flo ? 'border-red-400' : 'border-gray-300 dark:border-gray-600'}`} />
                <span className="text-gray-400 dark:text-gray-500 text-xs shrink-0">→</span>
                <input type="number" placeholder="Max" min={1} value={form.duree_flo_max} onChange={e => setForm(f => ({ ...f, duree_flo_max: e.target.value }))} className={`w-full px-2 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-grow-600 ${errors.duree_flo ? 'border-red-400' : 'border-gray-300 dark:border-gray-600'}`} />
              </div>
              {errors.duree_flo && <p className="text-xs text-red-500">{errors.duree_flo}</p>}
            </div>
          </div>

          {/* Nb graines + Prix */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200">
                Nb graines {!isEdit && <span className="text-red-500">*</span>}
              </label>
              <input
                type="number" min={1} max={500}
                value={form.nbr_graines}
                onChange={e => setForm(f => ({ ...f, nbr_graines: Number(e.target.value) }))}
                className={ic('nbr_graines')}
              />
              {isEdit && editPack && (
                <p className="text-xs text-gray-400 dark:text-gray-500">
                  Actuellement {editPack.nbr_graines_total} au total
                  · {editPack.nbr_graines_restantes} restante{editPack.nbr_graines_restantes > 1 ? 's' : ''}
                  {form.nbr_graines < editPack.nbr_graines_total && (
                    <span className="text-orange-500">
                      {' '}— {editPack.nbr_graines_total - form.nbr_graines} seront supprimée{editPack.nbr_graines_total - form.nbr_graines > 1 ? 's' : ''} (non-utilisées en priorité)
                    </span>
                  )}
                  {form.nbr_graines > editPack.nbr_graines_total && (
                    <span className="text-green-600">
                      {' '}— {form.nbr_graines - editPack.nbr_graines_total} seront ajoutée{form.nbr_graines - editPack.nbr_graines_total > 1 ? 's' : ''}
                    </span>
                  )}
                </p>
              )}
              {errors.nbr_graines && <p className="text-xs text-red-500">{errors.nbr_graines}</p>}
            </div>
            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200">Prix du pack (€)</label>
              <input type="number" step="0.01" min={0} placeholder="0.00" value={form.prix_achat} onChange={e => setForm(f => ({ ...f, prix_achat: e.target.value }))} className={ic()} />
            </div>
          </div>

          {/* Date + Fournisseur */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200">Date d'achat</label>
              <input type="date" value={form.date_achat} onChange={e => setForm(f => ({ ...f, date_achat: e.target.value }))} className={ic()} />
            </div>
            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200">Fournisseur</label>
              {!showNewFournisseur ? (
                <div className="flex gap-2">
                  <select value={form.id_fournisseur} onChange={e => setForm(f => ({ ...f, id_fournisseur: e.target.value ? Number(e.target.value) : '' }))} className={ic()}>
                    <option value="">— Optionnel —</option>
                    {fournisseurs.map(f => <option key={f.id_fournisseur} value={f.id_fournisseur}>{f.nom_fournisseur}</option>)}
                  </select>
                  <button onClick={() => setShowNewFournisseur(true)} className="shrink-0 px-2 py-2 border border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400 dark:text-gray-500 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/40"><Plus size={14} /></button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <input autoFocus type="text" placeholder="Nom du fournisseur" value={newFournisseurName} onChange={e => setNewFournisseurName(e.target.value)} onKeyDown={e => e.key === 'Enter' && newFournisseurName && addFournisseur.mutate(newFournisseurName)} className={ic()} />
                  <button onClick={() => newFournisseurName && addFournisseur.mutate(newFournisseurName)} disabled={addFournisseur.isPending} className="shrink-0 px-2 py-2 bg-grow-600 text-white rounded-lg hover:bg-grow-700 text-sm">
                    {addFournisseur.isPending ? <Loader2 size={14} className="animate-spin" /> : 'OK'}
                  </button>
                  <button onClick={() => setShowNewFournisseur(false)} className="shrink-0 px-2 py-2 border border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400 dark:text-gray-500 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/40 text-sm">✕</button>
                </div>
              )}
            </div>
          </div>

          {/* Edition limitée */}
          <label className="flex items-center gap-3 cursor-pointer select-none">
            <input type="checkbox" checked={form.edition_limite} onChange={e => setForm(f => ({ ...f, edition_limite: e.target.checked }))} className="w-4 h-4 accent-grow-600" />
            <span className="text-sm text-gray-700 dark:text-gray-200">Édition limitée</span>
          </label>

          {/* Résumé prix par graine */}
          {form.prix_achat && form.nbr_graines > 0 && (
            <div className="bg-grow-50 rounded-lg px-4 py-3 text-sm text-grow-700">
              Prix par graine : <span className="font-semibold">{(Number(form.prix_achat) / form.nbr_graines).toFixed(2)} €</span>
            </div>
          )}

          {isError && (
            <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">
              Erreur lors de la {isEdit ? 'modification' : 'création'}. Vérifie les informations.
            </p>
          )}
        </div>

        <div className="flex gap-3 px-6 py-4 border-t border-gray-100 dark:border-gray-700">
          <button onClick={onClose} className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/40 text-sm font-medium">
            Annuler
          </button>
          <button onClick={handleSubmit} disabled={isPending} className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-grow-600 text-white rounded-lg hover:bg-grow-700 text-sm font-medium disabled:opacity-60">
            {isPending
              ? <><Loader2 size={16} className="animate-spin" />{isEdit ? 'Enregistrement...' : 'Création...'}</>
              : isEdit
                ? <><Save size={16} />Enregistrer</>
                : <><Plus size={16} />Créer le pack</>
            }
          </button>
        </div>
      </div>
    </div>
  )
}
