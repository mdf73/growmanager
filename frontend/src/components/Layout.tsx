declare const __APP_VERSION__: string

import { ReactNode, useState, useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import {
  Menu, X, Home, Sprout, Leaf, Package, Beaker,
  BookOpen, Wrench, Settings, BarChart2, FlaskConical,
  ChevronDown, ChevronRight, NotebookPen, Boxes, Wind, Dna, Droplets, Thermometer, ClipboardList, Trophy, Cigarette,
  Moon, Sun, Search, CalendarDays, GitCompare,
} from 'lucide-react'
import GlobalSearch from './GlobalSearch'
import clsx from 'clsx'
import { useDarkMode } from '../hooks/useDarkMode'
import { isStandalone } from '../api/client'

interface LayoutProps {
  children: ReactNode
}

// ── Types de navigation ───────────────────────────────────────────────────────

/** Item feuille : lien direct (avec icône ou emoji) */
type LeafItem =
  | { path: string; label: string; icon: React.ElementType; emoji?: never; children?: never }
  | { path: string; label: string; emoji: string; icon?: never; children?: never }

/** Sous-groupe de niveau 2 (ex : Recettes dans Sols & Engrais) */
type SubGroupItem = {
  label: string
  icon: React.ElementType
  path?: never
  emoji?: never
  children: LeafItem[]
}

/** Un enfant de groupe de niveau 1 peut être une feuille ou un sous-groupe */
type SubItem = LeafItem | SubGroupItem

/** Item de navigation racine */
type NavItem =
  | LeafItem
  | { label: string; icon: React.ElementType; path?: never; emoji?: never; children: SubItem[] }

// ── Helpers de type ──────────────────────────────────────────────────────────
function isSubGroup(item: SubItem): item is SubGroupItem {
  return 'children' in item && !('path' in item)
}

// ── Structure de navigation ───────────────────────────────────────────────────
const navItems: NavItem[] = [
  { path: '/',                  label: 'Dashboard',          icon: Home },
  { path: '/graines',           label: 'Graines',            icon: Sprout },
  {
    label: 'Culture',
    icon: Leaf,
    children: [
      { path: '/calendrier',             label: 'Calendrier global',      icon: CalendarDays },
      { path: '/culture',               label: 'Suivi de culture',      icon: Leaf },
      { path: '/sechage-curing',        label: 'Séchage & Curing',      icon: Wind },
      { path: '/croisement',            label: 'Croisements',            icon: Dna },
      { path: '/suivi-constantes',      label: 'Constantes (T°/VPD)',   icon: Thermometer },
      { path: '/plan-culture',          label: 'Préparer une culture',  icon: ClipboardList },
      { path: '/preparation-substrat',  label: 'Préparer un substrat',  emoji: '🪴' },
      { path: '/historique-cultures',   label: 'Historique cultures',   icon: BookOpen },
      { path: '/comparaison-cultures',   label: 'Comparer cultures',      icon: GitCompare },
    ],
  },
  { path: '/stock',                label: 'Stock',                  icon: Package },
  { path: '/classement-varietes',  label: 'Classement variétés',   icon: Trophy  },
  {
    label: 'Extractions',
    icon: FlaskConical,
    children: [
      { path: '/extractions',      label: 'Extraction Rosin', emoji: '🍯' },
      { path: '/extractions-hash', label: 'Extraction Hash',  emoji: '🍫' },
    ],
  },
  {
    label: 'Sols & Engrais',
    icon: Beaker,
    children: [
      { path: '/amendements',       label: 'Stock Engrais',      icon: Beaker },
      {
        label: 'Recettes',
        icon: NotebookPen,
        children: [
          { path: '/recettes/arrosage',        label: 'Arrosages',                    icon: Droplets },
          { path: '/recettes/schemas-engrais', label: 'Schémas d\'engrais',            icon: FlaskConical },
          { path: '/recettes/tco',             label: 'Thés de Compost (TCO)',         emoji: '🍵' },
          { path: '/recettes/lso',             label: 'Living Soil Organique (LSO)',   emoji: '🌿' },
          { path: '/recettes/reamendement',    label: 'Réamendement sols',             emoji: '🪱' },
          { path: '/recettes/fermentation',    label: 'Fermentation',                  emoji: '🫙' },
        ],
      },
      { path: '/suivi-sols-vivants', label: 'Suivi Sols Vivants', emoji: '🪴' },
    ],
  },
  { path: '/espaces-culture',   label: 'Espaces de culture',  icon: Boxes },
  { path: '/materiel',          label: 'Matériel',            icon: Wrench },
  { path: '/consommation',      label: 'Consommation',        icon: Cigarette },
  { path: '/statistiques',      label: 'Statistiques',        icon: BarChart2 },
  { path: '/parametrage',       label: 'Paramétrage',         icon: Settings },
]

// ── Mode autonome : pages nécessitant le serveur (capteurs) masquées ──────────
const STANDALONE_HIDDEN_PATHS = new Set(['/suivi-constantes'])

function filterForStandalone(items: NavItem[]): NavItem[] {
  if (!isStandalone()) return items
  const keepLeaf = (l: LeafItem) => !STANDALONE_HIDDEN_PATHS.has(l.path)
  const filterSubs = (subs: SubItem[]): SubItem[] =>
    subs
      .filter(s => (isSubGroup(s) ? true : keepLeaf(s)))
      .map(s => (isSubGroup(s) ? { ...s, children: s.children.filter(keepLeaf) } : s))
  return items.map(it =>
    'children' in it && it.children
      ? ({ ...it, children: filterSubs(it.children as SubItem[]) } as NavItem)
      : it
  )
}

const visibleNavItems = filterForStandalone(navItems)

// ── Chemins pour la détection "active" des groupes ───────────────────────────
const culturePaths     = ['/culture', '/plan-culture', '/preparation-substrat', '/sechage-curing', '/suivi-constantes', '/croisement', '/historique-cultures', '/calendrier', '/comparaison-cultures']
const extractionPaths  = ['/extractions', '/extractions-hash']
const recettesPaths    = ['/recettes/schemas-engrais', '/recettes/tco', '/recettes/lso',
                           '/recettes/reamendement', '/recettes/fermentation']
const solsEngraisPaths = ['/amendements', '/suivi-sols-vivants', ...recettesPaths]

const groupActivePaths: Record<string, string[]> = {
  'Culture':        culturePaths,
  'Extractions':    extractionPaths,
  'Sols & Engrais': solsEngraisPaths,
}

// ── Rendu d'une icône ou emoji ────────────────────────────────────────────────
function NavIcon({ item, size = 20 }: { item: { icon?: React.ElementType; emoji?: string }; size?: number }) {
  if (item.emoji) return <span className="text-lg leading-none w-5 text-center">{item.emoji}</span>
  if (item.icon) { const Icon = item.icon; return <Icon size={size} /> }
  return null
}

// ── Item feuille dans un sous-menu ────────────────────────────────────────────
function SubNavLink({
  item, active, onClick, depth = 1,
}: { item: LeafItem; active: boolean; onClick?: () => void; depth?: number }) {
  const pl = depth === 1 ? 'pl-10' : 'pl-16'
  return (
    <Link
      to={item.path}
      onClick={onClick}
      className={clsx(
        'flex items-center gap-2.5 pr-4 py-2 rounded-lg transition-colors text-sm',
        pl,
        active
          ? 'bg-grow-800 text-white font-medium'
          : 'text-grow-200 hover:bg-grow-700 hover:text-white'
      )}
    >
      <NavIcon item={item} size={15} />
      <span>{item.label}</span>
    </Link>
  )
}

// ── Sous-groupe de niveau 2 ───────────────────────────────────────────────────
function SubNavGroup({
  item, location, closeSidebar,
}: { item: SubGroupItem; location: { pathname: string }; closeSidebar?: () => void }) {
  const isChildActive = item.children.some(c => location.pathname === c.path)
  const [open, setOpen] = useState(isChildActive)

  return (
    <div>
      <button
        onClick={() => setOpen(o => !o)}
        className={clsx(
          'w-full flex items-center justify-between pl-10 pr-4 py-2 rounded-lg mb-0.5 transition-colors text-sm',
          isChildActive ? 'bg-grow-800 text-white font-medium' : 'text-grow-200 hover:bg-grow-700 hover:text-white'
        )}
      >
        <div className="flex items-center gap-2.5">
          <item.icon size={15} />
          <span>{item.label}</span>
        </div>
        {open
          ? <ChevronDown size={12} className="opacity-60" />
          : <ChevronRight size={12} className="opacity-60" />
        }
      </button>

      {open && (
        <div className="mb-0.5 space-y-0.5">
          {item.children.map(child => (
            <SubNavLink
              key={child.path}
              item={child}
              active={location.pathname === child.path}
              onClick={closeSidebar}
              depth={2}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ── Groupe de niveau 1 ────────────────────────────────────────────────────────
function NavGroup({
  item, location, closeSidebar,
}: { item: NavItem & { children: SubItem[] }; location: { pathname: string }; closeSidebar?: () => void }) {
  const activePaths = groupActivePaths[item.label]
    ?? item.children.flatMap(c => isSubGroup(c) ? c.children.map(cc => cc.path) : [c.path])
  const isChildActive = activePaths.includes(location.pathname)
  const [open, setOpen] = useState(isChildActive)

  return (
    <div>
      <button
        onClick={() => setOpen(o => !o)}
        className={clsx(
          'w-full flex items-center justify-between px-4 py-3 rounded-lg mb-1 transition-colors',
          isChildActive ? 'bg-grow-700 text-white' : 'text-grow-100 hover:bg-grow-700'
        )}
      >
        <div className="flex items-center gap-3">
          <item.icon size={20} />
          <span>{item.label}</span>
        </div>
        {open
          ? <ChevronDown size={14} className="opacity-70" />
          : <ChevronRight size={14} className="opacity-70" />
        }
      </button>

      {open && (
        <div className="mb-1 space-y-0.5">
          {item.children.map((child, idx) =>
            isSubGroup(child)
              ? <SubNavGroup key={`sg-${idx}`} item={child} location={location} closeSidebar={closeSidebar} />
              : <SubNavLink  key={(child as LeafItem).path} item={child as LeafItem}
                             active={location.pathname === (child as LeafItem).path}
                             onClick={closeSidebar} />
          )}
        </div>
      )}
    </div>
  )
}

// ── Layout principal ──────────────────────────────────────────────────────────
export default function Layout({ children }: LayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const location = useLocation()
  const { isDark, toggle: toggleDark } = useDarkMode()

  // Ctrl+K / Cmd+K → ouvrir la recherche globale
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        setSearchOpen(prev => !prev)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  const renderNav = (closeSidebar?: () => void) =>
    visibleNavItems.map((item, i) => {
      if ('children' in item && item.children) {
        return (
          <NavGroup
            key={`group-${i}`}
            item={item as NavItem & { children: SubItem[] }}
            location={location}
            closeSidebar={closeSidebar}
          />
        )
      }
      const leaf = item as LeafItem
      return (
        <Link
          key={leaf.path}
          to={leaf.path}
          onClick={closeSidebar}
          className={clsx(
            'flex items-center space-x-3 px-4 py-3 rounded-lg mb-1 transition-colors',
            location.pathname === leaf.path
              ? 'bg-grow-700 text-white'
              : 'text-grow-100 hover:bg-grow-700'
          )}
        >
          <NavIcon item={leaf} />
          <span>{leaf.label}</span>
        </Link>
      )
    })

  // Bottom nav mobile — 4 items principaux + bouton "Plus" (menu complet)
  const bottomNavItems: LeafItem[] = [
    { path: '/',           label: 'Dashboard',  icon: Home },
    { path: '/culture',    label: 'Culture',    icon: Leaf },
    { path: '/calendrier', label: 'Calendrier', icon: CalendarDays },
    { path: '/stock',      label: 'Stock',      icon: Package },
  ]
  const isBottomNavActive = bottomNavItems.some(i => i.path === location.pathname)

  return (
    <div className="flex h-screen-safe bg-gray-50 dark:bg-gray-900">

      {/* ── Sidebar Desktop ── */}
      <aside className="hidden lg:flex lg:flex-col w-64 bg-grow-600 text-white">
        <div className="pt-2 pb-4 px-4 border-b border-grow-700 flex flex-col items-center">
          <img src="/logo.png" alt="GrowManager" className="w-full max-w-[162px] h-auto mb-1" />
          <p className="text-sm text-grow-200 mt-1">v{__APP_VERSION__}</p>
          {/* Bouton recherche globale */}
          <button
            onClick={() => setSearchOpen(true)}
            className="mt-3 w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-grow-700/60 hover:bg-grow-700 text-grow-200 hover:text-white transition-colors text-sm"
            title="Recherche globale (Ctrl+K)"
          >
            <Search size={14} />
            <span className="flex-1 text-left">Rechercher…</span>
            <kbd className="text-xs opacity-60 font-mono">Ctrl+K</kbd>
          </button>
        </div>

        <nav className="flex-1 p-4 overflow-y-auto">
          {renderNav()}
        </nav>

        <div className="p-4 border-t border-grow-700 flex items-center justify-between">
          <p className="text-xs text-grow-200">Pik</p>
          <button
            onClick={toggleDark}
            title={isDark ? 'Passer en mode clair' : 'Passer en mode sombre'}
            className="p-1.5 rounded-lg text-grow-200 hover:bg-grow-700 hover:text-white transition-colors"
          >
            {isDark ? <Sun size={16} /> : <Moon size={16} />}
          </button>
        </div>
      </aside>

      {/* ── Mobile Sidebar ── */}
      {sidebarOpen && (
        <aside className="fixed inset-0 z-40 flex lg:hidden">
          <div className="flex flex-col w-64 bg-grow-600 text-white">
            <div className="p-6 flex items-center justify-between border-b border-grow-700">
              <img src="/logo.png" alt="GrowManager" className="h-12 w-auto" />
              <button
                onClick={() => setSidebarOpen(false)}
                className="text-white hover:bg-grow-700 p-2 rounded-lg"
              >
                <X size={24} />
              </button>
            </div>

            <nav className="flex-1 p-4 overflow-y-auto">
              {renderNav(() => setSidebarOpen(false))}
            </nav>
          </div>

          <div
            className="flex-1 bg-black bg-opacity-50"
            onClick={() => setSidebarOpen(false)}
          />
        </aside>
      )}

      {/* ── Main Content ── */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* Header Mobile */}
        <header className="lg:hidden bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
          <div className="px-4 py-3 flex items-center justify-between">
            <img src="/logo.png" alt="GrowManager" className="h-7 w-auto" />
            <div className="flex items-center gap-2">
              <button
                onClick={() => setSearchOpen(true)}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg text-gray-500 dark:text-gray-400 transition-colors"
                title="Recherche globale"
              >
                <Search size={20} />
              </button>
              <button
                onClick={toggleDark}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg text-gray-500 dark:text-gray-400 dark:text-gray-500 transition-colors"
              >
                {isDark ? <Sun size={20} /> : <Moon size={20} />}
              </button>
              <button
                onClick={() => setSidebarOpen(true)}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg text-gray-700 dark:text-gray-300"
              >
                <Menu size={24} />
              </button>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-auto">
          <div className="p-4 pb-[calc(6rem+env(safe-area-inset-bottom))] lg:p-8 lg:pb-8 max-w-7xl mx-auto">
            {children}
          </div>
        </main>

        {/* Palette Recherche Globale */}
        {searchOpen && <GlobalSearch onClose={() => setSearchOpen(false)} />}

        {/* Bottom Navigation Mobile */}
        <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 pb-[env(safe-area-inset-bottom)]">
          <div className="flex justify-around">
            {bottomNavItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className={clsx(
                  'flex flex-col items-center space-y-1 flex-1 py-2.5 transition-colors',
                  location.pathname === item.path
                    ? 'text-grow-600 dark:text-grow-400'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                )}
              >
                <NavIcon item={item} size={22} />
                <span className="text-[11px] text-center leading-tight">{item.label}</span>
              </Link>
            ))}
            <button
              onClick={() => setSidebarOpen(true)}
              className={clsx(
                'flex flex-col items-center space-y-1 flex-1 py-2.5 transition-colors',
                !isBottomNavActive
                  ? 'text-grow-600 dark:text-grow-400'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
              )}
            >
              <Menu size={22} />
              <span className="text-[11px] text-center leading-tight">Plus</span>
            </button>
          </div>
        </nav>
      </div>
    </div>
  )
}