import { useState, useEffect, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Trash2, Pencil, Check, X, Settings, ChevronDown, ChevronUp, ExternalLink,
         Thermometer, Wifi, WifiOff, RefreshCw, Save, Mail, Eye, EyeOff, AlertCircle,
         CheckCircle2, Loader2, Database, Download, Upload, UploadCloud, Euro } from 'lucide-react'
import apiClient from '../api/client'
import { parametresAPI } from '../api/parametres'
import type { ParametreValeur } from '../api/parametres'
import { useAppSetting } from '../api/appSettings'
import { breederAPI } from '../api/breeders'
import type { Breeder } from '../api/breeders'
import { varieteAPI } from '../api/varietes'
import type { Variete } from '../api/varietes'
import { capteursAPI, GoveeDevice, GoveeDeviceCreate, GoveeConfig, GmailImportResult, PollResult, GoveeCloudDevice } from '../api/capteurs'
import { stockAlertSeuilsAPI, StockAlertSeuil, SeuilUpsert } from '../api/stockAlertSeuils'

// ── Définition de toutes les listes et leur groupement ────────────────────────
const SECTIONS = [
  // ── Général ──────────────────────────────────────────────────────────────────
  {
    titre: 'Général',
    listes: [
      { nom: 'marques',      label: 'Marques' },
      { nom: 'fournisseurs', label: 'Fournisseurs / Sites d\'achat' },
    ],
  },

  // ── Matériel (toutes les sous-catégories regroupées) ─────────────────────────
  {
    titre: 'Matériel — Lampes',
    listes: [
      { nom: 'lampes_types', label: 'Types de lampe' },
      { nom: 'spectres',     label: 'Spectres' },
    ],
  },
  {
    titre: 'Matériel — Pots & Bocaux',
    listes: [
      { nom: 'pot_matieres',    label: 'Matières de pots' },
      { nom: 'bocal_fermetures', label: '🫙 Types de fermeture (bocaux)' },
      { nom: 'bocal_couleurs',   label: '🫙 Couleurs du verre (bocaux)' },
      { nom: 'bocal_usages',     label: '🫙 Usages principaux (bocaux)' },
    ],
  },
  {
    titre: 'Matériel — Équipements',
    listes: [
      { nom: 'arrosage_types',    label: 'Types d\'arrosage' },
      { nom: 'pompe_types',       label: 'Types pompe / bulleur' },
      { nom: 'ventilation_types', label: 'Types de ventilation' },
      { nom: 'filet_types',       label: 'Types de filet' },
      { nom: 'sechage_types',     label: 'Types de séchage' },
      { nom: 'outil_types',       label: 'Types d\'outil' },
    ],
  },

  // ── Stock & Extraction ────────────────────────────────────────────────────────
  {
    titre: 'Stock — Types',
    listes: [
      { nom: 'types_stock',      label: 'Types de stock (Fleur, Hash, Rosin…)' },
      { nom: 'sous_types_stock', label: 'Sous-types (Indoor, Outdoor…)' },
    ],
  },
  {
    titre: 'Stock — Hash & Rosin',
    listes: [
      { nom: 'types_hash',   label: 'Types de hash' },
      { nom: 'types_rosin',  label: 'Types de rosin' },
    ],
  },
  {
    titre: 'Stock — Maillages',
    listes: [
      { nom: 'maillages_iceolator', label: 'Maillages Ice-O-Lator (µ)' },
      { nom: 'maillages_rosin',     label: 'Maillages Rosin bags (µ)' },
    ],
  },
  // ── Espaces & Culture ─────────────────────────────────────────────────────────
  {
    titre: 'Espaces de culture',
    listes: [
      { nom: 'types_espace',  label: 'Types d\'espace (Tente, Box…)' },
      { nom: 'types_culture', label: 'Types de culture (Indoor, Outdoor…)' },
      { nom: 'buts_culture',  label: 'Buts de culture (Récolte, Hunt…)' },
    ],
  },
  {
    titre: 'Préparer un substrat',
    listes: [
      { nom: 'types_sol_preparation', label: 'Types de sol (Sol vivant, Coco, Terre…)' },
    ],
  },

  // ── Historique Culture ────────────────────────────────────────────────────────
  {
    titre: 'Historique Culture',
    listes: [
      { nom: 'tentes',        label: 'Tentes / Espaces (formats)' },
      { nom: 'lampes_hc',     label: 'Lampes (noms complets)' },
      { nom: 'puissances_hc', label: 'Puissances (W)' },
      { nom: 'engrais',       label: 'Engrais' },
      { nom: 'substrats',     label: 'Substrats' },
    ],
  },

  // ── Recettes ──────────────────────────────────────────────────────────────────
  {
    titre: 'Recettes',
    listes: [
      { nom: 'periodes_recette',  label: 'Périodes (Veg, Flo…)' },
      { nom: 'types_lso',         label: 'Types de sol vivant (LSO)' },
      { nom: 'types_fermentation', label: 'Types de fermentation' },
    ],
  },
]

// ── Composant d'une liste simple ──────────────────────────────────────────────
function ListeEditor({ listeNom, label }: { listeNom: string; label: string }) {
  const qc = useQueryClient()
  const [newVal,    setNewVal]    = useState('')
  const [editId,    setEditId]    = useState<number | null>(null)
  const [editVal,   setEditVal]   = useState('')
  const [addError,  setAddError]  = useState('')
  const [open,      setOpen]      = useState(false)

  const { data: items = [], isLoading } = useQuery<ParametreValeur[]>({
    queryKey: ['parametres', listeNom],
    queryFn: async () => (await parametresAPI.getList(listeNom)).data,
    staleTime: 30_000,
  })

  const invalidate = () => qc.invalidateQueries({ queryKey: ['parametres', listeNom] })

  const addMut = useMutation({
    mutationFn: (v: string) => parametresAPI.add(listeNom, v),
    onSuccess: () => { invalidate(); setNewVal(''); setAddError('') },
    onError: (e: any) => setAddError(e?.response?.data?.detail ?? 'Erreur'),
  })

  const updateMut = useMutation({
    mutationFn: ({ id, v }: { id: number; v: string }) => parametresAPI.update(id, v),
    onSuccess: () => { invalidate(); setEditId(null) },
  })

  const deleteMut = useMutation({
    mutationFn: (id: number) => parametresAPI.delete(id),
    onSuccess: invalidate,
  })

  const handleAdd = () => {
    const v = newVal.trim()
    if (!v) return
    addMut.mutate(v)
  }

  const handleEditSave = () => {
    if (!editId || !editVal.trim()) return
    updateMut.mutate({ id: editId, v: editVal.trim() })
  }

  return (
    <div className="border border-gray-100 dark:border-gray-700 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-left"
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-200">{label}</span>
          <span className="text-xs bg-gray-200 text-gray-500 dark:text-gray-400 dark:text-gray-500 px-2 py-0.5 rounded-full">
            {isLoading ? '…' : items.length}
          </span>
        </div>
        <span className="text-gray-400 dark:text-gray-500 text-xs">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="p-4 space-y-3 bg-white dark:bg-gray-800">
          <div className="space-y-1 max-h-48 overflow-y-auto">
            {items.length === 0 && (
              <p className="text-xs text-gray-400 dark:text-gray-500 italic">Aucune valeur — ajoutez-en ci-dessous</p>
            )}
            {items.map(item => (
              <div key={item.id_parametre}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/40 group">
                {editId === item.id_parametre ? (
                  <>
                    <input
                      type="text"
                      className="flex-1 text-sm border border-gray-200 dark:border-gray-700 rounded px-2 py-1 focus:ring-2 focus:ring-grow-400"
                      value={editVal}
                      onChange={e => setEditVal(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') handleEditSave(); if (e.key === 'Escape') setEditId(null) }}
                      autoFocus
                    />
                    <button onClick={handleEditSave}
                      className="p-1 text-grow-600 hover:bg-grow-50 rounded">
                      <Check size={13} />
                    </button>
                    <button onClick={() => setEditId(null)}
                      className="p-1 text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 rounded">
                      <X size={13} />
                    </button>
                  </>
                ) : (
                  <>
                    <span className="flex-1 text-sm text-gray-700 dark:text-gray-200">{item.valeur}</span>
                    <button
                      onClick={() => { setEditId(item.id_parametre); setEditVal(item.valeur) }}
                      className="p-1 text-gray-300 hover:text-grow-600 hover:bg-grow-50 rounded opacity-0 group-hover:opacity-100 transition-opacity">
                      <Pencil size={12} />
                    </button>
                    <button
                      onClick={() => deleteMut.mutate(item.id_parametre)}
                      disabled={deleteMut.isPending}
                      className="p-1 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded opacity-0 group-hover:opacity-100 transition-opacity">
                      <Trash2 size={12} />
                    </button>
                  </>
                )}
              </div>
            ))}
          </div>

          <div className="flex gap-2 pt-1 border-t border-gray-100 dark:border-gray-700">
            <input
              type="text"
              value={newVal}
              onChange={e => setNewVal(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleAdd() }}
              placeholder="Nouvelle valeur…"
              className="flex-1 text-sm border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-grow-400"
            />
            <button
              onClick={handleAdd}
              disabled={addMut.isPending || !newVal.trim()}
              className="flex items-center gap-1 px-3 py-1.5 bg-grow-600 text-white text-sm rounded-lg hover:bg-grow-700 disabled:opacity-40">
              <Plus size={13} /> Ajouter
            </button>
          </div>
          {addError && <p className="text-xs text-red-500">{addError}</p>}
        </div>
      )}
    </div>
  )
}

// ── Champ de formulaire réutilisable ──────────────────────────────────────────
function Field({
  label, value, onChange, placeholder, required, textarea,
}: {
  label: string; value: string; onChange: (v: string) => void
  placeholder?: string; required?: boolean; textarea?: boolean
}) {
  const cls = "w-full text-sm border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 focus:ring-2 focus:ring-grow-400 focus:border-transparent"
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">
        {label}{required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      {textarea ? (
        <textarea
          value={value} onChange={e => onChange(e.target.value)}
          placeholder={placeholder} rows={2}
          className={cls + ' resize-none'}
        />
      ) : (
        <input
          type="text" value={value} onChange={e => onChange(e.target.value)}
          placeholder={placeholder} className={cls}
        />
      )}
    </div>
  )
}

// ── Éditeur Breeders ──────────────────────────────────────────────────────────
function BreedersEditor() {
  const qc = useQueryClient()
  const [open,      setOpen]      = useState(true)
  const [showForm,  setShowForm]  = useState(false)
  const [editId,    setEditId]    = useState<number | null>(null)

  const emptyForm = { nom_breeder: '', origine_breeder: '', information_breeder: '' }
  const [form, setForm] = useState(emptyForm)
  const [error, setError] = useState('')

  const { data: breeders = [], isLoading } = useQuery<Breeder[]>({
    queryKey: ['breeders'],
    queryFn: async () => (await breederAPI.getAll()).data,
    staleTime: 30_000,
  })

  const invalidate = () => qc.invalidateQueries({ queryKey: ['breeders'] })

  const createMut = useMutation({
    mutationFn: (d: Omit<Breeder, 'id_breeder'>) => breederAPI.create(d),
    onSuccess: () => { invalidate(); setForm(emptyForm); setShowForm(false); setError('') },
    onError: (e: any) => setError(e?.response?.data?.detail ?? 'Erreur'),
  })

  const updateMut = useMutation({
    mutationFn: ({ id, d }: { id: number; d: Omit<Breeder, 'id_breeder'> }) =>
      breederAPI.update(id, d),
    onSuccess: () => { invalidate(); setEditId(null); setForm(emptyForm); setError('') },
    onError: (e: any) => setError(e?.response?.data?.detail ?? 'Erreur'),
  })

  const deleteMut = useMutation({
    mutationFn: (id: number) => breederAPI.delete(id),
    onSuccess: invalidate,
    onError: (e: any) => setError(e?.response?.data?.detail ?? 'Impossible de supprimer ce breeder'),
  })

  const startEdit = (b: Breeder) => {
    setEditId(b.id_breeder)
    setForm({
      nom_breeder: b.nom_breeder,
      origine_breeder: b.origine_breeder ?? '',
      information_breeder: b.information_breeder ?? '',
    })
    setShowForm(false)
    setError('')
  }

  const cancelEdit = () => { setEditId(null); setForm(emptyForm); setError('') }
  const cancelAdd  = () => { setShowForm(false); setForm(emptyForm); setError('') }

  const handleSave = () => {
    if (!form.nom_breeder.trim()) { setError('Le nom est obligatoire'); return }
    const payload = {
      nom_breeder: form.nom_breeder.trim(),
      origine_breeder: form.origine_breeder.trim() || undefined,
      information_breeder: form.information_breeder.trim() || undefined,
    }
    if (editId !== null) {
      updateMut.mutate({ id: editId, d: payload })
    } else {
      createMut.mutate(payload)
    }
  }

  const isFormOpen = showForm || editId !== null

  return (
    <div className="border border-gray-100 dark:border-gray-700 rounded-xl overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-left"
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-200">🌱 Breeders</span>
          <span className="text-xs bg-gray-200 text-gray-500 dark:text-gray-400 dark:text-gray-500 px-2 py-0.5 rounded-full">
            {isLoading ? '…' : breeders.length}
          </span>
        </div>
        {open ? <ChevronUp size={14} className="text-gray-400 dark:text-gray-500" /> : <ChevronDown size={14} className="text-gray-400 dark:text-gray-500" />}
      </button>

      {open && (
        <div className="bg-white dark:bg-gray-800">
          {/* Liste */}
          <div className="divide-y divide-gray-50 max-h-72 overflow-y-auto">
            {breeders.length === 0 && !isLoading && (
              <p className="text-xs text-gray-400 dark:text-gray-500 italic px-4 py-3">Aucun breeder — ajoutez-en ci-dessous</p>
            )}
            {breeders.map(b => (
              <div key={b.id_breeder}>
                <div className="flex items-center gap-2 px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-700/40 group">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 dark:text-gray-100 truncate">{b.nom_breeder}</p>
                    {b.origine_breeder && (
                      <p className="text-xs text-gray-400 dark:text-gray-500 truncate">{b.origine_breeder}</p>
                    )}
                  </div>
                  <button
                    onClick={() => startEdit(b)}
                    className="p-1.5 text-gray-300 hover:text-grow-600 hover:bg-grow-50 rounded opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                    <Pencil size={13} />
                  </button>
                  <button
                    onClick={() => deleteMut.mutate(b.id_breeder)}
                    disabled={deleteMut.isPending}
                    className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                    <Trash2 size={13} />
                  </button>
                </div>

                {/* Formulaire d'édition inline */}
                {editId === b.id_breeder && (
                  <div className="px-4 pb-4 pt-1 bg-grow-50 border-t border-grow-100 space-y-3">
                    <p className="text-xs font-semibold text-grow-700">Modifier le breeder</p>
                    <Field label="Nom" value={form.nom_breeder} onChange={v => setForm(f => ({ ...f, nom_breeder: v }))} placeholder="Ex: Barney's Farm" required />
                    <Field label="Origine / Pays" value={form.origine_breeder} onChange={v => setForm(f => ({ ...f, origine_breeder: v }))} placeholder="Ex: Pays-Bas" />
                    <Field label="Informations" value={form.information_breeder} onChange={v => setForm(f => ({ ...f, information_breeder: v }))} placeholder="Notes diverses…" textarea />
                    {error && <p className="text-xs text-red-500">{error}</p>}
                    <div className="flex gap-2 justify-end">
                      <button onClick={cancelEdit} className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">
                        <X size={13} /> Annuler
                      </button>
                      <button
                        onClick={handleSave}
                        disabled={updateMut.isPending}
                        className="flex items-center gap-1 px-3 py-1.5 text-sm bg-grow-600 text-white rounded-lg hover:bg-grow-700 disabled:opacity-40">
                        <Check size={13} /> Enregistrer
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Formulaire d'ajout */}
          {showForm && (
            <div className="px-4 pb-4 pt-3 border-t border-gray-100 dark:border-gray-700 space-y-3 bg-gray-50 dark:bg-gray-700/50">
              <p className="text-xs font-semibold text-gray-600 dark:text-gray-300">Nouveau breeder</p>
              <Field label="Nom" value={form.nom_breeder} onChange={v => setForm(f => ({ ...f, nom_breeder: v }))} placeholder="Ex: Barney's Farm" required />
              <Field label="Origine / Pays" value={form.origine_breeder} onChange={v => setForm(f => ({ ...f, origine_breeder: v }))} placeholder="Ex: Pays-Bas" />
              <Field label="Informations" value={form.information_breeder} onChange={v => setForm(f => ({ ...f, information_breeder: v }))} placeholder="Notes diverses…" textarea />
              {error && <p className="text-xs text-red-500">{error}</p>}
              <div className="flex gap-2 justify-end">
                <button onClick={cancelAdd} className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">
                  <X size={13} /> Annuler
                </button>
                <button
                  onClick={handleSave}
                  disabled={createMut.isPending}
                  className="flex items-center gap-1 px-3 py-1.5 text-sm bg-grow-600 text-white rounded-lg hover:bg-grow-700 disabled:opacity-40">
                  <Plus size={13} /> Ajouter
                </button>
              </div>
            </div>
          )}

          {/* Bouton Ajouter */}
          {!isFormOpen && (
            <div className="px-4 py-3 border-t border-gray-100 dark:border-gray-700">
              <button
                onClick={() => { setShowForm(true); setForm(emptyForm); setError('') }}
                className="flex items-center gap-1.5 text-sm text-grow-600 hover:text-grow-700 font-medium">
                <Plus size={14} /> Ajouter un breeder
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Éditeur Variétés ──────────────────────────────────────────────────────────
function VarietesEditor() {
  const qc = useQueryClient()
  const [open,      setOpen]      = useState(true)
  const [showForm,  setShowForm]  = useState(false)
  const [editId,    setEditId]    = useState<number | null>(null)
  const [search,    setSearch]    = useState('')

  const emptyForm = { nom_variete: '', croisement_variete: '', informations_variete: '', lien_web: '' }
  const [form, setForm] = useState(emptyForm)
  const [error, setError] = useState('')

  const { data: varietes = [], isLoading } = useQuery<Variete[]>({
    queryKey: ['varietes'],
    queryFn: async () => (await varieteAPI.getAll()).data,
    staleTime: 30_000,
  })

  const invalidate = () => qc.invalidateQueries({ queryKey: ['varietes'] })

  const createMut = useMutation({
    mutationFn: (d: Omit<Variete, 'id_variete'>) => varieteAPI.create(d),
    onSuccess: () => { invalidate(); setForm(emptyForm); setShowForm(false); setError('') },
    onError: (e: any) => setError(e?.response?.data?.detail ?? 'Erreur'),
  })

  const updateMut = useMutation({
    mutationFn: ({ id, d }: { id: number; d: Omit<Variete, 'id_variete'> }) =>
      varieteAPI.update(id, d),
    onSuccess: () => { invalidate(); setEditId(null); setForm(emptyForm); setError('') },
    onError: (e: any) => setError(e?.response?.data?.detail ?? 'Erreur'),
  })

  const deleteMut = useMutation({
    mutationFn: (id: number) => varieteAPI.delete(id),
    onSuccess: invalidate,
  })

  const startEdit = (v: Variete) => {
    setEditId(v.id_variete)
    setForm({
      nom_variete: v.nom_variete,
      croisement_variete: v.croisement_variete ?? '',
      informations_variete: v.informations_variete ?? '',
      lien_web: v.lien_web ?? '',
    })
    setShowForm(false)
    setError('')
  }

  const cancelEdit = () => { setEditId(null); setForm(emptyForm); setError('') }
  const cancelAdd  = () => { setShowForm(false); setForm(emptyForm); setError('') }

  const handleSave = () => {
    if (!form.nom_variete.trim()) { setError('Le nom est obligatoire'); return }
    const payload = {
      nom_variete: form.nom_variete.trim(),
      croisement_variete: form.croisement_variete.trim() || undefined,
      informations_variete: form.informations_variete.trim() || undefined,
      lien_web: form.lien_web.trim() || undefined,
    }
    if (editId !== null) {
      updateMut.mutate({ id: editId, d: payload })
    } else {
      createMut.mutate(payload)
    }
  }

  const filtered = varietes.filter(v =>
    v.nom_variete.toLowerCase().includes(search.toLowerCase()) ||
    (v.croisement_variete ?? '').toLowerCase().includes(search.toLowerCase())
  )

  const isFormOpen = showForm || editId !== null

  return (
    <div className="border border-gray-100 dark:border-gray-700 rounded-xl overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-left"
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-200">🌿 Variétés</span>
          <span className="text-xs bg-gray-200 text-gray-500 dark:text-gray-400 dark:text-gray-500 px-2 py-0.5 rounded-full">
            {isLoading ? '…' : varietes.length}
          </span>
        </div>
        {open ? <ChevronUp size={14} className="text-gray-400 dark:text-gray-500" /> : <ChevronDown size={14} className="text-gray-400 dark:text-gray-500" />}
      </button>

      {open && (
        <div className="bg-white dark:bg-gray-800">
          {/* Recherche */}
          {varietes.length > 5 && (
            <div className="px-4 pt-3 pb-2">
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Rechercher une variété…"
                className="w-full text-sm border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-grow-400"
              />
            </div>
          )}

          {/* Liste */}
          <div className="divide-y divide-gray-50 max-h-80 overflow-y-auto">
            {filtered.length === 0 && !isLoading && (
              <p className="text-xs text-gray-400 dark:text-gray-500 italic px-4 py-3">
                {search ? 'Aucune variété correspondante' : 'Aucune variété — ajoutez-en ci-dessous'}
              </p>
            )}
            {filtered.map(v => (
              <div key={v.id_variete}>
                <div className="flex items-center gap-2 px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-700/40 group">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 dark:text-gray-100 truncate">{v.nom_variete}</p>
                    {v.croisement_variete && (
                      <p className="text-xs text-gray-400 dark:text-gray-500 truncate">{v.croisement_variete}</p>
                    )}
                  </div>
                  {v.lien_web && (
                    <a
                      href={v.lien_web}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={e => e.stopPropagation()}
                      className="p-1.5 text-gray-300 hover:text-blue-500 rounded flex-shrink-0"
                      title="Ouvrir le lien">
                      <ExternalLink size={13} />
                    </a>
                  )}
                  <button
                    onClick={() => startEdit(v)}
                    className="p-1.5 text-gray-300 hover:text-grow-600 hover:bg-grow-50 rounded opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                    <Pencil size={13} />
                  </button>
                  <button
                    onClick={() => deleteMut.mutate(v.id_variete)}
                    disabled={deleteMut.isPending}
                    className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                    <Trash2 size={13} />
                  </button>
                </div>

                {/* Formulaire d'édition inline */}
                {editId === v.id_variete && (
                  <div className="px-4 pb-4 pt-1 bg-grow-50 border-t border-grow-100 space-y-3">
                    <p className="text-xs font-semibold text-grow-700">Modifier la variété</p>
                    <Field label="Nom" value={form.nom_variete} onChange={val => setForm(f => ({ ...f, nom_variete: val }))} placeholder="Ex: Blue Dream" required />
                    <Field label="Croisement" value={form.croisement_variete} onChange={val => setForm(f => ({ ...f, croisement_variete: val }))} placeholder="Ex: Blueberry × Haze" />
                    <Field label="Lien web" value={form.lien_web} onChange={val => setForm(f => ({ ...f, lien_web: val }))} placeholder="https://…" />
                    <Field label="Informations" value={form.informations_variete} onChange={val => setForm(f => ({ ...f, informations_variete: val }))} placeholder="Notes, temps de floraison…" textarea />
                    {error && <p className="text-xs text-red-500">{error}</p>}
                    <div className="flex gap-2 justify-end">
                      <button onClick={cancelEdit} className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">
                        <X size={13} /> Annuler
                      </button>
                      <button
                        onClick={handleSave}
                        disabled={updateMut.isPending}
                        className="flex items-center gap-1 px-3 py-1.5 text-sm bg-grow-600 text-white rounded-lg hover:bg-grow-700 disabled:opacity-40">
                        <Check size={13} /> Enregistrer
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Formulaire d'ajout */}
          {showForm && (
            <div className="px-4 pb-4 pt-3 border-t border-gray-100 dark:border-gray-700 space-y-3 bg-gray-50 dark:bg-gray-700/50">
              <p className="text-xs font-semibold text-gray-600 dark:text-gray-300">Nouvelle variété</p>
              <Field label="Nom" value={form.nom_variete} onChange={val => setForm(f => ({ ...f, nom_variete: val }))} placeholder="Ex: Blue Dream" required />
              <Field label="Croisement" value={form.croisement_variete} onChange={val => setForm(f => ({ ...f, croisement_variete: val }))} placeholder="Ex: Blueberry × Haze" />
              <Field label="Lien web" value={form.lien_web} onChange={val => setForm(f => ({ ...f, lien_web: val }))} placeholder="https://…" />
              <Field label="Informations" value={form.informations_variete} onChange={val => setForm(f => ({ ...f, informations_variete: val }))} placeholder="Notes, temps de floraison…" textarea />
              {error && <p className="text-xs text-red-500">{error}</p>}
              <div className="flex gap-2 justify-end">
                <button onClick={cancelAdd} className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">
                  <X size={13} /> Annuler
                </button>
                <button
                  onClick={handleSave}
                  disabled={createMut.isPending}
                  className="flex items-center gap-1 px-3 py-1.5 text-sm bg-grow-600 text-white rounded-lg hover:bg-grow-700 disabled:opacity-40">
                  <Plus size={13} /> Ajouter
                </button>
              </div>
            </div>
          )}

          {/* Bouton Ajouter */}
          {!isFormOpen && (
            <div className="px-4 py-3 border-t border-gray-100 dark:border-gray-700">
              <button
                onClick={() => { setShowForm(true); setForm(emptyForm); setError('') }}
                className="flex items-center gap-1.5 text-sm text-grow-600 hover:text-grow-700 font-medium">
                <Plus size={14} /> Ajouter une variété
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Section Capteurs Govee ────────────────────────────────────────────────────

function GoveeSection() {
  const qc = useQueryClient()

  // Config API cloud
  const { data: config } = useQuery<GoveeConfig>({
    queryKey: ['govee-config'],
    queryFn: async () => (await capteursAPI.getConfig()).data,
  })
  const [apiKey, setApiKey]   = useState('')
  const [savingCfg, setSavingCfg] = useState(false)

  const saveConfig = async () => {
    setSavingCfg(true)
    try {
      await capteursAPI.updateConfig({ api_key: apiKey || undefined, polling_enabled: true })
      await qc.invalidateQueries({ queryKey: ['govee-config'] })
    } finally {
      setSavingCfg(false)
    }
  }

  // Capteurs
  const { data: devices = [], refetch: refetchDevices } = useQuery<GoveeDevice[]>({
    queryKey: ['capteurs'],
    queryFn: async () => (await capteursAPI.getAll()).data,
  })
  const { data: espaces = [] } = useQuery<any[]>({
    queryKey: ['espaces'],
    queryFn: async () => {
      const res = await import('../api/client').then(m => m.default.get<any[]>('/espaces/'))
      return res.data
    },
  })

  const [showForm, setShowForm]           = useState(false)
  const [showImport, setShowImport]       = useState(false)
  const [cloudDevices, setCloudDevices]   = useState<GoveeCloudDevice[]>([])
  const [loadingImport, setLoadingImport] = useState(false)
  const [importingId, setImportingId]     = useState<string | null>(null)
  const [form, setForm] = useState<GoveeDeviceCreate>({
    nom: '', device_id: '', modele: 'H5179', ip_lan: '', id_espace: undefined, actif: true,
  })
  const [saving, setSaving]   = useState(false)
  const [polling, setPolling] = useState(false)
  const [pollResults, setPollResults] = useState<PollResult[]>([])

  const handleAddDevice = async () => {
    if (!form.nom.trim()) return
    setSaving(true)
    try {
      await capteursAPI.create(form)
      setForm({ nom: '', device_id: '', modele: 'H5179', ip_lan: '', id_espace: undefined, actif: true })
      setShowForm(false)
      await refetchDevices()
    } finally {
      setSaving(false)
    }
  }

  const handleLoadCloudDevices = async () => {
    setLoadingImport(true)
    setShowImport(true)
    try {
      const res = await capteursAPI.listCloudDevices()
      setCloudDevices(res.data)
    } catch {
      setCloudDevices([])
    } finally {
      setLoadingImport(false)
    }
  }

  const handleImportCloudDevice = async (d: GoveeCloudDevice) => {
    setImportingId(d.device_id)
    try {
      await capteursAPI.create({
        nom:       d.device_name,
        device_id: d.device_id,
        modele:    d.sku,
        actif:     true,
      })
      await refetchDevices()
      setCloudDevices(prev => prev.map(x =>
        x.device_id === d.device_id ? { ...x, already_registered: true } : x
      ))
    } finally {
      setImportingId(null)
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Supprimer ce capteur et tout son historique ?')) return
    await capteursAPI.delete(id)
    await refetchDevices()
  }

  const handleToggleActif = async (d: GoveeDevice) => {
    await capteursAPI.update(d.id_device, { actif: !d.actif })
    await refetchDevices()
  }

  // Édition inline de l'espace d'un capteur
  const [editingEspace, setEditingEspace] = useState<number | null>(null)

  const handleSaveEspace = async (deviceId: number, idEspace: number | null) => {
    await capteursAPI.update(deviceId, { id_espace: idEspace ?? undefined })
    await refetchDevices()
    setEditingEspace(null)
  }

  const handlePollNow = async () => {
    setPolling(true)
    setPollResults([])
    try {
      const res = await capteursAPI.pollNow()
      setPollResults(res.data)
      await refetchDevices()
    } finally {
      setPolling(false)
    }
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700 bg-teal-50 flex items-center gap-3">
        <Thermometer size={18} className="text-teal-600" />
        <div>
          <h2 className="text-base font-semibold text-gray-800 dark:text-gray-100">Capteurs Govee</h2>
          <p className="text-xs text-gray-400 dark:text-gray-500">Thermomètres/hygromètres H5179 via API LAN (UDP) ou Cloud</p>
        </div>
      </div>

      <div className="p-6 space-y-6">

        {/* Config API Cloud */}
        <div>
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">Configuration API Cloud (fallback)</h3>
          <p className="text-xs text-gray-400 dark:text-gray-500 mb-3">
            Si l'IP locale n'est pas disponible, le polling utilise l'API Cloud Govee.
            Obtenez votre clé sur{' '}
            <a href="https://developer.govee.com" target="_blank" rel="noreferrer"
               className="text-teal-600 underline">developer.govee.com</a>.
          </p>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder={config?.api_key ? '••••••••••••••••' : 'Govee API Key…'}
              value={apiKey}
              onChange={e => setApiKey(e.target.value)}
              className="flex-1 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
            />
            <button
              onClick={saveConfig}
              disabled={savingCfg || !apiKey}
              className="flex items-center gap-1.5 px-3 py-2 bg-teal-600 text-white rounded-lg
                         text-sm disabled:opacity-50 hover:bg-teal-700 transition-colors"
            >
              <Save size={14} />
              {savingCfg ? 'Sauvegarde…' : 'Sauvegarder'}
            </button>
          </div>
          {config?.api_key && (
            <p className="text-xs text-green-600 mt-1">✓ Clé API enregistrée</p>
          )}
        </div>

        {/* Liste des capteurs */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200">
              Capteurs enregistrés ({devices.length})
            </h3>
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={handlePollNow}
                disabled={polling || devices.length === 0}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 text-gray-700 dark:text-gray-200
                           rounded-lg text-xs hover:bg-gray-200 disabled:opacity-50 transition-colors"
              >
                <RefreshCw size={12} className={polling ? 'animate-spin' : ''} />
                Lire maintenant
              </button>
              <button
                onClick={handleLoadCloudDevices}
                disabled={loadingImport}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white
                           rounded-lg text-xs hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                <Wifi size={12} className={loadingImport ? 'animate-pulse' : ''} />
                Importer depuis Govee
              </button>
              <button
                onClick={() => setShowForm(v => !v)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-teal-600 text-white
                           rounded-lg text-xs hover:bg-teal-700 transition-colors"
              >
                <Plus size={12} />
                Ajouter manuellement
              </button>
            </div>
          </div>

          {/* Résultats de poll */}
          {pollResults.length > 0 && (
            <div className="mb-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg space-y-1">
              {pollResults.map(r => (
                <div key={r.device_id} className="flex items-center gap-2 text-xs">
                  {r.success
                    ? <Wifi size={12} className="text-green-500" />
                    : <WifiOff size={12} className="text-red-400" />}
                  <span className="font-medium">{r.nom}</span>
                  {r.success
                    ? <span className="text-gray-600 dark:text-gray-300">
                        {r.temperature?.toFixed(1)}°C · {r.humidite?.toFixed(0)}% · VPD {r.vpd?.toFixed(2)}
                      </span>
                    : <span className="text-red-500">{r.erreur}</span>}
                </div>
              ))}
            </div>
          )}

          {/* Panneau import Govee Cloud */}
          {showImport && (
            <div className="mb-4 p-4 border border-blue-200 bg-blue-50 rounded-xl">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-xs font-semibold text-blue-700 uppercase tracking-wide">
                  Appareils Govee détectés sur ton compte
                </h4>
                <button onClick={() => setShowImport(false)}
                  className="text-blue-400 hover:text-blue-600">
                  <X size={14} />
                </button>
              </div>
              {loadingImport ? (
                <p className="text-xs text-blue-500 text-center py-3">Chargement…</p>
              ) : cloudDevices.length === 0 ? (
                <p className="text-xs text-blue-500 text-center py-3">
                  Aucun thermomètre trouvé — vérifier la clé API
                </p>
              ) : (
                <div className="space-y-2">
                  {cloudDevices.map(d => (
                    <div key={d.device_id}
                      className="flex items-center gap-3 bg-white dark:bg-gray-800 rounded-lg px-3 py-2 border border-blue-100">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-800 dark:text-gray-100">{d.device_name}</p>
                        <p className="text-xs text-gray-400 dark:text-gray-500">{d.sku} · {d.device_id}</p>
                      </div>
                      {d.already_registered ? (
                        <span className="text-xs text-green-600 font-medium flex items-center gap-1">
                          <Check size={12} /> Enregistré
                        </span>
                      ) : (
                        <button
                          onClick={() => handleImportCloudDevice(d)}
                          disabled={importingId === d.device_id}
                          className="text-xs px-3 py-1 bg-blue-600 text-white rounded-lg
                                     hover:bg-blue-700 disabled:opacity-50 transition-colors"
                        >
                          {importingId === d.device_id ? 'Import…' : 'Importer'}
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Formulaire ajout manuel */}
          {showForm && (
            <div className="mb-4 p-4 border border-teal-200 bg-teal-50 rounded-xl space-y-3">
              <h4 className="text-xs font-semibold text-teal-700 uppercase tracking-wide">Nouveau capteur</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-600 dark:text-gray-300 mb-1">Nom *</label>
                  <input value={form.nom} onChange={e => setForm(f => ({...f, nom: e.target.value}))}
                    placeholder="Box Floraison 1"
                    className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400" />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 dark:text-gray-300 mb-1">Modèle</label>
                  <input value={form.modele ?? ''} onChange={e => setForm(f => ({...f, modele: e.target.value}))}
                    placeholder="H5179"
                    className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400" />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 dark:text-gray-300 mb-1">Device ID / MAC</label>
                  <input value={form.device_id ?? ''} onChange={e => setForm(f => ({...f, device_id: e.target.value}))}
                    placeholder="AA:BB:CC:DD:EE:FF"
                    className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400" />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 dark:text-gray-300 mb-1">IP locale (LAN UDP)</label>
                  <input value={form.ip_lan ?? ''} onChange={e => setForm(f => ({...f, ip_lan: e.target.value}))}
                    placeholder="192.168.1.42"
                    className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400" />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 dark:text-gray-300 mb-1">Espace de culture</label>
                  <select value={form.id_espace ?? ''} onChange={e => setForm(f => ({...f, id_espace: e.target.value ? Number(e.target.value) : undefined}))}
                    className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400">
                    <option value="">— Aucun —</option>
                    {espaces.map((e: any) => (
                      <option key={e.id_espace} value={e.id_espace}>{e.nom}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="flex gap-2 justify-end">
                <button onClick={() => setShowForm(false)}
                  className="px-3 py-1.5 text-sm text-gray-600 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/40">
                  Annuler
                </button>
                <button onClick={handleAddDevice} disabled={saving || !form.nom.trim()}
                  className="px-3 py-1.5 text-sm text-white bg-teal-600 rounded-lg hover:bg-teal-700 disabled:opacity-50">
                  {saving ? 'Enregistrement…' : 'Enregistrer'}
                </button>
              </div>
            </div>
          )}

          {/* Tableau capteurs */}
          {devices.length === 0 ? (
            <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-4">Aucun capteur enregistré</p>
          ) : (
            <div className="space-y-2">
              {devices.map(d => (
                <div key={d.id_device}
                  className="flex flex-col gap-2 px-4 py-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl border border-gray-100 dark:border-gray-700">
                  <div className="flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 dark:text-gray-100 truncate">{d.nom}</p>
                      <p className="text-xs text-gray-400 dark:text-gray-500">
                        {[d.modele, d.device_id, d.ip_lan ? `LAN: ${d.ip_lan}` : null]
                          .filter(Boolean).join(' · ')}
                      </p>
                    </div>
                    {d.derniere_temperature != null && (
                      <div className="text-xs text-gray-600 dark:text-gray-300 shrink-0">
                        {d.derniere_temperature.toFixed(1)}°C · {d.derniere_humidite?.toFixed(0)}%
                      </div>
                    )}
                    <button onClick={() => handleToggleActif(d)}
                      className={`shrink-0 p-1.5 rounded-lg transition-colors ${
                        d.actif
                          ? 'bg-green-100 text-green-600 hover:bg-green-200'
                          : 'bg-gray-200 text-gray-400 dark:text-gray-500 hover:bg-gray-300'
                      }`}
                      title={d.actif ? 'Actif — cliquer pour désactiver' : 'Inactif — cliquer pour activer'}>
                      <Wifi size={14} />
                    </button>
                    <button onClick={() => handleDelete(d.id_device)}
                      className="shrink-0 p-1.5 text-red-400 hover:bg-red-50 rounded-lg transition-colors">
                      <Trash2 size={14} />
                    </button>
                  </div>

                  {/* Ligne espace — affichage + édition inline */}
                  {editingEspace === d.id_device ? (
                    <div className="flex items-center gap-2">
                      <select
                        defaultValue={d.id_espace ?? ''}
                        onChange={e => handleSaveEspace(d.id_device, e.target.value ? Number(e.target.value) : null)}
                        className="flex-1 border border-teal-300 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-teal-400"
                      >
                        <option value="">— Aucun espace —</option>
                        {espaces.map((e: any) => (
                          <option key={e.id_espace} value={e.id_espace}>{e.nom}</option>
                        ))}
                      </select>
                      <button onClick={() => setEditingEspace(null)}
                        className="p-1 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:text-gray-300">
                        <X size={13} />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setEditingEspace(d.id_device)}
                      className="flex items-center gap-1.5 text-xs text-left w-fit px-2 py-1 rounded-lg hover:bg-gray-200 transition-colors"
                    >
                      <span className="text-gray-400 dark:text-gray-500">🏠</span>
                      <span className={d.nom_espace ? 'text-teal-700 font-medium' : 'text-gray-400 dark:text-gray-500 italic'}>
                        {d.nom_espace ?? 'Aucun espace — cliquer pour assigner'}
                      </span>
                      <Pencil size={10} className="text-gray-400 dark:text-gray-500 ml-0.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Info protocole */}
        <div className="text-xs text-gray-400 dark:text-gray-500 bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 space-y-1">
          <p className="font-medium text-gray-500 dark:text-gray-400 dark:text-gray-500">💡 Comment ça marche ?</p>
          <p>Le backend interroge vos capteurs toutes les <strong>5 minutes</strong> automatiquement.</p>
          <p>Priorité LAN (UDP port 4003) si une IP est configurée, sinon Cloud API Govee.</p>
          <p>Le H5179 doit être sur le même réseau local et avoir le LAN Control activé dans l'app Govee.</p>
        </div>
      </div>

      {/* ── Import automatique Gmail ─────────────────────────────────────── */}
      <GmailImportSection config={config} onConfigSaved={() => qc.invalidateQueries({ queryKey: ['govee-config'] })} />

    </div>
  )
}

// ── Section Import Gmail ──────────────────────────────────────────────────────

function GmailImportSection({
  config,
  onConfigSaved,
}: {
  config?: GoveeConfig
  onConfigSaved: () => void
}) {
  const [gmailUser,   setGmailUser]   = useState(config?.gmail_user ?? '')
  const [gmailPwd,    setGmailPwd]    = useState('')
  const [showPwd,     setShowPwd]     = useState(false)
  const [enabled,     setEnabled]     = useState(config?.gmail_enabled ?? false)
  const [saving,      setSaving]      = useState(false)
  const [checking,    setChecking]    = useState(false)
  const [checkResult, setCheckResult] = useState<GmailImportResult | null>(null)
  const [saveMsg,     setSaveMsg]     = useState('')

  // Synchroniser depuis la config une fois chargée
  useEffect(() => {
    if (config) {
      setGmailUser(config.gmail_user ?? '')
      setEnabled(config.gmail_enabled)
    }
  }, [config])

  const handleSave = async () => {
    setSaving(true)
    setSaveMsg('')
    try {
      await capteursAPI.updateConfig({
        gmail_user:         gmailUser.trim() || undefined,
        gmail_app_password: gmailPwd || undefined,
        gmail_enabled:      enabled,
      })
      setSaveMsg('✓ Configuration Gmail enregistrée')
      setGmailPwd('')  // effacer le champ mot de passe après sauvegarde
      onConfigSaved()
    } catch {
      setSaveMsg('✗ Erreur lors de la sauvegarde')
    } finally {
      setSaving(false)
      setTimeout(() => setSaveMsg(''), 4000)
    }
  }

  const handleCheckNow = async () => {
    setChecking(true)
    setCheckResult(null)
    try {
      const res = await capteursAPI.checkGmail()
      setCheckResult(res.data)
    } catch (e: any) {
      setCheckResult({
        emails_processed: -1, imported_total: 0, skipped_total: 0, errors_total: 0,
        message: e?.response?.data?.detail ?? 'Erreur de connexion',
        ok: false,
      })
    } finally {
      setChecking(false)
    }
  }

  const lastCheck = config?.gmail_last_check
    ? new Date(config.gmail_last_check + 'Z').toLocaleString('fr-FR')
    : null

  return (
    <div className="border-t border-gray-100 dark:border-gray-700 pt-6 mt-2">
      <div className="flex items-center gap-3 mb-4">
        <Mail size={16} className="text-blue-500" />
        <div>
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200">Import automatique Gmail</h3>
          <p className="text-xs text-gray-400 dark:text-gray-500">
            Importe automatiquement les exports CSV Govee reçus par email — chaque nuit à 00h30
          </p>
        </div>
      </div>

      {/* Activer / désactiver */}
      <div className="flex items-center gap-3 mb-4">
        <button
          type="button"
          onClick={() => setEnabled(e => !e)}
          className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent
            transition-colors duration-200 focus:outline-none
            ${enabled ? 'bg-blue-500' : 'bg-gray-300'}`}
        >
          <span className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white dark:bg-gray-800 shadow
            transform transition duration-200 ${enabled ? 'translate-x-4' : 'translate-x-0'}`} />
        </button>
        <span className="text-sm text-gray-600 dark:text-gray-300">
          {enabled ? 'Import automatique activé' : 'Import automatique désactivé'}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
        {/* Adresse Gmail */}
        <div>
          <label className="block text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500 mb-1">Adresse Gmail</label>
          <input
            type="email"
            value={gmailUser}
            onChange={e => setGmailUser(e.target.value)}
            placeholder="pietissot@gmail.com"
            className="w-full text-sm border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2
              focus:ring-2 focus:ring-blue-400 focus:border-transparent"
          />
        </div>

        {/* Mot de passe d'application */}
        <div>
          <label className="block text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500 mb-1">
            Mot de passe d'application Google
            {config?.gmail_app_password_set && (
              <span className="ml-2 text-green-500">✓ enregistré</span>
            )}
          </label>
          <div className="relative">
            <input
              type={showPwd ? 'text' : 'password'}
              value={gmailPwd}
              onChange={e => setGmailPwd(e.target.value)}
              placeholder={config?.gmail_app_password_set ? '••••••••••••••••' : 'xxxx xxxx xxxx xxxx'}
              className="w-full text-sm border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 pr-9
                focus:ring-2 focus:ring-blue-400 focus:border-transparent"
            />
            <button
              type="button"
              onClick={() => setShowPwd(v => !v)}
              className="absolute right-2 top-2 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:text-gray-300"
            >
              {showPwd ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
            Différent de ton mot de passe habituel —{' '}
            <a
              href="https://myaccount.google.com/apppasswords"
              target="_blank" rel="noreferrer"
              className="text-blue-500 underline"
            >
              myaccount.google.com/apppasswords
            </a>
          </p>
        </div>
      </div>

      {/* Statut dernière vérification */}
      {(config?.gmail_last_status || lastCheck) && (
        <div className="mb-4 text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500 bg-gray-50 dark:bg-gray-700/50 rounded-lg px-3 py-2 space-y-0.5">
          {lastCheck && <p>Dernière vérification : <strong>{lastCheck}</strong></p>}
          {config?.gmail_last_status && <p>{config.gmail_last_status}</p>}
        </div>
      )}

      {/* Résultat du test manuel */}
      {checkResult && (
        <div className={`mb-4 rounded-lg px-3 py-2 text-sm flex items-start gap-2
          ${checkResult.ok ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
          {checkResult.ok
            ? <CheckCircle2 size={15} className="shrink-0 mt-0.5" />
            : <AlertCircle  size={15} className="shrink-0 mt-0.5" />}
          <div>
            <p className="font-medium">
              {checkResult.ok ? 'Import terminé' : 'Erreur'}
            </p>
            <p className="text-xs mt-0.5">{checkResult.message}</p>
            {checkResult.ok && (
              <p className="text-xs mt-0.5 opacity-75">
                {checkResult.emails_processed} email(s) traité(s)
              </p>
            )}
          </div>
        </div>
      )}

      {saveMsg && (
        <p className={`text-xs mb-3 ${saveMsg.startsWith('✓') ? 'text-green-600' : 'text-red-500'}`}>
          {saveMsg}
        </p>
      )}

      {/* Boutons */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 text-white
            rounded-lg text-sm disabled:opacity-50 hover:bg-blue-700 transition-colors"
        >
          {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
          Enregistrer
        </button>
        <button
          onClick={handleCheckNow}
          disabled={checking || !config?.gmail_user}
          className="flex items-center gap-1.5 px-3 py-2 bg-gray-100 text-gray-700 dark:text-gray-200
            rounded-lg text-sm hover:bg-gray-200 disabled:opacity-50 transition-colors"
          title={!config?.gmail_user ? 'Configurez d\'abord Gmail' : undefined}
        >
          {checking ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
          Vérifier maintenant
        </button>
      </div>

      {/* Guide pas à pas */}
      <details className="mt-4">
        <summary className="text-xs text-blue-500 cursor-pointer hover:text-blue-700 select-none">
          📋 Comment créer un mot de passe d'application Google ?
        </summary>
        <div className="mt-2 text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500 bg-blue-50 rounded-lg p-3 space-y-1.5">
          <p><strong>1.</strong> Assure-toi d'avoir la <strong>validation en 2 étapes activée</strong> sur ton compte Google
            (<a href="https://myaccount.google.com/security" target="_blank" rel="noreferrer" className="text-blue-500 underline">myaccount.google.com/security</a>).</p>
          <p><strong>2.</strong> Va sur{' '}
            <a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noreferrer" className="text-blue-500 underline">
              myaccount.google.com/apppasswords
            </a>.</p>
          <p><strong>3.</strong> Dans le champ "Nom de l'application", tape <code className="bg-blue-100 px-1 rounded">GrowManager</code> et clique <strong>Créer</strong>.</p>
          <p><strong>4.</strong> Google affiche un mot de passe de <strong>16 caractères</strong> (format : xxxx xxxx xxxx xxxx). Copie-le.</p>
          <p><strong>5.</strong> Colle-le dans le champ "Mot de passe d'application" ci-dessus et clique <strong>Enregistrer</strong>.</p>
          <p className="text-gray-400 dark:text-gray-500 pt-1">Ce mot de passe ne fonctionne que pour GrowManager et peut être révoqué à tout moment.</p>
        </div>
      </details>
    </div>
  )
}

// ── Section Économique (prix kWh, devise) ─────────────────────────────────────

function AppSettingsSection() {
  const prixKwh = useAppSetting('prix_kwh')
  const devise  = useAppSetting('devise')

  const [editingKwh,   setEditingKwh]   = useState(false)
  const [editingDevise, setEditingDevise] = useState(false)
  const [valKwh,   setValKwh]   = useState('')
  const [valDevise, setValDevise] = useState('')
  const [savedKwh,   setSavedKwh]   = useState(false)
  const [savedDevise, setSavedDevise] = useState(false)

  const startEditKwh = () => { setValKwh(prixKwh.value ?? ''); setEditingKwh(true); setSavedKwh(false) }
  const startEditDevise = () => { setValDevise(devise.value ?? ''); setEditingDevise(true); setSavedDevise(false) }

  const saveKwh = async () => {
    if (!valKwh.trim()) return
    await prixKwh.update(valKwh.trim())
    setEditingKwh(false)
    setSavedKwh(true)
    setTimeout(() => setSavedKwh(false), 2000)
  }

  const saveDevise = async () => {
    if (!valDevise.trim()) return
    await devise.update(valDevise.trim())
    setEditingDevise(false)
    setSavedDevise(true)
    setTimeout(() => setSavedDevise(false), 2000)
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700 bg-grow-50 flex items-center gap-3">
        <div className="p-2 bg-grow-100 rounded-lg">
          <Euro size={18} className="text-grow-700" />
        </div>
        <div>
          <h2 className="text-base font-semibold text-gray-800 dark:text-gray-100">Économique</h2>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Paramètres utilisés pour le calcul des coûts de culture</p>
        </div>
      </div>
      <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">

        {/* Prix kWh */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-200">Prix du kWh (€)</label>
          <p className="text-xs text-gray-400 dark:text-gray-500">Utilisé pour calculer le coût électrique de chaque culture.</p>
          {editingKwh ? (
            <div className="flex items-center gap-2">
              <input
                type="number" step="0.01" min="0"
                value={valKwh}
                onChange={e => setValKwh(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') saveKwh(); if (e.key === 'Escape') setEditingKwh(false) }}
                className="w-32 text-sm border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 focus:ring-2 focus:ring-grow-400 focus:outline-none"
                autoFocus
              />
              <span className="text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500">€/kWh</span>
              <button onClick={saveKwh} disabled={prixKwh.isPending}
                className="p-1.5 text-grow-600 hover:bg-grow-50 rounded-lg transition-colors">
                {prixKwh.isPending ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
              </button>
              <button onClick={() => setEditingKwh(false)}
                className="p-1.5 text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">
                <X size={14} />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <span className="text-lg font-semibold text-gray-800 dark:text-gray-100">
                {prixKwh.value ? `${prixKwh.value} €/kWh` : <span className="text-gray-400 dark:text-gray-500 text-sm font-normal">Non renseigné</span>}
              </span>
              {savedKwh && <span className="text-xs text-grow-600 flex items-center gap-1"><CheckCircle2 size={12} /> Enregistré</span>}
              <button onClick={startEditKwh}
                className="flex items-center gap-1 text-xs text-gray-400 dark:text-gray-500 hover:text-grow-600 px-2 py-1 hover:bg-grow-50 rounded-lg transition-colors">
                <Pencil size={12} /> Modifier
              </button>
            </div>
          )}
        </div>

        {/* Devise */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-200">Devise</label>
          <p className="text-xs text-gray-400 dark:text-gray-500">Symbole affiché dans les coûts (EUR, USD, CHF…).</p>
          {editingDevise ? (
            <div className="flex items-center gap-2">
              <input
                type="text" maxLength={10}
                value={valDevise}
                onChange={e => setValDevise(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') saveDevise(); if (e.key === 'Escape') setEditingDevise(false) }}
                className="w-24 text-sm border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 focus:ring-2 focus:ring-grow-400 focus:outline-none"
                autoFocus
              />
              <button onClick={saveDevise} disabled={devise.isPending}
                className="p-1.5 text-grow-600 hover:bg-grow-50 rounded-lg transition-colors">
                {devise.isPending ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
              </button>
              <button onClick={() => setEditingDevise(false)}
                className="p-1.5 text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">
                <X size={14} />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <span className="text-lg font-semibold text-gray-800 dark:text-gray-100">
                {devise.value || <span className="text-gray-400 dark:text-gray-500 text-sm font-normal">Non renseigné</span>}
              </span>
              {savedDevise && <span className="text-xs text-grow-600 flex items-center gap-1"><CheckCircle2 size={12} /> Enregistré</span>}
              <button onClick={startEditDevise}
                className="flex items-center gap-1 text-xs text-gray-400 dark:text-gray-500 hover:text-grow-600 px-2 py-1 hover:bg-grow-50 rounded-lg transition-colors">
                <Pencil size={12} /> Modifier
              </button>
            </div>
          )}
        </div>

      </div>
    </div>
  )
}

// ── Section Backup ────────────────────────────────────────────────────────────

function BackupSection() {
  const [downloading,  setDownloading]  = useState(false)
  const [restoring,    setRestoring]    = useState(false)
  const [restoreMsg,   setRestoreMsg]   = useState<{ ok: boolean; text: string } | null>(null)
  const [dragOver,     setDragOver]     = useState(false)
  const [confirmOpen,  setConfirmOpen]  = useState(false)
  const [pendingFile,  setPendingFile]  = useState<File | null>(null)

  // ── Télécharger la sauvegarde ──────────────────────────────────────────────
  const handleDownload = async () => {
    setDownloading(true)
    try {
      const res = await apiClient.get('/backup/dump', { responseType: 'blob' })
      const disposition = res.headers['content-disposition'] ?? ''
      const match = disposition.match(/filename=([^\s;]+)/)
      const filename = match ? match[1] : `growmanager_backup_${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.sql`
      const url = URL.createObjectURL(new Blob([res.data]))
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      alert('Erreur lors du téléchargement — vérifiez que le container backend est bien rebuild.')
    } finally {
      setDownloading(false)
    }
  }

  // ── Drag & Drop ────────────────────────────────────────────────────────────
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (!file) return
    if (!file.name.toLowerCase().endsWith('.sql')) {
      setRestoreMsg({ ok: false, text: 'Fichier invalide — seuls les .sql sont acceptés' })
      return
    }
    setPendingFile(file)
    setConfirmOpen(true)
  }, [])

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setPendingFile(file)
    setConfirmOpen(true)
    e.target.value = ''
  }

  // ── Restauration ──────────────────────────────────────────────────────────
  const handleRestore = async () => {
    if (!pendingFile) return
    setConfirmOpen(false)
    setRestoring(true)
    setRestoreMsg(null)
    try {
      const form = new FormData()
      form.append('file', pendingFile)
      await apiClient.post('/backup/restore', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      setRestoreMsg({ ok: true, text: '✓ Base restaurée — rechargement dans 3 secondes…' })
      setTimeout(() => window.location.reload(), 3000)
    } catch (e: any) {
      const detail = e?.response?.data?.detail ?? 'Erreur inconnue'
      setRestoreMsg({ ok: false, text: `✗ ${detail}` })
    } finally {
      setRestoring(false)
      setPendingFile(null)
    }
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">

      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700 bg-grow-50 flex items-center gap-3">
        <div className="p-2 bg-grow-100 rounded-lg">
          <Database size={18} className="text-grow-700" />
        </div>
        <div>
          <h2 className="text-base font-semibold text-gray-800 dark:text-gray-100">Sauvegarde & Restauration</h2>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Export complet de la base de données (mysqldump)</p>
        </div>
      </div>

      <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">

        {/* ── Colonne export ── */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200 flex items-center gap-2">
            <Download size={15} className="text-grow-600" /> Exporter
          </h3>
          <p className="text-xs text-gray-400 dark:text-gray-500">
            Génère un fichier <code className="bg-gray-100 px-1 rounded">.sql</code> contenant
            toute la base de données — structure et données.
            À conserver comme backup avant une mise à jour.
          </p>
          <button
            onClick={handleDownload}
            disabled={downloading}
            className="flex items-center gap-2 px-4 py-2.5 bg-grow-600 text-white rounded-xl
                       text-sm font-medium hover:bg-grow-700 disabled:opacity-50 transition-colors"
          >
            {downloading
              ? <Loader2 size={15} className="animate-spin" />
              : <Download size={15} />}
            {downloading ? 'Génération…' : 'Télécharger la sauvegarde'}
          </button>
        </div>

        {/* ── Colonne import / restauration ── */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200 flex items-center gap-2">
            <Upload size={15} className="text-orange-500" /> Restaurer
          </h3>
          <p className="text-xs text-gray-400 dark:text-gray-500">
            Glissez-déposez un fichier <code className="bg-gray-100 px-1 rounded">.sql</code> ou
            cliquez pour sélectionner.{' '}
            <span className="text-orange-500 font-medium">⚠ Remplace toutes les données existantes.</span>
          </p>

          {/* Zone drag & drop */}
          <label
            onDragOver={e => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            className={`flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed
                        px-4 py-6 cursor-pointer transition-colors
                        ${dragOver
                          ? 'border-orange-400 bg-orange-50'
                          : 'border-gray-200 dark:border-gray-700 hover:border-grow-400 hover:bg-grow-50'}`}
          >
            <UploadCloud size={24} className={dragOver ? 'text-orange-400' : 'text-gray-300'} />
            <span className="text-xs text-gray-400 dark:text-gray-500 text-center">
              {restoring
                ? 'Restauration en cours…'
                : dragOver
                  ? 'Relâchez pour restaurer'
                  : 'Glissez un .sql ici ou cliquez pour choisir'}
            </span>
            <input
              type="file"
              accept=".sql"
              className="hidden"
              onChange={handleFileInput}
              disabled={restoring}
            />
          </label>

          {/* Message résultat */}
          {restoreMsg && (
            <div className={`flex items-start gap-2 rounded-lg px-3 py-2 text-sm
              ${restoreMsg.ok ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>
              {restoreMsg.ok
                ? <CheckCircle2 size={15} className="shrink-0 mt-0.5" />
                : <AlertCircle  size={15} className="shrink-0 mt-0.5" />}
              <span>{restoreMsg.text}</span>
            </div>
          )}
        </div>
      </div>

      {/* ── Modale de confirmation ── */}
      {confirmOpen && pendingFile && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl max-w-sm w-full p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-orange-100 rounded-xl">
                <AlertCircle size={20} className="text-orange-500" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-gray-100">Confirmer la restauration</h3>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Cette action est irréversible</p>
              </div>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-300">
              Le fichier <strong className="text-gray-800 dark:text-gray-100">{pendingFile.name}</strong> va
              remplacer <strong>toutes les données</strong> actuelles de GrowManager.
            </p>
            <div className="flex gap-3 justify-end pt-1">
              <button
                onClick={() => { setConfirmOpen(false); setPendingFile(null) }}
                className="px-4 py-2 text-sm text-gray-600 dark:text-gray-300 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={handleRestore}
                className="px-4 py-2 text-sm text-white bg-orange-500 hover:bg-orange-600 rounded-lg transition-colors font-medium"
              >
                Oui, restaurer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}



// ── Section alertes stock ─────────────────────────────────────────────────────

const STOCK_TYPES_CONNUS = ['Fleur', 'Hash', 'Rosin', 'Trim', 'WPFF', 'Poussière']

function StockAlertSeuilsSection() {
  const queryClient = useQueryClient()
  const [editing, setEditing] = useState<string | null>(null)
  const [newType, setNewType] = useState('')
  const [form, setForm] = useState<SeuilUpsert>({ seuil_bocal_g: null, seuil_bocal_pct: null, seuil_total_g: null, actif: true })

  const { data: seuils = [], isLoading } = useQuery<StockAlertSeuil[]>({
    queryKey: ['stock-alert-seuils'],
    queryFn: async () => (await stockAlertSeuilsAPI.getAll()).data,
  })

  const upsertMut = useMutation({
    mutationFn: ({ type, payload }: { type: string; payload: SeuilUpsert }) =>
      stockAlertSeuilsAPI.upsert(type, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stock-alert-seuils'] })
      queryClient.invalidateQueries({ queryKey: ['stock-alerts'] })
      setEditing(null)
      setNewType('')
    },
  })

  const deleteMut = useMutation({
    mutationFn: (type: string) => stockAlertSeuilsAPI.delete(type),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stock-alert-seuils'] })
      queryClient.invalidateQueries({ queryKey: ['stock-alerts'] })
    },
  })

  function startEdit(s: StockAlertSeuil) {
    setEditing(s.type_stock)
    setForm({ seuil_bocal_g: s.seuil_bocal_g ?? null, seuil_bocal_pct: s.seuil_bocal_pct ?? null, seuil_total_g: s.seuil_total_g ?? null, actif: s.actif })
  }

  function startNew() {
    setEditing('__new__')
    setNewType('')
    setForm({ seuil_bocal_g: 10, seuil_bocal_pct: 10, seuil_total_g: 100, actif: true })
  }

  function save() {
    const type = editing === '__new__' ? newType.trim() : editing!
    if (!type) return
    upsertMut.mutate({ type, payload: form })
  }

  if (isLoading) return <div className="text-sm text-gray-400 py-4">Chargement…</div>

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Définissez les seuils d’alerte par type de stock. Une alerte apparaît sur le dashboard et en haut de la page Stock.
        </p>
        <button
          onClick={startNew}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-grow-600 text-white rounded-lg hover:bg-grow-700 text-sm font-medium"
        >
          <Plus size={14} /> Nouveau
        </button>
      </div>

      {seuils.length === 0 && editing !== '__new__' && (
        <p className="text-sm text-gray-400 dark:text-gray-500 italic">Aucun seuil configuré.</p>
      )}

      <div className="space-y-3">
        {editing === '__new__' && (
          <div className="rounded-xl border-2 border-grow-200 dark:border-grow-700 bg-grow-50 dark:bg-grow-900/10 p-4 space-y-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">Type de stock</label>
              <div className="flex gap-2">
                <select
                  value={newType}
                  onChange={e => setNewType(e.target.value)}
                  className="flex-1 border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-1.5 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                >
                  <option value="">— Choisir —</option>
                  {STOCK_TYPES_CONNUS.filter(t => !seuils.some(s => s.type_stock === t)).map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
                <input
                  type="text"
                  placeholder="ou saisir un type…"
                  value={newType}
                  onChange={e => setNewType(e.target.value)}
                  className="flex-1 border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-1.5 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                />
              </div>
            </div>
            <SeuilFormFields form={form} onChange={setForm} />
            <div className="flex gap-2 justify-end">
              <button onClick={() => setEditing(null)} className="px-3 py-1.5 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">Annuler</button>
              <button onClick={save} disabled={!newType.trim() || upsertMut.isPending}
                className="px-3 py-1.5 text-sm bg-grow-600 text-white rounded-lg hover:bg-grow-700 disabled:opacity-50">
                {upsertMut.isPending ? 'Sauvegarde…' : 'Créer'}
              </button>
            </div>
          </div>
        )}

        {seuils.map(s => (
          <div key={s.type_stock} className="rounded-xl border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
            {editing === s.type_stock ? (
              <div className="space-y-3">
                <p className="font-semibold text-sm text-gray-800 dark:text-gray-100">{s.type_stock}</p>
                <SeuilFormFields form={form} onChange={setForm} />
                <div className="flex gap-2 justify-end">
                  <button onClick={() => setEditing(null)} className="px-3 py-1.5 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">Annuler</button>
                  <button onClick={save} disabled={upsertMut.isPending}
                    className="px-3 py-1.5 text-sm bg-grow-600 text-white rounded-lg hover:bg-grow-700 disabled:opacity-50">
                    {upsertMut.isPending ? 'Sauvegarde…' : 'Sauvegarder'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm text-gray-800 dark:text-gray-100">{s.type_stock}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${s.actif ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {s.actif ? 'Actif' : 'Inactif'}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-3 mt-1.5 text-xs text-gray-500 dark:text-gray-400">
                    {s.seuil_bocal_g != null && <span>Bocal &lt; <b>{s.seuil_bocal_g} g</b></span>}
                    {s.seuil_bocal_pct != null && <span>Bocal &lt; <b>{s.seuil_bocal_pct}%</b></span>}
                    {s.seuil_total_g != null && <span>Total &lt; <b>{s.seuil_total_g} g</b></span>}
                    {!s.seuil_bocal_g && !s.seuil_bocal_pct && !s.seuil_total_g && <span className="italic">Aucun seuil défini</span>}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => startEdit(s)} className="p-1.5 text-gray-400 hover:text-grow-600 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg">
                    <Pencil size={14} />
                  </button>
                  <button onClick={() => deleteMut.mutate(s.type_stock)} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

function SeuilFormFields({ form, onChange }: { form: SeuilUpsert; onChange: (f: SeuilUpsert) => void }) {
  const num = (v: number | null | undefined) => v == null ? '' : String(v)
  const parse = (s: string) => s === '' ? null : parseFloat(s)

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <div>
        <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">Seuil bocal (g)</label>
        <input type="number" min="0" step="0.1" placeholder="ex. 10"
          value={num(form.seuil_bocal_g)}
          onChange={e => onChange({ ...form, seuil_bocal_g: parse(e.target.value) })}
          className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-1.5 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
        />
        <p className="text-xs text-gray-400 mt-0.5">Alerte si le bocal contient moins de X grammes</p>
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">Seuil bocal (%)</label>
        <input type="number" min="0" max="100" step="1" placeholder="ex. 10"
          value={num(form.seuil_bocal_pct)}
          onChange={e => onChange({ ...form, seuil_bocal_pct: parse(e.target.value) })}
          className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-1.5 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
        />
        <p className="text-xs text-gray-400 mt-0.5">Alerte si il reste moins de X% du stock initial</p>
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">Seuil total (g)</label>
        <input type="number" min="0" step="1" placeholder="ex. 100"
          value={num(form.seuil_total_g)}
          onChange={e => onChange({ ...form, seuil_total_g: parse(e.target.value) })}
          className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-1.5 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
        />
        <p className="text-xs text-gray-400 mt-0.5">Alerte si le total du type est sous ce seuil</p>
      </div>
      <div className="flex items-center gap-2 pt-4">
        <label className="relative inline-flex items-center cursor-pointer">
          <input type="checkbox" checked={form.actif} onChange={e => onChange({ ...form, actif: e.target.checked })}
            className="sr-only peer" />
          <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-700
                          peer-checked:after:translate-x-full peer-checked:after:border-white
                          after:content-[''] after:absolute after:top-[2px] after:left-[2px]
                          after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4
                          after:transition-all peer-checked:bg-grow-600" />
          <span className="ml-2 text-sm text-gray-700 dark:text-gray-200">Alertes actives</span>
        </label>
      </div>
    </div>
  )
}


// ── Page ──────────────────────────────────────────────────────────────────────
type TabId = 'general' | 'backup' | 'capteurs' | 'alertes'

export default function ParametragePage() {
  const [activeTab, setActiveTab] = useState<TabId>('general')

  const tabs: { id: TabId; label: string }[] = [
    { id: 'general',  label: 'Général' },
    { id: 'backup',   label: 'Sauvegarde et restaurations' },
    { id: 'capteurs', label: 'Capteurs' },
    { id: 'alertes',  label: '⚠ Alertes Stock' },
  ]

  return (
    <div className="space-y-6 max-w-4xl">

      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2.5 bg-gray-100 dark:bg-gray-700 rounded-xl">
          <Settings size={22} className="text-gray-600 dark:text-gray-300" />
        </div>
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Paramétrage</h1>
          <p className="text-sm text-gray-400 dark:text-gray-500 mt-0.5">
            Gérez les valeurs des listes déroulantes utilisées dans toute l’application
          </p>
        </div>
      </div>

      {/* Tabs nav */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="flex gap-1" aria-label="Tabs">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={[
                'px-4 py-2.5 text-sm font-medium rounded-t-lg transition-colors border-b-2 -mb-px',
                activeTab === tab.id
                  ? 'border-grow-600 text-grow-600 dark:text-grow-400 dark:border-grow-400'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:border-gray-300 dark:hover:border-gray-600',
              ].join(' ')}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab — Général */}
      {activeTab === 'general' && (
        <div className="space-y-8">
          {/* Économique — prix kWh, devise */}
          <AppSettingsSection />

          {/* Listes déroulantes */}
          {SECTIONS.map(section => (
            <div key={section.titre} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50">
                <h2 className="text-base font-semibold text-gray-800 dark:text-gray-100">{section.titre}</h2>
              </div>
              <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                {section.listes.map(l => (
                  <ListeEditor key={l.nom} listeNom={l.nom} label={l.label} />
                ))}
              </div>
            </div>
          ))}

          {/* Breeders & Variétés */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50">
              <h2 className="text-base font-semibold text-gray-800 dark:text-gray-100">Génétique</h2>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Gérez vos breeders et vos variétés</p>
            </div>
            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
              <BreedersEditor />
              <VarietesEditor />
            </div>
          </div>
        </div>
      )}

      {/* Tab — Sauvegarde et restaurations */}
      {activeTab === 'backup' && (
        <div className="space-y-8">
          <BackupSection />
        </div>
      )}

      {/* Tab — Capteurs */}
      {activeTab === 'capteurs' && (
        <div className="space-y-8">
          <GoveeSection />
        </div>
      )}

      {/* Tab — Alertes Stock */}
      {activeTab === 'alertes' && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50">
            <h2 className="text-base font-semibold text-gray-800 dark:text-gray-100">Alertes Stock</h2>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
              Seuils d’alerte par type de stock — apparaissent sur le dashboard et en haut de la page Stock
            </p>
          </div>
          <div className="p-6">
            <StockAlertSeuilsSection />
          </div>
        </div>
      )}

    </div>
  )
}
