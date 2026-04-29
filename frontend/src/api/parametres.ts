import axios from 'axios'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

export interface ParametreValeur {
  id_parametre: number
  liste_nom:    string
  valeur:       string
  ordre:        number
}

export const parametresAPI = {
  getList: (listeNom: string) =>
    axios.get<ParametreValeur[]>(`/api/parametres/${listeNom}`),

  add: (listeNom: string, valeur: string) =>
    axios.post<ParametreValeur>(`/api/parametres/${listeNom}`, { valeur }),

  update: (id: number, valeur: string) =>
    axios.patch<ParametreValeur>(`/api/parametres/${id}`, { valeur }),

  delete: (id: number) =>
    axios.delete(`/api/parametres/${id}`),
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
