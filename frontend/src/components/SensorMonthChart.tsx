/**
 * SensorMonthChart — Température / humidité / VPD sur un mois (calendrier global)
 *
 * Moyennes calées sur les horaires de la lampe (action « Horaires de la lampe ») :
 * - une période « jour » (lampe allumée) et une période « nuit » (lampe éteinte)
 * - toute période de plus de 12 h est coupée en deux (moyenne toutes les 12 h maximum)
 * - horaires dynamiques : pour chaque jour, on prend le dernier horaire saisi
 *   à cette date ou avant, pour l'espace de culture du capteur
 * - sans horaire connu : repli sur 0h-12h / 12h-24h
 */
import { useQuery } from '@tanstack/react-query'
import {
  LineChart, Line, XAxis, YAxis, Tooltip, Legend,
  ResponsiveContainer, CartesianGrid,
} from 'recharts'
import { capteursAPI, GoveeDevice, TemperatureLog } from '../api/capteurs'
import { getHorairesLampe, HoraireLampe } from '../api/calendrier'

interface Props {
  year: number
  /** 1 à 12 */
  month: number
}

const DEVICE_COLORS = ['#ef4444', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899']
const H = 3_600_000
const DAY = 24 * H

const METRICS = [
  { key: 'temp', label: 'Température', unit: '°C',   decimals: 1, color: 'text-red-500' },
  { key: 'hum',  label: 'Humidité',    unit: '%',    decimals: 1, color: 'text-blue-500' },
  { key: 'vpd',  label: 'VPD',         unit: ' kPa', decimals: 2, color: 'text-emerald-500' },
] as const
type MetricKey = typeof METRICS[number]['key']

const pad = (n: number) => String(n).padStart(2, '0')
const round = (v: number, d: number) => Math.round(v * 10 ** d) / 10 ** d
const avg = (arr: number[]) => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null
const isoJour = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const fmtJour = (ms: number) => { const d = new Date(ms); return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}` }
const fmtHeure = (ms: number) => { const d = new Date(ms); return `${d.getHours()}h${d.getMinutes() ? pad(d.getMinutes()) : ''}` }

/** "07:00" → minutes depuis minuit (null si invalide) */
function toMinutes(h: string): number | null {
  const m = /^(\d{1,2})[:hH]?(\d{2})?$/.exec(String(h).trim())
  if (!m) return null
  const hh = Number(m[1]), mm = Number(m[2] ?? 0)
  if (hh > 24 || mm > 59) return null
  return (hh % 24) * 60 + mm
}

type Horaire = { on: number; off: number; fixe: boolean }  // minutes depuis minuit
const HORAIRE_FIXE: Horaire = { on: 0, off: 12 * 60, fixe: true }

type Segment = { debut: number; fin: number; jour: boolean; fixe: boolean; partie?: string }

/** Découpe [debut, fin[ en segments jour / nuit selon l'horaire en vigueur chaque jour */
function buildSegments(debut: number, fin: number, horaireDuJour: (jour: string) => Horaire): Segment[] {
  const segs: Segment[] = []
  // On part de la veille pour couvrir une nuit commencée le mois précédent
  const start = new Date(debut - DAY); start.setHours(0, 0, 0, 0)
  for (let d = new Date(start); d.getTime() < fin + DAY; d.setDate(d.getDate() + 1)) {
    const h = horaireDuJour(isoJour(d))
    const minuit = d.getTime()
    const on  = minuit + h.on * 60_000
    let off   = minuit + h.off * 60_000
    if (off <= on) off += DAY   // allumage le soir, extinction le lendemain
    // nuit qui suit : jusqu'au prochain allumage (horaire du lendemain)
    const lendemain = new Date(d); lendemain.setDate(d.getDate() + 1)
    const hNext = horaireDuJour(isoJour(lendemain))
    let onNext = lendemain.getTime() + hNext.on * 60_000
    if (onNext <= off) onNext = off   // horaire incohérent : pas de nuit
    segs.push({ debut: on, fin: off, jour: true, fixe: h.fixe })
    if (onNext > off) segs.push({ debut: off, fin: onNext, jour: false, fixe: h.fixe })
  }
  // Moyenne toutes les 12 h maximum : on coupe en deux les périodes plus longues
  const out: Segment[] = []
  for (const s of segs.sort((a, b) => a.debut - b.debut)) {
    if (s.fin - s.debut > 12 * H) {
      const mid = s.debut + Math.round((s.fin - s.debut) / 2)
      out.push({ ...s, fin: mid, partie: '1/2' }, { ...s, debut: mid, partie: '2/2' })
    } else out.push(s)
  }
  return out.filter(s => s.fin > debut && s.debut < fin)
}

export default function SensorMonthChart({ year, month }: Props) {
  const nbDays = new Date(year, month, 0).getDate()
  const debutStr = `${year}-${pad(month)}-01`
  const finStr   = `${year}-${pad(month)}-${pad(nbDays)}`
  const moisDebut = new Date(year, month - 1, 1).getTime()
  const moisFin   = new Date(year, month, 1).getTime()

  const { data: logs = [], isLoading } = useQuery<TemperatureLog[]>({
    queryKey: ['sensor-month', year, month],
    queryFn: async () => (await capteursAPI.getLogs({
      date_debut: `${debutStr}T00:00:00`,
      date_fin:   `${finStr}T23:59:59`,
    })).data,
    staleTime: 5 * 60 * 1000,
  })

  const { data: devicesRef = [] } = useQuery<GoveeDevice[]>({
    queryKey: ['capteurs'],
    queryFn: async () => (await capteursAPI.getAll()).data,
    staleTime: 10 * 60 * 1000,
  })

  const { data: horaires = [] } = useQuery<HoraireLampe[]>({
    queryKey: ['horaires-lampe', finStr],
    queryFn: () => getHorairesLampe(finStr),
    staleTime: 5 * 60 * 1000,
  })

  if (isLoading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 text-xs text-gray-400 text-center">
        Chargement des capteurs…
      </div>
    )
  }

  // ── Capteurs présents et leur espace de culture ───────────────────────────
  const ids: (number | null)[] = []
  for (const l of logs) {
    const id = l.id_device ?? null
    if (!ids.includes(id)) ids.push(id)
  }
  const devices = ids.map((id, i) => {
    const ref = id == null ? undefined : devicesRef.find(d => d.id_device === id)
    const espace = ref?.id_espace ?? logs.find(l => (l.id_device ?? null) === id && l.id_espace != null)?.id_espace ?? null
    return {
      id,
      key: id == null ? 'all' : `d${id}`,
      nom: id == null ? 'Capteur' : (ref?.nom ?? logs.find(l => l.id_device === id)?.nom_device ?? `Capteur ${id}`),
      color: DEVICE_COLORS[i % DEVICE_COLORS.length],
      espace,
    }
  })

  // ── Horaire en vigueur pour un espace à une date (dernier saisi à cette date ou avant) ─
  function horairePour(espace: number | null) {
    // Horaires de l'espace du capteur ; à défaut (capteur sans espace, un seul jeu d'horaires), tous
    const propres = horaires.filter(h => espace != null && h.id_espace === espace)
    const source = propres.length ? propres : (espace == null ? horaires : [])
    return (jour: string): Horaire => {
      let dernier: HoraireLampe | null = null
      for (const h of source) { if (h.date_action <= jour) dernier = h; else break }
      if (!dernier) return HORAIRE_FIXE
      const on = toMinutes(dernier.heure_debut), off = toMinutes(dernier.heure_fin)
      if (on == null || off == null || on === off) return HORAIRE_FIXE
      return { on, off, fixe: false }
    }
  }

  // ── Agrégation par segment jour / nuit, par capteur ───────────────────────
  type Point = { t: number; debut: number; fin: number; jour: boolean; fixe: boolean; partie?: string } & Partial<Record<MetricKey, number | null>>
  const series = devices.map(dev => {
    const segs = buildSegments(moisDebut, moisFin, horairePour(dev.espace))
    const acc = segs.map(() => ({ temp: [] as number[], hum: [] as number[], vpd: [] as number[] }))
    const devLogs = logs
      .filter(l => (l.id_device ?? null) === dev.id)
      .map(l => ({ l, ms: new Date(l.date_heure).getTime() }))
      .sort((a, b) => a.ms - b.ms)
    let i = 0
    for (const { l, ms } of devLogs) {
      while (i < segs.length && segs[i].fin <= ms) i++
      if (i >= segs.length) break
      if (ms < segs[i].debut) continue
      if (l.temperature != null) acc[i].temp.push(Number(l.temperature))
      if (l.humidite    != null) acc[i].hum.push(Number(l.humidite))
      if (l.vpd         != null) acc[i].vpd.push(Number(l.vpd))
    }
    const points: Point[] = []
    segs.forEach((s, k) => {
      const a = acc[k]
      if (!a.temp.length && !a.hum.length && !a.vpd.length) return
      const p: Point = { t: Math.round((s.debut + s.fin) / 2), debut: s.debut, fin: s.fin, jour: s.jour, fixe: s.fixe, partie: s.partie }
      for (const m of METRICS) {
        const v = avg(a[m.key])
        p[m.key] = v == null ? null : round(v, m.decimals)
      }
      points.push(p)
    })
    return { dev, points, calee: segs.some(s => !s.fixe) }
  }).filter(s => s.points.length > 0)

  if (series.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 text-sm text-gray-400 dark:text-gray-500 text-center">
        🌡️ Aucune donnée capteur ce mois-ci
      </div>
    )
  }

  // ── Résumé par capteur : moyenne jour (lampe allumée) et nuit (lampe éteinte) ─
  const moyenne = (pts: Point[], k: MetricKey, d: number) => {
    const v = avg(pts.map(p => p[k]).filter((x): x is number => typeof x === 'number'))
    return v == null ? null : round(v, d)
  }
  const toutesCalees = series.every(s => s.calee)
  const aucuneCalee  = series.every(s => !s.calee)

  // Graduations : un repère par jour, étiquette tous les 2 jours si le mois est long
  const ticks = Array.from({ length: nbDays }, (_, k) => new Date(year, month - 1, k + 1).getTime())

  const TooltipContent = ({ active, payload }: { active?: boolean; payload?: { payload: Point; dataKey?: unknown; value?: number; name?: string; color?: string }[] }) => {
    if (!active || !payload?.length) return null
    const p = payload[0].payload
    const libelle = p.fixe
      ? (p.jour ? '0h-12h' : '12h-24h')
      : `${p.jour ? '☀️ Jour' : '🌙 Nuit'}${p.partie ? ` (${p.partie})` : ''}`
    return (
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-xs shadow">
        <p className="font-semibold text-gray-700 dark:text-gray-200">{fmtJour(p.debut)} · {libelle}</p>
        <p className="text-gray-400 dark:text-gray-500 mb-1">{fmtJour(p.debut)} {fmtHeure(p.debut)} → {fmtJour(p.fin)} {fmtHeure(p.fin)}</p>
        {payload.map((it, k) => (
          <p key={k} style={{ color: it.color }} className="font-medium">{it.name} : {it.value}</p>
        ))}
      </div>
    )
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200 flex items-center gap-2">
          🌡️ Température, humidité et VPD du mois
        </h3>
        <span className="text-xs text-gray-400 dark:text-gray-500">
          {aucuneCalee
            ? 'Moyennes 0h-12h / 12h-24h (aucun horaire de lampe saisi)'
            : `Moyennes jour ☀️ / nuit 🌙 selon les horaires de la lampe${toutesCalees ? '' : ' (0h-12h / 12h-24h sans horaire)'}`}
          {' '}· 12 h max · {series.length} capteur{series.length > 1 ? 's' : ''}
        </span>
      </div>

      {/* Tuiles résumé : une ligne par capteur, moyenne jour / nuit du mois */}
      <div className="space-y-2">
        {series.map(({ dev, points, calee }) => {
          const jours = points.filter(p => p.jour), nuits = points.filter(p => !p.jour)
          return (
            <div key={dev.key} className="grid grid-cols-[minmax(0,1fr)_repeat(3,minmax(0,1fr))] gap-2 items-center">
              <p className="text-xs font-medium text-gray-600 dark:text-gray-300 flex items-center gap-1.5 truncate">
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: dev.color }} />
                <span className="truncate">{dev.nom}</span>
              </p>
              {METRICS.map(m => {
                const j = moyenne(jours, m.key, m.decimals), n = moyenne(nuits, m.key, m.decimals)
                return (
                  <div key={m.key} className="bg-gray-50 dark:bg-gray-700/50 rounded-lg px-2 py-1.5 text-center">
                    <p className={`text-[10px] font-semibold ${m.color}`}>{m.label}</p>
                    {j == null && n == null ? <p className="text-xs text-gray-400">-</p> : (
                      <p className="text-xs font-bold text-gray-800 dark:text-gray-100 leading-tight">
                        <span title={calee ? 'Lampe allumée' : '0h-12h'}>{calee ? '☀️' : '0-12h'} {j ?? '-'}{m.unit}</span>
                        <br />
                        <span title={calee ? 'Lampe éteinte' : '12h-24h'} className="text-gray-500 dark:text-gray-400">{calee ? '🌙' : '12-24h'} {n ?? '-'}{m.unit}</span>
                      </p>
                    )}
                  </div>
                )
              })}
            </div>
          )
        })}
      </div>

      {/* Une courbe par métrique, une ligne par capteur. Point plein = jour, point creux = nuit */}
      {METRICS.map(m => {
        const hasData = series.some(s => s.points.some(p => p[m.key] != null))
        if (!hasData) return null
        return (
          <div key={m.key}>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1 font-medium">{m.label}</p>
            <ResponsiveContainer width="100%" height={160}>
              <LineChart margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" strokeOpacity={0.25} vertical={false} />
                <XAxis
                  type="number"
                  dataKey="t"
                  domain={[moisDebut, moisFin]}
                  ticks={ticks}
                  tickFormatter={fmtJour}
                  tick={{ fontSize: 10, fill: '#9ca3af' }}
                  tickLine={false}
                  axisLine={false}
                  minTickGap={12}
                  allowDuplicatedCategory={false}
                />
                <YAxis
                  domain={['auto', 'auto']}
                  tick={{ fontSize: 10, fill: '#9ca3af' }}
                  tickLine={false}
                  axisLine={false}
                  width={44}
                  tickFormatter={v => `${v}${m.unit.trim()}`}
                />
                <Tooltip content={<TooltipContent />} />
                {series.length > 1 && <Legend iconType="line" wrapperStyle={{ fontSize: 10, paddingTop: 4 }} />}
                {series.map(({ dev, points }) => (
                  <Line
                    key={dev.key}
                    data={points}
                    type="monotone"
                    dataKey={m.key}
                    name={dev.nom}
                    stroke={dev.color}
                    strokeWidth={2}
                    connectNulls
                    isAnimationActive={false}
                    dot={(props: { cx?: number; cy?: number; payload?: Point; index?: number }) => {
                      const { cx, cy, payload, index } = props
                      if (cx == null || cy == null || payload?.[m.key] == null) return <g key={`${dev.key}-${index}`} />
                      return (
                        <circle
                          key={`${dev.key}-${index}`}
                          cx={cx} cy={cy} r={2.5}
                          stroke={dev.color} strokeWidth={1.2}
                          fill={payload.jour ? dev.color : 'transparent'}
                        />
                      )
                    }}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        )
      })}
      <p className="text-[10px] text-gray-400 dark:text-gray-500 text-right">
        Point plein : lampe allumée · point creux : lampe éteinte. Horaires repris de l'action « Horaires de la lampe » de chaque espace.
      </p>
    </div>
  )
}
