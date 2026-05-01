import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Sprout, Euro, TrendingUp, Users, Dna,
  Package, Scale, BarChart2, Clock, Hash,
  FlaskConical, Percent, ArrowUp, ArrowDown, Minus,
  Coffee, Calendar, CalendarDays, CalendarRange,
  Leaf, Zap, Trophy,
} from 'lucide-react'
import { catalogueAPI, CatalogueItem } from '../api/graines'
import { stockAPI, rosinAPI, hashAPI } from '../api/stock'
import type { Stock, RosinExtraction, HashExtraction } from '../api/stock'
import { historiqueCultureAPI } from '../api/historiqueCulture'
import type { HistoriqueCulture } from '../api/historiqueCulture'
import LoadingSpinner from '../components/LoadingSpinner'

// ── Petit utilitaire ─────────────────────────────────────────────────────────
function daysSince(dateStr?: string): number | null {
  if (!dateStr) return null
  const d = Math.floor((Date.now() - new Date(dateStr).getTime()) / 86_400_000)
  return d >= 0 ? d : null
}
function fmtDays(d: number | null): string {
  if (d == null) return '—'
  if (d < 30) return `${d} j`
  if (d < 365) return `${Math.floor(d / 30)} mois`
  const y = Math.floor(d / 365)
  return `${y} an${y > 1 ? 's' : ''}`
}

// ── Mini stat card ────────────────────────────────────────────────────────────
function MiniStat({
  label, value, sub, color = 'gray', icon: Icon,
}: {
  label: string
  value: string | number
  sub?: string
  color?: string
  icon?: React.ElementType
}) {
  const bg: Record<string, string> = {
    grow:   'bg-grow-50',   purple: 'bg-purple-50',
    blue:   'bg-blue-50',   amber:  'bg-amber-50',
    orange: 'bg-orange-50', teal:   'bg-teal-50',
    rose:   'bg-rose-50',   gray:   'bg-gray-50 dark:bg-gray-700/50',
    green:  'bg-green-50',  indigo: 'bg-indigo-50',
  }
  const txt: Record<string, string> = {
    grow:   'text-grow-700',   purple: 'text-purple-700',
    blue:   'text-blue-700',   amber:  'text-amber-700',
    orange: 'text-orange-700', teal:   'text-teal-700',
    rose:   'text-rose-700',   gray:   'text-gray-700 dark:text-gray-200',
    green:  'text-green-700',  indigo: 'text-indigo-700',
  }
  const sub_: Record<string, string> = {
    grow:   'text-grow-400',   purple: 'text-purple-400',
    blue:   'text-blue-400',   amber:  'text-amber-400',
    orange: 'text-orange-400', teal:   'text-teal-400',
    rose:   'text-rose-400',   gray:   'text-gray-400 dark:text-gray-500',
    green:  'text-green-400',  indigo: 'text-indigo-400',
  }
  const icon_: Record<string, string> = {
    grow:   'text-grow-500',   purple: 'text-purple-500',
    blue:   'text-blue-500',   amber:  'text-amber-500',
    orange: 'text-orange-500', teal:   'text-teal-500',
    rose:   'text-rose-500',   gray:   'text-gray-500 dark:text-gray-400 dark:text-gray-500',
    green:  'text-green-500',  indigo: 'text-indigo-500',
  }
  return (
    <div className={`${bg[color] ?? bg.gray} rounded-xl p-4`}>
      {Icon && (
        <div className={`flex items-center gap-1.5 mb-1 ${icon_[color] ?? icon_.gray}`}>
          <Icon size={13} />
          <span className="text-xs font-semibold uppercase tracking-wide">{label}</span>
        </div>
      )}
      {!Icon && <p className={`text-xs font-semibold uppercase tracking-wide mb-1 ${sub_[color]}`}>{label}</p>}
      <p className={`text-2xl font-bold ${txt[color] ?? txt.gray}`}>{value}</p>
      {sub && <p className={`text-xs mt-0.5 ${sub_[color] ?? sub_.gray}`}>{sub}</p>}
    </div>
  )
}

// ── En-tête de module ─────────────────────────────────────────────────────────
function ModuleHeader({
  icon: Icon, title, badge, children,
}: {
  icon: React.ElementType
  title: string
  badge?: string
  children?: React.ReactNode
}) {
  return (
    <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700 flex items-center gap-3">
      <div className="p-2 bg-grow-50 rounded-lg">
        <Icon size={20} className="text-grow-600" />
      </div>
      <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">{title}</h2>
      {badge && <span className="ml-1 text-xs text-gray-400 dark:text-gray-500">{badge}</span>}
      {children && <div className="ml-auto">{children}</div>}
    </div>
  )
}

// ── Sélecteur d'année ─────────────────────────────────────────────────────────
function YearSelect({ years, value, onChange }: {
  years: number[]
  value: number | 'all'
  onChange: (y: number | 'all') => void
}) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value === 'all' ? 'all' : parseInt(e.target.value))}
      className="text-sm border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-grow-400 bg-white dark:bg-gray-800"
    >
      <option value="all">Toutes les années</option>
      {years.map(y => <option key={y} value={y}>{y}</option>)}
    </select>
  )
}

// ── Ligne séparatrice dans un module ─────────────────────────────────────────
function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-3">{children}</p>
  )
}


// ═══════════════════════════════════════════════════════════════════════════════
// PAGE
// ═══════════════════════════════════════════════════════════════════════════════
export default function Statistiques() {

  // ── Données ────────────────────────────────────────────────────────────────
  const { data: catalogue = [], isLoading: catLoading } = useQuery<CatalogueItem[]>({
    queryKey: ['catalogue'],
    queryFn:  async () => (await catalogueAPI.get()).data,
  })
  const { data: stocks = [], isLoading: stLoading } = useQuery<Stock[]>({
    queryKey: ['stock'],
    queryFn:  async () => (await stockAPI.getAll()).data,
  })
  const { data: extractions = [], isLoading: exLoading } = useQuery<RosinExtraction[]>({
    queryKey: ['rosin-extractions'],
    queryFn:  async () => (await rosinAPI.getAll()).data,
  })
  const { data: hashExtractions = [], isLoading: hashLoading } = useQuery<HashExtraction[]>({
    queryKey: ['hash-extractions'],
    queryFn:  async () => (await hashAPI.getAll()).data,
  })
  const { data: histCultures = [], isLoading: cultLoading } = useQuery<HistoriqueCulture[]>({
    queryKey: ['historique-cultures'],
    queryFn:  async () => (await historiqueCultureAPI.getAll()).data,
  })

  // ── Sélecteur année extractions ───────────────────────────────────────────
  const currentYear = new Date().getFullYear()
  const extractionYears = useMemo(() => {
    const ys = new Set<number>()
    ys.add(currentYear)
    extractions.forEach(e => {
      if (e.date_rosinextraction) ys.add(new Date(e.date_rosinextraction).getFullYear())
    })
    hashExtractions.forEach(e => {
      if (e.date_hashextraction) ys.add(new Date(e.date_hashextraction).getFullYear())
    })
    return [...ys].sort((a, b) => b - a)
  }, [extractions, hashExtractions, currentYear])

  const [exYear,    setExYear]    = useState<number | 'all'>('all')
  const [exType,    setExType]    = useState<'rosin' | 'hash'>('rosin')
  const [consYear,  setConsYear]  = useState<number | 'all'>('all')
  const [stockType, setStockType] = useState<string | 'all'>('all')
  const [cultYear,  setCultYear]  = useState<number | 'all'>('all')

  // Types disponibles dans le stock
  const stockTypes = useMemo(() => {
    const ts = new Set<string>()
    stocks.forEach(s => { if (s.type_stock) ts.add(s.type_stock) })
    return [...ts].sort()
  }, [stocks])

  // ── Stats Graines ──────────────────────────────────────────────────────────
  const grainesStats = useMemo(() => {
    const enStock    = catalogue.filter(i => i.nbr_graines_restantes > 0)
    const totalStock = catalogue.reduce((s, i) => s + i.nbr_graines_restantes, 0)
    const valeurTotale = catalogue
      .filter(i => i.prix_par_graine != null)
      .reduce((s, i) => s + i.prix_par_graine! * i.nbr_graines_restantes, 0)
    const costItems  = catalogue.filter(i => i.prix_par_graine != null && i.nbr_graines_restantes > 0)
    const coutMoyen  = costItems.length
      ? costItems.reduce((s, i) => s + i.prix_par_graine! * i.nbr_graines_restantes, 0)
        / costItems.reduce((s, i) => s + i.nbr_graines_restantes, 0)
      : null
    const nbVarietes = new Set(enStock.map(i => i.variete_nom)).size
    const nbBreeders = new Set(enStock.map(i => i.breeder_nom)).size
    const types      = ['Féminisée', 'Régulière', 'Auto'] as const
    const repartition = types.map(type => ({
      label: type,
      count: catalogue.filter(i => i.type_graines === type).reduce((s, i) => s + i.nbr_graines_restantes, 0),
    }))
    const autreCount = catalogue
      .filter(i => !types.includes(i.type_graines as any))
      .reduce((s, i) => s + i.nbr_graines_restantes, 0)
    if (autreCount > 0) repartition.push({ label: 'Autre' as any, count: autreCount })
    return { totalStock, valeurTotale, coutMoyen, nbVarietes, nbBreeders, repartition }
  }, [catalogue])

  // ── Stats Stock ────────────────────────────────────────────────────────────
  const stockStats = useMemo(() => {
    const base   = stocks.filter(s => (s.quantite_stock ?? 0) > 0)
    const actifs = stockType === 'all'
      ? base
      : base.filter(s => (s.type_stock || 'Autre') === stockType)
    const stockGlobal = actifs.reduce((s, x) => s + Number(x.quantite_stock), 0)

    // Par type
    const byType = actifs.reduce<Record<string, number>>((acc, s) => {
      const t = s.type_stock || 'Autre'
      acc[t] = (acc[t] || 0) + Number(s.quantite_stock)
      return acc
    }, {})

    // Par variété (regroupement)
    const byVariete = actifs.reduce<Record<string, number>>((acc, s) => {
      const v = s.variete_nom || '(sans variété)'
      acc[v] = (acc[v] || 0) + Number(s.quantite_stock)
      return acc
    }, {})
    const varieteQtys = Object.values(byVariete)
    const nbVarietes  = varieteQtys.length
    const qteMoyenne  = nbVarietes ? stockGlobal / nbVarietes : 0
    const qteMax      = nbVarietes ? Math.max(...varieteQtys) : 0
    const qteMin      = nbVarietes ? Math.min(...varieteQtys) : 0
    const varieteMax  = Object.entries(byVariete).find(([, v]) => v === qteMax)?.[0] ?? '—'
    const varieteMin  = Object.entries(byVariete).find(([, v]) => v === qteMin)?.[0] ?? '—'

    // Durées (âge depuis date_stock)
    const ages = actifs
      .map(s => daysSince(s.date_stock ?? undefined))
      .filter((d): d is number => d !== null)
    const dureeAvg = ages.length ? ages.reduce((s, d) => s + d, 0) / ages.length : null
    const dureeMax = ages.length ? Math.max(...ages) : null
    const dureeMin = ages.length ? Math.min(...ages) : null

    return { stockGlobal, byType, nbVarietes, qteMoyenne, qteMax, qteMin, varieteMax, varieteMin, dureeAvg, dureeMax, dureeMin }
  }, [stocks, stockType])

  // ── Stats Extractions (par année) ─────────────────────────────────────────
  const exStats = useMemo(() => {
    const filtered = exYear === 'all'
      ? extractions
      : extractions.filter(
          e => e.date_rosinextraction && new Date(e.date_rosinextraction).getFullYear() === exYear
        )
    if (!filtered.length) return null

    const qtePressée  = filtered.reduce((s, e) => s + e.quantite_utilisee, 0)
    const qteExtraite = filtered.reduce((s, e) => s + e.quantite_extraite, 0)
    const qteUtilMoy  = qtePressée / filtered.length
    const qteExtrMoy  = qteExtraite / filtered.length
    const qteExtrMax  = Math.max(...filtered.map(e => e.quantite_extraite))

    const ratios = filtered
      .filter(e => e.quantite_utilisee > 0)
      .map(e => (e.quantite_extraite / e.quantite_utilisee) * 100)
    const ratioMoy = ratios.length ? ratios.reduce((s, r) => s + r, 0) / ratios.length : 0
    const ratioMax = ratios.length ? Math.max(...ratios) : 0
    const ratioMin = ratios.length ? Math.min(...ratios) : 0

    // Variété meilleur ratio (parmi celles ayant ≥2 extractions)
    const byVariete = filtered.reduce<Record<string, number[]>>((acc, e) => {
      const v = e.variete_nom || e.nom_variete_extract || '?'
      if (!acc[v]) acc[v] = []
      if (e.quantite_utilisee > 0)
        acc[v].push((e.quantite_extraite / e.quantite_utilisee) * 100)
      return acc
    }, {})
    const varieteRatios = Object.entries(byVariete)
      .map(([v, rs]) => ({ v, avg: rs.reduce((s, r) => s + r, 0) / rs.length }))
      .filter(x => !isNaN(x.avg))
    const bestVariete = varieteRatios.sort((a, b) => b.avg - a.avg)[0]

    const nbVarietes = new Set(
      filtered.map(e => e.variete_nom || e.nom_variete_extract || '?')
    ).size

    return {
      nbExtractions: filtered.length,
      qtePressée, qteExtraite, qteUtilMoy, qteExtrMoy, qteExtrMax,
      ratioMoy, ratioMax, ratioMin,
      bestVariete: bestVariete ? `${bestVariete.v} (${bestVariete.avg.toFixed(1)}%)` : '—',
      nbVarietes,
    }
  }, [extractions, exYear])

  // ── Stats Hash Extractions (par année) ────────────────────────────────────
  const hashStats = useMemo(() => {
    const filtered = exYear === 'all'
      ? hashExtractions
      : hashExtractions.filter(
          e => e.date_hashextraction && new Date(e.date_hashextraction).getFullYear() === exYear
        )

    if (!filtered.length) return null

    const qteEntree  = filtered.reduce((s, e) => s + e.quantite_utilisee, 0)
    const qteExtraite = filtered.reduce((s, e) => s + e.quantite_extraite, 0)
    const qteMoyEntree = qteEntree / filtered.length
    const qteMoyExtraite = qteExtraite / filtered.length
    const qteExtrMax  = Math.max(...filtered.map(e => e.quantite_extraite))

    const ratios = filtered
      .filter(e => e.quantite_utilisee > 0)
      .map(e => (e.quantite_extraite / e.quantite_utilisee) * 100)
    const ratioMoy = ratios.length ? ratios.reduce((s, r) => s + r, 0) / ratios.length : 0
    const ratioMax = ratios.length ? Math.max(...ratios) : 0
    const ratioMin = ratios.length ? Math.min(...ratios) : 0

    // Par type d'extraction
    const nbPolinator   = filtered.filter(e => e.type_extraction === 'Polinator').length
    const nbIceoLator   = filtered.filter(e => e.type_extraction === 'Ice-o-lator').length
    const nbSansType    = filtered.filter(e => !e.type_extraction).length

    // Meilleure variété (meilleur ratio moyen)
    const byVariete = filtered.reduce<Record<string, number[]>>((acc, e) => {
      const v = e.variete_nom || e.nom_variete_hash || '?'
      if (!acc[v]) acc[v] = []
      if (e.quantite_utilisee > 0)
        acc[v].push((e.quantite_extraite / e.quantite_utilisee) * 100)
      return acc
    }, {})
    const varieteRatios = Object.entries(byVariete)
      .map(([v, rs]) => ({ v, avg: rs.reduce((s, r) => s + r, 0) / rs.length }))
      .filter(x => !isNaN(x.avg))
    const bestVariete = varieteRatios.sort((a, b) => b.avg - a.avg)[0]

    const nbVarietes = new Set(
      filtered.map(e => e.variete_nom || e.nom_variete_hash || '?')
    ).size

    return {
      nbExtractions: filtered.length,
      qteEntree, qteExtraite, qteMoyEntree, qteMoyExtraite, qteExtrMax,
      ratioMoy, ratioMax, ratioMin,
      nbPolinator, nbIceoLator, nbSansType,
      bestVariete: bestVariete ? `${bestVariete.v} (${bestVariete.avg.toFixed(1)}%)` : '—',
      nbVarietes,
    }
  }, [hashExtractions, exYear])

  // ── Stats Consommation (par année ou toutes) ──────────────────────────────
  const consStats = useMemo(() => {
    const isLeap = (y: number) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0

    let filtered: typeof extractions
    let joursRef: number

    if (consYear === 'all') {
      filtered = extractions
      // Période : du premier jour de la première extraction à aujourd'hui
      const dates = extractions
        .map(e => e.date_rosinextraction ? new Date(e.date_rosinextraction).getTime() : null)
        .filter((d): d is number => d !== null)
      if (dates.length) {
        const firstDate = Math.min(...dates)
        joursRef = Math.max(1, Math.floor((Date.now() - firstDate) / 86_400_000))
      } else {
        joursRef = 365
      }
    } else {
      filtered = extractions.filter(
        e => e.date_rosinextraction && new Date(e.date_rosinextraction).getFullYear() === consYear
      )
      const joursAnnee = isLeap(consYear) ? 366 : 365
      // Si année en cours, jours écoulés depuis le 1er janvier
      joursRef = consYear === currentYear
        ? Math.max(1, Math.floor((Date.now() - new Date(consYear, 0, 1).getTime()) / 86_400_000))
        : joursAnnee
    }

    const totalConsomme = filtered.reduce((s, e) => s + e.quantite_extraite, 0)
    const semainesRef   = joursRef / 7
    const moisRef       = joursRef / (365 / 12)

    const journaliere  = totalConsomme / joursRef
    const hebdomadaire = totalConsomme / semainesRef
    const mensuelle    = totalConsomme / moisRef

    return { totalConsomme, journaliere, hebdomadaire, mensuelle }
  }, [extractions, consYear, currentYear])

  // ── Années disponibles pour les cultures (basé sur date_fin) ─────────────
  const cultureYears = useMemo(() => {
    const ys = new Set<number>()
    ys.add(currentYear)
    histCultures.forEach(c => {
      if (c.date_fin) ys.add(new Date(c.date_fin).getFullYear())
    })
    return [...ys].sort((a, b) => b - a)
  }, [histCultures, currentYear])

  // ── Stats Cultures ─────────────────────────────────────────────────────────
  const cultStats = useMemo(() => {
    // Cultures menées à terme = date_fin renseignée
    const completed = histCultures.filter(c => c.date_fin != null)
    const filtered  = cultYear === 'all'
      ? completed
      : completed.filter(c => new Date(c.date_fin!).getFullYear() === cultYear)

    if (!filtered.length) return null

    // Récolte
    const withQte   = filtered.filter(c => c.quantite_totale != null)
    const qteTotal  = withQte.reduce((s, c) => s + Number(c.quantite_totale), 0)
    const qteMoy    = withQte.length ? qteTotal / withQte.length : null
    const qteMax    = withQte.length ? Math.max(...withQte.map(c => Number(c.quantite_totale))) : null
    const qteMin    = withQte.length ? Math.min(...withQte.map(c => Number(c.quantite_totale))) : null

    // Durées
    const withDuree = filtered.filter(c => c.duree_jours != null)
    const dureeMoy  = withDuree.length ? withDuree.reduce((s, c) => s + c.duree_jours!, 0) / withDuree.length : null
    const dureeMax  = withDuree.length ? Math.max(...withDuree.map(c => c.duree_jours!)) : null
    const dureeMin  = withDuree.length ? Math.min(...withDuree.map(c => c.duree_jours!)) : null

    // Ratios g/W
    const withGpW   = filtered.filter(c => c.g_par_watt != null)
    const ratioMoy  = withGpW.length ? withGpW.reduce((s, c) => s + c.g_par_watt!, 0) / withGpW.length : null
    const ratioMax  = withGpW.length ? Math.max(...withGpW.map(c => c.g_par_watt!)) : null
    const ratioMin  = withGpW.length ? Math.min(...withGpW.map(c => c.g_par_watt!)) : null

    // Coûts (prix total graines)
    const withCout  = filtered.filter(c => c.prix_total_graines != null)
    const coutMoy   = withCout.length ? withCout.reduce((s, c) => s + Number(c.prix_total_graines), 0) / withCout.length : null
    const coutMax   = withCout.length ? Math.max(...withCout.map(c => Number(c.prix_total_graines))) : null
    const coutMin   = withCout.length ? Math.min(...withCout.map(c => Number(c.prix_total_graines))) : null

    // Nombre de plants
    const plantsMoy = filtered.reduce((s, c) => s + c.nb_plants, 0) / filtered.length
    const plantsMax = Math.max(...filtered.map(c => c.nb_plants))
    const plantsMin = Math.min(...filtered.map(c => c.nb_plants))

    // Variété la plus productive (meilleure moyenne de quantite_recoltee par plante)
    const byVariete: Record<string, number[]> = {}
    filtered.forEach(c => {
      c.plants.forEach(p => {
        const nom = p.variete_nom
        if (!nom || p.quantite_recoltee == null) return
        if (!byVariete[nom]) byVariete[nom] = []
        byVariete[nom].push(Number(p.quantite_recoltee))
      })
    })
    const varieteAvgs = Object.entries(byVariete)
      .map(([nom, qtys]) => ({ nom, avg: qtys.reduce((s, q) => s + q, 0) / qtys.length, total: qtys.reduce((s, q) => s + q, 0) }))
      .filter(x => !isNaN(x.avg) && x.avg > 0)
      .sort((a, b) => b.avg - a.avg)
    const bestVariete = varieteAvgs[0] ?? null

    return {
      nb: filtered.length,
      qteTotal, qteMoy, qteMax, qteMin,
      dureeMoy, dureeMax, dureeMin,
      ratioMoy, ratioMax, ratioMin,
      coutMoy, coutMax, coutMin,
      plantsMoy, plantsMax, plantsMin,
      bestVariete,
    }
  }, [histCultures, cultYear])

  // ── Loading ────────────────────────────────────────────────────────────────
  if (catLoading || stLoading || exLoading || hashLoading || cultLoading) return <LoadingSpinner />

  // ── Couleurs types stock ───────────────────────────────────────────────────
  const TYPE_COLORS: Record<string, string> = {
    Fleur:  'bg-grow-400',
    Trim:   'bg-blue-400',
    Hash:   'bg-amber-500',
    Rosin:  'bg-purple-500',
    Autre:  'bg-gray-400',
  }
  const TYPE_TEXT: Record<string, string> = {
    Fleur:  'text-grow-600',
    Trim:   'text-blue-600',
    Hash:   'text-amber-600',
    Rosin:  'text-purple-600',
    Autre:  'text-gray-600 dark:text-gray-300',
  }

  return (
    <div className="space-y-8">

      {/* ══════════════════ MODULE GRAINES ══════════════════ */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
        <ModuleHeader icon={Sprout} title="Graines"
          badge={`${catalogue.length} pack${catalogue.length > 1 ? 's' : ''} enregistré${catalogue.length > 1 ? 's' : ''}`}
        />
        <div className="p-6 space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            <MiniStat icon={Sprout}     label="Stock total"  value={grainesStats.totalStock}  sub="graines"           color="grow"   />
            <MiniStat icon={Euro}       label="Valeur totale" value={`${grainesStats.valeurTotale.toFixed(0)} €`} sub="prix achat" color="blue" />
            <MiniStat icon={TrendingUp} label="Coût moyen"   value={grainesStats.coutMoyen != null ? `${grainesStats.coutMoyen.toFixed(2)} €` : '—'} sub="/ graine pondéré" color="purple" />
            <MiniStat icon={Dna}        label="Variétés"     value={grainesStats.nbVarietes}  sub="en stock"          color="amber"  />
            <MiniStat icon={Users}      label="Breeders"     value={grainesStats.nbBreeders}  sub="représentés"       color="orange" />
          </div>

          {grainesStats.totalStock > 0 && (
            <div>
              <SectionTitle>Répartition par type</SectionTitle>
              <div className="space-y-2">
                {grainesStats.repartition.filter(r => r.count > 0).map(r => {
                  const pct = Math.round((r.count / grainesStats.totalStock) * 100)
                  const colors: Record<string, string> = { 'Féminisée': 'bg-pink-400', 'Régulière': 'bg-blue-400', 'Auto': 'bg-grow-400', 'Autre': 'bg-gray-400' }
                  const textColors: Record<string, string> = { 'Féminisée': 'text-pink-600', 'Régulière': 'text-blue-600', 'Auto': 'text-grow-600', 'Autre': 'text-gray-600 dark:text-gray-300' }
                  return (
                    <div key={r.label} className="flex items-center gap-3">
                      <span className={`text-xs font-medium w-20 shrink-0 ${textColors[r.label] ?? 'text-gray-600 dark:text-gray-300'}`}>{r.label}</span>
                      <div className="flex-1 bg-gray-100 rounded-full h-2.5 overflow-hidden">
                        <div className={`h-full rounded-full ${colors[r.label] ?? 'bg-gray-400'} transition-all`} style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500 w-16 text-right shrink-0">{r.count} <span className="text-gray-400 dark:text-gray-500">({pct}%)</span></span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ══════════════════ MODULE STOCK ══════════════════ */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
        <ModuleHeader icon={Package} title="Stock"
          badge={`${stocks.filter(s => (s.quantite_stock ?? 0) > 0).length} entrée${stocks.length > 1 ? 's' : ''} actives`}
        >
          <select
            value={stockType}
            onChange={e => setStockType(e.target.value)}
            className="text-sm border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-grow-400 bg-white dark:bg-gray-800"
          >
            <option value="all">Tous les types</option>
            {stockTypes.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </ModuleHeader>
        <div className="p-6 space-y-6">

          {/* Ligne 1 : global + variétés */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            <MiniStat icon={Scale}   label={stockType === 'all' ? 'Stock global' : stockType}
              value={`${stockStats.stockGlobal.toFixed(1)} g`}
              sub={stockType === 'all' ? 'toutes catégories' : 'type sélectionné'}
              color="grow"   />
            <MiniStat icon={Hash}    label="Variétés"       value={stockStats.nbVarietes}                   sub="en stock"                   color="blue"   />
            <MiniStat icon={BarChart2} label="Qté moy./variété" value={`${stockStats.qteMoyenne.toFixed(1)} g`} sub="moyenne"                color="purple" />
            <div className="bg-green-50 rounded-xl p-4">
              <div className="flex items-center gap-1.5 mb-1 text-green-500"><ArrowUp size={13} /><span className="text-xs font-semibold uppercase tracking-wide text-green-600">Qté max variété</span></div>
              <p className="text-2xl font-bold text-green-700">{stockStats.qteMax.toFixed(1)} g</p>
              <p className="text-xs text-green-400 mt-0.5 truncate" title={stockStats.varieteMax}>{stockStats.varieteMax}</p>
            </div>
            <div className="bg-rose-50 rounded-xl p-4">
              <div className="flex items-center gap-1.5 mb-1 text-rose-500"><ArrowDown size={13} /><span className="text-xs font-semibold uppercase tracking-wide text-rose-600">Qté min variété</span></div>
              <p className="text-2xl font-bold text-rose-700">{stockStats.qteMin.toFixed(1)} g</p>
              <p className="text-xs text-rose-400 mt-0.5 truncate" title={stockStats.varieteMin}>{stockStats.varieteMin}</p>
            </div>
            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4">
              <div className="flex items-center gap-1.5 mb-1 text-gray-500 dark:text-gray-400 dark:text-gray-500"><Clock size={13} /><span className="text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-300">Durées stock</span></div>
              <div className="space-y-0.5 mt-1">
                <div className="flex justify-between text-xs"><span className="text-gray-400 dark:text-gray-500">Moyenne</span><span className="font-semibold text-gray-700 dark:text-gray-200">{fmtDays(stockStats.dureeAvg != null ? Math.round(stockStats.dureeAvg) : null)}</span></div>
                <div className="flex justify-between text-xs"><span className="text-gray-400 dark:text-gray-500">Max</span><span className="font-semibold text-gray-700 dark:text-gray-200">{fmtDays(stockStats.dureeMax)}</span></div>
                <div className="flex justify-between text-xs"><span className="text-gray-400 dark:text-gray-500">Min</span><span className="font-semibold text-gray-700 dark:text-gray-200">{fmtDays(stockStats.dureeMin)}</span></div>
              </div>
            </div>
          </div>

          {/* Répartition par type — uniquement en mode "tous" */}
          {stockType === 'all' && stockStats.stockGlobal > 0 && Object.keys(stockStats.byType).length > 0 && (
            <div>
              <SectionTitle>Quantité par type</SectionTitle>
              <div className="space-y-2">
                {Object.entries(stockStats.byType)
                  .sort((a, b) => b[1] - a[1])
                  .map(([type, qty]) => {
                    const pct = Math.round((qty / stockStats.stockGlobal) * 100)
                    return (
                      <div key={type} className="flex items-center gap-3">
                        <span className={`text-xs font-medium w-16 shrink-0 ${TYPE_TEXT[type] ?? 'text-gray-600 dark:text-gray-300'}`}>{type}</span>
                        <div className="flex-1 bg-gray-100 rounded-full h-2.5 overflow-hidden">
                          <div className={`h-full rounded-full ${TYPE_COLORS[type] ?? 'bg-gray-400'} transition-all`} style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500 w-28 text-right shrink-0">{qty.toFixed(1)} g <span className="text-gray-400 dark:text-gray-500">({pct}%)</span></span>
                      </div>
                    )
                  })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ══════════════════ MODULE CULTURES ══════════════════ */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
        <ModuleHeader icon={Leaf} title="Cultures"
          badge={`${histCultures.filter(c => c.date_fin).length} culture${histCultures.filter(c => c.date_fin).length > 1 ? 's' : ''} terminée${histCultures.filter(c => c.date_fin).length > 1 ? 's' : ''}`}
        >
          <YearSelect years={cultureYears} value={cultYear} onChange={setCultYear} />
        </ModuleHeader>
        <div className="p-6">
          {!cultStats ? (
            <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-4">
              {cultYear === 'all' ? 'Aucune culture terminée enregistrée' : `Aucune culture terminée en ${cultYear}`}
            </p>
          ) : (
            <div className="space-y-5">

              {/* Ligne 1 : vue d'ensemble */}
              <div>
                <SectionTitle>Vue d'ensemble</SectionTitle>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
                  <MiniStat icon={Leaf}      label="Cultures menées à terme" value={cultStats.nb}                                                                     color="grow"   />
                  <MiniStat icon={Scale}     label="Récolte totale"          value={cultStats.qteTotal > 0 ? `${cultStats.qteTotal.toFixed(1)} g` : '—'}                                    color="blue"   />
                  <MiniStat icon={Scale}     label="Récolte moy. / culture"  value={cultStats.qteMoy  != null ? `${cultStats.qteMoy.toFixed(1)} g`  : '—'}           color="purple" />
                  <MiniStat icon={ArrowUp}   label="Récolte max"             value={cultStats.qteMax  != null ? `${cultStats.qteMax.toFixed(1)} g`  : '—'}           color="green"  />
                  <MiniStat icon={ArrowDown} label="Récolte min"             value={cultStats.qteMin  != null ? `${cultStats.qteMin.toFixed(1)} g`  : '—'}           color="rose"   />
                </div>
              </div>

              {/* Ligne 2 : durées */}
              <div>
                <SectionTitle>Durées</SectionTitle>
                <div className="grid grid-cols-3 gap-4">
                  <MiniStat icon={Clock}    label="Durée moyenne" value={cultStats.dureeMoy != null ? `${Math.round(cultStats.dureeMoy)} j` : '—'} color="blue"   />
                  <MiniStat icon={ArrowUp}  label="Durée max"     value={cultStats.dureeMax != null ? `${cultStats.dureeMax} j`             : '—'} color="green"  />
                  <MiniStat icon={ArrowDown} label="Durée min"    value={cultStats.dureeMin != null ? `${cultStats.dureeMin} j`             : '—'} color="rose"   />
                </div>
              </div>

              {/* Ligne 3 : ratios g/W */}
              <div>
                <SectionTitle>Ratio g/W</SectionTitle>
                <div className="grid grid-cols-3 gap-4">
                  <MiniStat icon={Zap}      label="Ratio moyen" value={cultStats.ratioMoy != null ? cultStats.ratioMoy.toFixed(3) : '—'} color="amber"  />
                  <MiniStat icon={ArrowUp}  label="Ratio max"   value={cultStats.ratioMax != null ? cultStats.ratioMax.toFixed(3) : '—'} color="green"  />
                  <MiniStat icon={ArrowDown} label="Ratio min"  value={cultStats.ratioMin != null ? cultStats.ratioMin.toFixed(3) : '—'} color="rose"   />
                </div>
              </div>

              {/* Ligne 4 : coûts + plants + meilleure variété */}
              <div>
                <SectionTitle>Coûts & Plants</SectionTitle>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
                  <MiniStat icon={Euro}      label="Coût moy."   value={cultStats.coutMoy  != null ? `${cultStats.coutMoy.toFixed(2)} €`  : '—'} color="blue"   />
                  <MiniStat icon={ArrowUp}   label="Coût max"    value={cultStats.coutMax  != null ? `${cultStats.coutMax.toFixed(2)} €`  : '—'} color="green"  />
                  <MiniStat icon={ArrowDown} label="Coût min"    value={cultStats.coutMin  != null ? `${cultStats.coutMin.toFixed(2)} €`  : '—'} color="rose"   />
                  <MiniStat icon={Hash}      label="Plants moy." value={cultStats.plantsMoy.toFixed(1)}                                           color="teal"   />
                  <MiniStat icon={ArrowUp}   label="Plants max"  value={cultStats.plantsMax}                                                       color="green"  />
                  <MiniStat icon={ArrowDown} label="Plants min"  value={cultStats.plantsMin}                                                       color="rose"   />
                </div>
              </div>

              {/* Meilleure variété */}
              {cultStats.bestVariete && (
                <div className="bg-amber-50 rounded-xl p-4 flex items-start gap-3">
                  <Trophy size={20} className="text-amber-500 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs font-semibold text-amber-400 uppercase tracking-wide mb-0.5">
                      Variété la plus productive sur la période
                    </p>
                    <p className="text-lg font-bold text-amber-800">{cultStats.bestVariete.nom}</p>
                    <p className="text-xs text-amber-500 mt-0.5">
                      Moy. {cultStats.bestVariete.avg.toFixed(1)} g/plante · Total {cultStats.bestVariete.total.toFixed(1)} g
                    </p>
                  </div>
                </div>
              )}

            </div>
          )}
        </div>
      </div>

      {/* ══════════════════ MODULE EXTRACTIONS ══════════════════ */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
        <ModuleHeader icon={FlaskConical} title="Extractions">
          <div className="flex items-center gap-2">
            {/* Toggle Rosin / Hash */}
            <div className="flex rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden text-sm">
              <button
                onClick={() => setExType('rosin')}
                className={`px-3 py-1.5 transition-colors ${exType === 'rosin' ? 'bg-purple-600 text-white font-medium' : 'bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 dark:text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-700/40'}`}
              >🍯 Rosin</button>
              <button
                onClick={() => setExType('hash')}
                className={`px-3 py-1.5 transition-colors border-l border-gray-200 dark:border-gray-700 ${exType === 'hash' ? 'bg-amber-600 text-white font-medium' : 'bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 dark:text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-700/40'}`}
              >🍫 Hash</button>
            </div>
            <YearSelect years={extractionYears} value={exYear} onChange={setExYear} />
          </div>
        </ModuleHeader>
        <div className="p-6">

          {/* ── ROSIN ── */}
          {exType === 'rosin' && (
            !exStats ? (
              <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-4">
                {exYear === 'all' ? 'Aucune extraction Rosin enregistrée' : `Aucune extraction Rosin en ${exYear}`}
              </p>
            ) : (
              <div className="space-y-5">
                <div>
                  <SectionTitle>Volumes</SectionTitle>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
                    <MiniStat icon={Scale}    label="Qté pressée"    value={`${exStats.qtePressée.toFixed(1)} g`}  sub={`${exStats.nbExtractions} extraction${exStats.nbExtractions > 1 ? 's' : ''}`} color="blue"   />
                    <MiniStat icon={FlaskConical} label="Qté extraite" value={`${exStats.qteExtraite.toFixed(1)} g`} sub="total sortie"                                                          color="purple" />
                    <MiniStat icon={Minus}    label="Moy. pressée"   value={`${exStats.qteUtilMoy.toFixed(1)} g`}  sub="/ extraction"                                                            color="teal"   />
                    <MiniStat icon={Minus}    label="Moy. extraite"  value={`${exStats.qteExtrMoy.toFixed(2)} g`}  sub="/ extraction"                                                            color="indigo" />
                    <MiniStat icon={ArrowUp}  label="Max extraite"   value={`${exStats.qteExtrMax.toFixed(2)} g`}  sub="meilleure session"                                                       color="green"  />
                  </div>
                </div>
                <div>
                  <SectionTitle>Rendements</SectionTitle>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
                    <MiniStat icon={Percent}  label="Ratio moyen"  value={`${exStats.ratioMoy.toFixed(1)}%`}  color="grow"   />
                    <MiniStat icon={ArrowUp}  label="Ratio max"    value={`${exStats.ratioMax.toFixed(1)}%`}  color="green"  />
                    <MiniStat icon={ArrowDown} label="Ratio min"   value={`${exStats.ratioMin.toFixed(1)}%`}  color="rose"   />
                    <div className="bg-amber-50 rounded-xl p-4 col-span-2">
                      <p className="text-xs font-semibold uppercase tracking-wide text-amber-400 mb-1">Meilleure variété</p>
                      <p className="text-sm font-bold text-amber-700 truncate" title={exStats.bestVariete}>{exStats.bestVariete}</p>
                      <p className="text-xs text-amber-400 mt-0.5">ratio moyen le plus élevé</p>
                    </div>
                    <MiniStat icon={Hash} label="Variétés pressées" value={exStats.nbVarietes} sub="différentes" color="orange" />
                  </div>
                </div>
              </div>
            )
          )}

          {/* ── HASH ── */}
          {exType === 'hash' && (
            !hashStats ? (
              <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-4">
                {exYear === 'all' ? 'Aucune extraction Hash enregistrée' : `Aucune extraction Hash en ${exYear}`}
              </p>
            ) : (
              <div className="space-y-5">
                {/* Ligne 1 : volumes */}
                <div>
                  <SectionTitle>Volumes</SectionTitle>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
                    <MiniStat icon={Scale}       label="Qté entrée"    value={`${hashStats.qteEntree.toFixed(1)} g`}    sub={`${hashStats.nbExtractions} extraction${hashStats.nbExtractions > 1 ? 's' : ''}`} color="blue"   />
                    <MiniStat icon={FlaskConical} label="Qté extraite"  value={`${hashStats.qteExtraite.toFixed(1)} g`}  sub="total hash"                                                                         color="amber"  />
                    <MiniStat icon={Minus}        label="Moy. entrée"   value={`${hashStats.qteMoyEntree.toFixed(1)} g`} sub="/ extraction"                                                                       color="teal"   />
                    <MiniStat icon={Minus}        label="Moy. extraite" value={`${hashStats.qteMoyExtraite.toFixed(2)} g`} sub="/ extraction"                                                                    color="indigo" />
                    <MiniStat icon={ArrowUp}      label="Max extraite"  value={`${hashStats.qteExtrMax.toFixed(2)} g`}  sub="meilleure session"                                                                   color="green"  />
                  </div>
                </div>

                {/* Ligne 2 : rendements */}
                <div>
                  <SectionTitle>Rendements</SectionTitle>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
                    <MiniStat icon={Percent}   label="Ratio moyen" value={`${hashStats.ratioMoy.toFixed(1)}%`} color="grow"   />
                    <MiniStat icon={ArrowUp}   label="Ratio max"   value={`${hashStats.ratioMax.toFixed(1)}%`} color="green"  />
                    <MiniStat icon={ArrowDown} label="Ratio min"   value={`${hashStats.ratioMin.toFixed(1)}%`} color="rose"   />
                    <div className="bg-amber-50 rounded-xl p-4 col-span-2">
                      <p className="text-xs font-semibold uppercase tracking-wide text-amber-400 mb-1">Meilleure variété</p>
                      <p className="text-sm font-bold text-amber-700 truncate" title={hashStats.bestVariete}>{hashStats.bestVariete}</p>
                      <p className="text-xs text-amber-400 mt-0.5">ratio moyen le plus élevé</p>
                    </div>
                    <MiniStat icon={Hash} label="Variétés" value={hashStats.nbVarietes} sub="différentes" color="orange" />
                  </div>
                </div>

                {/* Ligne 3 : répartition par type */}
                {(hashStats.nbPolinator > 0 || hashStats.nbIceoLator > 0) && (
                  <div>
                    <SectionTitle>Répartition par méthode</SectionTitle>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                      <MiniStat icon={FlaskConical} label="Polinator"    value={hashStats.nbPolinator}  sub={`extraction${hashStats.nbPolinator > 1 ? 's' : ''}`}  color="purple" />
                      <MiniStat icon={FlaskConical} label="Ice-o-lator"  value={hashStats.nbIceoLator}  sub={`extraction${hashStats.nbIceoLator > 1 ? 's' : ''}`}  color="blue"   />
                      {hashStats.nbSansType > 0 && (
                        <MiniStat icon={FlaskConical} label="Non défini" value={hashStats.nbSansType}   sub="extractions"                                           color="gray"   />
                      )}
                    </div>
                  </div>
                )}
              </div>
            )
          )}

        </div>
      </div>

      {/* ══════════════════ MODULE CONSOMMATION ══════════════════ */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
        <ModuleHeader icon={Coffee} title="Consommation">
          <YearSelect years={extractionYears} value={consYear} onChange={setConsYear} />
        </ModuleHeader>
        <div className="p-6">
          {consStats.totalConsomme === 0 ? (
            <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-4">
              {consYear === 'all' ? 'Aucune extraction enregistrée' : `Aucune extraction en ${consYear}`}
            </p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <MiniStat
                icon={Scale}
                label="Quantité consommée"
                value={`${consStats.totalConsomme.toFixed(1)} g`}
                sub={consYear === 'all' ? 'total rosin toutes années' : `total rosin ${consYear}`}
                color="grow"
              />
              <MiniStat
                icon={CalendarDays}
                label="Qté journalière"
                value={`${consStats.journaliere.toFixed(2)} g`}
                sub="/ jour"
                color="blue"
              />
              <MiniStat
                icon={CalendarRange}
                label="Qté hebdomadaire"
                value={`${consStats.hebdomadaire.toFixed(1)} g`}
                sub="/ semaine"
                color="purple"
              />
              <MiniStat
                icon={Calendar}
                label="Qté mensuelle"
                value={`${consStats.mensuelle.toFixed(1)} g`}
                sub="/ mois"
                color="amber"
              />
            </div>
          )}
        </div>
      </div>

    </div>
  )
}
