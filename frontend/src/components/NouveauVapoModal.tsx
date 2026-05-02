import { useState, useEffect, useRef } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { X, Plus, Trash2, Loader2, Thermometer, Battery, Zap, Package } from 'lucide-react'
import { vaporisateurAPI } from '../api/vaporisateur'
import type { Vaporisateur, VaporisateurCreate, VapoConsommable, VapoConsommableCreate } from '../api/vaporisateur'
import { useParametreListeWithAdd } from '../api/parametres'

// ── Helpers ────────────────────────────────────────────────────────────────────
const TYPES_CHAUFFE  = ['Conduction', 'Convection', 'Mixte', 'Induction']
const TYPES_BATTERIE = ['Intégrée', 'Amovible 18650']
const TYPES_CHARGE   = ['USB-C', 'Propriétaire', 'Micro-USB', 'Autre']
const COMPATIBILITES = [
  { key: 'fleurs_sechees', label: 'Fleurs séchées' },
  { key: 'resines',        label: 'Résines' },
  { key: 'concentres',     label: 'Concentrés (Rosin)' },
]
const TYPES_CONSO  = [
  'Bol céramique', 'Bol saphir', 'Bol SiC', 'Bol quartz',
  'Terps ball', 'Screen', 'Joint', 'Embout', 'Autre',
]
const MATIERES_CONSO = ['Céramique', 'Saphir', 'SiC', 'Quartz', 'Titane', 'Acier inox', 'Verre', 'Autre']

// ── Select avec bouton "Ajouter" inline (partagé avec NouveauMaterielModal) ───
const inputCls = 'w-full text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 focus:ring-2 focus:ring-grow-400 bg-white dark:bg-gray-800'

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
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAdd() } if (e.key === 'Escape') setAdding(false) }}
          placeholder="Nouvelle valeur…" />
        <button type="button" onClick={handleAdd} disabled={isAdding || !newVal.trim()}
          className="px-2 py-1 bg-grow-600 text-white rounded-lg text-xs hover:bg-grow-700 disabled:opacity-50">
          {isAdding ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
        </button>
        <button type="button" onClick={() => setAdding(false)}
          className="px-2 py-1 border border-gray-300 dark:border-gray-600 rounded-lg text-xs text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-700">
          ✕
        </button>
      </div>
    )
  }

  return (
    <div className="flex gap-1">
      <select value={value} onChange={e => onChange(e.target.value)}
        className={`${inputCls} flex-1`}>
        <option value="">{placeholder}</option>
        {values.map(v => <option key={v} value={v}>{v}</option>)}
      </select>
      <button type="button" onClick={() => setAdding(true)}
        title="Ajouter une valeur"
        className="px-2 py-1 border border-gray-300 dark:border-gray-600 rounded-lg text-xs text-gray-500 hover:text-grow-600 hover:border-grow-400">
        <Plus size={12} />
      </button>
    </div>
  )
}

function buildNom(marque: string, modele: string, existingNoms: string[]): string {
  if (!marque && !modele) return ''
  const base = [marque, modele].filter(Boolean).join(' ')
  // Compte combien de vapos ont déjà ce même base
  const count = existingNoms.filter(n => n === base || n.startsWith(base + ' #')).length
  return count === 0 ? base : `${base} #${count + 1}`
}

// ── Formulaire consommable ────────────────────────────────────────────────────
interface ConsoFormProps {
  conso?: VapoConsommable | null
  vapoId: number | null
  onSave: (data: VapoConsommableCreate) => void
  onCancel: () => void
  isSaving: boolean
}
function ConsoForm({ conso, vapoId, onSave, onCancel, isSaving }: ConsoFormProps) {
  const [form, setForm] = useState<VapoConsommableCreate>({
    id_vaporisateur:  vapoId,
    type_consommable: conso?.type_consommable ?? '',
    diametre_mm:      conso?.diametre_mm ?? null,
    matiere:          conso?.matiere ?? null,
    date_achat:       conso?.date_achat ?? null,
    prix_achat:       conso?.prix_achat ?? null,
    notes:            conso?.notes ?? null,
  })

  const isTerpsBall = form.type_consommable.toLowerCase().includes('terps')

  return (
    <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4 space-y-3 border border-gray-200 dark:border-gray-700">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">Type *</label>
          <select value={form.type_consommable}
            onChange={e => setForm(f => ({ ...f, type_consommable: e.target.value }))}
            className="w-full text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 focus:ring-2 focus:ring-grow-400 bg-white dark:bg-gray-800">
            <option value="">Choisir…</option>
            {TYPES_CONSO.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">Matière</label>
          <select value={form.matiere ?? ''}
            onChange={e => setForm(f => ({ ...f, matiere: e.target.value || null }))}
            className="w-full text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 focus:ring-2 focus:ring-grow-400 bg-white dark:bg-gray-800">
            <option value="">—</option>
            {MATIERES_CONSO.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
      </div>

      {isTerpsBall && (
        <div className="w-1/2">
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">Diamètre (mm)</label>
          <input type="number" step="0.5" min="1" max="20"
            value={form.diametre_mm ?? ''}
            onChange={e => setForm(f => ({ ...f, diametre_mm: e.target.value ? Number(e.target.value) : null }))}
            placeholder="ex: 6"
            className="w-full text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 focus:ring-2 focus:ring-grow-400" />
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">Date achat</label>
          <input type="date" value={form.date_achat ?? ''}
            onChange={e => setForm(f => ({ ...f, date_achat: e.target.value || null }))}
            className="w-full text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 focus:ring-2 focus:ring-grow-400" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">Prix achat (€)</label>
          <input type="number" step="0.01" min="0"
            value={form.prix_achat ?? ''}
            onChange={e => setForm(f => ({ ...f, prix_achat: e.target.value ? Number(e.target.value) : null }))}
            placeholder="0.00"
            className="w-full text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 focus:ring-2 focus:ring-grow-400" />
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">Notes</label>
        <input type="text" value={form.notes ?? ''}
          onChange={e => setForm(f => ({ ...f, notes: e.target.value || null }))}
          placeholder="Notes libres…"
          className="w-full text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 focus:ring-2 focus:ring-grow-400" />
      </div>

      <div className="flex justify-end gap-2 pt-1">
        <button type="button" onClick={onCancel}
          className="px-3 py-1.5 text-xs text-gray-600 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/40">
          Annuler
        </button>
        <button type="button"
          onClick={() => onSave(form)}
          disabled={!form.type_consommable || isSaving}
          className="px-3 py-1.5 text-xs bg-grow-600 text-white rounded-lg hover:bg-grow-700 disabled:opacity-50 flex items-center gap-1.5">
          {isSaving ? <Loader2 size={11} className="animate-spin" /> : null}
          Enregistrer
        </button>
      </div>
    </div>
  )
}

// ── Modal principal ───────────────────────────────────────────────────────────
interface Props {
  editVapo: Vaporisateur | null
  onClose: () => void
}

export default function NouveauVapoModal({ editVapo, onClose }: Props) {
  const qc = useQueryClient()
  const isEdit = !!editVapo

  // Listes partagées avec Materiel
  const marques      = useParametreListeWithAdd('marques')
  const fournisseurs = useParametreListeWithAdd('fournisseurs')

  // liste des vapos existants pour auto-numéroter
  const { data: allVapos = [] } = useQuery<Vaporisateur[]>({
    queryKey: ['vaporisateurs'],
    queryFn:  async () => (await vaporisateurAPI.getAll()).data,
  })

  const existingNoms = allVapos
    .filter(v => !isEdit || v.id_vaporisateur !== editVapo!.id_vaporisateur)
    .map(v => v.nom)

  // ── État du formulaire ──────────────────────────────────────────────────────
  const emptyForm = (): VaporisateurCreate => ({
    nom: '', modele: null, marque: null, site_achat: null,
    date_achat: null, prix_achat: null, numero_serie: null,
    type_chauffe: null, a_eau: false,
    temp_min: null, temp_max: null,
    compatibilites: null,
    type_batterie: null,
    autonomie_sessions: null, autonomie_mah: null,
    temps_chauffe_s: null, type_charge: null,
    nbr_sessions: 0, notes: null,
  })

  const [form, setForm] = useState<VaporisateurCreate>(
    editVapo ? {
      nom:               editVapo.nom,
      modele:            editVapo.modele,
      marque:            editVapo.marque,
      site_achat:        editVapo.site_achat,
      date_achat:        editVapo.date_achat,
      prix_achat:        editVapo.prix_achat,
      numero_serie:      editVapo.numero_serie,
      type_chauffe:      editVapo.type_chauffe,
      a_eau:             editVapo.a_eau ?? false,
      temp_min:          editVapo.temp_min,
      temp_max:          editVapo.temp_max,
      compatibilites:    editVapo.compatibilites,
      type_batterie:     editVapo.type_batterie,
      autonomie_sessions: editVapo.autonomie_sessions,
      autonomie_mah:     editVapo.autonomie_mah,
      temps_chauffe_s:   editVapo.temps_chauffe_s,
      type_charge:       editVapo.type_charge,
      nbr_sessions:      editVapo.nbr_sessions,
      notes:             editVapo.notes,
    } : emptyForm()
  )

  const [compatSet, setCompatSet] = useState<Set<string>>(
    new Set((editVapo?.compatibilites ?? '').split(',').filter(Boolean))
  )
  // Synchronise les compatibilités dans le form
  useEffect(() => {
    setForm(f => ({ ...f, compatibilites: [...compatSet].join(',') || null }))
  }, [compatSet])

  // Auto-génération du nom quand marque/modèle changent
  const prevMarqueRef = useRef(form.marque)
  const prevModeleRef = useRef(form.modele)
  useEffect(() => {
    if (isEdit) return // ne pas écraser le nom en mode édition
    if (form.marque !== prevMarqueRef.current || form.modele !== prevModeleRef.current) {
      prevMarqueRef.current = form.marque
      prevModeleRef.current = form.modele
      const autoNom = buildNom(form.marque ?? '', form.modele ?? '', existingNoms)
      setForm(f => ({ ...f, nom: autoNom }))
    }
  }, [form.marque, form.modele, existingNoms, isEdit])

  // ── Mutations ───────────────────────────────────────────────────────────────
  const invalidate = () => qc.invalidateQueries({ queryKey: ['vaporisateurs'] })

  const saveVapo = useMutation({
    mutationFn: () => isEdit
      ? vaporisateurAPI.update(editVapo!.id_vaporisateur, form)
      : vaporisateurAPI.create(form),
    onSuccess: () => { invalidate(); onClose() },
  })

  // Consommables en mode édition
  const [showConsoForm, setShowConsoForm] = useState(false)
  const [editConso,    setEditConso]    = useState<VapoConsommable | null>(null)
  const [deletingId,   setDeletingId]   = useState<number | null>(null)

  const saveConso = useMutation({
    mutationFn: (data: VapoConsommableCreate) =>
      editConso
        ? vaporisateurAPI.updateConsommable(editConso.id_consommable, data)
        : vaporisateurAPI.createConsommable({ ...data, id_vaporisateur: editVapo!.id_vaporisateur }),
    onSuccess: () => {
      invalidate()
      setShowConsoForm(false)
      setEditConso(null)
    },
  })

  const deleteConso = useMutation({
    mutationFn: (id: number) => vaporisateurAPI.deleteConsommable(id),
    onSuccess: () => { invalidate(); setDeletingId(null) },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    saveVapo.mutate()
  }

  const toggleCompat = (key: string) => {
    setCompatSet(prev => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-700">
          <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">
            {isEdit ? `Modifier — ${editVapo.nom}` : 'Nouveau vaporisateur'}
          </h2>
          <button onClick={onClose} className="p-1.5 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700">
            <X size={18} />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 p-6">
          <form onSubmit={handleSubmit} className="space-y-6">

            {/* ── Identité ── */}
            <section>
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-3 flex items-center gap-2">
                <Package size={15} className="text-grow-600" /> Identité
              </h3>
              <div className="grid grid-cols-2 gap-4">
                {/* Row 1 : Marque + Modèle — liés pour l'auto-nom */}
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">Marque</label>
                  <SelectWithAdd
                    values={marques.values}
                    isAdding={marques.isAdding}
                    onAddValue={marques.addValue}
                    value={form.marque ?? ''}
                    onChange={v => setForm(f => ({ ...f, marque: v || null }))}
                    placeholder="ex : Storz & Bickel…"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">Modèle</label>
                  <input type="text" value={form.modele ?? ''}
                    onChange={e => setForm(f => ({ ...f, modele: e.target.value || null }))}
                    placeholder="ex : Mighty+, M, Crafty+…"
                    className="w-full text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 focus:ring-2 focus:ring-grow-400" />
                </div>
                {/* Row 2 : Nom auto */}
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">
                    Nom <span className="text-gray-400 dark:text-gray-500 font-normal">(auto-rempli, modifiable)</span>
                  </label>
                  <input type="text" required value={form.nom}
                    onChange={e => setForm(f => ({ ...f, nom: e.target.value }))}
                    placeholder="Storz & Bickel Mighty+ #1"
                    className="w-full text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 focus:ring-2 focus:ring-grow-400 font-medium" />
                </div>
                {/* Row 3 : Fournisseur + Date achat */}
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">Fournisseur</label>
                  <SelectWithAdd
                    values={fournisseurs.values}
                    isAdding={fournisseurs.isAdding}
                    onAddValue={fournisseurs.addValue}
                    value={form.site_achat ?? ''}
                    onChange={v => setForm(f => ({ ...f, site_achat: v || null }))}
                    placeholder="ex : Canna-Smoke…"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">Date achat</label>
                  <input type="date" value={form.date_achat ?? ''}
                    onChange={e => setForm(f => ({ ...f, date_achat: e.target.value || null }))}
                    className="w-full text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 focus:ring-2 focus:ring-grow-400" />
                </div>
                {/* Row 4 : Prix + Numéro de série */}
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">Prix achat (€)</label>
                  <input type="number" step="0.01" min="0"
                    value={form.prix_achat ?? ''}
                    onChange={e => setForm(f => ({ ...f, prix_achat: e.target.value ? Number(e.target.value) : null }))}
                    placeholder="0.00"
                    className="w-full text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 focus:ring-2 focus:ring-grow-400" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">Numéro de série (S/N)</label>
                  <input type="text" value={form.numero_serie ?? ''}
                    onChange={e => setForm(f => ({ ...f, numero_serie: e.target.value || null }))}
                    placeholder="SN-XXXXXXXXX"
                    className="w-full text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 focus:ring-2 focus:ring-grow-400" />
                </div>
              </div>
            </section>

            {/* ── Chauffe & Température ── */}
            <section>
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-3 flex items-center gap-2">
                <Thermometer size={15} className="text-orange-500" /> Chauffe & Température
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">Type de chauffe</label>
                  <select value={form.type_chauffe ?? ''}
                    onChange={e => setForm(f => ({ ...f, type_chauffe: e.target.value || null }))}
                    className="w-full text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 focus:ring-2 focus:ring-grow-400 bg-white dark:bg-gray-800">
                    <option value="">—</option>
                    {TYPES_CHAUFFE.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div className="flex items-center gap-3 pt-5">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input type="checkbox" checked={form.a_eau ?? false}
                      onChange={e => setForm(f => ({ ...f, a_eau: e.target.checked }))}
                      className="w-4 h-4 accent-grow-600 rounded" />
                    <span className="text-sm text-gray-700 dark:text-gray-200">À eau (chambre d'eau)</span>
                  </label>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">Temp. min (°C)</label>
                  <input type="number" min="0" max="300"
                    value={form.temp_min ?? ''}
                    onChange={e => setForm(f => ({ ...f, temp_min: e.target.value ? Number(e.target.value) : null }))}
                    placeholder="140"
                    className="w-full text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 focus:ring-2 focus:ring-grow-400" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">Temp. max (°C)</label>
                  <input type="number" min="0" max="300"
                    value={form.temp_max ?? ''}
                    onChange={e => setForm(f => ({ ...f, temp_max: e.target.value ? Number(e.target.value) : null }))}
                    placeholder="230"
                    className="w-full text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 focus:ring-2 focus:ring-grow-400" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">Temps de chauffe (s)</label>
                  <input type="number" min="0" max="120"
                    value={form.temps_chauffe_s ?? ''}
                    onChange={e => setForm(f => ({ ...f, temps_chauffe_s: e.target.value ? Number(e.target.value) : null }))}
                    placeholder="ex : 25"
                    className="w-full text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 focus:ring-2 focus:ring-grow-400" />
                </div>
              </div>
            </section>

            {/* ── Compatibilités ── */}
            <section>
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-3">Compatibilités</h3>
              <div className="flex flex-wrap gap-2">
                {COMPATIBILITES.map(({ key, label }) => (
                  <button key={key} type="button"
                    onClick={() => toggleCompat(key)}
                    className={`px-3 py-1.5 text-sm rounded-full border font-medium transition-colors ${
                      compatSet.has(key)
                        ? 'bg-grow-600 text-white border-grow-600'
                        : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:border-grow-400'
                    }`}>
                    {label}
                  </button>
                ))}
              </div>
            </section>

            {/* ── Batterie & Charge ── */}
            <section>
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-3 flex items-center gap-2">
                <Battery size={15} className="text-blue-500" /> Batterie & Charge
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">Type de batterie</label>
                  <select value={form.type_batterie ?? ''}
                    onChange={e => setForm(f => ({ ...f, type_batterie: e.target.value || null }))}
                    className="w-full text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 focus:ring-2 focus:ring-grow-400 bg-white dark:bg-gray-800">
                    <option value="">—</option>
                    {TYPES_BATTERIE.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">Type de charge</label>
                  <select value={form.type_charge ?? ''}
                    onChange={e => setForm(f => ({ ...f, type_charge: e.target.value || null }))}
                    className="w-full text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 focus:ring-2 focus:ring-grow-400 bg-white dark:bg-gray-800">
                    <option value="">—</option>
                    {TYPES_CHARGE.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">Autonomie (sessions)</label>
                  <input type="number" min="0"
                    value={form.autonomie_sessions ?? ''}
                    onChange={e => setForm(f => ({ ...f, autonomie_sessions: e.target.value ? Number(e.target.value) : null }))}
                    placeholder="ex : 8"
                    className="w-full text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 focus:ring-2 focus:ring-grow-400" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">Capacité batterie (mAh)</label>
                  <input type="number" min="0"
                    value={form.autonomie_mah ?? ''}
                    onChange={e => setForm(f => ({ ...f, autonomie_mah: e.target.value ? Number(e.target.value) : null }))}
                    placeholder="ex : 3500"
                    className="w-full text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 focus:ring-2 focus:ring-grow-400" />
                </div>
              </div>
            </section>

            {/* ── Usage ── */}
            <section>
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-3 flex items-center gap-2">
                <Zap size={15} className="text-purple-500" /> Usage
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">Nombre de sessions / dabs</label>
                  <input type="number" min="0"
                    value={form.nbr_sessions ?? 0}
                    onChange={e => setForm(f => ({ ...f, nbr_sessions: Number(e.target.value) }))}
                    className="w-full text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 focus:ring-2 focus:ring-grow-400" />
                </div>
              </div>
              <div className="mt-3">
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">Notes</label>
                <textarea value={form.notes ?? ''}
                  onChange={e => setForm(f => ({ ...f, notes: e.target.value || null }))}
                  rows={2} placeholder="Notes libres…"
                  className="w-full text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 focus:ring-2 focus:ring-grow-400 resize-none" />
              </div>
            </section>

            {/* ── Bouton submit ── */}
            <div className="flex justify-end gap-3 pt-2 border-t border-gray-100 dark:border-gray-700">
              <button type="button" onClick={onClose}
                className="px-4 py-2 text-sm text-gray-600 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700/40">
                Annuler
              </button>
              <button type="submit" disabled={saveVapo.isPending || !form.nom.trim()}
                className="px-5 py-2 bg-grow-600 text-white text-sm font-medium rounded-xl hover:bg-grow-700 disabled:opacity-50 flex items-center gap-2">
                {saveVapo.isPending && <Loader2 size={14} className="animate-spin" />}
                {isEdit ? 'Enregistrer' : 'Ajouter'}
              </button>
            </div>
          </form>

          {/* ── Section consommables (mode édition uniquement) ── */}
          {isEdit && (
            <div className="mt-6 border-t border-gray-100 dark:border-gray-700 pt-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200">Consommables & Accessoires</h3>
                {!showConsoForm && (
                  <button onClick={() => { setEditConso(null); setShowConsoForm(true) }}
                    className="flex items-center gap-1.5 text-xs text-grow-600 hover:text-grow-700 font-medium px-2 py-1 rounded-lg hover:bg-grow-50">
                    <Plus size={13} /> Ajouter
                  </button>
                )}
              </div>

              {showConsoForm && (
                <ConsoForm
                  conso={editConso}
                  vapoId={editVapo.id_vaporisateur}
                  onSave={data => saveConso.mutate(data)}
                  onCancel={() => { setShowConsoForm(false); setEditConso(null) }}
                  isSaving={saveConso.isPending}
                />
              )}

              {editVapo.consommables.length === 0 && !showConsoForm && (
                <p className="text-xs text-gray-400 dark:text-gray-500 text-center py-4">Aucun consommable enregistré</p>
              )}

              <div className="space-y-2 mt-3">
                {editVapo.consommables.map(c => (
                  <div key={c.id_consommable}
                    className="flex items-center justify-between bg-gray-50 dark:bg-gray-700/50 rounded-xl px-4 py-2.5 group">
                    <div>
                      <span className="text-sm font-medium text-gray-800 dark:text-gray-100">{c.type_consommable}</span>
                      {c.matiere && <span className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500 ml-2">{c.matiere}</span>}
                      {c.diametre_mm && <span className="text-xs text-gray-400 dark:text-gray-500 ml-1">⌀{c.diametre_mm} mm</span>}
                      <div className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                        {c.date_achat && new Date(c.date_achat).toLocaleDateString('fr-FR')}
                        {c.prix_achat != null && ` · ${Number(c.prix_achat).toFixed(2)} €`}
                      </div>
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => { setEditConso(c); setShowConsoForm(true) }}
                        className="p-1.5 text-gray-400 dark:text-gray-500 hover:text-grow-600 hover:bg-white rounded-lg">
                        ✏️
                      </button>
                      {deletingId === c.id_consommable ? (
                        <button onClick={() => deleteConso.mutate(c.id_consommable)}
                          className="p-1.5 text-red-600 bg-red-50 rounded-lg text-xs font-medium">
                          Confirmer
                        </button>
                      ) : (
                        <button onClick={() => setDeletingId(c.id_consommable)}
                          className="p-1.5 text-gray-400 dark:text-gray-500 hover:text-red-500 hover:bg-red-50 rounded-lg">
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
