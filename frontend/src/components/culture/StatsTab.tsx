import { useQuery } from '@tanstack/react-query'
import { actionAPI, cultureAPI, Stats, CultureCout, PhEcPoint } from '../../api/cultures'
import { espacesAPI } from '../../api/espaces'
import { BarChart2, Droplets, Zap, Euro, Leaf, Zap as ZapIcon, FlaskConical, TestTube, Sun } from 'lucide-react'
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'

interface Props {
  cultureId: number
  idEspace?: number
  phase?: string
}

// ── Constantes PPFD/DLI ───────────────────────────────────────────────────────
const EFFICACITE_UMOL_J = 2.5        // µmol/J — efficacité typique LED full-spectrum
const PHASES_FLORAISON  = ['floraison']
const PHASES_VEG        = ['germination', 'croissance', 'veg']

function getPhotoPeriode(phase?: string): number {
  if (phase && PHASES_FLORAISON.includes(phase)) return 12
  return 18
}

function calcPPFD(puissanceW: number, surfaceM2: number): number {
  return (puissanceW * EFFICACITE_UMOL_J) / surfaceM2
}

function calcDLI(ppfd: number, heures: number): number {
  return (ppfd * heures * 3600) / 1_000_000
}

// ── Cibles PPFD/DLI par phase ─────────────────────────────────────────────────
type Range = { min: number; max: number }
function targetPPFD(phase?: string): Range {
  if (phase && PHASES_FLORAISON.includes(phase)) return { min: 600, max: 900 }
  return { min: 400, max: 600 }
}
function targetDLI(phase?: string): Range {
  if (phase && PHASES_FLORAISON.includes(phase)) return { min: 26, max: 40 }
  return { min: 20, max: 30 }
}
function statusColor(val: number, range: Range): string {
  if (val < range.min) return 'text-amber-600 dark:text-amber-400'
  if (val > range.max) return 'text-red-600 dark:text-red-400'
  return 'text-green-600 dark:text-green-400'
}
function statusLabel(val: number, range: Range): string {
  if (val < range.min) return 'Trop faible'
  if (val > range.max) return 'Trop élevé'
  return 'Optimal'
}

export default function StatsTab({ cultureId, idEspace, phase }: Props) {
  const { data: stats, isLoading } = useQuery<Stats>({
    queryKey: ['stats', cultureId],
    queryFn: async () => (await actionAPI.getStats(cultureId)).data,
  })

  const { data: cout } = useQuery<CultureCout>({
    queryKey: ['culture-cout', cultureId],
    queryFn: async () => (await cultureAPI.getCout(cultureId)).data,
  })

  const { data: espace } = useQuery({
    queryKey: ['espace', idEspace],
    queryFn: async () => (await espacesAPI.getById(idEspace!)).data,
    enabled: !!idEspace,
  })

  if (isLoading) return <div className="text-center py-12 text-gray-400 dark:text-gray-500">Chargement des stats…</div>

  if (!stats || stats.nb_actions_total === 0) {
    return (
      <div className="text-center py-12 text-gray-400 dark:text-gray-500">
        <BarChart2 size={40} className="mx-auto mb-3 opacity-30" />
        <p>Pas encore de données à afficher</p>
        <p className="text-sm mt-1">Les graphiques apparaîtront après les premières actions</p>
      </div>
    )
  }

  // Préparer données hauteur (merge toutes les plantes sur timeline commune)
  const hauteurPlantes = Object.entries(stats.hauteurs)
  const arrosageData = stats.arrosages
  const intensiteData = stats.intensites_lampe
  const phEcData: PhEcPoint[] = stats.ph_ec ?? []

  // ── PPFD / DLI ───────────────────────────────────────────────────────────────
  const ppfdPuissance  = cout?.puissance_w ?? null
  const ppfdSurface    = espace?.surface_m2 ?? null
  const ppfdHeures     = getPhotoPeriode(phase)
  const ppfdPhaseLabel = phase === 'floraison' ? 'Floraison' : phase === 'germination' ? 'Germination' : 'Végétation'
  const ppfdVal        = ppfdPuissance && ppfdSurface ? calcPPFD(ppfdPuissance, ppfdSurface) : null
  const dliVal         = ppfdVal ? calcDLI(ppfdVal, ppfdHeures) : null
  const ppfdTarget     = targetPPFD(phase)
  const dliTarget      = targetDLI(phase)
  const ppfdMissingLamp    = !ppfdPuissance || ppfdPuissance === 0
  const ppfdMissingSurface = !ppfdMissingLamp && (!ppfdSurface || ppfdSurface === 0)

  return (
    <div className="space-y-8">

      {/* ── Coûts ── */}
      {cout && (cout.cout_total != null || cout.cout_par_gramme != null) && (
        <div className="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-indigo-800 dark:text-indigo-300 mb-3 flex items-center gap-2">
            <Euro size={15} /> Estimation des coûts
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="text-center">
              <p className="text-xs text-indigo-500 dark:text-indigo-400 flex items-center justify-center gap-1 mb-0.5">
                <ZapIcon size={11} /> Électricité
              </p>
              {cout.puissance_w != null && cout.puissance_w > 0 ? (
                <p className="text-lg font-bold text-indigo-700 dark:text-indigo-300">
                  {(cout.cout_electricite ?? 0).toFixed(2)} €
                </p>
              ) : (
                <p className="text-sm text-indigo-400 dark:text-indigo-500 italic">Aucune lampe liée</p>
              )}
            </div>
            {cout.cout_engrais != null && (
              <div className="text-center">
                <p className="text-xs text-indigo-500 dark:text-indigo-400 flex items-center justify-center gap-1 mb-0.5">
                  <FlaskConical size={11} /> Engrais
                </p>
                <p className="text-lg font-bold text-indigo-700 dark:text-indigo-300">{cout.cout_engrais.toFixed(2)} €</p>
              </div>
            )}
            {cout.cout_graines != null && (
              <div className="text-center">
                <p className="text-xs text-indigo-500 dark:text-indigo-400 flex items-center justify-center gap-1 mb-0.5">
                  <Leaf size={11} /> Graines
                </p>
                <p className="text-lg font-bold text-indigo-700 dark:text-indigo-300">{cout.cout_graines.toFixed(2)} €</p>
              </div>
            )}
            <div className="text-center border-l border-indigo-200 dark:border-indigo-700 pl-3">
              <p className="text-xs text-indigo-500 dark:text-indigo-400 mb-0.5">Total</p>
              <p className="text-xl font-bold text-indigo-800 dark:text-indigo-200">{(cout.cout_total ?? 0).toFixed(2)} €</p>
              {cout.cout_par_gramme != null && (
                <p className="text-xs font-semibold text-purple-600 dark:text-purple-400 mt-0.5">
                  {cout.cout_par_gramme.toFixed(2)} €/g
                </p>
              )}
            </div>
          </div>
          <p className="text-xs text-indigo-400 dark:text-indigo-500 mt-2 text-right">
            {cout.puissance_w != null && cout.puissance_w > 0
              ? `${cout.puissance_w} W · croissance 18h / floraison 12h · intensité depuis actions dimmer · prix kWh depuis Paramétrage`
              : 'Liez une lampe à l\'espace de culture pour calculer le coût électricité'}
          </p>
        </div>
      )}

      {/* ── PPFD / DLI ── */}
      {ppfdMissingLamp && (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-100 dark:border-yellow-800 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-yellow-800 dark:text-yellow-300 mb-1 flex items-center gap-2">
            <Sun size={15} /> PPFD / DLI
          </h3>
          <p className="text-xs text-yellow-600 dark:text-yellow-400">
            Liez une lampe à l&apos;espace de culture pour calculer le PPFD et le DLI.
          </p>
        </div>
      )}
      {ppfdMissingSurface && (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-100 dark:border-yellow-800 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-yellow-800 dark:text-yellow-300 mb-1 flex items-center gap-2">
            <Sun size={15} /> PPFD / DLI
          </h3>
          <p className="text-xs text-yellow-600 dark:text-yellow-400">
            Renseignez la surface (m²) dans la fiche de l&apos;espace de culture pour calculer le PPFD et le DLI.
          </p>
        </div>
      )}
      {ppfdVal !== null && dliVal !== null && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-amber-800 dark:text-amber-300 mb-3 flex items-center gap-2">
            <Sun size={15} /> PPFD / DLI estimés
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="text-center">
              <p className="text-xs text-amber-500 dark:text-amber-400 mb-0.5">PPFD</p>
              <p className={`text-lg font-bold ${statusColor(ppfdVal, ppfdTarget)}`}>
                {Math.round(ppfdVal)} <span className="text-xs font-normal">µmol/m²/s</span>
              </p>
              <p className={`text-xs font-medium mt-0.5 ${statusColor(ppfdVal, ppfdTarget)}`}>{statusLabel(ppfdVal, ppfdTarget)}</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-amber-500 dark:text-amber-400 mb-0.5">DLI</p>
              <p className={`text-lg font-bold ${statusColor(dliVal, dliTarget)}`}>
                {dliVal.toFixed(1)} <span className="text-xs font-normal">mol/m²/j</span>
              </p>
              <p className={`text-xs font-medium mt-0.5 ${statusColor(dliVal, dliTarget)}`}>{statusLabel(dliVal, dliTarget)}</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-amber-500 dark:text-amber-400 mb-0.5">Photopériode</p>
              <p className="text-lg font-bold text-amber-700 dark:text-amber-300">{ppfdHeures}h</p>
              <p className="text-xs text-amber-500 dark:text-amber-400 mt-0.5">{ppfdPhaseLabel}</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-amber-500 dark:text-amber-400 mb-0.5">Lampe</p>
              <p className="text-lg font-bold text-amber-700 dark:text-amber-300">{ppfdPuissance} W</p>
              <p className="text-xs text-amber-500 dark:text-amber-400 mt-0.5">{ppfdSurface} m²</p>
            </div>
          </div>
          <p className="text-xs text-amber-400 dark:text-amber-500 mt-2 text-right">
            Cible {ppfdPhaseLabel} — PPFD {ppfdTarget.min}–{ppfdTarget.max} / DLI {dliTarget.min}–{dliTarget.max} mol/m²/j — efficacité {EFFICACITE_UMOL_J} µmol/J
          </p>
        </div>
      )}

      {/* Résumé */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-grow-600">{stats.nb_actions_total}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500 mt-1">Actions enregistrées</p>
        </div>
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-blue-600">{stats.arrosages.length}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500 mt-1">Arrosages</p>
        </div>
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-yellow-600">{stats.intensites_lampe.length}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500 mt-1">Réglages lampe</p>
        </div>
      </div>

      {/* Hauteur des plantes */}
      {hauteurPlantes.length > 0 && (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-4 flex items-center gap-2">
            📐 Hauteur des plantes (cm)
          </h3>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} unit="cm" />
              <Tooltip formatter={(v: number) => `${v} cm`} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              {hauteurPlantes.map(([nom, data], i) => (
                <Line
                  key={nom}
                  data={data}
                  dataKey="hauteur_cm"
                  name={nom}
                  stroke={['#22c55e', '#3b82f6', '#a855f7', '#f97316', '#ef4444', '#eab308'][i % 6]}
                  strokeWidth={2}
                  dot={{ r: 3 }}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Arrosages */}
      {arrosageData.length > 0 && (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-4 flex items-center gap-2">
            <Droplets size={16} className="text-blue-500" /> Arrosages (mL)
          </h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={arrosageData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} unit="mL" />
              <Tooltip formatter={(v: number) => `${v} mL`} />
              <Bar dataKey="volume_ml" name="Volume" fill="#60a5fa" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Intensité lampe */}
      {intensiteData.length > 0 && (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-4 flex items-center gap-2">
            <Zap size={16} className="text-yellow-500" /> Intensité lampe (%)
          </h3>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={intensiteData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} unit="%" domain={[0, 100]} />
              <Tooltip formatter={(v: number) => `${v}%`} />
              <Line dataKey="puissance_apres" name="Intensité (%)" stroke="#eab308" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* pH et EC */}
      {phEcData.length > 0 && (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-4 flex items-center gap-2">
            <TestTube size={16} className="text-teal-500" /> pH et EC par arrosage
          </h3>

          {phEcData.some(p => p.ph_entrant != null || p.ph_sortant != null) && (
            <>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-2 font-medium">pH</p>
              <ResponsiveContainer width="100%" height={160}>
                <LineChart data={phEcData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} domain={[4, 9]} />
                  <Tooltip formatter={(v: number) => v.toFixed(1)} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Line dataKey="ph_entrant" name="pH entrant" stroke="#0ea5e9" strokeWidth={2} dot={{ r: 3 }} connectNulls />
                  <Line dataKey="ph_sortant" name="pH sortant" stroke="#f97316" strokeWidth={2} dot={{ r: 3 }} strokeDasharray="4 2" connectNulls />
                </LineChart>
              </ResponsiveContainer>
            </>
          )}

          {phEcData.some(p => p.ec_entrant != null || p.ec_sortant != null) && (
            <>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-4 mb-2 font-medium">EC (mS/cm)</p>
              <ResponsiveContainer width="100%" height={160}>
                <LineChart data={phEcData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} unit=" mS" />
                  <Tooltip formatter={(v: number) => `${v.toFixed(1)} mS`} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Line dataKey="ec_entrant" name="EC entrant" stroke="#8b5cf6" strokeWidth={2} dot={{ r: 3 }} connectNulls />
                  <Line dataKey="ec_sortant" name="EC sortant" stroke="#ec4899" strokeWidth={2} dot={{ r: 3 }} strokeDasharray="4 2" connectNulls />
                </LineChart>
              </ResponsiveContainer>
            </>
          )}
        </div>
      )}
    </div>
  )
}
