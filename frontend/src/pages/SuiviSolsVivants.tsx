import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Trash2, Pencil, Search, ChevronDown, ChevronRight, Calendar, Droplets, FlaskConical, Sprout, Euro, Clock } from 'lucide-react'
import { suiviSolVivantAPI, SuiviSolVivant } from '../api/suiviSolVivant'
import SuiviSolVivantModal from '../components/SuiviSolVivantModal'
import LoadingSpinner from '../components/LoadingSpinner'

function formatDate(d?: string) {
  if (!d) return null
  return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function potAge(datePreparation?: string): string | null {
  if (!datePreparation) return null
  const start = new Date(datePreparation)
  const now = new Date()
  const days = Math.floor((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
  if (days < 0) return null
  if (days < 30) return `${days}j`
  const months = Math.floor(days / 30)
  const rem = days % 30
  return rem > 0 ? `${months}m ${rem}j` : `${months}m`
}

function formatCout(v?: number): string | null {
  if (v == null) return null
  return v.toFixed(2) + ' €'
}

function Badge({ children, color }: { children: React.ReactNode; color: string }) {
  return (
    <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${color}`}>
      {children}
    </span>
  )
}

// ── Ligne de timeline ─────────────────────────────────────────────────────────
function TimelineItem({ emoji, label, date, note, color, cout }: {
  emoji: string; label: string; date?: string; note?: string; color: string; cout?: number
}) {
  return (
    <div className="flex items-start gap-3 py-1.5">
      <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-sm ${color}`}>
        {emoji}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-medium text-gray-700">{label}</span>
          {date && <span className="text-xs text-gray-400">{formatDate(date)}</span>}
          {cout != null && (
            <span className="text-xs text-emerald-600 font-mono bg-emerald-50 px-1.5 py-0.5 rounded">
              ~{cout.toFixed(2)} €
            </span>
          )}
        </div>
        {note && <p className="text-xs text-gray-400 mt-0.5 truncate">{note}</p>}
      </div>
    </div>
  )
}

// ── Card principal ────────────────────────────────────────────────────────────
function SuiviCard({
  suivi, onEdit, onDelete,
}: { suivi: SuiviSolVivant; onEdit: () => void; onDelete: () => void }) {
  const [expanded, setExpanded] = useState(false)

  const totalApps = suivi.reamendements.length + suivi.arrosages.length +
                    suivi.tcos.length + suivi.fermentations.length

  const age = potAge(suivi.date_preparation)
  const coutStr = formatCout(suivi.cout_total_estime)

  // Timeline triée par date
  const timeline = useMemo(() => {
    const items: { date?: string; emoji: string; label: string; note?: string; color: string; cout?: number }[] = [
      ...suivi.reamendements.map(e => ({
        date: e.date_application,
        emoji: '🪱',
        label: e.nom_recette_reamend ?? 'Réamendement',
        note: e.notes,
        color: 'bg-amber-50 text-amber-700',
        cout: e.cout_estime,
      })),
      ...suivi.arrosages.map(e => ({
        date: e.date_application,
        emoji: '💧',
        label: `${e.nom_recette_arrosage ?? 'Arrosage'}${e.volume_eau_l ? ` — ${e.volume_eau_l} L` : ''}`,
        note: e.notes,
        color: 'bg-sky-50 text-sky-700',
        cout: e.cout_estime,
      })),
      ...suivi.tcos.map(e => ({
        date: e.date_application,
        emoji: '🍵',
        label: `${e.nom_recette_tco ?? 'TCO'}${e.volume_applique ? ` — ${e.volume_applique} L` : ''}`,
        note: e.notes,
        color: 'bg-green-50 text-green-700',
      })),
      ...suivi.fermentations.map(e => ({
        date: e.date_application,
        emoji: '🫙',
        label: `${e.nom_recette_ferm ?? 'Fermentation'}${e.volume_applique ? ` — ${e.volume_applique} L` : ''}`,
        note: e.notes,
        color: 'bg-purple-50 text-purple-700',
      })),
    ]
    return items.sort((a, b) => {
      if (!a.date && !b.date) return 0
      if (!a.date) return 1
      if (!b.date) return -1
      return a.date.localeCompare(b.date)
    })
  }, [suivi])

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
      {/* Header card */}
      <div className="px-5 py-4 flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1.5">
            <h3 className="font-semibold text-gray-900 text-sm">🪴 {suivi.nom_pot}</h3>
            {suivi.volume_pot_l && (
              <Badge color="bg-amber-50 text-amber-700">{suivi.volume_pot_l} L</Badge>
            )}
          </div>
          <div className="flex items-center gap-3 text-xs text-gray-500 flex-wrap">
            {suivi.nom_recette_lso && (
              <span className="flex items-center gap-1">
                <FlaskConical size={10} /> {suivi.nom_recette_lso}
              </span>
            )}
            {suivi.date_preparation && (
              <span className="flex items-center gap-1">
                <Calendar size={10} /> Préparé le {formatDate(suivi.date_preparation)}
              </span>
            )}
            {age && (
              <span className="flex items-center gap-1 text-amber-600 font-medium">
                <Clock size={10} /> {age}
              </span>
            )}
            {suivi.cultures.length > 0 && (
              <span className="flex items-center gap-1">
                <Sprout size={10} /> {suivi.cultures.length} culture{suivi.cultures.length > 1 ? 's' : ''}
              </span>
            )}
            {totalApps > 0 && (
              <span className="flex items-center gap-1">
                <Droplets size={10} /> {totalApps} application{totalApps > 1 ? 's' : ''}
              </span>
            )}
            {coutStr && (
              <span className="flex items-center gap-1 text-emerald-600 font-medium">
                <Euro size={10} /> {coutStr}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button onClick={() => setExpanded(e => !e)}
            className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-50">
            {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          </button>
          <button onClick={onEdit}
            className="p-1.5 text-blue-400 hover:text-blue-600 rounded-lg hover:bg-blue-50">
            <Pencil size={15} />
          </button>
          <button onClick={onDelete}
            className="p-1.5 text-red-400 hover:text-red-600 rounded-lg hover:bg-red-50">
            <Trash2 size={15} />
          </button>
        </div>
      </div>

      {/* Détails expandables */}
      {expanded && (
        <div className="border-t border-gray-50 bg-gray-50">
          {/* Coûts estimés */}
          {(suivi.cout_lso_estime != null || suivi.cout_total_estime != null) && (
            <div className="px-5 py-3 border-b border-gray-100">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">💰 Coûts estimés</p>
              <div className="space-y-1">
                {suivi.cout_lso_estime != null && (
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-600">LSO initial ({suivi.nom_recette_lso})</span>
                    <span className="font-mono text-emerald-600">~{suivi.cout_lso_estime.toFixed(2)} €</span>
                  </div>
                )}
                {suivi.cout_total_estime != null && (
                  <div className="flex justify-between text-xs font-semibold border-t border-gray-200 pt-1 mt-1">
                    <span className="text-gray-700">Total estimé</span>
                    <span className="font-mono text-emerald-700">~{suivi.cout_total_estime.toFixed(2)} €</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Cultures */}
          {suivi.cultures.length > 0 && (
            <div className="px-5 py-3 border-b border-gray-100">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">🌱 Cultures</p>
              <div className="space-y-1">
                {suivi.cultures.map((c, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs">
                    <span className="text-gray-700 font-medium flex-1">{c.description || `Culture #${i + 1}`}</span>
                    {(c.date_debut || c.date_fin) && (
                      <span className="text-gray-400">
                        {formatDate(c.date_debut)}{c.date_fin ? ` → ${formatDate(c.date_fin)}` : ' → en cours'}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Timeline des applications */}
          {timeline.length > 0 ? (
            <div className="px-5 py-3">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Historique des applications</p>
              <div className="divide-y divide-gray-100">
                {timeline.map((item, i) => (
                  <TimelineItem key={i} {...item} cout={item.cout} />
                ))}
              </div>
            </div>
          ) : (
            <div className="px-5 py-4">
              <p className="text-xs text-gray-400">Aucune application enregistrée.</p>
            </div>
          )}

          {/* Commentaires */}
          {suivi.commentaires && (
            <div className="px-5 py-3 border-t border-gray-100">
              <p className="text-xs text-gray-400">{suivi.commentaires}</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Page principale ───────────────────────────────────────────────────────────
export default function SuiviSolsVivants() {
  const qc = useQueryClient()

  const { data: suivis = [], isLoading } = useQuery<SuiviSolVivant[]>({
    queryKey: ['suivi-sols-vivants'],
    queryFn:  async () => (await suiviSolVivantAPI.getAll()).data,
  })

  const [showModal,  setShowModal]  = useState(false)
  const [editTarget, setEditTarget] = useState<SuiviSolVivant | null>(null)
  const [search,     setSearch]     = useState('')

  const deleteMut = useMutation({
    mutationFn: (id: number) => suiviSolVivantAPI.delete(id),
    onSuccess:  () => qc.invalidateQueries({ queryKey: ['suivi-sols-vivants'] }),
  })

  const filtered = useMemo(() => {
    if (!search) return suivis
    const q = search.toLowerCase()
    return suivis.filter(s =>
      s.nom_pot.toLowerCase().includes(q) ||
      s.nom_recette_lso?.toLowerCase().includes(q) ||
      s.commentaires?.toLowerCase().includes(q)
    )
  }, [suivis, search])

  if (isLoading) return <LoadingSpinner />

  return (
    <div className="space-y-6">
      {/* Header page */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">🪴 Suivi des Sols Vivants</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {suivis.length} pot{suivis.length > 1 ? 's' : ''} en suivi
          </p>
        </div>
        <button
          onClick={() => { setEditTarget(null); setShowModal(true) }}
          className="flex items-center gap-2 px-4 py-2 bg-grow-600 text-white text-sm rounded-lg hover:bg-grow-700">
          <Plus size={16} /> Nouveau suivi
        </button>
      </div>

      {/* Résumé stats */}
      {suivis.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { emoji: '🪴', label: 'Pots suivis',    value: suivis.length },
            { emoji: '🌱', label: 'Cultures',        value: suivis.reduce((t, s) => t + s.cultures.length, 0) },
            { emoji: '🪱', label: 'Réamendements',  value: suivis.reduce((t, s) => t + s.reamendements.length, 0) },
            { emoji: '💧', label: 'Arrosages+',     value: suivis.reduce((t, s) => t + s.arrosages.length + s.tcos.length + s.fermentations.length, 0) },
          ].map(stat => (
            <div key={stat.label} className="bg-white rounded-xl border border-gray-100 shadow-sm px-4 py-3 text-center">
              <div className="text-2xl mb-1">{stat.emoji}</div>
              <div className="text-2xl font-bold text-gray-900">{stat.value}</div>
              <div className="text-xs text-gray-500">{stat.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Barre de recherche */}
      {suivis.length > 0 && (
        <div className="relative w-64">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher un pot…"
            className="pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-grow-400 w-full" />
        </div>
      )}

      {/* Liste / empty state */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          {suivis.length === 0 ? (
            <>
              <span className="text-5xl block mb-3 opacity-40">🪴</span>
              <p className="text-sm">Aucun suivi de sol vivant enregistré.</p>
              <p className="text-xs mt-1">Cliquez sur "Nouveau suivi" pour commencer.</p>
            </>
          ) : (
            <p className="text-sm">Aucun pot ne correspond à la recherche.</p>
          )}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3">
          {filtered.map(s => (
            <SuiviCard key={s.id_suivi} suivi={s}
              onEdit={() => { setEditTarget(s); setShowModal(true) }}
              onDelete={() => { if (confirm(`Supprimer le suivi "${s.nom_pot}" ?`)) deleteMut.mutate(s.id_suivi) }}
            />
          ))}
        </div>
      )}

      {showModal && (
        <SuiviSolVivantModal
          editSuivi={editTarget}
          onClose={() => { setShowModal(false); setEditTarget(null) }}
        />
      )}
    </div>
  )
}
