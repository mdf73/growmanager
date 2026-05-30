import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { X, Scissors, CheckCircle2, XCircle, Home, Sparkles, Minus, Plus } from 'lucide-react'
import { Plant, plantAPI, cultureUtilsAPI, EspaceCloneItem } from '../../api/cultures'

interface Props {
  plant: Plant
  cultureId: number
  onClose: () => void
}

type CloneResult = Plant & { id_culture_cible: number; nom_culture_cible: string }

export default function ClonageModal({ plant, cultureId, onClose }: Props) {
  const qc = useQueryClient()
  const today = new Date().toISOString().slice(0, 10)

  const [nomClone, setNomClone] = useState(`Clone de ${plant.nom_affichage}`)
  const [datePrelevement, setDatePrelevement] = useState(today)
  const [selectedEspace, setSelectedEspace] = useState<EspaceCloneItem | null>(null)
  const [notes, setNotes] = useState('')
  const [quantite, setQuantite] = useState(1)
  const [step, setStep] = useState<'form' | 'success'>('form')
  const [createdClones, setCreatedClones] = useState<CloneResult[]>([])

  const { data: espaces = [], isLoading } = useQuery({
    queryKey: ['espaces-clone'],
    queryFn: async () => (await cultureUtilsAPI.getEspacesClone()).data,
  })

  const cloneMutation = useMutation({
    mutationFn: () =>
      plantAPI.clone(cultureId, plant.id_plant, {
        id_espace: selectedEspace?.id_espace,
        id_box: selectedEspace?.id_box,
        nom_affichage: nomClone,
        date_prelevement: datePrelevement,
        notes: notes || undefined,
        quantite,
      }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['culture', cultureId] })
      if (res.data[0]) {
        qc.invalidateQueries({ queryKey: ['culture', res.data[0].id_culture_cible] })
      }
      qc.invalidateQueries({ queryKey: ['espaces-clone'] })
      setCreatedClones(res.data)
      setStep('success')
    },
  })

  const PHASE_LABELS: Record<string, string> = {
    veg: 'Vegetation', floraison: 'Floraison', germination: 'Germination',
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <Scissors size={16} className="text-violet-600" />
            <h2 className="font-semibold text-gray-900 dark:text-gray-100 text-sm">
              Prendre des boutures — {plant.nom_affichage}
            </h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
            <X size={18} />
          </button>
        </div>

        {step === 'form' ? (
          <div className="p-5 space-y-4">

            {/* Quantite */}
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">
                Nombre de boutures
              </label>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setQuantite(q => Math.max(1, q - 1))}
                  className="w-8 h-8 flex items-center justify-center rounded-full border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-40"
                  disabled={quantite <= 1}
                >
                  <Minus size={13} />
                </button>
                <span className="w-8 text-center font-semibold text-lg text-gray-900 dark:text-gray-100">
                  {quantite}
                </span>
                <button
                  type="button"
                  onClick={() => setQuantite(q => q + 1)}
                  className="w-8 h-8 flex items-center justify-center rounded-full border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-40"
                  
                >
                  <Plus size={13} />
                </button>
                <span className="text-xs text-gray-400 dark:text-gray-500 ml-1">max 20</span>
              </div>
            </div>

            {/* Nom de base */}
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                {quantite > 1 ? 'Nom de base (sera numerote automatiquement)' : 'Nom du clone'}
              </label>
              <input
                type="text"
                value={nomClone}
                onChange={e => setNomClone(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              />
              {quantite > 1 && (
                <p className="text-xs text-gray-400 mt-1">
                  Ex : {nomClone} #1, {nomClone} #2, ...
                </p>
              )}
            </div>

            {/* Date de prelevement */}
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Date de prelevement</label>
              <input
                type="date"
                value={datePrelevement}
                onChange={e => setDatePrelevement(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              />
            </div>

            {/* Espace / Box cible */}
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                Ou mettre les boutures ?
              </label>
              {isLoading ? (
                <p className="text-xs text-gray-400">Chargement des espaces...</p>
              ) : (
                <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
                  {espaces.map((esp) => {
                    const key = esp.id_espace != null ? `esp-${esp.id_espace}` : `box-${esp.id_box}`
                    const isSelected = selectedEspace === esp
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setSelectedEspace(isSelected ? null : esp)}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border text-left transition-colors ${
                          isSelected
                            ? 'border-violet-500 bg-violet-50 dark:bg-violet-900/20'
                            : 'border-gray-200 dark:border-gray-700 hover:border-violet-300 dark:hover:border-violet-700'
                        }`}
                      >
                        <Home size={14} className={isSelected ? 'text-violet-600' : 'text-gray-400'} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-800 dark:text-gray-100 truncate">{esp.nom}</p>
                          {esp.culture_active ? (
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              {'Culture active : ' + esp.culture_active.nom}
                              {esp.culture_active.phase ? ' - ' + (PHASE_LABELS[esp.culture_active.phase] ?? esp.culture_active.phase) : ''}
                            </p>
                          ) : (
                            <p className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
                              <Sparkles size={10} /> Creera une culture "Boutures"
                            </p>
                          )}
                        </div>
                        {isSelected && <CheckCircle2 size={14} className="text-violet-600 flex-shrink-0" />}
                      </button>
                    )
                  })}
                  {espaces.length === 0 && (
                    <p className="text-xs text-gray-400 py-2">Aucun espace disponible</p>
                  )}
                </div>
              )}
              {!selectedEspace && (
                <p className="text-xs text-gray-400 mt-1.5 italic">
                  Si aucun espace selectionne, les clones resteront dans cette culture.
                </p>
              )}
            </div>

            {/* Notes */}
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Notes (optionnel)</label>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                rows={2}
                placeholder="Ex: bouture apicale, technique clonex..."
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 resize-none"
              />
            </div>

            {cloneMutation.isError && (
              <p className="text-xs text-red-600">Erreur lors de la creation.</p>
            )}

            <div className="flex gap-2 pt-1">
              <button
                onClick={() => cloneMutation.mutate()}
                disabled={cloneMutation.isPending || !nomClone.trim()}
                className="flex-1 py-2 bg-violet-600 text-white rounded-lg text-sm font-medium hover:bg-violet-700 disabled:opacity-50 transition-colors"
              >
                {cloneMutation.isPending
                  ? 'Creation...'
                  : quantite === 1 ? 'Creer la bouture' : `Creer ${quantite} boutures`}
              </button>
              <button
                onClick={onClose}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/40"
              >
                Annuler
              </button>
            </div>
          </div>
        ) : (
          <SuccessPanel clones={createdClones} cultureId={createdClones[0]?.id_culture_cible} onClose={onClose} />
        )}
      </div>
    </div>
  )
}

function SuccessPanel({ clones, cultureId, onClose }: { clones: CloneResult[]; cultureId: number; onClose: () => void }) {
  const qc = useQueryClient()
  const today = new Date().toISOString().slice(0, 10)
  const [dateEnracinement, setDateEnracinement] = useState(today)
  const [done, setDone] = useState(false)

  const nomCulture = clones[0]?.nom_culture_cible ?? ''

  const enracinerMutation = useMutation({
    mutationFn: async () => {
      for (const c of clones) {
        await plantAPI.enraciner(cultureId, c.id_plant, dateEnracinement)
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['culture', cultureId] })
      setDone(true)
    },
  })

  const rateMutation = useMutation({
    mutationFn: async () => {
      for (const c of clones) {
        await plantAPI.cloneRate(cultureId, c.id_plant)
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['culture', cultureId] })
      onClose()
    },
  })

  return (
    <div className="p-5 space-y-4">
      <div className="flex items-start gap-2 p-3 bg-violet-50 dark:bg-violet-900/20 rounded-xl border border-violet-200 dark:border-violet-800">
        <CheckCircle2 size={16} className="text-violet-600 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-medium text-violet-800 dark:text-violet-200">
            {clones.length === 1 ? '1 bouture creee' : `${clones.length} boutures creees`}
          </p>
          <p className="text-xs text-violet-500 mt-0.5">Placees dans : {nomCulture}</p>
          {clones.length > 1 && (
            <p className="text-xs text-violet-400 mt-0.5">
              {clones.map(c => c.nom_affichage).join(', ')}
            </p>
          )}
        </div>
      </div>

      {!done ? (
        <>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Tu peux noter l'enracinement maintenant ou plus tard depuis chaque plante.
          </p>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Date d'enracinement</label>
            <input
              type="date"
              value={dateEnracinement}
              onChange={e => setDateEnracinement(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => enracinerMutation.mutate()}
              disabled={enracinerMutation.isPending}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50"
            >
              <CheckCircle2 size={14} />
              {enracinerMutation.isPending ? '...' : clones.length === 1 ? 'Enracinee' : 'Toutes enracinees'}
            </button>
            <button
              onClick={() => rateMutation.mutate()}
              disabled={rateMutation.isPending}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 border border-red-300 text-red-600 rounded-lg text-sm hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50"
            >
              <XCircle size={14} />
              {rateMutation.isPending ? '...' : clones.length === 1 ? 'Ratee' : 'Toutes ratees'}
            </button>
          </div>
          <button onClick={onClose} className="w-full py-2 text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
            Fermer — je noterai l'enracinement plus tard
          </button>
        </>
      ) : (
        <div className="text-center py-4 space-y-3">
          <p className="text-sm text-green-700 dark:text-green-300 font-medium">
            {clones.length === 1 ? 'Bouture enracinee' : `${clones.length} boutures enracinees`}
          </p>
          <button onClick={onClose} className="px-6 py-2 bg-violet-600 text-white rounded-lg text-sm hover:bg-violet-700">
            Fermer
          </button>
        </div>
      )}
    </div>
  )
}
