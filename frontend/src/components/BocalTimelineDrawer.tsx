/**
 * BocalTimelineDrawer — Traçabilité bocal → graine
 *
 * Affiche la chaîne complète : bocal → sessions curing → plantes → graine / culture / séchage
 * + les stocks associés au bocal.
 *
 * Utilisation :
 *   <BocalTimelineDrawer idMateriel={12} onClose={() => setOpen(false)} />
 */

import { useQuery } from '@tanstack/react-query'
import { X, Dna, Leaf, Archive, FlaskConical, Package, Calendar, Scale } from 'lucide-react'
import { materielAPI } from '../api/materiel'
import type { PlantTimeline, SessionCuringTimeline, StockTimeline } from '../api/materiel'

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
  return `${diff} j`
}

function typeGraineColor(t?: string | null) {
  if (!t) return 'bg-gray-100 text-gray-600'
  if (t === 'Féminisée') return 'bg-pink-100 text-pink-700'
  if (t === 'Auto')      return 'bg-purple-100 text-purple-700'
  return 'bg-gray-100 text-gray-600'
}

// ─── Sub-composants ───────────────────────────────────────────────────────────

function PlantCard({ plant }: { plant: PlantTimeline }) {
  const g = plant.graine
  const c = plant.culture
  const s = plant.sechage

  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-3 space-y-2 text-sm">
      {/* En-tête plante */}
      <div className="flex items-center gap-2 font-semibold text-gray-800 dark:text-gray-200">
        <Leaf className="w-4 h-4 text-green-500 shrink-0" />
        <span>{plant.nom_affichage}</span>
        {plant.poids_final_curing_g != null && (
          <span className="ml-auto text-green-700 dark:text-green-400 font-normal">
            {plant.poids_final_curing_g.toFixed(1)} g
          </span>
        )}
      </div>

      {/* Graine */}
      {g ? (
        <div className="flex items-start gap-2 text-gray-600 dark:text-gray-300">
          <Dna className="w-3.5 h-3.5 mt-0.5 text-violet-400 shrink-0" />
          <div>
            <span className="font-medium text-gray-700 dark:text-gray-200">
              {g.variete?.nom_variete ?? '—'}
            </span>
            {g.breeder && (
              <span className="text-gray-400 dark:text-gray-500 ml-1">
                · {g.breeder.nom_breeder}
              </span>
            )}
            {g.types_graines && (
              <span className={`ml-2 text-xs px-1.5 py-0.5 rounded-full ${typeGraineColor(g.types_graines)}`}>
                {g.types_graines}
              </span>
            )}
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-2 text-gray-400 text-xs">
          <Dna className="w-3.5 h-3.5 shrink-0" />
          Graine non renseignée (bouture / clone)
        </div>
      )}

      {/* Culture */}
      {c && (
        <div className="flex items-start gap-2 text-gray-600 dark:text-gray-300">
          <Archive className="w-3.5 h-3.5 mt-0.5 text-amber-400 shrink-0" />
          <div>
            <span className="font-medium text-gray-700 dark:text-gray-200">{c.nom}</span>
            <div className="text-xs text-gray-400 dark:text-gray-500 space-x-2 mt-0.5">
              <span>Début : {fmt(c.date_debut)}</span>
              {c.date_passage_12_12 && <span>· 12/12 : {fmt(c.date_passage_12_12)}</span>}
              {c.date_debut_floraison && <span>· Flo : {fmt(c.date_debut_floraison)}</span>}
            </div>
          </div>
        </div>
      )}

      {/* Séchage */}
      {s && (
        <div className="flex items-start gap-2 text-gray-600 dark:text-gray-300">
          <FlaskConical className="w-3.5 h-3.5 mt-0.5 text-blue-400 shrink-0" />
          <div>
            <span className="text-gray-700 dark:text-gray-200">
              {s.nom ?? `Séchage #${s.id_session_sechage}`}
            </span>
            <div className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
              {fmt(s.date_debut)} → {fmt(s.date_fin)}
              {s.date_debut && s.date_fin && (
                <span className="ml-1">({dureeJours(s.date_debut, s.date_fin)})</span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Dates récolte / curing */}
      <div className="flex gap-4 text-xs text-gray-400 dark:text-gray-500 pt-1 border-t border-gray-100 dark:border-gray-700">
        {plant.date_recolte && (
          <span><Calendar className="w-3 h-3 inline mr-1" />Récolte : {fmt(plant.date_recolte)}</span>
        )}
        {plant.poids_debut_curing_g != null && (
          <span><Scale className="w-3 h-3 inline mr-1" />Entrée curing : {plant.poids_debut_curing_g.toFixed(1)} g</span>
        )}
      </div>
    </div>
  )
}


function SessionCuringCard({ session }: { session: SessionCuringTimeline }) {
  const isActive = session.statut === 'active'
  return (
    <div className="space-y-3">
      {/* En-tête session */}
      <div className="flex items-center gap-2">
        <span className={`w-2 h-2 rounded-full shrink-0 ${isActive ? 'bg-green-400' : 'bg-gray-300'}`} />
        <span className="font-semibold text-gray-800 dark:text-gray-200">
          {session.nom ?? `Session #${session.id_session_curing}`}
        </span>
        <span className={`ml-auto text-xs px-2 py-0.5 rounded-full ${
          isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400'
        }`}>
          {isActive ? 'En cours' : 'Terminée'}
        </span>
      </div>
      <div className="text-xs text-gray-400 dark:text-gray-500 -mt-2">
        {fmt(session.date_debut)}
        {session.date_fin ? ` → ${fmt(session.date_fin)}` : ''}
        {session.date_debut && session.date_fin && (
          <span className="ml-1">({dureeJours(session.date_debut, session.date_fin)})</span>
        )}
      </div>

      {/* Plantes */}
      {session.plants.length === 0 ? (
        <p className="text-xs text-gray-400 italic">Aucune plante enregistrée dans cette session.</p>
      ) : (
        <div className="space-y-2">
          {session.plants.map(p => (
            <PlantCard key={p.id_plant} plant={p} />
          ))}
        </div>
      )}
    </div>
  )
}


function StockCard({ stock }: { stock: StockTimeline }) {
  const isActive = !stock.date_fin_stock
  return (
    <div className="flex items-center gap-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm">
      <Package className="w-4 h-4 text-emerald-500 shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="font-medium text-gray-800 dark:text-gray-200">
          {stock.type_stock}
          {stock.sous_type_stock && <span className="text-gray-400 ml-1">· {stock.sous_type_stock}</span>}
          {stock.variete && (
            <span className="text-violet-600 dark:text-violet-400 ml-1">· {stock.variete.nom_variete}</span>
          )}
        </div>
        <div className="text-xs text-gray-400 dark:text-gray-500">
          {stock.quantite_stock != null ? `${stock.quantite_stock.toFixed(1)} g` : '—'}
          {' · '}
          {fmt(stock.date_stock)}
          {stock.date_fin_stock && ` → ${fmt(stock.date_fin_stock)}`}
        </div>
      </div>
      <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${
        isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-400 dark:bg-gray-700 dark:text-gray-500'
      }`}>
        {isActive ? 'En stock' : 'Épuisé'}
      </span>
    </div>
  )
}


// ─── Drawer principal ─────────────────────────────────────────────────────────

interface Props {
  idMateriel: number
  onClose: () => void
}

export default function BocalTimelineDrawer({ idMateriel, onClose }: Props) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['bocal-timeline', idMateriel],
    queryFn: () => materielAPI.bocalTimeline(idMateriel).then(r => r.data),
    enabled: idMateriel > 0,
  })

  const totalPlants = data?.sessions_curing.reduce((acc, s) => acc + s.plants.length, 0) ?? 0
  const hasStock = (data?.stocks.length ?? 0) > 0

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black/40 z-40"
        onClick={onClose}
      />

      {/* Panneau */}
      <div className="fixed right-0 top-0 h-full w-full max-w-lg z-50 flex flex-col bg-gray-50 dark:bg-gray-900 shadow-2xl">
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
          <div className="flex-1 min-w-0">
            <h2 className="text-base font-bold text-gray-900 dark:text-gray-100 truncate">
              🫙 Traçabilité bocal
            </h2>
            {data && (
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                {data.bocal.nom}
                {(data.bocal.caracteristiques as any)?.volume_ml && (
                  <span className="ml-1">
                    · {(data.bocal.caracteristiques as any).volume_ml >= 1000
                        ? `${(data.bocal.caracteristiques as any).volume_ml / 1000} L`
                        : `${(data.bocal.caracteristiques as any).volume_ml} mL`}
                  </span>
                )}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400"
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
              Erreur lors du chargement de la timeline.
            </div>
          )}

          {data && !isLoading && (
            <>
              {/* Résumé */}
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-lg bg-violet-50 dark:bg-violet-900/20 px-3 py-2">
                  <div className="text-xl font-bold text-violet-700 dark:text-violet-300">
                    {data.sessions_curing.length}
                  </div>
                  <div className="text-xs text-violet-500">session{data.sessions_curing.length > 1 ? 's' : ''}</div>
                </div>
                <div className="rounded-lg bg-green-50 dark:bg-green-900/20 px-3 py-2">
                  <div className="text-xl font-bold text-green-700 dark:text-green-300">{totalPlants}</div>
                  <div className="text-xs text-green-500">plante{totalPlants > 1 ? 's' : ''}</div>
                </div>
                <div className="rounded-lg bg-amber-50 dark:bg-amber-900/20 px-3 py-2">
                  <div className="text-xl font-bold text-amber-700 dark:text-amber-300">
                    {data.stocks.length}
                  </div>
                  <div className="text-xs text-amber-500">stock{data.stocks.length > 1 ? 's' : ''}</div>
                </div>
              </div>

              {/* Sessions de curing */}
              {data.sessions_curing.length > 0 ? (
                <section className="space-y-4">
                  <h3 className="text-xs font-semibold uppercase tracking-widest text-gray-400">
                    Sessions de curing
                  </h3>
                  {data.sessions_curing.map(sc => (
                    <div
                      key={sc.id_session_curing}
                      className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4"
                    >
                      <SessionCuringCard session={sc} />
                    </div>
                  ))}
                </section>
              ) : (
                <div className="text-center text-sm text-gray-400 py-6 bg-white dark:bg-gray-800 rounded-xl border border-dashed border-gray-200 dark:border-gray-700">
                  <p className="font-medium">Aucune session de curing associée.</p>
                  <p className="text-xs mt-1 text-gray-300 dark:text-gray-600">
                    Ce bocal n'a pas encore été utilisé pour du curing.
                  </p>
                </div>
              )}

              {/* Stocks */}
              {hasStock && (
                <section className="space-y-2">
                  <h3 className="text-xs font-semibold uppercase tracking-widest text-gray-400">
                    Stocks associés
                  </h3>
                  {data.stocks.map(s => (
                    <StockCard key={s.id_stock} stock={s} />
                  ))}
                </section>
              )}

              {/* État vide total */}
              {data.sessions_curing.length === 0 && !hasStock && (
                <div className="text-center text-sm text-gray-400 pt-4">
                  <p>Ce bocal n'a aucune donnée de traçabilité pour l'instant.</p>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </>
  )
}
