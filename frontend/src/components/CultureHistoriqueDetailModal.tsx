import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { X, Trash2, Loader2, Leaf, AlertTriangle, Pencil, Check, Zap, FlaskConical, Euro, Lightbulb } from 'lucide-react'
import type { HistoriqueCulture, HistoriquePlant, HistoriqueCultureUpdate, HistoriquePlantUpdate } from '../api/historiqueCulture'
import { historiqueCultureAPI } from '../api/historiqueCulture'
import { materielAPI } from '../api/materiel'
import type { Materiel, CaractLampe } from '../api/materiel'

const TENTES = ['60x60x100', '60x120x150', '100x100x200', '120x120x200', 'Exterieur']
const TYPES  = ['Indoor', 'Outdoor']
const ENGRAIS_OPT = ['Living Soil (LSO)', 'Aptus', 'Hesi', 'Aucun', 'Autre']
const SUBSTRATS   = ['LSO', 'Terre', 'Terre+Coco', 'Coco', 'NFT', 'Billes d\'argile', 'Pleine terre']

function fmtDate(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('fr-FR')
}

function SCard({ label, value, sub, color = 'grow', onClick }: { label: string; value: string; sub?: string; color?: string; onClick?: () => void }) {
  const colors: Record<string, string> = {
    grow:   'bg-grow-50   text-grow-700   text-grow-400',
    blue:   'bg-blue-50   text-blue-700   text-blue-400',
    amber:  'bg-amber-50  text-amber-700  text-amber-400',
    purple: 'bg-purple-50 text-purple-700 text-purple-400',
    indigo: 'bg-indigo-50 text-indigo-700 text-indigo-400',
  }
  const [bg, txt, sub_] = (colors[color] ?? colors.grow).split(' ')
  return (
    <div
      className={`${bg} rounded-xl p-3 ${onClick ? 'cursor-pointer hover:brightness-95 transition-all' : ''}`}
      onClick={onClick}
    >
      <p className={`text-xs ${sub_} mb-0.5`}>{label}</p>
      <p className={`text-xl font-bold ${txt}`}>{value}</p>
      {sub && <p className={`text-xs ${sub_} mt-0.5`}>{sub}</p>}
      {onClick && <p className={`text-xs ${sub_} mt-1 opacity-60`}>Cliquer pour le détail</p>}
    </div>
  )
}

// ── Ligne plante avec édition + suppression ───────────────────────────────────
function PlantLine({
  plant, cultureId, onDeleted, onUpdated,
}: {
  plant: HistoriquePlant
  cultureId: number
  onDeleted: () => void
  onUpdated: () => void
}) {
  const [confirm, setConfirm] = useState(false)
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState<HistoriquePlantUpdate>({
    variete_nom:       plant.variete_nom,
    quantite_recoltee: plant.quantite_recoltee,
    notes:             plant.notes,
    date_debut_plant:  plant.date_debut_plant,
    date_fin_plant:    plant.date_fin_plant,
  })

  const remove = useMutation({
    mutationFn: () => historiqueCultureAPI.deletePlant(cultureId, plant.id_historique_plant),
    onSuccess: onDeleted,
    onError: () => setConfirm(false),
  })

  const save = useMutation({
    mutationFn: () => historiqueCultureAPI.updatePlant(cultureId, plant.id_historique_plant, form),
    onSuccess: () => { onUpdated(); setEditing(false) },
  })

  const inCls = 'border border-gray-200 dark:border-gray-600 rounded px-2 py-1 text-xs w-full focus:ring-1 focus:ring-grow-400 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100'

  if (editing) {
    return (
      <tr className="bg-grow-50 dark:bg-grow-900/20">
        <td className="px-2 py-2 text-xs text-gray-400 dark:text-gray-500 font-mono text-center">P{plant.numero_plant ?? '?'}</td>
        <td className="px-2 py-2">
          <input className={inCls} value={form.variete_nom ?? ''} onChange={e => setForm(f => ({ ...f, variete_nom: e.target.value || null }))} />
        </td>
        <td className="px-2 py-2">
          <input type="date" className={inCls} value={form.date_debut_plant ?? ''} onChange={e => setForm(f => ({ ...f, date_debut_plant: e.target.value || null }))} />
        </td>
        <td className="px-2 py-2">
          <input type="date" className={inCls} value={form.date_fin_plant ?? ''} onChange={e => setForm(f => ({ ...f, date_fin_plant: e.target.value || null }))} />
        </td>
        <td className="px-2 py-2">
          <input type="number" step="0.1" min="0" className={inCls}
            value={form.quantite_recoltee ?? ''}
            onChange={e => setForm(f => ({ ...f, quantite_recoltee: e.target.value ? Number(e.target.value) : null }))}
            placeholder="g" />
        </td>
        <td className="px-2 py-2">
          <input className={inCls} value={form.notes ?? ''} onChange={e => setForm(f => ({ ...f, notes: e.target.value || null }))} placeholder="notes…" />
        </td>
        <td className="px-2 py-2 text-right">
          <div className="flex items-center justify-end gap-1">
            <button onClick={() => save.mutate()} disabled={save.isPending}
              className="px-2 py-1 bg-grow-600 text-white text-xs rounded hover:bg-grow-700 disabled:opacity-50">
              {save.isPending ? <Loader2 size={10} className="animate-spin" /> : <Check size={10} />}
            </button>
            <button onClick={() => setEditing(false)}
              className="px-2 py-1 border border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400 text-xs rounded">
              ✕
            </button>
          </div>
        </td>
      </tr>
    )
  }

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
      <td className="px-4 py-2.5 text-sm font-semibold text-grow-700 text-right">
        {plant.quantite_recoltee != null ? `${Number(plant.quantite_recoltee).toFixed(1)} g` : '—'}
      </td>
      <td className="px-4 py-2.5 text-xs text-gray-400 dark:text-gray-500 max-w-[120px] truncate" title={plant.notes ?? ''}>
        {plant.notes || ''}
      </td>
      <td className="px-4 py-2.5 text-right">
        {confirm ? (
          <div className="flex items-center justify-end gap-1">
            <button onClick={() => remove.mutate()} disabled={remove.isPending}
              className="px-2 py-1 bg-red-500 text-white text-xs rounded hover:bg-red-600 disabled:opacity-50">
              {remove.isPending ? <Loader2 size={10} className="animate-spin" /> : 'Suppr.'}
            </button>
            <button onClick={() => setConfirm(false)}
              className="px-2 py-1 border border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 text-xs rounded">
              ✕
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button onClick={() => setEditing(true)}
              className="p-1.5 text-gray-400 hover:text-grow-600 hover:bg-grow-50 rounded">
              <Pencil size={12} />
            </button>
            <button onClick={() => setConfirm(true)}
              className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded">
              <Trash2 size={12} />
            </button>
          </div>
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
  const [showCoutDetail, setShowCoutDetail] = useState(false)
  const [selectedLampIds, setSelectedLampIds] = useState<number[]>([])

  // Fetch lamp inventory
  const { data: allMateriel } = useQuery({
    queryKey: ['materiel'],
    queryFn: () => materielAPI.getAll().then(r => r.data),
    staleTime: 60_000,
  })
  const lampInventory = (allMateriel ?? []).filter(
    m => m.categorie === 'Lampes' && !m.date_sortie_stock
  )

  const toggleLamp = (lamp: Materiel) => {
    setSelectedLampIds(prev => {
      const newIds = prev.includes(lamp.id_materiel)
        ? prev.filter(i => i !== lamp.id_materiel)
        : [...prev, lamp.id_materiel]
      const selected = lampInventory.filter(l => newIds.includes(l.id_materiel))
      const lampeStr = selected.map(l => l.marque ? `${l.nom} (${l.marque})` : l.nom).join(' + ') || null
      const puissance = selected.reduce((acc, l) => {
        const c = l.caracteristiques as CaractLampe | null
        return acc + (c?.puissance_w ?? 0)
      }, 0) || null
      setForm(f => ({ ...f, lampe: lampeStr, puissance }))
      return newIds
    })
  }

  // État formulaire d'édition (initialisé avec les valeurs actuelles)
  const [form, setForm] = useState<HistoriqueCultureUpdate>({
    nom:             culture.nom,
    date_debut:      culture.date_debut,
    date_fin:        culture.date_fin,
    tente:           culture.tente,
    lampe:           culture.lampe,
    puissance:       culture.puissance,
    type_culture:    culture.type_culture,
    engrais:         culture.engrais,
    substrat:        culture.substrat,
    notes:           culture.notes,
    cout_engrais:    culture.cout_engrais,
    cout_electricite: culture.cout_electricite,
    cout_graines:    culture.cout_graines,
    cout_total:      culture.cout_total,
    cout_par_gramme: culture.cout_par_gramme,
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
      setSelectedLampIds([])
    },
  })

  const nbPlants       = culture.plants.length
  const totalRecolte   = culture.quantite_totale
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
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[90vh] relative">

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

              {/* ── Lamp picker ──────────────────────────────────────── */}
              <div className="border-t border-gray-200 dark:border-gray-600 pt-3">
                <p className="text-xs font-semibold text-amber-600 dark:text-amber-400 mb-2 flex items-center gap-1.5">
                  <Lightbulb size={12} /> Lampes utilisées
                </p>
                {lampInventory.length === 0 ? (
                  <p className="text-xs text-gray-400 dark:text-gray-500 italic">Aucune lampe dans l'inventaire matériel.</p>
                ) : (
                  <div className="flex flex-wrap gap-2 mb-2">
                    {lampInventory.map(lamp => {
                      const c = lamp.caracteristiques as CaractLampe | null
                      const isSelected = selectedLampIds.includes(lamp.id_materiel)
                      return (
                        <button
                          key={lamp.id_materiel}
                          type="button"
                          onClick={() => toggleLamp(lamp)}
                          className={`flex flex-col items-start px-3 py-2 rounded-lg border text-xs transition-all ${
                            isSelected
                              ? 'border-amber-400 bg-amber-50 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200 shadow-sm'
                              : 'border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:border-amber-300 hover:bg-amber-50/50'
                          }`}
                        >
                          <span className="font-semibold">{lamp.nom}</span>
                          {lamp.marque && <span className="text-gray-400 dark:text-gray-500">{lamp.marque}</span>}
                          <div className="flex items-center gap-2 mt-0.5 text-gray-400 dark:text-gray-500">
                            {c?.puissance_w != null && <span><Zap size={9} className="inline mr-0.5 text-yellow-500" />{c.puissance_w} W</span>}
                            {c?.type && <span>{c.type}</span>}
                          </div>
                          {c?.spectres && c.spectres.length > 0 && (
                            <span className="mt-0.5 text-purple-400 dark:text-purple-500">{c.spectres.join(', ')}</span>
                          )}
                        </button>
                      )
                    })}
                  </div>
                )}

                {/* Résumé auto-calculé + override manuel */}
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Lampe (auto-calculé ou manuel)">
                    <input type="text" className={inputCls}
                      value={form.lampe ?? ''}
                      onChange={set('lampe')}
                      placeholder="ex: LED 240W + LED 120W" />
                  </Field>
                  <Field label="Puissance totale (W)">
                    <input type="number" min="0" className={inputCls}
                      value={form.puissance ?? ''}
                      onChange={e => setForm(f => ({ ...f, puissance: e.target.value ? Number(e.target.value) : null }))}
                      placeholder="W" />
                  </Field>
                </div>
                {selectedLampIds.length > 0 && (
                  <p className="text-xs text-amber-500 dark:text-amber-400 mt-1 italic">
                    {selectedLampIds.length} lampe{selectedLampIds.length > 1 ? 's' : ''} sélectionnée{selectedLampIds.length > 1 ? 's' : ''} — puissance et description auto-remplies.
                  </p>
                )}
              </div>

              <Field label="Notes">
                <textarea className={inputCls} rows={2}
                  value={form.notes ?? ''}
                  onChange={set('notes')} />
              </Field>

              {/* Coûts manuels */}
              {(() => {
                const elec    = Number(form.cout_electricite) || 0
                const engrais = Number(form.cout_engrais)     || 0
                const graines = Number(form.cout_graines)     || 0
                const total   = elec + engrais + graines
                const poids   = Number(culture.quantite_totale) || 0
                const pgr     = total > 0 && poids > 0 ? total / poids : null
                return (
                  <div className="border-t border-gray-200 dark:border-gray-600 pt-3">
                    <p className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 mb-2 flex items-center gap-1.5">
                      <Euro size={12} /> Coûts (saisie manuelle)
                    </p>
                    <div className="grid grid-cols-3 gap-3">
                      <Field label="Électricité (€)">
                        <input type="number" step="0.01" className={inputCls}
                          value={form.cout_electricite ?? ''}
                          onChange={e => {
                            const v = e.target.value ? Number(e.target.value) : null
                            const t = (Number(v) || 0) + engrais + graines
                            const p = t > 0 && poids > 0 ? t / poids : null
                            setForm(f => ({ ...f, cout_electricite: v, cout_total: t || null, cout_par_gramme: p }))
                          }}
                          placeholder="0.00" />
                      </Field>
                      <Field label="Engrais (€)">
                        <input type="number" step="0.01" className={inputCls}
                          value={form.cout_engrais ?? ''}
                          onChange={e => {
                            const v = e.target.value ? Number(e.target.value) : null
                            const t = elec + (Number(v) || 0) + graines
                            const p = t > 0 && poids > 0 ? t / poids : null
                            setForm(f => ({ ...f, cout_engrais: v, cout_total: t || null, cout_par_gramme: p }))
                          }}
                          placeholder="0.00" />
                      </Field>
                      <Field label="Graines (€)">
                        <input type="number" step="0.01" className={inputCls}
                          value={form.cout_graines ?? ''}
                          onChange={e => {
                            const v = e.target.value ? Number(e.target.value) : null
                            const t = elec + engrais + (Number(v) || 0)
                            const p = t > 0 && poids > 0 ? t / poids : null
                            setForm(f => ({ ...f, cout_graines: v, cout_total: t || null, cout_par_gramme: p }))
                          }}
                          placeholder="0.00" />
                      </Field>
                    </div>
                    {/* Total et €/g calculés automatiquement */}
                    <div className="mt-3 flex items-center gap-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg px-3 py-2">
                      <div>
                        <p className="text-xs text-indigo-400 dark:text-indigo-500">Total</p>
                        <p className="text-base font-bold text-indigo-700 dark:text-indigo-300">
                          {total > 0 ? `${total.toFixed(2)} €` : '—'}
                        </p>
                      </div>
                      <div className="border-l border-indigo-200 dark:border-indigo-700 pl-4">
                        <p className="text-xs text-indigo-400 dark:text-indigo-500">€/g</p>
                        <p className="text-base font-bold text-purple-600 dark:text-purple-400">
                          {pgr != null ? `${pgr.toFixed(2)} €/g` : poids === 0 ? 'pas de récolte' : '—'}
                        </p>
                      </div>
                      {poids > 0 && (
                        <p className="text-xs text-indigo-300 dark:text-indigo-600 ml-auto">sur {poids.toFixed(1)} g</p>
                      )}
                    </div>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-1.5 italic">
                      Total et €/g calculés automatiquement depuis les 3 postes ci-dessus.
                    </p>
                  </div>
                )
              })()}

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
                  onClick={() => {
                    setEditing(false)
                    setSelectedLampIds([])
                    setForm({ nom: culture.nom, date_debut: culture.date_debut, date_fin: culture.date_fin, tente: culture.tente, lampe: culture.lampe, puissance: culture.puissance, type_culture: culture.type_culture, engrais: culture.engrais, substrat: culture.substrat, notes: culture.notes, cout_engrais: culture.cout_engrais, cout_electricite: culture.cout_electricite, cout_graines: culture.cout_graines, cout_total: culture.cout_total, cout_par_gramme: culture.cout_par_gramme })
                  }}
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
              <SCard label="g/W"            value={gpw          != null ? `${gpw.toFixed(3)} g/W`              : '—'} color="amber"  />
              <SCard
                label="€/g"
                value={culture.cout_par_gramme != null ? `${Number(culture.cout_par_gramme).toFixed(2)} €/g` : '—'}
                color="indigo"
                onClick={culture.cout_par_gramme != null || culture.cout_total != null ? () => setShowCoutDetail(true) : undefined}
              />
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
                          onUpdated={invalidate}
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

        {/* ── Popup détail coûts ───────────────────────────────────────────── */}
        {showCoutDetail && (
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center z-10 rounded-xl" onClick={() => setShowCoutDetail(false)}>
            <div
              className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl p-5 w-72 space-y-3"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-indigo-800 dark:text-indigo-300 flex items-center gap-1.5">
                  <Euro size={14} /> Détail des coûts
                </h3>
                <button onClick={() => setShowCoutDetail(false)} className="text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300">
                  <X size={16} />
                </button>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between py-1.5 border-b border-gray-100 dark:border-gray-700">
                  <span className="text-sm text-gray-600 dark:text-gray-300 flex items-center gap-1.5"><Zap size={13} className="text-yellow-500" /> Électricité</span>
                  <span className="text-sm font-semibold text-gray-800 dark:text-gray-100">
                    {culture.cout_electricite != null ? `${Number(culture.cout_electricite).toFixed(2)} €` : '—'}
                  </span>
                </div>
                <div className="flex items-center justify-between py-1.5 border-b border-gray-100 dark:border-gray-700">
                  <span className="text-sm text-gray-600 dark:text-gray-300 flex items-center gap-1.5"><FlaskConical size={13} className="text-blue-500" /> Engrais</span>
                  <span className="text-sm font-semibold text-gray-800 dark:text-gray-100">
                    {culture.cout_engrais != null ? `${Number(culture.cout_engrais).toFixed(2)} €` : '—'}
                  </span>
                </div>
                <div className="flex items-center justify-between py-1.5 border-b border-gray-100 dark:border-gray-700">
                  <span className="text-sm text-gray-600 dark:text-gray-300 flex items-center gap-1.5"><Leaf size={13} className="text-green-500" /> Graines</span>
                  <span className="text-sm font-semibold text-gray-800 dark:text-gray-100">
                    {culture.cout_graines != null ? `${Number(culture.cout_graines).toFixed(2)} €` : '—'}
                  </span>
                </div>
                <div className="flex items-center justify-between py-2 bg-indigo-50 dark:bg-indigo-900/30 rounded-lg px-2">
                  <span className="text-sm font-bold text-indigo-700 dark:text-indigo-300">Total</span>
                  <span className="text-lg font-bold text-indigo-800 dark:text-indigo-200">
                    {culture.cout_total != null ? `${Number(culture.cout_total).toFixed(2)} €` : '—'}
                  </span>
                </div>
                {culture.cout_par_gramme != null && (
                  <div className="text-center pt-1">
                    <span className="text-xs font-semibold text-purple-600 dark:text-purple-400">
                      {Number(culture.cout_par_gramme).toFixed(2)} €/g
                    </span>
                    {culture.quantite_totale != null && (
                      <span className="text-xs text-gray-400 ml-2">sur {Number(culture.quantite_totale).toFixed(1)} g récoltés</span>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

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
