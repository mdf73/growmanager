import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import {
  Leaf, Wind, Package, Sprout, Beaker,
  TrendingUp, Scissors, Thermometer, Wifi, WifiOff, Droplets,
} from 'lucide-react'
import { dashboardAPI, DashboardFullStats, BoxArrosageStats } from '../api/dashboard'
import { capteursAPI, GoveeDevice } from '../api/capteurs'
import LoadingSpinner from '../components/LoadingSpinner'

// ── Helpers ────────────────────────────────────────────────────────────────────

function formatGrams(g: number): string {
  if (g >= 1000) return `${(g / 1000).toFixed(2)} Kg`
  return `${g.toFixed(1)} g`
}

function dureeLabel(min?: number, max?: number, unit = 'j'): string | null {
  if (min == null && max == null) return null
  if (min === max || max == null) return `${min} ${unit}`
  if (min == null) return `${max} ${unit}`
  return `${min} → ${max} ${unit}`
}

function harvestLabel(min?: number, max?: number): { text: string; color: string } {
  if (min == null && max == null) return { text: '—', color: 'text-gray-400 dark:text-gray-500' }
  const lo = min ?? max!
  const hi = max ?? min!
  if (hi <= 0) return { text: 'Toutes récoltables', color: 'text-green-600' }
  if (lo <= 0 && hi > 0) return { text: `dans 0 → ${hi} j`, color: 'text-amber-600' }
  return { text: `dans ${lo} → ${hi} j`, color: 'text-sky-600' }
}

// ── Module générique ───────────────────────────────────────────────────────────

interface ModuleProps {
  onClick?: () => void
  children: React.ReactNode
  className?: string
  clickable?: boolean
}
function Module({ onClick, children, className = '', clickable = true }: ModuleProps) {
  const base = `bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm p-5 flex flex-col gap-3 ${className}`
  if (onClick && clickable) {
    return (
      <div
        onClick={onClick}
        className={`${base} cursor-pointer hover:shadow-md hover:border-gray-200 dark:border-gray-700 transition-all`}
      >
        {children}
      </div>
    )
  }
  return <div className={base}>{children}</div>
}

function ModuleTitle({ icon, label, color = 'text-gray-700 dark:text-gray-200' }: { icon: React.ReactNode; label: string; color?: string }) {
  return (
    <div className={`flex items-center gap-2 font-semibold text-sm ${color}`}>
      {icon}
      {label}
    </div>
  )
}

function StatRow({ label, value, sub, valueColor = 'text-gray-900 dark:text-gray-100' }: {
  label: string; value: string | React.ReactNode; sub?: string; valueColor?: string
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500">{label}</span>
      <div className="text-right">
        <span className={`text-sm font-semibold ${valueColor}`}>{value}</span>
        {sub && <p className="text-xs text-gray-400 dark:text-gray-500">{sub}</p>}
      </div>
    </div>
  )
}

function BigNum({ value, label, color = 'text-gray-900 dark:text-gray-100' }: { value: number | string; label: string; color?: string }) {
  return (
    <div className="text-center">
      <div className={`text-3xl font-bold ${color}`}>{value}</div>
      <div className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{label}</div>
    </div>
  )
}

// ── Module 1 : Cultures actives (avec arrosage) ───────────────────────────────
function ModuleCultures({ stats, onClick, className }: { stats: DashboardFullStats; onClick: () => void; className?: string }) {
  const harvest    = harvestLabel(stats.harvest_restant_jours_min, stats.harvest_restant_jours_max)
  const totalPlants = stats.nb_plants_veg + stats.nb_plants_flo

  const { data: arrosageBoxes = [] } = useQuery<BoxArrosageStats[]>({
    queryKey: ['dashboard-arrosage-boxes'],
    queryFn:  async () => (await dashboardAPI.getArrosageBoxes()).data,
    refetchInterval: 60_000,
  })

  return (
    <Module onClick={onClick} className={className}>
      <ModuleTitle icon={<Leaf size={16} />} label="Cultures en cours" color="text-green-700" />

      {/* Compteurs principaux */}
      <div className="grid grid-cols-3 gap-3 border-b border-gray-50 dark:border-gray-700 pb-3">
        <BigNum value={stats.nb_cultures_actives} label="cultures" color="text-green-700" />
        <BigNum value={totalPlants} label="plantes" color="text-gray-700 dark:text-gray-200" />
        <BigNum value={stats.nb_plants_flo} label="en floraison" color="text-amber-600" />
      </div>

      {/* Détail croissance */}
      <div className="space-y-2">
        {stats.nb_plants_veg > 0 && (
          <StatRow
            label={`🌱 Croissance (${stats.nb_plants_veg} plante${stats.nb_plants_veg > 1 ? 's' : ''})`}
            value={dureeLabel(stats.veg_jours_min, stats.veg_jours_max) ?? '—'}
            sub="jours depuis germination"
          />
        )}
        {stats.nb_plants_flo > 0 && (
          <StatRow
            label={`🌸 Floraison (${stats.nb_plants_flo} plante${stats.nb_plants_flo > 1 ? 's' : ''})`}
            value={dureeLabel(stats.flo_jours_min, stats.flo_jours_max) ?? '—'}
            sub="jours de floraison"
          />
        )}
        {stats.nb_plants_flo > 0 && (
          <StatRow
            label="⏳ Récolte prévue"
            value={harvest.text}
            valueColor={harvest.color}
          />
        )}
        {totalPlants === 0 && (
          <p className="text-xs text-gray-400 dark:text-gray-500 text-center py-2">Aucune culture active</p>
        )}
      </div>

      {/* Arrosage par culture */}
      {arrosageBoxes.length > 0 && (
        <div className="border-t border-gray-100 dark:border-gray-700 pt-3 space-y-1">
          <div className="flex items-center gap-1.5 mb-2">
            <Droplets size={13} className="text-blue-500" />
            <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 dark:text-gray-500 uppercase tracking-wide">Dernier arrosage</span>
          </div>
          {arrosageBoxes.map(b => (
            <BoxArrosageRow key={b.id_culture} box={b} />
          ))}
        </div>
      )}
    </Module>
  )
}

// ── Module 2 : Séchage ─────────────────────────────────────────────────────────
function ModuleSechage({ stats, onClick, className }: { stats: DashboardFullStats; onClick: () => void; className?: string }) {
  return (
    <Module onClick={onClick} className={className}>
      <ModuleTitle icon={<Wind size={16} />} label="Séchage" color="text-sky-700" />
      <div className="flex items-center justify-between">
        <BigNum value={stats.nb_plants_sechage} label={`plante${stats.nb_plants_sechage !== 1 ? 's' : ''}`} color="text-sky-700" />
        <div className="text-right">
          {stats.nb_plants_sechage > 0 ? (
            <>
              <div className="text-sm font-semibold text-gray-700 dark:text-gray-200">
                {dureeLabel(stats.sechage_jours_min, stats.sechage_jours_max) ?? '—'}
              </div>
              <div className="text-xs text-gray-400 dark:text-gray-500">jours de séchage</div>
            </>
          ) : (
            <span className="text-xs text-gray-400 dark:text-gray-500">Aucune en séchage</span>
          )}
        </div>
      </div>

      {/* T° & Humidité ambiante */}
      {(stats.sechage_temp_moy != null || stats.sechage_hum_moy != null) && (
        <div className="border-t border-gray-100 dark:border-gray-700 pt-3 space-y-1.5">
          {stats.sechage_temp_moy != null && (
            <StatRow
              label="🌡 T° ambiante"
              value={`${stats.sechage_temp_moy.toFixed(1)} °C`}
              valueColor="text-orange-600"
            />
          )}
          {stats.sechage_hum_moy != null && (
            <StatRow
              label="💧 Humidité"
              value={`${stats.sechage_hum_moy.toFixed(0)} %`}
              valueColor="text-blue-600"
            />
          )}
          <p className="text-xs text-gray-400 dark:text-gray-500">moyenne capteurs actifs</p>
        </div>
      )}
    </Module>
  )
}

// ── Module 3 : Curing ──────────────────────────────────────────────────────────
function bocaColor(jours?: number): string {
  if (jours == null) return 'text-gray-400 dark:text-gray-500'
  if (jours === 0)   return 'text-green-600'
  if (jours <= 3)    return 'text-green-600'
  if (jours <= 7)    return 'text-amber-600'
  return 'text-red-600'
}

function bocaLabel(jours?: number): string {
  if (jours == null) return '—'
  if (jours === 0)   return "Aujourd'hui"
  if (jours === 1)   return 'Hier'
  return `il y a ${jours} j`
}

function ModuleCuring({ stats, onClick, className }: { stats: DashboardFullStats; onClick: () => void; className?: string }) {
  return (
    <Module onClick={onClick} className={className}>
      <ModuleTitle icon={<Scissors size={16} />} label="Curing" color="text-purple-700" />
      <div className="flex items-center justify-between">
        <BigNum value={stats.nb_plants_curing} label={`plante${stats.nb_plants_curing !== 1 ? 's' : ''}`} color="text-purple-700" />
        <div className="text-right">
          {stats.nb_plants_curing > 0 ? (
            <>
              <div className="text-sm font-semibold text-gray-700 dark:text-gray-200">
                {dureeLabel(stats.curing_jours_min, stats.curing_jours_max) ?? '—'}
              </div>
              <div className="text-xs text-gray-400 dark:text-gray-500">jours de curing</div>
            </>
          ) : (
            <span className="text-xs text-gray-400 dark:text-gray-500">Aucune en curing</span>
          )}
        </div>
      </div>

      {/* Dernière ouverture bocal */}
      {stats.nb_plants_curing > 0 && (
        <div className="border-t border-gray-100 dark:border-gray-700 pt-3">
          <StatRow
            label="🫙 Dernier burping"
            value={bocaLabel(stats.curing_jours_bocal)}
            valueColor={bocaColor(stats.curing_jours_bocal)}
          />
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">bocal le plus en retard</p>
        </div>
      )}
    </Module>
  )
}

// ── Module 4 : Stock ───────────────────────────────────────────────────────────
function ModuleStock({ stats, onClick }: { stats: DashboardFullStats; onClick: () => void }) {
  return (
    <Module onClick={onClick}>
      <ModuleTitle icon={<Package size={16} />} label="Stock" color="text-gray-700 dark:text-gray-200" />
      <div className="space-y-2">
        <StatRow
          label="Total global"
          value={formatGrams(stats.stock_total_g)}
          valueColor="text-gray-900 dark:text-gray-100"
        />
        <div className="border-t border-gray-50 dark:border-gray-700 pt-2 space-y-1.5">
          <StatRow
            label="🌿 Herbe"
            value={formatGrams(stats.stock_herbe_g)}
            valueColor="text-green-700"
          />
          <StatRow
            label="🍫 Hash"
            value={formatGrams(stats.stock_hash_g)}
            valueColor="text-amber-700"
          />
          <StatRow
            label="🍯 Rosin"
            value={formatGrams(stats.stock_rosin_g)}
            valueColor="text-orange-700"
          />
        </div>
      </div>
    </Module>
  )
}

// ── Module 5 : Production ─────────────────────────────────────────────────────
function ModuleProduction({ stats, onClick }: { stats: DashboardFullStats; onClick: () => void }) {
  const anneeLabel = new Date().getFullYear().toString()
  const moisLabel  = new Date().toLocaleString('fr-FR', { month: 'long' })
  const hasData    = stats.production_annee_g > 0 || stats.nb_recoltes_annee > 0

  return (
    <Module onClick={onClick}>
      <ModuleTitle icon={<TrendingUp size={16} />} label="Production" color="text-teal-700" />
      {hasData ? (
        <div className="space-y-2">
          <StatRow
            label={`Année ${anneeLabel}`}
            value={formatGrams(stats.production_annee_g)}
            sub={`${stats.nb_recoltes_annee} récolte${stats.nb_recoltes_annee > 1 ? 's' : ''}`}
            valueColor="text-teal-700"
          />
          <div className="border-t border-gray-50 dark:border-gray-700 pt-2 space-y-1.5">
            <StatRow
              label={`🗓 ${moisLabel.charAt(0).toUpperCase() + moisLabel.slice(1)}`}
              value={formatGrams(stats.production_mois_g)}
              valueColor="text-gray-700 dark:text-gray-200"
            />
            <StatRow
              label="📅 30 derniers jours"
              value={formatGrams(stats.production_30j_g)}
              valueColor="text-gray-700 dark:text-gray-200"
            />
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-center py-4">
          <p className="text-xs text-gray-400 dark:text-gray-500 text-center">Aucune récolte enregistrée cette année</p>
        </div>
      )}
    </Module>
  )
}

// ── Module 6 : Graines ─────────────────────────────────────────────────────────
function ModuleGraines({ stats, onClick }: { stats: DashboardFullStats; onClick: () => void }) {
  const autres = stats.graines_disponibles - stats.graines_regulieres - stats.graines_feminisees

  return (
    <Module onClick={onClick}>
      <ModuleTitle icon={<Sprout size={16} />} label="Graines" color="text-lime-700" />

      {/* Total centré */}
      <div className="flex items-center justify-center border-b border-gray-50 dark:border-gray-700 pb-3">
        <BigNum
          value={stats.graines_disponibles}
          label={`graine${stats.graines_disponibles !== 1 ? 's' : ''} disponible${stats.graines_disponibles !== 1 ? 's' : ''}`}
          color="text-lime-700"
        />
      </div>

      {/* Détail */}
      <div className="space-y-1.5">
        <StatRow label="🌸 Féminisées"  value={`${stats.graines_feminisees}`}  valueColor="text-pink-600" />
        <StatRow label="🌿 Régulières"  value={`${stats.graines_regulieres}`}  valueColor="text-green-700" />
        {autres > 0 && (
          <StatRow label="• Autres" value={`${autres}`} valueColor="text-gray-500 dark:text-gray-400 dark:text-gray-500" />
        )}
        <div className="border-t border-gray-50 dark:border-gray-700 pt-1.5">
          <StatRow
            label="🌱 Variétés"
            value={`${stats.nb_varietes_graines}`}
            valueColor="text-lime-700"
          />
          {stats.valeur_graines_eur != null && (
            <StatRow
              label="💶 Valeur"
              value={`${stats.valeur_graines_eur.toFixed(2)} €`}
              valueColor="text-amber-700"
            />
          )}
        </div>
      </div>
    </Module>
  )
}

// ── Module 7 : Capteurs Govee ─────────────────────────────────────────────────

function vpdColor(vpd?: number): string {
  if (vpd == null) return 'text-gray-400 dark:text-gray-500'
  if (vpd < 0.4)  return 'text-blue-500'
  if (vpd < 0.8)  return 'text-green-500'
  if (vpd < 1.2)  return 'text-green-600'
  if (vpd < 1.6)  return 'text-amber-500'
  return 'text-red-500'
}

function SensorMiniCard({
  device,
  onClick,
}: {
  device: GoveeDevice
  onClick: () => void
}) {
  const isRecent = device.derniere_lecture
    ? (Date.now() - new Date(device.derniere_lecture).getTime()) < 15 * 60 * 1000
    : false

  return (
    <button
      onClick={onClick}
      className="w-full text-left p-3 rounded-lg border border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50
                 hover:bg-teal-50 hover:border-teal-200 transition-colors"
    >
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-semibold text-gray-700 dark:text-gray-200 truncate">{device.nom}</span>
        {isRecent
          ? <Wifi size={11} className="text-green-500 shrink-0" />
          : <WifiOff size={11} className="text-gray-300 shrink-0" />}
      </div>
      {device.derniere_temperature != null ? (
        <div className="flex gap-2 text-xs">
          <span className="text-orange-600 font-bold">
            {device.derniere_temperature.toFixed(1)}°C
          </span>
          <span className="text-blue-600 font-bold">
            {device.derniere_humidite?.toFixed(0)}%
          </span>
          <span className={`font-bold ${vpdColor(device.derniere_vpd)}`}>
            {device.derniere_vpd?.toFixed(2)} kPa
          </span>
        </div>
      ) : (
        <span className="text-xs text-gray-400 dark:text-gray-500">Aucune donnée</span>
      )}
      {device.nom_espace && (
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5 truncate">{device.nom_espace}</p>
      )}
    </button>
  )
}

function ModuleCapteurs({ onClick }: { onClick: () => void }) {
  const { data: devices = [] } = useQuery<GoveeDevice[]>({
    queryKey: ['capteurs'],
    queryFn: async () => (await capteursAPI.getAll()).data,
    refetchInterval: 5 * 60 * 1000,
  })

  const actifs = devices.filter(d => d.actif)

  return (
    <div
      onClick={onClick}
      className="bg-white dark:bg-gray-800 rounded-2xl p-4 border border-gray-100 dark:border-gray-700 shadow-sm
                 cursor-pointer hover:shadow-md transition-shadow col-span-1 sm:col-span-3"
    >
      <div className="flex items-center gap-2 mb-3">
        <Thermometer size={16} className="text-teal-600" />
        <span className="font-semibold text-sm text-teal-700">Capteurs</span>
        <span className="ml-auto text-xs text-gray-400 dark:text-gray-500">
          {actifs.length} capteur{actifs.length !== 1 ? 's' : ''} actif{actifs.length !== 1 ? 's' : ''}
        </span>
      </div>

      {actifs.length === 0 ? (
        <p className="text-xs text-gray-400 dark:text-gray-500 text-center py-2">
          Aucun capteur configuré — voir Paramétrage
        </p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {actifs.map(d => (
            <SensorMiniCard key={d.id_device} device={d} onClick={onClick} />
          ))}
        </div>
      )}
    </div>
  )
}

// ── Module 8 : Arrosage des boxes ────────────────────────────────────────────

function arrosageColor(jours?: number): { badge: string; text: string } {
  if (jours == null)  return { badge: 'bg-gray-100 text-gray-400 dark:text-gray-500',   text: 'text-gray-400 dark:text-gray-500' }
  if (jours === 0)    return { badge: 'bg-green-100 text-green-700', text: 'text-green-700' }
  if (jours <= 2)     return { badge: 'bg-green-50 text-green-600',  text: 'text-green-600' }
  if (jours <= 4)     return { badge: 'bg-amber-100 text-amber-700', text: 'text-amber-700' }
  return               { badge: 'bg-red-100 text-red-600',           text: 'text-red-600'   }
}

function arrosageLabel(jours?: number): string {
  if (jours == null) return 'Jamais arrosé'
  if (jours === 0)   return "Aujourd'hui"
  if (jours === 1)   return 'Hier'
  return `il y a ${jours} j`
}

function BoxArrosageRow({ box }: { box: BoxArrosageStats }) {
  const colors = arrosageColor(box.jours_depuis_arrosage)
  return (
    <div className="flex items-center justify-between py-2 border-b border-gray-50 dark:border-gray-700 last:border-0">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-gray-800 dark:text-gray-100 truncate">{box.culture_nom}</p>
        {box.box_label && (
          <p className="text-xs text-gray-400 dark:text-gray-500">{box.box_label}</p>
        )}
      </div>
      <span className={`ml-3 shrink-0 text-xs font-bold px-2 py-1 rounded-full ${colors.badge}`}>
        {arrosageLabel(box.jours_depuis_arrosage)}
      </span>
    </div>
  )
}

// ── Page principale ────────────────────────────────────────────────────────────
export default function Dashboard() {
  const navigate = useNavigate()

  const { data: stats, isLoading, isError } = useQuery<DashboardFullStats>({
    queryKey: ['dashboard-stats'],
    queryFn:  async () => (await dashboardAPI.getStats()).data,
    refetchInterval: 60_000, // actualise toutes les minutes
  })

  if (isLoading) return <LoadingSpinner />
  if (isError || !stats) {
    return (
      <div className="text-center py-16 text-gray-400 dark:text-gray-500">
        <Beaker size={40} className="mx-auto mb-3 opacity-30" />
        <p className="text-sm">Impossible de charger le tableau de bord.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Titre */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Tableau de bord</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500 mt-0.5">Vue d'ensemble de votre culture</p>
      </div>

      {/* Ligne 1 : Capteurs Govee (pleine largeur) */}
      <div className="grid grid-cols-1 gap-4">
        <ModuleCapteurs onClick={() => navigate('/suivi-constantes')} />
      </div>

      {/* Ligne 2 : Culture (large) + Séchage & Curing empilés */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-stretch">
        {/* Module 1 : Cultures — prend 2 colonnes sur desktop */}
        <div className="lg:col-span-2 h-full">
          <ModuleCultures stats={stats} onClick={() => navigate('/culture')} className="h-full" />
        </div>

        {/* Modules 2 & 3 : Séchage + Curing — empilés dans la 3e colonne, même hauteur que Cultures */}
        <div className="flex flex-col gap-4 h-full">
          <ModuleSechage stats={stats} onClick={() => navigate('/sechage-curing')} className="flex-1" />
          <ModuleCuring  stats={stats} onClick={() => navigate('/sechage-curing?tab=curing')} className="flex-1" />
        </div>
      </div>

      {/* Ligne 3 : Stock + Production + Graines */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <ModuleStock      stats={stats} onClick={() => navigate('/stock')} />
        <ModuleProduction stats={stats} onClick={() => navigate('/historique-cultures')} />
        <ModuleGraines    stats={stats} onClick={() => navigate('/graines')} />
      </div>

    </div>
  )
}
