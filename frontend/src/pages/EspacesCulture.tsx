import { useState, useMemo, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Plus, Trash2, Pencil, Search, Download, Upload,
  ChevronDown, ChevronRight, Boxes, Wrench, Ruler,
  CheckCircle2, Circle, AlertTriangle,
} from 'lucide-react'
import { espacesAPI, EspaceCulture } from '../api/espaces'
import NouvelEspaceModal from '../components/NouvelEspaceModal'
import LoadingSpinner from '../components/LoadingSpinner'

// ── Utilitaires ────────────────────────────────────────────────────────────────

const STATUT_CONFIG: Record<string, { icon: React.ReactNode; color: string; bg: string }> = {
  'Actif':       { icon: <CheckCircle2 size={13} />, color: 'text-green-700',  bg: 'bg-green-50 border-green-200' },
  'Inactif':     { icon: <Circle size={13} />,       color: 'text-gray-500',   bg: 'bg-gray-50 border-gray-200' },
  'Maintenance': { icon: <AlertTriangle size={13} />, color: 'text-yellow-700', bg: 'bg-yellow-50 border-yellow-200' },
}

// ── Composant carte ────────────────────────────────────────────────────────────
function EspaceCard({
  espace, onEdit, onDelete,
}: { espace: EspaceCulture; onEdit: () => void; onDelete: () => void }) {
  const [expanded, setExpanded] = useState(false)
  const cfg = STATUT_CONFIG[espace.statut ?? 'Actif'] ?? STATUT_CONFIG['Actif']

  // Grouper le matériel par catégorie
  const byCategorie = useMemo(() => {
    const map = new Map<string, typeof espace.equipements>()
    for (const eq of espace.equipements) {
      const cat = eq.categorie ?? 'Autre'
      if (!map.has(cat)) map.set(cat, [])
      map.get(cat)!.push(eq)
    }
    return map
  }, [espace.equipements])

  return (
    <div className={`bg-white rounded-xl border shadow-sm overflow-hidden transition-shadow hover:shadow-md ${cfg.bg}`}>
      {/* Bande de statut */}
      <div className={`px-5 py-3.5 flex items-start justify-between gap-3`}>
        <div className="flex-1 min-w-0">
          {/* Titre + badges */}
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <h3 className="font-bold text-gray-900 text-base">{espace.nom}</h3>
            {espace.type_espace && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-grow-100 text-grow-700 font-medium">
                {espace.type_espace}
              </span>
            )}
            <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium border ${cfg.color} ${cfg.bg}`}>
              {cfg.icon} {espace.statut ?? 'Actif'}
            </span>
          </div>

          {/* Méta infos */}
          <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-gray-500">
            {espace.nom_materiel_principal && (
              <span className="flex items-center gap-1 text-grow-600 font-medium">
                📦 {espace.nom_materiel_principal}
              </span>
            )}
            {espace.dimensions && (
              <span className="flex items-center gap-1">
                <Ruler size={10} /> {espace.dimensions}
              </span>
            )}
            {espace.surface_m2 && <span>📐 {espace.surface_m2} m²</span>}
            {espace.hauteur_cm && <span>↕ {espace.hauteur_cm} cm</span>}
            <span className="flex items-center gap-1">
              <Wrench size={10} />
              {espace.equipements.length} équipement{espace.equipements.length > 1 ? 's' : ''}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button onClick={() => setExpanded(e => !e)}
            className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-white/60">
            {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          </button>
          <button onClick={onEdit}
            className="p-1.5 text-blue-500 hover:text-blue-700 rounded-lg hover:bg-blue-50">
            <Pencil size={15} />
          </button>
          <button onClick={onDelete}
            className="p-1.5 text-red-400 hover:text-red-600 rounded-lg hover:bg-red-50">
            <Trash2 size={15} />
          </button>
        </div>
      </div>

      {/* Détail matériel */}
      {expanded && (
        <div className="border-t border-gray-100 bg-white px-5 py-4 space-y-3">
          {espace.equipements.length === 0 ? (
            <p className="text-sm text-gray-400 flex items-center gap-2">
              <Wrench size={13} /> Aucun matériel assigné à cet espace
            </p>
          ) : (
            Array.from(byCategorie.entries()).map(([cat, items]) => (
              <div key={cat}>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">{cat}</p>
                <div className="space-y-1">
                  {items.map(eq => (
                    <div key={eq.id_espace_materiel}
                      className="flex items-center justify-between text-sm bg-gray-50 rounded-lg px-3 py-2">
                      <div>
                        <span className="text-gray-700 font-medium">{eq.nom_materiel ?? `Matériel #${eq.id_materiel}`}</span>
                        {eq.marque && <span className="text-gray-400 ml-2 text-xs">{eq.marque}</span>}
                      </div>
                      {eq.etat && (
                        <span className="text-xs text-gray-400">{eq.etat}</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
          {espace.notes && (
            <p className="text-xs text-gray-400 pt-2 border-t border-gray-100">{espace.notes}</p>
          )}
        </div>
      )}
    </div>
  )
}

// ── Page principale ────────────────────────────────────────────────────────────
export default function EspacesCulture() {
  const qc       = useQueryClient()
  const importRef = useRef<HTMLInputElement>(null)

  const { data: espaces = [], isLoading } = useQuery<EspaceCulture[]>({
    queryKey: ['espaces'],
    queryFn:  async () => (await espacesAPI.getAll()).data,
  })

  const [showModal,   setShowModal]   = useState(false)
  const [editTarget,  setEditTarget]  = useState<EspaceCulture | null>(null)
  const [search,      setSearch]      = useState('')
  const [filterStatut, setFilterStatut] = useState('all')
  const [importing,   setImporting]   = useState(false)

  const deleteMut = useMutation({
    mutationFn: (id: number) => espacesAPI.delete(id),
    onSuccess:  () => qc.invalidateQueries({ queryKey: ['espaces'] }),
  })

  // Stats
  const stats = useMemo(() => ({
    total:       espaces.length,
    actifs:      espaces.filter(e => e.statut === 'Actif').length,
    inactifs:    espaces.filter(e => e.statut === 'Inactif').length,
    maintenance: espaces.filter(e => e.statut === 'Maintenance').length,
    equipements: espaces.reduce((t, e) => t + e.equipements.length, 0),
  }), [espaces])

  // Filtrage
  const filtered = useMemo(() => {
    let res = espaces
    if (filterStatut !== 'all') res = res.filter(e => e.statut === filterStatut)
    if (search) {
      const q = search.toLowerCase()
      res = res.filter(e =>
        e.nom.toLowerCase().includes(q) ||
        e.type_espace?.toLowerCase().includes(q) ||
        e.dimensions?.toLowerCase().includes(q) ||
        e.notes?.toLowerCase().includes(q) ||
        e.equipements.some(eq => eq.nom_materiel?.toLowerCase().includes(q))
      )
    }
    return res
  }, [espaces, search, filterStatut])

  // Export CSV
  const handleExport = async () => {
    try {
      const res = await espacesAPI.exportCSV()
      const blob = new Blob([res.data], { type: 'text/csv;charset=utf-8;' })
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href     = url
      a.download = `espaces_${new Date().toISOString().slice(0,10)}.csv`
      a.click()
      URL.revokeObjectURL(url)
    } catch {}
  }

  // Import CSV
  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setImporting(true)
    try {
      await espacesAPI.importCSV(file)
      qc.invalidateQueries({ queryKey: ['espaces'] })
    } finally {
      setImporting(false)
      if (importRef.current) importRef.current.value = ''
    }
  }

  if (isLoading) return <LoadingSpinner />

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2.5">
            <Boxes size={26} className="text-grow-600" />
            Espaces de culture
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {espaces.length} espace{espaces.length > 1 ? 's' : ''} configuré{espaces.length > 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleExport}
            className="flex items-center gap-1.5 px-3 py-2 border border-gray-300 text-gray-600 text-sm rounded-lg hover:bg-gray-50">
            <Download size={14} /> Export CSV
          </button>
          <button onClick={() => importRef.current?.click()} disabled={importing}
            className="flex items-center gap-1.5 px-3 py-2 border border-gray-300 text-gray-600 text-sm rounded-lg hover:bg-gray-50 disabled:opacity-50">
            <Upload size={14} /> {importing ? 'Import…' : 'Import CSV'}
          </button>
          <input ref={importRef} type="file" accept=".csv" className="hidden" onChange={handleImport} />
          <button
            onClick={() => { setEditTarget(null); setShowModal(true) }}
            className="flex items-center gap-2 px-4 py-2 bg-grow-600 text-white text-sm rounded-lg hover:bg-grow-700">
            <Plus size={16} /> Nouvel espace
          </button>
        </div>
      </div>

      {/* ── Stats ── */}
      {espaces.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Total',        value: stats.total,       color: 'text-gray-900', bg: 'bg-white' },
            { label: 'Actifs',       value: stats.actifs,      color: 'text-green-700',  bg: 'bg-green-50' },
            { label: 'Maintenance',  value: stats.maintenance, color: 'text-yellow-700', bg: 'bg-yellow-50' },
            { label: 'Équipements',  value: stats.equipements, color: 'text-grow-700',   bg: 'bg-grow-50' },
          ].map(s => (
            <div key={s.label} className={`${s.bg} rounded-xl border border-gray-100 shadow-sm px-4 py-3 text-center`}>
              <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
              <div className="text-xs text-gray-500 mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* ── Filtres ── */}
      {espaces.length > 0 && (
        <div className="flex flex-wrap gap-3 items-center">
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input type="text" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Rechercher un espace…"
              className="pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-grow-400 w-56" />
          </div>
          <div className="flex gap-1.5">
            {['all', 'Actif', 'Inactif', 'Maintenance'].map(s => (
              <button key={s} onClick={() => setFilterStatut(s)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  filterStatut === s ? 'bg-grow-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}>
                {s === 'all' ? 'Tous' : s}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Liste / Empty ── */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          {espaces.length === 0 ? (
            <>
              <Boxes size={48} className="mx-auto mb-3 opacity-20" />
              <p className="text-sm font-medium">Aucun espace de culture configuré.</p>
              <p className="text-xs mt-1">
                Créez un espace pour y associer vos équipements et l'utiliser dans le suivi de culture.
              </p>
              <button
                onClick={() => { setEditTarget(null); setShowModal(true) }}
                className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-grow-600 text-white text-sm rounded-lg hover:bg-grow-700">
                <Plus size={15} /> Créer le premier espace
              </button>
            </>
          ) : (
            <p className="text-sm">Aucun espace ne correspond à la recherche.</p>
          )}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map(e => (
            <EspaceCard key={e.id_espace} espace={e}
              onEdit={() => { setEditTarget(e); setShowModal(true) }}
              onDelete={() => {
                if (confirm(`Supprimer l'espace "${e.nom}" ?`))
                  deleteMut.mutate(e.id_espace)
              }}
            />
          ))}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <NouvelEspaceModal
          editEspace={editTarget}
          onClose={() => { setShowModal(false); setEditTarget(null) }}
        />
      )}
    </div>
  )
}
