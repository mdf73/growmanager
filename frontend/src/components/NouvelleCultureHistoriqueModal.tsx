import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { X, Loader2, Plus, Trash2, Leaf } from 'lucide-react'
import { historiqueCultureAPI } from '../api/historiqueCulture'
import type { HistoriquePlantCreate } from '../api/historiqueCulture'
import { varieteAPI } from '../api/varietes'
import type { Variete } from '../api/varietes'
import { useParametreListe } from '../api/parametres'

// ── Types internes ────────────────────────────────────────────────────────────
interface PlantRow extends HistoriquePlantCreate {
  _key: number   // clé locale pour React
  _loading: boolean
}

function emptyPlant(key: number, num: number): PlantRow {
  return {
    _key: key, _loading: false, id_variete: null, variete_nom: null,
    numero_plant: num, date_debut_plant: null, date_fin_plant: null,
    prix_graine: null, quantite_recoltee: null, notes: null,
  }
}

// ── Ligne plante ──────────────────────────────────────────────────────────────
function PlantRow({
  row, index, varietes, onUpdate, onDelete,
}: {
  row: PlantRow
  index: number
  varietes: Variete[]
  onUpdate: (key: number, patch: Partial<PlantRow>) => void
  onDelete: (key: number) => void
}) {
  const handleVarieteChange = async (idVariete: number | null) => {
    if (!idVariete) {
      onUpdate(row._key, { id_variete: null, variete_nom: null, prix_graine: null })
      return
    }
    const v = varietes.find(v => v.id_variete === idVariete)
    onUpdate(row._key, { id_variete: idVariete, variete_nom: v?.nom_variete ?? null, _loading: true })
    try {
      const res = await historiqueCultureAPI.getPrixGraine(idVariete)
      onUpdate(row._key, { prix_graine: res.data.prix_graine, _loading: false })
    } catch {
      onUpdate(row._key, { _loading: false })
    }
  }

  return (
    <div className="p-3 bg-gray-50 rounded-xl border border-gray-100 space-y-2">
      {/* Ligne 1 : numéro + variété + prix + récolte + supprimer */}
      <div className="flex items-end gap-2">
        {/* Numéro */}
        <span className="text-sm font-bold text-gray-400 w-6 shrink-0 text-center pb-2">
          {row.numero_plant ?? index + 1}
        </span>

        {/* Variété */}
        <div className="flex-1 min-w-0">
          <label className="block text-[10px] text-gray-400 mb-0.5">Variété</label>
          <select
            value={row.id_variete ?? ''}
            onChange={e => handleVarieteChange(e.target.value ? parseInt(e.target.value) : null)}
            className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:ring-2 focus:ring-grow-400 bg-white"
          >
            <option value="">— choisir —</option>
            {varietes.map(v => (
              <option key={v.id_variete} value={v.id_variete}>{v.nom_variete}</option>
            ))}
          </select>
        </div>

        {/* Prix graine */}
        <div className="w-24 shrink-0">
          <label className="block text-[10px] text-gray-400 mb-0.5">Prix graine (€)</label>
          <div className="relative">
            <input
              type="number" min="0" step="0.01"
              value={row.prix_graine ?? ''}
              onChange={e => onUpdate(row._key, { prix_graine: e.target.value ? parseFloat(e.target.value) : null })}
              className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:ring-2 focus:ring-grow-400"
              placeholder="auto"
            />
            {row._loading && (
              <Loader2 size={12} className="animate-spin absolute right-2 top-2 text-gray-400" />
            )}
          </div>
        </div>

        {/* Récolte */}
        <div className="w-24 shrink-0">
          <label className="block text-[10px] text-gray-400 mb-0.5">Récolte (g)</label>
          <input
            type="number" min="0" step="0.1"
            value={row.quantite_recoltee ?? ''}
            onChange={e => onUpdate(row._key, { quantite_recoltee: e.target.value ? parseFloat(e.target.value) : null })}
            className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:ring-2 focus:ring-grow-400"
            placeholder="0"
          />
        </div>

        {/* Supprimer */}
        <button
          type="button"
          onClick={() => onDelete(row._key)}
          className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors shrink-0 mb-0.5"
        >
          <Trash2 size={14} />
        </button>
      </div>

      {/* Ligne 2 : dates + notes */}
      <div className="flex items-end gap-2 pl-8">
        <div className="w-32 shrink-0">
          <label className="block text-[10px] text-gray-400 mb-0.5">Début plante</label>
          <input
            type="date"
            value={row.date_debut_plant ?? ''}
            onChange={e => onUpdate(row._key, { date_debut_plant: e.target.value || null })}
            className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:ring-2 focus:ring-grow-400"
          />
        </div>
        <div className="w-32 shrink-0">
          <label className="block text-[10px] text-gray-400 mb-0.5">Fin plante</label>
          <input
            type="date"
            value={row.date_fin_plant ?? ''}
            onChange={e => onUpdate(row._key, { date_fin_plant: e.target.value || null })}
            className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:ring-2 focus:ring-grow-400"
          />
        </div>
        <div className="flex-1 min-w-0">
          <label className="block text-[10px] text-gray-400 mb-0.5">Notes</label>
          <input
            type="text"
            value={row.notes ?? ''}
            onChange={e => onUpdate(row._key, { notes: e.target.value || null })}
            className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:ring-2 focus:ring-grow-400"
            placeholder="optionnel"
          />
        </div>
      </div>
    </div>
  )
}

// ── Modal principal ───────────────────────────────────────────────────────────
interface Props { onClose: () => void }

export default function NouvelleCultureHistoriqueModal({ onClose }: Props) {
  const qc = useQueryClient()

  const { data: varietes = [] } = useQuery<Variete[]>({
    queryKey: ['varietes'],
    queryFn:  async () => (await varieteAPI.getAll()).data,
  })

  // ── Listes paramétrables ─────────────────────────────────────────────────
  const { values: tentes }    = useParametreListe('tentes')
  const { values: lampes }    = useParametreListe('lampes_hc')
  const { values: puissances } = useParametreListe('puissances_hc')
  const { values: types }     = useParametreListe('types_culture')
  const { values: engrais }   = useParametreListe('engrais')
  const { values: substrats } = useParametreListe('substrats')

  // ── Form culture ──────────────────────────────────────────────────────────
  const [form, setForm] = useState({
    nom:          '',
    date_debut:   '',
    date_fin:     '',
    tente:        '',
    lampe:        '',
    puissance:    '',
    type_culture: '',
    engrais:      '',
    substrat:     '',
    notes:        '',
  })

  // ── Plantes ───────────────────────────────────────────────────────────────
  const [plants, setPlants] = useState<PlantRow[]>([emptyPlant(1, 1)])
  const [nextKey, setNextKey] = useState(2)

  const addPlant = () => {
    setPlants(p => [...p, emptyPlant(nextKey, p.length + 1)])
    setNextKey(k => k + 1)
  }

  const updatePlant = (key: number, patch: Partial<PlantRow>) =>
    setPlants(p => p.map(r => r._key === key ? { ...r, ...patch } : r))

  const deletePlant = (key: number) =>
    setPlants(p => p.filter(r => r._key !== key))

  // ── Totaux calculés ───────────────────────────────────────────────────────
  const totalRecolte = plants.reduce((s, p) => s + (p.quantite_recoltee ?? 0), 0)
  const totalPrix    = plants.reduce((s, p) => s + (p.prix_graine ?? 0), 0)
  const puissanceN   = form.puissance ? parseInt(form.puissance) : 0
  const gpw          = totalRecolte > 0 && puissanceN > 0
    ? (totalRecolte / puissanceN).toFixed(3)
    : null

  // ── Soumission ────────────────────────────────────────────────────────────
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const payload = {
        nom:          form.nom          || null,
        date_debut:   form.date_debut   || null,
        date_fin:     form.date_fin     || null,
        tente:        form.tente        || null,
        lampe:        form.lampe        || null,
        puissance:    form.puissance    ? parseInt(form.puissance)    : null,
        type_culture: form.type_culture || null,
        engrais:      form.engrais      || null,
        substrat:     form.substrat     || null,
        notes:        form.notes        || null,
        plants: plants
          .filter(p => p.id_variete || p.variete_nom)  // skip rows vides
          .map(({ _key, _loading, ...rest }) => ({
            ...rest,
            prix_graine:       rest.prix_graine       ?? null,
            quantite_recoltee: rest.quantite_recoltee ?? null,
          })),
      }
      await historiqueCultureAPI.create(payload)
      qc.invalidateQueries({ queryKey: ['historique-cultures'] })
      onClose()
    } catch {
      setError("Erreur lors de l'enregistrement.")
    } finally {
      setLoading(false)
    }
  }

  const set = (key: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm(f => ({ ...f, [key]: e.target.value }))

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl flex flex-col max-h-[92vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-grow-50 rounded-lg">
              <Leaf size={18} className="text-grow-600" />
            </div>
            <h2 className="text-lg font-bold text-gray-900">Nouvelle culture</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={22} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="overflow-y-auto flex-1 px-6 py-5 space-y-6">

          {/* ── Infos culture ─────────────────────────────────────────── */}
          <section>
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Informations culture</h3>

            {/* Nom de la culture */}
            <div className="mb-3">
              <label className="block text-xs text-gray-500 mb-1">Nom de la culture <span className="text-gray-300">(optionnel)</span></label>
              <input type="text" value={form.nom} onChange={set('nom')} placeholder="ex: Gelato #4 run 2, Test LED…"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-grow-400" />
            </div>

            {/* Dates */}
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Date de début</label>
                <input type="date" value={form.date_debut} onChange={set('date_debut')}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-grow-400" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Date de fin</label>
                <input type="date" value={form.date_fin} onChange={set('date_fin')}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-grow-400" />
              </div>
            </div>

            {/* Matériel - ligne 1 */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Tente</label>
                <select value={form.tente} onChange={set('tente')}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-grow-400">
                  <option value="">—</option>
                  {tentes.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Lampe</label>
                <select value={form.lampe} onChange={set('lampe')}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-grow-400">
                  <option value="">—</option>
                  {lampes.map(l => <option key={l} value={l}>{l}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Puissance (W)</label>
                <select value={form.puissance} onChange={set('puissance')}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-grow-400">
                  <option value="">—</option>
                  {puissances.map(p => <option key={p} value={p}>{p} W</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Type</label>
                <select value={form.type_culture} onChange={set('type_culture')}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-grow-400">
                  <option value="">—</option>
                  {types.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            </div>

            {/* Matériel - ligne 2 */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Engrais</label>
                <select value={form.engrais} onChange={set('engrais')}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-grow-400">
                  <option value="">—</option>
                  {engrais.map(e => <option key={e} value={e}>{e}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Substrat</label>
                <select value={form.substrat} onChange={set('substrat')}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-grow-400">
                  <option value="">—</option>
                  {substrats.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>
          </section>

          {/* ── Plantes ───────────────────────────────────────────────── */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                Plantes
                <span className="ml-2 font-bold text-grow-600">{plants.length}</span>
              </h3>
              <button
                type="button"
                onClick={addPlant}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-grow-50 text-grow-700 text-xs font-semibold rounded-lg hover:bg-grow-100 transition-colors"
              >
                <Plus size={13} />
                Ajouter une plante
              </button>
            </div>

            {plants.length === 0 ? (
              <div className="text-center py-6 border-2 border-dashed border-gray-200 rounded-xl">
                <p className="text-sm text-gray-400">Aucune plante. Cliquez sur « Ajouter une plante ».</p>
              </div>
            ) : (
              <div className="space-y-2">
                {plants.map((p, i) => (
                  <PlantRow
                    key={p._key}
                    row={p}
                    index={i}
                    varietes={varietes}
                    onUpdate={updatePlant}
                    onDelete={deletePlant}
                  />
                ))}
              </div>
            )}

            {/* Totaux en temps réel */}
            {plants.length > 0 && (
              <div className="mt-3 flex items-center gap-4 px-3 py-2 bg-grow-50 rounded-xl text-xs">
                <span className="text-gray-500">{plants.length} plante{plants.length > 1 ? 's' : ''}</span>
                <span className="font-semibold text-grow-700">
                  Récolte : <strong>{totalRecolte.toFixed(1)} g</strong>
                </span>
                <span className="font-semibold text-blue-600">
                  Prix graines : <strong>{totalPrix.toFixed(2)} €</strong>
                </span>
                {gpw && (
                  <span className="font-semibold text-amber-600">
                    g/W : <strong>{gpw}</strong>
                  </span>
                )}
              </div>
            )}
          </section>

          {/* ── Notes culture ─────────────────────────────────────────── */}
          <section>
            <label className="block text-xs text-gray-500 mb-1">Notes (culture)</label>
            <textarea value={form.notes} onChange={set('notes')} rows={2}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-grow-400 resize-none" />
          </section>

          {error && <p className="text-sm text-red-600">{error}</p>}
        </form>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 shrink-0 flex justify-end gap-3">
          <button type="button" onClick={onClose}
            className="px-4 py-2 bg-gray-100 text-gray-700 text-sm rounded-lg hover:bg-gray-200">
            Annuler
          </button>
          <button type="submit" onClick={handleSubmit} disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-grow-600 text-white text-sm rounded-lg hover:bg-grow-700 disabled:opacity-50">
            {loading ? <Loader2 size={14} className="animate-spin" /> : null}
            Enregistrer
          </button>
        </div>
      </div>
    </div>
  )
}
