import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { X, Trash2, Loader2, Leaf, Scale, Zap, AlertTriangle, Pencil, Check } from 'lucide-react'
import type { HistoriqueCulture, HistoriquePlant, HistoriqueCultureUpdate } from '../api/historiqueCulture'
import { historiqueCultureAPI } from '../api/historiqueCulture'

const TENTES      = ['60x60x100', '60x120x150', '100x100x200', '120x120x200', 'Exterieur']
const LAMPES      = ['LED Crescience', 'LED Marshydro', 'MH', 'HPS']
const PUISSANCES  = [110, 135, 150, 550, 600]
const TYPES       = ['Indoor', 'Outdoor']
const ENGRAIS_OPT = ['Living Soil (LSO)', 'Aptus', 'Hesi', 'Aucun', 'Autre']
const SUBSTRATS   = ['LSO', 'Terre', 'Terre+Coco', 'Coco', 'NFT', 'Billes d\'argile', 'Pleine terre']

function fmtDate(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('fr-FR')
}

function SCard({ label, value, sub, color = 'grow' }: { label: string; value: string; sub?: string; color?: string }) {
  const colors: Record<string, string> = {
    grow:   'bg-grow-50   text-grow-700   text-grow-400',
    blue:   'bg-blue-50   text-blue-700   text-blue-400',
    amber:  'bg-amber-50  text-amber-700  text-amber-400',
    purple: 'bg-purple-50 text-purple-700 text-purple-400',
  }
  const [bg, txt, sub_] = (colors[color] ?? colors.grow).split(' ')
  return (
    <div className={`${bg} rounded-xl p-3`}>
      <p className={`text-xs ${sub_} mb-0.5`}>{label}</p>
      <p className={`text-xl font-bold ${txt}`}>{value}</p>
      {sub && <p className={`text-xs ${sub_} mt-0.5`}>{sub}</p>}
    </div>
  )
}

// ── Ligne plante avec suppression ─────────────────────────────────────────────
function PlantLine({
  plant, cultureId, onDeleted,
}: {
  plant: HistoriquePlant
  cultureId: number
  onDeleted: () => void
}) {
  const [confirm, setConfirm] = useState(false)
  const remove = useMutation({
    mutationFn: () => historiqueCultureAPI.deletePlant(cultureId, plant.id_historique_plant),
    onSuccess: onDeleted,
    onError: () => setConfirm(false),
  })

  return (
    <tr className="hover:bg-gray-50 dark:hover:bg-gray-700/40 group">
      <td className="px-4 py-2.5 text-sm text-gray-400 dark:text-gray-500 font-mono text-center">
        P{plant.numero_plant ?? '?'}
      </td>
      <td className="px-4 py-2.5 text-sm font-medium text-gray-900 dark:text-gray-100">
        {plant.variete_nom || '—'}
      </td>
      <td className="px-4 py-2.5 text-xs text-gray-400 dark:text-gray-500 whitespace-nowrap">
        {plant.date_debut_plant ? new Date(plant.date_debut_plant).toLocaleDateString('fr-FR') : '—'}
      </td>
      <td className="px-4 py-2.5 text-xs text-gray-400 dark:text-gray-500 whitespace-nowrap">
        {plant.date_fin_plant ? new Date(plant.date_fin_plant).toLocaleDateString('fr-FR') : '—'}
      </td>
      <td className="px-4 py-2.5 text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500 text-right">
        {plant.prix_graine != null ? `${Number(plant.prix_graine).toFixed(2)} €` : '—'}
      </td>
      <td className="px-4 py-2.5 text-sm font-semibold text-grow-700 text-right">
        {plant.quantite_recoltee != null ? `${Number(plant.quantite_recoltee).toFixed(1)} g` : '—'}
      </td>
      <td className="px-4 py-2.5 text-xs text-gray-400 dark:text-gray-500 max-w-[120px] truncate" title={plant.notes ?? ''}>
        {plant.notes || ''}
      </td>
      <td className="px-4 py-2.5 text-right">
        {confirm ? (
          <div className="flex items-center justify-end gap-1">
            <button
              onClick={() => remove.mutate()}
              disabled={remove.isPending}
              className="px-2 py-1 bg-red-500 text-white text-xs rounded hover:bg-red-600 disabled:opacity-50"
            >
              {remove.isPending ? <Loader2 size={10} className="animate-spin" /> : 'Suppr.'}
            </button>
            <button onClick={() => setConfirm(false)}
              className="px-2 py-1 border border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 dark:text-gray-500 text-xs rounded hover:bg-gray-50 dark:hover:bg-gray-700/40">
              ✕
            </button>
          </div>
        ) : (
          <button
            onClick={() => setConfirm(true)}
            className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <Trash2 size={13} />
          </button>
        )}
      </td>
    </tr>
  )
}

// ── Champ générique ────────────────────────────────────────────────────────────
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs text-gray-400 dark:text-gray-500">{label}</label>
      {children}
    </div>
  )
}

const inputCls = 'w-full border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-grow-400 focus:border-transparent'
const selectCls = inputCls

// ── Modal ─────────────────────────────────────────────────────────────────────
interface Props {
  culture: HistoriqueCulture
  onClose: () => void
}

export default function CultureHistoriqueDetailModal({ culture, onClose }: Props) {
  const qc = useQueryClient()
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [editing, setEditing] = useState(false)

  // État formulaire d'édition (initialisé avec les valeurs actuelles)
  const [form, setForm] = useState<HistoriqueCultureUpdate>({
    nom:          culture.nom,
    date_debut:   culture.date_debut,
    date_fin:     culture.date_fin,
    tente:        culture.tente,
    lampe:        culture.lampe,
    puissance:    culture.puissance,
    type_culture: culture.type_culture,
    engrais:      culture.engrais,
    substrat:     culture.substrat,
    notes:        culture.notes,
  })

  const invalidate = () => qc.invalidateQueries({ queryKey: ['historique-cultures'] })

  const removeCulture = useMutation({
    mutationFn: () => historiqueCultureAPI.delete(culture.id_historique_culture),
    onSuccess: () => {
      invalidate()
      onClose()
    },
  })

  const saveCulture = useMutation({
    mutationFn: () => historiqueCultureAPI.update(culture.id_historique_culture, form),
    onSuccess: () => {
      invalidate()
      setEditing(false)
    },
  })

  const nbPlants       = culture.plants.length
  const totalRecolte   = culture.quantite_totale
  const totalPrix      = culture.prix_total_graines
  const gpw            = culture.g_par_watt
  const duree          = culture.duree_jours

  // Stats par plante
  const recoltes = culture.plants.map(p => Number(p.quantite_recoltee ?? 0))
  const maxRecolte = recoltes.length ? Math.max(...recoltes) : null
  const minRecolte = recoltes.length ? Math.min(...recoltes) : null
  const bestPlant  = maxRecolte != null
    ? culture.plants.find(p => Number(p.quantite_recoltee ?? 0) === maxRecolte) ?? null
    : null

  const set = (k: keyof HistoriqueCultureUpdate) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const raw = e.target.value
    if (k === 'puissance') {
      setForm(f => ({ ...f, [k]: raw ? Number(raw) : null }))
    } else {
      setForm(f => ({ ...f, [k]: raw || null }))
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-700 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-grow-50 rounded-lg">
              <Leaf size={18} className="text-grow-600" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">
                {culture.nom ?? `Culture #${culture.id_historique_culture}`}
              </h2>
              <p className="text-xs text-gray-400 dark:text-gray-500">
                {culture.nom && <span className="mr-1 text-gray-300">#{culture.id_historique_culture} —</span>}
                {fmtDate(culture.date_debut)} → {fmtDate(culture.date_fin)}
                {duree != null && <span className="ml-1 text-gray-300">({duree} j)</span>}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {!editing && (
              <button
                onClick={() => setEditing(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700 text-sm rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/40 transition-colors"
              >
                <Pencil size={13} />
                Modifier
              </button>
            )}
            <button onClick={onClose} className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:text-gray-300">
              <X size={22} />
            </button>
          </div>
        </div>

        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-5">

          {/* ── Mode édition ───────────────────────────────────────── */}
          {editing ? (
            <section className="space-y-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 dark:text-gray-500 uppercase tracking-wide">Modifier la culture</p>

              <Field label="Nom de la culture">
                <input type="text" className={inputCls}
                  value={form.nom ?? ''}
                  onChange={set('nom')}
                  placeholder="ex: Gelato #4 run 2…" />
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Date début">
                  <input type="date" className={inputCls}
                    value={form.date_debut ?? ''}
                    onChange={set('date_debut')} />
                </Field>
                <Field label="Date fin">
                  <input type="date" className={inputCls}
                    value={form.date_fin ?? ''}
                    onChange={set('date_fin')} />
                </Field>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <Field label="Tente">
                  <select className={selectCls} value={form.tente ?? ''} onChange={set('tente')}>
                    <option value="">—</option>
                    {TENTES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </Field>
                <Field label="Lampe">
                  <select className={selectCls} value={form.lampe ?? ''} onChange={set('lampe')}>
                    <option value="">—</option>
                    {LAMPES.map(l => <option key={l} value={l}>{l}</option>)}
                  </select>
                </Field>
                <Field label="Puissance (W)">
                  <select className={selectCls}
                    value={form.puissance != null ? String(form.puissance) : ''}
                    onChange={set('puissance')}>
                    <option value="">—</option>
                    {PUISSANCES.map(p => <option key={p} value={p}>{p} W</option>)}
                  </select>
                </Field>
                <Field label="Type">
                  <select className={selectCls} value={form.type_culture ?? ''} onChange={set('type_culture')}>
                    <option value="">—</option>
                    {TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </Field>
                <Field label="Engrais">
                  <select className={selectCls} value={form.engrais ?? ''} onChange={set('engrais')}>
                    <option value="">—</option>
                    {ENGRAIS_OPT.map(e => <option key={e} value={e}>{e}</option>)}
                  </select>
                </Field>
                <Field label="Substrat">
                  <select className={selectCls} value={form.substrat ?? ''} onChange={set('substrat')}>
                    <option value="">—</option>
                    {SUBSTRATS.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </Field>
              </div>

              <Field label="Notes">
                <textarea className={inputCls} rows={2}
                  value={form.notes ?? ''}
                  onChange={set('notes')} />
              </Field>

              <div className="flex items-center gap-2 pt-1">
                <button
                  onClick={() => saveCulture.mutate()}
                  disabled={saveCulture.isPending}
                  className="flex items-center gap-1.5 px-4 py-2 bg-grow-600 text-white text-sm rounded-lg hover:bg-grow-700 disabled:opacity-50"
                >
                  {saveCulture.isPending
                    ? <Loader2 size={13} className="animate-spin" />
                    : <Check size={13} />}
                  Enregistrer
                </button>
                <button
                  onClick={() => { setEditing(false); setForm({ nom: culture.nom, date_debut: culture.date_debut, date_fin: culture.date_fin, tente: culture.tente, lampe: culture.lampe, puissance: culture.puissance, type_culture: culture.type_culture, engrais: culture.engrais, substrat: culture.substrat, notes: culture.notes }) }}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 text-sm rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/40"
                >
                  Annuler
                </button>
                {saveCulture.isError && (
                  <span className="text-xs text-red-500">Erreur lors de l'enregistrement</span>
                )}
              </div>
            </section>
          ) : (
            <>
              {/* ── Infos culture ───────────────────────────────────────── */}
              <section>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                  {[
                    ['Tente',    culture.tente],
                    ['Lampe',    culture.lampe],
                    ['Puissance', culture.puissance ? `${culture.puissance} W` : null],
                    ['Type',     culture.type_culture],
                    ['Engrais',  culture.engrais],
                    ['Substrat', culture.substrat],
                  ].filter(([, v]) => v).map(([label, value]) => (
                    <div key={label as string} className="bg-gray-50 dark:bg-gray-700/50 rounded-lg px-3 py-2">
                      <p className="text-gray-400 dark:text-gray-500">{label as string}</p>
                      <p className="font-semibold text-gray-700 dark:text-gray-200">{value as string}</p>
                    </div>
                  ))}
                </div>
                {culture.notes && (
                  <p className="mt-2 text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500 italic border-l-2 border-grow-200 pl-3">
                    {culture.notes}
                  </p>
                )}
              </section>
            </>
          )}

          {/* ── Stats ───────────────────────────────────────────────── */}
          <section>
            <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-2">Résumé</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <SCard label="Plants"         value={String(nbPlants)}                           color="grow"   />
              <SCard label="Récolte totale" value={totalRecolte != null ? `${Number(totalRecolte).toFixed(1)} g` : '—'} color="purple" />
              <SCard label="Prix graines"   value={totalPrix    != null ? `${Number(totalPrix).toFixed(2)} €`   : '—'} color="blue"   />
              <SCard label="g/W"            value={gpw          != null ? String(gpw.toFixed(3))                : '—'} color="amber"  />
            </div>
          </section>

          {/* ── Tableau plantes ─────────────────────────────────────── */}
          <section>
            <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-2">
              Détail par plante
            </p>
            {nbPlants === 0 ? (
              <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-4">Aucune plante enregistrée.</p>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-gray-100 dark:border-gray-700">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700">
                      <th className="px-4 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400 dark:text-gray-500 text-center">#</th>
                      <th className="px-4 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400 dark:text-gray-500 text-left">Variété</th>
                      <th className="px-4 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400 dark:text-gray-500 text-left">Début</th>
                      <th className="px-4 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400 dark:text-gray-500 text-left">Fin</th>
                      <th className="px-4 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400 dark:text-gray-500 text-right">Prix graine</th>
                      <th className="px-4 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400 dark:text-gray-500 text-right">Récolte</th>
                      <th className="px-4 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400 dark:text-gray-500 text-left">Notes</th>
                      <th className="px-4 py-2.5"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                    {culture.plants
                      .slice()
                      .sort((a, b) => (a.numero_plant ?? 0) - (b.numero_plant ?? 0))
                      .map(plant => (
                        <PlantLine
                          key={plant.id_historique_plant}
                          plant={plant}
                          cultureId={culture.id_historique_culture}
                          onDeleted={invalidate}
                        />
                      ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* ── Meilleure plante ─────────────────────────────────────── */}
          {bestPlant && maxRecolte != null && maxRecolte > 0 && (
            <section className="bg-amber-50 rounded-xl p-4">
              <p className="text-xs font-semibold text-amber-500 uppercase tracking-wide mb-1">
                🏆 Meilleure plante
              </p>
              <p className="text-sm font-bold text-amber-800">
                P{bestPlant.numero_plant} — {bestPlant.variete_nom ?? '?'} :
                <span className="ml-1">{maxRecolte.toFixed(1)} g</span>
              </p>
              {minRecolte != null && minRecolte !== maxRecolte && (
                <p className="text-xs text-amber-500 mt-0.5">
                  Écart avec la plus faible ({minRecolte.toFixed(1)} g) : {(maxRecolte - minRecolte).toFixed(1)} g
                </p>
              )}
            </section>
          )}
        </div>

        <div className="px-6 py-4 border-t border-gray-100 dark:border-gray-700 shrink-0 flex items-center justify-between gap-3">
          {/* Zone suppression culture */}
          {confirmDelete ? (
            <div className="flex items-center gap-2">
              <span className="text-sm text-red-600 flex items-center gap-1.5">
                <AlertTriangle size={14} />
                Supprimer cette culture et ses {culture.nb_plants} plante{culture.nb_plants > 1 ? 's' : ''} ?
              </span>
              <button
                onClick={() => removeCulture.mutate()}
                disabled={removeCulture.isPending}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                {removeCulture.isPending
                  ? <Loader2 size={13} className="animate-spin" />
                  : <Trash2 size={13} />}
                Confirmer
              </button>
              <button
                onClick={() => setConfirmDelete(false)}
                className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 text-sm rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/40"
              >
                Annuler
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmDelete(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-red-500 border border-red-200 text-sm rounded-lg hover:bg-red-50 transition-colors"
            >
              <Trash2 size={14} />
              Supprimer la culture
            </button>
          )}

          <button onClick={onClose}
            className="px-4 py-2 bg-gray-100 text-gray-700 dark:text-gray-200 text-sm rounded-lg hover:bg-gray-200">
            Fermer
          </button>
        </div>
      </div>
    </div>
  )
}
