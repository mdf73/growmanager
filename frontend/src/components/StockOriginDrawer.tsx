/**
 * StockOriginDrawer — Traçabilité complète d'un stock
 *
 * Affiche pour une entrée de stock :
 *  - La variété (génétique, breeder, floraison)
 *  - Le bocal associé (si présent)
 *  - Toutes les cultures qui ont cultivé cette variété
 *    → chaque plante avec : graine, type, breeder, dates séchage/curing, poids
 *
 * Utilisation :
 *   <StockOriginDrawer stockId={12} onClose={() => setOpen(false)} />
 */

import { useQuery } from '@tanstack/react-query'
import { X, Dna, Leaf, Archive, Scale, Calendar, Package, GitBranch } from 'lucide-react'
import { stockAPI } from '../api/stock'
import type { PlantOrigine, CultureSource } from '../api/stock'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(d?: string | null): string {
  if (!d) return '—'
  return new Date(d + 'T12:00').toLocaleDateString('fr-FR', {
    day: 'numeric', month: 'short', year: 'numeric',
  })
}

function dureeJours(a?: string | null, b?: string | null): string {
  if (!a || !b) return ''
  const diff = Math.round(
    (new Date(b).getTime() - new Date(a).getTime()) / 86_400_000
  )
  return diff > 0 ? `${diff} j` : ''
}

function typeGraineColor(t?: string | null) {
  if (!t) return 'bg-gray-100 text-gray-600'
  if (t === 'Féminisée') return 'bg-pink-100 text-pink-700'
  if (t === 'Auto')      return 'bg-purple-100 text-purple-700'
  return 'bg-gray-100 text-gray-600'
}

function statutCultureBadge(s?: string | null) {
  if (s === 'active')          return 'bg-green-100 text-green-700'
  if (s === 'sechage_curing')  return 'bg-amber-100 text-amber-700'
  if (s === 'terminee')        return 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400'
  return 'bg-gray-100 text-gray-500'
}

function statutLabel(s?: string | null) {
  if (s === 'active')         return 'Active'
  if (s === 'sechage_curing') return 'Séchage/Curing'
  if (s === 'terminee')       return 'Terminée'
  return s ?? '—'
}

// ─── Carte plante ─────────────────────────────────────────────────────────────

function PlantCard({ plant }: { plant: PlantOrigine }) {
  const g = plant.graine
  const hasSechage = plant.sechage_date_debut
  const hasCuring  = plant.curing_date_debut

  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-3 space-y-2 text-sm">
      {/* En-tête plante */}
      <div className="flex items-center gap-2">
        <Leaf className="w-4 h-4 text-green-500 shrink-0" />
        <span className="font-semibold text-gray-800 dark:text-gray-200 flex-1">{plant.nom_affichage}</span>
        {plant.poids_final_curing_g != null && (
          <span className="text-green-700 dark:text-green-400 text-xs font-medium">
            {plant.poids_final_curing_g.toFixed(1)} g final
          </span>
        )}
        {plant.poids_recolte_g != null && plant.poids_final_curing_g == null && (
          <span className="text-gray-500 dark:text-gray-400 text-xs">
            {plant.poids_recolte_g.toFixed(1)} g récolte
          </span>
        )}
      </div>

      {/* Graine */}
      {g ? (
        <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300">
          <Dna className="w-3.5 h-3.5 text-violet-400 shrink-0" />
          {g.breeder && <span className="text-gray-400">{g.breeder.nom_breeder}</span>}
          {g.types_graines && (
            <span className={`px-1.5 py-0.5 rounded-full ${typeGraineColor(g.types_graines)}`}>
              {g.types_graines}
            </span>
          )}
        </div>
      ) : (
        <div className="flex items-center gap-2 text-xs text-gray-400">
          <Dna className="w-3.5 h-3.5 shrink-0" />
          Bouture / clone (pas de graine)
        </div>
      )}

      {/* Timeline compacte : récolte → séchage → curing */}
      <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-gray-400 dark:text-gray-500 pt-1 border-t border-gray-100 dark:border-gray-700">
        {plant.date_recolte && (
          <span><Calendar className="w-3 h-3 inline mr-0.5" />Récolte {fmt(plant.date_recolte)}</span>
        )}
        {hasSechage && (
          <span>
            🌬️ Séchage {fmt(plant.sechage_date_debut)}
            {plant.sechage_date_fin && ` → ${fmt(plant.sechage_date_fin)}`}
            {plant.sechage_date_debut && plant.sechage_date_fin && (
              <span className="ml-1 text-gray-300">({dureeJours(plant.sechage_date_debut, plant.sechage_date_fin)})</span>
            )}
          </span>
        )}
        {hasCuring && (
          <span>
            🏺 Curing {fmt(plant.curing_date_debut)}
            {plant.poids_debut_curing_g != null && (
              <span className="ml-1"><Scale className="w-3 h-3 inline" /> {plant.poids_debut_curing_g.toFixed(1)} g</span>
            )}
          </span>
        )}
      </div>
    </div>
  )
}

// ─── Carte culture ────────────────────────────────────────────────────────────

function CultureCard({ culture }: { culture: CultureSource }) {
  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 space-y-3">
      {/* Header culture */}
      <div className="flex items-start gap-2">
        <Archive className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-gray-800 dark:text-gray-200">{culture.nom}</span>
            <span className={`text-xs px-2 py-0.5 rounded-full ${statutCultureBadge(culture.statut)}`}>
              {statutLabel(culture.statut)}
            </span>
          </div>
          <div className="text-xs text-gray-400 dark:text-gray-500 mt-0.5 space-x-2">
            {culture.date_debut && <span>Début : {fmt(culture.date_debut)}</span>}
            {culture.date_passage_12_12 && <span>· 12/12 : {fmt(culture.date_passage_12_12)}</span>}
            {culture.date_debut_floraison && <span>· Flo : {fmt(culture.date_debut_floraison)}</span>}
          </div>
        </div>
        <span className="text-xs text-gray-300 dark:text-gray-600 shrink-0">
          {culture.plants.length} plante{culture.plants.length > 1 ? 's' : ''}
        </span>
      </div>

      {/* Plantes */}
      <div className="space-y-2">
        {culture.plants.map(p => (
          <PlantCard key={p.id_plant} plant={p} />
        ))}
      </div>
    </div>
  )
}

// ─── Drawer principal ─────────────────────────────────────────────────────────

interface Props {
  stockId: number
  onClose: () => void
}

export default function StockOriginDrawer({ stockId, onClose }: Props) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['stock-origine', stockId],
    queryFn: () => stockAPI.origine(stockId).then(r => r.data),
    enabled: stockId > 0,
  })

  const totalPlants = data?.cultures_source.reduce((acc, c) => acc + c.plants.length, 0) ?? 0

  // ── Rendu du bocal ──────────────────────────────────────────────────────────
  const bocalLabel = (() => {
    if (!data?.bocal) return null
    const { nom, volume_ml } = data.bocal
    if (!volume_ml) return nom
    const vol = volume_ml >= 1000 ? `${volume_ml / 1000} L` : `${volume_ml} mL`
    return `${nom} · ${vol}`
  })()

  return (
    <>
      {/* Overlay */}
      <div className="fixed inset-0 bg-black/40 z-40" onClick={onClose} />

      {/* Panneau */}
      <div className="fixed right-0 top-0 h-full w-full max-w-lg z-50 flex flex-col bg-gray-50 dark:bg-gray-900 shadow-2xl">

        {/* Header */}
        <div className="flex items-start gap-3 px-5 py-4 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
          <div className="flex-1 min-w-0">
            <h2 className="text-base font-bold text-gray-900 dark:text-gray-100">
              🌿 Origine du stock
            </h2>
            {data?.variete && (
              <div className="mt-0.5">
                <p className="text-sm font-semibold text-violet-700 dark:text-violet-300 truncate">
                  {data.variete.nom_variete}
                </p>
                {data.variete.croisement_variete && (
                  <p className="text-xs text-gray-400 dark:text-gray-500 flex items-center gap-1 mt-0.5">
                    <GitBranch className="w-3 h-3 shrink-0" />
                    {data.variete.croisement_variete}
                  </p>
                )}
              </div>
            )}
            {data?.stock.type_stock && (
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                {data.stock.type_stock}
                {data.stock.sous_type_stock && ` · ${data.stock.sous_type_stock}`}
                {data.stock.quantite_stock != null && ` · ${data.stock.quantite_stock.toFixed(1)} g`}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Corps */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-6">

          {isLoading && (
            <div className="flex items-center justify-center py-16 text-gray-400">
              <svg className="animate-spin w-5 h-5 mr-2" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-25" />
                <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
              </svg>
              Chargement…
            </div>
          )}

          {isError && (
            <div className="text-red-500 text-sm text-center py-8">
              Erreur lors du chargement de l'origine.
            </div>
          )}

          {data && !isLoading && (
            <>
              {/* Résumé chiffres */}
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-lg bg-violet-50 dark:bg-violet-900/20 px-3 py-2">
                  <div className="text-xl font-bold text-violet-700 dark:text-violet-300">
                    {data.cultures_source.length}
                  </div>
                  <div className="text-xs text-violet-500">culture{data.cultures_source.length > 1 ? 's' : ''}</div>
                </div>
                <div className="rounded-lg bg-green-50 dark:bg-green-900/20 px-3 py-2">
                  <div className="text-xl font-bold text-green-700 dark:text-green-300">{totalPlants}</div>
                  <div className="text-xs text-green-500">plante{totalPlants > 1 ? 's' : ''}</div>
                </div>
                <div className="rounded-lg bg-amber-50 dark:bg-amber-900/20 px-3 py-2">
                  <div className="text-xl font-bold text-amber-700 dark:text-amber-300">
                    {data.stock.quantite_stock?.toFixed(0) ?? '—'}
                  </div>
                  <div className="text-xs text-amber-500">grammes</div>
                </div>
              </div>

              {/* Variété — infos complémentaires */}
              {data.variete?.informations_variete && (
                <section className="space-y-2">
                  <h3 className="text-xs font-semibold uppercase tracking-widest text-gray-400">Variété</h3>
                  <div className="rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-3 text-sm text-gray-600 dark:text-gray-300">
                    {data.variete.informations_variete}
                  </div>
                </section>
              )}

              {/* Bocal */}
              {bocalLabel && (
                <section className="space-y-2">
                  <h3 className="text-xs font-semibold uppercase tracking-widest text-gray-400">Bocal</h3>
                  <div className="flex items-center gap-2 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 px-3 py-2 text-sm">
                    <Package className="w-4 h-4 text-purple-400 shrink-0" />
                    <span className="text-gray-700 dark:text-gray-200">{bocalLabel}</span>
                  </div>
                </section>
              )}

              {/* Cultures source */}
              {data.cultures_source.length > 0 ? (
                <section className="space-y-3">
                  <h3 className="text-xs font-semibold uppercase tracking-widest text-gray-400">
                    Cultures d'origine
                  </h3>
                  {data.cultures_source.map(c => (
                    <CultureCard key={c.id_culture} culture={c} />
                  ))}
                </section>
              ) : (
                <div className="text-center text-sm text-gray-400 py-8 bg-white dark:bg-gray-800 rounded-xl border border-dashed border-gray-200 dark:border-gray-700">
                  <p className="font-medium">Aucune culture source trouvée.</p>
                  <p className="text-xs mt-1 text-gray-300 dark:text-gray-600">
                    Ce stock n'est pas lié à des plantes traçables.
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </>
  )
}
