/**
 * SensorDayChart — Courbes température / humidité / VPD pour un jour donné (00:00 → 23:59)
 * - Moyennes horaires (1 point / heure)
 * - Une ligne par capteur (id_device)
 */
import { useQuery } from '@tanstack/react-query'
import {
  LineChart, Line, XAxis, YAxis, Tooltip, Legend,
  ResponsiveContainer, CartesianGrid,
} from 'recharts'
import { capteursAPI } from '../api/capteurs'

interface Props {
  /** Date ISO locale ex: "2026-05-15" */
  date: string
  /** Filtre optionnel par espace de culture */
  idEspace?: number
}

// ── Palette couleurs capteurs ─────────────────────────────────────────────────
const DEVICE_COLORS = ['#ef4444', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899']

// ── Métriques à afficher ──────────────────────────────────────────────────────
const METRICS = [
  { metricKey: 'temp', label: 'Température', unit: '°C',   domain: [10, 40] as [number, number] },
  { metricKey: 'hum',  label: 'Humidité',    unit: '%',    domain: [0, 100] as [number, number] },
  { metricKey: 'vpd',  label: 'VPD',         unit: ' kPa', domain: [0, 3]   as [number, number] },
]

// ── Helpers ───────────────────────────────────────────────────────────────────
type Bucket = { temps: number[]; hums: number[]; vpds: number[] }

const avgVals = (arr: number[]): number | null =>
  arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length * 10) / 10 : null

const make24Buckets = (): Map<number, Bucket> =>
  new Map(Array.from({ length: 24 }, (_, h) => [h, { temps: [], hums: [], vpds: [] }]))

export default function SensorDayChart({ date, idEspace }: Props) {
  const { data: logs = [], isLoading } = useQuery({
    queryKey: ['sensor-day', date, idEspace ?? null],
    queryFn: async () => {
      const res = await capteursAPI.getLogs({
        date_debut: `${date}T00:00:00`,
        date_fin:   `${date}T23:59:59`,
        ...(idEspace ? { id_espace: idEspace } : {}),
      })
      return res.data
    },
    staleTime: 5 * 60 * 1000,
  })

  // ── États de chargement / vide ────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="text-xs text-gray-400 text-center py-4 flex items-center justify-center gap-1.5">
        <div className="w-3 h-3 rounded-full border-2 border-gray-300 border-t-gray-500 animate-spin" />
        Chargement capteurs…
      </div>
    )
  }

  if (logs.length === 0) {
    return (
      <div className="text-xs text-gray-400 text-center py-3 flex items-center justify-center gap-1.5">
        <span>🌡️</span>
        <span>Aucune donnée capteur pour ce jour</span>
      </div>
    )
  }

  // ── 1. Extraire la liste des capteurs présents ────────────────────────────
  const deviceMap = new Map<number, string>()
  for (const log of logs) {
    if (log.id_device != null && !deviceMap.has(log.id_device)) {
      deviceMap.set(log.id_device, log.nom_device ?? `Capteur ${log.id_device}`)
    }
  }
  const devices = [...deviceMap.entries()].map(([id, nom], i) => ({
    id,
    nom,
    color: DEVICE_COLORS[i % DEVICE_COLORS.length],
    key: `d${id}`,
  }))
  // Fallback : si les logs n'ont pas d'id_device (cas agrégés), une seule série
  const singleMode = devices.length === 0
  const allDevices = singleMode
    ? [{ id: null as null, nom: 'Capteur', color: DEVICE_COLORS[0], key: 'all' }]
    : devices

  // ── 2. Agrégation horaire par capteur ─────────────────────────────────────
  const deviceBuckets = new Map<string, Map<number, Bucket>>()
  for (const { key } of allDevices) deviceBuckets.set(key, make24Buckets())

  for (const log of logs) {
    const h    = new Date(log.date_heure).getHours()
    const dKey = singleMode ? 'all' : (log.id_device != null ? `d${log.id_device}` : null)
    if (!dKey) continue
    const bucket = deviceBuckets.get(dKey)?.get(h)
    if (!bucket) continue
    if (log.temperature != null) bucket.temps.push(log.temperature)
    if (log.humidite    != null) bucket.hums.push(log.humidite)
    if (log.vpd         != null) bucket.vpds.push(log.vpd)
  }

  // ── 3. Construire chartData (24 entrées, une par heure) ───────────────────
  const chartData = Array.from({ length: 24 }, (_, h) => {
    const row: Record<string, string | number | null> = {
      hour: `${String(h).padStart(2, '0')}:00`,
    }
    for (const { key } of allDevices) {
      const b = deviceBuckets.get(key)!.get(h)!
      row[`temp_${key}`] = avgVals(b.temps)
      row[`hum_${key}`]  = avgVals(b.hums)
      row[`vpd_${key}`]  = b.vpds.length
        ? Math.round(avgVals(b.vpds)! * 100) / 100
        : null
    }
    return row
  })

  // ── 4. Stats globales pour les tiles résumé (toutes mesures brutes) ───────
  const allTemps = logs.map(l => l.temperature).filter((v): v is number => v != null)
  const allHums  = logs.map(l => l.humidite).filter((v):   v is number => v != null)
  const allVpds  = logs.map(l => l.vpd).filter((v):        v is number => v != null)
  const minV  = (arr: number[]) => arr.length ? Math.round(Math.min(...arr) * 10) / 10 : null
  const maxV  = (arr: number[]) => arr.length ? Math.round(Math.max(...arr) * 10) / 10 : null

  return (
    <div className="space-y-3 pt-3 border-t border-gray-100 dark:border-gray-700 mt-4">

      {/* ── Titre ── */}
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide flex items-center gap-1.5">
          <span>🌡️</span> Constantes du jour
        </p>
        <span className="text-xs text-gray-400 dark:text-gray-500">
          {logs.length} mesure{logs.length > 1 ? 's' : ''} · {allDevices.length} capteur{allDevices.length > 1 ? 's' : ''}
        </span>
      </div>

      {/* ── Tiles résumé min / moy / max (toutes mesures confondues) ── */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: 'Temp.', vals: allTemps, unit: '°C',   color: 'text-red-500'     },
          { label: 'Hum.',  vals: allHums,  unit: '%',    color: 'text-blue-500'    },
          { label: 'VPD',   vals: allVpds,  unit: ' kPa', color: 'text-emerald-500' },
        ].map(s => (
          <div key={s.label} className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-2 text-center">
            <p className={`text-xs font-semibold ${s.color} mb-0.5`}>{s.label}</p>
            {s.vals.length > 0 ? (
              <>
                <p className="text-sm font-bold text-gray-800 dark:text-gray-100">
                  {avgVals(s.vals)}{s.unit}
                </p>
                <p className="text-[10px] text-gray-400 dark:text-gray-500">
                  {minV(s.vals)}{s.unit} – {maxV(s.vals)}{s.unit}
                </p>
              </>
            ) : (
              <p className="text-xs text-gray-400">—</p>
            )}
          </div>
        ))}
      </div>

      {/* ── Courbes : 1 graphique par métrique, 1 ligne par capteur ── */}
      {METRICS.map(({ metricKey, label, unit, domain }) => {
        // Clés dataKey pour ce metric (une par capteur)
        const lines = allDevices.map(d => ({ ...d, dataKey: `${metricKey}_${d.key}` }))
        // Ne pas afficher si aucune donnée pour cette métrique
        const hasData = chartData.some(row => lines.some(l => row[l.dataKey] != null))
        if (!hasData) return null

        return (
          <div key={metricKey}>
            <p className="text-[11px] text-gray-500 dark:text-gray-400 mb-1 font-medium">{label}</p>
            <ResponsiveContainer width="100%" height={singleMode ? 72 : 80}>
              <LineChart data={chartData} margin={{ top: 2, right: 4, bottom: 0, left: -12 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                <XAxis
                  dataKey="hour"
                  tick={{ fontSize: 9, fill: '#9ca3af' }}
                  tickLine={false}
                  axisLine={false}
                  interval={3}
                />
                <YAxis
                  domain={domain}
                  tick={{ fontSize: 9, fill: '#9ca3af' }}
                  tickLine={false}
                  axisLine={false}
                  width={30}
                  tickFormatter={v => `${v}${unit.trim()}`}
                />
                <Tooltip
                  contentStyle={{ fontSize: 11, padding: '4px 8px', borderRadius: 8, border: '1px solid #e5e7eb' }}
                  formatter={(v: number, _: string, props: { dataKey?: string }) => {
                    const deviceKey = String(props.dataKey ?? '').replace(`${metricKey}_`, '')
                    const deviceNom = allDevices.find(d => d.key === deviceKey)?.nom ?? deviceKey
                    return [`${v}${unit}`, deviceNom]
                  }}
                  labelFormatter={t => `🕐 ${t}`}
                />
                {!singleMode && (
                  <Legend
                    iconType="line"
                    iconSize={12}
                    wrapperStyle={{ fontSize: 10, paddingTop: 4 }}
                    formatter={(_: string, entry: { dataKey?: string }) => {
                      const deviceKey = String(entry.dataKey ?? '').replace(`${metricKey}_`, '')
                      return allDevices.find(d => d.key === deviceKey)?.nom ?? deviceKey
                    }}
                  />
                )}
                {lines.map(l => (
                  <Line
                    key={l.key}
                    type="monotone"
                    dataKey={l.dataKey}
                    stroke={l.color}
                    dot={false}
                    strokeWidth={1.5}
                    connectNulls
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        )
      })}
    </div>
  )
}
