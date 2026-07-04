import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Plus, X, Dna, FlaskConical, Trash2, Sparkles,
  Calendar, AlertTriangle, Clock, CheckCircle2, Leaf,
  Pencil, ChevronUp, ChevronDown, ChevronsUpDown,
} from 'lucide-react'
import {
  croisementAPI,
  Croisement, CroisementCreate, CroisementUpdate, RecolteGrainesInput,
  Pollen, PollenCreate,
  TypeCroisement, StatutCroisement, MethodePollinisation,
  QualiteGraines, StockagePollen,
} from '../api/croisement'
import {
  openFieldAPI,
  ProjetOpenField, ProjetCreate, PlanteMereCreate, PlantePere, PlantePereCreate, RecolteInput,
  StatutProjet, ConditionsProjet,
} from '../api/openField'
import { varieteAPI, Variete } from '../api/varietes'
import { breederAPI, Breeder } from '../api/breeders'
import LoadingSpinner from '../components/LoadingSpinner'
import EmptyState from '../components/EmptyState'

// ── Constantes UI ─────────────────────────────────────────────────────────────

const TYPES_CROISEMENT: { value: TypeCroisement; label: string; desc: string }[] = [
  { value: 'F1',         label: 'F1',         desc: 'Première génération (parent A × parent B)' },
  { value: 'F2',         label: 'F2',         desc: 'F1 × F1 (seconde génération)' },
  { value: 'BX',         label: 'BX',         desc: 'Backcross (F1 × un des parents)' },
  { value: 'S1',         label: 'S1',         desc: 'Selfing (femelle reversée × elle-même)' },
  { value: 'IBL',        label: 'IBL',        desc: 'Lignée stabilisée (plusieurs générations)' },
  { value: 'polyhybrid', label: 'Polyhybride', desc: 'Croisement complexe multi-parents' },
]

const METHODES: { value: MethodePollinisation; label: string }[] = [
  { value: 'plante_entiere', label: 'Plante entière' },
  { value: 'branche_isolee', label: 'Branche isolée (ensachée)' },
  { value: 'pinceau',        label: 'Pinceau (fleur par fleur)' },
]

const STATUT_META: Record<StatutCroisement, { label: string; color: string; icon: any }> = {
  planifie:   { label: 'Planifié',     color: 'bg-gray-100 text-gray-700 dark:text-gray-200',       icon: Calendar },
  pollinise:  { label: 'Pollinisé',    color: 'bg-blue-100 text-blue-700',       icon: Sparkles },
  maturation: { label: 'Maturation',   color: 'bg-amber-100 text-amber-700',     icon: Clock },
  recolte:    { label: 'Récolté',      color: 'bg-green-100 text-green-700',     icon: CheckCircle2 },
  echec:      { label: 'Échec',        color: 'bg-red-100 text-red-700',         icon: AlertTriangle },
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function SortIcon({ activeCol, col, dir }: { activeCol: keyof Pollen | null; col: keyof Pollen; dir: 'asc' | 'desc' }) {
  if (activeCol !== col) return (<ChevronsUpDown size={11} className="inline ml-0.5 opacity-40" />)
  if (dir === 'asc') return (<ChevronUp size={11} className="inline ml-0.5 text-grow-600" />)
  return (<ChevronDown size={11} className="inline ml-0.5 text-grow-600" />)
}

function fmtDate(d?: string) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
}

function daysUntil(d?: string): number | null {
  if (!d) return null
  const diff = new Date(d).getTime() - Date.now()
  return Math.ceil(diff / 86400000)
}

// ════════════════════════════════════════════════════════════════════════════
//  MODAL — Nouveau croisement
// ════════════════════════════════════════════════════════════════════════════

interface NouveauCroisementModalProps {
  varietes: Variete[]
  pollenStock: Pollen[]
  onClose: () => void
}

function NouveauCroisementModal({ varietes, pollenStock, onClose }: NouveauCroisementModalProps) {
  const qc = useQueryClient()
  const [step, setStep] = useState(1)
  const [peremode, setPereMode] = useState<'pollen' | 'direct'>('direct')

  const [form, setForm] = useState<CroisementCreate>({
    nom_croisement: '',
    type_croisement: 'F1',
    pere_reverse: false,
    statut: 'planifie',
  })

  const createMut = useMutation({
    mutationFn: (data: CroisementCreate) => croisementAPI.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['croisements'] })
      qc.invalidateQueries({ queryKey: ['pollen'] })
      onClose()
    },
  })

  const mereNom = varietes.find(v => v.id_variete === form.id_variete_mere)?.nom_variete
  const pereNom = peremode === 'pollen'
    ? pollenStock.find(p => p.id_pollen === form.id_pollen)?.nom_pollen
    : varietes.find(v => v.id_variete === form.id_variete_pere)?.nom_variete

  // Auto-nom
  const autoNom = mereNom && pereNom
    ? `${mereNom} × ${pereNom}${form.type_croisement && form.type_croisement !== 'F1' ? ` ${form.type_croisement}` : ' F1'}`
    : ''

  const canNext1 = !!form.id_variete_mere && (
    (peremode === 'pollen' && !!form.id_pollen) ||
    (peremode === 'direct' && !!form.id_variete_pere)
  )
  const canSubmit = !!(form.nom_croisement || autoNom) && !!form.type_croisement

  const handleSubmit = () => {
    const payload: CroisementCreate = {
      ...form,
      nom_croisement: form.nom_croisement || autoNom,
    }
    // Nettoyer : ne pas envoyer l'id inverse au mode choisi
    if (peremode === 'pollen') {
      payload.id_variete_pere = undefined
      payload.pheno_pere = undefined
    } else {
      payload.id_pollen = undefined
      payload.quantite_pollen_utilisee_g = undefined
    }
    createMut.mutate(payload)
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white dark:bg-gray-800 border-b px-6 py-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Dna size={20} className="text-grow-600" /> Nouveau croisement
            <span className="text-sm text-gray-400 dark:text-gray-500 font-normal">— étape {step}/3</span>
          </h2>
          <button onClick={onClose} className="text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:text-gray-200"><X size={20} /></button>
        </div>

        <div className="p-6 space-y-5">
          {/* ── Étape 1 : Parents ───────────────────────────────── */}
          {step === 1 && (
            <>
              <div>
                <h3 className="font-medium text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-2">
                  <Leaf size={16} className="text-pink-500" /> Parent mère (porteuse de graines)
                </h3>
                <div className="space-y-2">
                  <select
                    value={form.id_variete_mere || ''}
                    onChange={e => setForm({ ...form, id_variete_mere: Number(e.target.value) || undefined })}
                    className="w-full rounded border-gray-300 dark:border-gray-600 px-3 py-2 text-sm"
                  >
                    <option value="">— Choisir une variété —</option>
                    {[...varietes].sort((a, b) => a.nom_variete.localeCompare(b.nom_variete, 'fr', { sensitivity: 'base' })).map(v => <option key={v.id_variete} value={v.id_variete}>{v.nom_variete}</option>)}
                  </select>
                  <input
                    type="text"
                    placeholder="Pheno (ex : pheno #3)"
                    value={form.pheno_mere || ''}
                    onChange={e => setForm({ ...form, pheno_mere: e.target.value })}
                    className="w-full rounded border-gray-300 dark:border-gray-600 px-3 py-2 text-sm"
                  />
                </div>
              </div>

              <div>
                <h3 className="font-medium text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-2">
                  <Sparkles size={16} className="text-blue-500" /> Parent père (pollen)
                </h3>

                <div className="flex gap-2 mb-3">
                  <button
                    type="button"
                    onClick={() => setPereMode('direct')}
                    className={`flex-1 px-3 py-2 rounded text-sm font-medium ${peremode === 'direct' ? 'bg-grow-600 text-white' : 'bg-gray-100 text-gray-700 dark:text-gray-200'}`}
                  >
                    Saisie directe (variété)
                  </button>
                  <button
                    type="button"
                    onClick={() => setPereMode('pollen')}
                    className={`flex-1 px-3 py-2 rounded text-sm font-medium ${peremode === 'pollen' ? 'bg-grow-600 text-white' : 'bg-gray-100 text-gray-700 dark:text-gray-200'}`}
                  >
                    Depuis stock pollen ({pollenStock.length})
                  </button>
                </div>

                {peremode === 'direct' && (
                  <div className="space-y-2">
                    <select
                      value={form.id_variete_pere || ''}
                      onChange={e => setForm({ ...form, id_variete_pere: Number(e.target.value) || undefined })}
                      className="w-full rounded border-gray-300 dark:border-gray-600 px-3 py-2 text-sm"
                    >
                      <option value="">— Choisir une variété —</option>
                      {[...varietes].sort((a, b) => a.nom_variete.localeCompare(b.nom_variete, 'fr', { sensitivity: 'base' })).map(v => <option key={v.id_variete} value={v.id_variete}>{v.nom_variete}</option>)}
                    </select>
                    <input
                      type="text"
                      placeholder="Pheno / origine (ex : mâle Zkittlez ami X)"
                      value={form.pheno_pere || ''}
                      onChange={e => setForm({ ...form, pheno_pere: e.target.value })}
                      className="w-full rounded border-gray-300 dark:border-gray-600 px-3 py-2 text-sm"
                    />
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={form.pere_reverse || false}
                        onChange={e => setForm({ ...form, pere_reverse: e.target.checked })}
                      />
                      Femelle reversée (STS) — pollen féminisé
                    </label>
                  </div>
                )}

                {peremode === 'pollen' && (
                  <div className="space-y-2">
                    {pollenStock.length === 0 ? (
                      <div className="text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500 italic p-3 bg-gray-50 dark:bg-gray-700/50 rounded">
                        Aucun pollen en stock. Bascule vers "Saisie directe" ou ajoute du pollen dans l'onglet "Stock pollen".
                      </div>
                    ) : (
                      <>
                        <select
                          value={form.id_pollen || ''}
                          onChange={e => setForm({ ...form, id_pollen: Number(e.target.value) || undefined })}
                          className="w-full rounded border-gray-300 dark:border-gray-600 px-3 py-2 text-sm"
                        >
                          <option value="">— Choisir du pollen —</option>
                          {[...pollenStock].filter(p => p.actif).sort((a, b) => a.nom_pollen.localeCompare(b.nom_pollen, 'fr', { sensitivity: 'base' })).map(p => (
                            <option key={p.id_pollen} value={p.id_pollen}>
                              {p.nom_pollen}
                              {p.nom_variete_source && ` (${p.nom_variete_source})`}
                              {p.reverse && ' — reversé'}
                              {p.quantite_restante_g != null && ` — ${p.quantite_restante_g}g dispo`}
                            </option>
                          ))}
                        </select>
                        <input
                          type="number"
                          step="0.001"
                          placeholder="Quantité pollen utilisée (g) — optionnel"
                          value={form.quantite_pollen_utilisee_g || ''}
                          onChange={e => setForm({ ...form, quantite_pollen_utilisee_g: Number(e.target.value) || undefined })}
                          className="w-full rounded border-gray-300 dark:border-gray-600 px-3 py-2 text-sm"
                        />
                      </>
                    )}
                  </div>
                )}
              </div>
            </>
          )}

          {/* ── Étape 2 : Type & Pollinisation ──────────────────────── */}
          {step === 2 && (
            <>
              <div>
                <label className="block text-sm font-medium mb-1">Type de croisement</label>
                <div className="grid grid-cols-2 gap-2">
                  {TYPES_CROISEMENT.map(t => (
                    <button
                      key={t.value}
                      type="button"
                      onClick={() => setForm({ ...form, type_croisement: t.value })}
                      className={`text-left px-3 py-2 rounded border text-sm ${form.type_croisement === t.value ? 'border-grow-600 bg-grow-50' : 'border-gray-200 dark:border-gray-700'}`}
                    >
                      <div className="font-medium">{t.label}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500">{t.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1">Date de pollinisation</label>
                  <input
                    type="date"
                    value={form.date_pollinisation || ''}
                    onChange={e => setForm({ ...form, date_pollinisation: e.target.value || undefined })}
                    className="w-full rounded border-gray-300 dark:border-gray-600 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Méthode</label>
                  <select
                    value={form.methode || ''}
                    onChange={e => setForm({ ...form, methode: (e.target.value as MethodePollinisation) || undefined })}
                    className="w-full rounded border-gray-300 dark:border-gray-600 px-3 py-2 text-sm"
                  >
                    <option value="">— Choisir —</option>
                    {METHODES.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Zone pollinisée</label>
                <input
                  type="text"
                  placeholder="Ex : 2 branches du bas, plante entière…"
                  value={form.zone_pollinisee || ''}
                  onChange={e => setForm({ ...form, zone_pollinisee: e.target.value })}
                  className="w-full rounded border-gray-300 dark:border-gray-600 px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Statut initial</label>
                <select
                  value={form.statut || 'planifie'}
                  onChange={e => setForm({ ...form, statut: e.target.value as StatutCroisement })}
                  className="w-full rounded border-gray-300 dark:border-gray-600 px-3 py-2 text-sm"
                >
                  <option value="planifie">Planifié</option>
                  <option value="pollinise">Pollinisé (déjà fait)</option>
                  <option value="maturation">Maturation en cours</option>
                </select>
              </div>
            </>
          )}

          {/* ── Étape 3 : Nom & Notes ───────────────────────────────── */}
          {step === 3 && (
            <>
              <div>
                <label className="block text-sm font-medium mb-1">Nom du croisement</label>
                <input
                  type="text"
                  placeholder={autoNom || 'Nom de ce croisement'}
                  value={form.nom_croisement}
                  onChange={e => setForm({ ...form, nom_croisement: e.target.value })}
                  className="w-full rounded border-gray-300 dark:border-gray-600 px-3 py-2 text-sm"
                />
                {autoNom && !form.nom_croisement && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500 mt-1">Suggestion : <button className="text-grow-600 underline" onClick={() => setForm({ ...form, nom_croisement: autoNom })}>{autoNom}</button></p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Notes</label>
                <textarea
                  rows={4}
                  value={form.notes || ''}
                  onChange={e => setForm({ ...form, notes: e.target.value })}
                  className="w-full rounded border-gray-300 dark:border-gray-600 px-3 py-2 text-sm"
                  placeholder="Observations, objectifs, contexte…"
                />
              </div>
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded p-3 text-sm">
                <div className="font-medium text-gray-700 dark:text-gray-200 mb-1">Récap</div>
                <div className="text-gray-600 dark:text-gray-300">
                  <div>♀ {mereNom || '—'}{form.pheno_mere ? ` (${form.pheno_mere})` : ''}</div>
                  <div>♂ {pereNom || '—'}{form.pheno_pere ? ` (${form.pheno_pere})` : ''}{form.pere_reverse ? ' — reversé' : ''}</div>
                  <div>Type : {form.type_croisement}</div>
                  <div>Pollinisation : {fmtDate(form.date_pollinisation)}</div>
                </div>
              </div>
            </>
          )}
        </div>

        <div className="sticky bottom-0 bg-white dark:bg-gray-800 border-t px-6 py-3 flex justify-between">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 dark:text-gray-300">Annuler</button>
          <div className="flex gap-2">
            {step > 1 && (
              <button onClick={() => setStep(step - 1)} className="px-4 py-2 text-sm border rounded">Retour</button>
            )}
            {step < 3 ? (
              <button
                onClick={() => setStep(step + 1)}
                disabled={step === 1 && !canNext1}
                className="px-4 py-2 text-sm bg-grow-600 text-white rounded disabled:opacity-50"
              >
                Suivant
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={!canSubmit || createMut.isPending}
                className="px-4 py-2 text-sm bg-grow-600 text-white rounded disabled:opacity-50"
              >
                {createMut.isPending ? 'Création…' : 'Créer le croisement'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
//  MODAL — Finaliser la récolte de graines
// ════════════════════════════════════════════════════════════════════════════

function RecolteModal({ croisement, onClose }: { croisement: Croisement; onClose: () => void }) {
  const qc = useQueryClient()

  // Nom de variété auto depuis les parents
  const autoNomVariete = croisement.nom_croisement

  const [data, setData] = useState<RecolteGrainesInput>({
    date_recolte_graines: new Date().toISOString().slice(0, 10),
    nb_graines: 0,
    qualite_graines: 'bonne',
    creer_variete: true,
    nom_variete_resultat: autoNomVariete,
    id_variete_existante: undefined,
    creer_packgraine: true,
    types_graines: croisement.pere_reverse ? 'Féminisée' : 'Regular',
    id_breeder: undefined,
    nom_breeder_nouveau: '',
  })

  const [nouveauBreeder, setNouveauBreeder] = useState(false)

  const { data: breeders = [] } = useQuery<Breeder[]>({
    queryKey: ['breeders'],
    queryFn: async () => (await breederAPI.getAll()).data,
  })

  const { data: varietes = [] } = useQuery<Variete[]>({
    queryKey: ['varietes'],
    queryFn: async () => (await varieteAPI.getAll()).data,
  })

  const mut = useMutation({
    mutationFn: () => {
      const payload: RecolteGrainesInput = {
        ...data,
        nom_breeder_nouveau: nouveauBreeder ? (data.nom_breeder_nouveau || undefined) : undefined,
        id_breeder: nouveauBreeder ? undefined : data.id_breeder,
      }
      return croisementAPI.finaliserRecolte(croisement.id_croisement, payload)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['croisements'] })
      qc.invalidateQueries({ queryKey: ['varietes'] })
      qc.invalidateQueries({ queryKey: ['catalogue'] })
      qc.invalidateQueries({ queryKey: ['graines'] })
      qc.invalidateQueries({ queryKey: ['breeders'] })
      onClose()
    },
  })

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="border-b px-6 py-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Sparkles size={20} className="text-green-600" /> Récolter les graines
          </h2>
          <button onClick={onClose}><X size={20} /></button>
        </div>
        <div className="p-6 space-y-4">
          <div className="text-sm text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-gray-700/50 rounded p-3">
            Croisement : <span className="font-medium text-gray-900 dark:text-gray-100">{croisement.nom_croisement}</span>
          </div>

          {/* Date + nb graines */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">Date récolte</label>
              <input
                type="date"
                value={data.date_recolte_graines}
                onChange={e => setData({ ...data, date_recolte_graines: e.target.value })}
                className="w-full rounded border-gray-300 dark:border-gray-600 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Nombre de graines</label>
              <input
                type="number"
                value={data.nb_graines}
                onChange={e => setData({ ...data, nb_graines: Number(e.target.value) })}
                className="w-full rounded border-gray-300 dark:border-gray-600 px-3 py-2 text-sm"
              />
            </div>
          </div>

          {/* Qualité + poids */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">Qualité</label>
              <select
                value={data.qualite_graines}
                onChange={e => setData({ ...data, qualite_graines: e.target.value as QualiteGraines })}
                className="w-full rounded border-gray-300 dark:border-gray-600 px-3 py-2 text-sm"
              >
                <option value="bonne">Bonne (mature, foncée)</option>
                <option value="moyenne">Moyenne</option>
                <option value="immature">Immature (vertes/pâles)</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Poids total (g)</label>
              <input
                type="number"
                step="0.01"
                value={data.poids_graines_g || ''}
                onChange={e => setData({ ...data, poids_graines_g: Number(e.target.value) || undefined })}
                className="w-full rounded border-gray-300 dark:border-gray-600 px-3 py-2 text-sm"
              />
            </div>
          </div>

          {/* Type de graines */}
          <div>
            <label className="block text-sm font-medium mb-1">Type de graines</label>
            <select
              value={data.types_graines}
              onChange={e => setData({ ...data, types_graines: e.target.value })}
              className="w-full rounded border-gray-300 dark:border-gray-600 px-3 py-2 text-sm"
            >
              <option value="Regular">Regular</option>
              <option value="Féminisée">Féminisée</option>
              <option value="Auto">Auto</option>
            </select>
          </div>

          {/* Breeder */}
          <div>
            <label className="block text-sm font-medium mb-1">Breeder</label>
            <div className="flex gap-2 mb-2">
              <button
                type="button"
                onClick={() => setNouveauBreeder(false)}
                className={`flex-1 px-3 py-1.5 rounded text-xs font-medium ${!nouveauBreeder ? 'bg-grow-600 text-white' : 'bg-gray-100 text-gray-700 dark:text-gray-200'}`}
              >
                Choisir existant
              </button>
              <button
                type="button"
                onClick={() => setNouveauBreeder(true)}
                className={`flex-1 px-3 py-1.5 rounded text-xs font-medium ${nouveauBreeder ? 'bg-grow-600 text-white' : 'bg-gray-100 text-gray-700 dark:text-gray-200'}`}
              >
                + Nouveau breeder
              </button>
            </div>
            {!nouveauBreeder ? (
              <select
                value={data.id_breeder || ''}
                onChange={e => setData({ ...data, id_breeder: Number(e.target.value) || undefined })}
                className="w-full rounded border-gray-300 dark:border-gray-600 px-3 py-2 text-sm"
              >
                <option value="">— Aucun (maison) —</option>
                {breeders.map(b => (
                  <option key={b.id_breeder} value={b.id_breeder}>{b.nom_breeder}</option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                placeholder="Nom du nouveau breeder"
                value={data.nom_breeder_nouveau || ''}
                onChange={e => setData({ ...data, nom_breeder_nouveau: e.target.value })}
                className="w-full rounded border-gray-300 dark:border-gray-600 px-3 py-2 text-sm"
              />
            )}
          </div>

          {/* Variété + pack */}
          <div className="border-t pt-4 space-y-3">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={data.creer_variete}
                onChange={e => setData({ ...data, creer_variete: e.target.checked, id_variete_existante: undefined })}
              />
              Créer la <span className="font-medium">Variété</span> dans le catalogue
            </label>
            {data.creer_variete ? (
              <div>
                <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Nom de la variété</label>
                <input
                  type="text"
                  value={data.nom_variete_resultat || ''}
                  onChange={e => setData({ ...data, nom_variete_resultat: e.target.value })}
                  className="w-full rounded border-gray-300 dark:border-gray-600 px-3 py-2 text-sm"
                  placeholder={autoNomVariete}
                />
                {data.nom_variete_resultat !== autoNomVariete && (
                  <button
                    type="button"
                    onClick={() => setData({ ...data, nom_variete_resultat: autoNomVariete })}
                    className="text-xs text-grow-600 underline mt-1"
                  >
                    Remettre la suggestion : {autoNomVariete}
                  </button>
                )}
              </div>
            ) : (
              <div>
                <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                  Lier à une variété existante <span className="text-gray-400">(optionnel)</span>
                </label>
                <select
                  value={data.id_variete_existante || ''}
                  onChange={e => setData({ ...data, id_variete_existante: Number(e.target.value) || undefined })}
                  className="w-full rounded border-gray-300 dark:border-gray-600 px-3 py-2 text-sm"
                >
                  <option value="">— Aucune —</option>
                  {[...varietes].sort((a, b) => a.nom_variete.localeCompare(b.nom_variete, 'fr', { sensitivity: 'base' })).map(v => (
                    <option key={v.id_variete} value={v.id_variete}>{v.nom_variete}</option>
                  ))}
                </select>
              </div>
            )}
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={data.creer_packgraine}
                onChange={e => setData({ ...data, creer_packgraine: e.target.checked })}
              />
              Créer un <span className="font-medium">Pack de graines maison</span> ({data.nb_graines} graines)
            </label>
          </div>
        </div>
        <div className="border-t px-6 py-3 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 dark:text-gray-300">Annuler</button>
          <button
            onClick={() => mut.mutate()}
            disabled={mut.isPending || !data.nb_graines}
            className="px-4 py-2 text-sm bg-grow-600 text-white rounded disabled:opacity-50"
          >
            {mut.isPending ? 'Enregistrement…' : 'Finaliser'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
//  MODAL — Nouveau pollen
// ════════════════════════════════════════════════════════════════════════════

function NouveauPollenModal({ varietes, onClose }: { varietes: Variete[]; onClose: () => void }) {
  const qc = useQueryClient()
  const [data, setData] = useState<PollenCreate>({
    nom_pollen: '',
    reverse: false,
    stockage: 'congelateur',
    date_collecte: new Date().toISOString().slice(0, 10),
  })

  const mut = useMutation({
    mutationFn: () => croisementAPI.createPollen(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pollen'] })
      onClose()
    },
  })

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl max-w-lg w-full">
        <div className="border-b px-6 py-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <FlaskConical size={20} className="text-grow-600" /> Collecter du pollen
          </h2>
          <button onClick={onClose}><X size={20} /></button>
        </div>
        <div className="p-6 space-y-3">
          <div>
            <label className="block text-sm font-medium mb-1">Nom du lot</label>
            <input
              type="text"
              placeholder="Ex : Gelato mâle #3 — avril 2026"
              value={data.nom_pollen}
              onChange={e => setData({ ...data, nom_pollen: e.target.value })}
              className="w-full rounded border-gray-300 dark:border-gray-600 px-3 py-2 text-sm"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">Variété source</label>
              <select
                value={data.id_variete_source || ''}
                onChange={e => setData({ ...data, id_variete_source: Number(e.target.value) || undefined })}
                className="w-full rounded border-gray-300 dark:border-gray-600 px-3 py-2 text-sm"
              >
                <option value="">— Inconnue —</option>
                {[...varietes].sort((a, b) => a.nom_variete.localeCompare(b.nom_variete, 'fr', { sensitivity: 'base' })).map(v => <option key={v.id_variete} value={v.id_variete}>{v.nom_variete}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Pheno</label>
              <input
                type="text"
                value={data.pheno_source || ''}
                onChange={e => setData({ ...data, pheno_source: e.target.value })}
                className="w-full rounded border-gray-300 dark:border-gray-600 px-3 py-2 text-sm"
              />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={data.reverse || false}
              onChange={e => setData({ ...data, reverse: e.target.checked })}
            />
            Femelle reversée (STS) — pollen féminisé
          </label>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">Date collecte</label>
              <input
                type="date"
                value={data.date_collecte || ''}
                onChange={e => setData({ ...data, date_collecte: e.target.value || undefined })}
                className="w-full rounded border-gray-300 dark:border-gray-600 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Quantité (g)</label>
              <input
                type="number"
                step="0.001"
                value={data.quantite_initiale_g || ''}
                onChange={e => setData({ ...data, quantite_initiale_g: Number(e.target.value) || undefined })}
                className="w-full rounded border-gray-300 dark:border-gray-600 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Stockage</label>
              <select
                value={data.stockage || ''}
                onChange={e => setData({ ...data, stockage: (e.target.value as StockagePollen) || undefined })}
                className="w-full rounded border-gray-300 dark:border-gray-600 px-3 py-2 text-sm"
              >
                <option value="ambiant">Ambiant (~1 mois)</option>
                <option value="frigo">Frigo (~6 mois)</option>
                <option value="congelateur">Congélateur (~18 mois)</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Notes</label>
            <textarea
              rows={2}
              value={data.notes || ''}
              onChange={e => setData({ ...data, notes: e.target.value })}
              className="w-full rounded border-gray-300 dark:border-gray-600 px-3 py-2 text-sm"
            />
          </div>
        </div>
        <div className="border-t px-6 py-3 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 dark:text-gray-300">Annuler</button>
          <button
            onClick={() => mut.mutate()}
            disabled={!data.nom_pollen || mut.isPending}
            className="px-4 py-2 text-sm bg-grow-600 text-white rounded disabled:opacity-50"
          >
            {mut.isPending ? '…' : 'Enregistrer'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
//  MODAL — Modifier un croisement
// ════════════════════════════════════════════════════════════════════════════

interface EditCroisementModalProps {
  croisement: Croisement
  varietes: Variete[]
  pollenStock: Pollen[]
  onClose: () => void
}

function EditCroisementModal({ croisement, varietes, pollenStock, onClose }: EditCroisementModalProps) {
  const qc = useQueryClient()
  const [form, setForm] = useState<CroisementUpdate>({
    nom_croisement: croisement.nom_croisement,
    type_croisement: croisement.type_croisement,
    id_variete_mere: croisement.id_variete_mere,
    pheno_mere: croisement.pheno_mere ?? '',
    id_variete_pere: croisement.id_variete_pere,
    id_pollen: croisement.id_pollen,
    pheno_pere: croisement.pheno_pere ?? '',
    pere_reverse: croisement.pere_reverse,
    date_pollinisation: croisement.date_pollinisation,
    methode: croisement.methode,
    zone_pollinisee: croisement.zone_pollinisee ?? '',
    statut: croisement.statut,
    notes: croisement.notes ?? '',
  })

  const updateMut = useMutation({
    mutationFn: (data: CroisementUpdate) => croisementAPI.update(croisement.id_croisement, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['croisements'] })
      onClose()
    },
  })

  const f = (field: keyof CroisementUpdate, val: any) => setForm(prev => ({ ...prev, [field]: val }))

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white dark:bg-gray-800 border-b px-6 py-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Pencil size={18} className="text-grow-600" /> Modifier le croisement
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"><X size={20} /></button>
        </div>

        <div className="p-6 space-y-4">
          {/* Nom */}
          <div>
            <label className="block text-sm font-medium mb-1">Nom du croisement</label>
            <input
              type="text"
              value={form.nom_croisement || ''}
              onChange={e => f('nom_croisement', e.target.value)}
              className="w-full rounded border-gray-300 dark:border-gray-600 px-3 py-2 text-sm"
            />
          </div>

          {/* Type + Statut */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">Type</label>
              <select
                value={form.type_croisement || ''}
                onChange={e => f('type_croisement', e.target.value as TypeCroisement)}
                className="w-full rounded border-gray-300 dark:border-gray-600 px-3 py-2 text-sm"
              >
                {TYPES_CROISEMENT.map(t => <option key={t.value} value={t.value}>{t.label} — {t.desc}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Statut</label>
              <select
                value={form.statut || 'planifie'}
                onChange={e => f('statut', e.target.value as StatutCroisement)}
                className="w-full rounded border-gray-300 dark:border-gray-600 px-3 py-2 text-sm"
              >
                <option value="planifie">Planifié</option>
                <option value="pollinise">Pollinisé</option>
                <option value="maturation">Maturation</option>
                <option value="recolte">Récolté</option>
                <option value="echec">Échec</option>
              </select>
            </div>
          </div>

          {/* Parents */}
          <div className="border rounded-lg p-4 space-y-3 bg-gray-50 dark:bg-gray-700/30">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200 flex items-center gap-1"><Leaf size={14} className="text-pink-500" /> Parent mère</h3>
            <div className="grid grid-cols-2 gap-3">
              <select
                value={form.id_variete_mere || ''}
                onChange={e => f('id_variete_mere', Number(e.target.value) || undefined)}
                className="w-full rounded border-gray-300 dark:border-gray-600 px-3 py-2 text-sm"
              >
                <option value="">— Choisir —</option>
                {[...varietes].sort((a, b) => a.nom_variete.localeCompare(b.nom_variete, 'fr', { sensitivity: 'base' })).map(v => <option key={v.id_variete} value={v.id_variete}>{v.nom_variete}</option>)}
              </select>
              <input
                type="text"
                placeholder="Pheno mère"
                value={form.pheno_mere || ''}
                onChange={e => f('pheno_mere', e.target.value)}
                className="w-full rounded border-gray-300 dark:border-gray-600 px-3 py-2 text-sm"
              />
            </div>

            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200 flex items-center gap-1 pt-1"><Sparkles size={14} className="text-blue-500" /> Parent père</h3>
            <div className="grid grid-cols-2 gap-3">
              <select
                value={form.id_variete_pere || ''}
                onChange={e => f('id_variete_pere', Number(e.target.value) || undefined)}
                className="w-full rounded border-gray-300 dark:border-gray-600 px-3 py-2 text-sm"
              >
                <option value="">— Variété directe —</option>
                {[...varietes].sort((a, b) => a.nom_variete.localeCompare(b.nom_variete, 'fr', { sensitivity: 'base' })).map(v => <option key={v.id_variete} value={v.id_variete}>{v.nom_variete}</option>)}
              </select>
              <select
                value={form.id_pollen || ''}
                onChange={e => f('id_pollen', Number(e.target.value) || undefined)}
                className="w-full rounded border-gray-300 dark:border-gray-600 px-3 py-2 text-sm"
              >
                <option value="">— Depuis stock pollen —</option>
                {[...pollenStock].sort((a, b) => a.nom_pollen.localeCompare(b.nom_pollen, 'fr', { sensitivity: 'base' })).map(p => <option key={p.id_pollen} value={p.id_pollen}>{p.nom_pollen}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <input
                type="text"
                placeholder="Pheno père"
                value={form.pheno_pere || ''}
                onChange={e => f('pheno_pere', e.target.value)}
                className="w-full rounded border-gray-300 dark:border-gray-600 px-3 py-2 text-sm"
              />
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.pere_reverse || false}
                  onChange={e => f('pere_reverse', e.target.checked)}
                />
                Femelle reversée (STS)
              </label>
            </div>
          </div>

          {/* Pollinisation */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">Date pollinisation</label>
              <input
                type="date"
                value={form.date_pollinisation || ''}
                onChange={e => f('date_pollinisation', e.target.value || undefined)}
                className="w-full rounded border-gray-300 dark:border-gray-600 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Méthode</label>
              <select
                value={form.methode || ''}
                onChange={e => f('methode', (e.target.value as MethodePollinisation) || undefined)}
                className="w-full rounded border-gray-300 dark:border-gray-600 px-3 py-2 text-sm"
              >
                <option value="">— Choisir —</option>
                {METHODES.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Zone pollinisée</label>
            <input
              type="text"
              value={form.zone_pollinisee || ''}
              onChange={e => f('zone_pollinisee', e.target.value)}
              className="w-full rounded border-gray-300 dark:border-gray-600 px-3 py-2 text-sm"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium mb-1">Notes</label>
            <textarea
              rows={3}
              value={form.notes || ''}
              onChange={e => f('notes', e.target.value)}
              className="w-full rounded border-gray-300 dark:border-gray-600 px-3 py-2 text-sm"
            />
          </div>
        </div>

        <div className="sticky bottom-0 bg-white dark:bg-gray-800 border-t px-6 py-3 flex justify-between">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 dark:text-gray-300">Annuler</button>
          <button
            onClick={() => updateMut.mutate(form)}
            disabled={!form.nom_croisement || updateMut.isPending}
            className="px-4 py-2 text-sm bg-grow-600 text-white rounded disabled:opacity-50"
          >
            {updateMut.isPending ? 'Enregistrement…' : 'Enregistrer les modifications'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
//  PAGE PRINCIPALE
// ════════════════════════════════════════════════════════════════════════════


// ─────────────────────────────────────────────────────────────────────────────
// OPEN FIELD COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────

const STATUT_OF_META: Record<StatutProjet, { label: string; color: string }> = {
  planifie:  { label: 'Planifié',  color: 'bg-gray-100 text-gray-600' },
  en_cours:  { label: 'En cours',  color: 'bg-blue-100 text-blue-700' },
  recolte:   { label: 'Récolté',   color: 'bg-green-100 text-green-700' },
  termine:   { label: 'Terminé',   color: 'bg-gray-200 text-gray-500' },
}

const QUALITE_META: Record<string, { label: string; color: string }> = {
  bonne:    { label: 'Bonne',    color: 'text-green-600' },
  moyenne:  { label: 'Moyenne',  color: 'text-amber-600' },
  immature: { label: 'Immature', color: 'text-red-600' },
}

function OpenFieldProjetCard({
  projet,
  onEditProjet, onDeleteProjet, onAddMere, onEditMere, onDeleteMere, onRecolte,
  onAddPere, onEditPere, onDeletePere,
}: {
  projet: ProjetOpenField
  onEditProjet: () => void
  onDeleteProjet: () => void
  onAddMere: () => void
  onEditMere: (m: import('../api/openField').PlanteMere) => void
  onDeleteMere: (m: import('../api/openField').PlanteMere) => void
  onRecolte: (m: import('../api/openField').PlanteMere) => void
  onAddPere: () => void
  onEditPere: (p: PlantePere) => void
  onDeletePere: (p: PlantePere) => void
}) {
  const meta = STATUT_OF_META[projet.statut] ?? STATUT_OF_META.planifie
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
      <div className="flex items-start justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-700">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-grow-50 rounded-lg mt-0.5"><Leaf size={18} className="text-grow-600" /></div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-semibold text-gray-900 dark:text-gray-100">{projet.nom}</h3>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${meta.color}`}>{meta.label}</span>
              {projet.saison && <span className="text-xs text-gray-400">{projet.saison}</span>}
            </div>
            <div className="flex items-center gap-3 mt-1 text-xs text-gray-500 flex-wrap">
              {projet.lieu && <span>📍 {projet.lieu}</span>}
              {projet.conditions && <span className="capitalize">{projet.conditions}</span>}
              {projet.culture_nom && <span>🌱 {projet.culture_nom}</span>}
              <span>{projet.nb_meres} mère{projet.nb_meres > 1 ? 's' : ''}</span>
              {projet.nb_graines_total > 0 && <span>🌰 {projet.nb_graines_total} graines récoltées</span>}
            </div>
            {projet.description && <p className="text-xs text-gray-400 mt-1">{projet.description}</p>}
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button onClick={onAddMere} className="p-1.5 text-gray-400 hover:text-grow-600 rounded" title="Ajouter une mère"><Plus size={15} /></button>
          <button onClick={onEditProjet} className="p-1.5 text-gray-400 hover:text-blue-600 rounded"><Pencil size={15} /></button>
          <button onClick={onDeleteProjet} className="p-1.5 text-gray-400 hover:text-red-600 rounded"><Trash2 size={15} /></button>
        </div>
      </div>
      {/* Section mâles */}
      <div className="px-5 py-3 bg-blue-50/50 dark:bg-blue-900/10 border-b border-gray-100 dark:border-gray-700">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-blue-700 dark:text-blue-400 uppercase tracking-wide">♂ Mâles du projet ({projet.peres?.length ?? 0})</span>
          <button onClick={onAddPere} className="text-xs text-blue-600 hover:underline">+ Ajouter</button>
        </div>
        {(projet.peres?.length ?? 0) === 0 ? (
          <p className="text-xs text-gray-400 italic">Aucun mâle enregistré</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {projet.peres.map(pere => (
              <div key={pere.id_pere} className="flex items-center gap-1 bg-white dark:bg-gray-800 border border-blue-200 dark:border-blue-700 rounded-full px-3 py-1 text-xs">
                <span className="text-blue-700 dark:text-blue-300 font-medium">{pere.variete_nom || pere.nom_libre || `Mâle #${pere.id_pere}`}</span>
                <button onClick={() => onEditPere(pere)} className="text-gray-400 hover:text-blue-600 ml-1"><Pencil size={11} /></button>
                <button onClick={() => onDeletePere(pere)} className="text-gray-400 hover:text-red-600"><Trash2 size={11} /></button>
              </div>
            ))}
          </div>
        )}
      </div>

      {projet.meres.length === 0 ? (
        <div className="px-5 py-4 text-sm text-gray-400 italic">
          Aucune plante mère — <button onClick={onAddMere} className="text-grow-600 hover:underline">ajouter la première</button>
        </div>
      ) : (
        <div className="divide-y divide-gray-50 dark:divide-gray-700">
          {projet.meres.map(mere => {
            const qualMeta = mere.qualite_graines ? QUALITE_META[mere.qualite_graines] : null
            const recoltee = !!mere.date_recolte
            return (
              <div key={mere.id_mere} className="px-5 py-3 flex items-start justify-between gap-4">
                <div className="flex items-start gap-3 min-w-0">
                  <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${recoltee ? 'bg-green-400' : 'bg-amber-400'}`} />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm text-gray-800 dark:text-gray-200">
                        {mere.variete_nom || mere.nom_phenotype || `Mère #${mere.id_mere}`}
                      </span>
                      {mere.plant_label && <span className="text-xs text-gray-400">{mere.plant_label}</span>}
                    </div>
                    <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-500 flex-wrap">
                      {mere.date_pollinisation && <span>🌸 {fmtDate(mere.date_pollinisation)}</span>}
                      {mere.methode_pollinisation && <span className="capitalize">{mere.methode_pollinisation}</span>}
                      {mere.pere_identifie
                        ? <span>♂ {mere.pollen_nom || mere.nom_pere_libre || 'père identifié'}</span>
                        : <span className="text-gray-400">♂ inconnu</span>}
                      {recoltee && <>
                        <span>🌰 {mere.nb_graines ?? '?'} gr.</span>
                        {mere.poids_graines_g && <span>{mere.poids_graines_g} g</span>}
                        {qualMeta && <span className={qualMeta.color}>{qualMeta.label}</span>}
                        {mere.id_packgraine && <span className="text-green-600">✓ Pack créé</span>}
                      </>}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {!recoltee && (
                    <button onClick={() => onRecolte(mere)} className="text-xs px-2 py-1 bg-grow-50 text-grow-700 hover:bg-grow-100 rounded font-medium">
                      Récolter
                    </button>
                  )}
                  <button onClick={() => onEditMere(mere)} className="p-1 text-gray-400 hover:text-blue-600 rounded"><Pencil size={13} /></button>
                  <button onClick={() => onDeleteMere(mere)} className="p-1 text-gray-400 hover:text-red-600 rounded"><Trash2 size={13} /></button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function NouveauProjetOpenFieldModal({ projet, onClose }: { projet?: ProjetOpenField; onClose: () => void }) {
  const qc = useQueryClient()
  const [nom, setNom] = useState(projet?.nom ?? '')
  const [saison, setSaison] = useState(projet?.saison ?? '')
  const [lieu, setLieu] = useState(projet?.lieu ?? '')
  const [conditions, setConditions] = useState<ConditionsProjet | ''>(projet?.conditions ?? '')
  const [description, setDescription] = useState(projet?.description ?? '')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!nom.trim()) return
    setLoading(true)
    const payload: ProjetCreate = {
      nom: nom.trim(),
      saison: saison || undefined,
      lieu: lieu || undefined,
      conditions: (conditions as ConditionsProjet) || undefined,
      description: description || undefined,
    }
    try {
      if (projet) await openFieldAPI.update(projet.id_projet, payload)
      else await openFieldAPI.create(payload)
      qc.invalidateQueries({ queryKey: ['open-field'] })
      onClose()
    } finally { setLoading(false) }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-md shadow-xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-700">
          <h2 className="font-semibold text-gray-900 dark:text-gray-100">{projet ? 'Modifier le projet' : 'Nouveau projet open field'}</h2>
          <button onClick={onClose}><X size={18} className="text-gray-400" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">Nom *</label>
            <input value={nom} onChange={e => setNom(e.target.value)} required
              className="w-full border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800"
              placeholder="ex: Sélection été 2026" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">Saison</label>
              <input value={saison} onChange={e => setSaison(e.target.value)}
                className="w-full border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800" placeholder="Été 2026" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">Conditions</label>
              <select value={conditions} onChange={e => setConditions(e.target.value as ConditionsProjet | '')}
                className="w-full border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800">
                <option value="">—</option>
                <option value="outdoor">Outdoor</option>
                <option value="greenhouse">Greenhouse</option>
                <option value="guerrilla">Guerrilla</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">Lieu</label>
            <input value={lieu} onChange={e => setLieu(e.target.value)}
              className="w-full border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">Description</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)} rows={2}
              className="w-full border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800" />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">Annuler</button>
            <button type="submit" disabled={loading} className="px-4 py-2 text-sm bg-grow-600 text-white rounded-lg hover:bg-grow-700 disabled:opacity-50">
              {loading ? 'Enregistrement…' : projet ? 'Modifier' : 'Créer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function AddMereModal({ projet, mere, varietes, pollenStock, onClose }: {
  projet: ProjetOpenField
  mere?: import('../api/openField').PlanteMere
  varietes: Variete[]
  pollenStock: Pollen[]
  onClose: () => void
}) {
  const qc = useQueryClient()
  const [idVariete, setIdVariete] = useState<string>(mere?.id_variete?.toString() ?? '')
  const [nomPheno, setNomPheno]   = useState(mere?.nom_phenotype ?? '')
  const [datePoll, setDatePoll]   = useState(mere?.date_pollinisation ?? '')
  const [methode, setMethode]     = useState<string>(mere?.methode_pollinisation ?? 'naturelle')
  const [pereId, setPereId]       = useState<string>(mere?.pere_identifie ? (mere.id_pollen?.toString() ?? 'libre') : '')
  const [nomPereLi, setNomPereLi] = useState(mere?.nom_pere_libre ?? '')
  const [notesPoll, setNotesPoll] = useState(mere?.notes_pollinisation ?? '')
  const [idPeres, setIdPeres]     = useState<number[]>(mere?.id_peres ?? [])
  const [loading, setLoading]     = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    const payload: PlanteMereCreate = {
      id_variete: idVariete ? parseInt(idVariete) : undefined,
      nom_phenotype: nomPheno || undefined,
      date_pollinisation: datePoll || undefined,
      methode_pollinisation: methode as import('../api/openField').MethodePollinisation,
      pere_identifie: pereId !== '',
      id_pollen: pereId && pereId !== 'libre' ? parseInt(pereId) : undefined,
      nom_pere_libre: pereId === 'libre' ? nomPereLi || undefined : undefined,
      id_peres: idPeres.length > 0 ? idPeres : undefined,
      notes_pollinisation: notesPoll || undefined,
    }
    try {
      if (mere) await openFieldAPI.updateMere(projet.id_projet, mere.id_mere, payload)
      else await openFieldAPI.addMere(projet.id_projet, payload)
      qc.invalidateQueries({ queryKey: ['open-field'] })
      onClose()
    } finally { setLoading(false) }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-md shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-700 sticky top-0 bg-white dark:bg-gray-800">
          <h2 className="font-semibold text-gray-900 dark:text-gray-100">{mere ? 'Modifier la mère' : 'Ajouter une mère'} — {projet.nom}</h2>
          <button onClick={onClose}><X size={18} className="text-gray-400" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">Variété (catalogue)</label>
            <select value={idVariete} onChange={e => setIdVariete(e.target.value)}
              className="w-full border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800">
              <option value="">— Sélectionner —</option>
              {varietes.map(v => <option key={v.id_variete} value={v.id_variete}>{v.nom_variete}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">Nom phénotype libre</label>
            <input value={nomPheno} onChange={e => setNomPheno(e.target.value)}
              className="w-full border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800"
              placeholder="ex: Phéno #3 à grands colas" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">Date pollinisation</label>
              <input type="date" value={datePoll} onChange={e => setDatePoll(e.target.value)}
                className="w-full border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">Méthode</label>
              <select value={methode} onChange={e => setMethode(e.target.value)}
                className="w-full border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800">
                <option value="naturelle">Naturelle</option>
                <option value="manuelle">Manuelle</option>
                <option value="pinceau">Pinceau</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">Père</label>
            <select value={pereId} onChange={e => setPereId(e.target.value)}
              className="w-full border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800">
              <option value="">Inconnu / naturel</option>
              <option value="libre">Identifié (saisie libre)</option>
              {pollenStock.filter(p => p.actif).map(p => <option key={p.id_pollen} value={p.id_pollen}>{p.nom_pollen}</option>)}
            </select>
          </div>
          {pereId === 'libre' && (
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">Nom du père</label>
              <input value={nomPereLi} onChange={e => setNomPereLi(e.target.value)}
                className="w-full border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800"
                placeholder="ex: Mâle sélectionné #2" />
            </div>
          )}
          {projet.peres?.length > 0 && (
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">Pères probables</label>
              <div className="space-y-1">
                {projet.peres.map(pere => (
                  <label key={pere.id_pere} className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={idPeres.includes(pere.id_pere)}
                      onChange={e => setIdPeres(e.target.checked
                        ? [...idPeres, pere.id_pere]
                        : idPeres.filter(id => id !== pere.id_pere)
                      )}
                      className="rounded"
                    />
                    <span className="text-gray-700 dark:text-gray-200">{pere.variete_nom || pere.nom_libre || `Mâle #${pere.id_pere}`}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">Notes pollinisation</label>
            <textarea value={notesPoll} onChange={e => setNotesPoll(e.target.value)} rows={2}
              className="w-full border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800" />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">Annuler</button>
            <button type="submit" disabled={loading} className="px-4 py-2 text-sm bg-grow-600 text-white rounded-lg hover:bg-grow-700 disabled:opacity-50">
              {loading ? 'Enregistrement…' : mere ? 'Modifier' : 'Ajouter'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}


function AddPereModal({ projet, pere, varietes, onClose }: {
  projet: ProjetOpenField
  pere?: PlantePere
  varietes: Variete[]
  onClose: () => void
}) {
  const qc = useQueryClient()
  const [idVariete, setIdVariete] = useState<string>(pere?.id_variete?.toString() ?? '')
  const [nomLibre, setNomLibre]   = useState(pere?.nom_libre ?? '')
  const [notes, setNotes]         = useState(pere?.notes ?? '')
  const [loading, setLoading]     = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!idVariete && !nomLibre.trim()) return
    setLoading(true)
    const payload: PlantePereCreate = {
      id_variete: idVariete ? parseInt(idVariete) : undefined,
      nom_libre:  nomLibre || undefined,
      notes:      notes || undefined,
    }
    try {
      if (pere) await openFieldAPI.updatePere(projet.id_projet, pere.id_pere, payload)
      else await openFieldAPI.addPere(projet.id_projet, payload)
      qc.invalidateQueries({ queryKey: ['open-field'] })
      onClose()
    } finally { setLoading(false) }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-sm shadow-xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-700">
          <h2 className="font-semibold text-gray-900 dark:text-gray-100">{pere ? 'Modifier le mâle' : 'Ajouter un mâle'} — {projet.nom}</h2>
          <button onClick={onClose}><X size={18} className="text-gray-400" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">Variété (catalogue)</label>
            <select value={idVariete} onChange={e => setIdVariete(e.target.value)}
              className="w-full border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800">
              <option value="">— Sélectionner —</option>
              {varietes.map(v => <option key={v.id_variete} value={v.id_variete}>{v.nom_variete}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">Nom libre</label>
            <input value={nomLibre} onChange={e => setNomLibre(e.target.value)}
              className="w-full border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800"
              placeholder="ex: Mâle phéno #2 long calice" />
            <p className="text-xs text-gray-400 mt-1">Remplis l'un ou l'autre (ou les deux)</p>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">Notes</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
              className="w-full border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800" />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">Annuler</button>
            <button type="submit" disabled={loading || (!idVariete && !nomLibre.trim())}
              className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
              {loading ? 'Enregistrement…' : pere ? 'Modifier' : 'Ajouter'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function RecolteOpenFieldModal({ projet, mere, onClose }: {
  projet: ProjetOpenField
  mere: import('../api/openField').PlanteMere
  onClose: () => void
}) {
  const qc = useQueryClient()
  const [date_, setDate]      = useState(new Date().toISOString().slice(0, 10))
  const [nbGraines, setNb]    = useState('')
  const [poids, setPoids]     = useState('')
  const [qualite, setQualite] = useState<RecolteInput['qualite_graines']>('bonne')
  const [creerPack, setCreer] = useState(true)
  const [nomVariete, setNomVariete] = useState(() => {
    const mereName = mere.variete_nom || mere.nom_phenotype || 'Inconnue'
    const peresNames = mere.peres_labels?.length ? mere.peres_labels.join(' / ') : mere.nom_pere_libre || 'inconnu'
    const saison = projet.saison || new Date().getFullYear().toString()
    return `${mereName} × ${peresNames} (OF ${saison})`
  })
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      await openFieldAPI.recolte(projet.id_projet, mere.id_mere, {
        date_recolte: date_,
        nb_graines: nbGraines ? parseInt(nbGraines) : undefined,
        poids_graines_g: poids ? parseFloat(poids) : undefined,
        qualite_graines: qualite,
        creer_pack: creerPack,
        nom_variete_croisement: nomVariete || undefined,
      })
      qc.invalidateQueries({ queryKey: ['open-field'] })
      qc.invalidateQueries({ queryKey: ['catalogue'] })
      onClose()
    } finally { setLoading(false) }
  }

  const mereName = mere.variete_nom || mere.nom_phenotype || `Mère #${mere.id_mere}`

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-sm shadow-xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-700">
          <h2 className="font-semibold text-gray-900 dark:text-gray-100">Récolte — {mereName}</h2>
          <button onClick={onClose}><X size={18} className="text-gray-400" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">Date de récolte</label>
            <input type="date" value={date_} onChange={e => setDate(e.target.value)} required
              className="w-full border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">Nb graines</label>
              <input type="number" min="0" value={nbGraines} onChange={e => setNb(e.target.value)}
                className="w-full border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800" placeholder="ex: 42" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">Poids (g)</label>
              <input type="number" step="0.01" min="0" value={poids} onChange={e => setPoids(e.target.value)}
                className="w-full border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800" placeholder="ex: 2.5" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">Qualité</label>
            <select value={qualite} onChange={e => setQualite(e.target.value as RecolteInput['qualite_graines'])}
              className="w-full border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800">
              <option value="bonne">Bonne</option>
              <option value="moyenne">Moyenne</option>
              <option value="immature">Immature</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" id="creer-pack" checked={creerPack} onChange={e => setCreer(e.target.checked)} className="rounded" />
            <label htmlFor="creer-pack" className="text-sm text-gray-700 dark:text-gray-200">Créer un PackGraine automatiquement</label>
          </div>
          {creerPack && (
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">Nom de la nouvelle variété</label>
              <input value={nomVariete} onChange={e => setNomVariete(e.target.value)}
                className="w-full border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800"
                placeholder="Auto-généré" />
              <p className="text-xs text-gray-400 mt-1">Une nouvelle variété sera créée dans le catalogue avec ce nom.</p>
            </div>
          )}
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">Annuler</button>
            <button type="submit" disabled={loading} className="px-4 py-2 text-sm bg-grow-600 text-white rounded-lg hover:bg-grow-700 disabled:opacity-50">
              {loading ? 'Enregistrement…' : 'Valider la récolte'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function CroisementPage() {
  const [tab, setTab] = useState<'croisements' | 'pollen' | 'openfield'>('croisements')
  const [showNewCroisement, setShowNewCroisement] = useState(false)
  const [showNewPollen, setShowNewPollen] = useState(false)
  const [recolteCroisement, setRecolteCroisement] = useState<Croisement | null>(null)
  const [editCroisement, setEditCroisement] = useState<Croisement | null>(null)
  const [statutFilter, setStatutFilter] = useState<StatutCroisement | 'all'>('all')
  // Tri tableau pollen
  const [pollenSort, setPollenSort] = useState<{ col: keyof Pollen; dir: 'asc' | 'desc' } | null>(null)
  // Open field
  const [showNewProjet, setShowNewProjet] = useState(false)
  const [editProjet, setEditProjet] = useState<ProjetOpenField | null>(null)
  const [showAddMere, setShowAddMere] = useState<ProjetOpenField | null>(null)
  const [editMere, setEditMere] = useState<{ projet: ProjetOpenField; mere: import('../api/openField').PlanteMere } | null>(null)
  const [recolteMere, setRecolteMere] = useState<{ projet: ProjetOpenField; mere: import('../api/openField').PlanteMere } | null>(null)
  const [showAddPere, setShowAddPere] = useState<ProjetOpenField | null>(null)
  const [editPere, setEditPere] = useState<{ projet: ProjetOpenField; pere: PlantePere } | null>(null)
  const qc = useQueryClient()

  const { data: croisements = [], isLoading: loadingC } = useQuery<Croisement[]>({
    queryKey: ['croisements'],
    queryFn: async () => (await croisementAPI.list()).data,
  })
  const { data: pollen = [], isLoading: loadingP } = useQuery<Pollen[]>({
    queryKey: ['pollen'],
    queryFn: async () => (await croisementAPI.listPollen()).data,
  })
  const { data: varietes = [] } = useQuery<Variete[]>({
    queryKey: ['varietes'],
    queryFn: async () => (await varieteAPI.getAll()).data,
  })
  const { data: projetsOf = [], isLoading: loadingOf } = useQuery<ProjetOpenField[]>({
    queryKey: ['open-field'],
    queryFn: async () => (await openFieldAPI.list()).data,
  })

  const filtered = useMemo(() => {
    if (statutFilter === 'all') return croisements
    return croisements.filter(c => c.statut === statutFilter)
  }, [croisements, statutFilter])

  const pollenSorted = useMemo(() => {
    if (!pollenSort) return pollen
    const { col, dir } = pollenSort
    return [...pollen].sort((a, b) => {
      const va = a[col] ?? ''
      const vb = b[col] ?? ''
      const cmp = String(va).localeCompare(String(vb), 'fr', { numeric: true })
      return dir === 'asc' ? cmp : -cmp
    })
  }, [pollen, pollenSort])

  const toggleSort = (col: keyof Pollen) => {
    setPollenSort(prev =>
      prev?.col === col
        ? { col, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
        : { col, dir: 'asc' }
    )
  }


  const deleteCroisementMut = useMutation({
    mutationFn: (id: number) => croisementAPI.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['croisements'] }),
  })
  const deletePollenMut = useMutation({
    mutationFn: (id: number) => croisementAPI.deletePollen(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pollen'] }),
  })

  const updateStatutMut = useMutation({
    mutationFn: ({ id, statut }: { id: number; statut: StatutCroisement }) =>
      croisementAPI.update(id, { statut }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['croisements'] }),
  })

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <Dna className="text-grow-600" /> Croisements
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500 mt-1">
            Gère tes croisements maison, la collecte de pollen et les graines produites.
          </p>
        </div>
        <button
          onClick={() => {
            if (tab === 'croisements') setShowNewCroisement(true)
            else if (tab === 'pollen') setShowNewPollen(true)
            else setShowNewProjet(true)
          }}
          className="flex items-center gap-2 px-4 py-2 bg-grow-600 text-white rounded-lg text-sm font-medium hover:bg-grow-700"
        >
          <Plus size={16} />
          {tab === 'croisements' ? 'Nouveau croisement' : tab === 'pollen' ? 'Collecter du pollen' : 'Nouveau projet'}
        </button>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700 mb-6">
        <div className="flex gap-6">
          <button
            onClick={() => setTab('croisements')}
            className={`pb-3 px-1 text-sm font-medium border-b-2 transition ${tab === 'croisements' ? 'border-grow-600 text-grow-700' : 'border-transparent text-gray-500 dark:text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:text-gray-200'}`}
          >
            <Dna size={14} className="inline mr-1" /> Croisements ({croisements.length})
          </button>
          <button
            onClick={() => setTab('pollen')}
            className={`pb-3 px-1 text-sm font-medium border-b-2 transition ${tab === 'pollen' ? 'border-grow-600 text-grow-700' : 'border-transparent text-gray-500 dark:text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:text-gray-200'}`}
          >
            <FlaskConical size={14} className="inline mr-1" /> Stock pollen ({pollen.length})
          </button>
          <button
            onClick={() => setTab('openfield')}
            className={`pb-3 px-1 text-sm font-medium border-b-2 transition ${tab === 'openfield' ? 'border-grow-600 text-grow-700' : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:text-gray-200'}`}
          >
            <Leaf size={14} className="inline mr-1" /> Open Field ({projetsOf.length})
          </button>
        </div>
      </div>

      {/* ── Onglet Croisements ─────────────────────────────── */}
      {tab === 'croisements' && (
        <>
          {/* Filtre statut */}
          <div className="flex gap-1 mb-4 text-xs">
            {(['all', 'planifie', 'pollinise', 'maturation', 'recolte', 'echec'] as const).map(s => (
              <button
                key={s}
                onClick={() => setStatutFilter(s)}
                className={`px-3 py-1.5 rounded-full ${statutFilter === s ? 'bg-grow-600 text-white' : 'bg-gray-100 text-gray-600 dark:text-gray-300'}`}
              >
                {s === 'all' ? `Tous (${croisements.length})` : STATUT_META[s].label}
                {s !== 'all' && ` (${croisements.filter(c => c.statut === s).length})`}
              </button>
            ))}
          </div>

          {loadingC ? <LoadingSpinner /> : filtered.length === 0 ? (
            <EmptyState
              icon={Dna}
              title="Aucun croisement"
              description="Clique sur 'Nouveau croisement' pour démarrer ton premier breeding."
            />
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {filtered.map(c => {
                const meta = STATUT_META[c.statut] ?? STATUT_META['planifie']
                const StatutIcon = meta.icon
                return (
                  <div key={c.id_croisement} className="border rounded-lg p-4 bg-white dark:bg-gray-800 hover:shadow-sm transition">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <h3 className="font-semibold text-gray-900 dark:text-gray-100">{c.nom_croisement}</h3>
                        <div className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500 mt-0.5">
                          {c.type_croisement && <span className="inline-block px-1.5 py-0.5 bg-gray-100 rounded text-[10px] font-semibold mr-2">{c.type_croisement}</span>}
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${meta.color}`}>
                            <StatutIcon size={10} /> {meta.label}
                          </span>
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <button
                          onClick={() => setEditCroisement(c)}
                          className="p-1 text-gray-400 dark:text-gray-500 hover:text-grow-600"
                          title="Modifier"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          onClick={() => {
                            if (confirm(`Supprimer "${c.nom_croisement}" ?`)) deleteCroisementMut.mutate(c.id_croisement)
                          }}
                          className="p-1 text-gray-400 dark:text-gray-500 hover:text-red-600"
                          title="Supprimer"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>

                    <div className="text-sm text-gray-600 dark:text-gray-300 space-y-1 mt-2">
                      <div>♀ <span className="font-medium">{c.nom_variete_mere || '—'}</span>{c.pheno_mere && <span className="text-gray-400 dark:text-gray-500"> · {c.pheno_mere}</span>}</div>
                      <div>♂ <span className="font-medium">{c.nom_variete_pere || c.nom_pollen || '—'}</span>{c.pheno_pere && <span className="text-gray-400 dark:text-gray-500"> · {c.pheno_pere}</span>}{c.pere_reverse && <span className="ml-1 px-1 py-0.5 bg-pink-50 text-pink-600 rounded text-[9px] font-semibold">FEM</span>}</div>
                    </div>

                    <div className="mt-3 pt-3 border-t text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500 flex justify-between items-center">
                      <div>
                        <Calendar size={11} className="inline mr-1" />
                        Pollinisé : {fmtDate(c.date_pollinisation)}
                        {c.nb_graines != null && (
                          <span className="ml-3">
                            <Sparkles size={11} className="inline mr-1" />
                            {c.nb_graines} graines
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Actions de cycle */}
                    <div className="mt-3 flex flex-wrap gap-1">
                      {c.statut === 'planifie' && (
                        <button
                          onClick={() => updateStatutMut.mutate({ id: c.id_croisement, statut: 'pollinise' })}
                          className="px-2 py-1 text-xs bg-blue-50 text-blue-700 rounded hover:bg-blue-100"
                        >
                          → Marquer pollinisé
                        </button>
                      )}
                      {c.statut === 'pollinise' && (
                        <button
                          onClick={() => updateStatutMut.mutate({ id: c.id_croisement, statut: 'maturation' })}
                          className="px-2 py-1 text-xs bg-amber-50 text-amber-700 rounded hover:bg-amber-100"
                        >
                          → Passer en maturation
                        </button>
                      )}
                      {(c.statut === 'pollinise' || c.statut === 'maturation') && (
                        <button
                          onClick={() => setRecolteCroisement(c)}
                          className="px-2 py-1 text-xs bg-green-50 text-green-700 rounded hover:bg-green-100 font-medium"
                        >
                          🌱 Récolter les graines
                        </button>
                      )}
                      {c.statut !== 'echec' && c.statut !== 'recolte' && (
                        <button
                          onClick={() => updateStatutMut.mutate({ id: c.id_croisement, statut: 'echec' })}
                          className="px-2 py-1 text-xs bg-red-50 text-red-600 rounded hover:bg-red-100"
                        >
                          Échec
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}

      {/* ── Onglet Stock pollen ────────────────────────────── */}
      {tab === 'pollen' && (
        <>
          {loadingP ? <LoadingSpinner /> : pollen.length === 0 ? (
            <EmptyState
              icon={FlaskConical}
              title="Aucun pollen en stock"
              description="Enregistre la collecte d'un nouveau lot pour commencer."
            />
          ) : (
            <div className="bg-white dark:bg-gray-800 border rounded-lg overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-gray-700/50 text-xs text-gray-600 dark:text-gray-300 uppercase select-none">
                  <tr>
                    {([
                      { col: 'nom_pollen' as keyof Pollen, label: 'Nom', align: 'text-left' },
                      { col: 'nom_variete_source' as keyof Pollen, label: 'Variété', align: 'text-left' },
                      { col: 'date_collecte' as keyof Pollen, label: 'Collecte', align: 'text-left' },
                      { col: 'stockage' as keyof Pollen, label: 'Stockage', align: 'text-left' },
                      { col: 'quantite_restante_g' as keyof Pollen, label: 'Qté restante', align: 'text-right' },
                      { col: 'date_peremption' as keyof Pollen, label: 'Péremption', align: 'text-left' },
                    ]).map(({ col, label, align }) => (
                      <th
                        key={col}
                        className={`px-3 py-2 ${align} cursor-pointer hover:text-grow-600 transition-colors`}
                        onClick={() => toggleSort(col)}
                      >
                        {label}<SortIcon activeCol={pollenSort?.col ?? null} col={col} dir={pollenSort?.dir ?? 'asc'} />
                      </th>
                    ))}
                    <th className="px-3 py-2 text-center">Statut</th>
                    <th className="px-3 py-2"></th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {pollenSorted.map(p => {
                    const d = daysUntil(p.date_peremption)
                    const alerte = d != null && d < 30 && !p.perime
                    return (
                      <tr key={p.id_pollen} className={!p.actif ? 'opacity-50' : ''}>
                        <td className="px-3 py-2">
                          <div className="font-medium text-gray-900 dark:text-gray-100">{p.nom_pollen}</div>
                          {p.reverse && <span className="text-[10px] px-1 py-0.5 bg-pink-100 text-pink-700 rounded font-semibold">FEM (reverse)</span>}
                        </td>
                        <td className="px-3 py-2 text-gray-600 dark:text-gray-300">
                          {p.nom_variete_source || '—'}
                          {p.pheno_source && <div className="text-xs text-gray-400 dark:text-gray-500">{p.pheno_source}</div>}
                        </td>
                        <td className="px-3 py-2 text-gray-600 dark:text-gray-300">{fmtDate(p.date_collecte)}</td>
                        <td className="px-3 py-2 text-gray-600 dark:text-gray-300">{p.stockage || '—'}</td>
                        <td className="px-3 py-2 text-right text-gray-600 dark:text-gray-300">
                          {p.quantite_restante_g != null ? `${p.quantite_restante_g}g` : '—'}
                          {p.quantite_initiale_g != null && p.quantite_restante_g != null && p.quantite_initiale_g > 0 && (
                            <div className="text-[10px] text-gray-400 dark:text-gray-500">/ {p.quantite_initiale_g}g</div>
                          )}
                        </td>
                        <td className="px-3 py-2 text-gray-600 dark:text-gray-300">
                          {fmtDate(p.date_peremption)}
                          {alerte && <div className="text-[10px] text-amber-600 font-semibold">dans {d}j</div>}
                          {p.perime && <div className="text-[10px] text-red-600 font-semibold">Périmé</div>}
                        </td>
                        <td className="px-3 py-2 text-center">
                          {p.epuise ? <span className="text-[10px] px-2 py-0.5 bg-gray-100 text-gray-600 dark:text-gray-300 rounded">Épuisé</span> :
                           p.perime ? <span className="text-[10px] px-2 py-0.5 bg-red-100 text-red-700 rounded">Périmé</span> :
                           <span className="text-[10px] px-2 py-0.5 bg-green-100 text-green-700 rounded">Actif</span>}
                        </td>
                        <td className="px-3 py-2 text-right">
                          <button
                            onClick={() => {
                              if (confirm(`Supprimer "${p.nom_pollen}" ?`)) deletePollenMut.mutate(p.id_pollen)
                            }}
                            className="p-1 text-gray-400 dark:text-gray-500 hover:text-red-600"
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* ── Onglet Open Field ─────────────────────────────── */}
      {tab === 'openfield' && (
        <>
          {loadingOf ? <LoadingSpinner /> : projetsOf.length === 0 ? (
            <EmptyState
              icon={Leaf}
              title="Aucun projet open field"
              description="Lance un projet de sélection en plein air pour tracer tes mères, pollinisations et récoltes de graines."
            />
          ) : (
            <div className="space-y-4">
              {projetsOf.map(projet => (
                <OpenFieldProjetCard
                  key={projet.id_projet}
                  projet={projet}
                  onEditProjet={() => setEditProjet(projet)}
                  onDeleteProjet={() => {
                    if (confirm(`Supprimer le projet "${projet.nom}" ?`)) {
                      openFieldAPI.delete(projet.id_projet).then(() => qc.invalidateQueries({ queryKey: ['open-field'] }))
                    }
                  }}
                  onAddMere={() => setShowAddMere(projet)}
                  onEditMere={(mere) => setEditMere({ projet, mere })}
                  onDeleteMere={(mere) => {
                    if (confirm(`Supprimer la mère ?`)) {
                      openFieldAPI.deleteMere(projet.id_projet, mere.id_mere).then(() => qc.invalidateQueries({ queryKey: ['open-field'] }))
                    }
                  }}
                  onRecolte={(mere) => setRecolteMere({ projet, mere })}
                  onAddPere={() => setShowAddPere(projet)}
                  onEditPere={(pere) => setEditPere({ projet, pere })}
                  onDeletePere={(pere) => {
                    if (confirm(`Supprimer ce mâle ?`)) {
                      openFieldAPI.deletePere(projet.id_projet, pere.id_pere).then(() => qc.invalidateQueries({ queryKey: ['open-field'] }))
                    }
                  }}
                />
              ))}
            </div>
          )}
        </>
      )}

      {/* Modals */}
      {showNewCroisement && <NouveauCroisementModal varietes={varietes} pollenStock={pollen} onClose={() => setShowNewCroisement(false)} />}
      {showNewPollen && <NouveauPollenModal varietes={varietes} onClose={() => setShowNewPollen(false)} />}
      {recolteCroisement && <RecolteModal croisement={recolteCroisement} onClose={() => setRecolteCroisement(null)} />}
      {editCroisement && <EditCroisementModal croisement={editCroisement} varietes={varietes} pollenStock={pollen} onClose={() => setEditCroisement(null)} />}
      {showNewProjet && <NouveauProjetOpenFieldModal onClose={() => setShowNewProjet(false)} />}
      {editProjet && <NouveauProjetOpenFieldModal projet={editProjet} onClose={() => setEditProjet(null)} />}
      {showAddMere && <AddMereModal projet={showAddMere} varietes={varietes} pollenStock={pollen} onClose={() => setShowAddMere(null)} />}
      {editMere && <AddMereModal projet={editMere.projet} mere={editMere.mere} varietes={varietes} pollenStock={pollen} onClose={() => setEditMere(null)} />}
      {recolteMere && <RecolteOpenFieldModal projet={recolteMere.projet} mere={recolteMere.mere} onClose={() => setRecolteMere(null)} />}
      {showAddPere && <AddPereModal projet={showAddPere} varietes={varietes} onClose={() => setShowAddPere(null)} />}
      {editPere && <AddPereModal projet={editPere.projet} pere={editPere.pere} varietes={varietes} onClose={() => setEditPere(null)} />}
    </div>
  )
}
