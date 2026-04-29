import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { X, ArrowRightLeft, Loader2, Home, Leaf } from 'lucide-react'
import {
  Plant,
  plantAPI,
  cultureUtilsAPI,
  TransferCultureTarget,
  TransferEspaceTarget,
} from '../../api/cultures'

interface Props {
  plant: Plant
  cultureId: number
  onClose: () => void
}

type TargetKind = 'culture' | 'espace'

export default function TransfertPlantModal({ plant, cultureId, onClose }: Props) {
  const qc = useQueryClient()
  const [selectedKind, setSelectedKind] = useState<TargetKind | null>(null)
  const [selectedCultureId, setSelectedCultureId] = useState<number | null>(null)
  const [selectedEspaceId, setSelectedEspaceId] = useState<number | null>(null)

  const { data: targets, isLoading } = useQuery({
    queryKey: ['transfer-targets', cultureId],
    queryFn: async () => (await cultureUtilsAPI.getTransferTargets(cultureId)).data,
  })

  const transfer = useMutation({
    mutationFn: () => {
      const payload =
        selectedKind === 'culture'
          ? { target_culture_id: selectedCultureId! }
          : { target_espace_id: selectedEspaceId! }
      return plantAPI.transfer(cultureId, plant.id_plant, payload)
    },
    onSuccess: () => {
      // Invalider la culture source et toutes les cultures (la cible peut avoir changé)
      qc.invalidateQueries({ queryKey: ['culture', cultureId] })
      qc.invalidateQueries({ queryKey: ['cultures'] })
      if (selectedKind === 'culture' && selectedCultureId) {
        qc.invalidateQueries({ queryKey: ['culture', selectedCultureId] })
      }
      onClose()
    },
  })

  const hasTargets =
    (targets?.cultures_actives.length ?? 0) > 0 ||
    (targets?.espaces_disponibles.length ?? 0) > 0

  const canConfirm =
    (selectedKind === 'culture' && selectedCultureId !== null) ||
    (selectedKind === 'espace' && selectedEspaceId !== null)

  // Trouver le label de la cible sélectionnée pour la confirmation
  function targetLabel(): string {
    if (selectedKind === 'culture') {
      const c = targets?.cultures_actives.find(c => c.id_culture === selectedCultureId)
      if (!c) return ''
      return c.nom_espace ? `${c.nom} (${c.nom_espace})` : c.nom
    }
    if (selectedKind === 'espace') {
      const e = targets?.espaces_disponibles.find(e => e.id_espace === selectedEspaceId)
      return e ? `Nouvel espace : ${e.nom}` : ''
    }
    return ''
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-gray-100">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-grow-50 rounded-lg">
              <ArrowRightLeft size={16} className="text-grow-600" />
            </div>
            <div>
              <h2 className="font-bold text-gray-900 text-base">Déplacer la plante</h2>
              <p className="text-xs text-gray-500 mt-0.5">{plant.nom_affichage}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg">
            <X size={18} />
          </button>
        </div>

        {/* Contenu */}
        <div className="px-5 py-4 space-y-4">
          {isLoading && (
            <div className="flex items-center justify-center py-8">
              <Loader2 size={24} className="animate-spin text-grow-600" />
            </div>
          )}

          {!isLoading && !hasTargets && (
            <div className="text-center py-8 text-gray-400">
              <ArrowRightLeft size={32} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm">Aucune destination disponible.</p>
              <p className="text-xs mt-1 text-gray-300">Il faut au moins une autre culture active ou un espace libre.</p>
            </div>
          )}

          {/* Cultures actives */}
          {!isLoading && (targets?.cultures_actives.length ?? 0) > 0 && (
            <section>
              <h3 className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                <Leaf size={12} className="text-green-500" />
                Cultures actives
              </h3>
              <div className="space-y-1.5">
                {targets!.cultures_actives.map((c: TransferCultureTarget) => (
                  <button
                    key={c.id_culture}
                    type="button"
                    onClick={() => {
                      setSelectedKind('culture')
                      setSelectedCultureId(c.id_culture)
                      setSelectedEspaceId(null)
                    }}
                    className={`w-full text-left px-3.5 py-2.5 rounded-xl border transition-all ${
                      selectedKind === 'culture' && selectedCultureId === c.id_culture
                        ? 'border-grow-500 bg-grow-50 ring-1 ring-grow-400'
                        : 'border-gray-200 hover:border-grow-300 hover:bg-gray-50'
                    }`}
                  >
                    <span className="block font-medium text-sm text-gray-900">{c.nom}</span>
                    {c.nom_espace && (
                      <span className="text-xs text-gray-500">📦 {c.nom_espace}</span>
                    )}
                    {c.phase && (
                      <span className="text-xs text-gray-400 ml-2">· {c.phase}</span>
                    )}
                  </button>
                ))}
              </div>
            </section>
          )}

          {/* Espaces disponibles */}
          {!isLoading && (targets?.espaces_disponibles.length ?? 0) > 0 && (
            <section>
              <h3 className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                <Home size={12} className="text-blue-500" />
                Espaces disponibles
                <span className="font-normal text-gray-400 normal-case tracking-normal ml-1">(crée une nouvelle culture)</span>
              </h3>
              <div className="space-y-1.5">
                {targets!.espaces_disponibles.map((e: TransferEspaceTarget) => (
                  <button
                    key={e.id_espace}
                    type="button"
                    onClick={() => {
                      setSelectedKind('espace')
                      setSelectedEspaceId(e.id_espace)
                      setSelectedCultureId(null)
                    }}
                    className={`w-full text-left px-3.5 py-2.5 rounded-xl border transition-all ${
                      selectedKind === 'espace' && selectedEspaceId === e.id_espace
                        ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-400'
                        : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50'
                    }`}
                  >
                    <span className="block font-medium text-sm text-gray-900">📦 {e.nom}</span>
                    <span className="text-xs text-gray-400">Nouvelle culture créée automatiquement</span>
                  </button>
                ))}
              </div>
            </section>
          )}

          {/* Message d'erreur */}
          {transfer.isError && (
            <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              Erreur lors du transfert. Veuillez réessayer.
            </p>
          )}
        </div>

        {/* Footer */}
        {hasTargets && (
          <div className="px-5 pb-5 flex items-center gap-2.5">
            <button
              onClick={() => transfer.mutate()}
              disabled={!canConfirm || transfer.isPending}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-grow-600 text-white rounded-xl text-sm font-medium hover:bg-grow-700 disabled:opacity-40 transition-colors"
            >
              {transfer.isPending ? (
                <><Loader2 size={14} className="animate-spin" /> Transfert…</>
              ) : (
                <><ArrowRightLeft size={14} />
                  {canConfirm ? `Déplacer vers ${targetLabel()}` : 'Choisir une destination'}
                </>
              )}
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2.5 border border-gray-300 rounded-xl text-sm text-gray-600 hover:bg-gray-50"
            >
              Annuler
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
