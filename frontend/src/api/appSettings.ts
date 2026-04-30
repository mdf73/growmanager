import axios from 'axios'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

export interface AppSetting {
  cle:    string
  valeur: string | null
  label:  string | null
}

export const appSettingsAPI = {
  getAll: () =>
    axios.get<AppSetting[]>('/api/app-settings'),

  get: (cle: string) =>
    axios.get<AppSetting>(`/api/app-settings/${cle}`),

  set: (cle: string, valeur: string) =>
    axios.put<AppSetting>(`/api/app-settings/${cle}`, { valeur }),
}

// ── Hook pour lire/écrire un setting unique ───────────────────────────────────
export function useAppSetting(cle: string) {
  const qc = useQueryClient()

  const { data, isLoading } = useQuery<AppSetting>({
    queryKey: ['app-settings', cle],
    queryFn: async () => (await appSettingsAPI.get(cle)).data,
    staleTime: 60_000,
  })

  const updateMut = useMutation({
    mutationFn: (valeur: string) => appSettingsAPI.set(cle, valeur),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['app-settings', cle] }),
  })

  return {
    value: data?.valeur ?? null,
    label: data?.label ?? cle,
    isLoading,
    update: updateMut.mutateAsync,
    isPending: updateMut.isPending,
  }
}
