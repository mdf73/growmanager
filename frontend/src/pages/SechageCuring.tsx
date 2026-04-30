import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Wind, ChevronDown, ChevronUp, Thermometer, Droplets, Scale,
  Calendar, Clock, X, CheckCircle2, MapPin, Package, Layers,
  Pencil, Snowflake,
} from 'lucide-react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts'
import { cultureAPI, actionAPI, PlantSechage } from '../api/cultures'
import { capteursAPI, TemperatureLog } from '../api/capteurs'
import { sechageAPI } from '../api/sechage'
import { curingAPI } from '../api/curing'
import type { EspaceCulture } from '../api/espaces'
import client from '../api/client'

// ─── Types ────────────────────────────────────────────────────────────────────

interface MaterielBocal {
  id_materiel: number
  nom: string
  marque?: string
  caracteristiques?: Record<string, unknown>
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Différence en jours calendaires (minuit → minuit locale), pas en tranches de 24h. */
function calendarDaysAgo(dateStr: string): number {
  const ref = new Date(dateStr + 'T00:00:00')
  const today = new Date()
  const refMidnight  = new Date(ref.getFullYear(),   ref.getMonth(),   ref.getDate())
  const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  return Math.max(0, Math.floor((todayMidnight.getTime() - refMidnight.getTime()) / 86_400_000))
}

function joursDepuis(dateStr?: string): number | null {
  if (!dateStr) return null
  return calendarDaysAgo(dateStr)
}

function formatDate(dateStr?: string) {
  if (!dateStr) return '—'
  return new Date(dateStr + 'T12:00').toLocaleDateString('fr-FR', {
    day: 'numeric', month: 'short', year: 'numeric',
  })
}

function dureeColor(j?: number | null) {
  if (j == null) return 'bg-gray-100 text-gray-500'
  if (j <= 5)  return 'bg-blue-50 text-blue-700'
  if (j <= 10) return 'bg-green-50 text-green-700'
  if (j <= 14) return 'bg-amber-50 text-amber-700'
  return 'bg-orange-50 text-orange-700'
}

/**
 * Standards de burping cannabis :
 * Sem 1 (J0-7)   → ouvrir chaque jour   → fenêtre = 1j  → durée = 15-30 min
 * Sem 2 (J8-14)  → tous les 2-3j        → fenêtre = 3j  → durée = 15-30 min
 * Sem 3-4 (J15-28) → tous les 4-7j      → fenêtre = 7j  → durée = 5-15 min
 * Mois 2+ (J29+) → toutes les 1-2 sem.  → fenêtre = 14j → durée = 5-10 min
 */
function bocalBurpWindow(joursCuring: number): number {
  if (joursCuring <= 7)  return 1
  if (joursCuring <= 14) return 3
  if (joursCuring <= 28) return 7
  return 14
}

function bocalBurpDuree(joursCuring: number): string {
  if (joursCuring <= 14) return '15-30 min'
  if (joursCuring <= 28) return '5-15 min'
  return '5-10 min'
}

interface BurpStatus {
  jours: number          // jours depuis dernière ouverture (ou depuis début curing si jamais ouvert)
  window: number         // fenêtre recommandée
  dureeRecommandee: string // durée recommandée par ouverture
  label: string
  badgeClass: string     // Tailwind classes
  dot: string            // couleur du point d'alerte
  neverOpened: boolean
}

function getBurpStatus(plant: { date_fin_sechage?: string; derniere_ouverture_bocal?: string }): BurpStatus | null {
  // Référence de départ : date_fin_sechage = début du curing
  const startStr = plant.date_fin_sechage
  if (!startStr) return null

  const joursCuring = calendarDaysAgo(startStr)
  const window = bocalBurpWindow(joursCuring)
  const dureeRecommandee = bocalBurpDuree(joursCuring)

  const refStr = plant.derniere_ouverture_bocal
  const neverOpened = !refStr
  const jours = calendarDaysAgo(refStr ?? startStr)

  let label: string
  let badgeClass: string
  let dot: string

  if (jours === 0) {
    label = "Ouvert aujourd'hui"
    badgeClass = 'bg-green-100 text-green-700 border border-green-200'
    dot = 'bg-green-500'
  } else if (jours < window) {
    label = `Il y a ${jours}j`
    badgeClass = 'bg-green-50 text-green-700 border border-green-200'
    dot = 'bg-green-400'
  } else if (jours === window) {
    label = `Il y a ${jours}j`
    badgeClass = 'bg-amber-50 text-amber-700 border border-amber-200'
    dot = 'bg-amber-400'
  } else {
    label = `Il y a ${jours}j`
    badgeClass = 'bg-red-50 text-red-700 border border-red-200'
    dot = 'bg-red-500'
  }

  return { jours, window, dureeRecommandee, label, badgeClass, dot, neverOpened }
}

// ─── Modal Assigner Espace de Séchage ─────────────────────────────────────────

function AssignerEspaceModal({
  plant,
  onClose,
  onAssigned,
}: {
  plant: PlantSechage
  onClose: () => void
  onAssigned: () => void
}) {
  const [idEspace, setIdEspace] = useState<number | ''>(plant.id_espace_sechage || plant.id_espace || '')
  const [methode, setMethode]   = useState(plant.methode_sechage || '')
  const [poids, setPoids]       = useState(plant.poids_humide_g?.toString() || '')
  const [tempCible, setTempCible] = useState('')
  const [hygroCible, setHygroCible] = useState('')
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')

  const { data: espaces = [] } = useQuery<EspaceCulture[]>({
    queryKey: ['espaces'],
    queryFn: () => client.get<EspaceCulture[]>('/espaces/').then(r => r.data),
  })

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      if (plant.id_session_sechage && plant.id_plant_sechage) {
        await sechageAPI.update(plant.id_session_sechage, {
          id_espace: idEspace ? Number(idEspace) : undefined,
          methode_sechage: methode || undefined,
          temperature_cible: tempCible ? parseFloat(tempCible) : undefined,
          humidite_cible: hygroCible ? parseFloat(hygroCible) : undefined,
        })
        if (poids) {
          await sechageAPI.updatePlant(plant.id_session_sechage, plant.id_plant_sechage, {
            poids_humide_g: parseFloat(poids),
          })
        }
      } else {
        await sechageAPI.create({
          id_espace: idEspace ? Number(idEspace) : undefined,
          methode_sechage: methode || undefined,
          temperature_cible: tempCible ? parseFloat(tempCible) : undefined,
          humidite_cible: hygroCible ? parseFloat(hygroCible) : undefined,
          date_debut: plant.date_recolte || new Date().toISOString().slice(0, 10),
          plants: [{
            id_plant: plant.id_plant,
            date_mise_sechage: plant.date_recolte || new Date().toISOString().slice(0, 10),
            poids_humide_g: poids ? parseFloat(poids) : undefined,
          }],
        })
      }
      onAssigned()
      onClose()
    } catch (err: any) {
      setError(err?.response?.data?.detail || err?.message || 'Erreur')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm">
        <div className="flex items-center justify-between p-5 border-b">
          <h2 className="text-base font-bold text-gray-900">
            🌬️ Espace de séchage — {plant.nom_affichage}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2 rounded-lg">{error}</div>
          )}

          <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
            <MapPin size={13} className="text-gray-400 flex-shrink-0" />
            <p className="text-xs text-gray-600">
              Espace culture actuel : <strong>{plant.nom_espace || '—'}</strong>
              {plant.nom_espace_sechage && plant.nom_espace_sechage !== plant.nom_espace && (
                <> → séchage : <strong className="text-yellow-700">{plant.nom_espace_sechage}</strong></>
              )}
            </p>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Espace de séchage</label>
            <select
              value={idEspace}
              onChange={e => setIdEspace(e.target.value ? Number(e.target.value) : '')}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-grow-500 focus:border-transparent"
            >
              <option value="">— Même espace que la culture —</option>
              {espaces.map(e => (
                <option key={e.id_espace} value={e.id_espace}>{e.nom}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Méthode</label>
              <select
                value={methode}
                onChange={e => setMethode(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-grow-500 focus:border-transparent"
              >
                <option value="">— Choisir —</option>
                <option value="Filet">Filet</option>
                <option value="Penderie">Penderie</option>
                <option value="Rack">Rack</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Poids humide (g)</label>
              <input
                type="number" step="0.1" value={poids}
                onChange={e => setPoids(e.target.value)}
                placeholder="ex: 85"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-grow-500 focus:border-transparent"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">T° cible (°C)</label>
              <input
                type="number" step="0.5" value={tempCible}
                onChange={e => setTempCible(e.target.value)}
                placeholder="18"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-grow-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">HR cible (%)</label>
              <input
                type="number" step="1" value={hygroCible}
                onChange={e => setHygroCible(e.target.value)}
                placeholder="60"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-grow-500 focus:border-transparent"
              />
            </div>
          </div>

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 text-sm">
              Annuler
            </button>
            <button type="submit" disabled={loading}
              className="flex-1 px-4 py-2 bg-grow-600 text-white rounded-lg hover:bg-grow-700 disabled:opacity-50 text-sm font-medium">
              {loading ? 'Enregistrement…' : 'Confirmer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Modal Début Curing ───────────────────────────────────────────────────────

function DebutCuringModal({
  plant,
  onClose,
  onSubmit,
}: {
  plant: PlantSechage
  onClose: () => void
  onSubmit: (poids: number, date: string, sessionCuringId: number) => Promise<void>
}) {
  const [poids, setPoids]               = useState(plant.poids_recolte_g?.toString() || '')
  const [dateAction, setDateAction]     = useState(new Date().toISOString().slice(0, 10))
  const [typeContenant, setTypeContenant] = useState<'Bocal' | 'Autre'>('Bocal')
  const [idMaterielBocal, setIdMaterielBocal] = useState<number | ''>('')
  const [volumeL, setVolumeL]           = useState('')
  const [bovedaRh, setBovedaRh]         = useState('')
  const [idEspace, setIdEspace]         = useState<number | ''>('')
  const [loading, setLoading]           = useState(false)
  const [error, setError]               = useState('')

  const { data: bocaux = [] } = useQuery<MaterielBocal[]>({
    queryKey: ['materiel-bocaux-disponibles'],
    queryFn: () =>
      client.get<MaterielBocal[]>('/materiel', {
        params: { categorie: 'Bocaux', disponibles_seulement: true },
      }).then(r => r.data),
  })

  const { data: espaces = [] } = useQuery<EspaceCulture[]>({
    queryKey: ['espaces'],
    queryFn: () => client.get<EspaceCulture[]>('/espaces/').then(r => r.data),
  })

  const bocauxFiltres = bocaux

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!poids) return
    setLoading(true)
    setError('')
    try {
      const session = await curingAPI.create({
        type_contenant: typeContenant,
        volume_contenant_l: volumeL ? parseFloat(volumeL) : undefined,
        boveda_rh: bovedaRh ? parseInt(bovedaRh) : undefined,
        id_espace: idEspace ? Number(idEspace) : undefined,
        id_materiel_bocal: typeContenant === 'Bocal' && idMaterielBocal ? Number(idMaterielBocal) : undefined,
        date_debut: dateAction,
        plants: [{
          id_plant: plant.id_plant,
          date_mise_curing: dateAction,
          poids_debut_g: parseFloat(poids),
        }],
      })
      await onSubmit(parseFloat(poids), dateAction, session.id_session_curing)
      onClose()
    } catch (err: any) {
      setError(err?.response?.data?.detail || err?.message || 'Erreur')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm">
        <div className="flex items-center justify-between p-5 border-b">
          <h2 className="text-base font-bold text-gray-900">🏺 Début Curing — {plant.nom_affichage}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2 rounded-lg">{error}</div>
          )}

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Date</label>
            <input
              type="date" value={dateAction}
              onChange={e => setDateAction(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-grow-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Poids récolté sec (g) <span className="text-red-500">*</span>
            </label>
            <input
              type="number" step="0.1" min="0" value={poids}
              onChange={e => setPoids(e.target.value)}
              placeholder="ex: 42.5"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-grow-500 focus:border-transparent"
            />
            <p className="text-xs text-gray-400 mt-1">Pesée après séchage, avant mise en contenant.</p>
          </div>

          {/* Type de contenant */}
          <div className="border-t border-gray-100 pt-3">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Type de contenant</p>
            <div className="grid grid-cols-2 gap-2 mb-3">
              {(['Bocal', 'Autre'] as const).map(t => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTypeContenant(t)}
                  className={`py-2 px-3 rounded-lg text-sm font-medium border transition-colors ${
                    typeContenant === t
                      ? 'bg-purple-600 text-white border-purple-600'
                      : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  {t === 'Bocal' ? '🫙 Bocal' : '📦 Autre'}
                </button>
              ))}
            </div>
          </div>

          {/* Section Bocal */}
          {typeContenant === 'Bocal' && (
            <div className="space-y-3">
              {/* Sélection bocal inventaire */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Bocal (inventaire)</label>
                <select
                  value={idMaterielBocal}
                  onChange={e => setIdMaterielBocal(e.target.value ? Number(e.target.value) : '')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-grow-500 focus:border-transparent"
                >
                  <option value="">— Sélectionner un bocal —</option>
                  {bocauxFiltres.map((b: MaterielBocal) => (
                    <option key={b.id_materiel} value={b.id_materiel}>
                      {b.nom}{b.marque ? ` · ${b.marque}` : ''}
                      {b.caracteristiques?.volume_l ? ` · ${b.caracteristiques.volume_l}L` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Volume (L)</label>
                  <input
                    type="number" step="0.1" value={volumeL}
                    onChange={e => setVolumeL(e.target.value)}
                    placeholder="1"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-grow-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Boveda %</label>
                  <select
                    value={bovedaRh}
                    onChange={e => setBovedaRh(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-grow-500 focus:border-transparent"
                  >
                    <option value="">Sans</option>
                    <option value="58">58%</option>
                    <option value="62">62%</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* Section Autre */}
          {typeContenant === 'Autre' && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Volume (L)</label>
                <input
                  type="number" step="0.1" value={volumeL}
                  onChange={e => setVolumeL(e.target.value)}
                  placeholder="ex: 2"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-grow-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Boveda %</label>
                <select
                  value={bovedaRh}
                  onChange={e => setBovedaRh(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-grow-500 focus:border-transparent"
                >
                  <option value="">Sans</option>
                  <option value="58">58%</option>
                  <option value="62">62%</option>
                </select>
              </div>
            </div>
          )}

          {/* Espace de culture optionnel */}
          <div className="border-t border-gray-100 pt-3">
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Espace de curing <span className="text-gray-400 font-normal">(optionnel — si dans un espace de culture)</span>
            </label>
            <select
              value={idEspace}
              onChange={e => setIdEspace(e.target.value ? Number(e.target.value) : '')}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-grow-500 focus:border-transparent"
            >
              <option value="">— Hors espace de culture —</option>
              {espaces.map(e => (
                <option key={e.id_espace} value={e.id_espace}>{e.nom}</option>
              ))}
            </select>
            {!idEspace && typeContenant === 'Bocal' && (
              <p className="text-xs text-purple-600 mt-1">
                🫙 Hors espace : vous pourrez enregistrer les ouvertures de bocal.
              </p>
            )}
          </div>

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 text-sm">
              Annuler
            </button>
            <button type="submit" disabled={loading || !poids}
              className="flex-1 px-4 py-2 bg-grow-600 text-white rounded-lg hover:bg-grow-700 disabled:opacity-50 text-sm font-medium">
              {loading ? 'Enregistrement…' : '🏺 Lancer le curing'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Modal Terminer Curing ────────────────────────────────────────────────────

function TerminerCuringModal({
  plant,
  onClose,
  onConfirm,
}: {
  plant: PlantSechage
  onClose: () => void
  onConfirm: (date: string) => Promise<void>
}) {
  const [dateAction, setDateAction] = useState(new Date().toISOString().slice(0, 10))
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      await onConfirm(dateAction)
      onClose()
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm">
        <div className="flex items-center justify-between p-5 border-b">
          <h2 className="text-base font-bold text-gray-900">✅ Terminer le curing — {plant.nom_affichage}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Date de fin</label>
            <input
              type="date" value={dateAction}
              onChange={e => setDateAction(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-grow-500 focus:border-transparent"
            />
          </div>

          {plant.poids_recolte_g != null && (
            <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-lg px-3 py-2.5">
              <Scale size={14} className="text-green-600 flex-shrink-0" />
              <div>
                <p className="text-xs font-medium text-green-800">{plant.poids_recolte_g} g</p>
                <p className="text-[11px] text-green-600">Sera ajouté au stock fleur.</p>
              </div>
            </div>
          )}

          {plant.type_contenant && (
            <div className="flex items-center gap-2 bg-purple-50 border border-purple-200 rounded-lg px-3 py-2">
              <Package size={13} className="text-purple-600 flex-shrink-0" />
              <p className="text-xs text-purple-800">
                {plant.nom_materiel_bocal || plant.type_contenant}
                {plant.volume_contenant_l && ` · ${plant.volume_contenant_l}L`}
                {plant.boveda_rh && ` · Boveda ${plant.boveda_rh}%`}
              </p>
            </div>
          )}

          <p className="text-xs text-gray-500">
            La plante sera marquée comme <strong>Prête</strong> et entrera dans le stock.
            {' '}Si c'est la dernière plante de la culture, celle-ci sera archivée automatiquement.
          </p>

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 text-sm">
              Annuler
            </button>
            <button type="submit" disabled={loading}
              className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 text-sm font-medium">
              {loading ? 'Enregistrement…' : '✅ Confirmer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Modal Ouverture Bocal ────────────────────────────────────────────────────

const DUREES_BOCAL = [5, 10, 15, 20, 30, 45, 60]

function OuvertureBocalModal({
  plant,
  onClose,
  onSubmit,
}: {
  plant: PlantSechage
  onClose: () => void
  onSubmit: (dureeMin: number, date: string, note?: string) => Promise<void>
}) {
  const [dureeMin, setDureeMin] = useState<number>(15)
  const [dateAction, setDateAction] = useState(new Date().toISOString().slice(0, 10))
  const [note, setNote]   = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      await onSubmit(dureeMin, dateAction, note || undefined)
      onClose()
    } catch (err: any) {
      setError(err?.response?.data?.detail || err?.message || 'Erreur')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm">
        <div className="flex items-center justify-between p-5 border-b">
          <h2 className="text-base font-bold text-gray-900">🫙 Ouverture bocal — {plant.nom_affichage}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2 rounded-lg">{error}</div>
          )}

          {plant.nom_materiel_bocal && (
            <div className="flex items-center gap-2 bg-purple-50 border border-purple-100 rounded-lg px-3 py-2">
              <Package size={13} className="text-purple-600 flex-shrink-0" />
              <p className="text-xs text-purple-800">
                {plant.nom_materiel_bocal}
                {plant.volume_contenant_l && ` · ${plant.volume_contenant_l}L`}
                {plant.boveda_rh && ` · Boveda ${plant.boveda_rh}%`}
              </p>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Date</label>
            <input
              type="date" value={dateAction}
              onChange={e => setDateAction(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-grow-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-2">Durée d'ouverture</label>
            <div className="grid grid-cols-4 gap-2">
              {DUREES_BOCAL.map(d => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDureeMin(d)}
                  className={`py-2 rounded-lg text-xs font-bold border transition-colors ${
                    dureeMin === d
                      ? 'bg-purple-600 text-white border-purple-600'
                      : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  {d < 60 ? `${d} min` : '1 h'}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Note <span className="font-normal text-gray-400">(optionnel)</span></label>
            <input
              type="text" value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="ex: odeur boisée, bonne humidité…"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-grow-500 focus:border-transparent"
            />
          </div>

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 text-sm">
              Annuler
            </button>
            <button type="submit" disabled={loading}
              className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 text-sm font-medium">
              {loading ? 'Enregistrement…' : `🫙 ${dureeMin} min`}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Modal Modifier le curing ─────────────────────────────────────────────────

function EditCuringModal({
  plant,
  onClose,
  onSave,
}: {
  plant: PlantSechage
  onClose: () => void
  onSave: (idEspace: number | null, idMaterielBocal: number | null) => Promise<void>
}) {
  const [idEspace, setIdEspace]               = useState<number | null>(plant.id_espace_curing ?? null)
  const [idMaterielBocal, setIdMaterielBocal] = useState<number | null>(plant.id_materiel_bocal ?? null)
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')

  const { data: espaces = [] } = useQuery<EspaceCulture[]>({
    queryKey: ['espaces'],
    queryFn: () => client.get<EspaceCulture[]>('/espaces/').then(r => r.data),
  })

  const { data: bocaux = [] } = useQuery<MaterielBocal[]>({
    // Inclure le bocal courant (inclure_id) même s'il est "occupé" par cette session
    queryKey: ['materiel-bocaux-disponibles', plant.id_materiel_bocal],
    queryFn: () =>
      client.get<MaterielBocal[]>('/materiel', {
        params: {
          categorie: 'Bocaux',
          disponibles_seulement: true,
          ...(plant.id_materiel_bocal ? { inclure_id: plant.id_materiel_bocal } : {}),
        },
      }).then(r => r.data),
  })

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      await onSave(idEspace, idMaterielBocal)
      onClose()
    } catch (err: any) {
      setError(err?.response?.data?.detail || err?.message || 'Erreur')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm">
        <div className="flex items-center justify-between p-5 border-b">
          <h2 className="text-base font-bold text-gray-900">
            ⚙️ Modifier le curing — {plant.nom_affichage}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2 rounded-lg">{error}</div>
          )}

          {/* Espace */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5">
              <MapPin size={11} className="inline mr-1" />Espace de curing
            </label>
            <select
              value={idEspace ?? ''}
              onChange={e => setIdEspace(e.target.value ? Number(e.target.value) : null)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-grow-500 focus:border-transparent"
            >
              <option value="">— Hors espace de culture —</option>
              {espaces.map(e => (
                <option key={e.id_espace} value={e.id_espace}>{e.nom}</option>
              ))}
            </select>
            {!idEspace && plant.type_contenant === 'Bocal' && (
              <p className="text-xs text-purple-500 mt-1">🫙 Hors espace : les ouvertures de bocal seront disponibles.</p>
            )}
            {idEspace && (
              <p className="text-xs text-blue-500 mt-1">📊 Monitoring T° / HR activé sur cet espace.</p>
            )}
          </div>

          {/* Bocal inventaire */}
          {plant.type_contenant === 'Bocal' && (
            <div>
              <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5">
                <Package size={11} className="inline mr-1" />Bocal (inventaire)
              </label>
              <select
                value={idMaterielBocal ?? ''}
                onChange={e => setIdMaterielBocal(e.target.value ? Number(e.target.value) : null)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-grow-500 focus:border-transparent"
              >
                <option value="">— Pas de bocal sélectionné —</option>
                {bocaux.map((b: MaterielBocal) => (
                  <option key={b.id_materiel} value={b.id_materiel}>
                    {b.nom}{b.marque ? ` · ${b.marque}` : ''}
                    {b.caracteristiques?.volume_l ? ` · ${b.caracteristiques.volume_l}L` : ''}
                  </option>
                ))}
              </select>
              {idMaterielBocal !== plant.id_materiel_bocal && (
                <p className="text-xs text-amber-600 mt-1">
                  {idMaterielBocal
                    ? `Nouveau bocal sélectionné.`
                    : 'Bocal désassocié — les infos de volume et boveda restent inchangées.'}
                </p>
              )}
            </div>
          )}

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 text-sm">
              Annuler
            </button>
            <button type="submit" disabled={loading}
              className="flex-1 px-4 py-2 bg-grow-600 text-white rounded-lg hover:bg-grow-700 disabled:opacity-50 text-sm font-medium">
              {loading ? 'Enregistrement…' : 'Enregistrer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Modal WPFF ───────────────────────────────────────────────────────────────

function WpffModal({
  plant,
  onClose,
  onSubmit,
}: {
  plant: PlantSechage
  onClose: () => void
  onSubmit: (poids: number | null, dateAction: string) => Promise<void>
}) {
  const [poids, setPoids]           = useState('')
  const [dateAction, setDateAction] = useState(new Date().toISOString().slice(0, 10))
  const [loading, setLoading]       = useState(false)
  const [error, setError]           = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const poidsVal = poids.trim() !== '' ? parseFloat(poids) : null
      await onSubmit(poidsVal, dateAction)
      onClose()
    } catch (err: any) {
      setError(err?.response?.data?.detail || err?.message || 'Erreur')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm">
        <div className="flex items-center justify-between p-5 border-b">
          <div className="flex items-center gap-2">
            <Snowflake size={18} className="text-blue-500" />
            <h2 className="text-base font-bold text-gray-900">Passer en WPFF — {plant.nom_affichage}</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2 rounded-lg">{error}</div>
          )}

          {/* Info */}
          <div className="bg-blue-50 border border-blue-100 rounded-lg px-3 py-2.5 text-xs text-blue-700 flex items-start gap-2">
            <Snowflake size={13} className="flex-shrink-0 mt-0.5 text-blue-500" />
            <p>
              La plante sera envoyée directement au congélateur <strong>(WPFF)</strong>, sans séchage ni curing.
              Elle apparaîtra dans le stock en type <strong>WPFF</strong>.
            </p>
          </div>

          {/* Date */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Date</label>
            <input
              type="date" value={dateAction}
              onChange={e => setDateAction(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Poids — optionnel */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Poids <span className="font-normal text-gray-400">(optionnel)</span>
            </label>
            <div className="relative">
              <input
                type="number" value={poids} min="0" step="0.1"
                onChange={e => setPoids(e.target.value)}
                placeholder="ex : 45.5"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent pr-8"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">g</span>
            </div>
            {poids && (
              <p className="text-xs text-blue-600 mt-1">
                <Scale size={10} className="inline mr-1" />
                {parseFloat(poids)}g enregistrés dans le stock WPFF
              </p>
            )}
          </div>

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 text-sm">
              Annuler
            </button>
            <button type="submit" disabled={loading}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm font-medium flex items-center justify-center gap-1.5">
              <Snowflake size={14} />
              {loading ? 'Enregistrement…' : 'Passer en WPFF'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Graphe temp/hygro ────────────────────────────────────────────────────────

function GrapheSechage({ plant }: { plant: PlantSechage }) {
  // Pour le séchage : espace séchage assigné > espace de culture
  // Pour le curing : espace de curing seulement (pas l'espace de culture)
  // Bocal hors espace = pas de monitoring
  const espaceId = plant.statut === 'curing'
    ? plant.id_espace_curing        // curing dans un espace → monitore cet espace
    : (plant.id_espace_sechage || plant.id_espace)  // séchage → espace séchage ou culture

  const nomEspace = plant.statut === 'curing'
    ? plant.nom_espace_curing
    : (plant.nom_espace_sechage || plant.nom_espace)

  const heures = plant.date_recolte
    ? Math.max(48, Math.ceil((Date.now() - new Date(plant.date_recolte + 'T00:00').getTime()) / (1000 * 60 * 60)) + 24)
    : 168

  const { data: logs = [], isLoading } = useQuery<TemperatureLog[]>({
    queryKey: ['temp-logs-sechage', espaceId, heures],
    queryFn: async () => {
      if (!espaceId) return []
      return (await capteursAPI.getLogs({ id_espace: espaceId, heures })).data
    },
    enabled: !!espaceId,
  })

  // Bocal en curing hors espace → pas de monitoring
  if (plant.statut === 'curing' && plant.type_contenant === 'Bocal' && !plant.id_espace_curing) {
    return (
      <p className="text-xs text-purple-400 italic py-3 text-center">
        🫙 Curing en bocal hors espace — pas de monitoring des constantes.
      </p>
    )
  }

  if (!espaceId) {
    return (
      <p className="text-xs text-gray-400 italic py-3 text-center">
        Aucun espace lié — données de capteur indisponibles.
      </p>
    )
  }

  if (isLoading) {
    return <p className="text-xs text-gray-400 py-3 text-center">Chargement des données capteur…</p>
  }

  const filtered = plant.date_recolte
    ? logs.filter(l => new Date(l.date_heure) >= new Date(plant.date_recolte! + 'T00:00'))
    : logs

  if (filtered.length === 0) {
    return (
      <p className="text-xs text-gray-400 italic py-3 text-center">
        Aucune donnée capteur depuis la récolte.
      </p>
    )
  }

  const chartData = filtered.map(l => ({
    t: new Date(l.date_heure).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }),
    temp: l.temperature ?? null,
    hygro: l.humidite ?? null,
  }))

  const last = filtered[filtered.length - 1]
  const tempMin = Math.min(...filtered.map(l => l.temperature ?? 99).filter(v => v < 99))
  const tempMax = Math.max(...filtered.map(l => l.temperature ?? -99).filter(v => v > -99))
  const hygroMin = Math.min(...filtered.map(l => l.humidite ?? 99).filter(v => v < 99))
  const hygroMax = Math.max(...filtered.map(l => l.humidite ?? -99).filter(v => v > -99))

  return (
    <div className="mt-3 space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <div className="bg-red-50 rounded-lg p-2.5">
          <div className="flex items-center gap-1.5 mb-1">
            <Thermometer size={13} className="text-red-500" />
            <span className="text-xs font-medium text-red-700">Température</span>
          </div>
          <p className="text-sm font-bold text-red-800">
            {last?.temperature != null ? `${last.temperature}°C` : '—'}
          </p>
          <p className="text-[10px] text-red-500 mt-0.5">
            min {tempMin !== 99 ? `${tempMin}°` : '—'} / max {tempMax !== -99 ? `${tempMax}°` : '—'}
          </p>
        </div>
        <div className="bg-blue-50 rounded-lg p-2.5">
          <div className="flex items-center gap-1.5 mb-1">
            <Droplets size={13} className="text-blue-500" />
            <span className="text-xs font-medium text-blue-700">Hygrométrie</span>
          </div>
          <p className="text-sm font-bold text-blue-800">
            {last?.humidite != null ? `${last.humidite}%` : '—'}
          </p>
          <p className="text-[10px] text-blue-500 mt-0.5">
            min {hygroMin !== 99 ? `${hygroMin}%` : '—'} / max {hygroMax !== -99 ? `${hygroMax}%` : '—'}
          </p>
        </div>
      </div>

      <div className="bg-gray-50 rounded-lg p-3">
        <p className="text-[10px] font-medium text-gray-500 mb-2 uppercase tracking-wide">
          Évolution depuis la récolte · {nomEspace}
        </p>
        <ResponsiveContainer width="100%" height={160}>
          <LineChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="t" tick={{ fontSize: 9, fill: '#9ca3af' }} interval="preserveStartEnd" tickLine={false} />
            <YAxis yAxisId="temp" domain={['auto', 'auto']} tick={{ fontSize: 9, fill: '#ef4444' }} tickLine={false} axisLine={false} />
            <YAxis yAxisId="hygro" orientation="right" domain={[0, 100]} tick={{ fontSize: 9, fill: '#3b82f6' }} tickLine={false} axisLine={false} />
            <Tooltip
              contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #e5e7eb' }}
              formatter={(val: number, name: string) =>
                name === 'Temp.' ? [`${val}°C`, name] : [`${val}%`, name]
              }
            />
            <Legend wrapperStyle={{ fontSize: 10 }} />
            <Line yAxisId="temp" type="monotone" dataKey="temp" name="Temp." stroke="#ef4444" dot={false} strokeWidth={1.5} />
            <Line yAxisId="hygro" type="monotone" dataKey="hygro" name="Hygro." stroke="#3b82f6" dot={false} strokeWidth={1.5} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

// ─── Ligne du tableau ─────────────────────────────────────────────────────────

function PlantRow({
  plant,
  onDebutCuring,
  onFinCuring,
  onAssignerEspace,
  onOuvertureBocal,
  onEditCuring,
  onWpff,
}: {
  plant: PlantSechage
  onDebutCuring: (plant: PlantSechage) => void
  onFinCuring: (plant: PlantSechage) => void
  onAssignerEspace: (plant: PlantSechage) => void
  onOuvertureBocal: (plant: PlantSechage) => void
  onEditCuring: (plant: PlantSechage) => void
  onWpff: (plant: PlantSechage) => void
}) {
  const [expanded, setExpanded] = useState(false)
  // R+X : jours depuis la récolte (toujours croissant)
  const recolteJ = joursDepuis(plant.date_recolte)
  // J+X : jours depuis le début du curing (date_fin_sechage) — uniquement en curing
  const curingJ = plant.statut === 'curing' ? joursDepuis(plant.date_fin_sechage) : null
  // Pour les plantes en séchage on garde l'ancienne logique
  const dureeJ = plant.statut === 'sechage' ? (plant.duree_sechage_j ?? recolteJ) : recolteJ

  const espaceAffiche = plant.nom_espace_sechage || plant.nom_espace
  const espaceEstSechage = !!plant.nom_espace_sechage && plant.nom_espace_sechage !== plant.nom_espace

  // Bocal hors espace : curing en bocal sans espace de curing assigné
  const isBocalHorsEspace = plant.statut === 'curing'
    && plant.type_contenant === 'Bocal'
    && !plant.id_espace_curing

  // Statut d'ouverture bocal (burping) — uniquement pour les bocaux
  const burpStatus = (plant.statut === 'curing' && plant.type_contenant === 'Bocal')
    ? getBurpStatus(plant)
    : null

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden">
      {/* Ligne principale */}
      <div
        className="flex flex-col p-4 bg-white hover:bg-gray-50 cursor-pointer transition-colors gap-2"
        onClick={() => setExpanded(e => !e)}
      >
        {/* Ligne 1 : statut + nom + chevron */}
        <div className="flex items-center gap-3">
          <span className={`flex-shrink-0 text-xs font-semibold px-2.5 py-1 rounded-full ${
            plant.statut === 'sechage'
              ? 'bg-yellow-100 text-yellow-700'
              : 'bg-purple-100 text-purple-700'
          }`}>
            {plant.statut === 'sechage' ? '🌬️ Séchage' : '🏺 Curing'}
          </span>

          <div className="flex-1 min-w-0">
            <p className="font-semibold text-gray-900 text-sm truncate">{plant.nom_affichage}</p>
            <p className="text-xs text-gray-500 truncate">
              {plant.nom_variete || '—'}
              {plant.nom_breeder && <span className="ml-1 text-gray-400">· {plant.nom_breeder}</span>}
            </p>
          </div>

          <div className="flex-shrink-0 text-gray-400">
            {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </div>
        </div>

        {/* Ligne 2 : métadonnées + boutons */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1 text-xs text-gray-500">
            <Calendar size={11} className="text-gray-400" />
            <span className="whitespace-nowrap">{formatDate(plant.date_recolte)}</span>
          </div>

          {/* R+X : jours depuis récolte */}
          <div className={`flex items-center gap-1.5 px-2 py-1 rounded-lg ${dureeColor(dureeJ)}`}>
            <Clock size={11} />
            <span className="text-xs font-bold">{dureeJ != null ? `R+${dureeJ}` : '—'}</span>
          </div>

          {/* J+X : jours de curing (uniquement en curing) */}
          {curingJ != null && (
            <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-purple-100 text-purple-700">
              <Clock size={11} />
              <span className="text-xs font-bold">J+{curingJ}</span>
            </div>
          )}

          {/* Espace de séchage (statut sechage uniquement) */}
          {plant.statut === 'sechage' && espaceAffiche && (
            <div className={`flex items-center gap-1 text-xs px-2 py-1 rounded-lg ${
              espaceEstSechage
                ? 'bg-yellow-50 text-yellow-700 border border-yellow-200'
                : 'bg-gray-100 text-gray-500'
            }`}>
              <MapPin size={10} />
              <span className="truncate max-w-[120px]">{espaceAffiche}</span>
              {plant.methode_sechage && <span className="text-gray-400">· {plant.methode_sechage}</span>}
            </div>
          )}

          {/* Espace de curing (curing dans un espace) */}
          {plant.statut === 'curing' && plant.nom_espace_curing && (
            <div className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg bg-purple-50 text-purple-700 border border-purple-200">
              <MapPin size={10} />
              <span className="truncate max-w-[120px]">{plant.nom_espace_curing}</span>
            </div>
          )}

          {/* Badge bocal hors espace */}
          {isBocalHorsEspace && (
            <div className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg bg-gray-100 text-gray-500">
              <Layers size={10} />
              <span>Hors espace</span>
            </div>
          )}

          {/* Poids humide */}
          {plant.poids_humide_g != null && plant.statut === 'sechage' && (
            <div className="flex items-center gap-1 text-xs text-gray-500">
              <Scale size={11} className="text-gray-400" />
              <span>{plant.poids_humide_g}g humide</span>
            </div>
          )}

          {/* Poids sec */}
          {plant.poids_recolte_g != null && (
            <div className="flex items-center gap-1 text-xs text-gray-600">
              <Scale size={11} className="text-gray-400" />
              <span className="font-medium">{plant.poids_recolte_g}g{plant.statut === 'curing' ? '' : ' sec'}</span>
            </div>
          )}

          {/* Infos curing */}
          {plant.statut === 'curing' && (plant.type_contenant || plant.nom_materiel_bocal) && (
            <div className="flex items-center gap-1 text-xs bg-purple-50 text-purple-700 px-2 py-1 rounded-lg border border-purple-100">
              <Package size={10} />
              <span>
                {plant.nom_materiel_bocal || plant.type_contenant}
                {plant.volume_contenant_l ? ` ${plant.volume_contenant_l}L` : ''}
              </span>
              {plant.boveda_rh && <span className="text-purple-400">· Boveda {plant.boveda_rh}%</span>}
            </div>
          )}

          {/* Badge ouverture bocal (burping) */}
          {burpStatus && (
            <div className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-medium ${burpStatus.badgeClass}`}>
              <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${burpStatus.dot}`} />
              <span>🫙 {burpStatus.neverOpened ? `Jamais ouvert` : burpStatus.label}</span>
              {burpStatus.jours > burpStatus.window && (
                <span className="font-bold">⚠️</span>
              )}
            </div>
          )}

          <div className="flex-1" />

          {/* Bouton assigner espace (séchage) */}
          {plant.statut === 'sechage' && (
            <button
              onClick={e => { e.stopPropagation(); onAssignerEspace(plant) }}
              className={`flex-shrink-0 px-2.5 py-1.5 text-xs rounded-lg font-medium whitespace-nowrap flex items-center gap-1 ${
                plant.id_session_sechage
                  ? 'border border-gray-200 text-gray-500 hover:bg-gray-50'
                  : 'border border-dashed border-yellow-300 text-yellow-600 hover:bg-yellow-50'
              }`}
            >
              <MapPin size={11} />
              {plant.id_session_sechage ? 'Espace' : 'Assigner espace'}
            </button>
          )}

          {/* Bouton modifier curing (espace + bocal) */}
          {plant.statut === 'curing' && (
            <button
              onClick={e => { e.stopPropagation(); onEditCuring(plant) }}
              className="flex-shrink-0 px-2.5 py-1.5 text-xs rounded-lg font-medium whitespace-nowrap flex items-center gap-1 border border-gray-200 text-gray-500 hover:bg-gray-50"
            >
              <Pencil size={11} />
              Modifier
            </button>
          )}

          {/* Bouton ouvrir bocal (curing bocal hors espace) */}
          {isBocalHorsEspace && (
            <button
              onClick={e => { e.stopPropagation(); onOuvertureBocal(plant) }}
              className="flex-shrink-0 px-2.5 py-1.5 text-xs rounded-lg font-medium whitespace-nowrap flex items-center gap-1 border border-purple-200 text-purple-600 hover:bg-purple-50"
            >
              🫙 Ouvrir bocal
            </button>
          )}

          {/* Bouton WPFF (séchage → congélateur direct) */}
          {plant.statut === 'sechage' && (
            <button
              onClick={e => { e.stopPropagation(); onWpff(plant) }}
              className="flex-shrink-0 px-2.5 py-1.5 text-xs rounded-lg font-medium whitespace-nowrap flex items-center gap-1 border border-blue-200 text-blue-600 hover:bg-blue-50"
            >
              <Snowflake size={11} />
              WPFF
            </button>
          )}

          {/* Bouton début curing */}
          {plant.statut === 'sechage' && (
            <button
              onClick={e => { e.stopPropagation(); onDebutCuring(plant) }}
              className="flex-shrink-0 px-3 py-1.5 bg-grow-600 text-white text-xs rounded-lg hover:bg-grow-700 font-medium whitespace-nowrap"
            >
              🏺 Début curing
            </button>
          )}

          {/* Bouton terminer curing */}
          {plant.statut === 'curing' && (
            <button
              onClick={e => { e.stopPropagation(); onFinCuring(plant) }}
              className="flex-shrink-0 px-3 py-1.5 bg-green-600 text-white text-xs rounded-lg hover:bg-green-700 font-medium whitespace-nowrap flex items-center gap-1"
            >
              <CheckCircle2 size={13} />
              Terminer
            </button>
          )}
        </div>
      </div>

      {/* Détail expandable */}
      {expanded && (
        <div className="px-4 pb-4 bg-gray-50 border-t border-gray-100">
          <div className="flex flex-wrap gap-2 mt-3 mb-1">
            {plant.nom_culture && (
              <span className="text-[11px] bg-white border border-gray-200 rounded px-2 py-0.5 text-gray-600">
                📦 {plant.nom_culture}
              </span>
            )}
            {plant.nom_espace && (
              <span className="text-[11px] bg-white border border-gray-200 rounded px-2 py-0.5 text-gray-600">
                🏠 Culture : {plant.nom_espace}
              </span>
            )}
            {espaceEstSechage && (
              <span className="text-[11px] bg-yellow-50 border border-yellow-200 rounded px-2 py-0.5 text-yellow-700">
                🌬️ Séchage : {plant.nom_espace_sechage}
              </span>
            )}
            {plant.statut === 'curing' && plant.nom_espace_curing && (
              <span className="text-[11px] bg-purple-50 border border-purple-200 rounded px-2 py-0.5 text-purple-700">
                🏺 Curing dans : {plant.nom_espace_curing}
              </span>
            )}
            {plant.date_fin_sechage && (
              <span className="text-[11px] bg-purple-50 border border-purple-200 rounded px-2 py-0.5 text-purple-600">
                🏺 Curing depuis le {formatDate(plant.date_fin_sechage)}
              </span>
            )}
          </div>

          {/* Détail burping bocal */}
          {burpStatus && (
            <div className={`mt-2 rounded-lg px-3 py-2 text-xs ${burpStatus.badgeClass}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${burpStatus.dot}`} />
                  <span className="font-semibold">
                    {burpStatus.neverOpened
                      ? 'Bocal jamais ouvert depuis le début du curing'
                      : `Dernière ouverture : ${formatDate(plant.derniere_ouverture_bocal)} (${burpStatus.label})`
                    }
                  </span>
                  {burpStatus.jours > burpStatus.window && (
                    <span className="font-bold">⚠️ À ouvrir dès maintenant</span>
                  )}
                </div>
                <span className="text-[10px] opacity-70">
                  Fenêtre recommandée : {burpStatus.window === 1 ? 'chaque jour' : `tous les ${burpStatus.window}j`} · {burpStatus.dureeRecommandee}
                </span>
              </div>
            </div>
          )}

          <GrapheSechage plant={plant} />
        </div>
      )}
    </div>
  )
}

// ─── Page principale ──────────────────────────────────────────────────────────

export default function SechageCuring() {
  const qc = useQueryClient()
  const [activeTab, setActiveTab]                     = useState<'sechage' | 'curing'>('sechage')
  const [curingModal, setCuringModal]                 = useState<PlantSechage | null>(null)
  const [finCuringModal, setFinCuringModal]           = useState<PlantSechage | null>(null)
  const [assignerEspaceModal, setAssignerEspaceModal] = useState<PlantSechage | null>(null)
  const [ouvertureBocalModal, setOuvertureBocalModal] = useState<PlantSechage | null>(null)
  const [editCuringModal, setEditCuringModal]         = useState<PlantSechage | null>(null)
  const [wpffModal, setWpffModal]                     = useState<PlantSechage | null>(null)

  const { data: plants = [], isLoading } = useQuery<PlantSechage[]>({
    queryKey: ['sechage-plants'],
    queryFn: async () => (await cultureAPI.getSechagePlants()).data,
    refetchInterval: 60_000,
  })

  const debutCuring = useMutation({
    mutationFn: async ({ plant, poids, dateAction }: { plant: PlantSechage; poids: number; dateAction: string }) => {
      if (plant.id_session_sechage && plant.id_plant_sechage) {
        await sechageAPI.updatePlant(plant.id_session_sechage, plant.id_plant_sechage, {
          date_fin_sechage: dateAction,
          poids_sec_g: poids,
        })
      }
      return actionAPI.create(plant.id_culture, {
        id_plant: plant.id_plant,
        date_action: dateAction,
        type_action: 'debut_curing',
        parametres: { poids_g: poids },
      })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sechage-plants'] })
      qc.invalidateQueries({ queryKey: ['cultures'] })
    },
  })

  const finCuring = useMutation({
    mutationFn: async ({ plant, dateAction }: { plant: PlantSechage; dateAction: string }) => {
      if (plant.id_session_curing && plant.id_plant_curing) {
        await curingAPI.updatePlant(plant.id_session_curing, plant.id_plant_curing, {
          date_fin_curing: dateAction,
          poids_final_g: plant.poids_recolte_g,
        })
      }
      return actionAPI.create(plant.id_culture, {
        id_plant: plant.id_plant,
        date_action: dateAction,
        type_action: 'fin_curing',
      })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sechage-plants'] })
      qc.invalidateQueries({ queryKey: ['cultures'] })
      qc.invalidateQueries({ queryKey: ['historique-cultures'] })
    },
  })

  const ouvertureBocal = useMutation({
    mutationFn: async ({ plant, dureeMin, dateAction, note }: {
      plant: PlantSechage; dureeMin: number; dateAction: string; note?: string
    }) => {
      return actionAPI.create(plant.id_culture, {
        id_plant: plant.id_plant,
        date_action: dateAction,
        type_action: 'ouverture_bocal',
        parametres: { duree_min: dureeMin },
        note: note,
      })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sechage-plants'] })
    },
  })

  const editCuring = useMutation({
    mutationFn: async ({
      plant,
      idEspace,
      idMaterielBocal,
    }: {
      plant: PlantSechage
      idEspace: number | null
      idMaterielBocal: number | null
    }) => {
      if (!plant.id_session_curing) return
      return curingAPI.update(plant.id_session_curing, {
        id_espace: idEspace,
        id_materiel_bocal: idMaterielBocal,
      })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sechage-plants'] })
      qc.invalidateQueries({ queryKey: ['sessions-curing'] })
    },
  })

  const wpffMutation = useMutation({
    mutationFn: async ({ plant, poids, dateAction }: {
      plant: PlantSechage; poids: number | null; dateAction: string
    }) => {
      return sechageAPI.wpff(plant.id_plant, {
        poids_g:     poids     ?? undefined,
        date_action: dateAction,
      })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sechage-plants'] })
      qc.invalidateQueries({ queryKey: ['cultures'] })
      qc.invalidateQueries({ queryKey: ['stock'] })
    },
  })

  function invalidateSechage() {
    qc.invalidateQueries({ queryKey: ['sechage-plants'] })
    qc.invalidateQueries({ queryKey: ['sessions-sechage'] })
    qc.invalidateQueries({ queryKey: ['sessions-curing'] })
  }

  const enSechage = plants.filter(p => p.statut === 'sechage')
  const enCuring  = plants.filter(p => p.statut === 'curing')

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2.5 bg-yellow-100 rounded-xl">
          <Wind size={22} className="text-yellow-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Séchage &amp; Curing</h1>
          <p className="text-sm text-gray-500">
            {plants.length === 0
              ? 'Aucune plante en cours'
              : `${enSechage.length} en séchage · ${enCuring.length} en curing`}
          </p>
        </div>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-16 text-gray-400 text-sm">
          Chargement…
        </div>
      )}


      {!isLoading && plants.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="text-5xl mb-4">🌬️</div>
          <p className="text-gray-500 font-medium">Aucune plante en séchage ou curing</p>
          <p className="text-sm text-gray-400 mt-1">
            Enregistre une action "Récolte" sur une plante pour la faire apparaître ici.
          </p>
        </div>
      )}

      {/* Toggle Séchage / Curing */}
      {!isLoading && plants.length > 0 && (
        <div className="flex bg-gray-100 rounded-xl p-1 gap-1">
          <button
            onClick={() => setActiveTab('sechage')}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-sm font-semibold transition-all ${
              activeTab === 'sechage'
                ? 'bg-white shadow text-yellow-700'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <span>🌬️</span>
            <span>Séchage</span>
            {enSechage.length > 0 && (
              <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                activeTab === 'sechage' ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-200 text-gray-500'
              }`}>
                {enSechage.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('curing')}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-sm font-semibold transition-all ${
              activeTab === 'curing'
                ? 'bg-white shadow text-purple-700'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <span>🏺</span>
            <span>Curing</span>
            {enCuring.length > 0 && (
              <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                activeTab === 'curing' ? 'bg-purple-100 text-purple-700' : 'bg-gray-200 text-gray-500'
              }`}>
                {enCuring.length}
              </span>
            )}
          </button>
        </div>
      )}

      {/* Liste Séchage */}
      {!isLoading && activeTab === 'sechage' && (
        <section className="space-y-2">
          {enSechage.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="text-4xl mb-3">🌬️</div>
              <p className="text-gray-500 font-medium">Aucune plante en séchage</p>
            </div>
          ) : (
            enSechage.map(plant => (
              <PlantRow
                key={plant.id_plant}
                plant={plant}
                onDebutCuring={p => setCuringModal(p)}
                onFinCuring={p => setFinCuringModal(p)}
                onAssignerEspace={p => setAssignerEspaceModal(p)}
                onOuvertureBocal={p => setOuvertureBocalModal(p)}
                onEditCuring={p => setEditCuringModal(p)}
                onWpff={p => setWpffModal(p)}
              />
            ))
          )}
        </section>
      )}

      {/* Liste Curing */}
      {!isLoading && activeTab === 'curing' && (
        <section className="space-y-2">
          {enCuring.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="text-4xl mb-3">🏺</div>
              <p className="text-gray-500 font-medium">Aucune plante en curing</p>
            </div>
          ) : (
            enCuring.map(plant => (
              <PlantRow
                key={plant.id_plant}
                plant={plant}
                onDebutCuring={p => setCuringModal(p)}
                onFinCuring={p => setFinCuringModal(p)}
                onAssignerEspace={p => setAssignerEspaceModal(p)}
                onOuvertureBocal={p => setOuvertureBocalModal(p)}
                onEditCuring={p => setEditCuringModal(p)}
                onWpff={p => setWpffModal(p)}
              />
            ))
          )}
        </section>
      )}

      {/* Modal Assigner Espace Séchage */}
      {assignerEspaceModal && (
        <AssignerEspaceModal
          plant={assignerEspaceModal}
          onClose={() => setAssignerEspaceModal(null)}
          onAssigned={invalidateSechage}
        />
      )}

      {/* Modal Début Curing */}
      {curingModal && (
        <DebutCuringModal
          plant={curingModal}
          onClose={() => setCuringModal(null)}
          onSubmit={async (poids, dateAction) => {
            await debutCuring.mutateAsync({ plant: curingModal, poids, dateAction })
          }}
        />
      )}

      {/* Modal Terminer Curing */}
      {finCuringModal && (
        <TerminerCuringModal
          plant={finCuringModal}
          onClose={() => setFinCuringModal(null)}
          onConfirm={async (dateAction) => {
            await finCuring.mutateAsync({ plant: finCuringModal, dateAction })
          }}
        />
      )}

      {/* Modal Ouverture Bocal */}
      {ouvertureBocalModal && (
        <OuvertureBocalModal
          plant={ouvertureBocalModal}
          onClose={() => setOuvertureBocalModal(null)}
          onSubmit={async (dureeMin, dateAction, note) => {
            await ouvertureBocal.mutateAsync({ plant: ouvertureBocalModal, dureeMin, dateAction, note })
          }}
        />
      )}

      {/* Modal Modifier le curing */}
      {editCuringModal && (
        <EditCuringModal
          plant={editCuringModal}
          onClose={() => setEditCuringModal(null)}
          onSave={async (idEspace, idMaterielBocal) => {
            await editCuring.mutateAsync({ plant: editCuringModal, idEspace, idMaterielBocal })
          }}
        />
      )}

      {/* Modal WPFF */}
      {wpffModal && (
        <WpffModal
          plant={wpffModal}
          onClose={() => setWpffModal(null)}
          onSubmit={async (poids, dateAction) => {
            await wpffMutation.mutateAsync({ plant: wpffModal, poids, dateAction })
          }}
        />
      )}
    </div>
  )
}
