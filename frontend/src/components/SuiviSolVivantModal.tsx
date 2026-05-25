import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { X, Loader2, Save, Plus, Trash2 } from 'lucide-react'
import { suiviSolVivantAPI, SuiviSolVivant, SuiviSolVivantCreate } from '../api/suiviSolVivant'
import { materielAPI, Materiel } from '../api/materiel'
import { recetteLSOAPI, RecetteLSO } from '../api/recetteLSO'
import { recetteReamendementAPI, RecetteReamendement } from '../api/recetteReamendement'
import { recetteEngraisAPI, RecetteEngrais } from '../api/recetteEngrais'
import { recetteTCOAPI, RecetteTCO } from '../api/recetteTCO'
import { recetteFermentationAPI, RecetteFermentation } from '../api/recetteFermentation'

interface Props {
  editSuivi?: SuiviSolVivant | null
  onClose: () => void
}

const inp = "w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-grow-500"
const sel = "w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-grow-500"

function Label({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">
      {children}{required && <span className="text-red-400 ml-0.5">*</span>}
    </label>
  )
}

type TabKey = 'infos' | 'reamendements' | 'arrosages' | 'tcos' | 'fermentations' | 'cultures'

const TABS: { key: TabKey; label: string; emoji: string }[] = [
  { key: 'infos',        label: 'Infos',         emoji: '🪴' },
  { key: 'reamendements',label: 'Réamendements', emoji: '🪱' },
  { key: 'arrosages',    label: 'Arrosages',     emoji: '💧' },
  { key: 'tcos',         label: 'TCO',           emoji: '🍵' },
  { key: 'fermentations',label: 'Fermentation',  emoji: '🫙' },
  { key: 'cultures',     label: 'Cultures',      emoji: '🌱' },
]

type Reamend = { id_recette_reamend: string; date_application: string; notes: string }
type Arrosage = { id_recette_engrais: string; volume_eau_l: string; date_application: string; notes: string }
type TCO = { id_recette_tco: string; volume_applique: string; date_application: string; notes: string }
type Ferm = { id_recette_ferm: string; volume_applique: string; date_application: string; notes: string }
type Culture = { description: string; date_debut: string; date_fin: string; notes: string }

export default function SuiviSolVivantModal({ editSuivi, onClose }: Props) {
  const qc     = useQueryClient()
  const isEdit = !!editSuivi
  const [activeTab, setActiveTab] = useState<TabKey>('infos')
  const [error, setError] = useState('')

  // Fetch de toutes les recettes
  const { data: recipesLSO = [] }   = useQuery<RecetteLSO[]>({ queryKey: ['recettes-lso'], queryFn: async () => (await recetteLSOAPI.getAll()).data })
  const { data: recipesReam = [] }  = useQuery<RecetteReamendement[]>({ queryKey: ['recettes-reamendement'], queryFn: async () => (await recetteReamendementAPI.getAll()).data })
  const { data: recipesEngrais = [] } = useQuery<RecetteEngrais[]>({ queryKey: ['recettes-engrais'], queryFn: async () => (await recetteEngraisAPI.getAll()).data })
  const { data: recipesTCO = [] }   = useQuery<RecetteTCO[]>({ queryKey: ['recettes-tco'], queryFn: async () => (await recetteTCOAPI.getAll()).data })
  const { data: recipesFerm = [] }  = useQuery<RecetteFermentation[]>({ queryKey: ['recettes-fermentation'], queryFn: async () => (await recetteFermentationAPI.getAll()).data })

  // Pots disponibles en stock
  const { data: allMateriel = [] }  = useQuery<Materiel[]>({ queryKey: ['materiel'], queryFn: async () => (await materielAPI.getAll()).data })
  // Suivis existants (pour l'exclusivité des pots)
  const { data: allSuivis = [] }    = useQuery<SuiviSolVivant[]>({ queryKey: ['suivi-sols-vivants'], queryFn: async () => (await suiviSolVivantAPI.getAll()).data })

  // Pots déjà utilisés dans d'autres suivis (excluant le suivi en cours d'édition)
  const usedPotIds = new Set(
    allSuivis
      .filter(s => s.id_materiel && s.id_suivi !== editSuivi?.id_suivi)
      .map(s => s.id_materiel!)
  )
  const potsStock = allMateriel.filter(m => m.categorie === 'Pots' && !usedPotIds.has(m.id_materiel))

  // Infos principales
  const [form, setForm] = useState({
    nom_pot:          editSuivi?.nom_pot          ?? '',
    id_materiel:      editSuivi?.id_materiel      ? String(editSuivi.id_materiel) : '',
    id_recette_lso:   editSuivi?.id_recette_lso   ? String(editSuivi.id_recette_lso) : '',
    volume_pot_l:     editSuivi?.volume_pot_l     != null ? String(editSuivi.volume_pot_l) : '',
    date_preparation: editSuivi?.date_preparation ?? '',
    commentaires:     editSuivi?.commentaires     ?? '',
  })

  // Collections
  const [reamendements, setReamendements] = useState<Reamend[]>(
    editSuivi?.reamendements.map(e => ({
      id_recette_reamend: e.id_recette_reamend ? String(e.id_recette_reamend) : '',
      date_application:   e.date_application ?? '',
      notes:              e.notes ?? '',
    })) ?? []
  )
  const [arrosages, setArrosages] = useState<Arrosage[]>(
    editSuivi?.arrosages.map(e => ({
      id_recette_engrais: e.id_recette_engrais ? String(e.id_recette_engrais) : '',
      volume_eau_l:       e.volume_eau_l != null ? String(e.volume_eau_l) : '',
      date_application:   e.date_application ?? '',
      notes:              e.notes ?? '',
    })) ?? []
  )
  const [tcos, setTCOs] = useState<TCO[]>(
    editSuivi?.tcos.map(e => ({
      id_recette_tco:  e.id_recette_tco ? String(e.id_recette_tco) : '',
      volume_applique: e.volume_applique != null ? String(e.volume_applique) : '',
      date_application: e.date_application ?? '',
      notes:           e.notes ?? '',
    })) ?? []
  )
  const [fermentations, setFermentations] = useState<Ferm[]>(
    editSuivi?.fermentations.map(e => ({
      id_recette_ferm:  e.id_recette_ferm ? String(e.id_recette_ferm) : '',
      volume_applique:  e.volume_applique != null ? String(e.volume_applique) : '',
      date_application: e.date_application ?? '',
      notes:            e.notes ?? '',
    })) ?? []
  )
  const [cultures, setCultures] = useState<Culture[]>(
    editSuivi?.cultures.map(e => ({
      description: e.description ?? '',
      date_debut:  e.date_debut  ?? '',
      date_fin:    e.date_fin    ?? '',
      notes:       e.notes       ?? '',
    })) ?? []
  )

  const save = useMutation({
    mutationFn: () => {
      if (!form.nom_pot.trim()) throw new Error('Le nom du pot est obligatoire')
      const payload: SuiviSolVivantCreate = {
        nom_pot:          form.nom_pot.trim(),
        id_materiel:      form.id_materiel ? parseInt(form.id_materiel) : undefined,
        id_recette_lso:   form.id_recette_lso ? parseInt(form.id_recette_lso) : undefined,
        volume_pot_l:     form.volume_pot_l ? parseFloat(form.volume_pot_l) : undefined,
        date_preparation: form.date_preparation || undefined,
        commentaires:     form.commentaires.trim() || undefined,
        reamendements: reamendements.map(e => ({
          id_recette_reamend: e.id_recette_reamend ? parseInt(e.id_recette_reamend) : undefined,
          date_application:   e.date_application || undefined,
          notes:              e.notes.trim() || undefined,
        })),
        arrosages: arrosages.map(e => ({
          id_recette_engrais: e.id_recette_engrais ? parseInt(e.id_recette_engrais) : undefined,
          volume_eau_l:       e.volume_eau_l ? parseFloat(e.volume_eau_l) : undefined,
          date_application:   e.date_application || undefined,
          notes:              e.notes.trim() || undefined,
        })),
        tcos: tcos.map(e => ({
          id_recette_tco:  e.id_recette_tco ? parseInt(e.id_recette_tco) : undefined,
          volume_applique: e.volume_applique ? parseFloat(e.volume_applique) : undefined,
          date_application: e.date_application || undefined,
          notes:           e.notes.trim() || undefined,
        })),
        fermentations: fermentations.map(e => ({
          id_recette_ferm:  e.id_recette_ferm ? parseInt(e.id_recette_ferm) : undefined,
          volume_applique:  e.volume_applique ? parseFloat(e.volume_applique) : undefined,
          date_application: e.date_application || undefined,
          notes:            e.notes.trim() || undefined,
        })),
        cultures: cultures.map(e => ({
          description: e.description.trim() || undefined,
          date_debut:  e.date_debut || undefined,
          date_fin:    e.date_fin   || undefined,
          notes:       e.notes.trim() || undefined,
        })),
      }
      return isEdit
        ? suiviSolVivantAPI.update(editSuivi!.id_suivi, payload)
        : suiviSolVivantAPI.create(payload)
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['suivi-sols-vivants'] }); onClose() },
    onError:   (e: any) => setError(e?.message ?? e?.response?.data?.detail ?? 'Erreur'),
  })

  // ── Helpers pour ajouter/supprimer des lignes dans chaque collection ──────────
  const addRow = <T,>(setter: React.Dispatch<React.SetStateAction<T[]>>, empty: T) =>
    setter(p => [...p, empty])
  const removeRow = <T,>(setter: React.Dispatch<React.SetStateAction<T[]>>, i: number) =>
    setter(p => p.filter((_, idx) => idx !== i))
  const updateRow = <T,>(setter: React.Dispatch<React.SetStateAction<T[]>>, i: number, field: keyof T, value: string) =>
    setter(prev => { const next = [...prev]; next[i] = { ...next[i], [field]: value }; return next })

  // ── Contenu des onglets ───────────────────────────────────────────────────────
  const renderInfos = () => (
    <div className="space-y-4">
      {/* Sélecteur depuis le stock */}
      {potsStock.length > 0 && (
        <div className="bg-grow-50 border border-grow-200 rounded-lg p-3">
          <Label>Choisir un pot depuis le stock</Label>
          <select
            defaultValue=""
            onChange={e => {
              const pot = potsStock.find(p => p.id_materiel === parseInt(e.target.value))
              if (!pot) return
              const caract = pot.caracteristiques as { volume_l?: number } | null
              setForm(f => ({
                ...f,
                nom_pot:      pot.nom,
                id_materiel:  String(pot.id_materiel),
                volume_pot_l: caract?.volume_l != null ? String(caract.volume_l) : f.volume_pot_l,
              }))
            }}
            className={sel + ' bg-white dark:bg-gray-800'}
          >
            <option value="">— Sélectionner un pot du stock —</option>
            {potsStock.map(p => {
              const caract = p.caracteristiques as { volume_l?: number } | null
              return (
                <option key={p.id_materiel} value={p.id_materiel}>
                  {p.nom}{caract?.volume_l != null ? ` — ${caract.volume_l} L` : ''}
                </option>
              )
            })}
          </select>
          <p className="text-xs text-grow-600 mt-1.5">Le nom et le volume seront pré-remplis automatiquement.</p>
        </div>
      )}
      <div>
        <Label required>Nom du pot / Identifiant</Label>
        <input type="text" value={form.nom_pot}
          onChange={e => setForm(f => ({ ...f, nom_pot: e.target.value }))}
          placeholder="Ex: Pot A - Sol Vivant #1" className={inp} />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Recette LSO utilisée</Label>
          <select value={form.id_recette_lso}
            onChange={e => setForm(f => ({ ...f, id_recette_lso: e.target.value }))}
            className={sel}>
            <option value="">— Aucune —</option>
            {[...recipesLSO].sort((a, b) => a.nom_recette.localeCompare(b.nom_recette, 'fr', { sensitivity: 'base' })).map(r => <option key={r.id_recette_lso} value={r.id_recette_lso}>{r.nom_recette}</option>)}
          </select>
        </div>
        <div>
          <Label>Volume du pot (L)</Label>
          <input type="number" step="any" min="0" value={form.volume_pot_l}
            onChange={e => setForm(f => ({ ...f, volume_pot_l: e.target.value }))}
            placeholder="Ex: 15" className={inp} />
        </div>
      </div>
      <div>
        <Label>Date de préparation</Label>
        <input type="date" value={form.date_preparation}
          onChange={e => setForm(f => ({ ...f, date_preparation: e.target.value }))}
          className={inp} />
      </div>
      <div>
        <Label>Commentaires</Label>
        <textarea rows={3} value={form.commentaires}
          onChange={e => setForm(f => ({ ...f, commentaires: e.target.value }))}
          placeholder="Observations générales, source de la terre, conditions…"
          className={inp + ' resize-none'} />
      </div>
    </div>
  )

  const renderReamendements = () => (
    <div className="space-y-3">
      {reamendements.length === 0 && (
        <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-6 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-lg">
          Aucun réamendement enregistré
        </p>
      )}
      {reamendements.map((e, i) => (
        <div key={i} className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 space-y-2">
          <div className="flex items-center gap-2">
            <select value={e.id_recette_reamend}
              onChange={ev => updateRow(setReamendements, i, 'id_recette_reamend', ev.target.value)}
              className="flex-1 px-2 py-1.5 border border-gray-200 dark:border-gray-700 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-grow-500 bg-white dark:bg-gray-800">
              <option value="">— Recette réamendement —</option>
              {[...recipesReam].sort((a, b) => a.nom_recette.localeCompare(b.nom_recette, 'fr', { sensitivity: 'base' })).map(r => <option key={r.id_recette_reamend} value={r.id_recette_reamend}>{r.nom_recette}{r.volume_pot ? ` (${r.volume_pot}L)` : ''}</option>)}
            </select>
            <input type="date" value={e.date_application}
              onChange={ev => updateRow(setReamendements, i, 'date_application', ev.target.value)}
              className="w-40 px-2 py-1.5 border border-gray-200 dark:border-gray-700 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-grow-500" />
            <button onClick={() => removeRow(setReamendements, i)}
              className="text-red-400 hover:text-red-600 p-1 rounded shrink-0">
              <Trash2 size={14} />
            </button>
          </div>
          <input type="text" value={e.notes}
            onChange={ev => updateRow(setReamendements, i, 'notes', ev.target.value)}
            placeholder="Notes…"
            className="w-full px-2 py-1.5 border border-gray-200 dark:border-gray-700 rounded-md text-xs focus:outline-none focus:ring-2 focus:ring-grow-500 text-gray-500 dark:text-gray-400 dark:text-gray-500" />
        </div>
      ))}
      <button onClick={() => addRow(setReamendements, { id_recette_reamend: '', date_application: '', notes: '' })}
        className="flex items-center gap-1.5 text-sm text-grow-600 hover:text-grow-800 font-medium">
        <Plus size={15} /> Ajouter un réamendement
      </button>
    </div>
  )

  const renderArrosages = () => (
    <div className="space-y-3">
      {arrosages.length === 0 && (
        <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-6 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-lg">
          Aucun arrosage enregistré
        </p>
      )}
      {arrosages.map((e, i) => (
        <div key={i} className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 space-y-2">
          <div className="flex items-center gap-2">
            <select value={e.id_recette_engrais}
              onChange={ev => updateRow(setArrosages, i, 'id_recette_engrais', ev.target.value)}
              className="flex-1 px-2 py-1.5 border border-gray-200 dark:border-gray-700 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-grow-500 bg-white dark:bg-gray-800">
              <option value="">— Recette arrosage (optionnel) —</option>
              {[...recipesEngrais].sort((a, b) => a.nom_recette.localeCompare(b.nom_recette, 'fr', { sensitivity: 'base' })).map(r => <option key={r.id_recette} value={r.id_recette}>{r.nom_recette}</option>)}
            </select>
            <input type="number" step="any" min="0" value={e.volume_eau_l}
              onChange={ev => updateRow(setArrosages, i, 'volume_eau_l', ev.target.value)}
              placeholder="Vol. (L)"
              className="w-24 px-2 py-1.5 border border-gray-200 dark:border-gray-700 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-grow-500 text-right" />
            <input type="date" value={e.date_application}
              onChange={ev => updateRow(setArrosages, i, 'date_application', ev.target.value)}
              className="w-40 px-2 py-1.5 border border-gray-200 dark:border-gray-700 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-grow-500" />
            <button onClick={() => removeRow(setArrosages, i)}
              className="text-red-400 hover:text-red-600 p-1 rounded shrink-0">
              <Trash2 size={14} />
            </button>
          </div>
          <input type="text" value={e.notes}
            onChange={ev => updateRow(setArrosages, i, 'notes', ev.target.value)}
            placeholder="Notes…"
            className="w-full px-2 py-1.5 border border-gray-200 dark:border-gray-700 rounded-md text-xs focus:outline-none focus:ring-2 focus:ring-grow-500 text-gray-500 dark:text-gray-400 dark:text-gray-500" />
        </div>
      ))}
      <button onClick={() => addRow(setArrosages, { id_recette_engrais: '', volume_eau_l: '', date_application: '', notes: '' })}
        className="flex items-center gap-1.5 text-sm text-grow-600 hover:text-grow-800 font-medium">
        <Plus size={15} /> Ajouter un arrosage
      </button>
    </div>
  )

  const renderTCOs = () => (
    <div className="space-y-3">
      {tcos.length === 0 && (
        <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-6 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-lg">
          Aucune application de TCO enregistrée
        </p>
      )}
      {tcos.map((e, i) => (
        <div key={i} className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 space-y-2">
          <div className="flex items-center gap-2">
            <select value={e.id_recette_tco}
              onChange={ev => updateRow(setTCOs, i, 'id_recette_tco', ev.target.value)}
              className="flex-1 px-2 py-1.5 border border-gray-200 dark:border-gray-700 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-grow-500 bg-white dark:bg-gray-800">
              <option value="">— Recette TCO —</option>
              {[...recipesTCO].sort((a, b) => a.nom_recette.localeCompare(b.nom_recette, 'fr', { sensitivity: 'base' })).map(r => <option key={r.id_recette_tco} value={r.id_recette_tco}>{r.nom_recette}</option>)}
            </select>
            <input type="number" step="any" min="0" value={e.volume_applique}
              onChange={ev => updateRow(setTCOs, i, 'volume_applique', ev.target.value)}
              placeholder="Vol. (L)"
              className="w-24 px-2 py-1.5 border border-gray-200 dark:border-gray-700 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-grow-500 text-right" />
            <input type="date" value={e.date_application}
              onChange={ev => updateRow(setTCOs, i, 'date_application', ev.target.value)}
              className="w-40 px-2 py-1.5 border border-gray-200 dark:border-gray-700 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-grow-500" />
            <button onClick={() => removeRow(setTCOs, i)}
              className="text-red-400 hover:text-red-600 p-1 rounded shrink-0">
              <Trash2 size={14} />
            </button>
          </div>
          <input type="text" value={e.notes}
            onChange={ev => updateRow(setTCOs, i, 'notes', ev.target.value)}
            placeholder="Notes…"
            className="w-full px-2 py-1.5 border border-gray-200 dark:border-gray-700 rounded-md text-xs focus:outline-none focus:ring-2 focus:ring-grow-500 text-gray-500 dark:text-gray-400 dark:text-gray-500" />
        </div>
      ))}
      <button onClick={() => addRow(setTCOs, { id_recette_tco: '', volume_applique: '', date_application: '', notes: '' })}
        className="flex items-center gap-1.5 text-sm text-grow-600 hover:text-grow-800 font-medium">
        <Plus size={15} /> Ajouter une application TCO
      </button>
    </div>
  )

  const renderFermentations = () => (
    <div className="space-y-3">
      {fermentations.length === 0 && (
        <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-6 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-lg">
          Aucune application de fermentation enregistrée
        </p>
      )}
      {fermentations.map((e, i) => (
        <div key={i} className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 space-y-2">
          <div className="flex items-center gap-2">
            <select value={e.id_recette_ferm}
              onChange={ev => updateRow(setFermentations, i, 'id_recette_ferm', ev.target.value)}
              className="flex-1 px-2 py-1.5 border border-gray-200 dark:border-gray-700 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-grow-500 bg-white dark:bg-gray-800">
              <option value="">— Recette fermentation —</option>
              {[...recipesFerm].sort((a, b) => a.nom_recette.localeCompare(b.nom_recette, 'fr', { sensitivity: 'base' })).map(r => <option key={r.id_recette_ferm} value={r.id_recette_ferm}>{r.nom_recette}</option>)}
            </select>
            <input type="number" step="any" min="0" value={e.volume_applique}
              onChange={ev => updateRow(setFermentations, i, 'volume_applique', ev.target.value)}
              placeholder="Vol. (L)"
              className="w-24 px-2 py-1.5 border border-gray-200 dark:border-gray-700 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-grow-500 text-right" />
            <input type="date" value={e.date_application}
              onChange={ev => updateRow(setFermentations, i, 'date_application', ev.target.value)}
              className="w-40 px-2 py-1.5 border border-gray-200 dark:border-gray-700 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-grow-500" />
            <button onClick={() => removeRow(setFermentations, i)}
              className="text-red-400 hover:text-red-600 p-1 rounded shrink-0">
              <Trash2 size={14} />
            </button>
          </div>
          <input type="text" value={e.notes}
            onChange={ev => updateRow(setFermentations, i, 'notes', ev.target.value)}
            placeholder="Notes…"
            className="w-full px-2 py-1.5 border border-gray-200 dark:border-gray-700 rounded-md text-xs focus:outline-none focus:ring-2 focus:ring-grow-500 text-gray-500 dark:text-gray-400 dark:text-gray-500" />
        </div>
      ))}
      <button onClick={() => addRow(setFermentations, { id_recette_ferm: '', volume_applique: '', date_application: '', notes: '' })}
        className="flex items-center gap-1.5 text-sm text-grow-600 hover:text-grow-800 font-medium">
        <Plus size={15} /> Ajouter une application de fermentation
      </button>
    </div>
  )

  const renderCultures = () => (
    <div className="space-y-3">
      {cultures.length === 0 && (
        <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-6 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-lg">
          Aucune culture enregistrée
        </p>
      )}
      {cultures.map((e, i) => (
        <div key={i} className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 space-y-2">
          <div className="flex items-center gap-2">
            <input type="text" value={e.description}
              onChange={ev => updateRow(setCultures, i, 'description', ev.target.value)}
              placeholder="Description (variété, culture #1…)"
              className="flex-1 px-2 py-1.5 border border-gray-200 dark:border-gray-700 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-grow-500" />
            <input type="date" value={e.date_debut}
              onChange={ev => updateRow(setCultures, i, 'date_debut', ev.target.value)}
              title="Date début"
              className="w-36 px-2 py-1.5 border border-gray-200 dark:border-gray-700 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-grow-500" />
            <span className="text-gray-400 dark:text-gray-500 text-xs shrink-0">→</span>
            <input type="date" value={e.date_fin}
              onChange={ev => updateRow(setCultures, i, 'date_fin', ev.target.value)}
              title="Date fin"
              className="w-36 px-2 py-1.5 border border-gray-200 dark:border-gray-700 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-grow-500" />
            <button onClick={() => removeRow(setCultures, i)}
              className="text-red-400 hover:text-red-600 p-1 rounded shrink-0">
              <Trash2 size={14} />
            </button>
          </div>
          <input type="text" value={e.notes}
            onChange={ev => updateRow(setCultures, i, 'notes', ev.target.value)}
            placeholder="Notes (rendement, observations…)"
            className="w-full px-2 py-1.5 border border-gray-200 dark:border-gray-700 rounded-md text-xs focus:outline-none focus:ring-2 focus:ring-grow-500 text-gray-500 dark:text-gray-400 dark:text-gray-500" />
        </div>
      ))}
      <button onClick={() => addRow(setCultures, { description: '', date_debut: '', date_fin: '', notes: '' })}
        className="flex items-center gap-1.5 text-sm text-grow-600 hover:text-grow-800 font-medium">
        <Plus size={15} /> Ajouter une culture
      </button>
    </div>
  )

  const tabCounts: Record<TabKey, number> = {
    infos: 0,
    reamendements: reamendements.length,
    arrosages: arrosages.length,
    tcos: tcos.length,
    fermentations: fermentations.length,
    cultures: cultures.length,
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-4xl max-h-[94vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-700">
          <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">
            {isEdit ? `Modifier — ${editSuivi!.nom_pot}` : 'Nouveau suivi sol vivant'}
          </h2>
          <button onClick={onClose} className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:text-gray-300"><X size={22} /></button>
        </div>

        {/* Onglets */}
        <div className="flex border-b border-gray-100 dark:border-gray-700 px-4 gap-1 overflow-x-auto shrink-0">
          {TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-1.5 px-3 py-3 text-xs font-medium border-b-2 transition-colors whitespace-nowrap ${
                activeTab === tab.key
                  ? 'border-grow-600 text-grow-700'
                  : 'border-transparent text-gray-500 dark:text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:text-gray-200'
              }`}
            >
              <span>{tab.emoji}</span>
              <span>{tab.label}</span>
              {tabCounts[tab.key] > 0 && (
                <span className="bg-grow-100 text-grow-700 text-xs rounded-full px-1.5 py-0.5 min-w-[1.25rem] text-center">
                  {tabCounts[tab.key]}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Corps */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {activeTab === 'infos'         && renderInfos()}
          {activeTab === 'reamendements' && renderReamendements()}
          {activeTab === 'arrosages'     && renderArrosages()}
          {activeTab === 'tcos'          && renderTCOs()}
          {activeTab === 'fermentations' && renderFermentations()}
          {activeTab === 'cultures'      && renderCultures()}
          {error && <p className="text-xs text-red-500 mt-3">{error}</p>}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 dark:border-gray-700 flex justify-between items-center">
          <p className="text-xs text-gray-400 dark:text-gray-500">
            {reamendements.length + arrosages.length + tcos.length + fermentations.length} application(s) · {cultures.length} culture(s)
          </p>
          <div className="flex gap-3">
            <button onClick={onClose}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 text-sm rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/40">
              Annuler
            </button>
            <button onClick={() => save.mutate()} disabled={save.isPending || !form.nom_pot.trim()}
              className="flex items-center gap-2 px-4 py-2 bg-grow-600 text-white text-sm rounded-lg hover:bg-grow-700 disabled:opacity-50">
              {save.isPending ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
              {isEdit ? 'Enregistrer' : 'Créer le suivi'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
