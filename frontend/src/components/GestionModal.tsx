import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { X, Pencil, Trash2, Check, XCircle, ExternalLink, Loader2, AlertTriangle, Plus, ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react'
import { breederAPI, Breeder } from '../api/breeders'
import { varieteAPI, Variete } from '../api/varietes'

interface GestionModalProps {
  defaultTab?: 'breeders' | 'varietes'
  onClose: () => void
}

type Tab = 'breeders' | 'varietes'

// ---- Ligne Breeder ----
function BreederRow({ breeder, onSaved, onDeleted }: {
  breeder: Breeder
  onSaved: () => void
  onDeleted: () => void
}) {
  const [editing, setEditing] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [form, setForm] = useState({
    nom_breeder: breeder.nom_breeder,
    origine_breeder: breeder.origine_breeder || '',
    information_breeder: breeder.information_breeder || '',
  })

  const update = useMutation({
    mutationFn: () => breederAPI.update(breeder.id_breeder, form),
    onSuccess: () => { setEditing(false); onSaved() },
  })

  const remove = useMutation({
    mutationFn: () => breederAPI.delete(breeder.id_breeder),
    onSuccess: () => onDeleted(),
    onError: () => setConfirmDelete(false),
  })

  if (editing) {
    return (
      <tr className="bg-grow-50">
        <td className="px-4 py-2">
          <input
            autoFocus
            value={form.nom_breeder}
            onChange={e => setForm(f => ({ ...f, nom_breeder: e.target.value }))}
            className="w-full px-2 py-1 border border-grow-400 rounded text-sm focus:outline-none focus:ring-1 focus:ring-grow-600"
          />
        </td>
        <td className="px-4 py-2">
          <input
            value={form.origine_breeder}
            onChange={e => setForm(f => ({ ...f, origine_breeder: e.target.value }))}
            className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded text-sm focus:outline-none focus:ring-1 focus:ring-grow-600"
            placeholder="Pays / origine"
          />
        </td>
        <td className="px-4 py-2">
          <input
            value={form.information_breeder}
            onChange={e => setForm(f => ({ ...f, information_breeder: e.target.value }))}
            className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded text-sm focus:outline-none focus:ring-1 focus:ring-grow-600"
            placeholder="Notes"
          />
        </td>
        <td className="px-4 py-2 text-right">
          <div className="flex justify-end gap-1">
            <button
              onClick={() => update.mutate()}
              disabled={update.isPending || !form.nom_breeder}
              className="p-1.5 bg-grow-600 text-white rounded hover:bg-grow-700 disabled:opacity-50"
            >
              {update.isPending ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
            </button>
            <button
              onClick={() => setEditing(false)}
              className="p-1.5 border border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400 dark:text-gray-500 rounded hover:bg-gray-50 dark:hover:bg-gray-700/40"
            >
              <XCircle size={14} />
            </button>
          </div>
        </td>
      </tr>
    )
  }

  if (confirmDelete) {
    return (
      <tr className="bg-red-50">
        <td colSpan={3} className="px-4 py-2 text-sm text-red-700">
          <span className="flex items-center gap-2">
            <AlertTriangle size={14} />
            Supprimer <strong>{breeder.nom_breeder}</strong> ? Cette action est irréversible.
            {remove.isError && <span className="text-red-600 ml-2">Impossible (graines associées)</span>}
          </span>
        </td>
        <td className="px-4 py-2 text-right">
          <div className="flex justify-end gap-1">
            <button
              onClick={() => remove.mutate()}
              disabled={remove.isPending}
              className="px-3 py-1 bg-red-600 text-white text-xs rounded hover:bg-red-700 disabled:opacity-50"
            >
              {remove.isPending ? <Loader2 size={12} className="animate-spin" /> : 'Confirmer'}
            </button>
            <button
              onClick={() => setConfirmDelete(false)}
              className="px-3 py-1 border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 text-xs rounded hover:bg-gray-50 dark:hover:bg-gray-700/40"
            >
              Annuler
            </button>
          </div>
        </td>
      </tr>
    )
  }

  const isUrl = (val?: string) => !!val && /^https?:\/\//i.test(val)

  return (
    <tr className="hover:bg-gray-50 dark:hover:bg-gray-700/40 group">
      <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-gray-100">{breeder.nom_breeder}</td>
      <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500">{breeder.origine_breeder || '—'}</td>
      <td className="px-4 py-3 text-sm max-w-[200px] truncate">
        {isUrl(breeder.information_breeder) ? (
          <a
            href={breeder.information_breeder}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-grow-600 hover:underline"
            onClick={e => e.stopPropagation()}
          >
            <ExternalLink size={12} className="shrink-0" />
            <span className="truncate">{breeder.information_breeder!.replace(/^https?:\/\//, '')}</span>
          </a>
        ) : (
          <span className="text-gray-500 dark:text-gray-400 dark:text-gray-500">{breeder.information_breeder || '—'}</span>
        )}
      </td>
      <td className="px-4 py-3 text-right">
        <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={() => setEditing(true)}
            className="p-1.5 text-gray-400 dark:text-gray-500 hover:text-grow-600 hover:bg-grow-50 rounded"
          >
            <Pencil size={14} />
          </button>
          <button
            onClick={() => setConfirmDelete(true)}
            className="p-1.5 text-gray-400 dark:text-gray-500 hover:text-red-600 hover:bg-red-50 rounded"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </td>
    </tr>
  )
}

// ---- Ligne Variete ----
function VarieteRow({ variete, onSaved, onDeleted }: {
  variete: Variete
  onSaved: () => void
  onDeleted: () => void
}) {
  const [editing, setEditing] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [form, setForm] = useState({
    nom_variete: variete.nom_variete,
    croisement_variete: variete.croisement_variete || '',
    informations_variete: variete.informations_variete || '',
    lien_web: variete.lien_web || '',
  })

  const update = useMutation({
    mutationFn: () => varieteAPI.update(variete.id_variete, form),
    onSuccess: () => { setEditing(false); onSaved() },
  })

  const remove = useMutation({
    mutationFn: () => varieteAPI.delete(variete.id_variete),
    onSuccess: () => onDeleted(),
    onError: () => setConfirmDelete(false),
  })

  if (editing) {
    return (
      <tr className="bg-grow-50">
        <td className="px-4 py-2">
          <input
            autoFocus
            value={form.nom_variete}
            onChange={e => setForm(f => ({ ...f, nom_variete: e.target.value }))}
            className="w-full px-2 py-1 border border-grow-400 rounded text-sm focus:outline-none focus:ring-1 focus:ring-grow-600"
          />
        </td>
        <td className="px-4 py-2">
          <input
            value={form.croisement_variete}
            onChange={e => setForm(f => ({ ...f, croisement_variete: e.target.value }))}
            className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded text-sm focus:outline-none focus:ring-1 focus:ring-grow-600"
            placeholder="ex: OG Kush × Durban"
          />
        </td>
        <td className="px-4 py-2">
          <input
            value={form.lien_web}
            onChange={e => setForm(f => ({ ...f, lien_web: e.target.value }))}
            className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded text-sm focus:outline-none focus:ring-1 focus:ring-grow-600"
            placeholder="https://en.seedfinder.eu/..."
          />
        </td>
        <td className="px-4 py-2">
          <input
            value={form.informations_variete}
            onChange={e => setForm(f => ({ ...f, informations_variete: e.target.value }))}
            className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded text-sm focus:outline-none focus:ring-1 focus:ring-grow-600"
            placeholder="Notes..."
          />
        </td>
        <td className="px-4 py-2 text-right">
          <div className="flex justify-end gap-1">
            <button
              onClick={() => update.mutate()}
              disabled={update.isPending || !form.nom_variete}
              className="p-1.5 bg-grow-600 text-white rounded hover:bg-grow-700 disabled:opacity-50"
            >
              {update.isPending ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
            </button>
            <button
              onClick={() => setEditing(false)}
              className="p-1.5 border border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400 dark:text-gray-500 rounded hover:bg-gray-50 dark:hover:bg-gray-700/40"
            >
              <XCircle size={14} />
            </button>
          </div>
        </td>
      </tr>
    )
  }

  if (confirmDelete) {
    return (
      <tr className="bg-red-50">
        <td colSpan={4} className="px-4 py-2 text-sm text-red-700">
          <span className="flex items-center gap-2">
            <AlertTriangle size={14} />
            Supprimer <strong>{variete.nom_variete}</strong> ?
            {remove.isError && <span className="text-red-600 ml-2">Impossible (graines associées)</span>}
          </span>
        </td>
        <td className="px-4 py-2 text-right">
          <div className="flex justify-end gap-1">
            <button
              onClick={() => remove.mutate()}
              disabled={remove.isPending}
              className="px-3 py-1 bg-red-600 text-white text-xs rounded hover:bg-red-700 disabled:opacity-50"
            >
              {remove.isPending ? <Loader2 size={12} className="animate-spin" /> : 'Confirmer'}
            </button>
            <button
              onClick={() => setConfirmDelete(false)}
              className="px-3 py-1 border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 text-xs rounded hover:bg-gray-50 dark:hover:bg-gray-700/40"
            >
              Annuler
            </button>
          </div>
        </td>
      </tr>
    )
  }

  return (
    <tr className="hover:bg-gray-50 dark:hover:bg-gray-700/40 group">
      <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-gray-100">{variete.nom_variete}</td>
      <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500 italic">{variete.croisement_variete || '—'}</td>
      <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500">
        {variete.lien_web ? (
          <a
            href={variete.lien_web}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-grow-600 hover:underline"
            onClick={e => e.stopPropagation()}
          >
            <ExternalLink size={12} />
            <span className="max-w-[140px] truncate">{variete.lien_web.replace(/^https?:\/\//, '')}</span>
          </a>
        ) : '—'}
      </td>
      <td className="px-4 py-3 text-sm text-gray-400 dark:text-gray-500 max-w-[160px] truncate">
        {variete.informations_variete || '—'}
      </td>
      <td className="px-4 py-3 text-right">
        <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={() => setEditing(true)}
            className="p-1.5 text-gray-400 dark:text-gray-500 hover:text-grow-600 hover:bg-grow-50 rounded"
          >
            <Pencil size={14} />
          </button>
          <button
            onClick={() => setConfirmDelete(true)}
            className="p-1.5 text-gray-400 dark:text-gray-500 hover:text-red-600 hover:bg-red-50 rounded"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </td>
    </tr>
  )
}

// ---- Ligne d'ajout Breeder ----
function AddBreederRow({ onAdded }: { onAdded: () => void }) {
  const [form, setForm] = useState({ nom_breeder: '', origine_breeder: '', information_breeder: '' })

  const add = useMutation({
    mutationFn: () => breederAPI.create(form),
    onSuccess: () => {
      setForm({ nom_breeder: '', origine_breeder: '', information_breeder: '' })
      onAdded()
    },
  })

  return (
    <tr className="bg-grow-50 border-t-2 border-grow-200">
      <td className="px-4 py-2">
        <input
          autoFocus
          value={form.nom_breeder}
          onChange={e => setForm(f => ({ ...f, nom_breeder: e.target.value }))}
          placeholder="Nom du breeder *"
          onKeyDown={e => e.key === 'Enter' && form.nom_breeder && add.mutate()}
          className="w-full px-2 py-1 border border-grow-400 rounded text-sm focus:outline-none focus:ring-1 focus:ring-grow-600"
        />
      </td>
      <td className="px-4 py-2">
        <input
          value={form.origine_breeder}
          onChange={e => setForm(f => ({ ...f, origine_breeder: e.target.value }))}
          placeholder="Pays / origine"
          className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded text-sm focus:outline-none focus:ring-1 focus:ring-grow-600"
        />
      </td>
      <td className="px-4 py-2">
        <input
          value={form.information_breeder}
          onChange={e => setForm(f => ({ ...f, information_breeder: e.target.value }))}
          placeholder="Notes"
          className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded text-sm focus:outline-none focus:ring-1 focus:ring-grow-600"
        />
      </td>
      <td className="px-4 py-2 text-right">
        <button
          onClick={() => form.nom_breeder && add.mutate()}
          disabled={add.isPending || !form.nom_breeder}
          className="p-1.5 bg-grow-600 text-white rounded hover:bg-grow-700 disabled:opacity-50"
        >
          {add.isPending ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
        </button>
      </td>
    </tr>
  )
}

// ---- Ligne d'ajout Variete ----
function AddVarieteRow({ onAdded }: { onAdded: () => void }) {
  const [form, setForm] = useState({ nom_variete: '', croisement_variete: '', lien_web: '', informations_variete: '' })

  const add = useMutation({
    mutationFn: () => varieteAPI.create(form),
    onSuccess: () => {
      setForm({ nom_variete: '', croisement_variete: '', lien_web: '', informations_variete: '' })
      onAdded()
    },
  })

  return (
    <tr className="bg-grow-50 border-t-2 border-grow-200">
      <td className="px-4 py-2">
        <input
          autoFocus
          value={form.nom_variete}
          onChange={e => setForm(f => ({ ...f, nom_variete: e.target.value }))}
          placeholder="Nom de la variété *"
          onKeyDown={e => e.key === 'Enter' && form.nom_variete && add.mutate()}
          className="w-full px-2 py-1 border border-grow-400 rounded text-sm focus:outline-none focus:ring-1 focus:ring-grow-600"
        />
      </td>
      <td className="px-4 py-2">
        <input
          value={form.croisement_variete}
          onChange={e => setForm(f => ({ ...f, croisement_variete: e.target.value }))}
          placeholder="ex: OG Kush × Durban"
          className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded text-sm focus:outline-none focus:ring-1 focus:ring-grow-600"
        />
      </td>
      <td className="px-4 py-2">
        <input
          value={form.lien_web}
          onChange={e => setForm(f => ({ ...f, lien_web: e.target.value }))}
          placeholder="https://en.seedfinder.eu/..."
          className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded text-sm focus:outline-none focus:ring-1 focus:ring-grow-600"
        />
      </td>
      <td className="px-4 py-2">
        <input
          value={form.informations_variete}
          onChange={e => setForm(f => ({ ...f, informations_variete: e.target.value }))}
          placeholder="Notes..."
          className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded text-sm focus:outline-none focus:ring-1 focus:ring-grow-600"
        />
      </td>
      <td className="px-4 py-2 text-right">
        <button
          onClick={() => form.nom_variete && add.mutate()}
          disabled={add.isPending || !form.nom_variete}
          className="p-1.5 bg-grow-600 text-white rounded hover:bg-grow-700 disabled:opacity-50"
        >
          {add.isPending ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
        </button>
      </td>
    </tr>
  )
}

// ---- Types de tri ----
type SortDir = 'asc' | 'desc'
type BreederSortCol = 'nom' | 'origine' | 'info'
type VarieteSortCol = 'nom' | 'croisement' | 'lien' | 'notes'

function GestionSortIcon({ active, dir }: { active: boolean; dir: SortDir }) {
  if (!active) return <ChevronsUpDown size={11} className="ml-1 text-gray-300 inline" />
  return dir === 'asc'
    ? <ChevronUp size={11} className="ml-1 text-grow-600 inline" />
    : <ChevronDown size={11} className="ml-1 text-grow-600 inline" />
}

// ---- Modal principal ----
export default function GestionModal({ defaultTab = 'breeders', onClose }: GestionModalProps) {
  const [tab, setTab] = useState<Tab>(defaultTab)
  const [showAddBreeder, setShowAddBreeder] = useState(false)
  const [showAddVariete, setShowAddVariete] = useState(false)
  const queryClient = useQueryClient()

  const [bSortCol, setBSortCol] = useState<BreederSortCol | null>(null)
  const [bSortDir, setBSortDir] = useState<SortDir>('asc')
  const [vSortCol, setVSortCol] = useState<VarieteSortCol | null>(null)
  const [vSortDir, setVSortDir] = useState<SortDir>('asc')

  const handleBSort = (col: BreederSortCol) => {
    if (bSortCol === col) setBSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setBSortCol(col); setBSortDir('asc') }
  }
  const handleVSort = (col: VarieteSortCol) => {
    if (vSortCol === col) setVSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setVSortCol(col); setVSortDir('asc') }
  }

  const { data: breeders = [], isLoading: loadingB } = useQuery<Breeder[]>({
    queryKey: ['breeders'],
    queryFn: async () => (await breederAPI.getAll()).data,
  })

  const { data: varietes = [], isLoading: loadingV } = useQuery<Variete[]>({
    queryKey: ['varietes'],
    queryFn: async () => (await varieteAPI.getAll()).data,
  })

  const sortedBreeders = useMemo(() => {
    if (!bSortCol) return breeders
    return [...breeders].sort((a, b) => {
      let av: string, bv: string
      switch (bSortCol) {
        case 'nom':    av = a.nom_breeder;                 bv = b.nom_breeder;                 break
        case 'origine': av = a.origine_breeder || '';      bv = b.origine_breeder || '';       break
        case 'info':   av = a.information_breeder || '';   bv = b.information_breeder || '';   break
        default: return 0
      }
      return bSortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av)
    })
  }, [breeders, bSortCol, bSortDir])

  const sortedVarietes = useMemo(() => {
    if (!vSortCol) return varietes
    return [...varietes].sort((a, b) => {
      let av: string, bv: string
      switch (vSortCol) {
        case 'nom':        av = a.nom_variete;                    bv = b.nom_variete;                    break
        case 'croisement': av = a.croisement_variete || '';       bv = b.croisement_variete || '';       break
        case 'lien':       av = a.lien_web || '';                 bv = b.lien_web || '';                 break
        case 'notes':      av = a.informations_variete || '';     bv = b.informations_variete || '';     break
        default: return 0
      }
      return vSortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av)
    })
  }, [varietes, vSortCol, vSortDir])

  const refreshBreeders = () => queryClient.invalidateQueries({ queryKey: ['breeders'] })
  const refreshVarietes = () => {
    queryClient.invalidateQueries({ queryKey: ['varietes'] })
    queryClient.invalidateQueries({ queryKey: ['catalogue'] })
  }

  const tabs: { key: Tab; label: string; count: number }[] = [
    { key: 'breeders', label: 'Breeders', count: breeders.length },
    { key: 'varietes', label: 'Variétés', count: varietes.length },
  ]

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-4xl max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-700 shrink-0">
          <div className="flex items-center gap-6">
            <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">Gestion</h2>
            <div className="flex gap-1">
              {tabs.map(t => (
                <button
                  key={t.key}
                  onClick={() => { setTab(t.key); setShowAddBreeder(false); setShowAddVariete(false) }}
                  className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                    tab === t.key
                      ? 'bg-grow-600 text-white'
                      : 'text-gray-500 dark:text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                >
                  {t.label}
                  <span className={`ml-1.5 text-xs ${tab === t.key ? 'text-grow-100' : 'text-gray-400 dark:text-gray-500'}`}>
                    {t.count}
                  </span>
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-3">
            {tab === 'breeders' && (
              <button
                onClick={() => setShowAddBreeder(v => !v)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  showAddBreeder
                    ? 'bg-gray-100 text-gray-600 dark:text-gray-300'
                    : 'bg-grow-600 text-white hover:bg-grow-700'
                }`}
              >
                <Plus size={15} />
                {showAddBreeder ? 'Annuler' : 'Ajouter'}
              </button>
            )}
            {tab === 'varietes' && (
              <button
                onClick={() => setShowAddVariete(v => !v)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  showAddVariete
                    ? 'bg-gray-100 text-gray-600 dark:text-gray-300'
                    : 'bg-grow-600 text-white hover:bg-grow-700'
                }`}
              >
                <Plus size={15} />
                {showAddVariete ? 'Annuler' : 'Ajouter'}
              </button>
            )}
            <button onClick={onClose} className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:text-gray-300">
              <X size={22} />
            </button>
          </div>
        </div>

        {/* Contenu scrollable */}
        <div className="overflow-y-auto flex-1">
          {tab === 'breeders' && (
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-700/50 sticky top-0">
                <tr>
                  {([
                    ['nom',     'Nom'],
                    ['origine', 'Origine'],
                    ['info',    'Info'],
                  ] as [BreederSortCol, string][]).map(([col, label]) => (
                    <th
                      key={col}
                      onClick={() => handleBSort(col)}
                      className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 dark:text-gray-500 uppercase cursor-pointer select-none hover:bg-gray-100 dark:hover:bg-gray-700 whitespace-nowrap"
                    >
                      {label}<GestionSortIcon active={bSortCol === col} dir={bSortDir} />
                    </th>
                  ))}
                  <th className="px-4 py-3 w-20"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {showAddBreeder && (
                  <AddBreederRow onAdded={() => { refreshBreeders(); setShowAddBreeder(false) }} />
                )}
                {loadingB ? (
                  <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-400 dark:text-gray-500 text-sm">Chargement...</td></tr>
                ) : sortedBreeders.length === 0 && !showAddBreeder ? (
                  <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-400 dark:text-gray-500 text-sm">Aucun breeder — cliquez sur "Ajouter"</td></tr>
                ) : (
                  sortedBreeders.map(b => (
                    <BreederRow
                      key={b.id_breeder}
                      breeder={b}
                      onSaved={refreshBreeders}
                      onDeleted={refreshBreeders}
                    />
                  ))
                )}
              </tbody>
            </table>
          )}

          {tab === 'varietes' && (
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-700/50 sticky top-0">
                <tr>
                  {([
                    ['nom',        'Nom'],
                    ['croisement', 'Croisement'],
                    ['lien',       'Lien Seedfinder'],
                    ['notes',      'Notes'],
                  ] as [VarieteSortCol, string][]).map(([col, label]) => (
                    <th
                      key={col}
                      onClick={() => handleVSort(col)}
                      className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 dark:text-gray-500 uppercase cursor-pointer select-none hover:bg-gray-100 dark:hover:bg-gray-700 whitespace-nowrap"
                    >
                      {label}<GestionSortIcon active={vSortCol === col} dir={vSortDir} />
                    </th>
                  ))}
                  <th className="px-4 py-3 w-20"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {showAddVariete && (
                  <AddVarieteRow onAdded={() => { refreshVarietes(); setShowAddVariete(false) }} />
                )}
                {loadingV ? (
                  <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400 dark:text-gray-500 text-sm">Chargement...</td></tr>
                ) : sortedVarietes.length === 0 && !showAddVariete ? (
                  <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400 dark:text-gray-500 text-sm">Aucune variété — cliquez sur "Ajouter"</td></tr>
                ) : (
                  sortedVarietes.map(v => (
                    <VarieteRow
                      key={v.id_variete}
                      variete={v}
                      onSaved={refreshVarietes}
                      onDeleted={refreshVarietes}
                    />
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>

        <div className="px-6 py-3 border-t border-gray-100 dark:border-gray-700 text-xs text-gray-400 dark:text-gray-500 shrink-0">
          Survolez une ligne pour faire apparaître les actions · Suppression impossible si des graines sont associées
        </div>
      </div>
    </div>
  )
}
