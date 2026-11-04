import axios from 'axios'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { CATEGORIES } from './materiel'
import standard from '../data/standard-parametres.json'

// ── Valeurs verrouillées ──────────────────────────────────────────────────────
// Valeurs sur lesquelles le code s'appuie (champs spécifiques, liens stock/curing, types de
// stock testés par égalité…) : toujours présentes,
// ni renommables ni supprimables depuis Paramétrage. Miroir : backend/app/routers/parametre.py (LISTES_VERROUILLEES).
export const LISTES_VERROUILLEES: Record<string, readonly string[]> = {
  materiel_categories: CATEGORIES,
  types_stock: ['Fleur', 'Trim', 'WPFF', 'Hash', 'Rosin'],
}

export function isValeurVerrouillee(listeNom: string, valeur: string): boolean {
  return LISTES_VERROUILLEES[listeNom]?.includes(valeur) ?? false
}

// ── Standard des listes (ADR-011) ─────────────────────────────────────────────
// Source unique (serveur + autonome) : src/data/standard-parametres.json. Rien n'est chargé
// au démarrage : uniquement via les boutons de Paramétrage, sans jamais écraser l'existant.
export const STANDARD_LISTES: Record<string, string[]> = standard.listes

/** Clé de comparaison : minuscules, sans accents, espaces rognés et réduits.
 *  Miroir : backend/app/routers/parametre.py (normaliser). */
export function normaliserValeur(v: string): string {
  return v.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().split(/\s+/).filter(Boolean).join(' ')
}

export interface ChargementStandard {
  ajoutees:  number
  par_liste: Record<string, number>
}

export interface ParametreValeur {
  id_parametre: number
  liste_nom:    string
  valeur:       string
  ordre:        number
}

// Tri alphabétique français : insensible à la casse et aux accents, nombres dans l'ordre
// naturel (« 15µ » avant « 110µ »). Appliqué à toutes les listes paramétrables.
const collator = new Intl.Collator('fr', { sensitivity: 'base', numeric: true })
export const compareValeurs = (a: string, b: string) => collator.compare(a, b)
export const trierValeurs = (valeurs: string[]) => [...valeurs].sort(compareValeurs)

export const parametresAPI = {
  getList: async (listeNom: string) => {
    const res = await axios.get<ParametreValeur[]>(`/api/parametres/${listeNom}`)
    res.data = [...res.data].sort((a, b) => compareValeurs(a.valeur, b.valeur))
    return res
  },

  add: (listeNom: string, valeur: string) =>
    axios.post<ParametreValeur>(`/api/parametres/${listeNom}`, { valeur }),

  update: (id: number, valeur: string) =>
    axios.patch<ParametreValeur>(`/api/parametres/${id}`, { valeur }),

  delete: (id: number) =>
    axios.delete(`/api/parametres/${id}`),

  /** Ajoute les valeurs standard absentes des listes données (toutes si omis). */
  chargerStandard: (listes?: string[]) => {
    const noms = listes ?? Object.keys(STANDARD_LISTES)
    const payload = Object.fromEntries(noms.filter(n => STANDARD_LISTES[n]).map(n => [n, STANDARD_LISTES[n]]))
    return axios.post<ChargementStandard>('/api/parametres/_standard/charger', { listes: payload })
  },
}

// ── Hook pratique ─────────────────────────────────────────────────────────────
export function useParametreListe(listeNom: string) {
  const { data = [], isLoading } = useQuery<ParametreValeur[]>({
    queryKey: ['parametres', listeNom],
    queryFn: async () => (await parametresAPI.getList(listeNom)).data,
    staleTime: 60_000,
  })
  return { values: data.map(p => p.valeur), items: data, isLoading }
}

// ── Hook avec mutation inline (pour "Ajouter depuis le formulaire") ────────────
export function useParametreListeWithAdd(listeNom: string) {
  const qc = useQueryClient()
  const { values, items, isLoading } = useParametreListe(listeNom)

  const addMut = useMutation({
    mutationFn: (valeur: string) => parametresAPI.add(listeNom, valeur),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['parametres', listeNom] }),
  })

  return { values, items, isLoading, addValue: addMut.mutateAsync, isAdding: addMut.isPending }
}
