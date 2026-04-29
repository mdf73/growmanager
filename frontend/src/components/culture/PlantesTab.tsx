import { useState } from 'react'
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query'
import { Leaf, Edit2, Check, X, Plus, Trash2, AlertTriangle, ArrowRightLeft } from 'lucide-react'
import { Plant, plantAPI, PlantUpdate, cultureUtilsAPI, PotItem, RecetteSolItem } from '../../api/cultures'
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
  const [showAddForm, setShowAddForm] = useState(false)
  const [newPlantName, setNewPlantName] = useState('')
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

  const updatePlant = useMutation({
    mutationFn: ({ plantId, data }: { plantId: number; data: PlantUpdate }) =>
      plantAPI.update(cultureId, plantId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['culture', cultureId] })
      setEditingId(null)
    },
  })

  const addPlant = useMutation({
    mutationFn: (nom: string) =>
      plantAPI.add(cultureId, {
        nom_affichage: nom,
        origine: 'graine',
        statut: 'germination',
        numero_plant: plants.length + 1,
      } as Omit<Plant, 'id_plant' | 'id_culture'>),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['culture', cultureId] })
      setNewPlantName('')
      setShowAddForm(false)
    },
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

  const actives = plants.filter(p => !['recolte', 'prete', 'abandonne'].includes(p.statut || ''))
  const terminees = plants.filter(p => ['recolte', 'prete', 'abandonne'].includes(p.statut || ''))

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
        <span className="text-sm text-gray-500">{plants.length} plante{plants.length > 1 ? 's' : ''}</span>
        <button
          onClick={() => setShowAddForm(v => !v)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-grow-600 text-white rounded-lg text-xs hover:bg-grow-700"
        >
          <Plus size={13} /> Ajouter une plante
        </button>
      </div>

      {/* Add plant inline form */}
      {showAddForm && (
        <div className="bg-grow-50 border border-grow-200 rounded-xl p-3 flex items-center gap-2">
          <input
            autoFocus
            type="text"
            placeholder="Nom de la plante (ex: OG Kush #4)"
            value={newPlantName}
            onChange={e => setNewPlantName(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && newPlantName.trim()) addPlant.mutate(newPlantName.trim())
              if (e.key === 'Escape') setShowAddForm(false)
            }}
            className="flex-1 px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-grow-500 focus:border-transparent"
          />
          <button
            onClick={() => { if (newPlantName.trim()) addPlant.mutate(newPlantName.trim()) }}
            disabled={!newPlantName.trim() || addPlant.isPending}
            className="px-3 py-1.5 bg-grow-600 text-white rounded-lg text-xs hover:bg-grow-700 disabled:opacity-50"
          >
            <Check size={13} />
          </button>
          <button onClick={() => setShowAddForm(false)} className="px-2 py-1.5 text-gray-500 hover:text-gray-700">
            <X size={13} />
          </button>
        </div>
      )}

      {plants.length === 0 && !showAddForm && (
        <div className="text-center py-12 text-gray-400">
          <Leaf size={40} className="mx-auto mb-3 opacity-30" />
          <p>Aucune plante dans cette culture</p>
        </div>
      )}

      {actives.length > 0 && (
        <section>
          <h3 className="text-sm font-semibold text-gray-600 mb-2 uppercase tracking-wide">
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
          <h3 className="text-sm font-semibold text-gray-600 mb-2 uppercase tracking-wide">
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
  const colorClass = STATUT_COLORS[statut] || 'bg-gray-100 text-gray-600'
  const showSolVivant = (editing ? editValues.substrat : plant.substrat) === 'sol_vivant'
  const showPot = ['terre', 'sol_vivant', 'coco'].includes(editing ? editValues.substrat || '' : plant.substrat || '')

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4">
      {editing ? (
        <div className="space-y-3">
          {/* Nom + statut */}
          <div className="grid grid-cols-2 gap-2">
            <input type="text" value={editValues.nom_affichage || ''}
              onChange={e => onEditChange({ ...editValues, nom_affichage: e.target.value })}
              className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm font-medium" />
            <select value={editValues.statut || ''}
              onChange={e => onEditChange({ ...editValues, statut: e.target.value })}
              className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm">
              {Object.entries(STATUT_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>

          {/* Substrat */}
          <div>
            <label className="block text-xs text-gray-500 mb-1">Substrat</label>
            <div className="flex flex-wrap gap-1.5">
              {SUBSTRAT_OPTIONS.map(([k, v]) => (
                <button key={k} type="button"
                  onClick={() => onEditChange({ ...editValues, substrat: editValues.substrat === k ? undefined : k })}
                  className={`px-2.5 py-1 rounded-full text-xs border transition-colors
                    ${editValues.substrat === k
                      ? 'bg-grow-600 border-grow-600 text-white'
                      : 'border-gray-200 text-gray-600 hover:border-grow-300'}`}>
                  {v}
                </button>
              ))}
            </div>
          </div>

          {/* Recette sol (si sol vivant) */}
          {showSolVivant && recettesSol.length > 0 && (
            <div>
              <label className="block text-xs text-gray-500 mb-1">Recette sol vivant</label>
              <select value={editValues.id_recette_sol || ''}
                onChange={e => onEditChange({ ...editValues, id_recette_sol: Number(e.target.value) || undefined })}
                className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm">
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
                <label className="block text-xs text-gray-500 mb-1">Pot inventaire</label>
                <select value={editValues.id_pot || ''}
                  onChange={e => onEditChange({ ...editValues, id_pot: Number(e.target.value) || undefined })}
                  className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm">
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
                <label className="block text-xs text-gray-500 mb-1">Volume (L)</label>
                <input type="number" value={editValues.volume_pot_l || ''}
                  onChange={e => onEditChange({ ...editValues, volume_pot_l: Number(e.target.value) || undefined })}
                  placeholder="ex: 15" min={0} step={0.5}
                  className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm" />
              </div>
            </div>
          )}

          {/* Notes */}
          <textarea value={editValues.notes || ''}
            onChange={e => onEditChange({ ...editValues, notes: e.target.value })}
            placeholder="Notes…" rows={2}
            className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm resize-none" />

          <div className="flex gap-2">
            <button onClick={onSave} disabled={saving}
              className="flex items-center gap-1 px-3 py-1.5 bg-grow-600 text-white rounded-lg text-xs hover:bg-grow-700 disabled:opacity-50">
              <Check size={12} /> Enregistrer
            </button>
            <button onClick={onCancel}
              className="flex items-center gap-1 px-3 py-1.5 border border-gray-300 rounded-lg text-xs text-gray-600 hover:bg-gray-50">
              <X size={12} /> Annuler
            </button>
          </div>
        </div>
      ) : (
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-gray-900">{plant.nom_affichage}</span>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${colorClass}`}>
                {STATUT_LABELS[statut] || statut}
              </span>
            </div>
            {plant.nom_variete && (
              <p className="text-xs text-gray-500 mt-0.5">
                {plant.nom_breeder ? `${plant.nom_breeder} — ` : ''}{plant.nom_variete}
                {plant.duree_flo_min ? ` · Flo: ${plant.duree_flo_min}${plant.duree_flo_max ? `–${plant.duree_flo_max}` : ''}sem` : ''}
              </p>
            )}
            <div className="flex flex-wrap gap-3 mt-1.5 text-xs text-gray-500">
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
              <p className="text-xs text-gray-400 mt-1 italic">{plant.notes}</p>
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
                  className="px-1.5 py-0.5 border border-gray-300 text-gray-600 text-xs rounded">
                  Non
                </button>
              </div>
            ) : (
              <>
                <button onClick={onStartEdit} className="p-1 text-gray-400 hover:text-gray-600" title="Modifier">
                  <Edit2 size={14} />
                </button>
                <button onClick={onTransfer} className="p-1 text-gray-400 hover:text-grow-600" title="Déplacer vers une autre culture">
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
