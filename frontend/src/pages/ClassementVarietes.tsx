import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Trophy, Download, X, Leaf, Wind, FlaskConical, Pencil, Trash2, ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react'
import { notationVarieteAPI, NotationRead, NotationCreate, NotationUpdate, ExtractionStatsMap } from '../api/notationVariete'
import { varieteAPI, Variete } from '../api/varietes'
import { breederAPI, Breeder } from '../api/breeders'
import { planCultureAPI, CatalogueItem } from '../api/planCulture'
import TerpeneMultiSelect, { TerpeneBadges, parseTerpenes } from '../components/TerpeneMultiSelect'

// ── Tri ───────────────────────────────────────────────────────────────────────
type SortColClassement = 'culture' | 'conso' | 'score'
type SortDirC = 'asc' | 'desc'

function SortIconC({ col, current, dir }: { col: SortColClassement; current: SortColClassement; dir: SortDirC }) {
  if (current !== col) return <ChevronsUpDown size={11} className="ml-1 text-gray-400 inline" />
  return dir === 'asc'
    ? <ChevronUp size={11} className="ml-1 text-grow-400 inline" />
    : <ChevronDown size={11} className="ml-1 text-grow-400 inline" />
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function clamp(v: number | null | undefined, max: number): number {
  if (v == null) return 0
  return Math.min(Math.max(0, v), max)
}

function scoreColor(pct: number): string {
  if (pct >= 80) return 'text-emerald-600 dark:text-emerald-400 font-bold'
  if (pct >= 65) return 'text-green-600 dark:text-green-400 font-semibold'
  if (pct >= 50) return 'text-yellow-600 dark:text-yellow-400 font-semibold'
  if (pct >= 35) return 'text-orange-500'
  return 'text-red-500'
}