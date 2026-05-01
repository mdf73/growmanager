import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Plus, Search, Sprout, Lock, ExternalLink, Settings2, PackageOpen, ArrowDownUp, ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react'
import { catalogueAPI, CatalogueItem } from '../api/graines'
import LoadingSpinner from '../components/LoadingSpinner'
import EmptyState from '../components/EmptyState'
import NouveauPackModal from '../components/NouveauPackModal'
import DetailPackModal from '../components/DetailPackModal'
import GestionModal from '../components/GestionModal'
import ImportExportModal from '../components/ImportExportModal'

// Calcule l'âge d'un pack en jours depuis la date d'achat
function ageLabel(dateAchat?: string): string {
  if (!dateAchat) return '—'
  const diffMs = Date.now() - new Date(dateAchat).getTime()
  const days = Math.floor(diffMs / 86400000)
  if (days < 30)  return `${days}j`
  if (days < 365) return `${Math.floor(days / 30)} mois`
  const ans  = Math.floor(days / 365)
  const mois = Math.floor((days % 365) / 30)
  const ansLabel = `${ans} ${ans > 1 ? 'ans' : 'an'}`
  return mois > 0 ? `${ansLabel} ${mois} mois` : ansLabel
}

type CatSortCol = 'breeder' | 'variete' | 'croisement' | 'type' | 'flo' | 'stock' | 'age' | 'prix' | 'date'
type SortDir = 'asc' | 'desc'

function SortIcon({ col, current, dir }: { col: CatSortCol; current: CatSortCol | null; dir: SortDir }) {
  if (current !== col) return <ChevronsUpDown size={12} className="ml-1 text-gray-300 inline" />
  return dir === 'asc'
    ? <ChevronUp size={12} className="ml-1 text-grow-600 inline" />
    : <ChevronDown size={12} className="ml-1 text-grow-600 inline" />
}

export default function Graines() {
  const [searchTerm, setSearchTerm]   = useState('')
  const [typeFilter, setTypeFilter]   = useState('')
  const [stockFilter, setStockFilter] = useState('')
  const [sortCol, setSortCol]   = useState<CatSortCol | null>(null)
  const [sortDir, setSortDir]   = useState<SortDir>('asc')

  const handleSort = (col: CatSortCol) => {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortCol(col); setSortDir('asc') }
  }

  const [showNouveauModal, setShowNouveauModal]       = useState(false)
  const [showGestionModal, setShowGestionModal]       = useState(false)
  const [showImportExportModal, setShowImportExportModal] = useState(false)
  const [gestionTab, setGestionTab]                   = useState<'breeders' | 'varietes'>('breeders')
  const [detailPack, setDetailPack]                   = useState<CatalogueItem | null>(null)

  const { data: catalogue, isLoading, refetch } = useQuery<CatalogueItem[]>({
    queryKey: ['catalogue'],
    queryFn: async () => (await catalogueAPI.get()).data,
  })

  const filtered = useMemo(() => {
    const base = (catalogue || []).filter(item => {
      const q = searchTerm.toLowerCase()
      const matchSearch =
        item.breeder_nom.toLowerCase().includes(q) ||
        item.variete_nom.toLowerCase().includes(q) ||
        (item.croisement_variete || '').toLowerCase().includes(q)

      const matchType  = !typeFilter  || item.type_graines === typeFilter

      const matchStock =
        !stockFilter ||
        (stockFilter === 'dispo'   && item.nbr_graines_restantes > 0) ||
        (stockFilter === 'rupture' && item.nbr_graines_restantes === 0) ||
        (stockFilter === 'ouvert'  && item.paquet_ouvert) ||
        (stockFilter === 'ferme'   && !item.paquet_ouvert)

      return matchSearch && matchType && matchStock
    })

    if (!sortCol) return base
    return [...base].sort((a, b) => {
      let av: string | number, bv: string | number
      switch (sortCol) {
        case 'breeder':    av = a.breeder_nom;                  bv = b.breeder_nom;                  break
        case 'variete':    av = a.variete_nom;                  bv = b.variete_nom;                  break
        case 'croisement': av = a.croisement_variete || '';     bv = b.croisement_variete || '';     break
        case 'type':       av = a.type_graines || '';           bv = b.type_graines || '';           break
        case 'flo':        av = a.duree_flo_min ?? 9999;        bv = b.duree_flo_min ?? 9999;        break
        case 'stock':      av = a.nbr_graines_restantes;        bv = b.nbr_graines_restantes;        break
        case 'age':
        case 'date':       av = a.date_achat || '';             bv = b.date_achat || '';             break
        case 'prix':       av = a.prix_par_graine ?? 9999;      bv = b.prix_par_graine ?? 9999;      break
        default:           return 0
      }
      if (av < bv) return sortDir === 'asc' ? -1 : 1
      if (av > bv) return sortDir === 'asc' ? 1 : -1
      return 0
    })
  }, [catalogue, searchTerm, typeFilter, stockFilter, sortCol, sortDir])

  const avgPrix = useMemo(() => {
    const withPrice = (catalogue || []).filter(i => i.prix_par_graine != null && i.nbr_graines_restantes > 0)
    if (!withPrice.length) return null
    const sumProduit = withPrice.reduce((sum, i) => sum + i.prix_par_graine! * i.nbr_graines_restantes, 0)
    const sumStock   = withPrice.reduce((sum, i) => sum + i.nbr_graines_restantes, 0)
    return sumProduit / sumStock
  }, [catalogue])

  if (isLoading) return <LoadingSpinner />

  const getStockBadge = (restantes: number) => {
    if (restantes === 0) return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">Rupture</span>
    if (restantes <= 1)  return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">{restantes}</span>
    if (restantes <= 3)  return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-700">{restantes}</span>
    return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">{restantes}</span>
  }

  const openGestion = (tab: 'breeders' | 'varietes') => {
    setGestionTab(tab)
    setShowGestionModal(true)
  }

  return (
    <div className="space-y-6">

      {/* Modals */}
      {showNouveauModal && <NouveauPackModal onClose={() => setShowNouveauModal(false)} />}
      {showGestionModal && <GestionModal defaultTab={gestionTab} onClose={() => setShowGestionModal(false)} />}
      {showImportExportModal && <ImportExportModal onClose={() => setShowImportExportModal(false)} />}
      {detailPack && (
        <DetailPackModal
          pack={detailPack}
          onClose={() => setDetailPack(null)}
          onDeleted={() => { setDetailPack(null); refetch() }}
        />
      )}

      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="flex items-center gap-4">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Catalogue Graines</h1>
          {avgPrix !== null && (
            <div className="flex items-center gap-1 px-3 py-1.5 bg-grow-50 border border-grow-100 rounded-lg">
              <span className="text-xs text-grow-500">Coût moyen</span>
              <span className="text-sm font-semibold text-grow-700">{avgPrix.toFixed(2)} €</span>
              <span className="text-xs text-grow-400">/ graine</span>
            </div>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => openGestion('breeders')} className="flex items-center gap-2 px-3 py-2 border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/40 text-sm">
            <Settings2 size={15} />Breeders
          </button>
          <button onClick={() => openGestion('varietes')} className="flex items-center gap-2 px-3 py-2 border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/40 text-sm">
            <Settings2 size={15} />Variétés
          </button>
          <button onClick={() => setShowImportExportModal(true)} className="flex items-center gap-2 px-3 py-2 border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/40 text-sm">
            <ArrowDownUp size={15} />Import / Export
          </button>
          <button onClick={() => setShowNouveauModal(true)} className="flex items-center gap-2 px-4 py-2 bg-grow-600 text-white rounded-lg hover:bg-grow-700 text-sm font-medium">
            <Plus size={18} />Nouveau Pack
          </button>
        </div>
      </div>


      {/* Filtres */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
        <div className="flex flex-col lg:flex-row gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-2.5 text-gray-400 dark:text-gray-500" size={17} />
            <input
              type="text"
              placeholder="Breeder, variété, croisement..."
              className="w-full pl-9 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-grow-600"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
          <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-grow-600">
            <option value="">Tous les types</option>
            <option value="Régulière">Régulière</option>
            <option value="Féminisée">Féminisée</option>
            <option value="Auto">Auto</option>
          </select>
          <select value={stockFilter} onChange={e => setStockFilter(e.target.value)} className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-grow-600">
            <option value="">Tous les stocks</option>
            <option value="dispo">Disponibles</option>
            <option value="rupture">En rupture</option>
            <option value="ouvert">Paquet ouvert</option>
            <option value="ferme">Paquet fermé</option>
          </select>
        </div>
        {(searchTerm || typeFilter || stockFilter) && filtered.length < (catalogue?.length ?? 0) && (
          <p className="mt-2 text-xs text-gray-400 dark:text-gray-500">
            {filtered.length} résultat{filtered.length > 1 ? 's' : ''} sur {catalogue?.length}
          </p>
        )}
      </div>

      {/* Tableau */}
      {filtered.length === 0 ? (
        <EmptyState icon={Sprout} title="Aucune graine trouvée" description="Modifie les filtres ou ajoute un nouveau pack" />
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
          <div className="overflow-auto max-h-[calc(100vh-320px)]">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-10">
                <tr>
                  {([
                    ['breeder',    'Breeder'],
                    ['variete',    'Variété'],
                    ['croisement', 'Croisement'],
                    ['type',       'Type'],
                    ['flo',        'Floraison'],
                    ['stock',      'Stock'],
                    ['age',        'Âge'],
                    ['prix',       'Prix/Graine'],
                    ['date',       'Date'],
                  ] as [CatSortCol, string][]).map(([col, label]) => (
                    <th
                      key={col}
                      onClick={() => handleSort(col)}
                      className="px-5 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 dark:text-gray-500 uppercase cursor-pointer select-none hover:bg-gray-100 dark:hover:bg-gray-700 whitespace-nowrap"
                    >
                      {label}<SortIcon col={col} current={sortCol} dir={sortDir} />
                    </th>
                  ))}
                  <th className="px-5 py-3 w-8"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {filtered.map(item => (
                  <tr
                    key={item.id_packgraine}
                    onClick={() => setDetailPack(item)}
                    className="hover:bg-gray-50 dark:hover:bg-gray-700/40 cursor-pointer"
                  >
                    <td className="px-5 py-3 text-sm font-medium text-gray-900 dark:text-gray-100">{item.breeder_nom}</td>
                    <td className="px-5 py-3 text-sm text-gray-700 dark:text-gray-200">
                      <span className="flex items-center gap-1.5">
                        {item.variete_nom}
                        {item.paquet_ouvert && (
                          <PackageOpen size={13} className="text-amber-400 shrink-0" title="Paquet ouvert" />
                        )}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-sm text-gray-400 dark:text-gray-500 italic max-w-[160px] truncate">
                      {item.croisement_variete || '—'}
                    </td>
                    <td className="px-5 py-3 text-sm text-gray-600 dark:text-gray-300">{item.type_graines || '—'}</td>
                    <td className="px-5 py-3 text-sm text-gray-600 dark:text-gray-300">
                      {item.duree_flo_min && item.duree_flo_max ? `${item.duree_flo_min}–${item.duree_flo_max}j` : '—'}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-1.5">
                        {getStockBadge(item.nbr_graines_restantes)}
                        <span className="text-xs text-gray-400 dark:text-gray-500">/ {item.nbr_graines_total}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-sm text-gray-400 dark:text-gray-500" title={item.date_achat ? `Acheté le ${new Date(item.date_achat).toLocaleDateString('fr-FR')}` : ''}>
                      {ageLabel(item.date_achat)}
                    </td>
                    <td className="px-5 py-3 text-sm text-gray-600 dark:text-gray-300">
                      <span className="flex items-center gap-1">
                        {item.prix_par_graine == null ? '—' : item.prix_par_graine === 0 ? 'Gratuit' : `${item.prix_par_graine.toFixed(2)} €`}
                        {item.edition_limite && <Lock size={11} className="text-amber-500" title="Édition limitée" />}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-sm text-gray-400 dark:text-gray-500">
                      {item.date_achat ? new Date(item.date_achat).toLocaleDateString('fr-FR') : '—'}
                    </td>
                    <td className="px-5 py-3 text-right" onClick={e => e.stopPropagation()}>
                      {item.lien_web && (
                        <a href={item.lien_web} target="_blank" rel="noopener noreferrer" className="text-grow-500 hover:text-grow-700" title="Seedfinder / Site officiel">
                          <ExternalLink size={14} />
                        </a>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
