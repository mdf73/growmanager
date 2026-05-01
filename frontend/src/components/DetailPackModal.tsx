import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { X, ExternalLink, CheckCircle2, Circle, Trash2, Loader2, Lock, Pencil } from 'lucide-react'
// Note: deleteGraine mutation kept but bouton supprimé de l'UI (griser suffit)
import { packCompletAPI, graineActionAPI, GraineSimple, CatalogueItem } from '../api/graines'
import NouveauPackModal from './NouveauPackModal'

interface DetailPackModalProps {
  pack: CatalogueItem
  onClose: () => void
  onDeleted: () => void
}


export default function DetailPackModal({ pack, onClose, onDeleted }: DetailPackModalProps) {
  const queryClient = useQueryClient()
  const [confirmDeletePack, setConfirmDeletePack] = useState(false)
  const [showEdit, setShowEdit] = useState(false)

  const { data: graines = [], isLoading } = useQuery<GraineSimple[]>({
    queryKey: ['pack-graines', pack.id_packgraine],
    queryFn: async () => (await packCompletAPI.getGraines(pack.id_packgraine)).data,
  })

  const toggle = useMutation({
    mutationFn: (id: number) => graineActionAPI.toggle(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pack-graines', pack.id_packgraine] })
      queryClient.invalidateQueries({ queryKey: ['catalogue'] })
    },
  })


  const deletePack = useMutation({
    mutationFn: () => packCompletAPI.delete(pack.id_packgraine),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['catalogue'] })
      onDeleted()
    },
  })

  const disponibles = graines.filter(g => !g.utilisee).length
  const utilisees = graines.filter(g => g.utilisee).length

  if (showEdit) {
    return (
      <NouveauPackModal
        editPack={pack}
        onClose={() => {
          setShowEdit(false)
          queryClient.invalidateQueries({ queryKey: ['catalogue'] })
        }}
      />
    )
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col">

        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700 shrink-0">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">
                  {pack.breeder_nom} · {pack.variete_nom}
                </h2>
                {pack.edition_limite && (
                  <span className="flex items-center gap-1 text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
                    <Lock size={10} />
                    Édition limitée
                  </span>
                )}
                {pack.lien_web && (
                  <a
                    href={pack.lien_web}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-xs text-grow-600 hover:underline"
                  >
                    <ExternalLink size={12} />
                    Seedfinder
                  </a>
                )}
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500">
                {pack.croisement_variete && (
                  <span className="italic">{pack.croisement_variete}</span>
                )}
                {pack.type_graines && <span>{pack.type_graines}</span>}
                {pack.duree_flo_min && pack.duree_flo_max && (
                  <span>🌸 {pack.duree_flo_min}–{pack.duree_flo_max}j</span>
                )}
                {pack.date_achat && (
                  <span>📅 {new Date(pack.date_achat).toLocaleDateString('fr-FR')}</span>
                )}
                {pack.prix_par_graine != null && (
                  <span>💰 {pack.prix_par_graine === 0 ? 'Gratuit' : `${pack.prix_par_graine.toFixed(2)} €/graine`}</span>
                )}
              </div>
            </div>
            <button onClick={onClose} className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:text-gray-300 ml-4 shrink-0">
              <X size={22} />
            </button>
          </div>

          {/* Stats */}
          <div className="mt-3 flex gap-4 text-sm">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-green-500 inline-block"></span>
              <span className="text-gray-700 dark:text-gray-200 font-medium">{disponibles}</span>
              <span className="text-gray-400 dark:text-gray-500">disponible{disponibles > 1 ? 's' : ''}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-gray-300 inline-block"></span>
              <span className="text-gray-700 dark:text-gray-200 font-medium">{utilisees}</span>
              <span className="text-gray-400 dark:text-gray-500">utilisée{utilisees > 1 ? 's' : ''}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-gray-500 dark:text-gray-400 dark:text-gray-500 font-medium">{graines.length}</span>
              <span className="text-gray-400 dark:text-gray-500">total</span>
            </div>
          </div>
        </div>

        {/* Liste des graines */}
        <div className="overflow-y-auto flex-1 px-6 py-4">
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="animate-spin text-gray-300" size={32} />
            </div>
          ) : graines.length === 0 ? (
            <p className="text-center text-gray-400 dark:text-gray-500 text-sm py-8">Aucune graine enregistrée</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
              {graines.map((g, idx) => (
                <div
                  key={g.id_graine}
                  className={`relative group flex items-center justify-between px-3 py-2 rounded-lg border transition-colors ${
                    g.utilisee
                      ? 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50 opacity-60'
                      : 'border-green-200 bg-green-50'
                  }`}
                >
                  <button
                    onClick={() => toggle.mutate(g.id_graine)}
                    disabled={toggle.isPending}
                    className="flex items-center gap-2 flex-1 text-left"
                    title={g.utilisee ? 'Marquer comme disponible' : 'Marquer comme utilisée'}
                  >
                    {g.utilisee ? (
                      <CheckCircle2 size={16} className="text-gray-400 dark:text-gray-500 shrink-0" />
                    ) : (
                      <Circle size={16} className="text-green-500 shrink-0" />
                    )}
                    <span className={`text-xs font-mono ${g.utilisee ? 'text-gray-400 dark:text-gray-500 line-through' : 'text-gray-700 dark:text-gray-200'}`}>
                      #{idx + 1}
                    </span>
                  </button>
                </div>
              ))}
            </div>
          )}
          <p className="mt-3 text-xs text-gray-400 dark:text-gray-500">
            Clique sur une graine pour basculer son état. L'icône ✓ = utilisée, ○ = disponible.
          </p>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-gray-100 dark:border-gray-700 flex justify-between items-center shrink-0">
          {confirmDeletePack ? (
            <div className="flex items-center gap-3 w-full">
              <span className="text-sm text-red-600 flex items-center gap-1.5">
                <Trash2 size={14} />
                Supprimer ce pack et toutes ses graines ?
              </span>
              <button
                onClick={() => deletePack.mutate()}
                disabled={deletePack.isPending}
                className="px-3 py-1 bg-red-600 text-white text-xs rounded hover:bg-red-700"
              >
                {deletePack.isPending ? <Loader2 size={12} className="animate-spin" /> : 'Confirmer'}
              </button>
              <button
                onClick={() => setConfirmDeletePack(false)}
                className="px-3 py-1 border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 text-xs rounded hover:bg-gray-50 dark:hover:bg-gray-700/40"
              >
                Annuler
              </button>
            </div>
          ) : (
            <>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowEdit(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 text-sm rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/40"
                >
                  <Pencil size={14} />
                  Modifier le pack
                </button>
                <button
                  onClick={() => setConfirmDeletePack(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 border border-red-200 text-red-500 text-sm rounded-lg hover:bg-red-50"
                >
                  <Trash2 size={14} />
                  Supprimer
                </button>
              </div>
              <button
                onClick={onClose}
                className="px-4 py-1.5 bg-grow-600 text-white text-sm rounded-lg hover:bg-grow-700"
              >
                Fermer
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
