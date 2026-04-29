/**
 * ArrosageModal — Gestion enrichie de l'irrigation, rempotage et récolte
 *
 * Types gérés :
 *  • arrosage_eau       — Eau pure (volume + pH optionnel)
 *  • arrosage_engrais   — Via recette engrais (calcul auto des dosages)
 *  • arrosage_tco       — Via recette TCO (pas de déduction stock)
 *  • preparation_tco    — Préparation TCO (déduction stock + date de dispo)
 *  • rempotage          — Choix d'un pot dans l'inventaire
 *  • recolte            — Coupe (envoie la plante en séchage)
 *  • debut_curing       — Fin séchage + pesée + création stock fleur
 *  • prete              — Plante prête (stock consommable)
 */
import { useState, useMemo } from 'react'
import { X, Droplets, FlaskConical, Leaf, Beaker, Flower2, Scale, RotateCcw, AlertTriangle, CheckCircle2, Trophy } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { Plant, ActionCreate, actionAPI, cultureUtilsAPI, PotItem, DernierTCO } from '../../api/cultures'
import { recetteEngraisAPI, RecetteEngrais } from '../../api/recetteEngrais'
import { recetteTCOAPI, RecetteTCO } from '../../api/recetteTCO'

// ─── Types d'action disponibles ────────────────────────────────────────────────

const TYPES = [
  { key: 'arrosage_eau',     label: 'Eau pure',          icon: Droplets,   color: 'bg-blue-50 border-blue-300 text-blue-700',     active: 'bg-blue-600 border-blue-600 text-white' },
  { key: 'arrosage_engrais', label: 'Engrais (recette)',  icon: FlaskConical, color: 'bg-green-50 border-green-300 text-green-700', active: 'bg-green-600 border-green-600 text-white' },
  { key: 'arrosage_tco',     label: 'Arrosage TCO',      icon: Beaker,     color: 'bg-amber-50 border-amber-300 text-amber-700',   active: 'bg-amber-600 border-amber-600 text-white' },
  { key: 'preparation_tco',  label: 'Préparation TCO',   icon: RotateCcw,  color: 'bg-orange-50 border-orange-300 text-orange-700', active: 'bg-orange-600 border-orange-600 text-white' },
  { key: 'rempotage',        label: 'Rempotage',         icon: Leaf,       color: 'bg-emerald-50 border-emerald-300 text-emerald-700', active: 'bg-emerald-600 border-emerald-600 text-white' },
  { key: 'recolte',          label: 'Récolte → Séchage', icon: Flower2,    color: 'bg-purple-50 border-purple-300 text-purple-700', active: 'bg-purple-600 border-purple-600 text-white' },
  { key: 'debut_curing',     label: 'Début curing + Pesée', icon: Scale,   color: 'bg-rose-50 border-rose-300 text-rose-700',      active: 'bg-rose-600 border-rose-600 text-white' },
  { key: 'prete',            label: 'Prête 🎉',          icon: Trophy,     color: 'bg-yellow-50 border-yellow-300 text-yellow-700', active: 'bg-yellow-600 border-yellow-600 text-white' },
]

// ─── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  cultureId: number
  plants: Plant[]
  initialDate: string
  onClose: () => void
  onSubmit: (data: ActionCreate) => Promise<void>
}

// ─── Composant principal ────────────────────────────────────────────────────────

export default function ArrosageModal({ cultureId, plants, initialDate, onClose, onSubmit }: Props) {
  const [dateAction, setDateAction]       = useState(initialDate)
  const [selectedType, setSelectedType]   = useState<string>('')
  // Cible — multi-select : null = "tout l'espace", sinon un Set d'IDs de plantes
  const [selectedPlantIds, setSelectedPlantIds] = useState<Set<number> | null>(null) // null = global
  // Pour récolte / debut_curing / prete : une seule plante obligatoire
  const [recolteTargetId, setRecolteTargetId] = useState<number | ''>('')
  const [note, setNote]                   = useState('')
  const [loading, setLoading]             = useState(false)
  const [error, setError]                 = useState('')

  // Raccourcis lisibilité
  const targetGlobal = selectedPlantIds === null

  // ── Champs spécifiques ─────────────────────────────────────────────────────
  const [volumeL, setVolumeL]             = useState<number | ''>('')
  const [phEau, setPhEau]                 = useState<number | ''>('')
  const [idRecetteEngrais, setIdRecetteEngrais] = useState<number | ''>('')
  const [idRecetteTCO, setIdRecetteTCO]   = useState<number | ''>('')
  const [idPot, setIdPot]                 = useState<number | ''>('')
  const [volumePotOverride, setVolumePotOverride] = useState<number | ''>('')
  const [poidsG, setPoidsG]               = useState<number | ''>('')

  // ── Données distantes ─────────────────────────────────────────────────────
  const { data: recettesEngrais = [] } = useQuery<RecetteEngrais[]>({
    queryKey: ['recettes-engrais'],
    queryFn: async () => (await recetteEngraisAPI.getAll()).data,
  })

  const { data: recettesTCO = [] } = useQuery<RecetteTCO[]>({
    queryKey: ['recettes-tco'],
    queryFn: async () => (await recetteTCOAPI.getAll()).data,
  })

  const { data: pots = [] } = useQuery<PotItem[]>({
    queryKey: ['pots'],
    queryFn: async () => (await cultureUtilsAPI.getPots()).data,
  })

  const { data: dernierTCO } = useQuery<DernierTCO>({
    queryKey: ['dernier-tco', cultureId],
    queryFn: async () => (await actionAPI.getDernierTCO(cultureId)).data,
    enabled: selectedType === 'arrosage_tco',
  })

  // ── Recettes sélectionnées ─────────────────────────────────────────────────
  const recetteEngraisSelected = useMemo(
    () => recettesEngrais.find(r => r.id_recette === idRecetteEngrais),
    [recettesEngrais, idRecetteEngrais]
  )

  const recetteTCOSelected = useMemo(
    () => recettesTCO.find(r => r.id_recette_tco === idRecetteTCO),
    [recettesTCO, idRecetteTCO]
  )

  const potSelected = useMemo(
    () => pots.find(p => p.id_pot === idPot),
    [pots, idPot]
  )

  // ── Calcul des dosages engrais ────────────────────────────────────────────
  const dosagesCalcules = useMemo(() => {
    if (!recetteEngraisSelected || !volumeL) return []
    return recetteEngraisSelected.lignes.map(l => ({
      nom: l.nom_produit || `Produit #${l.id_produit}`,
      dosage: l.dosage,
      unite: l.unite || 'mL/L',
      quantite: Math.round(l.dosage * Number(volumeL) * 100) / 100,
    }))
  }, [recetteEngraisSelected, volumeL])

  // ── Dosages TCO ─────────────────────────────────────────────────────────
  const dosagesTCO = useMemo(() => {
    if (!recetteTCOSelected || !volumeL || !recetteTCOSelected.quantite_tco) return []
    const scale = Number(volumeL) / recetteTCOSelected.quantite_tco
    return recetteTCOSelected.lignes.map(l => ({
      nom: l.nom_produit || `Produit #${l.id_produit}`,
      quantite: Math.round(l.quantite * scale * 100) / 100,
      unite: l.unite || '',
    }))
  }, [recetteTCOSelected, volumeL])

  // ── Date disponibilité TCO ─────────────────────────────────────────────────
  const datePretTCO = useMemo(() => {
    if (!recetteTCOSelected?.duree_oxygenation_h || !dateAction) return null
    const d = new Date(dateAction + 'T00:00:00')
    d.setHours(d.getHours() + recetteTCOSelected.duree_oxygenation_h)
    return d
  }, [recetteTCOSelected, dateAction])

  // ── Plantes actives / en séchage / en curing ─────────────────────────────
  const plantesActives = plants.filter(p => !['sechage', 'recolte', 'curing', 'prete', 'abandonne'].includes(p.statut || ''))
  const plantesSechage = plants.filter(p => p.statut === 'sechage')
  const plantesCuring  = plants.filter(p => p.statut === 'curing')

  // ── Volume par plante ─────────────────────────────────────────────────────
  const nbPlantsSelected = useMemo(() => {
    if (targetGlobal) return plantesActives.length
    return selectedPlantIds?.size ?? 0
  }, [targetGlobal, plantesActives.length, selectedPlantIds])

  function formatVolume(liters: number): string {
    if (liters < 1) return `${Math.round(liters * 1000)} mL`
    return `${Math.round(liters * 100) / 100} L`
  }

  const volumeParPlante = useMemo(() => {
    if (!volumeL || nbPlantsSelected <= 0) return null
    return Math.round((Number(volumeL) / nbPlantsSelected) * 10000) / 10000
  }, [volumeL, nbPlantsSelected])

  // Dosages par plante (pour la soumission des actions individuelles)
  const dosagesParPlante = useMemo(() => {
    if (!recetteEngraisSelected || !volumeParPlante) return []
    return recetteEngraisSelected.lignes.map(l => ({
      nom: l.nom_produit || `Produit #${l.id_produit}`,
      dosage: l.dosage,
      unite: l.unite || 'mL/L',
      quantite: Math.round(l.dosage * volumeParPlante * 100) / 100,
    }))
  }, [recetteEngraisSelected, volumeParPlante])

  // ── Toggle plante dans la sélection ──────────────────────────────────────
  function togglePlant(id: number) {
    setSelectedPlantIds(prev => {
      const next = new Set(prev ?? [])
      if (next.has(id)) next.delete(id); else next.add(id)
      return next.size === 0 ? null : next // si tout décoché → revenir à global
    })
  }

  // ── Changement de type → reset champs ────────────────────────────────────
  function handleSelectType(key: string) {
    setSelectedType(key)
    setError('')
    // Récolte / fin séchage → on garde l'état multi mais on n'en a pas besoin (dropdown séparé)
    // Préparation TCO → forcer global
    if (key === 'preparation_tco') setSelectedPlantIds(null)
  }

  // ── Validation ─────────────────────────────────────────────────────────────
  function isValid() {
    if (!selectedType) return false
    if (selectedType === 'arrosage_eau' && !volumeL) return false
    if (selectedType === 'arrosage_engrais' && (!idRecetteEngrais || !volumeL)) return false
    if (selectedType === 'arrosage_tco' && !idRecetteTCO) return false
    if (selectedType === 'preparation_tco' && (!idRecetteTCO || !volumeL)) return false
    if (['recolte', 'debut_curing', 'prete'].includes(selectedType) && !recolteTargetId) return false
    // Pour les types "normaux" : soit global, soit au moins une plante sélectionnée
    if (!['recolte', 'debut_curing', 'prete'].includes(selectedType) && !targetGlobal && (!selectedPlantIds || selectedPlantIds.size === 0)) return false
    return true
  }

  // ── Soumission ─────────────────────────────────────────────────────────────
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!isValid()) return
    setLoading(true)
    setError('')

    let parametres: Record<string, unknown> = {}

    // Pour les arrosages : volume_l = total (pour une action globale)
    // ou volume_l = par plante (pour des actions individuelles)
    // On stocke toujours nb_plantes et volume_par_plante_l pour l'affichage
    const volTotal = volumeL ? Number(volumeL) : 0
    const volParPlante = volumeParPlante ?? volTotal

    if (selectedType === 'arrosage_eau') {
      parametres = {
        volume_l: volTotal,
        nb_plantes: nbPlantsSelected || undefined,
        volume_par_plante_l: nbPlantsSelected > 0 ? volParPlante : undefined,
      }
      if (phEau) parametres.ph_eau = Number(phEau)
    } else if (selectedType === 'arrosage_engrais') {
      const recette = recettesEngrais.find(r => r.id_recette === idRecetteEngrais)
      parametres = {
        volume_l: volTotal,
        nb_plantes: nbPlantsSelected || undefined,
        volume_par_plante_l: nbPlantsSelected > 0 ? volParPlante : undefined,
        id_recette: Number(idRecetteEngrais),
        nom_recette: recette?.nom_recette,
        ph_cible: recette?.ph_cible,
        produits_calcules: dosagesCalcules,
      }
    } else if (selectedType === 'arrosage_tco') {
      const recette = recettesTCO.find(r => r.id_recette_tco === idRecetteTCO)
      parametres = {
        volume_l: volumeL ? volTotal : undefined,
        nb_plantes: nbPlantsSelected || undefined,
        volume_par_plante_l: (volumeL && nbPlantsSelected > 0) ? volParPlante : undefined,
        id_recette_tco: Number(idRecetteTCO),
        nom_recette: recette?.nom_recette,
      }
    } else if (selectedType === 'preparation_tco') {
      const recette = recettesTCO.find(r => r.id_recette_tco === idRecetteTCO)
      parametres = {
        volume_l: Number(volumeL),
        id_recette_tco: Number(idRecetteTCO),
        nom_recette: recette?.nom_recette,
        produits_consommes: dosagesTCO,
        date_pret: datePretTCO ? datePretTCO.toISOString() : undefined,
        duree_oxygenation_h: recette?.duree_oxygenation_h,
      }
    } else if (selectedType === 'rempotage') {
      const pot = pots.find(p => p.id_pot === idPot)
      const volFinal = volumePotOverride ? Number(volumePotOverride) : pot?.taille_pot
      parametres = {
        id_materiel_pot: idPot ? Number(idPot) : undefined,
        nom_pot: pot?.dimension_pot,
        volume_pot_l: volFinal,
      }
    } else if (selectedType === 'recolte') {
      parametres = {}
    } else if (selectedType === 'debut_curing') {
      if (poidsG) parametres = { poids_g: Number(poidsG) }
    } else if (selectedType === 'prete') {
      parametres = {}
    }

    const params = Object.keys(parametres).length > 0 ? parametres : undefined

    // Pour les arrosages en mode individuel (par plante) :
    // chaque action reçoit volume_l = volume par plante, pas le total
    const isArrosageType = ['arrosage_eau', 'arrosage_engrais', 'arrosage_tco'].includes(selectedType)
    let paramsParPlante = params
    if (isArrosageType && !targetGlobal && volumeParPlante && parametres) {
      paramsParPlante = {
        ...parametres,
        volume_l: volParPlante,
        volume_total_l: volTotal,
        // Pour engrais : utiliser les dosages calculés pour 1 plante
        ...(selectedType === 'arrosage_engrais' ? { produits_calcules: dosagesParPlante } : {}),
      }
    }

    try {
      if (['recolte', 'debut_curing', 'prete'].includes(selectedType)) {
        // Toujours une seule plante spécifique
        await onSubmit({
          id_plant: recolteTargetId as number,
          date_action: dateAction,
          type_action: selectedType,
          parametres: params,
          note: note || undefined,
          global_culture: false,
        })
      } else if (targetGlobal) {
        // Action globale unique — volume_l = total, volume_par_plante_l stocké dans params
        await onSubmit({
          id_plant: undefined,
          date_action: dateAction,
          type_action: selectedType,
          parametres: params,
          note: note || undefined,
          global_culture: true,
        })
      } else {
        // Une action par plante sélectionnée — volume_l = par plante
        await Promise.all(Array.from(selectedPlantIds!).map(pid =>
          onSubmit({
            id_plant: pid,
            date_action: dateAction,
            type_action: selectedType,
            parametres: paramsParPlante,
            note: note || undefined,
            global_culture: false,
          })
        ))
      }
      onClose()
    } catch (err: any) {
      const detail = err?.response?.data?.detail
      setError(typeof detail === 'string' ? detail : err?.message ?? 'Erreur lors de la sauvegarde')
    } finally {
      setLoading(false)
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[92vh] overflow-y-auto">

        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b sticky top-0 bg-white z-10">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
              <Droplets size={16} className="text-blue-600" />
            </div>
            <h2 className="text-lg font-bold text-gray-900">Arrosage & Récolte</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">

          {/* Date */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Date</label>
            <input type="date" value={dateAction} onChange={e => setDateAction(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
          </div>

          {/* Cible */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">
              Cible
              {!targetGlobal && selectedPlantIds && selectedPlantIds.size > 0 && (
                <span className="ml-1.5 text-blue-600 font-normal">
                  ({selectedPlantIds.size} plante{selectedPlantIds.size > 1 ? 's' : ''} sélectionnée{selectedPlantIds.size > 1 ? 's' : ''})
                </span>
              )}
            </label>

            {/* Récolte / debut_curing / prete : dropdown single plante */}
            {['recolte', 'debut_curing', 'prete'].includes(selectedType) ? (
              <select
                value={recolteTargetId}
                onChange={e => setRecolteTargetId(Number(e.target.value) || '')}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Choisir une plante…</option>
                {(selectedType === 'debut_curing' ? plantesSechage
                  : selectedType === 'prete' ? plantesCuring
                  : plantesActives
                ).map(p => (
                  <option key={p.id_plant} value={p.id_plant}>{p.nom_affichage}</option>
                ))}
              </select>

            ) : selectedType === 'preparation_tco' ? (
              /* Préparation TCO : toujours global */
              <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-600">
                🌿 Tout l'espace
              </div>

            ) : (
              /* Autres types : pills multi-select */
              <div className="flex flex-wrap gap-1.5">
                {/* Pill "Tout l'espace" */}
                <button
                  type="button"
                  onClick={() => setSelectedPlantIds(null)}
                  className={`flex items-center gap-1 px-3 py-1.5 rounded-full border text-xs font-medium transition-colors
                    ${targetGlobal
                      ? 'bg-blue-600 border-blue-600 text-white'
                      : 'bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100'}`}
                >
                  🌿 Tout l'espace
                </button>

                {/* Pills individuelles par plante */}
                {plantesActives.map(p => {
                  const selected = !targetGlobal && (selectedPlantIds?.has(p.id_plant) ?? false)
                  return (
                    <button
                      key={p.id_plant}
                      type="button"
                      onClick={() => togglePlant(p.id_plant)}
                      className={`flex items-center gap-1 px-3 py-1.5 rounded-full border text-xs font-medium transition-colors
                        ${selected
                          ? 'bg-grow-600 border-grow-600 text-white'
                          : 'bg-gray-50 border-gray-300 text-gray-600 hover:bg-gray-100'}`}
                    >
                      {selected ? '✓ ' : ''}{p.nom_affichage}
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {/* Sélection du type */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-2">Type d'action <span className="text-red-500">*</span></label>
            <div className="grid grid-cols-2 gap-2">
              {TYPES.map(t => {
                const Icon = t.icon
                const isActive = selectedType === t.key
                return (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() => handleSelectType(t.key)}
                    className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border text-sm font-medium transition-all
                      ${isActive ? t.active : t.color} hover:opacity-90`}
                  >
                    <Icon size={15} className="flex-shrink-0" />
                    <span className="text-left leading-tight">{t.label}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* ── Formulaires spécifiques ────────────────────────────────────── */}

          {/* Eau pure */}
          {selectedType === 'arrosage_eau' && (
            <div className="space-y-3 p-3 bg-blue-50 rounded-lg border border-blue-100">
              <p className="text-xs font-semibold text-blue-700">💧 Arrosage Eau pure</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Volume total <span className="text-red-500">*</span></label>
                  <div className="flex items-center gap-1.5">
                    <input type="number" value={volumeL} onChange={e => setVolumeL(Number(e.target.value) || '')}
                      min={0} step={0.1} placeholder="ex: 5"
                      className="flex-1 px-2.5 py-1.5 border border-gray-300 rounded text-sm" />
                    <span className="text-xs text-gray-500 whitespace-nowrap">L</span>
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">pH eau <span className="text-gray-400">(opt.)</span></label>
                  <div className="flex items-center gap-1.5">
                    <input type="number" value={phEau} onChange={e => setPhEau(Number(e.target.value) || '')}
                      min={0} max={14} step={0.1} placeholder="ex: 6.3"
                      className="flex-1 px-2.5 py-1.5 border border-gray-300 rounded text-sm" />
                    <span className="text-xs text-gray-500">pH</span>
                  </div>
                </div>
              </div>
              {volumeParPlante !== null && nbPlantsSelected > 0 && (
                <p className="text-xs text-blue-700 font-medium flex items-center gap-1">
                  🪴 <strong>{formatVolume(volumeParPlante)}</strong> par plante
                  <span className="text-blue-500 font-normal">({nbPlantsSelected} plante{nbPlantsSelected > 1 ? 's' : ''})</span>
                </p>
              )}
            </div>
          )}

          {/* Arrosage Engrais via Recette */}
          {selectedType === 'arrosage_engrais' && (
            <div className="space-y-3 p-3 bg-green-50 rounded-lg border border-green-100">
              <p className="text-xs font-semibold text-green-700">🧪 Arrosage Engrais — via recette</p>

              <div>
                <label className="block text-xs text-gray-600 mb-1">Recette <span className="text-red-500">*</span></label>
                <select value={idRecetteEngrais} onChange={e => setIdRecetteEngrais(Number(e.target.value) || '')}
                  className="w-full px-2.5 py-1.5 border border-gray-300 rounded text-sm">
                  <option value="">Choisir une recette…</option>
                  {recettesEngrais.map(r => (
                    <option key={r.id_recette} value={r.id_recette}>
                      {r.nom_recette}{r.periode ? ` — ${r.periode}` : ''}{r.semaine ? ` S${r.semaine}` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs text-gray-600 mb-1">Volume total à arroser <span className="text-red-500">*</span></label>
                <div className="flex items-center gap-1.5">
                  <input type="number" value={volumeL} onChange={e => setVolumeL(Number(e.target.value) || '')}
                    min={0} step={0.5} placeholder="ex: 10"
                    className="flex-1 px-2.5 py-1.5 border border-gray-300 rounded text-sm" />
                  <span className="text-xs text-gray-500">L</span>
                </div>
                {volumeParPlante !== null && nbPlantsSelected > 0 && (
                  <p className="text-xs text-green-700 font-medium flex items-center gap-1 mt-1.5">
                    🪴 <strong>{formatVolume(volumeParPlante)}</strong> par plante
                    <span className="text-green-600 font-normal">({nbPlantsSelected} plante{nbPlantsSelected > 1 ? 's' : ''})</span>
                  </p>
                )}
              </div>

              {/* pH cible depuis la recette */}
              {recetteEngraisSelected?.ph_cible && (
                <p className="text-xs text-blue-600 flex items-center gap-1">
                  <span>💧</span> pH cible recette : <strong>{recetteEngraisSelected.ph_cible}</strong>
                </p>
              )}

              {/* Tableau des dosages calculés */}
              {dosagesCalcules.length > 0 && (
                <div className="rounded border border-green-200 overflow-hidden">
                  <div className="bg-green-100 px-2 py-1 text-xs font-semibold text-green-800">
                    Quantités calculées pour {volumeL} L
                  </div>
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-white border-b border-green-100">
                        <th className="text-left px-2 py-1 text-gray-500">Produit</th>
                        <th className="text-right px-2 py-1 text-gray-500">Dosage</th>
                        <th className="text-right px-2 py-1 text-gray-500 font-bold text-green-700">Qté totale</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dosagesCalcules.map((d, i) => (
                        <tr key={i} className="border-b border-green-50 last:border-0">
                          <td className="px-2 py-1 font-medium">{d.nom}</td>
                          <td className="px-2 py-1 text-right text-gray-500">{d.dosage} {d.unite}</td>
                          <td className="px-2 py-1 text-right font-bold text-green-700">{d.quantite} {d.unite.replace('/L', '')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <p className="text-[10px] text-gray-400 px-2 py-1 bg-green-50">
                    ✅ Ces quantités seront déduites du stock
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Arrosage TCO */}
          {selectedType === 'arrosage_tco' && (
            <div className="space-y-3 p-3 bg-amber-50 rounded-lg border border-amber-100">
              <p className="text-xs font-semibold text-amber-700">🍵 Arrosage TCO</p>

              {/* Statut dernière préparation */}
              {dernierTCO && (
                dernierTCO.found ? (
                  <div className={`flex items-start gap-2 p-2 rounded text-xs border
                    ${dernierTCO.is_ready
                      ? 'bg-green-50 border-green-200 text-green-700'
                      : 'bg-orange-50 border-orange-200 text-orange-700'}`}>
                    {dernierTCO.is_ready
                      ? <CheckCircle2 size={14} className="mt-0.5 flex-shrink-0" />
                      : <AlertTriangle size={14} className="mt-0.5 flex-shrink-0" />}
                    <span>
                      {dernierTCO.is_ready
                        ? `✅ TCO "${dernierTCO.nom_recette || ''}" prêt à l'emploi`
                        : `⏳ TCO en oxygénation — disponible le ${
                            dernierTCO.date_pret
                              ? new Date(dernierTCO.date_pret).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
                              : '—'
                          }`}
                    </span>
                  </div>
                ) : (
                  <div className="flex items-start gap-2 p-2 rounded text-xs bg-orange-50 border border-orange-200 text-orange-700">
                    <AlertTriangle size={14} className="mt-0.5 flex-shrink-0" />
                    <span>Aucune préparation TCO trouvée — pense à créer une Préparation TCO d'abord.</span>
                  </div>
                )
              )}

              <div>
                <label className="block text-xs text-gray-600 mb-1">Recette TCO <span className="text-red-500">*</span></label>
                <select value={idRecetteTCO} onChange={e => setIdRecetteTCO(Number(e.target.value) || '')}
                  className="w-full px-2.5 py-1.5 border border-gray-300 rounded text-sm">
                  <option value="">Choisir une recette…</option>
                  {recettesTCO.map(r => (
                    <option key={r.id_recette_tco} value={r.id_recette_tco}>
                      {r.nom_recette}{r.type_tco ? ` — ${r.type_tco}` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs text-gray-600 mb-1">Volume utilisé <span className="text-gray-400">(opt.)</span></label>
                <div className="flex items-center gap-1.5">
                  <input type="number" value={volumeL} onChange={e => setVolumeL(Number(e.target.value) || '')}
                    min={0} step={0.5} placeholder="ex: 5"
                    className="flex-1 px-2.5 py-1.5 border border-gray-300 rounded text-sm" />
                  <span className="text-xs text-gray-500">L</span>
                </div>
                {volumeParPlante !== null && nbPlantsSelected > 0 && (
                  <p className="text-xs text-amber-700 font-medium flex items-center gap-1 mt-1.5">
                    🪴 <strong>{formatVolume(volumeParPlante)}</strong> par plante
                    <span className="text-amber-600 font-normal">({nbPlantsSelected} plante{nbPlantsSelected > 1 ? 's' : ''})</span>
                  </p>
                )}
              </div>
              <p className="text-[10px] text-gray-400">ℹ️ Le stock des amendements n'est pas modifié (déjà déduit lors de la préparation).</p>
            </div>
          )}

          {/* Préparation TCO */}
          {selectedType === 'preparation_tco' && (
            <div className="space-y-3 p-3 bg-orange-50 rounded-lg border border-orange-100">
              <p className="text-xs font-semibold text-orange-700">🫧 Préparation TCO</p>

              <div>
                <label className="block text-xs text-gray-600 mb-1">Recette TCO <span className="text-red-500">*</span></label>
                <select value={idRecetteTCO} onChange={e => { setIdRecetteTCO(Number(e.target.value) || ''); setVolumeL('') }}
                  className="w-full px-2.5 py-1.5 border border-gray-300 rounded text-sm">
                  <option value="">Choisir une recette…</option>
                  {recettesTCO.map(r => (
                    <option key={r.id_recette_tco} value={r.id_recette_tco}>
                      {r.nom_recette}
                      {r.quantite_tco ? ` (recette: ${r.quantite_tco}${r.unite_tco || 'L'})` : ''}
                      {r.duree_oxygenation_h ? ` — ${r.duree_oxygenation_h}h oxyg.` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {recetteTCOSelected && (
                <>
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">Volume à préparer <span className="text-red-500">*</span></label>
                    <div className="flex items-center gap-1.5">
                      <input type="number" value={volumeL} onChange={e => setVolumeL(Number(e.target.value) || '')}
                        min={0} step={0.5}
                        placeholder={`ex: ${recetteTCOSelected.quantite_tco || '10'}`}
                        className="flex-1 px-2.5 py-1.5 border border-gray-300 rounded text-sm" />
                      <span className="text-xs text-gray-500">L</span>
                    </div>
                  </div>

                  {/* Info oxygenation */}
                  {recetteTCOSelected.duree_oxygenation_h && datePretTCO && (
                    <div className="flex items-start gap-2 p-2 rounded text-xs bg-blue-50 border border-blue-200 text-blue-700">
                      <AlertTriangle size={13} className="mt-0.5 flex-shrink-0" />
                      <span>
                        Oxygénation : <strong>{recetteTCOSelected.duree_oxygenation_h}h</strong> —
                        Disponible à partir du{' '}
                        <strong>
                          {datePretTCO.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}
                        </strong>
                      </span>
                    </div>
                  )}

                  {/* Tableau ingrédients */}
                  {dosagesTCO.length > 0 && volumeL && (
                    <div className="rounded border border-orange-200 overflow-hidden">
                      <div className="bg-orange-100 px-2 py-1 text-xs font-semibold text-orange-800">
                        Ingrédients pour {volumeL} L (recette: {recetteTCOSelected.quantite_tco}{recetteTCOSelected.unite_tco || 'L'})
                      </div>
                      <table className="w-full text-xs">
                        <tbody>
                          {dosagesTCO.map((d, i) => (
                            <tr key={i} className="border-b border-orange-50 last:border-0">
                              <td className="px-2 py-1.5 font-medium">{d.nom}</td>
                              <td className="px-2 py-1.5 text-right font-bold text-orange-700">{d.quantite} {d.unite}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      <p className="text-[10px] text-gray-400 px-2 py-1 bg-orange-50">
                        ✅ Ces amendements seront déduits du stock
                      </p>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* Rempotage */}
          {selectedType === 'rempotage' && (
            <div className="space-y-3 p-3 bg-emerald-50 rounded-lg border border-emerald-100">
              <p className="text-xs font-semibold text-emerald-700">🪴 Rempotage</p>

              <div>
                <label className="block text-xs text-gray-600 mb-1">Pot (inventaire)</label>
                {pots.length === 0 ? (
                  <p className="text-xs text-gray-400 italic">Aucun pot en inventaire — tu peux quand même saisir le volume manuellement.</p>
                ) : (
                  <select value={idPot} onChange={e => {
                    const newId = Number(e.target.value) || ''
                    setIdPot(newId)
                    // Auto-remplir le volume depuis le pot sélectionné
                    if (newId) {
                      const pot = pots.find(p => p.id_pot === newId)
                      if (pot?.taille_pot) setVolumePotOverride(pot.taille_pot)
                    }
                  }}
                    className="w-full px-2.5 py-1.5 border border-gray-300 rounded text-sm">
                    <option value="">Non sélectionné (saisie manuelle)</option>
                    {pots.map(p => (
                      <option key={p.id_pot} value={p.id_pot}>
                        {p.dimension_pot || ''}{p.taille_pot ? ` — ${p.taille_pot} L` : ''}{p.etat ? ` (${p.etat})` : ''}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div>
                <label className="block text-xs text-gray-600 mb-1">
                  Volume du pot <span className="text-gray-400">{potSelected?.taille_pot ? `(auto: ${potSelected.taille_pot} L)` : ''}</span>
                </label>
                <div className="flex items-center gap-1.5">
                  <input type="number" value={volumePotOverride}
                    onChange={e => setVolumePotOverride(Number(e.target.value) || '')}
                    min={0} step={0.5} placeholder="ex: 15"
                    className="flex-1 px-2.5 py-1.5 border border-gray-300 rounded text-sm" />
                  <span className="text-xs text-gray-500">L</span>
                </div>
              </div>
            </div>
          )}

          {/* Récolte */}
          {selectedType === 'recolte' && (
            <div className="p-3 bg-purple-50 rounded-lg border border-purple-100">
              <p className="text-xs font-semibold text-purple-700 mb-2">🌾 Récolte → Séchage</p>
              <div className="flex items-start gap-2 p-2 rounded text-xs bg-purple-100 border border-purple-200 text-purple-800">
                <Flower2 size={14} className="mt-0.5 flex-shrink-0" />
                <span>
                  La plante passe en mode <strong>séchage</strong>. Le poids sec et le début du curing
                  seront enregistrés via l'action <em>Début curing</em>.
                </span>
              </div>
              {!recolteTargetId && (
                <p className="text-xs text-red-500 mt-2">⚠️ Sélectionne une plante spécifique ci-dessus.</p>
              )}
            </div>
          )}

          {/* Début curing + Pesée */}
          {selectedType === 'debut_curing' && (
            <div className="space-y-3 p-3 bg-rose-50 rounded-lg border border-rose-100">
              <p className="text-xs font-semibold text-rose-700">🏺 Début curing — Pesée finale</p>
              {plantesSechage.length === 0 && (
                <p className="text-xs text-gray-400 italic">Aucune plante en séchage actuellement.</p>
              )}
              <div>
                <label className="block text-xs text-gray-600 mb-1">Poids sec récolté <span className="text-gray-400">(optionnel)</span></label>
                <div className="flex items-center gap-1.5">
                  <input type="number" value={poidsG} onChange={e => setPoidsG(Number(e.target.value) || '')}
                    min={0} step={0.1} placeholder="ex: 45.5"
                    className="flex-1 px-2.5 py-1.5 border border-gray-300 rounded text-sm" />
                  <span className="text-xs text-gray-500">g</span>
                </div>
              </div>
              <div className="flex items-start gap-2 p-2 rounded text-xs bg-rose-100 border border-rose-200 text-rose-800">
                <Scale size={13} className="mt-0.5 flex-shrink-0" />
                <span>Le poids sera enregistré sur la plante et une entrée <strong>stock fleur</strong> sera créée automatiquement.</span>
              </div>
              {!recolteTargetId && (
                <p className="text-xs text-red-500">⚠️ Sélectionne la plante en cours de séchage ci-dessus.</p>
              )}
            </div>
          )}

          {/* Prête */}
          {selectedType === 'prete' && (
            <div className="p-3 bg-yellow-50 rounded-lg border border-yellow-100">
              <p className="text-xs font-semibold text-yellow-700 mb-2">✅ Prête — Stock consommable</p>
              {plantesCuring.length === 0 && (
                <p className="text-xs text-gray-400 italic">Aucune plante en curing actuellement.</p>
              )}
              <div className="flex items-start gap-2 p-2 rounded text-xs bg-yellow-100 border border-yellow-200 text-yellow-800">
                <CheckCircle2 size={13} className="mt-0.5 flex-shrink-0" />
                <span>La plante est déclarée <strong>prête à la consommation</strong>.</span>
              </div>
              {!recolteTargetId && (
                <p className="text-xs text-red-500 mt-2">⚠️ Sélectionne une plante spécifique ci-dessus.</p>
              )}
            </div>
          )}

          {/* Note */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Note (optionnelle)</label>
            <textarea value={note} onChange={e => setNote(e.target.value)} rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm resize-none"
              placeholder="Observations, pH mesuré, conditions…" />
          </div>

          {/* Erreur */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              <p className="text-xs text-red-700">⚠️ {error}</p>
            </div>
          )}

          {/* Boutons */}
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 text-sm">
              Annuler
            </button>
            <button type="submit" disabled={loading || !isValid()}
              className="flex-1 px-4 py-2 bg-grow-600 text-white rounded-lg hover:bg-grow-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm flex items-center justify-center gap-2">
              {loading ? 'Enregistrement…' : '✅ Valider'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
