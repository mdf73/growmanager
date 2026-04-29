import { useState, useMemo, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Plus, Trash2, Pencil, Search, FlaskConical, Droplets,
  Leaf, Euro, Hash, ChevronDown, ChevronRight, Download, Upload,
} from 'lucide-react'
import { recetteEngraisAPI, RecetteEngrais } from '../api/recetteEngrais'
import NouvelleRecetteEngraisModal from '../components/NouvelleRecetteEngraisModal'
import LoadingSpinner from '../components/LoadingSpinner'

// ── Couleurs par période ───────────────────────────────────────────────────────
const PERIODE_COLORS: Record<string, string> = {
  'Veg':        'bg-green-100 text-green-700',
  'Early Flo':  'bg-yellow-100 text-yellow-700',
  'Flo':        'bg-orange-100 text-orange-700',
  'Late Flo':   'bg-red-100 text-red-700',
  'Maturation': 'bg-purple-100 text-purple-700',
  'Flush':      'bg-blue-100 text-blue-700',
}

const TYPE_COLORS: Record<string, string> = {
  'Arrosage':       'bg-sky-100 text-sky-700',
  'Pulvérisation':  'bg-violet-100 text-violet-700',
}

// ── Calcul coût/L ─────────────────────────────────────────────────────────────
function coutParLitre(recette: RecetteEngrais): number | null {
  // Le coût est calculé depuis les données enrichies de la recette
  // Mais ici, on n'a pas les prix — on affiche ce que le backend a calculé
  // (les lignes ont nom_produit mais pas prix_achat)
  // On retourne null si on n'a pas l'info
  return null
}

// ── Card recette ──────────────────────────────────────────────────────────────
function RecetteCard({
  recette,
  onEdit,
  onDelete,
}: {
  recette:  RecetteEngrais
  onEdit:   () => void
  onDelete: () => void
}) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
      {/* En-tête */}
      <div className="px-5 py-4 flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1.5">
            <h3 className="font-semibold text-gray-900 text-sm truncate">{recette.nom_recette}</h3>
            {recette.type_recette && (
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${TYPE_COLORS[recette.type_recette] ?? 'bg-gray-100 text-gray-600'}`}>
                {recette.type_recette}
              </span>
            )}
            {recette.periode && (
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${PERIODE_COLORS[recette.periode] ?? 'bg-gray-100 text-gray-600'}`}>
                {recette.periode}
              </span>
            )}
            {recette.semaine && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 font-medium">
                S{recette.semaine}
              </span>
            )}
          </div>

          <div className="flex items-center gap-4 text-xs text-gray-500">
            <span className="flex items-center gap-1">
              <FlaskConical size={11} />
              {recette.lignes.length} engrais
            </span>
            {recette.ph_cible && (
              <span className="flex items-center gap-1">
                <Droplets size={11} />
                pH {recette.ph_cible}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => setExpanded(e => !e)}
            className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-50"
          >
            {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          </button>
          <button onClick={onEdit}
            className="p-1.5 text-blue-400 hover:text-blue-600 rounded-lg hover:bg-blue-50">
            <Pencil size={15} />
          </button>
          <button onClick={onDelete}
            className="p-1.5 text-red-400 hover:text-red-600 rounded-lg hover:bg-red-50">
            <Trash2 size={15} />
          </button>
        </div>
      </div>

      {/* Détail lignes */}
      {expanded && (
        <div className="border-t border-gray-50 px-5 py-3 space-y-1.5 bg-gray-50">
          {recette.lignes.length === 0 ? (
            <p className="text-xs text-gray-400">Aucun ingrédient</p>
          ) : (
            recette.lignes.map((l, i) => (
              <div key={i} className="flex items-center justify-between text-xs">
                <span className="text-gray-700 font-medium">{l.nom_produit ?? `Produit #${l.id_produit}`}</span>
                <span className="text-gray-500 font-mono">{l.dosage} {l.unite}</span>
              </div>
            ))
          )}
          {recette.notes && (
            <p className="text-xs text-gray-400 pt-1 border-t border-gray-100 mt-1">{recette.notes}</p>
          )}
        </div>
      )}
    </div>
  )
}


// ═══════════════════════════════════════════════════════════════════════════════
// PAGE
// ═══════════════════════════════════════════════════════════════════════════════
export default function RecettesSchemas() {
  const qc = useQueryClient()

  const { data: recettes = [], isLoading } = useQuery<RecetteEngrais[]>({
    queryKey: ['recettes-engrais'],
    queryFn:  async () => (await recetteEngraisAPI.getAll()).data,
  })

  const [showModal,  setShowModal]  = useState(false)
  const [editTarget, setEditTarget] = useState<RecetteEngrais | null>(null)
  const [search,     setSearch]     = useState('')
  const [filterType, setFilterType] = useState<string>('all')
  const [importing,  setImporting]  = useState(false)
  const importRef = useRef<HTMLInputElement>(null)

  const deleteMut = useMutation({
    mutationFn: (id: number) => recetteEngraisAPI.delete(id),
    onSuccess:  () => qc.invalidateQueries({ queryKey: ['recettes-engrais'] }),
  })

  const handleDelete = (r: RecetteEngrais) => {
    if (confirm(`Supprimer la recette "${r.nom_recette}" ?`)) deleteMut.mutate(r.id_recette)
  }

  const handleExport = async () => {
    try {
      const res = await recetteEngraisAPI.exportCSV()
      const url = URL.createObjectURL(new Blob([res.data], { type: 'text/csv;charset=utf-8;' }))
      const a = Object.assign(document.createElement('a'), { href: url, download: `recettes_engrais_${new Date().toISOString().slice(0,10)}.csv` })
      a.click(); URL.revokeObjectURL(url)
    } catch {}
  }

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return
    setImporting(true)
    try { await recetteEngraisAPI.importCSV(file); qc.invalidateQueries({ queryKey: ['recettes-engrais'] }) }
    finally { setImporting(false); if (importRef.current) importRef.current.value = '' }
  }

  const handleEdit = (r: RecetteEngrais) => {
    setEditTarget(r)
    setShowModal(true)
  }

  const handleCloseModal = () => {
    setShowModal(false)
    setEditTarget(null)
  }

  // Filtres
  const types = useMemo(() => {
    const ts = new Set(recettes.map(r => r.type_recette).filter(Boolean) as string[])
    return [...ts].sort()
  }, [recettes])

  const filtered = useMemo(() => {
    let res = recettes
    if (search) {
      const q = search.toLowerCase()
      res = res.filter(r =>
        r.nom_recette.toLowerCase().includes(q) ||
        r.periode?.toLowerCase().includes(q) ||
        r.lignes.some(l => l.nom_produit?.toLowerCase().includes(q))
      )
    }
    if (filterType !== 'all') res = res.filter(r => r.type_recette === filterType)
    return res
  }, [recettes, search, filterType])

  if (isLoading) return <LoadingSpinner />

  return (
    <div className="space-y-6">

      {/* En-tête */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            💧 Recettes Arrosage
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {recettes.length} recette{recettes.length > 1 ? 's' : ''} enregistrée{recettes.length > 1 ? 's' : ''}
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
            className="flex items-center gap-2 px-4 py-2 bg-grow-600 text-white text-sm rounded-lg hover:bg-grow-700"
          >
            <Plus size={16} /> Nouvelle recette
          </button>
        </div>
      </div>

      {/* Filtres */}
      {recettes.length > 0 && (
        <div className="flex flex-wrap gap-3 items-center">
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text" value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Rechercher…"
              className="pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-grow-400 w-52"
            />
          </div>
          <div className="flex gap-1.5">
            <button
              onClick={() => setFilterType('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${filterType === 'all' ? 'bg-grow-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
            >Tous</button>
            {types.map(t => (
              <button key={t}
                onClick={() => setFilterType(t)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${filterType === t ? 'bg-grow-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
              >{t}</button>
            ))}
          </div>
        </div>
      )}

      {/* Liste */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          {recettes.length === 0 ? (
            <>
              <FlaskConical size={40} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm">Aucune recette enregistrée.</p>
              <p className="text-xs mt-1">Cliquez sur "Nouvelle recette" pour commencer.</p>
            </>
          ) : (
            <p className="text-sm">Aucune recette ne correspond à la recherche.</p>
          )}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map(r => (
            <RecetteCard
              key={r.id_recette}
              recette={r}
              onEdit={() => handleEdit(r)}
              onDelete={() => handleDelete(r)}
            />
          ))}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <NouvelleRecetteEngraisModal
          editRecette={editTarget}
          onClose={handleCloseModal}
        />
      )}
    </div>
  )
}
