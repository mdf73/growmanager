import { useQuery } from '@tanstack/react-query'
import { actionAPI, Stats } from '../../api/cultures'
import { BarChart2, Droplets, Zap } from 'lucide-react'
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'

interface Props { cultureId: number }

const ARROSAGE_COLORS: Record<string, string> = {
  arrosage_eau:    '#60a5fa',
  arrosage_engrais:'#34d399',
  arrosage_tco:    '#a78bfa',
  arrosage_aptus:  '#f97316',
}

export default function StatsTab({ cultureId }: Props) {
  const { data: stats, isLoading } = useQuery<Stats>({
    queryKey: ['stats', cultureId],
    queryFn: async () => (await actionAPI.getStats(cultureId)).data,
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

  return (
    <div className="space-y-8">
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
              <Line dataKey="puissance_apres" name="Intensité après" stroke="#eab308" strokeWidth={2} dot={{ r: 3 }} />
              <Line dataKey="puissance_avant" name="Intensité avant" stroke="#fde68a" strokeWidth={1} dot={false} strokeDasharray="4 2" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}
