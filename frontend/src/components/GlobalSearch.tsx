import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, X, Leaf, Sprout, FlaskConical, Package, Users } from 'lucide-react'
import { searchAPI, SearchResults, SearchResult } from '../api/search'

// ── Catégories ────────────────────────────────────────────────────────────────
const CATEGORIES: {
  key: keyof SearchResults
  label: string
  icon: React.ElementType
  color: string
}[] = [
  { key: 'cultures', label: 'Cultures', icon: Leaf, color: 'text-green-600 dark:text-green-400' },
  { key: 'plantes',  label: 'Plantes',  icon: Sprout, color: 'text-emerald-600 dark:text-emerald-400' },
  { key: 'varietes', label: 'Variétés', icon: FlaskConical, color: 'text-purple-600 dark:text-purple-400' },
  { key: 'breeders', label: 'Breeders', icon: Users, color: 'text-blue-600 dark:text-blue-400' },
  { key: 'stock',    label: 'Stock',    icon: Package, color: 'text-orange-600 dark:text-orange-400' },
]

interface GlobalSearchProps {
  onClose: () => void
}

export default function GlobalSearch({ onClose }: GlobalSearchProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResults | null>(null)
  const [loading, setLoading] = useState(false)
  const [activeIdx, setActiveIdx] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const navigate = useNavigate()

  // Focus auto à l'ouverture
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  // Fermer sur Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  // Debounce recherche
  useEffect(() => {
    if (!query.trim() || query.trim().length < 2) {
      setResults(null)
      return
    }
    const t = setTimeout(async () => {
      setLoading(true)
      try {
        const data = await searchAPI.search(query.trim())
        setResults(data)
        setActiveIdx(0)
      } catch {
        setResults(null)
      } finally {
        setLoading(false)
      }
    }, 250)
    return () => clearTimeout(t)
  }, [query])

  // Aplatir tous les résultats pour navigation clavier
  const allItems: (SearchResult & { category: string })[] = results
    ? CATEGORIES.flatMap(cat =>
        (results[cat.key] || []).map(r => ({ ...r, category: cat.label }))
      )
    : []

  const navigateTo = useCallback((item: SearchResult) => {
    navigate(item.url)
    onClose()
  }, [navigate, onClose])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!allItems.length) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIdx(i => Math.min(i + 1, allItems.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIdx(i => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (allItems[activeIdx]) navigateTo(allItems[activeIdx])
    }
  }

  let globalIdx = 0

  return (
    // Overlay
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[10vh] px-4"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

      {/* Panel */}
      <div
        className="relative w-full max-w-2xl bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-200 dark:border-gray-700">
          <Search size={20} className="text-gray-400 flex-shrink-0" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Rechercher cultures, plantes, variétés, stock…"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            className="flex-1 bg-transparent outline-none text-gray-900 dark:text-white placeholder-gray-400 text-base"
          />
          {query && (
            <button onClick={() => setQuery('')} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
              <X size={16} />
            </button>
          )}
          <kbd className="hidden sm:inline-flex items-center px-2 py-0.5 text-xs text-gray-400 border border-gray-200 dark:border-gray-600 rounded">
            Esc
          </kbd>
        </div>

        {/* Results */}
        <div className="max-h-[60vh] overflow-y-auto">
          {!query.trim() || query.trim().length < 2 ? (
            <div className="px-4 py-8 text-center text-gray-400 text-sm">
              Tapez au moins 2 caractères pour rechercher…
            </div>
          ) : loading ? (
            <div className="px-4 py-8 text-center text-gray-400 text-sm animate-pulse">
              Recherche en cours…
            </div>
          ) : !results || allItems.length === 0 ? (
            <div className="px-4 py-8 text-center text-gray-400 text-sm">
              Aucun résultat pour « {query} »
            </div>
          ) : (
            <div className="py-2">
              {CATEGORIES.map(cat => {
                const items = results[cat.key] || []
                if (!items.length) return null
                const Icon = cat.icon
                return (
                  <div key={cat.key} className="mb-1">
                    {/* Category header */}
                    <div className="px-4 py-1.5 flex items-center gap-2">
                      <Icon size={13} className={cat.color} />
                      <span className={`text-xs font-semibold uppercase tracking-wider ${cat.color}`}>
                        {cat.label}
                      </span>
                    </div>
                    {/* Items */}
                    {items.map(item => {
                      const idx = globalIdx++
                      const isActive = idx === activeIdx
                      return (
                        <button
                          key={`${cat.key}-${item.id}`}
                          className={`w-full text-left px-4 py-2.5 flex items-center gap-3 transition-colors ${
                            isActive
                              ? 'bg-grow-50 dark:bg-grow-900/30'
                              : 'hover:bg-gray-50 dark:hover:bg-gray-800'
                          }`}
                          onClick={() => navigateTo(item)}
                          onMouseEnter={() => setActiveIdx(idx)}
                        >
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                              {item.label}
                            </p>
                            {item.sub && (
                              <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                                {item.sub}
                              </p>
                            )}
                          </div>
                          <span className="text-xs text-gray-400 dark:text-gray-500 flex-shrink-0">
                            {item.url}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        {allItems.length > 0 && (
          <div className="px-4 py-2 border-t border-gray-100 dark:border-gray-800 flex gap-4 text-xs text-gray-400">
            <span><kbd className="font-mono">↑↓</kbd> Naviguer</span>
            <span><kbd className="font-mono">↵</kbd> Ouvrir</span>
            <span><kbd className="font-mono">Esc</kbd> Fermer</span>
          </div>
        )}
      </div>
    </div>
  )
}
