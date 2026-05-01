import { useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Plus, ArrowUpDown, Pencil, Trash2, Loader2, AlertTriangle,
  ChevronDown, ChevronRight, Wrench, Euro, Hash, Tag, Wind,
  Thermometer, Battery, Zap, Droplets, Package,
} from 'lucide-react'
import { materielAPI, CATEGORIES } from '../api/materiel'
import type { Materiel } from '../api/materiel'
import { vaporisateurAPI } from '../api/vaporisateur'
import type { Vaporisateur } from '../api/vaporisateur'
import NouveauMaterielModal from '../components/NouveauMaterielModal'
import NouveauVapoModal from '../components/NouveauVapoModal'
import ImportExportModal from '../components/ImportExportModal'
import LoadingSpinner from '../components/LoadingSpinner'
import EmptyState from '../components/EmptyState'

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtDate(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('fr-FR')
}
function fmtAge(days: number | null) {
  if (days == null) return '—'
  if (days < 30)  return `${days} j`
  if (days < 365) return `${Math.floor(days / 30)} mois`
  const y = Math.floor(days / 365)
  const m = Math.floor((days % 365) / 30)
  return `${y} an${y > 1 ? 's' : ''}${m > 0 ? ` ${m} mois` : ''}`
}

function formatCaract(c: Record<string, unknown> | null, categorie: string): string {
  if (!c) return ''
  const parts: string[] = []

  // Bocaux — affichage spécifique
  if (categorie === 'Bocaux') {
    const volMl = c.volume_ml as number | null
    if (volMl != null) parts.push(volMl >= 1000 ? `${volMl / 1000} L` : `${volMl} mL`)
    if (c.fermeture)   parts.push(String(c.fermeture))
    if (c.couleur)     parts.push(String(c.couleur))
    if (c.usage)       parts.push(String(c.usage))
    return parts.join(' · ')
  }

  if (c.type)        parts.push(String(c.type))
  if (c.puissance_w) parts.push(`${c.puissance_w} W`)
  if (c.volume_l)    parts.push(`${c.volume_l} L`)
  if (c.matiere)     parts.push(String(c.matiere))
  if (c.dimensions)  parts.push(String(c.dimensions))
  if (c.debit_lh)    parts.push(`${c.debit_lh} L/h`)
  if (c.debit_m3h)   parts.push(`${c.debit_m3h} m³/h`)
  if (c.diametre_mm) parts.push(`⌀${c.diametre_mm} mm`)
  if (c.maille_mm)   parts.push(`maille ${c.maille_mm} mm`)
  if (c.capacite)    parts.push(String(c.capacite))
  if (c.dimmer === true) parts.push('Dimmer')
  if (Array.isArray(c.spectres) && c.spectres.length)
    parts.push(c.spectres.join(' + '))
  return parts.join(' · ')
}

const ETAT_COLORS: Record<string, string> = {
  'Neuf':         'bg-green-100  text-green-700',
  'Bon état':     'bg-blue-100   text-blue-700',
  'Usagé':        'bg-amber-100  text-amber-700',
  'Hors service': 'bg-red-100    text-red-700',
}

const CAT_ICONS: Record<string, string> = {
  'Bocaux':           '🫙',
  'Lampes':           '💡',
  'Pots':             '🪴',
  'Coupelles et bacs':'🥣',
  'Arrosage':         '💧',
  'Tentes':           '⛺',
  'Pompes et Bulleurs':'⚙️',
  'Ventilation':      '🌀',
  'Filets':           '🕸️',
  'Séchage':          '🌿',
  'Outils':           '🔧',
}

// ── Ligne d'item ─────────────────────────────────────────────────────────────
function ItemRow({
  item, onEdit, onDeleted,
}: {
  item: Materiel
  onEdit: () => void
  onDeleted: () => void
}) {
  const [confirm, setConfirm] = useState(false)
  const qc = useQueryClient()
  const remove = useMutation({
    mutationFn: () => materielAPI.delete(item.id_materiel),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['materiel'] }); onDeleted() },
    onError: () => setConfirm(false),
  })

  if (confirm) return (
    <tr className="bg-red-50">
      <td colSpan={9} className="px-3 py-2 text-sm text-red-700">
        <span className="flex items-center gap-2">
          <AlertTriangle size={13} />
          Supprimer «&nbsp;{item.nom}&nbsp;» ?
        </span>
      </td>
      <td className="px-3 py-2 text-right">
        <div className="flex justify-end gap-2">
          <button onClick={() => remove.mutate()} disabled={remove.isPending}
            className="px-2 py-1 bg-red-600 text-white text-xs rounded hover:bg-red-700 disabled:opacity-50">
            {remove.isPending ? <Loader2 size={10} className="animate-spin" /> : 'Confirmer'}
          </button>
          <button onClick={() => setConfirm(false)}
            className="px-2 py-1 border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 text-xs rounded hover:bg-gray-50 dark:hover:bg-gray-700/40">
            Annuler
          </button>
        </div>
      </td>
    </tr>
  )

  const caract = formatCaract(item.caracteristiques as Record<string, unknown> | null, item.categorie)

  return (
    <tr className="hover:bg-gray-50 dark:hover:bg-gray-700/40 group">
      <td className="px-3 py-2.5 text-xs text-gray-400 dark:text-gray-500 font-mono">#{item.id_materiel}</td>
      <td className="px-3 py-2.5 text-sm font-medium text-gray-900 dark:text-gray-100">
        <span className="mr-1">{CAT_ICONS[item.categorie] ?? '📦'}</span>
        {item.nom}
      </td>
      <td className="px-3 py-2.5 text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500">{item.marque || '—'}</td>
      <td className="px-3 py-2.5 text-xs text-gray-400 dark:text-gray-500 font-mono">{item.code_barre_serial || '—'}</td>
      <td className="px-3 py-2.5 text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500 whitespace-nowrap">{fmtDate(item.date_achat)}</td>
      <td className="px-3 py-2.5 text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500 text-right whitespace-nowrap">
        {item.prix_achat != null ? `${Number(item.prix_achat).toFixed(2)} €` : '—'}
      </td>
      <td className="px-3 py-2.5 text-xs text-gray-400 dark:text-gray-500">{fmtAge(item.age_jours)}</td>
      <td className="px-3 py-2.5 text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500 max-w-[200px] truncate" title={caract}>{caract || '—'}</td>
      <td className="px-3 py-2.5">
        {item.etat
          ? <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ETAT_COLORS[item.etat] ?? 'bg-gray-100 text-gray-600 dark:text-gray-300'}`}>{item.etat}</span>
          : <span className="text-xs text-gray-300">—</span>
        }
      </td>
      <td className="px-3 py-2.5 text-right">
        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={onEdit}
            className="p-1.5 text-gray-400 dark:text-gray-500 hover:text-grow-600 hover:bg-grow-50 rounded"
            title="Modifier"><Pencil size={13} /></button>
          <button onClick={() => setConfirm(true)}
            className="p-1.5 text-gray-400 dark:text-gray-500 hover:text-red-500 hover:bg-red-50 rounded"
            title="Supprimer"><Trash2 size={13} /></button>
        </div>
      </td>
    </tr>
  )
}

// ── Groupe de catégorie (vue groupée) ─────────────────────────────────────────
function GroupRow({
  nom, marque, categorie, count, avgPrix, items, onEdit, onDeleted,
}: {
  nom: string; marque: string | null; categorie: string; count: number
  avgPrix: number | null; items: Materiel[]
  onEdit: (item: Materiel) => void; onDeleted: () => void
}) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <tr className="bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer" onClick={() => setOpen(o => !o)}>
        <td className="px-3 py-2.5 text-xs text-gray-400 dark:text-gray-500 font-mono w-8">
          {open ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
        </td>
        <td className="px-3 py-2.5 text-sm font-semibold text-gray-800 dark:text-gray-100">
          <span className="mr-1">{CAT_ICONS[categorie] ?? '📦'}</span>
          {nom}
        </td>
        <td className="px-3 py-2.5 text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500">{marque || '—'}</td>
        <td className="px-3 py-2.5">
          <span className="inline-flex items-center gap-1 bg-grow-100 text-grow-700 text-xs font-semibold px-2 py-0.5 rounded-full">
            <Hash size={10} /> {count}
          </span>
        </td>
        <td className="px-3 py-2.5 text-xs text-gray-400 dark:text-gray-500" colSpan={2}>
          {avgPrix != null ? `moy. ${avgPrix.toFixed(2)} €` : '—'}
        </td>
        <td colSpan={4} />
      </tr>
      {open && items.map(item => (
        <tr key={item.id_materiel} className="hover:bg-blue-50 group bg-white dark:bg-gray-800 border-l-4 border-blue-100">
          <td className="px-3 py-2 text-xs text-gray-300 font-mono pl-8">#{item.id_materiel}</td>
          <td className="px-3 py-2 text-xs text-gray-600 dark:text-gray-300 pl-6">
            S/N: {item.code_barre_serial || '—'}
          </td>
          <td className="px-3 py-2 text-xs text-gray-400 dark:text-gray-500">{fmtDate(item.date_achat)}</td>
          <td className="px-3 py-2 text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500 text-right">
            {item.prix_achat != null ? `${Number(item.prix_achat).toFixed(2)} €` : '—'}
          </td>
          <td className="px-3 py-2 text-xs text-gray-400 dark:text-gray-500">{fmtAge(item.age_jours)}</td>
          <td className="px-3 py-2 text-xs text-gray-400 dark:text-gray-500 max-w-[180px] truncate"
              title={formatCaract(item.caracteristiques as Record<string, unknown> | null, item.categorie)}>
            {formatCaract(item.caracteristiques as Record<string, unknown> | null, item.categorie) || '—'}
          </td>
          <td className="px-3 py-2">
            {item.etat
              ? <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ETAT_COLORS[item.etat] ?? 'bg-gray-100 text-gray-600 dark:text-gray-300'}`}>{item.etat}</span>
              : null}
          </td>
          <td className="px-3 py-2 text-right" colSpan={2}>
            <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button onClick={() => onEdit(item)}
                className="p-1 text-gray-400 dark:text-gray-500 hover:text-grow-600 hover:bg-grow-50 rounded"><Pencil size={12} /></button>
              <button onClick={() => {
                materielAPI.delete(item.id_materiel).then(onDeleted)
              }} className="p-1 text-gray-400 dark:text-gray-500 hover:text-red-500 hover:bg-red-50 rounded"><Trash2 size={12} /></button>
            </div>
          </td>
        </tr>
      ))}
    </>
  )
}

// ── Vaporisateurs ─────────────────────────────────────────────────────────────

const COMPAT_LABELS: Record<string, string> = {
  fleurs_sechees: 'Fleurs séchées',
  resines:        'Résines',
  concentres:     'Concentrés',
}

function VapoCard({
  vapo, onEdit,
}: { vapo: Vaporisateur; onEdit: () => void }) {
  const [confirm, setConfirm] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const qc = useQueryClient()

  const deleteMut = useMutation({
    mutationFn: () => vaporisateurAPI.delete(vapo.id_vaporisateur),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['vaporisateurs'] }),
  })
  const sessionMut = useMutation({
    mutationFn: () => vaporisateurAPI.addSession(vapo.id_vaporisateur),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['vaporisateurs'] }),
  })

  const compats = (vapo.compatibilites ?? '').split(',').filter(Boolean)

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xl">💨</span>
            <h3 className="text-base font-bold text-gray-900 dark:text-gray-100 truncate">{vapo.nom}</h3>
          </div>
          <div className="flex flex-wrap gap-1.5 mt-2">
            {vapo.type_chauffe && (
              <span className="inline-flex items-center gap-1 text-xs bg-orange-50 text-orange-700 px-2 py-0.5 rounded-full">
                <Thermometer size={10} /> {vapo.type_chauffe}
              </span>
            )}
            {vapo.a_eau && (
              <span className="inline-flex items-center gap-1 text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">
                <Droplets size={10} /> À eau
              </span>
            )}
            {vapo.type_batterie && (
              <span className="inline-flex items-center gap-1 text-xs bg-purple-50 text-purple-700 px-2 py-0.5 rounded-full">
                <Battery size={10} /> {vapo.type_batterie}
              </span>
            )}
            {vapo.type_charge && (
              <span className="inline-flex items-center gap-1 text-xs bg-gray-100 text-gray-600 dark:text-gray-300 px-2 py-0.5 rounded-full">
                <Zap size={10} /> {vapo.type_charge}
              </span>
            )}
            {compats.map(k => (
              <span key={k} className="text-xs bg-grow-50 text-grow-700 px-2 py-0.5 rounded-full">
                {COMPAT_LABELS[k] ?? k}
              </span>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button onClick={onEdit}
            className="p-1.5 text-gray-400 dark:text-gray-500 hover:text-grow-600 hover:bg-grow-50 rounded-lg" title="Modifier">
            <Pencil size={13} />
          </button>
          {confirm ? (
            <div className="flex gap-1">
              <button onClick={() => deleteMut.mutate()}
                className="px-2 py-1 bg-red-600 text-white text-xs rounded-lg hover:bg-red-700">
                {deleteMut.isPending ? <Loader2 size={10} className="animate-spin" /> : 'OK'}
              </button>
              <button onClick={() => setConfirm(false)}
                className="px-2 py-1 border text-gray-600 dark:text-gray-300 text-xs rounded-lg">✕</button>
            </div>
          ) : (
            <button onClick={() => setConfirm(true)}
              className="p-1.5 text-gray-400 dark:text-gray-500 hover:text-red-500 hover:bg-red-50 rounded-lg">
              <Trash2 size={13} />
            </button>
          )}
        </div>
      </div>

      {/* Stats rapides */}
      <div className="px-5 pb-3 grid grid-cols-4 gap-2 text-center border-t border-gray-50 dark:border-gray-700">
        <div className="py-2">
          <p className="text-xs text-gray-400 dark:text-gray-500">Sessions</p>
          <p className="text-base font-bold text-gray-800 dark:text-gray-100">{vapo.nbr_sessions ?? 0}</p>
        </div>
        <div className="py-2">
          <p className="text-xs text-gray-400 dark:text-gray-500">Temp.</p>
          <p className="text-base font-bold text-gray-800 dark:text-gray-100">
            {vapo.temp_min && vapo.temp_max ? `${vapo.temp_min}–${vapo.temp_max}°` : '—'}
          </p>
        </div>
        <div className="py-2">
          <p className="text-xs text-gray-400 dark:text-gray-500">Chauffe</p>
          <p className="text-base font-bold text-gray-800 dark:text-gray-100">
            {vapo.temps_chauffe_s ? `${vapo.temps_chauffe_s}s` : '—'}
          </p>
        </div>
        <div className="py-2">
          <p className="text-xs text-gray-400 dark:text-gray-500">Autonomie</p>
          <p className="text-base font-bold text-gray-800 dark:text-gray-100">
            {vapo.autonomie_sessions ? `${vapo.autonomie_sessions} sess.` : vapo.autonomie_mah ? `${vapo.autonomie_mah} mAh` : '—'}
          </p>
        </div>
      </div>

      {/* Footer */}
      <div className="px-5 py-2.5 bg-gray-50 dark:bg-gray-700/50 border-t border-gray-100 dark:border-gray-700 flex items-center justify-between">
        <div className="flex items-center gap-3 text-xs text-gray-400 dark:text-gray-500">
          {vapo.prix_achat != null && <span>{Number(vapo.prix_achat).toFixed(0)} €</span>}
          {vapo.date_achat && <span>{new Date(vapo.date_achat).toLocaleDateString('fr-FR')}</span>}
          {vapo.numero_serie && <span className="font-mono">SN: {vapo.numero_serie}</span>}
          {vapo.consommables.length > 0 && (
            <button onClick={() => setExpanded(e => !e)}
              className="flex items-center gap-1 text-grow-600 hover:text-grow-700 font-medium">
              {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
              {vapo.consommables.length} consommable{vapo.consommables.length > 1 ? 's' : ''}
            </button>
          )}
        </div>
        <button onClick={() => sessionMut.mutate()}
          disabled={sessionMut.isPending}
          className="text-xs px-2.5 py-1 bg-grow-600 text-white rounded-lg hover:bg-grow-700 disabled:opacity-50 flex items-center gap-1.5">
          {sessionMut.isPending ? <Loader2 size={11} className="animate-spin" /> : <Zap size={11} />}
          +1 session
        </button>
      </div>

      {/* Consommables expandables */}
      {expanded && vapo.consommables.length > 0 && (
        <div className="px-5 py-3 border-t border-gray-100 dark:border-gray-700 space-y-1.5">
          {vapo.consommables.map(c => (
            <div key={c.id_consommable} className="flex items-center justify-between text-xs text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-gray-700/50 rounded-lg px-3 py-1.5">
              <span className="font-medium">{c.type_consommable}</span>
              <div className="flex items-center gap-2 text-gray-400 dark:text-gray-500">
                {c.matiere && <span>{c.matiere}</span>}
                {c.diametre_mm && <span>⌀{c.diametre_mm} mm</span>}
                {c.prix_achat != null && <span>{Number(c.prix_achat).toFixed(2)} €</span>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function MaterielPage() {
  const qc = useQueryClient()
  const [activeTab,         setActiveTab]         = useState<'materiel' | 'vaporisateurs'>('materiel')
  const [showModal,         setShowModal]         = useState(false)
  const [showVapoModal,     setShowVapoModal]     = useState(false)
  const [showImportExport,  setShowImportExport]  = useState(false)
  const [editItem,          setEditItem]          = useState<Materiel | null>(null)
  const [editVapo,          setEditVapo]          = useState<Vaporisateur | null>(null)
  const [catFilter,    setCatFilter]    = useState<string>('all')
  const [etatFilter,   setEtatFilter]   = useState<string>('all')
  const [viewMode,     setViewMode]     = useState<'liste' | 'groupe'>('liste')
  const [search,       setSearch]       = useState('')
  const [vapoSearch,   setVapoSearch]   = useState('')

  const { data: items = [], isLoading } = useQuery<Materiel[]>({
    queryKey: ['materiel'],
    queryFn:  async () => (await materielAPI.getAll()).data,
  })

  const { data: vapos = [], isLoading: vaposLoading } = useQuery<Vaporisateur[]>({
    queryKey: ['vaporisateurs'],
    queryFn:  async () => (await vaporisateurAPI.getAll()).data,
  })

  const invalidate = () => qc.invalidateQueries({ queryKey: ['materiel'] })

  // ── Stats globales ─────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const total      = items.length
    const withPrix   = items.filter(i => i.prix_achat != null)
    const valeurTot  = withPrix.reduce((s, i) => s + Number(i.prix_achat), 0)
    const horsService = items.filter(i => i.etat === 'Hors service').length
    const byCat = CATEGORIES.reduce<Record<string, number>>((acc, c) => {
      acc[c] = items.filter(i => i.categorie === c).length
      return acc
    }, {})
    return { total, valeurTot, horsService, byCat }
  }, [items])

  // ── Filtrage ──────────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    return items.filter(i => {
      if (catFilter !== 'all' && i.categorie !== catFilter) return false
      if (etatFilter !== 'all' && (i.etat || '') !== etatFilter) return false
      if (search) {
        const q = search.toLowerCase()
        return (
          i.nom.toLowerCase().includes(q) ||
          (i.marque ?? '').toLowerCase().includes(q) ||
          (i.code_barre_serial ?? '').toLowerCase().includes(q)
        )
      }
      return true
    })
  }, [items, catFilter, etatFilter, search])

  // ── Groupement (vue groupée) ───────────────────────────────────────────────
  const grouped = useMemo(() => {
    const map = new Map<string, Materiel[]>()
    filtered.forEach(item => {
      const key = `${item.categorie}||${item.nom}||${item.marque ?? ''}`
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(item)
    })
    return [...map.entries()].map(([key, its]) => {
      const [categorie, nom, marque] = key.split('||')
      const withPrix = its.filter(i => i.prix_achat != null)
      const avgPrix  = withPrix.length
        ? withPrix.reduce((s, i) => s + Number(i.prix_achat), 0) / withPrix.length
        : null
      return { key, categorie, nom, marque: marque || null, count: its.length, avgPrix, items: its }
    })
  }, [filtered])

  const filteredVapos = useMemo(() => {
    if (!vapoSearch) return vapos
    const q = vapoSearch.toLowerCase()
    return vapos.filter(v =>
      v.nom.toLowerCase().includes(q) ||
      (v.marque ?? '').toLowerCase().includes(q) ||
      (v.modele ?? '').toLowerCase().includes(q)
    )
  }, [vapos, vapoSearch])

  if (isLoading || vaposLoading) return <LoadingSpinner />

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Matériel</h1>
        <div className="flex items-center gap-2">
          {activeTab === 'materiel' && (
            <button onClick={() => setShowImportExport(true)}
              className="flex items-center gap-2 px-4 py-2.5 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700/40 text-sm font-medium">
              <ArrowUpDown size={15} /> Import / Export
            </button>
          )}
          <button
            onClick={() => {
              if (activeTab === 'materiel') { setEditItem(null); setShowModal(true) }
              else { setEditVapo(null); setShowVapoModal(true) }
            }}
            className="flex items-center gap-2 px-4 py-2.5 bg-grow-600 text-white rounded-xl hover:bg-grow-700 text-sm font-medium shadow-sm">
            <Plus size={16} /> Ajouter
          </button>
        </div>
      </div>

      {/* Onglets */}
      <div className="flex items-center gap-1 bg-gray-100 rounded-xl p-1 w-fit">
        <button onClick={() => setActiveTab('materiel')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeTab === 'materiel' ? 'bg-white dark:bg-gray-800 shadow text-gray-900 dark:text-gray-100' : 'text-gray-500 dark:text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:text-gray-200'
          }`}>
          <Wrench size={14} /> Matériel <span className="text-xs text-gray-400 dark:text-gray-500">({items.length})</span>
        </button>
        <button onClick={() => setActiveTab('vaporisateurs')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeTab === 'vaporisateurs' ? 'bg-white dark:bg-gray-800 shadow text-gray-900 dark:text-gray-100' : 'text-gray-500 dark:text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:text-gray-200'
          }`}>
          <Wind size={14} /> Vaporisateurs <span className="text-xs text-gray-400 dark:text-gray-500">({vapos.length})</span>
        </button>
      </div>

      {/* ══ Onglet Matériel ══ */}
      {activeTab === 'materiel' && <>

      {/* Stats cartes */}
      {stats.total > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm p-4 flex items-center gap-3">
            <div className="p-2.5 bg-grow-50 rounded-xl"><Wrench size={18} className="text-grow-600" /></div>
            <div><p className="text-xs text-gray-400 dark:text-gray-500">Total matériel</p><p className="text-xl font-bold text-grow-700">{stats.total}</p></div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm p-4 flex items-center gap-3">
            <div className="p-2.5 bg-blue-50 rounded-xl"><Euro size={18} className="text-blue-600" /></div>
            <div><p className="text-xs text-gray-400 dark:text-gray-500">Valeur totale</p><p className="text-xl font-bold text-blue-700">{stats.valeurTot.toFixed(0)} €</p></div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm p-4 flex items-center gap-3">
            <div className="p-2.5 bg-purple-50 rounded-xl"><Tag size={18} className="text-purple-600" /></div>
            <div><p className="text-xs text-gray-400 dark:text-gray-500">Catégories</p><p className="text-xl font-bold text-purple-700">{Object.values(stats.byCat).filter(n => n > 0).length}</p></div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm p-4 flex items-center gap-3">
            <div className="p-2.5 bg-red-50 rounded-xl"><AlertTriangle size={18} className="text-red-500" /></div>
            <div><p className="text-xs text-gray-400 dark:text-gray-500">Hors service</p><p className="text-xl font-bold text-red-600">{stats.horsService}</p></div>
          </div>
        </div>
      )}

      {/* Filtres + vue */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden">
        <div className="px-5 pt-4 pb-3 flex flex-wrap items-center gap-3 border-b border-gray-100 dark:border-gray-700">
          <input
            type="text" placeholder="Rechercher…" value={search} onChange={e => setSearch(e.target.value)}
            className="text-sm border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-grow-400 w-48"
          />
          <select value={catFilter} onChange={e => setCatFilter(e.target.value)}
            className="text-sm border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-grow-400 bg-white dark:bg-gray-800">
            <option value="all">Toutes les catégories</option>
            {CATEGORIES.map(c => (
              <option key={c} value={c}>{CAT_ICONS[c]} {c} ({stats.byCat[c] ?? 0})</option>
            ))}
          </select>
          <select value={etatFilter} onChange={e => setEtatFilter(e.target.value)}
            className="text-sm border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-grow-400 bg-white dark:bg-gray-800">
            <option value="all">Tous les états</option>
            <option>Neuf</option>
            <option>Bon état</option>
            <option>Usagé</option>
            <option>Hors service</option>
          </select>
          <div className="ml-auto flex items-center gap-1 bg-gray-100 rounded-lg p-1">
            {(['liste', 'groupe'] as const).map(mode => (
              <button key={mode} onClick={() => setViewMode(mode)}
                className={`text-xs px-3 py-1 rounded-md font-medium transition-colors ${viewMode === mode ? 'bg-white dark:bg-gray-800 shadow text-gray-800 dark:text-gray-100' : 'text-gray-500 dark:text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:text-gray-200'}`}>
                {mode === 'liste' ? 'Liste' : 'Groupé'}
              </button>
            ))}
          </div>
        </div>

        {filtered.length === 0 ? (
          <EmptyState icon={Wrench} title="Aucun matériel" description='Cliquez sur "Ajouter" pour commencer' />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700 text-xs font-semibold text-gray-500 dark:text-gray-400 dark:text-gray-500 uppercase tracking-wide">
                  {viewMode === 'liste' ? (
                    <>
                      <th className="px-3 py-2.5 text-left">#</th>
                      <th className="px-3 py-2.5 text-left">Nom</th>
                      <th className="px-3 py-2.5 text-left">Marque</th>
                      <th className="px-3 py-2.5 text-left">Code / S/N</th>
                      <th className="px-3 py-2.5 text-left">Date achat</th>
                      <th className="px-3 py-2.5 text-right">Prix</th>
                      <th className="px-3 py-2.5 text-left">Âge</th>
                      <th className="px-3 py-2.5 text-left">Caractéristiques</th>
                      <th className="px-3 py-2.5 text-left">État</th>
                      <th className="px-3 py-2.5"></th>
                    </>
                  ) : (
                    <>
                      <th className="px-3 py-2.5 w-8"></th>
                      <th className="px-3 py-2.5 text-left">Nom</th>
                      <th className="px-3 py-2.5 text-left">Marque</th>
                      <th className="px-3 py-2.5 text-left">Qté</th>
                      <th className="px-3 py-2.5 text-left" colSpan={6}>Prix moyen</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {viewMode === 'liste'
                  ? filtered.map(item => (
                      <ItemRow key={item.id_materiel} item={item}
                        onEdit={() => { setEditItem(item); setShowModal(true) }}
                        onDeleted={invalidate}
                      />
                    ))
                  : grouped.map(g => (
                      <GroupRow key={g.key}
                        nom={g.nom} marque={g.marque} categorie={g.categorie}
                        count={g.count} avgPrix={g.avgPrix} items={g.items}
                        onEdit={item => { setEditItem(item); setShowModal(true) }}
                        onDeleted={invalidate}
                      />
                    ))
                }
              </tbody>
            </table>
          </div>
        )}

        {filtered.length > 0 && (
          <div className="px-5 py-3 border-t border-gray-100 dark:border-gray-700 text-xs text-gray-400 dark:text-gray-500">
            {filtered.length} élément{filtered.length > 1 ? 's' : ''}
            {catFilter !== 'all' && ` · ${catFilter}`}
          </div>
        )}
      </div>

      {showModal && (
        <NouveauMaterielModal
          editItem={editItem}
          onClose={() => { setShowModal(false); setEditItem(null) }}
        />
      )}
      {showImportExport && (
        <ImportExportModal onClose={() => setShowImportExport(false)} />
      )}

      </>}

      {/* ══ Onglet Vaporisateurs ══ */}
      {activeTab === 'vaporisateurs' && <>

        {/* Stats vapos */}
        {vapos.length > 0 && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm p-4 flex items-center gap-3">
              <div className="p-2.5 bg-grow-50 rounded-xl"><Wind size={18} className="text-grow-600" /></div>
              <div><p className="text-xs text-gray-400 dark:text-gray-500">Vaporisateurs</p><p className="text-xl font-bold text-grow-700">{vapos.length}</p></div>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm p-4 flex items-center gap-3">
              <div className="p-2.5 bg-blue-50 rounded-xl"><Euro size={18} className="text-blue-600" /></div>
              <div>
                <p className="text-xs text-gray-400 dark:text-gray-500">Valeur totale</p>
                <p className="text-xl font-bold text-blue-700">
                  {vapos.filter(v => v.prix_achat != null).reduce((s, v) => s + Number(v.prix_achat), 0).toFixed(0)} €
                </p>
              </div>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm p-4 flex items-center gap-3">
              <div className="p-2.5 bg-purple-50 rounded-xl"><Zap size={18} className="text-purple-600" /></div>
              <div>
                <p className="text-xs text-gray-400 dark:text-gray-500">Sessions totales</p>
                <p className="text-xl font-bold text-purple-700">
                  {vapos.reduce((s, v) => s + (v.nbr_sessions ?? 0), 0)}
                </p>
              </div>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm p-4 flex items-center gap-3">
              <div className="p-2.5 bg-orange-50 rounded-xl"><Package size={18} className="text-orange-500" /></div>
              <div>
                <p className="text-xs text-gray-400 dark:text-gray-500">Consommables</p>
                <p className="text-xl font-bold text-orange-600">
                  {vapos.reduce((s, v) => s + v.consommables.length, 0)}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Recherche */}
        <div className="flex items-center gap-3">
          <input type="text" placeholder="Rechercher un vapo…"
            value={vapoSearch} onChange={e => setVapoSearch(e.target.value)}
            className="text-sm border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-grow-400 w-56" />
        </div>

        {/* Grille de cartes */}
        {filteredVapos.length === 0 ? (
          <EmptyState icon={Wind} title="Aucun vaporisateur"
            description='Cliquez sur "Ajouter" pour enregistrer votre premier vapo' />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
            {filteredVapos.map(v => (
              <VapoCard key={v.id_vaporisateur} vapo={v}
                onEdit={() => { setEditVapo(v); setShowVapoModal(true) }} />
            ))}
          </div>
        )}

        {showVapoModal && (
          <NouveauVapoModal
            editVapo={editVapo}
            onClose={() => { setShowVapoModal(false); setEditVapo(null) }}
          />
        )}

      </>}

    </div>
  )
}
