import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { X, FlaskConical } from 'lucide-react'
import { Plant } from '../../api/cultures'
import { croisementAPI, PollenCreate, StockagePollen } from '../../api/croisement'

interface Props {
  plant: Plant
  cultureId: number
  onClose: () => void
}

/** Collecte de pollen depuis une plante (mâle ou femelle reversée) :
 *  le lot est relié à la plante, la variété et le pheno sont déduits côté serveur,
 *  et la plante est marquée « conservée pour la repro ». */
export default function CollectePollenModal({ plant, cultureId, onClose }: Props) {
  const qc = useQueryClient()
  const today = new Date().toISOString().slice(0, 10)
  const mois = new Date().toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
  const estReverse = plant.sexe === 'femelle' || plant.sexe === 'hermaphrodite' || !!plant.reverse_sts

  const [data, setData] = useState<PollenCreate>({
    nom_pollen: `${plant.nom_affichage} ${estReverse ? '(STS) ' : ''}- ${mois}`,
    id_plant_source: plant.id_plant,
    reverse: estReverse,
    stockage: 'congelateur',
    date_collecte: today,
  })

  const mut = useMutation({
    mutationFn: () => croisementAPI.createPollen(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['culture', cultureId] })
      qc.invalidateQueries({ queryKey: ['pollen'] })
      qc.invalidateQueries({ queryKey: ['plantes-repro'] })
      onClose()
    },
  })

  const ic = 'w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <FlaskConical size={18} className="text-amber-600" />
            <h2 className="font-semibold text-gray-900 dark:text-gray-100">Collecter du pollen</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"><X size={18} /></button>
        </div>

        <div className="p-5 space-y-3">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Plante donneuse : <span className="font-medium text-gray-700 dark:text-gray-200">{plant.nom_affichage}</span>
            {plant.nom_variete ? ` (${plant.nom_variete})` : ''}.
            Le lot rejoint le stock de pollen et la plante est marquée « conservée pour la repro ».
          </p>

          <div>
            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Nom du lot</label>
            <input type="text" value={data.nom_pollen}
              onChange={e => setData({ ...data, nom_pollen: e.target.value })} className={ic} />
          </div>

          <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-200">
            <input type="checkbox" checked={!!data.reverse}
              onChange={e => setData({ ...data, reverse: e.target.checked })} />
            Femelle reversée (STS) : pollen féminisé
          </label>

          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Date</label>
              <input type="date" value={data.date_collecte || ''}
                onChange={e => setData({ ...data, date_collecte: e.target.value || undefined })} className={ic} />
            </div>
            <div>
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Quantité (g)</label>
              <input type="number" step="0.001" min={0} value={data.quantite_initiale_g ?? ''}
                onChange={e => setData({ ...data, quantite_initiale_g: e.target.value === '' ? undefined : Number(e.target.value) })}
                className={ic} />
            </div>
            <div>
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Stockage</label>
              <select value={data.stockage || ''}
                onChange={e => setData({ ...data, stockage: (e.target.value as StockagePollen) || undefined })} className={ic}>
                <option value="ambiant">Ambiant (~1 mois)</option>
                <option value="frigo">Frigo (~6 mois)</option>
                <option value="congelateur">Congélateur (~18 mois)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Notes</label>
            <textarea rows={2} value={data.notes || ''}
              onChange={e => setData({ ...data, notes: e.target.value || undefined })}
              placeholder="Vigueur, odeur au frottement de tige, précocité…" className={`${ic} resize-none`} />
          </div>

          {mut.isError && (
            <p className="text-xs text-red-600">Échec de l'enregistrement du lot.</p>
          )}
        </div>

        <div className="flex justify-end gap-2 px-5 py-3 border-t border-gray-100 dark:border-gray-700">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 dark:text-gray-300">Annuler</button>
          <button onClick={() => mut.mutate()} disabled={!data.nom_pollen.trim() || mut.isPending}
            className="px-4 py-2 text-sm bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50">
            {mut.isPending ? '…' : 'Enregistrer le lot'}
          </button>
        </div>
      </div>
    </div>
  )
}
