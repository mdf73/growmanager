import { useState, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import {
  X, Download, Upload, CheckCircle2, AlertTriangle, Loader2, FileText,
} from 'lucide-react'
import { triggerExport, importCSV, ImportTarget, ImportResult } from '../api/importExport'

interface ImportExportModalProps {
  onClose: () => void
  defaultTab?: Tab
}

type Tab = ImportTarget

interface TabConfig {
  key: Tab
  label: string
  exportFilename: string
  colonnes: string[]
  invalidateKeys: string[]
}

const TABS: TabConfig[] = [
  {
    key: 'breeders',
    label: 'Breeders',
    exportFilename: 'breeders.csv',
    colonnes: ['nom_breeder *', 'origine_breeder', 'information_breeder'],
    invalidateKeys: ['breeders'],
  },
  {
    key: 'varietes',
    label: 'Variétés',
    exportFilename: 'varietes.csv',
    colonnes: ['nom_variete *', 'croisement_variete', 'lien_web', 'informations_variete'],
    invalidateKeys: ['varietes', 'catalogue'],
  },
  {
    key: 'packs',
    label: 'Packs de graines',
    exportFilename: 'packs_graines.csv',
    colonnes: [
      'breeder_nom *', 'variete_nom *', 'croisement_variete',
      'type_graines', 'duree_flo_min', 'duree_flo_max',
      'nbr_graines', 'prix_achat', 'date_achat (AAAA-MM-JJ)',
      'edition_limite (0/1)', 'fournisseur_nom', 'lien_web',
    ],
    invalidateKeys: ['catalogue', 'breeders', 'varietes'],
  },
  {
    key: 'stock',
    label: 'Stock',
    exportFilename: 'stock.csv',
    colonnes: [
      'variete_nom', 'type_stock', 'sous_type_stock (Indoor/Outdoor)',
      'lampe_type', 'engrais_type', 'quantite_stock * (g)', 'date_stock (AAAA-MM-JJ)',
    ],
    invalidateKeys: ['stock'],
  },
  {
    key: 'extractions',
    label: 'Extractions',
    exportFilename: 'extractions_rosin.csv',
    colonnes: [
      'variete_nom', 'date_extraction (AAAA-MM-JJ)',
      'temperature (°C)', 'maillage', 'duree_preheat_sec', 'duree_extraction_sec',
      'sac_1_poids (g)', 'sac_2_poids (g)', 'sac_3_poids (g)', 'sac_4_poids (g)',
      'poids_entree * (g)',
      'presse_1_poids (g)', 'presse_2_poids (g)', 'presse_3_poids (g)', 'presse_4_poids (g)',
      'poids_sortie * (g)',
    ],
    invalidateKeys: ['rosin-extractions', 'rosin-stats'],
  },
  {
    key: 'historique-cultures',
    label: 'Cultures',
    exportFilename: 'historique_cultures.csv',
    colonnes: [
      'variete_nom', 'date_debut (AAAA-MM-JJ)', 'date_fin (AAAA-MM-JJ)',
      'nombre_plants', 'nombre_plants_total',
      'prix_variete (€)', 'prix_total_graines (€)',
      'tente', 'lampe', 'puissance (W)',
      'type_culture', 'engrais',
      'quantite_par_plant (g)', 'quantite_totale (g)', 'notes',
    ],
    invalidateKeys: ['historique-cultures'],
  },
  {
    key: 'extractions-hash',
    label: 'Hash',
    exportFilename: 'extractions_hash.csv',
    colonnes: [
      'variete_nom', 'date_extraction (AAAA-MM-JJ)',
      'poids_entree * (g)', 'poids_sortie * (g)', 'notes',
    ],
    invalidateKeys: ['hash-extractions', 'hash-stats'],
  },
  {
    key: 'materiel',
    label: 'Matériel',
    exportFilename: 'materiel.csv',
    colonnes: [
      'categorie *', 'nom *', 'marque', 'code_barre_serial',
      'date_achat (AAAA-MM-JJ)', 'prix_achat (€)', 'site_achat',
      'etat (Neuf/Bon état/Usagé/Hors service)', 'notes',
      'caracteristiques (JSON)',
    ],
    invalidateKeys: ['materiel'],
  },
  {
    key: 'engrais',
    label: 'Sols & Engrais',
    exportFilename: 'sols_engrais.csv',
    colonnes: [
      'nom_produit *', 'marque',
      'type_produit (Liquide/Solide/Poudre/Granulés/Feuilles/Autre)',
      'conditionnement (Bouteille/Pot/Sachet/Bidon/Tube/Boîte/Autre)',
      'volume_conditionnement', 'unite_volume (mL/L/g/Kg)',
      'prix_achat (€)', 'date_achat (AAAA-MM-JJ)', 'date_peremption (AAAA-MM-JJ)',
      'quantite_stock', 'unite_quantite (mL/L/g/Kg)',
      'dosage_conseille', 'notes',
    ],
    invalidateKeys: ['engrais'],
  },
]

type ImportState = 'idle' | 'loading' | 'success' | 'error'

export default function ImportExportModal({ onClose, defaultTab }: ImportExportModalProps) {
  const queryClient = useQueryClient()
  const [tab, setTab] = useState<Tab>(defaultTab ?? 'breeders')
  const [importState, setImportState] = useState<ImportState>('idle')
  const [importResult, setImportResult] = useState<ImportResult | null>(null)
  const [importError, setImportError] = useState('')
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const config = TABS.find(t => t.key === tab)!

  const resetImport = () => {
    setImportState('idle')
    setImportResult(null)
    setImportError('')
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleTabChange = (newTab: Tab) => {
    setTab(newTab)
    resetImport()
  }

  const handleFile = async (file: File) => {
    if (!file.name.endsWith('.csv')) {
      setImportError('Seuls les fichiers .csv sont acceptés')
      setImportState('error')
      return
    }
    setImportState('loading')
    setImportResult(null)
    setImportError('')
    try {
      const result = await importCSV(tab, file)
      setImportResult(result)
      setImportState('success')
      config.invalidateKeys.forEach(k => queryClient.invalidateQueries({ queryKey: [k] }))
    } catch {
      setImportError('Erreur lors de l\'import. Vérifiez le format du fichier.')
      setImportState('error')
    }
  }

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files?.[0]
    if (file) handleFile(file)
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[85vh]">

        {/* Header */}
        <div className="border-b border-gray-100 dark:border-gray-700 shrink-0">
          <div className="flex items-center justify-between px-6 py-4">
            <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">Import / Export</h2>
            <button onClick={onClose} className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:text-gray-300">
              <X size={22} />
            </button>
          </div>
          {/* Tabs — scrollable on small screens */}
          <div className="overflow-x-auto scrollbar-none px-4 pb-0">
            <div className="flex gap-1 min-w-max pb-0">
              {TABS.map(t => (
                <button
                  key={t.key}
                  onClick={() => handleTabChange(t.key)}
                  className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                    tab === t.key
                      ? 'border-grow-600 text-grow-700'
                      : 'border-transparent text-gray-500 dark:text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:text-gray-200 hover:border-gray-300 dark:border-gray-600'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Contenu */}
        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-6">

          {/* ── EXPORT ── */}
          <section>
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-3 flex items-center gap-2">
              <Download size={15} className="text-grow-600" />
              Exporter
            </h3>
            <div className="flex items-center justify-between bg-gray-50 dark:bg-gray-700/50 rounded-lg px-4 py-3">
              <div>
                <p className="text-sm text-gray-700 dark:text-gray-200">
                  Télécharger tous les <span className="font-medium">{config.label.toLowerCase()}</span> en CSV
                </p>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                  Format compatible Excel (séparateur <code>;</code>, UTF-8)
                </p>
              </div>
              <button
                onClick={() => triggerExport(tab)}
                className="flex items-center gap-2 px-4 py-2 bg-grow-600 text-white text-sm font-medium rounded-lg hover:bg-grow-700 shrink-0 ml-4"
              >
                <Download size={15} />
                {config.exportFilename}
              </button>
            </div>
          </section>

          {/* ── IMPORT ── */}
          <section>
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-3 flex items-center gap-2">
              <Upload size={15} className="text-grow-600" />
              Importer
            </h3>

            {/* Format attendu */}
            <div className="mb-3 bg-blue-50 rounded-lg px-4 py-3">
              <p className="text-xs font-medium text-blue-700 mb-1.5 flex items-center gap-1.5">
                <FileText size={12} />
                Colonnes attendues dans le CSV (séparateur <code>;</code> ou <code>,</code>)
              </p>
              <div className="flex flex-wrap gap-1.5">
                {config.colonnes.map(c => (
                  <span
                    key={c}
                    className={`text-xs px-2 py-0.5 rounded font-mono ${
                      c.endsWith('*')
                        ? 'bg-blue-200 text-blue-800'
                        : 'bg-white dark:bg-gray-800 text-blue-600 border border-blue-200'
                    }`}
                  >
                    {c}
                  </span>
                ))}
              </div>
              <p className="text-xs text-blue-500 mt-1.5">* champs obligatoires</p>
            </div>

            {/* Zone de dépôt */}
            {importState !== 'success' && (
              <div
                onDragOver={e => { e.preventDefault(); setDragOver(true) }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => importState !== 'loading' && fileInputRef.current?.click()}
                className={`relative border-2 border-dashed rounded-lg px-6 py-8 text-center cursor-pointer transition-colors ${
                  dragOver
                    ? 'border-grow-500 bg-grow-50'
                    : importState === 'error'
                      ? 'border-red-300 bg-red-50'
                      : 'border-gray-300 dark:border-gray-600 hover:border-grow-400 hover:bg-gray-50 dark:hover:bg-gray-700/40'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  className="hidden"
                  onChange={handleFileInput}
                />
                {importState === 'loading' ? (
                  <div className="flex flex-col items-center gap-2 text-gray-500 dark:text-gray-400 dark:text-gray-500">
                    <Loader2 size={28} className="animate-spin text-grow-600" />
                    <span className="text-sm">Import en cours…</span>
                  </div>
                ) : importState === 'error' ? (
                  <div className="flex flex-col items-center gap-2">
                    <AlertTriangle size={28} className="text-red-400" />
                    <p className="text-sm text-red-600">{importError}</p>
                    <button
                      onClick={e => { e.stopPropagation(); resetImport() }}
                      className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500 underline mt-1"
                    >
                      Réessayer
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2 text-gray-400 dark:text-gray-500">
                    <Upload size={28} />
                    <p className="text-sm">
                      <span className="text-grow-600 font-medium">Choisir un fichier</span>
                      {' '}ou glisser-déposer ici
                    </p>
                    <p className="text-xs">.csv uniquement</p>
                  </div>
                )}
              </div>
            )}

            {/* Résultat */}
            {importState === 'success' && importResult && (
              <div className="rounded-lg border border-green-200 bg-green-50 px-5 py-4">
                <div className="flex items-center gap-2 mb-3">
                  <CheckCircle2 size={20} className="text-green-500" />
                  <span className="text-sm font-semibold text-green-800">Import terminé</span>
                </div>
                <div className="flex gap-6 text-sm mb-3">
                  <div>
                    <span className="text-2xl font-bold text-green-700">{importResult.created}</span>
                    <span className="text-green-600 ml-1">créé{importResult.created > 1 ? 's' : ''}</span>
                  </div>
                  {importResult.skipped > 0 && (
                    <div>
                      <span className="text-2xl font-bold text-amber-600">{importResult.skipped}</span>
                      <span className="text-amber-600 ml-1">ignoré{importResult.skipped > 1 ? 's' : ''}</span>
                      <span className="text-xs text-amber-500 block">déjà existants</span>
                    </div>
                  )}
                </div>
                {importResult.errors && importResult.errors.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {importResult.errors.map((e, i) => (
                      <p key={i} className="text-xs text-red-600 flex items-start gap-1">
                        <AlertTriangle size={11} className="mt-0.5 shrink-0" />
                        {e}
                      </p>
                    ))}
                  </div>
                )}
                <button
                  onClick={resetImport}
                  className="mt-3 text-xs text-green-700 underline"
                >
                  Importer un autre fichier
                </button>
              </div>
            )}
          </section>
        </div>

        <div className="px-6 py-3 border-t border-gray-100 dark:border-gray-700 shrink-0 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-100 text-gray-700 dark:text-gray-200 text-sm rounded-lg hover:bg-gray-200"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  )
}
