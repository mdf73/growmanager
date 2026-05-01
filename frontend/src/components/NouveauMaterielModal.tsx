import { useState, useEffect, useCallback } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { X, Loader2, Plus, Trash2, RefreshCw } from 'lucide-react'
import { materielAPI, CATEGORIES, ETATS, genBocalNom } from '../api/materiel'
import type { MaterielCreate, MaterielUpdate, Materiel } from '../api/materiel'
import { useParametreListeWithAdd } from '../api/parametres'

// ── Helpers UI ────────────────────────────────────────────────────────────────
const inputCls  = 'w-full border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-grow-400 focus:border-transparent'
const selectCls = inputCls

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500 mb-1">
        {label}{required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  )
}

function NumInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <input type="number" step="any" className={inputCls}
      value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} />
  )
}

// ── Select avec bouton "Ajouter" inline ───────────────────────────────────────
function SelectWithAdd({
  values, isAdding, onAddValue, value, onChange, placeholder = '—',
}: {
  values: string[]
  isAdding: boolean
  onAddValue: (v: string) => Promise<unknown>
  value: string
  onChange: (v: string) => void
  placeholder?: string
}) {
  const [adding, setAdding] = useState(false)
  const [newVal, setNewVal] = useState('')

  const handleAdd = async () => {
    const v = newVal.trim()
    if (!v) return
    await onAddValue(v)
    onChange(v)
    setNewVal('')
    setAdding(false)
  }

  if (adding) {
    return (
      <div className="flex gap-1">
        <input autoFocus type="text" className={`${inputCls} flex-1`}
          value={newVal} onChange={e => setNewVal(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') handleAdd(); if (e.key === 'Escape') setAdding(false) }}
          placeholder="Nouvelle valeur…" />
        <button type="button" onClick={handleAdd} disabled={isAdding || !newVal.trim()}
          className="px-2 py-1 bg-grow-600 text-white text-xs rounded-lg hover:bg-grow-700 disabled:opacity-40">
          {isAdding ? <Loader2 size={11} className="animate-spin" /> : '✓'}
        </button>
        <button type="button" onClick={() => setAdding(false)}
          className="px-2 py-1 border border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 dark:text-gray-500 text-xs rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/40">
          ✕
        </button>
      </div>
    )
  }

  return (
    <div className="flex gap-1">
      <select className={`${selectCls} flex-1`} value={value} onChange={e => onChange(e.target.value)}>
        <option value="">{placeholder}</option>
        {values.map(v => <option key={v} value={v}>{v}</option>)}
      </select>
      <button type="button" onClick={() => setAdding(true)}
        className="px-2 border border-gray-200 dark:border-gray-700 text-gray-400 dark:text-gray-500 hover:text-grow-600 hover:border-grow-300 rounded-lg text-xs"
        title="Ajouter une valeur">
        <Plus size={13} />
      </button>
    </div>
  )
}

// ── Champs spécifiques par catégorie ──────────────────────────────────────────
function CaractFields({ categorie, caract, setCaract }: {
  categorie: string
  caract: Record<string, unknown>
  setCaract: (c: Record<string, unknown>) => void
}) {
  const set = (k: string, v: unknown) => setCaract({ ...caract, [k]: v })

  const lampeTypes      = useParametreListeWithAdd('lampes_types')
  const spectres        = useParametreListeWithAdd('spectres')
  const potMatieres     = useParametreListeWithAdd('pot_matieres')
  const arrosageTypes   = useParametreListeWithAdd('arrosage_types')
  const pompeTypes      = useParametreListeWithAdd('pompe_types')
  const ventiTypes      = useParametreListeWithAdd('ventilation_types')
  const filetTypes      = useParametreListeWithAdd('filet_types')
  const sechageTypes    = useParametreListeWithAdd('sechage_types')
  const outilTypes      = useParametreListeWithAdd('outil_types')
  const bocalFermetures = useParametreListeWithAdd('bocal_fermetures')
  const bocalCouleurs   = useParametreListeWithAdd('bocal_couleurs')
  const bocalUsages     = useParametreListeWithAdd('bocal_usages')

  switch (categorie) {
    case 'Lampes': {
      const spectresList: string[] = (caract.spectres as string[]) || []
      const addSpectre = () => {
        if (spectresList.length < 5) setCaract({ ...caract, spectres: [...spectresList, ''] })
      }
      const updateSpectre = (i: number, v: string) => {
        const s = [...spectresList]; s[i] = v; setCaract({ ...caract, spectres: s })
      }
      const removeSpectre = (i: number) => {
        setCaract({ ...caract, spectres: spectresList.filter((_, j) => j !== i) })
      }
      return (
        <div className="grid grid-cols-2 gap-3">
          <Field label="Type">
            <SelectWithAdd values={lampeTypes.values} isAdding={lampeTypes.isAdding}
              onAddValue={lampeTypes.addValue}
              value={(caract.type as string) || ''} onChange={v => set('type', v || null)} />
          </Field>
          <Field label="Puissance (W)">
            <NumInput value={caract.puissance_w != null ? String(caract.puissance_w) : ''} onChange={v => set('puissance_w', v ? Number(v) : null)} placeholder="ex: 550" />
          </Field>
          <Field label="Dimmer">
            <select className={selectCls} value={caract.dimmer === true ? 'true' : caract.dimmer === false ? 'false' : ''} onChange={e => set('dimmer', e.target.value === '' ? null : e.target.value === 'true')}>
              <option value="">—</option>
              <option value="true">Oui</option>
              <option value="false">Non</option>
            </select>
          </Field>
          <div className="col-span-2">
            <label className="block text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500 mb-1">Spectres (max 5)</label>
            <div className="space-y-2">
              {spectresList.map((s, i) => (
                <div key={i} className="flex gap-2">
                  <SelectWithAdd values={spectres.values} isAdding={spectres.isAdding}
                    onAddValue={spectres.addValue}
                    value={s} onChange={v => updateSpectre(i, v)} placeholder="— choisir —" />
                  <button type="button" onClick={() => removeSpectre(i)} className="text-red-400 hover:text-red-600"><Trash2 size={14} /></button>
                </div>
              ))}
              {spectresList.length < 5 && (
                <button type="button" onClick={addSpectre}
                  className="flex items-center gap-1 text-xs text-grow-600 hover:text-grow-700">
                  <Plus size={12} /> Ajouter un spectre
                </button>
              )}
            </div>
          </div>
        </div>
      )
    }

    case 'Pots':
      return (
        <div className="grid grid-cols-2 gap-3">
          <Field label="Volume (L)">
            <NumInput value={caract.volume_l != null ? String(caract.volume_l) : ''} onChange={v => set('volume_l', v ? Number(v) : null)} placeholder="ex: 11" />
          </Field>
          <Field label="Matière">
            <SelectWithAdd values={potMatieres.values} isAdding={potMatieres.isAdding}
              onAddValue={potMatieres.addValue}
              value={(caract.matiere as string) || ''} onChange={v => set('matiere', v || null)} />
          </Field>
        </div>
      )

    case 'Coupelles et bacs':
      return (
        <div className="grid grid-cols-2 gap-3">
          <Field label="Volume (L)">
            <NumInput value={caract.volume_l != null ? String(caract.volume_l) : ''} onChange={v => set('volume_l', v ? Number(v) : null)} placeholder="ex: 5" />
          </Field>
          <Field label="Dimensions (cm)">
            <input type="text" className={inputCls} value={(caract.dimensions as string) || ''} onChange={e => set('dimensions', e.target.value || null)} placeholder="ex: 30x20x10" />
          </Field>
        </div>
      )

    case 'Arrosage':
      return (
        <div className="grid grid-cols-2 gap-3">
          <Field label="Type">
            <SelectWithAdd values={arrosageTypes.values} isAdding={arrosageTypes.isAdding}
              onAddValue={arrosageTypes.addValue}
              value={(caract.type as string) || ''} onChange={v => set('type', v || null)} />
          </Field>
          <Field label="Débit (L/h)">
            <NumInput value={caract.debit_lh != null ? String(caract.debit_lh) : ''} onChange={v => set('debit_lh', v ? Number(v) : null)} placeholder="ex: 4" />
          </Field>
          <Field label="Capacité (L)">
            <NumInput value={caract.capacite_l != null ? String(caract.capacite_l) : ''} onChange={v => set('capacite_l', v ? Number(v) : null)} placeholder="ex: 20" />
          </Field>
        </div>
      )

    case 'Tentes':
      return (
        <Field label="Dimensions L×l×H (cm)">
          <input type="text" className={inputCls} value={(caract.dimensions as string) || ''} onChange={e => set('dimensions', e.target.value || null)} placeholder="ex: 120x120x200" />
        </Field>
      )

    case 'Pompes et Bulleurs':
      return (
        <div className="grid grid-cols-2 gap-3">
          <Field label="Type">
            <SelectWithAdd values={pompeTypes.values} isAdding={pompeTypes.isAdding}
              onAddValue={pompeTypes.addValue}
              value={(caract.type as string) || ''} onChange={v => set('type', v || null)} />
          </Field>
          <Field label="Débit (L/h)">
            <NumInput value={caract.debit_lh != null ? String(caract.debit_lh) : ''} onChange={v => set('debit_lh', v ? Number(v) : null)} placeholder="ex: 500" />
          </Field>
        </div>
      )

    case 'Ventilation':
      return (
        <div className="grid grid-cols-2 gap-3">
          <Field label="Type">
            <SelectWithAdd values={ventiTypes.values} isAdding={ventiTypes.isAdding}
              onAddValue={ventiTypes.addValue}
              value={(caract.type as string) || ''} onChange={v => set('type', v || null)} />
          </Field>
          <Field label="Débit (m³/h)">
            <NumInput value={caract.debit_m3h != null ? String(caract.debit_m3h) : ''} onChange={v => set('debit_m3h', v ? Number(v) : null)} placeholder="ex: 200" />
          </Field>
          <Field label="Diamètre (mm)">
            <NumInput value={caract.diametre_mm != null ? String(caract.diametre_mm) : ''} onChange={v => set('diametre_mm', v ? Number(v) : null)} placeholder="ex: 125" />
          </Field>
        </div>
      )

    case 'Filets':
      return (
        <div className="grid grid-cols-2 gap-3">
          <Field label="Type">
            <SelectWithAdd values={filetTypes.values} isAdding={filetTypes.isAdding}
              onAddValue={filetTypes.addValue}
              value={(caract.type as string) || ''} onChange={v => set('type', v || null)} />
          </Field>
          <Field label="Maille (mm)">
            <NumInput value={caract.maille_mm != null ? String(caract.maille_mm) : ''} onChange={v => set('maille_mm', v ? Number(v) : null)} placeholder="ex: 50" />
          </Field>
          <Field label="Dimensions (cm)">
            <input type="text" className={inputCls} value={(caract.dimensions as string) || ''} onChange={e => set('dimensions', e.target.value || null)} placeholder="ex: 120x120" />
          </Field>
        </div>
      )

    case 'Séchage':
      return (
        <div className="grid grid-cols-2 gap-3">
          <Field label="Type">
            <SelectWithAdd values={sechageTypes.values} isAdding={sechageTypes.isAdding}
              onAddValue={sechageTypes.addValue}
              value={(caract.type as string) || ''} onChange={v => set('type', v || null)} />
          </Field>
          <Field label="Capacité">
            <input type="text" className={inputCls} value={(caract.capacite as string) || ''} onChange={e => set('capacite', e.target.value || null)} placeholder="ex: 10 couches / 5 kg" />
          </Field>
          <Field label="Dimensions (cm)">
            <input type="text" className={inputCls} value={(caract.dimensions as string) || ''} onChange={e => set('dimensions', e.target.value || null)} placeholder="ex: 60x60x120" />
          </Field>
        </div>
      )

    case 'Outils':
      return (
        <Field label="Type">
          <SelectWithAdd values={outilTypes.values} isAdding={outilTypes.isAdding}
            onAddValue={outilTypes.addValue}
            value={(caract.type as string) || ''} onChange={v => set('type', v || null)} />
        </Field>
      )

    case 'Bocaux': {
      const volMl = caract.volume_ml as number | null ?? null
      return (
        <div className="grid grid-cols-2 gap-3">
          {/* Volume avec unité — mise à jour atomique pour éviter l'écrasement */}
          <div className="col-span-2">
            <label className="block text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500 mb-1">Volume</label>
            <div className="flex gap-2">
              <input
                type="number" step="any" min="0" className={`${inputCls} flex-1`}
                value={caract._vol_val != null ? String(caract._vol_val) : ''}
                onChange={e => {
                  const raw  = e.target.value !== '' ? Number(e.target.value) : null
                  const unit = (caract._vol_unit as string) || 'mL'
                  const ml   = raw != null ? (unit === 'L' ? raw * 1000 : raw) : null
                  setCaract({ ...caract, _vol_val: raw, volume_ml: ml })
                }}
                placeholder={((caract._vol_unit as string) || 'mL') === 'L' ? 'ex: 1' : 'ex: 500'}
              />
              <select
                className="border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-1.5 text-sm focus:ring-2 focus:ring-grow-400 bg-white dark:bg-gray-800"
                value={(caract._vol_unit as string) || 'mL'}
                onChange={e => {
                  const unit = e.target.value
                  const raw  = caract._vol_val as number | null ?? null
                  const ml   = raw != null ? (unit === 'L' ? raw * 1000 : raw) : null
                  setCaract({ ...caract, _vol_unit: unit, volume_ml: ml })
                }}
              >
                <option value="mL">mL</option>
                <option value="L">L</option>
              </select>
            </div>
            {volMl != null && (
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                → {volMl >= 500 ? 'Bocal' : 'Pot'} · {volMl >= 1000 ? `${volMl / 1000} L` : `${volMl} mL`}
              </p>
            )}
          </div>

          <Field label="Type de fermeture">
            <SelectWithAdd
              values={bocalFermetures.values} isAdding={bocalFermetures.isAdding}
              onAddValue={bocalFermetures.addValue}
              value={(caract.fermeture as string) || ''}
              onChange={v => set('fermeture', v || null)} />
          </Field>

          <Field label="Couleur du verre">
            <SelectWithAdd
              values={bocalCouleurs.values} isAdding={bocalCouleurs.isAdding}
              onAddValue={bocalCouleurs.addValue}
              value={(caract.couleur as string) || ''}
              onChange={v => set('couleur', v || null)} />
          </Field>

          <div className="col-span-2">
            <Field label="Usage principal">
              <SelectWithAdd
                values={bocalUsages.values} isAdding={bocalUsages.isAdding}
                onAddValue={bocalUsages.addValue}
                value={(caract.usage as string) || ''}
                onChange={v => set('usage', v || null)} />
            </Field>
          </div>
        </div>
      )
    }

    default:
      return null
  }
}

// ── Modal ─────────────────────────────────────────────────────────────────────
interface Props {
  editItem?: Materiel | null
  onClose:   () => void
}

export default function NouveauMaterielModal({ editItem, onClose }: Props) {
  const qc   = useQueryClient()
  const isEdit = !!editItem

  const marques      = useParametreListeWithAdd('marques')
  const fournisseurs = useParametreListeWithAdd('fournisseurs')

  const [categorie,      setCategorie]      = useState(editItem?.categorie ?? '')
  const [nom,            setNom]            = useState(editItem?.nom ?? '')
  const [nomAuto,        setNomAuto]        = useState(!isEdit)   // auto-nom activé par défaut en création
  const [marque,         setMarque]         = useState(editItem?.marque ?? '')
  const [codeBarre,      setCodeBarre]      = useState(editItem?.code_barre_serial ?? '')
  const [dateAchat,      setDateAchat]      = useState(editItem?.date_achat ?? '')
  const [prix,           setPrix]           = useState(editItem?.prix_achat != null ? String(editItem.prix_achat) : '')
  const [siteAchat,      setSiteAchat]      = useState(editItem?.site_achat ?? '')
  const [etat,           setEtat]           = useState(editItem?.etat ?? '')
  const [dateSortie,     setDateSortie]     = useState(editItem?.date_sortie_stock ?? '')
  const [notes,          setNotes]          = useState(editItem?.notes ?? '')
  const [caract,         setCaract]         = useState<Record<string, unknown>>(
    (editItem?.caracteristiques as Record<string, unknown>) ?? {}
  )
  const [quantite,       setQuantite]       = useState(1)
  const [error, setError] = useState('')

  // ── Auto-nom bocaux ──────────────────────────────────────────────────────────
  const refreshAutoNom = useCallback((idx = 1) => {
    if (categorie !== 'Bocaux' || !nomAuto) return
    const volMl = caract.volume_ml as number | null ?? null
    setNom(genBocalNom(volMl, marque, idx))
  }, [categorie, nomAuto, caract.volume_ml, marque])

  useEffect(() => {
    if (categorie === 'Bocaux' && nomAuto) refreshAutoNom(1)
  }, [categorie, nomAuto, caract.volume_ml, marque, refreshAutoNom])

  useEffect(() => {
    if (!isEdit) { setCaract({}); setQuantite(1); setNomAuto(true) }
  }, [categorie, isEdit])

  const invalidate = () => qc.invalidateQueries({ queryKey: ['materiel'] })

  const createMut = useMutation({
    mutationFn: (p: MaterielCreate) => materielAPI.create(p),
    onSuccess: () => { invalidate(); onClose() },
    onError: () => setError('Erreur lors de la création'),
  })
  const updateMut = useMutation({
    mutationFn: (p: MaterielUpdate) => materielAPI.update(editItem!.id_materiel, p),
    onSuccess: () => { invalidate(); onClose() },
    onError: () => setError('Erreur lors de la mise à jour'),
  })

  const isPending = createMut.isPending || updateMut.isPending

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!categorie) return setError('La catégorie est obligatoire')
    if (!nom.trim()) return setError('Le nom est obligatoire')

    const cleanCaract = Object.fromEntries(
      Object.entries(caract).filter(([k, v]) =>
        !k.startsWith('_') &&          // exclure les champs internes _vol_val, _vol_unit
        v != null && v !== '' && !(Array.isArray(v) && v.length === 0)
      )
    )
    if (Array.isArray(cleanCaract.spectres)) {
      cleanCaract.spectres = (cleanCaract.spectres as string[]).filter(s => s.trim() !== '')
      if ((cleanCaract.spectres as string[]).length === 0) delete cleanCaract.spectres
    }

    const payload = {
      categorie,
      nom:               nom.trim(),
      marque:            marque.trim() || null,
      code_barre_serial: codeBarre.trim() || null,
      date_achat:        dateAchat || null,
      prix_achat:        prix ? Number(prix) : null,
      site_achat:        siteAchat.trim() || null,
      etat:              etat || null,
      date_sortie_stock: dateSortie || null,
      notes:             notes.trim() || null,
      caracteristiques:  Object.keys(cleanCaract).length ? cleanCaract : null,
    }

    if (isEdit) {
      updateMut.mutate(payload)
      return
    }

    // Création multiple (Pots et Bocaux, hors mode édition)
    const isBatch = (categorie === 'Pots' || categorie === 'Bocaux') && quantite > 1
    const n = isBatch ? quantite : 1
    const unitLabel = categorie === 'Bocaux' ? 'bocaux' : 'pots'
    try {
      if (n === 1) {
        createMut.mutate(payload)
      } else {
        await Promise.all(
          Array.from({ length: n }, (_, i) => {
            const nomItem = categorie === 'Bocaux' && nomAuto
              ? genBocalNom(
                  (cleanCaract.volume_ml as number | null) ?? null,
                  marque,
                  i + 1
                )
              : `${payload.nom} #${i + 1}`
            return materielAPI.create({ ...payload, nom: nomItem })
          })
        )
        invalidate()
        onClose()
      }
    } catch {
      setError(`Erreur lors de la création des ${n} ${unitLabel}`)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-xl flex flex-col max-h-[92vh]">

        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-700 shrink-0">
          <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">
            {isEdit ? 'Modifier le matériel' : 'Nouveau matériel'}
          </h2>
          <button onClick={onClose} className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:text-gray-300"><X size={22} /></button>
        </div>

        <form onSubmit={handleSubmit} className="overflow-y-auto flex-1 px-6 py-5 space-y-4">

          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Field label="Catégorie" required>
                <select className={selectCls} value={categorie} onChange={e => setCategorie(e.target.value)}>
                  <option value="">— choisir —</option>
                  {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                </select>
              </Field>
            </div>
            <div className={(categorie === 'Pots' || categorie === 'Bocaux') && !isEdit ? 'col-span-2 grid grid-cols-[1fr_auto] gap-3' : 'col-span-2'}>
              <Field label="Nom" required>
                {categorie === 'Bocaux' && !isEdit ? (
                  <div className="space-y-1">
                    <div className="flex gap-1">
                      <input
                        type="text" className={`${inputCls} flex-1`}
                        value={nom}
                        onChange={e => { setNom(e.target.value); setNomAuto(false) }}
                        placeholder="ex: Bocal 1L Mason #1"
                      />
                      <button
                        type="button"
                        onClick={() => { setNomAuto(true); refreshAutoNom(1) }}
                        title="Régénérer le nom automatique"
                        className={`px-2 border rounded-lg text-xs transition-colors ${nomAuto ? 'border-grow-400 bg-grow-50 text-grow-600' : 'border-gray-200 dark:border-gray-700 text-gray-400 dark:text-gray-500 hover:border-grow-300 hover:text-grow-500'}`}
                      >
                        <RefreshCw size={12} />
                      </button>
                    </div>
                    {nomAuto && (
                      <p className="text-xs text-gray-400 dark:text-gray-500">
                        🤖 Nom auto · basé sur volume + marque
                      </p>
                    )}
                  </div>
                ) : (
                  <input type="text" className={inputCls} value={nom} onChange={e => setNom(e.target.value)} placeholder="ex: Spider Farmer SF-4000" />
                )}
              </Field>
              {(categorie === 'Pots' || categorie === 'Bocaux') && !isEdit && (
                <Field label="Quantité">
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setQuantite(q => Math.max(1, q - 1))}
                      className="w-8 h-[34px] border border-gray-200 dark:border-gray-700 rounded-lg text-gray-500 dark:text-gray-400 dark:text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-700/40 text-base font-semibold flex items-center justify-center"
                    >−</button>
                    <input
                      type="number" min={1} max={99}
                      value={quantite}
                      onChange={e => setQuantite(Math.max(1, Math.min(99, Number(e.target.value) || 1)))}
                      className="w-12 text-center border border-gray-200 dark:border-gray-700 rounded-lg px-1 py-1.5 text-sm focus:ring-2 focus:ring-grow-400 focus:border-transparent"
                    />
                    <button
                      type="button"
                      onClick={() => setQuantite(q => Math.min(99, q + 1))}
                      className="w-8 h-[34px] border border-gray-200 dark:border-gray-700 rounded-lg text-gray-500 dark:text-gray-400 dark:text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-700/40 text-base font-semibold flex items-center justify-center"
                    >+</button>
                  </div>
                </Field>
              )}
            </div>

            {/* Marque — depuis paramètres */}
            <Field label="Marque">
              <SelectWithAdd values={marques.values} isAdding={marques.isAdding}
                onAddValue={marques.addValue}
                value={marque} onChange={setMarque} />
            </Field>

            {/* État */}
            <Field label="État">
              <select className={selectCls} value={etat} onChange={e => setEtat(e.target.value)}>
                <option value="">—</option>
                {ETATS.map(e => <option key={e}>{e}</option>)}
              </select>
            </Field>

            <Field label="Date d'achat">
              <input type="date" className={inputCls} value={dateAchat} onChange={e => setDateAchat(e.target.value)} />
            </Field>
            <Field label="Prix d'achat (€)">
              <input type="number" step="0.01" className={inputCls} value={prix} onChange={e => setPrix(e.target.value)} placeholder="ex: 149.99" />
            </Field>

            {/* Fournisseur — depuis paramètres */}
            <Field label="Fournisseur / Site d'achat">
              <SelectWithAdd values={fournisseurs.values} isAdding={fournisseurs.isAdding}
                onAddValue={fournisseurs.addValue}
                value={siteAchat} onChange={setSiteAchat} />
            </Field>

            <Field label="Code barre / Numéro série">
              <input type="text" className={inputCls} value={codeBarre} onChange={e => setCodeBarre(e.target.value)} placeholder="ex: 123456789" />
            </Field>

            {/* Date sortie stock — uniquement si Hors service */}
            {etat === 'Hors service' && (
              <div className="col-span-2">
                <Field label="Date de sortie de stock">
                  <input type="date" className={inputCls} value={dateSortie} onChange={e => setDateSortie(e.target.value)} />
                </Field>
              </div>
            )}
          </div>

          {/* Caractéristiques spécifiques */}
          {categorie && (
            <div className="border-t border-gray-100 dark:border-gray-700 pt-4">
              <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-3">
                Caractéristiques — {categorie}
              </p>
              <CaractFields categorie={categorie} caract={caract} setCaract={setCaract} />
            </div>
          )}

          <Field label="Notes">
            <textarea className={inputCls} rows={2} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Informations complémentaires…" />
          </Field>

          {error && <p className="text-sm text-red-500">{error}</p>}
        </form>

        <div className="px-6 py-4 border-t border-gray-100 dark:border-gray-700 shrink-0 flex justify-end gap-2">
          <button type="button" onClick={onClose}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 text-sm rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/40">
            Annuler
          </button>
          <button onClick={handleSubmit} disabled={isPending}
            className="flex items-center gap-2 px-4 py-2 bg-grow-600 text-white text-sm rounded-lg hover:bg-grow-700 disabled:opacity-50">
            {isPending && <Loader2 size={14} className="animate-spin" />}
            {isEdit
              ? 'Enregistrer'
              : categorie === 'Pots' && quantite > 1
                ? `Ajouter ${quantite} pots`
                : categorie === 'Bocaux' && quantite > 1
                  ? `Ajouter ${quantite} bocaux`
                  : 'Ajouter'}
          </button>
        </div>
      </div>
    </div>
  )
}
