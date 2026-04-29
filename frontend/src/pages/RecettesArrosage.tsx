import { useState, useMemo, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Trash2, Pencil, Search, Droplets, ChevronDown, ChevronRight, FlaskConical, Download, Upload } from 'lucide-react'
import { recetteArrosageAPI, RecetteArrosage } from '../api/recetteArrosage'
import NouvelleRecetteArrosageModal from '../components/NouvelleRecetteArrosageModal'
import LoadingSpinner from '../components/LoadingSpinner'

const TYPE_COLORS: Record<string, string> = {
  'Eau simple':         'bg-sky-100 text-sky-700',
  'Eau + amendements':  'bg-blue-100 text-blue-700',
}

function RecetteArrosageCard({
  recette, onEdit, onDelete,
}: { recette: RecetteArrosage; onEdit: () => void; onDelete: () => void }) {
  const [expanded, setExpanded] = useState(false)

  const eauStr = recette.quantite_eau
    ? `${recette.quantite_eau} ${recette.unite_eau ?? 'L'} d'eau`
    : null

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="px-5 py-4 flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1.5">
            <h3 className="font-semibold text-gray-900 text-sm truncate">{recette.nom_recette}</h3>
            {recette.type_arrosage && (
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${TYPE_COLORS[recette.type_arrosage] ?? 'bg-gray-100 text-gray-600'}`}>
                {recette.type_arrosage}
              </span>
            )}
          </div>
          <div className="flex items-center gap-4 text-xs text-gray-500">
            {eauStr && (
              <span className="flex items-center gap-1">
                <Droplets size={11} /> {eauStr}
              </span>
            )}
            {recette.lignes.length > 0 && (
              <span className="flex items-center gap-1">
                <FlaskConical size={11} />
                {recette.lignes.length} amendement{recette.lignes.length > 1 ? 's' : ''}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button onClick={() => setExpanded(e => !e)}
            className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-50">
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

      {expanded && (
        <div className="border-t border-gray-50 px-5 py-3 space-y-2 bg-gray-50">
          {/* Eau de base */}
          {eauStr && (
            <div className="flex items-center gap-2 text-xs text-sky-700 bg-sky-50 rounded px-2 py-1">
              <Droplets size={11} /> <span className="font-medium">Eau de base :</span> {eauStr}
            </div>
          )}

          {recette.lignes.length === 0 ? (
            <p className="text-xs text-gray-400">Aucun amendement</p>
          ) : (
            recette.lignes.map((l, i) => (
              <div key={i} className="space-y-0.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-700 font-medium">{l.nom_produit ?? `Produit #${l.id_produit}`}</span>
                  <span className="text-gray-500 font-mono">{l.quantite} {l.unite}</span>
                </div>
                {l.note_ligne && <p className="text-xs text-blue-600 pl-2">↳ {l.note_ligne}</p>}
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

export default function RecettesArrosage() {
  const qc = useQueryClient()

  const { data: recettes = [], isLoading } = useQuery<RecetteArrosage[]>({
    queryKey: ['recettes-arrosage'],
    queryFn:  async () => (await recetteArrosageAPI.getAll()).data,
  })

  const [showModal,   setShowModal]   = useState(false)
  const [editTarget,  setEditTarget]  = useState<RecetteArrosage | null>(null)
  const [search,      setSearch]      = useState('')
  const [filterType,  setFilterType]  = useState('all')
  const [importing,   setImporting]   = useState(false)
  const importRef = useRef<HTMLInputElement>(null)

  const deleteMut = useMutation({
    mutationFn: (id: number) => recetteArrosageAPI.delete(id),
    onSuccess:  () => qc.invalidateQueries({ queryKey: ['recettes-arrosage'] }),
  })

  const handleExport = async () => {
    try {
      const res = await recetteArrosageAPI.exportCSV()
      const url = URL.createObjectURL(new Blob([res.data], { type: 'text/csv;charset=utf-8;' }))
      const a = Object.assign(document.createElement('a'), { href: url, download: `recettes_arrosage_${new Date().toISOString().slice(0,10)}.csv` })
      a.click(); URL.revokeObjectURL(url)
    } catch {}
  }

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return
    setImporting(true)
    try { await recetteArrosageAPI.importCSV(file); qc.invalidateQueries({ queryKey: ['recettes-arrosage'] }) }
    finally { setImporting(false); if (importRef.current) importRef.current.value = '' }
  }

  const types = useMemo(() => {
    const ts = new Set(recettes.map(r => r.type_arrosage).filter(Boolean) as string[])
    return [...ts].sort()
  }, [recettes])

  const filtered = useMemo(() => {
    let res = recettes
    if (search) {
      const q = search.toLowerCase()
      res = res.filter(r =>
        r.nom_recette.toLowerCase().includes(q) ||
        r.type_arrosage?.toLowerCase().includes(q) ||
        r.lignes.some(l => l.nom_produit?.toLowerCase().includes(q))
      )
    }
    if (filterType !== 'all') res = res.filter(r => r.type_arrosage === filterType)
    return res
  }, [recettes, search, filterType])

  if (isLoading) return <LoadingSpinner />

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">💧 Recettes Arrosage</h1>
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
            className="flex items-center gap-2 px-4 py-2 bg-grow-600 text-white text-sm rounded-lg hover:bg-grow-700">
            <Plus size={16} /> Nouvelle recette
          </button>
        </div>
      </div>

      {recettes.length > 0 && (
        <div className="flex flex-wrap gap-3 items-center">
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input type="text" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Rechercher…"
              className="pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-grow-400 w-52" />
          </div>
          {types.length > 0 && (
            <div className="flex gap-1.5 flex-wrap">
              <button onClick={() => setFilterType('all')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${filterType === 'all' ? 'bg-grow-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                Tous
              </button>
              {types.map(t => (
                <button key={t} onClick={() => setFilterType(t)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${filterType === t ? 'bg-grow-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                  {t}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          {recettes.length === 0 ? (
            <>
              <span className="text-5xl block mb-3 opacity-40">💧</span>
              <p className="text-sm">Aucune recette d'arrosage enregistrée.</p>
              <p className="text-xs mt-1">Cliquez sur "Nouvelle recette" pour commencer.</p>
            </>
          ) : (
            <p className="text-sm">Aucune recette ne correspond à la recherche.</p>
          )}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map(r => (
            <RecetteArrosageCard key={r.id_recette_arrosage} recette={r}
              onEdit={() => { setEditTarget(r); setShowModal(true) }}
              onDelete={() => { if (confirm(`Supprimer "${r.nom_recette}" ?`)) deleteMut.mutate(r.id_recette_arrosage) }}
            />
          ))}
        </div>
      )}

      {showModal && (
        <NouvelleRecetteArrosageModal
          editRecette={editTarget}
          onClose={() => { setShowModal(false); setEditTarget(null) }}
        />
      )}
    </div>
  )
}
