import client from './client'

// ── GoveeDevice ───────────────────────────────────────────────────────────────

export interface GoveeDevice {
  id_device: number
  nom: string
  device_id?: string
  modele?: string
  ip_lan?: string
  id_espace?: number
  actif: boolean
  notes?: string
  nom_espace?: string
  // Dernière lecture
  derniere_temperature?: number
  derniere_humidite?: number
  derniere_vpd?: number
  derniere_lecture?: string
}

export interface GoveeDeviceCreate {
  nom: string
  device_id?: string
  modele?: string
  ip_lan?: string
  id_espace?: number
  actif?: boolean
  notes?: string
}

export interface GoveeDeviceUpdate extends Partial<GoveeDeviceCreate> {}

// ── TemperatureLog ────────────────────────────────────────────────────────────

export interface TemperatureLog {
  id_log: number | null
  id_device?: number
  id_culture?: number
  id_espace?: number
  date_heure: string
  temperature?: number
  humidite?: number
  vpd?: number
  source?: string
  nom_device?: string
}

export interface TemperatureLogCreate {
  id_device?: number
  id_culture?: number
  id_espace?: number
  date_heure?: string
  temperature?: number
  humidite?: number
  source?: string
}

// ── GoveeConfig ───────────────────────────────────────────────────────────────

export interface GoveeConfig {
  api_key?: string
  polling_enabled: boolean
  // Gmail auto-import
  gmail_user?: string
  gmail_app_password_set: boolean
  gmail_enabled: boolean
  gmail_last_check?: string    // ISO datetime UTC
  gmail_last_status?: string   // Résumé dernière vérif
}

export interface GoveeConfigUpdate {
  api_key?: string
  polling_enabled?: boolean
  gmail_user?: string
  gmail_app_password?: string
  gmail_enabled?: boolean
}

// ── GmailImportResult ─────────────────────────────────────────────────────────

export interface GmailImportResult {
  emails_processed: number
  imported_total:   number
  skipped_total:    number
  errors_total:     number
  message:          string
  ok:               boolean
}

// ── GoveeCloudDevice (import depuis le compte) ────────────────────────────────

export interface GoveeCloudDevice {
  device_id: string
  sku: string
  device_name: string
  already_registered: boolean
}

// ── PollResult ────────────────────────────────────────────────────────────────

export interface PollResult {
  device_id: number
  nom: string
  success: boolean
  temperature?: number
  humidite?: number
  vpd?: number
  erreur?: string
}

// ── CsvImportResult ───────────────────────────────────────────────────────────

export interface CsvImportResult {
  imported: number
  skipped:  number
  errors:   number
  message:  string
}

// ── API client ────────────────────────────────────────────────────────────────

export const capteursAPI = {
  // Devices
  getAll: ()                                 => client.get<GoveeDevice[]>('/capteurs'),
  getOne: (id: number)                       => client.get<GoveeDevice>(`/capteurs/${id}`),
  create: (d: GoveeDeviceCreate)             => client.post<GoveeDevice>('/capteurs', d),
  update: (id: number, d: GoveeDeviceUpdate) => client.put<GoveeDevice>(`/capteurs/${id}`, d),
  delete: (id: number)                       => client.delete(`/capteurs/${id}`),

  // Logs
  getLogs: (params: {
    id_device?: number
    id_espace?: number
    id_culture?: number
    heures?: number
    date_debut?: string   // ISO datetime — prioritaire sur heures
    date_fin?: string     // ISO datetime
  }) => client.get<TemperatureLog[]>('/temperature-logs', { params }),

  getLogsByCulture: (id: number) =>
    client.get<TemperatureLog[]>(`/temperature-logs/culture/${id}`),

  createLog: (log: TemperatureLogCreate) =>
    client.post<TemperatureLog>('/temperature-logs', log),

  deleteLog: (id: number) => client.delete(`/temperature-logs/${id}`),

  // Config Govee
  getConfig:    ()                      => client.get<GoveeConfig>('/govee/config'),
  updateConfig: (c: GoveeConfigUpdate)  => client.put<GoveeConfig>('/govee/config', c),

  // Gmail auto-import
  checkGmail: () => client.post<GmailImportResult>('/govee/check-gmail'),

  // Import depuis compte Govee
  listCloudDevices: () => client.get<GoveeCloudDevice[]>('/govee/cloud-devices'),

  // Polling manuel
  pollNow: () => client.post<PollResult[]>('/govee/poll'),

  // Import CSV historique Govee
  importCsv: (id_device: number, file: File) => {
    const form = new FormData()
    form.append('id_device', String(id_device))
    form.append('file', file)
    return client.post<CsvImportResult>('/govee/import-csv', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },
}
