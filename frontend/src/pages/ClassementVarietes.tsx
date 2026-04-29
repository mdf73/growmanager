import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Trophy, Download, X, Leaf, Wind, FlaskConical, Pencil, Trash2 } from 'lucide-react'
import { notationVarieteAPI, NotationRead, NotationCreate, NotationUpdate, ExtractionStatsMap } from '../api/notationVariete'
import { varieteAPI, Variete } from '../api/varietes'
import { breederAPI, Breeder } from '../api/breeders'
import { planCultureAPI, CatalogueItem } from '../api/planCulture'
import TerpeneMultiSelect, { TerpeneBadges, parseTerpenes } from '../components/TerpeneMultiSelect'

// ── Helpers ──────────────────────────────────────────────────────────────────

function clamp(v: number | null | undefined, max: number): number {
  if (v == null) return 0
  return Math.min(Math.max(0, v), max)
}

function scoreColor(pct: number): string {
  if (pct >= 80) return 'text-emerald-600 font-bold'
  if (pct >= 65) return 'text-green-600 font-semibold'
  if (pct >= 50) return 'text-yellow-600 font-semibold'
  if (pct >= 35) return 'text-orange-500'
  return 'text-red-500'
}

function barColor(pct: number): string {
  if (pct >= 80) return 'bg-emerald-500'
  if (pct >= 65) return 'bg-green-400'
  if (pct >= 50) return 'bg-yellow-400'
  if (pct >= 35) return 'bg-orange-400'
  return 'bg-red-400'
}

function ScoreBar({ value, max }: { value: number | null | undefined; max: number }) {
  const pct = max > 0 ? (clamp(value, max) / max) * 100 : 0
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 bg-gray-200 rounded-full h-2 overflow-hidden">
        <div
          className={`h-2 rounded-full transition-all ${barColor(pct)}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className={`text-sm w-16 text-right ${scoreColor(pct)}`}>
        {clamp(value, max).toFixed(1)} / {max}
      </span>
    </div>
  )
}

// ── Composant slider de note ──────────────────────────────────────────────────

function NoteSlider({
  label,
  max,
  value,
  onChange,
  hint,
}: {
  label: string
  max: number
  value: number | undefined
  onChange: (v: number) => void
  hint?: string
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-gray-700">{label}</label>
        <span className="text-sm font-bold text-grow-600">
          {(value ?? 0).toFixed(1)} / {max}
        </span>
      </div>
      {hint && <p className="text-xs text-gray-400">{hint}</p>}
      <input
        type="range"
        min={0}
        max={max}
        step={0.5}
        value={value ?? 0}
        onChange={e => onChange(parseFloat(e.target.value))}
        className="w-full accent-grow-600"
      />
      <div className="flex justify-between text-xs text-gray-400">
        <span>0</span>
        <span>{max / 2}</span>
        <span>{max}</span>
      </div>
    </div>
  )
}

// ── Modal formulaire (ajout / édition) ───────────────────────────────────────

const EMPTY_FORM: Partial<NotationCreate> = {
  nom_variete: '',
  breeder: '',
  date_notation: new Date().toISOString().split('T')[0],
  vigueur_sante: 0,
  productivite_structure: 0,
  soif: 0,
  apparence_structure: 0,
  profil_aromatique: 0,
  saveur_qualite: 0,
  effet_puissance: 0,
  taux_thc: undefined,
  taux_cbd: undefined,
  terpene_dominant: '',
  commentaire_labo: '',
  notes_generales: '',
}

type FormState = typeof EMPTY_FORM

interface NotationFormModalProps {
  initial?: NotationRead | null
  onClose: () => void
  onSave: (data: FormState) => Promise<void>
  saving: boolean
  varietes: Variete[]
  breeders: Breeder[]
  catalogue: CatalogueItem[]
}

function NotationFormModal({ initial, onClose, onSave, saving, varietes, breeders, catalogue }: NotationFormModalProps) {
  const [form, setForm] = useState<FormState>(
    initial
      ? {
          nom_variete: initial.nom_variete,
          breeder: initial.breeder ?? '',
          date_notation: initial.date_notation ?? new Date().toISOString().split('T')[0],
          vigueur_sante: initial.vigueur_sante ?? 0,
          productivite_structure: initial.productivite_structure ?? 0,
          soif: initial.soif ?? 0,
          apparence_structure: initial.apparence_structure ?? 0,
          profil_aromatique: initial.profil_aromatique ?? 0,
          saveur_qualite: initial.saveur_qualite ?? 0,
          effet_puissance: initial.effet_puissance ?? 0,
          taux_thc: initial.taux_thc ?? undefined,
          taux_cbd: initial.taux_cbd ?? undefined,
          terpene_dominant: initial.terpene_dominant ?? '',
          commentaire_labo: initial.commentaire_labo ?? '',
          notes_generales: initial.notes_generales ?? '',
        }
      : { ...EMPTY_FORM }
  )

  const set = (key: keyof FormState, v: unknown) =>
    setForm(f => ({ ...f, [key]: v }))

  // Map nom_variete → nom_breeder depuis le catalogue (graines connues)
  const varieteToBreeders = new Map<string, string>()
  catalogue.forEach(c => {
    if (c.nom_variete && c.nom_breeder) {
      varieteToBreeders.set(c.nom_variete, c.nom_breeder)
    }
  })

  // Sélection variété → auto-fill breeder
  const handleVarieteChange = (nom: string) => {
    set('nom_variete', nom)
    const autoBreeder = varieteToBreeders.get(nom)
    if (autoBreeder) set('breeder', autoBreeder)
  }

  // Variétés connues triées + valeur courante si absente de la liste (données existantes)
  const sortedVarietes = [...varietes].sort((a, b) => a.nom_variete.localeCompare(b.nom_variete))
  const knownVarieteNames = new Set(sortedVarietes.map(v => v.nom_variete))
  const hasUnknownVariete = !!form.nom_variete && !knownVarieteNames.has(form.nom_variete as string)

  const sortedBreeders = [...breeders].sort((a, b) => a.nom_breeder.localeCompare(b.nom_breeder))
  const knownBreederNames = new Set(sortedBreeders.map(b => b.nom_breeder))
  const hasUnknownBreeder = !!form.breeder && !knownBreederNames.has(form.breeder as string)

  const totalCulture =
    (form.vigueur_sante ?? 0) +
    (form.productivite_structure ?? 0) +
    (form.soif ?? 0)

  const totalConso =
    (form.apparence_structure ?? 0) +
    (form.profil_aromatique ?? 0) +
    (form.saveur_qualite ?? 0) +
    (form.effet_puissance ?? 0)

  const notaFinale = totalCulture + totalConso

  const [formError, setFormError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError(null)
    // Validation manuelle (évite les tooltips natifs perdus dans un modal scrollable)
    if (!form.nom_variete || (form.nom_variete as string).trim() === '') {
      setFormError('Veuillez choisir une variété.')
      return
    }
    try {
      await onSave(form)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erreur lors de l\'enregistrement.'
      setFormError(msg)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl my-4">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div className="flex items-center gap-3">
            <Trophy size={22} className="text-yellow-500" />
            <h2 className="text-xl font-bold text-gray-800">
              {initial ? 'Modifier la notation' : 'Nouvelle notation'}
            </h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Infos de base */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

            {/* Variété */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Variété <span className="text-red-500">*</span>
              </label>
              <select
                value={hasUnknownVariete ? '__custom__' : (form.nom_variete ?? '')}
                onChange={e => {
                  setFormError(null)
                  if (e.target.value === '__custom__') {
                    set('nom_variete', form.nom_variete ?? '')
                  } else {
                    handleVarieteChange(e.target.value)
                  }
                }}
                className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-grow-500 bg-white ${
                  formError && !form.nom_variete ? 'border-red-400 ring-1 ring-red-400' : ''
                }`}
              >
                <option value="">— Choisir une variété —</option>
                {sortedVarietes.map(v => (
                  <option key={v.id_variete} value={v.nom_variete}>
                    {v.nom_variete}
                  </option>
                ))}
                {hasUnknownVariete && (
                  <option value="__custom__">{form.nom_variete as string} (valeur existante)</option>
                )}
              </select>
            </div>

            {/* Breeder */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Breeder</label>
              <select
                value={hasUnknownBreeder ? '__custom__' : (form.breeder ?? '')}
                onChange={e => {
                  if (e.target.value === '__custom__') {
                    set('breeder', form.breeder ?? '')
                  } else {
                    set('breeder', e.target.value)
                  }
                }}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-grow-500 bg-white"
              >
                <option value="">— Choisir un breeder —</option>
                {sortedBreeders.map(b => (
                  <option key={b.id_breeder} value={b.nom_breeder}>
                    {b.nom_breeder}
                  </option>
                ))}
                {hasUnknownBreeder && (
                  <option value="__custom__">{form.breeder as string} (valeur existante)</option>
                )}
              </select>
            </div>

            {/* Date */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date de notation</label>
              <input
                type="date"
                value={form.date_notation ?? ''}
                onChange={e => set('date_notation', e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-grow-500"
              />
            </div>
          </div>

          {/* ── Partie A : Culture ── */}
          <div className="bg-green-50 rounded-xl p-5 space-y-5">
            <div className="flex items-center gap-2">
              <Leaf size={18} className="text-green-600" />
              <h3 className="font-semibold text-green-800">Partie A — Culture</h3>
              <span className="ml-auto text-sm font-bold text-green-700">
                {totalCulture.toFixed(1)} / 30
              </span>
            </div>
            <NoteSlider
              label="🌿 Vigueur & Santé"
              max={10}
              value={form.vigueur_sante}
              onChange={v => set('vigueur_sante', v)}
              hint="Résistance aux maladies/nuisibles et stabilité génétique"
            />
            <NoteSlider
              label="📊 Productivité & Structure"
              max={10}
              value={form.productivite_structure}
              onChange={v => set('productivite_structure', v)}
              hint="Rendement final et facilité de manucure (ratio feuilles/fleurs)"
            />
            <NoteSlider
              label="💧 Soif"
              max={10}
              value={form.soif}
              onChange={v => set('soif', v)}
              hint="Besoin en eau : peu gourmande en arrosage = meilleure tournure (10 = très sobre)"
            />
          </div>

          {/* ── Partie B : Consommation ── */}
          <div className="bg-purple-50 rounded-xl p-5 space-y-5">
            <div className="flex items-center gap-2">
              <Wind size={18} className="text-purple-600" />
              <h3 className="font-semibold text-purple-800">Partie B — Consommation</h3>
              <span className="ml-auto text-sm font-bold text-purple-700">
                {totalConso.toFixed(1)} / 70
              </span>
            </div>
            <NoteSlider
              label="✨ Apparence & Structure"
              max={15}
              value={form.apparence_structure}
              onChange={v => set('apparence_structure', v)}
              hint="Densité, trichomes préservés, éclat des pistils et couleurs"
            />
            <NoteSlider
              label="👃 Profil Aromatique & Terpènes"
              max={15}
              value={form.profil_aromatique}
              onChange={v => set('profil_aromatique', v)}
              hint="Intensité à l'ouverture du bocal et complexité des notes (gaz, terre, fruits)"
            />
            <NoteSlider
              label="💨 Saveur & Qualité de Fumée"
              max={20}
              value={form.saveur_qualite}
              onChange={v => set('saveur_qualite', v)}
              hint="Fidélité goût/odeur, douceur (absence d'irritation) et persistance en bouche"
            />
            <NoteSlider
              label="🌀 Effet & Puissance"
              max={20}
              value={form.effet_puissance}
              onChange={v => set('effet_puissance', v)}
              hint="Force brute, clarté de la montée, adéquation Sativa/Indica, durée et effet entourage"
            />
          </div>

          {/* ── Score synthèse ── */}
          <div className="bg-gray-50 rounded-xl p-4 flex items-center justify-between">
            <span className="text-sm text-gray-600">Note finale estimée</span>
            <span
              className={`text-2xl font-black ${
                notaFinale >= 80
                  ? 'text-emerald-600'
                  : notaFinale >= 65
                  ? 'text-green-600'
                  : notaFinale >= 50
                  ? 'text-yellow-600'
                  : notaFinale >= 35
                  ? 'text-orange-500'
                  : 'text-red-500'
              }`}
            >
              {notaFinale.toFixed(1)} / 100
            </span>
          </div>

          {/* ── Données labo (optionnel) ── */}
          <details className="border rounded-xl">
            <summary className="flex items-center gap-2 cursor-pointer px-4 py-3 text-sm font-medium text-gray-700 select-none">
              <FlaskConical size={16} className="text-blue-500" />
              Données Labo (optionnel — informatif, n'impacte pas la note)
            </summary>
            <div className="p-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">THC %</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="100"
                    value={form.taux_thc ?? ''}
                    onChange={e => set('taux_thc', e.target.value ? parseFloat(e.target.value) : undefined)}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-grow-500"
                    placeholder="Ex: 22.5"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">CBD %</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="100"
                    value={form.taux_cbd ?? ''}
                    onChange={e => set('taux_cbd', e.target.value ? parseFloat(e.target.value) : undefined)}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-grow-500"
                    placeholder="Ex: 1.0"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-2">
                  Terpènes <span className="text-gray-400 font-normal">(sélectionner un ou plusieurs)</span>
                </label>
                <TerpeneMultiSelect
                  value={form.terpene_dominant ?? ''}
                  onChange={v => set('terpene_dominant', v)}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Commentaire labo</label>
                <input
                  type="text"
                  value={form.commentaire_labo ?? ''}
                  onChange={e => set('commentaire_labo', e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-grow-500"
                  placeholder="Ex: Pesticides-free, testée propre…"
                />
              </div>
            </div>
          </details>

          {/* Notes générales */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes générales</label>
            <textarea
              value={form.notes_generales ?? ''}
              onChange={e => set('notes_generales', e.target.value)}
              rows={3}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-grow-500 resize-none"
              placeholder="Observations libres, comparaison avec d'autres variétés…"
            />
          </div>

          {/* Boutons */}
          {formError && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
              <span className="text-red-500">⚠</span>
              {formError}
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border rounded-lg text-sm text-gray-700 hover:bg-gray-50"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 bg-grow-600 text-white rounded-lg text-sm font-medium hover:bg-grow-700 disabled:opacity-50"
            >
              {saving ? 'Enregistrement…' : initial ? 'Mettre à jour' : 'Enregistrer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Modal détail ──────────────────────────────────────────────────────────────

function DetailModal({
  notation,
  onClose,
  onEdit,
  onDelete,
  extractionStat,
}: {
  notation: NotationRead
  onClose: () => void
  onEdit: () => void
  onDelete: () => void
  extractionStat?: { avg_rosin_pct: number | null; nb_rosin: number; avg_hash_pct: number | null; nb_hash: number }
}) {
  const tc = notation.total_culture ?? 0
  const tco = notation.total_consommation ?? 0
  const nf = notation.note_finale ?? 0
  const pct = nf

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg my-4">
        {/* Header */}
        <div
          className={`rounded-t-2xl p-6 text-white ${
            pct >= 80
              ? 'bg-emerald-600'
              : pct >= 65
              ? 'bg-green-600'
              : pct >= 50
              ? 'bg-yellow-500'
              : pct >= 35
              ? 'bg-orange-500'
              : 'bg-red-500'
          }`}
        >
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-2xl font-black">{notation.nom_variete}</h2>
              {notation.breeder && (
                <p className="text-white/80 text-sm mt-0.5">{notation.breeder}</p>
              )}
              {notation.date_notation && (
                <p className="text-white/70 text-xs mt-1">
                  Noté le {new Date(notation.date_notation).toLocaleDateString('fr-FR')}
                </p>
              )}
            </div>
            <div className="text-right">
              <div className="text-4xl font-black">{nf.toFixed(1)}</div>
              <div className="text-white/80 text-sm">/ 100</div>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-5">
          {/* Récap scores */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-green-50 rounded-xl p-3 text-center">
              <div className="text-xs text-green-600 font-medium mb-0.5">🌿 Culture</div>
              <div className="text-xl font-black text-green-700">{tc.toFixed(1)}</div>
              <div className="text-xs text-green-500">/ 30</div>
            </div>
            <div className="bg-purple-50 rounded-xl p-3 text-center">
              <div className="text-xs text-purple-600 font-medium mb-0.5">💨 Consommation</div>
              <div className="text-xl font-black text-purple-700">{tco.toFixed(1)}</div>
              <div className="text-xs text-purple-500">/ 70</div>
            </div>
          </div>

          {/* Stats extraction */}
          {extractionStat && (extractionStat.avg_rosin_pct != null || extractionStat.avg_hash_pct != null) && (
            <div className="grid grid-cols-2 gap-3">
              {extractionStat.avg_rosin_pct != null && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-center">
                  <div className="text-xs text-amber-600 font-medium mb-0.5">🍯 Rosin moy.</div>
                  <div className="text-xl font-black text-amber-700">
                    {extractionStat.avg_rosin_pct.toFixed(1)}
                    <span className="text-sm font-normal text-amber-500">%</span>
                  </div>
                  <div className="text-xs text-amber-400">{extractionStat.nb_rosin} extraction{extractionStat.nb_rosin > 1 ? 's' : ''}</div>
                </div>
              )}
              {extractionStat.avg_hash_pct != null && (
                <div className="bg-stone-50 border border-stone-200 rounded-xl p-3 text-center">
                  <div className="text-xs text-stone-600 font-medium mb-0.5">🍫 Hash moy.</div>
                  <div className="text-xl font-black text-stone-700">
                    {extractionStat.avg_hash_pct.toFixed(1)}
                    <span className="text-sm font-normal text-stone-500">%</span>
                  </div>
                  <div className="text-xs text-stone-400">{extractionStat.nb_hash} extraction{extractionStat.nb_hash > 1 ? 's' : ''}</div>
                </div>
              )}
            </div>
          )}

          {/* Partie A — Culture */}
          <div>
            <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
              🌿 Partie A — Culture (/30)
            </h4>
            <div className="space-y-2">
              <div>
                <p className="text-xs text-gray-500 mb-1">Vigueur & Santé</p>
                <ScoreBar value={notation.vigueur_sante} max={10} />
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">Productivité & Structure</p>
                <ScoreBar value={notation.productivite_structure} max={10} />
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">💧 Soif (sobriété en arrosage)</p>
                <ScoreBar value={notation.soif} max={10} />
              </div>
            </div>
          </div>

          {/* Partie B — Consommation */}
          <div>
            <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
              💨 Partie B — Consommation (/70)
            </h4>
            <div className="space-y-2">
              <div>
                <p className="text-xs text-gray-500 mb-1">Apparence & Structure (/15)</p>
                <ScoreBar value={notation.apparence_structure} max={15} />
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">Profil Aromatique & Terpènes (/15)</p>
                <ScoreBar value={notation.profil_aromatique} max={15} />
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">Saveur & Qualité de Fumée (/20)</p>
                <ScoreBar value={notation.saveur_qualite} max={20} />
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">Effet & Puissance (/20)</p>
                <ScoreBar value={notation.effet_puissance} max={20} />
              </div>
            </div>
          </div>

          {/* Données labo */}
          {(notation.taux_thc || notation.taux_cbd || notation.terpene_dominant || notation.commentaire_labo) && (
            <div className="bg-blue-50 rounded-xl p-4 space-y-2">
              <h4 className="text-sm font-semibold text-blue-700 mb-2 flex items-center gap-1.5">
                <FlaskConical size={14} /> Données Labo
              </h4>
              {(notation.taux_thc || notation.taux_cbd) && (
                <div className="flex items-center gap-4">
                  {notation.taux_thc && (
                    <span className="text-sm text-gray-700">
                      <span className="font-medium">THC :</span> {notation.taux_thc}%
                    </span>
                  )}
                  {notation.taux_cbd && (
                    <span className="text-sm text-gray-700">
                      <span className="font-medium">CBD :</span> {notation.taux_cbd}%
                    </span>
                  )}
                </div>
              )}
              {notation.terpene_dominant && parseTerpenes(notation.terpene_dominant).length > 0 && (
                <div>
                  <p className="text-xs font-medium text-gray-500 mb-1.5">
                    Terpène{parseTerpenes(notation.terpene_dominant).length > 1 ? 's' : ''} :
                  </p>
                  <TerpeneBadges csv={notation.terpene_dominant} />
                </div>
              )}
              {notation.commentaire_labo && (
                <p className="text-sm text-gray-600 italic">{notation.commentaire_labo}</p>
              )}
            </div>
          )}

          {/* Notes */}
          {notation.notes_generales && (
            <div className="bg-gray-50 rounded-xl p-4">
              <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Notes</h4>
              <p className="text-sm text-gray-700 whitespace-pre-line">{notation.notes_generales}</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-between pt-2 border-t">
            <button
              onClick={onClose}
              className="px-4 py-2 border rounded-lg text-sm text-gray-700 hover:bg-gray-50"
            >
              Fermer
            </button>
            <div className="flex gap-2">
              <button
                onClick={onEdit}
                className="flex items-center gap-1.5 px-3 py-2 border border-grow-600 text-grow-600 rounded-lg text-sm hover:bg-grow-50"
              >
                <Pencil size={14} /> Modifier
              </button>
              <button
                onClick={onDelete}
                className="flex items-center gap-1.5 px-3 py-2 border border-red-500 text-red-500 rounded-lg text-sm hover:bg-red-50"
              >
                <Trash2 size={14} /> Supprimer
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Médaille de rang ──────────────────────────────────────────────────────────

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) return <span className="text-xl">🥇</span>
  if (rank === 2) return <span className="text-xl">🥈</span>
  if (rank === 3) return <span className="text-xl">🥉</span>
  return <span className="text-sm font-bold text-gray-500 w-7 text-center">{rank}</span>
}

// ── Page principale ───────────────────────────────────────────────────────────

export default function ClassementVarietes() {
  const qc = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [editTarget, setEditTarget] = useState<NotationRead | null>(null)
  const [detailTarget, setDetailTarget] = useState<NotationRead | null>(null)
  const [search, setSearch] = useState('')

  const { data: notations = [], isLoading } = useQuery({
    queryKey: ['notations'],
    queryFn: notationVarieteAPI.list,
  })

  const { data: varietes = [] } = useQuery({
    queryKey: ['varietes'],
    queryFn: () => varieteAPI.getAll().then(r => r.data),
  })

  const { data: breeders = [] } = useQuery({
    queryKey: ['breeders'],
    queryFn: () => breederAPI.getAll().then(r => r.data),
  })

  const { data: catalogue = [] } = useQuery({
    queryKey: ['plan-culture-catalogue-all'],
    queryFn: () => planCultureAPI.getCatalogue({ stock_seulement: false }).then(r => r.data),
  })

  const { data: extractionStats = {} as ExtractionStatsMap } = useQuery({
    queryKey: ['notations-extraction-stats'],
    queryFn: notationVarieteAPI.getExtractionStats,
  })

  const createMutation = useMutation({
    mutationFn: notationVarieteAPI.create,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notations'] })
      setShowForm(false)
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: NotationUpdate }) =>
      notationVarieteAPI.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notations'] })
      setEditTarget(null)
      setDetailTarget(null)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: notationVarieteAPI.delete,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notations'] })
      setDetailTarget(null)
    },
  })

  const handleSave = async (data: Partial<NotationCreate>) => {
    if (editTarget) {
      await updateMutation.mutateAsync({ id: editTarget.id_notation, data })
    } else {
      await createMutation.mutateAsync(data as NotationCreate)
    }
  }

  const handleDelete = (id: number) => {
    if (window.confirm('Supprimer cette notation ? Cette action est irréversible.')) {
      deleteMutation.mutate(id)
    }
  }

  const filtered = notations.filter(
    n =>
      n.nom_variete.toLowerCase().includes(search.toLowerCase()) ||
      (n.breeder ?? '').toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Trophy size={24} className="text-yellow-500" />
            Classement des variétés
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {notations.length} variété{notations.length !== 1 ? 's' : ''} notée{notations.length !== 1 ? 's' : ''} · Score sur 100 pts (Culture /30 + Consommation /70)
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={notationVarieteAPI.exportCsv}
            className="flex items-center gap-1.5 px-3 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50"
          >
            <Download size={15} /> Export CSV
          </button>
          <button
            onClick={() => { setEditTarget(null); setShowForm(true) }}
            className="flex items-center gap-1.5 px-4 py-2 bg-grow-600 text-white rounded-lg text-sm font-medium hover:bg-grow-700"
          >
            <Plus size={16} /> Ajouter une notation
          </button>
        </div>
      </div>

      {/* Recherche */}
      {notations.length > 0 && (
        <input
          type="text"
          placeholder="Rechercher par variété ou breeder…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full sm:w-80 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-grow-500"
        />
      )}

      {/* Tableau de classement */}
      {isLoading ? (
        <div className="text-center py-20 text-gray-400">Chargement…</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20">
          <Trophy size={40} className="mx-auto text-gray-300 mb-3" />
          <p className="text-gray-500 font-medium">Aucune notation encore enregistrée</p>
          <p className="text-gray-400 text-sm mt-1">Cliquez sur "Ajouter une notation" pour commencer le classement</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border overflow-hidden">
          {/* En-tête tableau */}
          <div className="hidden sm:grid sm:grid-cols-[56px_1fr_120px_120px_120px] gap-3 px-5 py-3 bg-gray-50 border-b text-xs font-semibold text-gray-500 uppercase tracking-wide">
            <div className="text-center">#</div>
            <div>Variété</div>
            <div className="text-center">🌿 Culture</div>
            <div className="text-center">💨 Conso</div>
            <div className="text-center">Score</div>
          </div>

          <div className="divide-y">
            {filtered.map((n, i) => {
              const nf = n.note_finale ?? 0
              const pct = nf
              const isTop = i === 0
              const exStat = extractionStats[n.nom_variete]

              return (
                <button
                  key={n.id_notation}
                  onClick={() => setDetailTarget(n)}
                  className={`w-full text-left transition-colors hover:bg-gray-50 ${
                    isTop ? 'bg-yellow-50 hover:bg-yellow-100' : ''
                  }`}
                >
                  {/* Mobile layout */}
                  <div className="sm:hidden flex items-center gap-3 px-4 py-3">
                    <RankBadge rank={i + 1} />
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-800 truncate">{n.nom_variete}</p>
                      <div className="flex flex-wrap items-center gap-1 mt-0.5">
                        {n.breeder && (
                          <span className="text-xs text-gray-400">{n.breeder}</span>
                        )}
                        {exStat?.avg_rosin_pct != null && (
                          <span className="text-xs bg-amber-100 text-amber-700 px-1 py-0.5 rounded-full">
                            🍯 {exStat.avg_rosin_pct.toFixed(1)}%
                          </span>
                        )}
                        {exStat?.avg_hash_pct != null && (
                          <span className="text-xs bg-stone-100 text-stone-700 px-1 py-0.5 rounded-full">
                            🍫 {exStat.avg_hash_pct.toFixed(1)}%
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <span className={`text-lg font-black ${scoreColor(pct)}`}>
                        {nf.toFixed(1)}
                      </span>
                      <span className="text-xs text-gray-400"> /100</span>
                    </div>
                  </div>

                  {/* Desktop layout */}
                  <div className="hidden sm:grid sm:grid-cols-[56px_1fr_120px_120px_120px] gap-3 items-center px-5 py-4">
                    <div className="flex justify-center">
                      <RankBadge rank={i + 1} />
                    </div>

                    <div className="min-w-0">
                      <p className="font-semibold text-gray-800 truncate">{n.nom_variete}</p>
                      <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                        {n.breeder && (
                          <span className="text-xs text-gray-400">{n.breeder}</span>
                        )}
                        {n.taux_thc && (
                          <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full">
                            THC {n.taux_thc}%
                          </span>
                        )}
                        {exStat?.avg_rosin_pct != null && (
                          <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full font-medium">
                            🍯 {exStat.avg_rosin_pct.toFixed(1)}%
                          </span>
                        )}
                        {exStat?.avg_hash_pct != null && (
                          <span className="text-xs bg-stone-100 text-stone-700 px-1.5 py-0.5 rounded-full font-medium">
                            🍫 {exStat.avg_hash_pct.toFixed(1)}%
                          </span>
                        )}
                        {n.terpene_dominant && parseTerpenes(n.terpene_dominant).length > 0 && (
                          <TerpeneBadges csv={n.terpene_dominant} />
                        )}
                      </div>
                    </div>

                    <div className="text-center">
                      <span className="text-sm font-semibold text-green-700">
                        {(n.total_culture ?? 0).toFixed(1)}
                        <span className="font-normal text-gray-400">/30</span>
                      </span>
                    </div>

                    <div className="text-center">
                      <span className="text-sm font-semibold text-purple-700">
                        {(n.total_consommation ?? 0).toFixed(1)}
                        <span className="font-normal text-gray-400">/70</span>
                      </span>
                    </div>

                    <div className="flex items-center justify-center">
                      <div
                        className={`px-3 py-1.5 rounded-xl text-sm font-black ${
                          pct >= 80
                            ? 'bg-emerald-100 text-emerald-700'
                            : pct >= 65
                            ? 'bg-green-100 text-green-700'
                            : pct >= 50
                            ? 'bg-yellow-100 text-yellow-700'
                            : pct >= 35
                            ? 'bg-orange-100 text-orange-700'
                            : 'bg-red-100 text-red-700'
                        }`}
                      >
                        {nf.toFixed(1)}
                      </div>
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Légende */}
      {filtered.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500">
          <span className="font-medium">Légende :</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-emerald-500 inline-block"/> ≥ 80 — Excellente</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-green-400 inline-block"/> ≥ 65 — Très bonne</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-yellow-400 inline-block"/> ≥ 50 — Bonne</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-orange-400 inline-block"/> ≥ 35 — Passable</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-red-400 inline-block"/> &lt; 35 — À éviter</span>
        </div>
      )}

      {/* Modal formulaire (nouveau) */}
      {showForm && !editTarget && (
        <NotationFormModal
          initial={null}
          onClose={() => setShowForm(false)}
          onSave={handleSave}
          saving={createMutation.isPending}
          varietes={varietes}
          breeders={breeders}
          catalogue={catalogue}
        />
      )}

      {/* Modal formulaire (édition) */}
      {editTarget && (
        <NotationFormModal
          initial={editTarget}
          onClose={() => setEditTarget(null)}
          onSave={handleSave}
          saving={updateMutation.isPending}
          varietes={varietes}
          breeders={breeders}
          catalogue={catalogue}
        />
      )}

      {/* Modal détail */}
      {detailTarget && !editTarget && (
        <DetailModal
          notation={detailTarget}
          onClose={() => setDetailTarget(null)}
          onEdit={() => {
            setEditTarget(detailTarget)
            setDetailTarget(null)
          }}
          onDelete={() => handleDelete(detailTarget.id_notation)}
          extractionStat={extractionStats[detailTarget.nom_variete]}
        />
      )}
    </div>
  )
}
