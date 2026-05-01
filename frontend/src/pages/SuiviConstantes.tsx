/**
 * Page "Suivi des Constantes" — température, humidité, VPD par capteur
 * Graphiques recharts avec fenêtre temporelle sélectionnable
 */
import { useState, useMemo, useRef } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from 'recharts'
import { Thermometer, Droplets, Wind, RefreshCw, Wifi, WifiOff, Upload, CheckCircle, AlertCircle, X } from 'lucide-react'
import { capteursAPI, GoveeDevice, TemperatureLog, CsvImportResult } from '../api/capteurs'

// ── Helpers ───────────────────────────────────────────────────────────────────

const WINDOWS = [
  { label: '6h',   heures: 6   },
  { label: '24h',  heures: 24  },
  { label: '48h',  heures: 48  },
  { label: '7j',   heures: 168 },
  { label: '30j',  heures: 720 },
]

function formatDate(iso: string, heures: number): string {
  const d = new Date(iso)
  if (heures <= 48) {
    // Données brutes 5min → heure:minute
    return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
  }
  if (heures <= 336) {
    // Données horaires 7j → "Lun 14h"
    return d.toLocaleDateString('fr-FR', { weekday: 'short', hour: '2-digit' }).replace(' ', ' ').replace(':00', 'h')
  }
  // Données horaires 30j → "14/03 14h"
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit' }).replace(' ', ' ').replace(':00', 'h')
}

function vpdColor(vpd?: number): string {
  if (vpd == null) return 'text-gray-400 dark:text-gray-500'
  if (vpd < 0.4)  return 'text-blue-500'   // trop humide
  if (vpd < 0.8)  return 'text-green-500'  // seedling/clone
  if (vpd < 1.2)  return 'text-green-600'  // veg/early flo
  if (vpd < 1.6)  return 'text-amber-500'  // late flo
  return 'text-red-500'                     // trop sec
}

function vpdZone(vpd?: number): string {
  if (vpd == null) return '—'
  if (vpd < 0.4)  return 'Trop humide'
  if (vpd < 0.8)  return 'Clone / Semis'
  if (vpd < 1.2)  return 'Végétation / Flo'
  if (vpd < 1.6)  return 'Fin floraison'
  return 'Trop sec'
}

// ── Composant carte capteur live ──────────────────────────────────────────────

function SensorCard({
  device,
  selected,
  onClick,
}: {
  device: GoveeDevice
  selected: boolean
  onClick: () => void
}) {
  const isRecent = device.derniere_lecture
    ? (Date.now() - new Date(device.derniere_lecture).getTime()) < 15 * 60 * 1000
    : false

  return (
    <button
      onClick={onClick}
      className={`
        w-full text-left p-4 rounded-xl border-2 transition-all
        ${selected
          ? 'border-teal-500 bg-teal-50 shadow-md'
          : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-teal-300 hover:shadow'}
      `}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="font-semibold text-gray-800 dark:text-gray-100 text-sm truncate">{device.nom}</span>
        {isRecent
          ? <Wifi size={14} className="text-green-500 shrink-0" />
          : <WifiOff size={14} className="text-gray-300 shrink-0" />
        }
      </div>
      {device.nom_espace && (
        <p className="text-xs text-gray-400 dark:text-gray-500 mb-2">{device.nom_espace}</p>
      )}

      {device.derniere_temperature != null ? (
        <div className="grid grid-cols-3 gap-1">
          <div className="text-center">
            <p className="text-lg font-bold text-orange-600">
              {device.derniere_temperature?.toFixed(1)}°
            </p>
            <p className="text-xs text-gray-400 dark:text-gray-500">Temp</p>
          </div>
          <div className="text-center">
            <p className="text-lg font-bold text-blue-600">
              {device.derniere_humidite?.toFixed(0)}%
            </p>
            <p className="text-xs text-gray-400 dark:text-gray-500">Hum</p>
          </div>
          <div className="text-center">
            <p className={`text-lg font-bold ${vpdColor(device.derniere_vpd)}`}>
              {device.derniere_vpd?.toFixed(2)}
            </p>
            <p className="text-xs text-gray-400 dark:text-gray-500">VPD</p>
          </div>
        </div>
      ) : (
        <p className="text-xs text-gray-400 dark:text-gray-500 text-center py-1">Aucune donnée</p>
      )}
    </button>
  )
}

// ── Graphique ─────────────────────────────────────────────────────────────────

function SensorChart({
  device,
  heures,
}: {
  device: GoveeDevice
  heures: number
}) {
  const [showPrevYear, setShowPrevYear] = useState(false)

  // Fenêtre courante
  const { data: logs = [], isLoading } = useQuery<TemperatureLog[]>({
    queryKey: ['temp-logs', device.id_device, heures],
    queryFn: async () =>
      (await capteursAPI.getLogs({ id_device: device.id_device, heures })).data,
    refetchInterval: 5 * 60 * 1000,
  })

  // Même fenêtre, décalée de 365 jours en arrière
  const prevDateFin   = useMemo(() => {
    const d = new Date(); d.setFullYear(d.getFullYear() - 1); return d.toISOString()
  }, [])
  const prevDateDebut = useMemo(() => {
    const d = new Date(prevDateFin); d.setTime(d.getTime() - heures * 3600 * 1000); return d.toISOString()
  }, [prevDateFin, heures])

  const { data: prevLogs = [] } = useQuery<TemperatureLog[]>({
    queryKey: ['temp-logs-prev', device.id_device, heures],
    queryFn: async () =>
      (await capteursAPI.getLogs({
        id_device:  device.id_device,
        date_debut: prevDateDebut,
        date_fin:   prevDateFin,
      })).data,
    staleTime: 30 * 60 * 1000, // les données passées changent pas → cache 30 min
  })

  const hasPrevData = prevLogs.length > 0

  // Fusion des deux séries par position relative dans la fenêtre
  const chartData = useMemo(() => {
    const prevYear = new Date(prevDateFin).getFullYear()
    return logs.map((l, i) => ({
      ts:          l.date_heure,
      label:       formatDate(l.date_heure, heures),
      temperature: l.temperature != null ? Number(l.temperature.toFixed(1)) : null,
      humidite:    l.humidite    != null ? Number(l.humidite.toFixed(1))    : null,
      vpd:         l.vpd         != null ? Number(l.vpd.toFixed(3))         : null,
      temperature_prev: prevLogs[i]?.temperature != null ? Number(prevLogs[i].temperature!.toFixed(1)) : null,
      humidite_prev:    prevLogs[i]?.humidite    != null ? Number(prevLogs[i].humidite!.toFixed(1))    : null,
      vpd_prev:         prevLogs[i]?.vpd         != null ? Number(prevLogs[i].vpd!.toFixed(3))         : null,
      _prevYear: prevYear,
    }))
  }, [logs, prevLogs, heures, prevDateFin])

  if (isLoading) return (
    <div className="h-64 flex items-center justify-center text-gray-400 dark:text-gray-500 text-sm">
      Chargement…
    </div>
  )

  if (chartData.length === 0) return (
    <div className="h-64 flex items-center justify-center text-gray-400 dark:text-gray-500 text-sm">
      Aucune donnée sur la période sélectionnée
    </div>
  )

  const aggrLabel = heures > 48
    ? <span className="ml-2 normal-case font-normal text-gray-400 dark:text-gray-500">(moyennes horaires)</span>
    : null

  const prevYear = new Date(prevDateFin).getFullYear()

  const xAxis = (
    <XAxis
      dataKey="label"
      tick={{ fontSize: 10, fill: '#9ca3af' }}
      interval="preserveStartEnd"
    />
  )

  // Légende années précédentes (commune aux 3 graphiques)
  const yearLegend = hasPrevData && (
    <div className="flex items-center gap-4 mb-4">
      {/* Trait plein = année courante */}
      <span className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500">
        <svg width="24" height="8"><line x1="0" y1="4" x2="24" y2="4" stroke="#6b7280" strokeWidth="2"/></svg>
        {new Date().getFullYear()}
      </span>
      {/* Trait pointillé = année N-1 */}
      <span className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500">
        <svg width="24" height="8"><line x1="0" y1="4" x2="24" y2="4" stroke="#9ca3af" strokeWidth="2" strokeDasharray="4 3"/></svg>
        {prevYear}
      </span>
      <button
        onClick={() => setShowPrevYear(v => !v)}
        className={`ml-auto text-xs px-2 py-0.5 rounded-full border transition-colors
          ${showPrevYear
            ? 'bg-gray-700 text-white border-gray-700'
            : 'bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 dark:text-gray-500 border-gray-300 dark:border-gray-600 hover:border-gray-500'}`}
      >
        {showPrevYear ? `Masquer ${prevYear}` : `Afficher ${prevYear}`}
      </button>
    </div>
  )

  return (
    <div className="space-y-5">

      {yearLegend}

      {/* ── Température ── */}
      <div>
        <p className="text-xs font-semibold text-orange-600 mb-2 uppercase tracking-wide">
          Température (°C){aggrLabel}
        </p>
        <ResponsiveContainer width="100%" height={180}>
          <LineChart data={chartData} margin={{ top: 4, right: 16, bottom: 4, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f5f5f5" />
            {xAxis}
            <YAxis
              tick={{ fontSize: 10, fill: '#ea580c' }}
              domain={['auto', 'auto']}
              width={36}
              unit="°"
            />
            <Tooltip
              formatter={(val: number, name: string) => [
                `${val}°C`,
                name === 'temperature_prev' ? `Température (${prevYear})` : 'Température',
              ]}
              labelStyle={{ fontSize: 11 }}
              contentStyle={{ fontSize: 11, borderRadius: 8 }}
            />
            <Line
              type="monotone"
              dataKey="temperature"
              name="Température"
              stroke="#ea580c"
              dot={false}
              strokeWidth={2}
              connectNulls
            />
            {showPrevYear && hasPrevData && (
              <Line
                type="monotone"
                dataKey="temperature_prev"
                name="temperature_prev"
                stroke="#ea580c"
                strokeOpacity={0.45}
                strokeDasharray="5 4"
                dot={false}
                strokeWidth={1.5}
                connectNulls
              />
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* ── Humidité ── */}
      <div>
        <p className="text-xs font-semibold text-blue-600 mb-2 uppercase tracking-wide">
          Humidité (%RH){aggrLabel}
        </p>
        <ResponsiveContainer width="100%" height={180}>
          <LineChart data={chartData} margin={{ top: 4, right: 16, bottom: 4, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f5f5f5" />
            {xAxis}
            <YAxis
              tick={{ fontSize: 10, fill: '#2563eb' }}
              domain={[0, 100]}
              width={36}
              unit="%"
            />
            <Tooltip
              formatter={(val: number, name: string) => [
                `${val}%`,
                name === 'humidite_prev' ? `Humidité (${prevYear})` : 'Humidité',
              ]}
              labelStyle={{ fontSize: 11 }}
              contentStyle={{ fontSize: 11, borderRadius: 8 }}
            />
            <Line
              type="monotone"
              dataKey="humidite"
              name="Humidité"
              stroke="#2563eb"
              dot={false}
              strokeWidth={2}
              connectNulls
            />
            {showPrevYear && hasPrevData && (
              <Line
                type="monotone"
                dataKey="humidite_prev"
                name="humidite_prev"
                stroke="#2563eb"
                strokeOpacity={0.45}
                strokeDasharray="5 4"
                dot={false}
                strokeWidth={1.5}
                connectNulls
              />
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* ── VPD ── */}
      <div>
        <p className="text-xs font-semibold text-emerald-600 mb-2 uppercase tracking-wide">
          VPD (kPa){aggrLabel}
        </p>
        <ResponsiveContainer width="100%" height={180}>
          <LineChart data={chartData} margin={{ top: 4, right: 16, bottom: 4, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f5f5f5" />
            {xAxis}
            <YAxis
              tick={{ fontSize: 10, fill: '#059669' }}
              domain={[0, 'auto']}
              width={36}
              unit=" kPa"
            />
            <Tooltip
              formatter={(val: number, name: string) => [
                `${val} kPa`,
                name === 'vpd_prev' ? `VPD (${prevYear})` : 'VPD',
              ]}
              labelStyle={{ fontSize: 11 }}
              contentStyle={{ fontSize: 11, borderRadius: 8 }}
            />
            <Line
              type="monotone"
              dataKey="vpd"
              name="VPD"
              stroke="#059669"
              dot={false}
              strokeWidth={2}
              connectNulls
            />
            {showPrevYear && hasPrevData && (
              <Line
                type="monotone"
                dataKey="vpd_prev"
                name="vpd_prev"
                stroke="#059669"
                strokeOpacity={0.45}
                strokeDasharray="5 4"
                dot={false}
                strokeWidth={1.5}
                connectNulls
              />
            )}
          </LineChart>
        </ResponsiveContainer>
        <div className="flex flex-wrap gap-3 mt-1">
          {[
            { range: '< 0.4',     label: 'Trop humide',   color: 'bg-blue-300'   },
            { range: '0.4–0.8',   label: 'Clone / Semis', color: 'bg-green-300'  },
            { range: '0.8–1.2',   label: 'Vég / Flo',     color: 'bg-green-500'  },
            { range: '1.2–1.6',   label: 'Fin floraison', color: 'bg-amber-400'  },
            { range: '> 1.6',     label: 'Trop sec',      color: 'bg-red-400'    },
          ].map(z => (
            <span key={z.range} className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500">
              <span className={`w-2 h-2 rounded-full shrink-0 ${z.color}`} />
              <span className="font-medium text-gray-600 dark:text-gray-300">{z.range}</span> {z.label}
            </span>
          ))}
        </div>
      </div>

    </div>
  )
}

// ── Stats live du capteur sélectionné ─────────────────────────────────────────

function LiveStats({ device }: { device: GoveeDevice }) {
  return (
    <div className="grid grid-cols-3 gap-3 mb-6">
      <div className="bg-orange-50 rounded-xl p-3 text-center">
        <Thermometer size={18} className="mx-auto text-orange-500 mb-1" />
        <p className="text-2xl font-bold text-orange-600">
          {device.derniere_temperature != null ? `${device.derniere_temperature.toFixed(1)}°C` : '—'}
        </p>
        <p className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500">Température</p>
      </div>
      <div className="bg-blue-50 rounded-xl p-3 text-center">
        <Droplets size={18} className="mx-auto text-blue-500 mb-1" />
        <p className="text-2xl font-bold text-blue-600">
          {device.derniere_humidite != null ? `${device.derniere_humidite.toFixed(0)}%` : '—'}
        </p>
        <p className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500">Humidité</p>
      </div>
      <div className="bg-green-50 rounded-xl p-3 text-center">
        <Wind size={18} className="mx-auto text-green-500 mb-1" />
        <p className={`text-2xl font-bold ${vpdColor(device.derniere_vpd)}`}>
          {device.derniere_vpd != null ? `${device.derniere_vpd.toFixed(2)}` : '—'}
        </p>
        <p className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500">VPD kPa</p>
        {device.derniere_vpd != null && (
          <p className={`text-xs font-medium mt-0.5 ${vpdColor(device.derniere_vpd)}`}>
            {vpdZone(device.derniere_vpd)}
          </p>
        )}
      </div>
    </div>
  )
}

// ── Import CSV ────────────────────────────────────────────────────────────────

function CsvImportPanel({
  device,
  onClose,
  onDone,
}: {
  device: GoveeDevice
  onClose: () => void
  onDone: (r: CsvImportResult) => void
}) {
  const [importing, setImporting] = useState(false)
  const [result, setResult]       = useState<CsvImportResult | null>(null)
  const [error, setError]         = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setImporting(true)
    setError(null)
    setResult(null)
    try {
      const res = await capteursAPI.importCsv(device.id_device, file)
      setResult(res.data)
      onDone(res.data)
    } catch (err: any) {
      setError(err?.response?.data?.detail ?? 'Erreur lors de l\'import')
    } finally {
      setImporting(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  return (
    <div className="bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-700 rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-gray-700 dark:text-gray-200">Importer l'historique CSV Govee</p>
          <p className="text-xs text-gray-400 dark:text-gray-500">
            Capteur : <span className="font-medium text-gray-600 dark:text-gray-300">{device.nom}</span>
            {' — '}Export depuis l'app Govee Home → Historique → Exporter
          </p>
        </div>
        <button onClick={onClose} className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:text-gray-300">
          <X size={16} />
        </button>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept=".csv,.txt"
        onChange={handleFile}
        className="hidden"
        id="csv-upload"
      />
      <label
        htmlFor="csv-upload"
        className={`
          flex items-center justify-center gap-2 w-full py-3 rounded-lg border-2 border-dashed
          text-sm font-medium cursor-pointer transition-colors
          ${importing
            ? 'border-gray-200 dark:border-gray-700 text-gray-400 dark:text-gray-500 pointer-events-none'
            : 'border-teal-300 text-teal-600 hover:border-teal-500 hover:bg-teal-50'}
        `}
      >
        <Upload size={16} className={importing ? 'animate-bounce' : ''} />
        {importing ? 'Import en cours…' : 'Choisir le fichier CSV'}
      </label>

      {result && (
        <div className="flex items-start gap-2 bg-green-50 border border-green-200 rounded-lg p-3">
          <CheckCircle size={16} className="text-green-500 shrink-0 mt-0.5" />
          <div className="text-xs text-green-700">
            <p className="font-semibold mb-0.5">Import terminé</p>
            <p>{result.message}</p>
          </div>
        </div>
      )}

      {error && (
        <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg p-3">
          <AlertCircle size={16} className="text-red-500 shrink-0 mt-0.5" />
          <p className="text-xs text-red-700">{error}</p>
        </div>
      )}

      <p className="text-xs text-gray-400 dark:text-gray-500">
        Les relevés déjà présents (même horodatage) sont ignorés automatiquement.
        Formats pris en charge : export Govee Home (℃ ou ℉), séparateur virgule ou point-virgule.
      </p>
    </div>
  )
}


// ── Page principale ───────────────────────────────────────────────────────────

export default function SuiviConstantes() {
  const [selectedDevice, setSelectedDevice] = useState<number | null>(null)
  const [heures, setHeures]                 = useState(168)
  const [polling, setPolling]               = useState(false)
  const [showImport, setShowImport]         = useState(false)
  const queryClient = useQueryClient()

  const { data: devices = [], refetch: refetchDevices } = useQuery<GoveeDevice[]>({
    queryKey: ['capteurs'],
    queryFn: async () => (await capteursAPI.getAll()).data,
    refetchInterval: 60_000,
  })

  const activeDevice = devices.find(d => d.id_device === selectedDevice)
    ?? (devices.length > 0 ? devices[0] : null)

  const handlePollNow = async () => {
    setPolling(true)
    try {
      await capteursAPI.pollNow()
      await refetchDevices()
    } finally {
      setPolling(false)
    }
  }

  const handleImportDone = () => {
    // Recharge les graphiques après import
    queryClient.invalidateQueries({ queryKey: ['temp-logs'] })
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100">🌡 Suivi des Constantes</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500 mt-0.5">
            Température · Humidité · VPD — Capteurs Govee H5179
          </p>
        </div>
        <div className="flex items-center gap-2">
          {activeDevice && (
            <button
              onClick={() => setShowImport(v => !v)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors
                ${showImport
                  ? 'bg-gray-200 text-gray-700 dark:text-gray-200'
                  : 'bg-gray-100 text-gray-600 dark:text-gray-300 hover:bg-gray-200'}`}
            >
              <Upload size={14} />
              Import CSV
            </button>
          )}
          <button
            onClick={handlePollNow}
            disabled={polling}
            className="flex items-center gap-2 px-3 py-2 bg-teal-600 text-white rounded-lg
                       text-sm hover:bg-teal-700 disabled:opacity-50 transition-colors"
          >
            <RefreshCw size={14} className={polling ? 'animate-spin' : ''} />
            {polling ? 'Lecture…' : 'Lire maintenant'}
          </button>
        </div>
      </div>

      {/* Panneau import CSV */}
      {showImport && activeDevice && (
        <CsvImportPanel
          device={activeDevice}
          onClose={() => setShowImport(false)}
          onDone={handleImportDone}
        />
      )}

      {devices.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-12 text-center">
          <Wifi size={40} className="mx-auto text-gray-300 mb-3" />
          <p className="text-gray-500 dark:text-gray-400 dark:text-gray-500 font-medium">Aucun capteur configuré</p>
          <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
            Ajoutez vos capteurs Govee dans la page{' '}
            <span className="text-teal-600 font-medium">Paramétrage → Capteurs Govee</span>
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          {/* Panneau gauche : liste des capteurs */}
          <div className="lg:col-span-1 space-y-2">
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-2">
              Capteurs ({devices.length})
            </p>
            {devices.map(d => (
              <SensorCard
                key={d.id_device}
                device={d}
                selected={d.id_device === (activeDevice?.id_device ?? -1)}
                onClick={() => setSelectedDevice(d.id_device)}
              />
            ))}
          </div>

          {/* Panneau droit : graphiques */}
          {activeDevice && (
            <div className="lg:col-span-3 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
              {/* Titre + espace */}
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="font-semibold text-gray-800 dark:text-gray-100">{activeDevice.nom}</h2>
                  {activeDevice.nom_espace && (
                    <p className="text-xs text-gray-400 dark:text-gray-500">{activeDevice.nom_espace}</p>
                  )}
                </div>

                {/* Sélecteur de fenêtre */}
                <div className="flex gap-1">
                  {WINDOWS.map(w => (
                    <button
                      key={w.heures}
                      onClick={() => setHeures(w.heures)}
                      className={`px-2 py-1 rounded text-xs font-medium transition-colors
                        ${heures === w.heures
                          ? 'bg-teal-600 text-white'
                          : 'bg-gray-100 text-gray-600 dark:text-gray-300 hover:bg-gray-200'
                        }`}
                    >
                      {w.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Stats live */}
              <LiveStats device={activeDevice} />

              {/* Graphiques */}
              <SensorChart device={activeDevice} heures={heures} />

              {activeDevice.derniere_lecture && (
                <p className="text-xs text-gray-400 dark:text-gray-500 text-right mt-3">
                  Dernière lecture :{' '}
                  {new Date(activeDevice.derniere_lecture).toLocaleString('fr-FR')}
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
