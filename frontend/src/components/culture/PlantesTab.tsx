import { useState } from 'react'
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query'
import { Leaf, Edit2, Check, X, Plus, Trash2, AlertTriangle, ArrowRightLeft, Sprout, Search } from 'lucide-react'
import { Plant, plantAPI, PlantUpdate, cultureUtilsAPI, PotItem, RecetteSolItem } from '../../api/cultures'
import { catalogueAPI, packCompletAPI, CatalogueItem } from '../../api/graines'
import TransfertPlantModal from './TransfertPlantModal'

const STATUT_COLORS: Record<string, string> = {
  germination: 'bg-green-100 text-green-700',
  veg:         'bg-lime-100 text-lime-700',
  floraison:   'bg-purple-100 text-purple-700',
  sechage:     'bg-yellow-100 text-yellow-700',
  curing:      'bg-rose-100 text-rose-700',
  prete:       'bg-emerald-100 text-emerald-700',
  recolte:     'bg-blue-100 text-blue-700',
  abandonne:   'bg-red-100 text-red-700',
  wpff:        'bg-cyan-100 text-cyan-700',
}

const STATUT_LABELS: Record<string, string> = {
  germination: 'Germination',
  veg:         'Végétation',
  floraison:   'Floraison',
  sechage:     'Séchage',
  curing:      'Curing 🏺',
  prete:       'Prête ✅',
  recolte:     'Récoltée',
  abandonne:   'Abandonnée',
  wpff:        'WPFF ❄️',
}

const SUBSTRAT_LABELS: Record<string, string> = {
  terre:      '🌱 Terre',
  sol_vivant: '🦠 Sol vivant',
  coco:       '🥥 Coco',
  hydro:      '💧 Hydro',
  autre:      '📦 Autre',
}

const SUBSTRAT_OPTIONS = Object.entries(SUBSTRAT_LABELS)

interface Props {
  cultureId: number
  plants: Plant[]
}

export default function PlantesTab({ cultureId, plants }: Props) {
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editValues, setEditValues] = useState<PlantUpdate>({})
  const [showSeedPicker, setShowSeedPicker] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [addingPackId, setAddingPackId] = useState<number | null>(null)
  const [transferPlant, setTransferPlant] = useState<Plant | null>(null)
  const qc = useQueryClient()

  const { data: pots = [] } = useQuery<PotItem[]>({
    queryKey: ['pots'],
    queryFn: async () => (await cultureUtilsAPI.getPots()).data,
  })

  const { data: recettesSol = [] } = useQuery<RecetteSolItem[]>({
    queryKey: ['recettes-sol'],
    queryFn: async () => (await cultureUtilsAPI.getRecettesSol()).data,
  })

  const { data: catalogue = [], isLoading: catalogueLoading } = useQuery<CatalogueItem[]>({
    queryKey: ['catalogue'],
    queryFn: async () => (await catalogueAPI.get()).data,
    enabled: showSeedPicker,
  })

  const updatePlant = useMutation({
    mutationFn: ({ plantId, data }: { plantId: number; data: PlantUpdate }) =>
      plantAPI.update(cultureId, plantId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['culture', cultureId] })
      setEditingId(null)
    },
  })

  const addFromPack = useMutation({
    mutationFn: async (pack: CatalogueItem) => {
      setAddingPackId(pack.id_packgraine)
      // Récupère les graines de ce pack et prend la première disponible
      const res = await packCompletAPI.getGraines(pack.id_packgraine)
      const available = res.data.filter(g => !g.utilisee)
      if (available.length === 0) throw new Error('Plus de graines disponibles')
      const graine = available[0]
      return plantAPI.add(cultureId, {
        nom_affichage: pack.variete_nom,
        origine: 'graine',
        statut: 'germination',
        numero_plant: plants.length + 1,
        id_graine: graine.id_graine,
      } as Omit<Plant, 'id_plant' | 'id_culture'>)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['culture', cultureId] })
      qc.invalidateQueries({ queryKey: ['catalogue'] })
      setAddingPackId(null)
    },
    onError: () => setAddingPackId(null),
  })

  const deletePlant = useMutation({
    mutationFn: (plantId: number) => plantAPI.delete(cultureId, plantId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['culture', cultureId] }),
  })

  function startEdit(plant: Plant) {
    setEditingId(plant.id_plant)
    setEditValues({
      nom_affichage: plant.nom_affichage,
      statut: plant.statut,
      substrat: plant.substrat,
      id_recette_sol: plant.id_recette_sol,
      id_pot: plant.id_pot,
      volume_pot_l: plant.volume_pot_l,
      notes: plant.notes,
    })
  }

  function saveEdit(plantId: number) {
    updatePlant.mutate({ plantId, data: editValues })
  }

  const actives = plants.filter(p => !['recolte', 'prete', 'abandonne', 'wpff'].includes(p.statut || ''))
  const terminees = plants.filter(p => ['recolte', 'prete', 'abandonne', 'wpff'].includes(p.statut || ''))

  return (
    <div className="space-y-4">
      {/* Modal transfert */}
      {transferPlant && (
        <TransfertPlantModal
          plant={transferPlant}
          cultureId={cultureId}
          onClose={() => setTransferPlant(null)}
        />
      )}

      {/* Header with add button */}
      <div className="flex items-center justify-between">
        <span className="text-sm text-gray-500 dark:text-gray-400">{plants.length} plante{plants.length > 1 ? 's' : ''}</span>
        <button
          onClick={() => { setShowSeedPicker(v => !v); setSearchQuery('') }}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-colors ${
            showSeedPicker
              ? 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200'
              : 'bg-grow-600 text-white hover:bg-grow-700'
          }`}
        >
          {showSeedPicker ? <X size={13} /> : <Plus size={13} />}
          {showSeedPicker ? 'Fermer' : 'Ajouter une plante'}
        </button>
      </div>

      {/* Seed picker panel */}
      {showSeedPicker && (
        <div className="border border-grow-200 dark:border-grow-800 rounded-xl overflow-hidden">
          {/* Search bar */}
          <div className="flex items-center gap-2 px-3 py-2 bg-grow-50 dark:bg-grow-900/20 border-b border-grow-200 dark:border-grow-800">
            <Search size={14} className="text-grow-500 flex-shrink-0" />
            <input
              autoFocus
              type="text"
              placeholder="Rechercher une variété…"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="flex-1 bg-transparent text-sm outline-none placeholder-gray-400 dark:placeholder-gray-500 text-gray-800 dark:text-gray-100"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                <X size={13} />
              </button>
            )}
          </div>

          {/* Seed list */}
          <SeedList
            catalogue={catalogue}
            loading={catalogueLoading}
            searchQuery={searchQuery}
            addingPackId={addingPackId}
            isPending={addFromPack.isPending}
            onAdd={pack => addFromPack.mutate(pack)}
          />
        </div>
      )}

      {plants.length === 0 && !showSeedPicker && (
        <div className="text-center py-12 text-gray-400 dark:text-gray-500">
          <Leaf size={40} className="mx-auto mb-3 opacity-30" />
          <p>Aucune plante dans cette culture</p>
        </div>
      )}

      {actives.length > 0 && (
        <section>
          <h3 className="text-sm font-semibold text-gray-600 dark:text-gray-300 mb-2 uppercase tracking-wide">
            Plantes actives ({actives.length})
          </h3>
          <div className="space-y-2">
            {actives.map(plant => (
              <PlantCard key={plant.id_plant} plant={plant}
                editing={editingId === plant.id_plant} editValues={editValues}
                pots={pots} recettesSol={recettesSol}
                onStartEdit={() => startEdit(plant)}
                onEditChange={setEditValues}
                onSave={() => saveEdit(plant.id_plant)}
                onCancel={() => setEditingId(null)}
                onDelete={() => deletePlant.mutate(plant.id_plant)}
                onTransfer={() => setTransferPlant(plant)}
                saving={updatePlant.isPending} />
            ))}
          </div>
        </section>
      )}

      {terminees.length > 0 && (
        <section>
          <h3 className="text-sm font-semibold text-gray-600 dark:text-gray-300 mb-2 uppercase tracking-wide">
            Terminées ({terminees.length})
          </h3>
          <div className="space-y-2 opacity-70">
            {terminees.map(plant => (
              <PlantCard key={plant.id_plant} plant={plant}
                editing={editingId === plant.id_plant} editValues={editValues}
                pots={pots} recettesSol={recettesSol}
                onStartEdit={() => startEdit(plant)}
                onEditChange={setEditValues}
                onSave={() => saveEdit(plant.id_plant)}
                onCancel={() => setEditingId(null)}
                onDelete={() => deletePlant.mutate(plant.id_plant)}
                onTransfer={() => setTransferPlant(plant)}
                saving={updatePlant.isPending} />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

function SeedList({
  catalogue, loading, searchQuery, addingPackId, isPending, onAdd
}: {
  catalogue: CatalogueItem[]
  loading: boolean
  searchQuery: string
  addingPackId: number | null
  isPending: boolean
  onAdd: (pack: CatalogueItem) => void
}) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-8 text-gray-400 text-sm gap-2 bg-white dark:bg-gray-800">
        <Sprout size={16} className="animate-pulse" /> Chargement…
      </div>
    )
  }

  const available = catalogue.filter(p => p.nbr_graines_restantes > 0)

  if (available.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-gray-400 dark:text-gray-500 text-sm gap-2 bg-white dark:bg-gray-800">
        <Sprout size={24} className="opacity-40" />
        <span>Aucune graine en stock</span>
      </div>
    )
  }

  const filtered = searchQuery.trim()
    ? available.filter(p =>
        `${p.breeder_nom} ${p.variete_nom}`.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : available

  if (filtered.length === 0) {
    return (
      <div className="py-6 text-center text-sm text-gray-400 dark:text-gray-500 bg-white dark:bg-gray-800">
        Aucune variété ne correspond à « {searchQuery} »
      </div>
    )
  }

  return (
    <div className="max-h-64 overflow-y-auto divide-y divide-gray-100 dark:divide-gray-700/60 bg-white dark:bg-gray-800">
      {filtered.map(pack => {
        const isAdding = addingPackId === pack.id_packgraine
        return (
          <div
            key={pack.id_packgraine}
            className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-700/40 transition-colors"
          >
            <Leaf size={13} className="text-grow-500 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <span className="text-sm font-medium text-gray-800 dark:text-gray-100 truncate block">
                {pack.variete_nom}
              </span>
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {pack.breeder_nom}
                {pack.duree_flo_min ? ` · ${pack.duree_flo_min}${pack.duree_flo_max ? `–${pack.duree_flo_max}` : ''} sem` : ''}
              </span>
            </div>
            <span className={`text-xs px-2 py-0.5 rounded-full flex-shrink-0 font-medium ${
              pack.nbr_graines_restantes === 1
                ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'
                : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
            }`}>
              {pack.nbr_graines_restantes} graine{pack.nbr_graines_restantes > 1 ? 's' : ''}
            </span>
            <button
              onClick={() => onAdd(pack)}
              disabled={isAdding || isPending}
              title={`Ajouter une plante — ${pack.variete_nom}`}
              className="flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-full bg-grow-600 text-white hover:bg-grow-700 disabled:opacity-50 transition-colors"
            >
              {isAdding ? (
                <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Plus size={14} />
              )}
            </button>
          </div>
        )
      })}
    </div>
  )
}

function PlantCard({
  plant, editing, editValues, pots, recettesSol,
  onStartEdit, onEditChange, onSave, onCancel, onDelete, onTransfer, saving
}: {
  plant: Plant
  editing: boolean
  editValues: PlantUpdate
  pots: PotItem[]
  recettesSol: RecetteSolItem[]
  onStartEdit: () => void
  onEditChange: (v: PlantUpdate) => void
  onSave: () => void
  onCancel: () => void
  onDelete: () => void
  onTransfer: () => void
  saving: boolean
}) {
  const [confirmDelete, setConfirmDelete] = useState(false)
  const statut = plant.statut || 'germination'
  const colorClass = STATUT_COLORS[statut] || 'bg-gray-100 text-gray-600 dark:text-gray-300'
  const showSolVivant = (editing ? editValues.substrat : plant.substrat) === 'sol_vivant'
  const showPot = ['terre', 'sol_vivant', 'coco'].includes(editing ? editValues.substrat || '' : plant.substrat || '')

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4">
      {editing ? (
        <div className="space-y-3">
          {/* Nom + statut */}
          <div className="grid grid-cols-2 gap-2">
            <input type="text" value={editValues.nom_affichage || ''}
              onChange={e => onEditChange({ ...editValues, nom_affichage: e.target.value })}
              className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium" />
            <select value={editValues.statut || ''}
              onChange={e => onEditChange({ ...editValues, statut: e.target.value })}
              className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm">
              {Object.entries(STATUT_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>

          {/* Substrat */}
          <div>
            <label className="block text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500 mb-1">Substrat</label>
            <div className="flex flex-wrap gap-1.5">
              {SUBSTRAT_OPTIONS.map(([k, v]) => (
                <button key={k} type="button"
                  onClick={() => onEditChange({ ...editValues, substrat: editValues.substrat === k ? undefined : k })}
                  className={`px-2.5 py-1 rounded-full text-xs border transition-colors
                    ${editValues.substrat === k
                      ? 'bg-grow-600 border-grow-600 text-white'
                      : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:border-grow-300'}`}>
                  {v}
                </button>
              ))}
            </div>
          </div>

          {/* Recette sol (si sol vivant) */}
          {showSolVivant && recettesSol.length > 0 && (
            <div>
              <label className="block text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500 mb-1">Recette sol vivant</label>
              <select value={editValues.id_recette_sol || ''}
                onChange={e => onEditChange({ ...editValues, id_recette_sol: Number(e.target.value) || undefined })}
                className="w-full px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm">
                <option value="">Aucune</option>
                {recettesSol.map(r => (
                  <option key={r.id_recette_lso} value={r.id_recette_lso}>{r.nom_recette}</option>
                ))}
              </select>
            </div>
          )}

          {/* Pot */}
          {showPot && (
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500 mb-1">Pot inventaire</label>
                <select value={editValues.id_pot || ''}
                  onChange={e => onEditChange({ ...editValues, id_pot: Number(e.target.value) || undefined })}
                  className="w-full px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm">
                  <option value="">Aucun</option>
                  {pots.map(p => {
                    // Un pot en cours est désactivé, sauf s'il est déjà le pot de cette plante
                    const isMine = p.id_pot === plant.id_pot
                    const disabled = p.en_cours && !isMine
                    const vol = p.volume_l ?? p.taille_pot
                    return (
                      <option key={p.id_pot} value={p.id_pot} disabled={disabled}>
                        {disabled ? '🔒 ' : ''}{p.dimension_pot || ''}{vol ? ` — ${vol} L` : ''}{disabled ? ` (${p.nom_culture_en_cours})` : ''}
                      </option>
                    )
                  })}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500 mb-1">Volume (L)</label>
                <input type="number" value={editValues.volume_pot_l || ''}
                  onChange={e => onEditChange({ ...editValues, volume_pot_l: Number(e.target.value) || undefined })}
                  placeholder="ex: 15" min={0} step={0.5}
                  className="w-full px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm" />
              </div>
            </div>
          )}

          {/* Notes */}
          <textarea value={editValues.notes || ''}
            onChange={e => onEditChange({ ...editValues, notes: e.target.value })}
            placeholder="Notes…" rows={2}
            className="w-full px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm resize-none" />

          <div className="flex gap-2">
            <button onClick={onSave} disabled={saving}
              className="flex items-center gap-1 px-3 py-1.5 bg-grow-600 text-white rounded-lg text-xs hover:bg-grow-700 disabled:opacity-50">
              <Check size={12} /> Enregistrer
            </button>
            <button onClick={onCancel}
              className="flex items-center gap-1 px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg text-xs text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/40">
              <X size={12} /> Annuler
            </button>
          </div>
        </div>
      ) : (
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-gray-900 dark:text-gray-100">{plant.nom_affichage}</span>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${colorClass}`}>
                {STATUT_LABELS[statut] || statut}
              </span>
            </div>
            {plant.nom_variete && (
              <p className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500 mt-0.5">
                {plant.nom_breeder ? `${plant.nom_breeder} — ` : ''}{plant.nom_variete}
                {plant.duree_flo_min ? ` · Flo: ${plant.duree_flo_min}${plant.duree_flo_max ? `–${plant.duree_flo_max}` : ''}sem` : ''}
              </p>
            )}
            <div className="flex flex-wrap gap-3 mt-1.5 text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500">
              {plant.substrat && (
                <span>{SUBSTRAT_LABELS[plant.substrat] || plant.substrat}</span>
              )}
              {(plant.volume_pot_l || plant.taille_pot) && (
                <span>🪴 {plant.volume_pot_l || plant.taille_pot}L</span>
              )}
              {plant.nom_recette_sol && (
                <span>🧪 {plant.nom_recette_sol}</span>
              )}
              {plant.date_germination && (
                <span>🌱 {new Date(plant.date_germination + 'T12:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}</span>
              )}
              {plant.date_debut_flo && (
                <span>🌸 {new Date(plant.date_debut_flo + 'T12:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}</span>
              )}
              {plant.date_recolte && (
                <span>🌾 {new Date(plant.date_recolte + 'T12:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}</span>
              )}
              {plant.poids_recolte_g != null && (
                <span className="font-semibold text-green-700">⚖️ {plant.poids_recolte_g}g</span>
              )}
            </div>
            {plant.notes && (
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1 italic">{plant.notes}</p>
            )}
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            {confirmDelete ? (
              <div className="flex items-center gap-1.5 px-2 py-1 bg-red-50 border border-red-200 rounded-lg">
                <AlertTriangle size={11} className="text-red-600" />
                <span className="text-xs text-red-700">Supprimer ?</span>
                <button onClick={() => { onDelete(); setConfirmDelete(false) }}
                  className="px-1.5 py-0.5 bg-red-600 text-white text-xs rounded hover:bg-red-700">
                  Oui
                </button>
                <button onClick={() => setConfirmDelete(false)}
                  className="px-1.5 py-0.5 border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 text-xs rounded">
                  Non
                </button>
              </div>
            ) : (
              <>
                <button onClick={onStartEdit} className="p-1 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:text-gray-300" title="Modifier">
                  <Edit2 size={14} />
                </button>
                <button onClick={onTransfer} className="p-1 text-gray-400 dark:text-gray-500 hover:text-grow-600" title="Déplacer vers une autre culture">
                  <ArrowRightLeft size={14} />
                </button>
                <button onClick={() => setConfirmDelete(true)} className="p-1 text-gray-300 hover:text-red-500" title="Supprimer">
                  <Trash2 size={13} />
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
