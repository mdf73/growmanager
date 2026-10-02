import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Trophy, Download, X, FlaskConical, Pencil, Trash2, ChevronUp, ChevronDown, ChevronsUpDown, Star, Sprout } from 'lucide-react'
import {
  notationVarieteAPI, NotationCreate, NotationUpdate, ClassementRow, RendementBucket,
} from '../api/notationVariete'
import { varieteAPI, Variete } from '../api/varietes'
import { breederAPI, Breeder } from '../api/breeders'
import { planCultureAPI, CatalogueItem } from '../api/planCulture'
import TerpeneMultiSelect, { TerpeneBadges, parseTerpenes } from '../components/TerpeneMultiSelect'

// ── Constantes ────────────────────────────────────────────────────────────────

type NoteKey = 'note_gout' | 'note_odeur' | 'note_texture' | 'note_extraction'

const NOTES: { key: NoteKey; label: string; icon: string }[] = [
  { key: 'note_gout',       label: 'Goût',                  icon: '👅' },
  { key: 'note_odeur',      label: 'Odeur',                 icon: '👃' },
  { key: 'note_texture',    label: 'Texture',               icon: '✋' },
  { key: 'note_extraction', label: "Facilité d'extraction", icon: '🍯' },
]

const fmt = (v: number | null | undefined, d = 1) =>
  v == null ? '' : v.toLocaleString('fr-FR', { minimumFractionDigits: d, maximumFractionDigits: d })

// ── Tri ───────────────────────────────────────────────────────────────────────

type SortCol = 'note' | 'rendement' | 'rosin' | 'hash' | 'germination' | 'nom'
type SortDir = 'asc' | 'desc'

function sortValue(r: ClassementRow, col: SortCol): number | string | null {
  switch (col) {
    case 'note':        return r.note_moyenne
    case 'rendement':   return r.rendement_moyen_g
    case 'rosin':       return r.rosin?.rendement_pct ?? null
    case 'hash':        return r.hash?.rendement_pct ?? null
    case 'germination': return r.germination?.taux_pct ?? null
    case 'nom':         return r.nom_variete.toLowerCase()
  }
}

function SortIcon({ col, current, dir }: { col: SortCol; current: SortCol; dir: SortDir }) {
  if (current !== col) return <ChevronsUpDown size={11} className="ml-0.5 text-gray-400 inline" />
  return dir === 'asc'
    ? <ChevronUp size={11} className="ml-0.5 text-grow-400 inline" />
    : <ChevronDown size={11} className="ml-0.5 text-grow-400 inline" />
}

// ── Étoiles ───────────────────────────────────────────────────────────────────

function Stars({ value, size = 14 }: { value: number | null | undefined; size?: number }) {
  const v = value ?? 0
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={value == null ? 'Non noté' : `${fmt(value)} sur 5`}>
      {[1, 2, 3, 4, 5].map(i => {
        const fill = Math.max(0, Math.min(1, v - (i - 1)))
        return (
          <span key={i} className="relative inline-block" style={{ width: size, height: size }}>
            <Star size={size} className="absolute inset-0 text-gray-300 dark:text-gray-600" />
            <span className="absolute inset-0 overflow-hidden" style={{ width: `${fill * 100}%` }}>
              <Star size={size} className="text-yellow-400 fill-yellow-400" />
            </span>
          </span>
        )
      })}
    </span>
  )
}

function StarInput({ value, onChange }: { value: number | null | undefined; onChange: (v: number | null) => void }) {
  const [hover, setHover] = useState<number | null>(null)
  const shown = hover ?? value ?? 0
  return (
    <div className="flex items-center gap-1" onMouseLeave={() => setHover(null)}>
      {[1, 2, 3, 4, 5].map(i => (
        <button
          key={i}
          type="button"
          onMouseEnter={() => setHover(i)}
          onClick={() => onChange(value === i ? null : i)}
          className="p-0.5"
          title={value === i ? 'Cliquer à nouveau pour effacer' : `${i} / 5`}
        >
          <Star size={26} className={i <= shown ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300 dark:text-gray-600'} />
        </button>
      ))}
      <span className="ml-2 text-sm text-gray-500 dark:text-gray-400 w-12">
        {value == null ? 'Non noté' : `${value} / 5`}
      </span>
    </div>
  )
}

// ── Puces de stats ────────────────────────────────────────────────────────────

function BucketChip({ b }: { b: RendementBucket }) {
  const cls = b.type === 'hydro'
    ? 'bg-sky-100 dark:bg-sky-900/30 text-sky-800 dark:text-sky-300'
    : b.type === 'inconnu'
    ? 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
    : 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300'
  return (
    <span
      className={`inline-flex items-baseline gap-1 text-xs px-2 py-0.5 rounded-full whitespace-nowrap ${cls}`}
      title={`${b.nb_pieds} pied${b.nb_pieds > 1 ? 's' : ''} · min ${fmt(b.min_g, 0)} g · max ${fmt(b.max_g, 0)} g · total ${fmt(b.total_g, 0)} g`}
    >
      <span className="font-medium">{b.label}</span>
      <span className="font-bold">{fmt(b.moyenne_g, 0)} g</span>
      <span className="opacity-70">×{b.nb_pieds}</span>
    </span>
  )
}

const Dash = () => <span className="text-gray-300 dark:text-gray-600">–</span>

function Pct({ v, cls }: { v: number | null | undefined; cls: string }) {
  if (v == null) return <Dash />
  return <span className={`text-sm font-semibold ${cls}`}>{fmt(v)} %</span>
}

// ── Modal formulaire (ajout / édition) ───────────────────────────────────────

type FormState = Partial<NotationCreate>

const today = () => new Date().toISOString().split('T')[0]

interface NotationFormModalProps {
  initial: FormState
  isEdit: boolean
  onClose: () => void
  onSave: (data: FormState) => Promise<void>
  saving: boolean
  varieteNames: string[]
  breeders: Breeder[]
  catalogue: CatalogueItem[]
}

function NotationFormModal({ initial, isEdit, onClose, onSave, saving, varieteNames, breeders, catalogue }: NotationFormModalProps) {
  const [form, setForm] = useState<FormState>(initial)
  const [formError, setFormError] = useState<string | null>(null)
  const set = (key: keyof FormState, v: unknown) => setForm(f => ({ ...f, [key]: v }))

  const varieteToBreeder = useMemo(() => {
    const m = new Map<string, string>()
    catalogue.forEach(c => { if (c.nom_variete && c.nom_breeder) m.set(c.nom_variete, c.nom_breeder) })
    return m
  }, [catalogue])

  const sortedBreeders = [...breeders].sort((a, b) => a.nom_breeder.localeCompare(b.nom_breeder))
  const hasUnknownBreeder = !!form.breeder && !sortedBreeders.some(b => b.nom_breeder === form.breeder)
  const hasUnknownVariete = !!form.nom_variete && !varieteNames.includes(form.nom_variete)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError(null)
    if (!form.nom_variete || form.nom_variete.trim() === '') {
      setFormError('Veuillez choisir une variété.')
      return
    }
    try {
      await onSave(form)
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : "Erreur lors de l'enregistrement.")
    }
  }

  const input = 'w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-grow-500 bg-white dark:bg-gray-800'

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center p-4 overflow-y-auto">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-xl my-4">
        <div className="flex items-center justify-between p-6 border-b">
          <div className="flex items-center gap-3">
            <Trophy size={22} className="text-yellow-500" />
            <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">
              {isEdit ? 'Modifier la notation' : 'Noter une variété'}
            </h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                Variété <span className="text-red-500">*</span>
              </label>
              <select
                value={form.nom_variete ?? ''}
                disabled={isEdit}
                onChange={e => {
                  setFormError(null)
                  set('nom_variete', e.target.value)
                  const b = varieteToBreeder.get(e.target.value)
                  if (b && !form.breeder) set('breeder', b)
                }}
                className={`${input} disabled:opacity-70 ${formError && !form.nom_variete ? 'border-red-400 ring-1 ring-red-400' : ''}`}
              >
                <option value="">— Choisir une variété —</option>
                {varieteNames.map(n => <option key={n} value={n}>{n}</option>)}
                {hasUnknownVariete && <option value={form.nom_variete}>{form.nom_variete}</option>}
              </select>
              {!isEdit && (
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                  Si la variété est déjà notée, sa notation est mise à jour.
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Breeder</label>
              <select
                value={form.breeder ?? ''}
                onChange={e => set('breeder', e.target.value)}
                className={input}
              >
                <option value="">— Choisir un breeder —</option>
                {sortedBreeders.map(b => <option key={b.id_breeder} value={b.nom_breeder}>{b.nom_breeder}</option>)}
                {hasUnknownBreeder && <option value={form.breeder ?? ''}>{form.breeder}</option>}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Date de notation</label>
              <input type="date" value={form.date_notation ?? ''} onChange={e => set('date_notation', e.target.value)} className={input} />
            </div>
          </div>

          {/* Notes étoiles */}
          <div className="bg-yellow-50 dark:bg-yellow-900/10 rounded-xl p-5 space-y-4">
            <h3 className="font-semibold text-yellow-800 dark:text-yellow-300 flex items-center gap-2">
              <Star size={18} className="text-yellow-500 fill-yellow-500" /> Notes
            </h3>
            {NOTES.map(n => (
              <div key={n.key} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-200">{n.icon} {n.label}</span>
                <StarInput value={form[n.key] as number | null | undefined} onChange={v => set(n.key, v)} />
              </div>
            ))}
          </div>

          {/* Données labo */}
          <details className="border rounded-xl">
            <summary className="flex items-center gap-2 cursor-pointer px-4 py-3 text-sm font-medium text-gray-700 dark:text-gray-200 select-none">
              <FlaskConical size={16} className="text-blue-500" />
              Données labo (optionnel, informatif)
            </summary>
            <div className="p-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">THC %</label>
                  <input type="number" step="0.1" min="0" max="100" value={form.taux_thc ?? ''}
                    onChange={e => set('taux_thc', e.target.value ? parseFloat(e.target.value) : null)} className={input} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">CBD %</label>
                  <input type="number" step="0.1" min="0" max="100" value={form.taux_cbd ?? ''}
                    onChange={e => set('taux_cbd', e.target.value ? parseFloat(e.target.value) : null)} className={input} />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-2">Terpènes</label>
                <TerpeneMultiSelect value={form.terpene_dominant ?? ''} onChange={v => set('terpene_dominant', v)} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">Commentaire labo</label>
                <input type="text" value={form.commentaire_labo ?? ''} onChange={e => set('commentaire_labo', e.target.value)} className={input} />
              </div>
            </div>
          </details>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Notes générales</label>
            <textarea value={form.notes_generales ?? ''} onChange={e => set('notes_generales', e.target.value)} rows={3}
              className={`${input} resize-none`} placeholder="Observations libres…" />
          </div>

          {formError && (
            <div className="flex items-center gap-2 bg-red-50 dark:bg-red-900/20 border border-red-200 text-red-700 dark:text-red-300 rounded-lg px-4 py-3 text-sm">
              <span className="text-red-500">⚠</span>{formError}
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="px-4 py-2 border rounded-lg text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/40">
              Annuler
            </button>
            <button type="submit" disabled={saving}
              className="px-5 py-2 bg-grow-600 text-white rounded-lg text-sm font-medium hover:bg-grow-700 disabled:opacity-50">
              {saving ? 'Enregistrement…' : 'Enregistrer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Modal détail d'une variété ────────────────────────────────────────────────

function DetailModal({ row, rank, onClose, onRate, onDeleteNotation }: {
  row: ClassementRow
  rank: number
  onClose: () => void
  onRate: () => void
  onDeleteNotation: () => void
}) {
  const n = row.notation
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center p-4 overflow-y-auto">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-lg my-4">
        <div className="rounded-t-2xl p-6 bg-grow-600 text-white">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-white/70 text-xs font-medium">#{rank} du classement</p>
              <h2 className="text-2xl font-black truncate">{row.nom_variete}</h2>
              {row.breeder && <p className="text-white/80 text-sm mt-0.5">{row.breeder}</p>}
            </div>
            <div className="text-right shrink-0">
              {row.note_moyenne != null ? (
                <>
                  <div className="text-4xl font-black">{fmt(row.note_moyenne)}</div>
                  <div className="text-white/80 text-sm">/ 5</div>
                </>
              ) : (
                <div className="text-sm text-white/80 mt-2">Pas encore notée</div>
              )}
            </div>
          </div>
        </div>

        <div className="p-6 space-y-5">
          {/* Rendement culture */}
          <section>
            <h4 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">🌿 Rendement culture (poids sec par pied)</h4>
            {row.rendement_culture.length === 0 ? (
              <p className="text-sm text-gray-400 dark:text-gray-500">Aucune récolte enregistrée.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-gray-500 dark:text-gray-400 border-b">
                    <th className="text-left py-1.5 font-medium">Contenant</th>
                    <th className="text-right py-1.5 font-medium">Pieds</th>
                    <th className="text-right py-1.5 font-medium">Moyenne</th>
                    <th className="text-right py-1.5 font-medium">Min / max</th>
                  </tr>
                </thead>
                <tbody>
                  {row.rendement_culture.map(b => (
                    <tr key={`${b.type}-${b.volume_l}`} className="border-b last:border-0">
                      <td className="py-1.5 font-medium text-gray-800 dark:text-gray-100">{b.label}</td>
                      <td className="py-1.5 text-right tabular-nums">{b.nb_pieds}</td>
                      <td className="py-1.5 text-right tabular-nums font-bold text-green-700 dark:text-green-300">{fmt(b.moyenne_g)} g</td>
                      <td className="py-1.5 text-right tabular-nums text-gray-500 dark:text-gray-400">{fmt(b.min_g, 0)} / {fmt(b.max_g, 0)} g</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          {/* Extractions + germination */}
          <section className="grid grid-cols-3 gap-3">
            {[
              { t: '🍯 Rosin', s: row.rosin, cls: 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300' },
              { t: '🍫 Hash', s: row.hash, cls: 'bg-stone-100 dark:bg-stone-800/40 text-stone-700 dark:text-stone-300' },
            ].map(({ t, s, cls }) => (
              <div key={t} className={`rounded-xl p-3 text-center ${cls}`}>
                <div className="text-xs font-medium mb-0.5">{t}</div>
                {s ? (
                  <>
                    <div className="text-xl font-black">{fmt(s.rendement_pct)} %</div>
                    <div className="text-[11px] opacity-80">{fmt(s.total_extrait_g)} g / {fmt(s.total_utilise_g, 0)} g</div>
                    <div className="text-[11px] opacity-70">{s.nb} extraction{s.nb > 1 ? 's' : ''}</div>
                  </>
                ) : <div className="text-sm opacity-60 mt-1">Aucune</div>}
              </div>
            ))}
            <div className="rounded-xl p-3 text-center bg-lime-50 dark:bg-lime-900/20 text-lime-800 dark:text-lime-300">
              <div className="text-xs font-medium mb-0.5">🌱 Germination</div>
              {row.germination ? (
                <>
                  <div className="text-xl font-black">{fmt(row.germination.taux_pct, 0)} %</div>
                  <div className="text-[11px] opacity-80">{row.germination.germees} / {row.germination.semees} graines</div>
                  {row.germination.mortes > 0 && <div className="text-[11px] opacity-70">{row.germination.mortes} morte{row.germination.mortes > 1 ? 's' : ''}</div>}
                </>
              ) : <div className="text-sm opacity-60 mt-1">Pas de semis</div>}
            </div>
          </section>

          {/* Notes */}
          <section>
            <h4 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">⭐ Notes</h4>
            {n ? (
              <div className="space-y-1.5">
                {NOTES.map(x => (
                  <div key={x.key} className="flex items-center justify-between">
                    <span className="text-sm text-gray-700 dark:text-gray-200">{x.icon} {x.label}</span>
                    {n[x.key] != null ? <Stars value={n[x.key]} size={16} /> : <span className="text-xs text-gray-400">Non noté</span>}
                  </div>
                ))}
                {n.date_notation && (
                  <p className="text-xs text-gray-400 dark:text-gray-500 pt-1">Notée le {new Date(n.date_notation).toLocaleDateString('fr-FR')}</p>
                )}
              </div>
            ) : (
              <p className="text-sm text-gray-400 dark:text-gray-500">Cette variété n'a pas encore de notes.</p>
            )}
          </section>

          {n && (n.taux_thc || n.taux_cbd || n.terpene_dominant || n.commentaire_labo) && (
            <section className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4 space-y-2">
              <h4 className="text-sm font-semibold text-blue-700 dark:text-blue-300 flex items-center gap-1.5">
                <FlaskConical size={14} /> Données labo
              </h4>
              {(n.taux_thc || n.taux_cbd) && (
                <p className="text-sm text-gray-700 dark:text-gray-200">
                  {n.taux_thc ? <>THC {n.taux_thc} %</> : null}{n.taux_thc && n.taux_cbd ? ' · ' : ''}{n.taux_cbd ? <>CBD {n.taux_cbd} %</> : null}
                </p>
              )}
              {n.terpene_dominant && parseTerpenes(n.terpene_dominant).length > 0 && <TerpeneBadges csv={n.terpene_dominant} />}
              {n.commentaire_labo && <p className="text-sm text-gray-600 dark:text-gray-300 italic">{n.commentaire_labo}</p>}
            </section>
          )}

          {n?.notes_generales && (
            <section className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4">
              <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Notes générales</h4>
              <p className="text-sm text-gray-700 dark:text-gray-200 whitespace-pre-line">{n.notes_generales}</p>
            </section>
          )}

          <div className="flex items-center justify-between pt-2 border-t">
            <button onClick={onClose}
              className="px-4 py-2 border rounded-lg text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/40">
              Fermer
            </button>
            <div className="flex gap-2">
              <button onClick={onRate}
                className="flex items-center gap-1.5 px-3 py-2 border border-grow-600 text-grow-600 rounded-lg text-sm hover:bg-grow-50 dark:hover:bg-grow-900/20">
                {n ? <><Pencil size={14} /> Modifier les notes</> : <><Star size={14} /> Noter</>}
              </button>
              {n && (
                <button onClick={onDeleteNotation}
                  className="flex items-center gap-1.5 px-3 py-2 border border-red-500 text-red-500 rounded-lg text-sm hover:bg-red-50 dark:hover:bg-red-900/20"
                  title="Supprime les notes (les stats calculées restent)">
                  <Trash2 size={14} />
                </button>
              )}
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
  return <span className="text-sm font-bold text-gray-500 dark:text-gray-400 w-7 text-center">{rank}</span>
}

// ── Page principale ───────────────────────────────────────────────────────────

const GRID = 'sm:grid-cols-[44px_minmax(140px,1.2fr)_minmax(180px,1.6fr)_84px_84px_96px_120px]'

export default function ClassementVarietes() {
  const qc = useQueryClient()
  const [formInitial, setFormInitial] = useState<{ data: FormState; editId: number | null } | null>(null)
  const [detailKey, setDetailKey] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [sortCol, setSortCol] = useState<SortCol>('note')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  const handleSort = (col: SortCol) => {
    if (sortCol === col) setSortDir(d => (d === 'asc' ? 'desc' : 'asc'))
    else { setSortCol(col); setSortDir(col === 'nom' ? 'asc' : 'desc') }
  }

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ['notations-classement'],
    queryFn: notationVarieteAPI.getClassement,
  })
  const { data: varietes = [] } = useQuery<Variete[]>({
    queryKey: ['varietes'],
    queryFn: () => varieteAPI.getAll().then(r => r.data),
  })
  const { data: breeders = [] } = useQuery<Breeder[]>({
    queryKey: ['breeders'],
    queryFn: () => breederAPI.getAll().then(r => r.data),
  })
  const { data: catalogue = [] } = useQuery<CatalogueItem[]>({
    queryKey: ['plan-culture-catalogue-all'],
    queryFn: () => planCultureAPI.getCatalogue({ stock_seulement: false }).then(r => r.data),
  })

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['notations-classement'] })
    qc.invalidateQueries({ queryKey: ['notations'] })
  }

  const createMutation = useMutation({
    mutationFn: notationVarieteAPI.create,
    onSuccess: () => { invalidate(); setFormInitial(null) },
  })
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: NotationUpdate }) => notationVarieteAPI.update(id, data),
    onSuccess: () => { invalidate(); setFormInitial(null) },
  })
  const deleteMutation = useMutation({
    mutationFn: notationVarieteAPI.delete,
    onSuccess: invalidate,
  })

  const varieteNames = useMemo(() => {
    const s = new Set<string>(varietes.map(v => v.nom_variete))
    rows.forEach(r => s.add(r.nom_variete))
    return [...s].sort((a, b) => a.localeCompare(b, 'fr'))
  }, [varietes, rows])

  const sorted = useMemo(() => {
    const q = search.toLowerCase()
    const base = rows.filter(r =>
      r.nom_variete.toLowerCase().includes(q) || (r.breeder ?? '').toLowerCase().includes(q))
    return [...base].sort((a, b) => {
      const av = sortValue(a, sortCol), bv = sortValue(b, sortCol)
      if (av == null && bv == null) return a.nom_variete.localeCompare(b.nom_variete, 'fr')
      if (av == null) return 1          // valeurs absentes toujours en bas
      if (bv == null) return -1
      if (av < bv) return sortDir === 'asc' ? -1 : 1
      if (av > bv) return sortDir === 'asc' ? 1 : -1
      return (b.rendement_moyen_g ?? 0) - (a.rendement_moyen_g ?? 0)
    })
  }, [rows, search, sortCol, sortDir])

  const rankOf = useMemo(() => new Map(sorted.map((r, i) => [r.key, i + 1])), [sorted])
  const detailRow = detailKey ? rows.find(r => r.key === detailKey) ?? null : null

  const openRate = (row?: ClassementRow) => {
    const n = row?.notation
    if (n) {
      setFormInitial({ editId: n.id_notation, data: { ...n } })
    } else {
      setFormInitial({
        editId: null,
        data: { nom_variete: row?.nom_variete ?? '', breeder: row?.breeder ?? '', date_notation: today() },
      })
    }
    setDetailKey(null)
  }

  const handleSave = async (data: FormState) => {
    const payload: NotationUpdate = {
      nom_variete: data.nom_variete, breeder: data.breeder || null, date_notation: data.date_notation || null,
      note_gout: data.note_gout ?? null, note_odeur: data.note_odeur ?? null,
      note_texture: data.note_texture ?? null, note_extraction: data.note_extraction ?? null,
      taux_thc: data.taux_thc ?? null, taux_cbd: data.taux_cbd ?? null,
      terpene_dominant: data.terpene_dominant || null, commentaire_labo: data.commentaire_labo || null,
      notes_generales: data.notes_generales || null,
    }
    if (formInitial?.editId) await updateMutation.mutateAsync({ id: formInitial.editId, data: payload })
    else await createMutation.mutateAsync(payload as NotationCreate)
  }

  const handleDeleteNotation = (row: ClassementRow) => {
    if (!row.notation) return
    if (window.confirm(`Supprimer les notes de ${row.nom_variete} ? Les rendements et la germination restent calculés.`)) {
      deleteMutation.mutate(row.notation.id_notation)
      setDetailKey(null)
    }
  }

  const nbNotees = rows.filter(r => r.notation).length
  const th = 'cursor-pointer select-none hover:text-gray-700 dark:hover:text-gray-200 flex items-center justify-center'

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <Trophy size={24} className="text-yellow-500" />
            Classement des variétés
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {rows.length} variété{rows.length !== 1 ? 's' : ''} · {nbNotees} notée{nbNotees !== 1 ? 's' : ''} · rendements, extractions et germination calculés automatiquement
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={notationVarieteAPI.exportCsv}
            className="flex items-center gap-1.5 px-3 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 rounded-lg text-sm hover:bg-gray-50 dark:hover:bg-gray-700/40">
            <Download size={15} /> Export CSV
          </button>
          <button onClick={() => openRate()}
            className="flex items-center gap-1.5 px-4 py-2 bg-grow-600 text-white rounded-lg text-sm font-medium hover:bg-grow-700">
            <Plus size={16} /> Noter une variété
          </button>
        </div>
      </div>

      {rows.length > 0 && (
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <input type="text" placeholder="Rechercher par variété ou breeder…" value={search} onChange={e => setSearch(e.target.value)}
            className="w-full sm:w-80 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-grow-500" />
          {/* Tri mobile */}
          <select value={sortCol} onChange={e => { setSortCol(e.target.value as SortCol); setSortDir(e.target.value === 'nom' ? 'asc' : 'desc') }}
            className="sm:hidden border rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800">
            <option value="note">Trier : notes</option>
            <option value="rendement">Trier : rendement / pied</option>
            <option value="rosin">Trier : rosin %</option>
            <option value="hash">Trier : hash %</option>
            <option value="germination">Trier : germination</option>
            <option value="nom">Trier : nom</option>
          </select>
        </div>
      )}

      {isLoading ? (
        <div className="text-center py-20 text-gray-400 dark:text-gray-500">Chargement…</div>
      ) : sorted.length === 0 ? (
        <div className="text-center py-20">
          <Sprout size={40} className="mx-auto text-gray-300 mb-3" />
          <p className="text-gray-500 dark:text-gray-400 font-medium">Aucune variété à classer</p>
          <p className="text-gray-400 dark:text-gray-500 text-sm mt-1">Les variétés apparaissent dès qu'une plante est semée, récoltée ou extraite.</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border overflow-hidden">
          <div className={`hidden sm:grid ${GRID} gap-3 px-5 py-3 bg-gray-50 dark:bg-gray-700/50 border-b text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide`}>
            <div className="text-center">#</div>
            <div onClick={() => handleSort('nom')} className={`${th} !justify-start`}>Variété <SortIcon col="nom" current={sortCol} dir={sortDir} /></div>
            <div onClick={() => handleSort('rendement')} className={`${th} !justify-start`} title="Moyenne par pied selon le pot (tri : moyenne tous contenants)">
              🌿 Rendement / pied <SortIcon col="rendement" current={sortCol} dir={sortDir} />
            </div>
            <div onClick={() => handleSort('rosin')} className={th}>🍯 Rosin <SortIcon col="rosin" current={sortCol} dir={sortDir} /></div>
            <div onClick={() => handleSort('hash')} className={th}>🍫 Hash <SortIcon col="hash" current={sortCol} dir={sortDir} /></div>
            <div onClick={() => handleSort('germination')} className={th} title="Graines germées / graines semées">🌱 Germin. <SortIcon col="germination" current={sortCol} dir={sortDir} /></div>
            <div onClick={() => handleSort('note')} className={th}>⭐ Notes <SortIcon col="note" current={sortCol} dir={sortDir} /></div>
          </div>

          <div className="divide-y">
            {sorted.map(r => {
              const rank = rankOf.get(r.key) ?? 0
              const g = r.germination
              return (
                <button key={r.key} onClick={() => setDetailKey(r.key)}
                  className={`w-full text-left transition-colors hover:bg-gray-50 dark:hover:bg-gray-700/40 ${rank === 1 ? 'bg-yellow-50 dark:bg-yellow-900/20' : ''}`}>
                  {/* Mobile */}
                  <div className="sm:hidden flex items-start gap-3 px-4 py-3">
                    <div className="pt-0.5"><RankBadge rank={rank} /></div>
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-semibold text-gray-800 dark:text-gray-100 truncate">{r.nom_variete}</p>
                        {r.note_moyenne != null && (
                          <span className="flex items-center gap-1 shrink-0 text-sm font-bold text-yellow-600 dark:text-yellow-400">
                            <Star size={14} className="fill-yellow-400 text-yellow-400" />{fmt(r.note_moyenne)}
                          </span>
                        )}
                      </div>
                      {r.rendement_culture.length > 0 && (
                        <div className="flex flex-wrap gap-1">{r.rendement_culture.map(b => <BucketChip key={`${b.type}-${b.volume_l}`} b={b} />)}</div>
                      )}
                      <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-gray-500 dark:text-gray-400">
                        {r.rosin && <span>🍯 {fmt(r.rosin.rendement_pct)} %</span>}
                        {r.hash && <span>🍫 {fmt(r.hash.rendement_pct)} %</span>}
                        {g && <span>🌱 {g.germees}/{g.semees}</span>}
                      </div>
                    </div>
                  </div>

                  {/* Desktop */}
                  <div className={`hidden sm:grid ${GRID} gap-3 items-center px-5 py-3`}>
                    <div className="flex justify-center"><RankBadge rank={rank} /></div>
                    <div className="min-w-0">
                      <p className="font-semibold text-gray-800 dark:text-gray-100 truncate">{r.nom_variete}</p>
                      {r.breeder && <p className="text-xs text-gray-400 dark:text-gray-500 truncate">{r.breeder}</p>}
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {r.rendement_culture.length ? r.rendement_culture.map(b => <BucketChip key={`${b.type}-${b.volume_l}`} b={b} />) : <Dash />}
                    </div>
                    <div className="text-center"><Pct v={r.rosin?.rendement_pct} cls="text-amber-700 dark:text-amber-300" /></div>
                    <div className="text-center"><Pct v={r.hash?.rendement_pct} cls="text-stone-700 dark:text-stone-300" /></div>
                    <div className="text-center">
                      {g ? (
                        <span className="text-sm" title={`${g.germees} germée(s) sur ${g.semees} semée(s)`}>
                          <span className={`font-semibold ${g.taux_pct >= 80 ? 'text-green-600 dark:text-green-400' : g.taux_pct >= 50 ? 'text-yellow-600 dark:text-yellow-400' : 'text-red-500'}`}>
                            {fmt(g.taux_pct, 0)} %
                          </span>
                          <span className="block text-[11px] text-gray-400">{g.germees}/{g.semees}</span>
                        </span>
                      ) : <Dash />}
                    </div>
                    <div className="flex flex-col items-center">
                      {r.note_moyenne != null ? (
                        <>
                          <Stars value={r.note_moyenne} />
                          <span className="text-xs font-semibold text-gray-600 dark:text-gray-300 mt-0.5">{fmt(r.note_moyenne)} / 5</span>
                        </>
                      ) : (
                        <span onClick={e => { e.stopPropagation(); openRate(r) }}
                          className="text-xs text-grow-600 hover:underline">+ Noter</span>
                      )}
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {sorted.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
          <span className="font-medium">Rendement / pied :</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-green-200 dark:bg-green-800 inline-block" /> en pot (taille)</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-sky-200 dark:bg-sky-800 inline-block" /> hydro</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-gray-200 dark:bg-gray-600 inline-block" /> pot non renseigné</span>
          <span>· ×N = nombre de pieds · Rosin et hash : total extrait / total utilisé</span>
        </div>
      )}

      {formInitial && (
        <NotationFormModal
          initial={formInitial.data}
          isEdit={!!formInitial.editId}
          onClose={() => setFormInitial(null)}
          onSave={handleSave}
          saving={createMutation.isPending || updateMutation.isPending}
          varieteNames={varieteNames}
          breeders={breeders}
          catalogue={catalogue}
        />
      )}

      {detailRow && !formInitial && (
        <DetailModal
          row={detailRow}
          rank={rankOf.get(detailRow.key) ?? 0}
          onClose={() => setDetailKey(null)}
          onRate={() => openRate(detailRow)}
          onDeleteNotation={() => handleDeleteNotation(detailRow)}
        />
      )}
    </div>
  )
}
