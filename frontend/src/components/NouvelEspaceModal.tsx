import { useState, useMemo } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  X, Loader2, Save, Search, CheckSquare, Square,
  Boxes, Ruler, Info, Wrench, Home,
} from 'lucide-react'
import { espacesAPI, EspaceCulture, EspaceCultureCreate, MaterielEnUse } from '../api/espaces'
import { materielAPI, Materiel } from '../api/materiel'

interface Props {
  editEspace?: EspaceCulture | null
  onClose: () => void
}

type TabKey = 'infos' | 'materiel'

const STATUTS = ['Actif', 'Inactif', 'Maintenance']

const inp = "w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-grow-500"
const sel = "w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-grow-500"

function Label({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">
      {children}{required && <span className="text-red-400 ml-0.5">*</span>}
    </label>
  )
}

const STATUT_COLORS: Record<string, string> = {
  'Actif':       'bg-green-100 text-green-700',
  'Inactif':     'bg-gray-100 text-gray-600 dark:text-gray-300',
  'Maintenance': 'bg-yellow-100 text-yellow-700',
}

// Catégories prioritaires pour l'affichage en tête
const CAT_PRIORITY = ['Box/Tente', 'Lampe', 'Ventilation', 'Irrigation', 'Chauffage', 'Filtration']

// Catégories considérées comme "espace de culture" (box/tente/chambre)
const BOX_CATS = ['box', 'tente', 'armoire', 'chambre', 'serre', 'outdoor', 'box/tente']

export default function NouvelEspaceModal({ editEspace, onClose }: Props) {
  const qc     = useQueryClient()
  const isEdit = !!editEspace
  const [activeTab, setActiveTab] = useState<TabKey>('infos')
  const [error, setError] = useState('')
  const [searchMat, setSearchMat] = useState('')
  const [filterCat, setFilterCat] = useState('all')

  const { data: allMateriel = [] } = useQuery<Materiel[]>({
    queryKey: ['materiel'],
    queryFn:  async () => (await materielAPI.getAll()).data,
  })

  const { data: materielEnUse = [] } = useQuery<MaterielEnUse[]>({
    queryKey: ['materiel-en-use'],
    queryFn:  async () => (await espacesAPI.getMaterielEnUse()).data,
  })

  // Map id_materiel → nom_espace pour le matériel utilisé dans un AUTRE espace
  const usedElsewhere = useMemo(() => {
    const map = new Map<number, string>()
    const currentEspaceId = editEspace?.id_espace
    for (const m of materielEnUse) {
      if (m.id_espace !== currentEspaceId) {
        map.set(m.id_materiel, m.nom_espace)
      }
    }
    return map
  }, [materielEnUse, editEspace])

  // Matériel filtrés comme "espaces/box" (exclu ceux dans un autre espace)
  const boxMateriel = useMemo(() =>
    allMateriel.filter(m => m.etat !== 'Hors service' &&
      !usedElsewhere.has(m.id_materiel) &&
      BOX_CATS.some(cat => m.categorie?.toLowerCase().includes(cat))
    ), [allMateriel, usedElsewhere])

  // Si aucun matériel box, on affiche tout (sauf ceux utilisés dans un autre espace)
  const boxOptions = useMemo(() =>
    boxMateriel.length > 0
      ? boxMateriel
      : allMateriel.filter(m => m.etat !== 'Hors service' && !usedElsewhere.has(m.id_materiel)),
    [boxMateriel, allMateriel, usedElsewhere])

  // Infos
  const [form, setForm] = useState({
    nom:                   editEspace?.nom                   ?? '',
    type_espace:           editEspace?.type_espace           ?? '',
    id_materiel_principal: editEspace?.id_materiel_principal != null ? String(editEspace.id_materiel_principal) : '',
    dimensions:            editEspace?.dimensions            ?? '',
    surface_m2:            editEspace?.surface_m2            != null ? String(editEspace.surface_m2) : '',
    hauteur_cm:            editEspace?.hauteur_cm            != null ? String(editEspace.hauteur_cm) : '',
    statut:                editEspace?.statut                ?? 'Actif',
    notes:                 editEspace?.notes                 ?? '',
  })

  // Liste d'IDs de matériel sélectionné
  const [selectedIds, setSelectedIds] = useState<Set<number>>(
    new Set(editEspace?.equipements.map(e => e.id_materiel) ?? [])
  )

  const toggleMateriel = (id: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  // Catégories disponibles
  const categories = useMemo(() => {
    const cats = new Set(allMateriel.map(m => m.categorie).filter(Boolean) as string[])
    const sorted = [...CAT_PRIORITY.filter(c => cats.has(c)), ...[...cats].filter(c => !CAT_PRIORITY.includes(c)).sort()]
    return sorted
  }, [allMateriel])

  // Matériel filtré
  const filteredMateriel = useMemo(() => {
    let res = allMateriel.filter(m => m.etat !== 'Hors service')
    if (filterCat !== 'all') res = res.filter(m => m.categorie === filterCat)
    if (searchMat) {
      const q = searchMat.toLowerCase()
      res = res.filter(m =>
        m.nom.toLowerCase().includes(q) ||
        m.marque?.toLowerCase().includes(q) ||
        m.categorie?.toLowerCase().includes(q)
      )
    }
    return res
  }, [allMateriel, filterCat, searchMat])

  const save = useMutation({
    mutationFn: () => {
      if (!form.nom.trim()) throw new Error('Le nom est obligatoire')
      const payload: EspaceCultureCreate = {
        nom:                   form.nom.trim(),
        type_espace:           form.type_espace  || undefined,
        id_materiel_principal: form.id_materiel_principal ? parseInt(form.id_materiel_principal) : undefined,
        dimensions:            form.dimensions   || undefined,
        surface_m2:            form.surface_m2   ? parseFloat(form.surface_m2) : undefined,
        hauteur_cm:            form.hauteur_cm   ? parseInt(form.hauteur_cm)   : undefined,
        statut:                form.statut       || 'Actif',
        notes:                 form.notes.trim() || undefined,
        equipements:           [...selectedIds].map(id => ({ id_materiel: id })),
      }
      return isEdit
        ? espacesAPI.update(editEspace!.id_espace, payload)
        : espacesAPI.create(payload)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['espaces'] })
      qc.invalidateQueries({ queryKey: ['materiel-en-use'] })
      onClose()
    },
    onError:   (e: any) => setError(e?.message ?? e?.response?.data?.detail ?? 'Erreur'),
  })

  const tabs: { key: TabKey; label: string; icon: React.ReactNode; count?: number }[] = [
    { key: 'infos',    label: 'Informations', icon: <Info size={14} /> },
    { key: 'materiel', label: 'Matériel',     icon: <Wrench size={14} />, count: selectedIds.size },
  ]

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-3xl max-h-[94vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <Boxes size={20} className="text-grow-600" />
            <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">
              {isEdit ? `Modifier — ${editEspace!.nom}` : 'Nouvel espace de culture'}
            </h2>
          </div>
          <button onClick={onClose} className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:text-gray-300"><X size={22} /></button>
        </div>

        {/* Onglets */}
        <div className="flex border-b border-gray-100 dark:border-gray-700 px-4 gap-1 shrink-0">
          {tabs.map(tab => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.key
                  ? 'border-grow-600 text-grow-700'
                  : 'border-transparent text-gray-500 dark:text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:text-gray-200'
              }`}
            >
              {tab.icon}
              {tab.label}
              {tab.count !== undefined && tab.count > 0 && (
                <span className="bg-grow-100 text-grow-700 text-xs rounded-full px-1.5 py-0.5">
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Corps */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {/* ── Onglet Infos ── */}
          {activeTab === 'infos' && (
            <div className="space-y-4">
              {/* Nom */}
              <div>
                <Label required>Nom de l'espace</Label>
                <input type="text" value={form.nom}
                  onChange={e => setForm(f => ({ ...f, nom: e.target.value }))}
                  placeholder="Ex: Tente A — 80x80, Box floraison principale…"
                  className={inp} />
              </div>

              {/* Box principal (Matériel) + Statut */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Box / Espace (matériel)</Label>
                  <select
                    value={form.id_materiel_principal}
                    onChange={e => {
                      const id = e.target.value
                      const m = allMateriel.find(x => String(x.id_materiel) === id)
                      setForm(f => ({
                        ...f,
                        id_materiel_principal: id,
                        // auto-remplir le nom si vide
                        nom: f.nom.trim() === '' && m ? m.nom : f.nom,
                        // déduire le type depuis la catégorie
                        type_espace: m?.categorie ?? f.type_espace,
                      }))
                    }}
                    className={sel}>
                    <option value="">— Aucun —</option>
                    {boxOptions.map(m => (
                      <option key={m.id_materiel} value={String(m.id_materiel)}>
                        {m.nom}{m.marque ? ` (${m.marque})` : ''}
                      </option>
                    ))}
                  </select>
                  {boxMateriel.length === 0 && allMateriel.length > 0 && (
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                      <Home size={10} className="inline mr-1" />
                      Aucun matériel Box/Tente — affichage de tout le matériel
                    </p>
                  )}
                </div>
                <div>
                  <Label>Statut</Label>
                  <select value={form.statut}
                    onChange={e => setForm(f => ({ ...f, statut: e.target.value }))}
                    className={sel}>
                    {STATUTS.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>

              {/* Type d'espace (déduit ou manuel) */}
              <div>
                <Label>Type d'espace</Label>
                <input type="text" value={form.type_espace}
                  onChange={e => setForm(f => ({ ...f, type_espace: e.target.value }))}
                  placeholder="Ex: Box, Tente, Armoire, Chambre…"
                  className={inp} />
              </div>

              {/* Dimensions */}
              <div>
                <Label>Dimensions</Label>
                <div className="relative">
                  <Ruler size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500" />
                  <input type="text" value={form.dimensions}
                    onChange={e => setForm(f => ({ ...f, dimensions: e.target.value }))}
                    placeholder="Ex: 80x80x200 cm ou 1.2m x 1.2m"
                    className={`${inp} pl-9`} />
                </div>
              </div>

              {/* Surface + Hauteur */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Surface (m²)</Label>
                  <input type="number" step="0.01" min="0" value={form.surface_m2}
                    onChange={e => setForm(f => ({ ...f, surface_m2: e.target.value }))}
                    placeholder="Ex: 0.64" className={inp} />
                </div>
                <div>
                  <Label>Hauteur utile (cm)</Label>
                  <input type="number" step="1" min="0" value={form.hauteur_cm}
                    onChange={e => setForm(f => ({ ...f, hauteur_cm: e.target.value }))}
                    placeholder="Ex: 180" className={inp} />
                </div>
              </div>

              {/* Notes */}
              <div>
                <Label>Notes</Label>
                <textarea rows={3} value={form.notes}
                  onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  placeholder="Observations, substrat utilisé, conditions particulières…"
                  className={`${inp} resize-none`} />
              </div>
            </div>
          )}

          {/* ── Onglet Matériel ── */}
          {activeTab === 'materiel' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500">
                  Sélectionnez le matériel assigné à cet espace.
                </p>
                <span className="text-xs font-medium text-grow-700 bg-grow-50 px-2 py-1 rounded-full">
                  {selectedIds.size} sélectionné{selectedIds.size > 1 ? 's' : ''}
                </span>
              </div>

              {/* Filtres */}
              <div className="flex gap-2 flex-wrap items-center">
                <div className="relative">
                  <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500" />
                  <input type="text" value={searchMat} onChange={e => setSearchMat(e.target.value)}
                    placeholder="Rechercher…"
                    className="pl-8 pr-3 py-1.5 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-grow-400 w-44" />
                </div>
                <div className="flex gap-1 flex-wrap">
                  <button onClick={() => setFilterCat('all')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${filterCat === 'all' ? 'bg-grow-600 text-white' : 'bg-gray-100 text-gray-600 dark:text-gray-300 hover:bg-gray-200'}`}>
                    Tout
                  </button>
                  {categories.map(c => (
                    <button key={c} onClick={() => setFilterCat(c)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${filterCat === c ? 'bg-grow-600 text-white' : 'bg-gray-100 text-gray-600 dark:text-gray-300 hover:bg-gray-200'}`}>
                      {c}
                    </button>
                  ))}
                </div>
              </div>

              {/* Liste du matériel */}
              {filteredMateriel.length === 0 ? (
                <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-6">
                  {allMateriel.length === 0
                    ? 'Aucun matériel en stock — ajoutez du matériel dans la page Matériel'
                    : 'Aucun résultat pour cette recherche'}
                </p>
              ) : (
                <div className="grid gap-1.5 max-h-80 overflow-y-auto pr-1">
                  {filteredMateriel.map(m => {
                    const checked    = selectedIds.has(m.id_materiel)
                    const takenByEsp = usedElsewhere.get(m.id_materiel)
                    const disabled   = !!takenByEsp
                    return (
                      <button key={m.id_materiel}
                        onClick={() => !disabled && toggleMateriel(m.id_materiel)}
                        disabled={disabled}
                        title={disabled ? `Déjà utilisé dans : ${takenByEsp}` : undefined}
                        className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-colors text-left ${
                          disabled
                            ? 'border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50 opacity-50 cursor-not-allowed'
                            : checked
                              ? 'border-grow-300 bg-grow-50'
                              : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700/40'
                        }`}>
                        <span className={disabled ? 'text-gray-200' : checked ? 'text-grow-600' : 'text-gray-300'}>
                          {checked ? <CheckSquare size={16} /> : <Square size={16} />}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className={`text-sm font-medium truncate ${disabled ? 'text-gray-400 dark:text-gray-500' : 'text-gray-800 dark:text-gray-100'}`}>{m.nom}</span>
                            {m.marque && <span className="text-xs text-gray-400 dark:text-gray-500">{m.marque}</span>}
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-xs text-gray-400 dark:text-gray-500">{m.categorie}</span>
                            {disabled
                              ? <span className="text-xs text-orange-400">Utilisé dans : {takenByEsp}</span>
                              : m.etat && m.etat !== 'Bon état' && (
                                  <span className="text-xs text-amber-500">{m.etat}</span>
                                )
                            }
                          </div>
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {error && <p className="text-xs text-red-500 mt-3">{error}</p>}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 dark:border-gray-700 flex justify-between items-center">
          <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${STATUT_COLORS[form.statut] ?? 'bg-gray-100 text-gray-500 dark:text-gray-400 dark:text-gray-500'}`}>
            {form.statut}
          </span>
          <div className="flex gap-3">
            <button onClick={onClose}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 text-sm rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/40">
              Annuler
            </button>
            <button onClick={() => save.mutate()} disabled={save.isPending || !form.nom.trim()}
              className="flex items-center gap-2 px-4 py-2 bg-grow-600 text-white text-sm rounded-lg hover:bg-grow-700 disabled:opacity-50">
              {save.isPending ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
              {isEdit ? 'Enregistrer' : 'Créer l\'espace'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
