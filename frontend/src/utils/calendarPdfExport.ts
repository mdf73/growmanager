/**
 * Utilitaire partagé — génération du PDF calendrier jour-par-jour.
 * Utilisé par CalendrierGlobal et par la fiche culture.
 */
import { CalendrierEvent } from '../api/calendrier'
import { TemperatureLog } from '../api/capteurs'
import { Photo } from '../api/photos'

// ─── Couleurs actions ─────────────────────────────────────────────────────────
export const ACTION_COLORS_PDF: Record<string, string> = {
  graine_germee:    '#10b981',
  debut_croissance: '#22c55e',
  debut_floraison:  '#ec4899',
  passage_12_12:    '#f59e0b',
  arrosage_eau:     '#3b82f6',
  arrosage_engrais: '#8b5cf6',
  taille:           '#6b7280',
  defoliation:      '#f97316',
  recolte:          '#84cc16',
  observations:     '#fbbf24',
  traitement:       '#ef4444',
  debut_curing:     '#a78bfa',
  debut_sechage:    '#94a3b8',
  ouverture_bocal:  '#c084fc',
  photo:            '#ec4899',
}

// ─── Labels actions ───────────────────────────────────────────────────────────
export const ACTION_META: Record<string, { emoji: string; label: string }> = {
  graine_germee:      { emoji: '🌱', label: 'Germination' },
  debut_croissance:   { emoji: '🌿', label: 'Début croissance' },
  debut_floraison:    { emoji: '🌸', label: 'Début floraison' },
  passage_12_12:      { emoji: '🔆', label: 'Passage 12/12' },
  arrosage_eau:       { emoji: '💧', label: 'Arrosage eau' },
  arrosage_engrais:   { emoji: '🧪', label: 'Arrosage engrais' },
  taille:             { emoji: '✂️', label: 'Taille' },
  defoliation:        { emoji: '🍂', label: 'Défoliation' },
  recolte:            { emoji: '🌾', label: 'Récolte' },
  observations:       { emoji: '📝', label: 'Observation' },
  traitement:         { emoji: '🔬', label: 'Traitement' },
  debut_curing:       { emoji: '🏺', label: 'Début curing' },
  debut_sechage:      { emoji: '🌬️', label: 'Début séchage' },
  ouverture_bocal:    { emoji: '🫙', label: 'Burping bocal' },
  photo:              { emoji: '📷', label: 'Photo' },
}

// ─── Palette capteurs ─────────────────────────────────────────────────────────
const DEVICE_COLORS_PDF = ['#ef4444', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899']

// ─── Courbes capteurs SVG ─────────────────────────────────────────────────────
export function buildSensorSVGCharts(dayLogs: TemperatureLog[]): string {
  if (dayLogs.length === 0) return ''

  const deviceMap = new Map<string, string>()
  for (const log of dayLogs) {
    const k = log.id_device != null ? String(log.id_device) : 'all'
    if (!deviceMap.has(k)) deviceMap.set(k, log.nom_device ?? (log.id_device != null ? `Capteur ${log.id_device}` : 'Capteur'))
  }
  const devices = [...deviceMap.entries()].map(([key, nom], i) => ({
    key, nom, color: DEVICE_COLORS_PDF[i % DEVICE_COLORS_PDF.length],
  }))
  const singleMode = devices.length === 1

  type Bucket = { vals: number[] }
  const METRIC_KEYS = ['temp', 'hum', 'vpd'] as const
  const buckets = new Map<string, Map<string, Map<number, Bucket>>>()
  for (const d of devices) {
    const mMap = new Map<string, Map<number, Bucket>>()
    for (const mk of METRIC_KEYS) {
      mMap.set(mk, new Map(Array.from({ length: 24 }, (_, h) => [h, { vals: [] }])))
    }
    buckets.set(d.key, mMap)
  }
  for (const log of dayLogs) {
    const dKey = log.id_device != null ? String(log.id_device) : 'all'
    if (!buckets.has(dKey)) continue
    const h = new Date(log.date_heure).getHours()
    const b = buckets.get(dKey)!
    if (log.temperature != null) b.get('temp')!.get(h)!.vals.push(log.temperature)
    if (log.humidite    != null) b.get('hum')!.get(h)!.vals.push(log.humidite)
    if (log.vpd         != null) b.get('vpd')!.get(h)!.vals.push(log.vpd)
  }

  const avgV = (arr: number[]) => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null

  const W = 500, H = 72
  const padL = 36, padR = 10, padT = 8, padB = 18
  const cW = W - padL - padR
  const cH = H - padT - padB
  const xp = (h: number) => padL + (h / 23) * cW
  const yp = (v: number, dMin: number, dMax: number) =>
    padT + (1 - Math.max(0, Math.min(1, (v - dMin) / (dMax - dMin)))) * cH

  const METRICS_DEF = [
    { key: 'temp' as const, label: 'Température (°C)', dMin: 10, dMax: 40  },
    { key: 'hum'  as const, label: 'Humidité (%)',     dMin: 0,  dMax: 100 },
    { key: 'vpd'  as const, label: 'VPD (kPa)',        dMin: 0,  dMax: 3   },
  ]

  const charts = METRICS_DEF.map(m => {
    const polylines = devices.map(d => {
      const pts: string[] = []
      for (let h = 0; h < 24; h++) {
        const v = avgV(buckets.get(d.key)!.get(m.key)!.get(h)!.vals)
        if (v != null) pts.push(`${xp(h).toFixed(1)},${yp(v, m.dMin, m.dMax).toFixed(1)}`)
      }
      if (pts.length < 2) return ''
      return `<polyline points="${pts.join(' ')}" fill="none" stroke="${d.color}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>`
    }).join('')
    if (!polylines.trim()) return ''

    const yTicks = [m.dMin, (m.dMin + m.dMax) / 2, m.dMax].map(v => {
      const y = yp(v, m.dMin, m.dMax)
      return `<line x1="${padL}" y1="${y.toFixed(1)}" x2="${W - padR}" y2="${y.toFixed(1)}" stroke="#e5e7eb" stroke-width="0.5"/>
              <text x="${(padL - 3).toFixed(1)}" y="${(y + 3).toFixed(1)}" text-anchor="end" font-size="7" fill="#9ca3af">${v}</text>`
    }).join('')

    const xTicks = [0, 6, 12, 18, 23].map(h => {
      const x = xp(h)
      return `<text x="${x.toFixed(1)}" y="${(H - 3).toFixed(1)}" text-anchor="middle" font-size="7" fill="#9ca3af">${String(h).padStart(2, '0')}h</text>`
    }).join('')

    const legendH = singleMode ? 0 : 14
    const legend = singleMode ? '' : devices.map((d, i) => {
      const lx = padL + i * 120
      return `<line x1="${lx}" y1="${H + 7}" x2="${lx + 16}" y2="${H + 7}" stroke="${d.color}" stroke-width="1.8"/>
              <text x="${lx + 20}" y="${H + 11}" font-size="8" fill="#6b7280">${d.nom}</text>`
    }).join('')

    const totalH = H + legendH
    return `<div class="sensor-chart">
      <div class="sensor-chart-label">${m.label}</div>
      <svg viewBox="0 0 ${W} ${totalH}" width="100%" style="display:block;" xmlns="http://www.w3.org/2000/svg">
        <rect x="${padL}" y="${padT}" width="${cW}" height="${cH}" fill="#f9fafb" rx="2"/>
        ${yTicks}
        ${xTicks}
        ${polylines}
        ${legend}
      </svg>
    </div>`
  }).filter(Boolean).join('')

  if (!charts) return ''
  return `<div class="sensor-section">
    <div class="sensor-section-title">&#127777;&#65039; Constantes du jour</div>
    ${charts}
  </div>`
}

// ─── Génération du HTML PDF ───────────────────────────────────────────────────
export interface CalendarPDFOptions {
  title?: string       // Titre de la cover page (défaut: "Calendrier GrowManager")
  subtitle?: string    // Sous-titre (défaut: "Export jour par jour")
  cultureName?: string // Nom de la culture (affiché sur la cover si fourni)
}

export function generateCalendarPDF(
  events: CalendrierEvent[],
  dateDebut: string,
  dateFin: string,
  sensorLogs: TemperatureLog[] = [],
  options: CalendarPDFOptions = {},
  photos: Photo[] = [],
) {
  const {
    title      = 'Calendrier GrowManager',
    subtitle   = 'Export jour par jour',
    cultureName,
  } = options

  // Grouper events par jour
  const byDay = new Map<string, CalendrierEvent[]>()
  for (const evt of events) {
    const key = evt.date_action.slice(0, 10)
    if (!byDay.has(key)) byDay.set(key, [])
    byDay.get(key)!.push(evt)
  }

  // Grouper photos par jour
  const photosByDay = new Map<string, Photo[]>()
  const origin = window.location.origin
  for (const p of photos) {
    const key = p.date_prise.slice(0, 10)
    if (!photosByDay.has(key)) photosByDay.set(key, [])
    photosByDay.get(key)!.push(p)
  }

  // Grouper logs capteurs par jour
  const sensorByDay = new Map<string, TemperatureLog[]>()
  for (const log of sensorLogs) {
    const key = log.date_heure.slice(0, 10)
    if (!sensorByDay.has(key)) sensorByDay.set(key, [])
    sensorByDay.get(key)!.push(log)
  }

  // Générer la liste de tous les jours dans l'intervalle
  const days: string[] = []
  const cur = new Date(dateDebut + 'T12:00:00')
  const end = new Date(dateFin   + 'T12:00:00')
  while (cur <= end) {
    days.push(cur.toISOString().slice(0, 10))
    cur.setDate(cur.getDate() + 1)
  }

  const fmtDate = (iso: string) =>
    new Date(iso + 'T12:00:00').toLocaleDateString('fr-FR', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    })

  const fmtTime = (isoFull: string) => {
    const d = new Date(isoFull)
    const h = d.getHours(), m = d.getMinutes()
    return (h || m) ? `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}` : ''
  }

  const dayPages = days.map((day, idx) => {
    const evts = byDay.get(day) ?? []
    const isEmpty = evts.length === 0

    const groups = new Map<string, CalendrierEvent[]>()
    for (const evt of evts) {
      if (!groups.has(evt.type_action)) groups.set(evt.type_action, [])
      groups.get(evt.type_action)!.push(evt)
    }

    const groupsHtml = [...groups.entries()].map(([type, gEvts]) => {
      const meta = ACTION_META[type] ?? { emoji: '📌', label: type }
      const color = ACTION_COLORS_PDF[type] ?? '#6b7280'

      const evtRows = gEvts.map(evt => {
        const time = fmtTime(evt.date_action)
        const params = evt.parametres && typeof evt.parametres === 'object'
          ? Object.entries(evt.parametres)
              .filter(([k]) => k !== 'nb_photos')   // on n'affiche pas nb_photos (compte interne)
              .map(([k, v]) => `<span class="param">${k.replace(/_/g,' ')}: <b>${v}</b></span>`)
              .join(' · ')
          : ''
        const note = evt.note ? `<div class="evt-note">📝 ${evt.note}</div>` : ''

        // Pour l'action photo, pas de badge — les images sont affichées en grille sous les events
        const photoInfo = ''

        return `
          <div class="evt-row">
            <div class="evt-meta">
              ${time ? `<span class="evt-time">${time}</span>` : ''}
              <span class="evt-culture">${evt.culture_nom}</span>
              ${evt.plant_nom ? `<span class="evt-plant">— ${evt.plant_nom}</span>` : ''}
              ${evt.global_culture ? `<span class="evt-global">culture entière</span>` : ''}
            </div>
            ${params ? `<div class="evt-params">${params}</div>` : ''}
            ${photoInfo}
            ${note}
          </div>`
      }).join('')

      return `
        <div class="group-block" style="border-left-color: ${color}">
          <div class="group-title">
            <span class="group-emoji">${meta.emoji}</span>
            <span class="group-label">${meta.label}</span>
            <span class="group-count">${gEvts.length} événement${gEvts.length > 1 ? 's' : ''}</span>
          </div>
          <div class="group-events">${evtRows}</div>
        </div>`
    }).join('')

    const isLast = idx === days.length - 1
    const sensorChartsHtml = buildSensorSVGCharts(sensorByDay.get(day) ?? [])

    // Grille de photos du jour
    const dayPhotos = photosByDay.get(day) ?? []
    const photosHtml = dayPhotos.length > 0
      ? `<div class="photos-section">
          <div class="photos-section-title">📷 Photos du jour (${dayPhotos.length})</div>
          <div class="photos-grid">
            ${dayPhotos.map(p => {
              const src = p.thumbnail_path
                ? `${origin}/uploads/${p.thumbnail_path}`
                : `${origin}/uploads/${p.filepath}`
              const note = p.notes ? `<div class="photo-note">${p.notes}</div>` : ''
              return `<div class="photo-item">
                <img src="${src}" alt="${p.filename}" class="photo-thumb" />
                ${note}
              </div>`
            }).join('')}
          </div>
        </div>`
      : ''

    return `
      <div class="day-page${isLast ? ' last-page' : ''}">
        <div class="day-header">
          <div class="day-date">${fmtDate(day)}</div>
          <div class="day-count">${evts.length === 0 ? 'Aucun événement' : `${evts.length} événement${evts.length > 1 ? 's' : ''}`}</div>
        </div>
        ${sensorChartsHtml}
        ${isEmpty
          ? `<div class="empty-day"><span>🌙</span><span>Journée calme — aucune action enregistrée</span></div>`
          : `<div class="groups-container">${groupsHtml}</div>`
        }
        ${photosHtml}
      </div>`
  }).join('')

  const coverExtra = cultureName
    ? `<div class="cover-culture">${cultureName}</div>`
    : ''

  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <title>${title} — ${fmtDate(dateDebut)} → ${fmtDate(dateFin)}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      font-size: 13px;
      color: #1f2937;
      background: white;
    }
    .cover {
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      page-break-after: always;
      padding: 60px 40px;
      background: #f9fafb;
    }
    .cover-logo { font-size: 64px; margin-bottom: 24px; }
    .cover-title { font-size: 36px; font-weight: 700; color: #111827; margin-bottom: 8px; text-align: center; }
    .cover-subtitle { font-size: 18px; color: #6b7280; text-align: center; margin-bottom: 16px; }
    .cover-culture {
      font-size: 22px; font-weight: 700; color: #16a34a;
      margin-bottom: 20px; text-align: center;
    }
    .cover-range {
      background: white;
      border: 2px solid #e5e7eb;
      border-radius: 12px;
      padding: 20px 40px;
      text-align: center;
    }
    .cover-range-label { font-size: 12px; font-weight: 600; color: #9ca3af; text-transform: uppercase; letter-spacing: .05em; margin-bottom: 6px; }
    .cover-range-dates { font-size: 16px; font-weight: 600; color: #374151; }
    .cover-stats { margin-top: 24px; font-size: 14px; color: #6b7280; }
    .day-page {
      page-break-after: always;
      padding: 32px 40px;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
    }
    .day-page.last-page { page-break-after: avoid; }
    .day-header {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      border-bottom: 2px solid #16a34a;
      padding-bottom: 10px;
      margin-bottom: 20px;
    }
    .day-date { font-size: 22px; font-weight: 700; color: #111827; text-transform: capitalize; }
    .day-count { font-size: 13px; color: #6b7280; font-weight: 500; }
    .empty-day {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 12px;
      color: #9ca3af;
      font-size: 15px;
    }
    .empty-day span:first-child { font-size: 40px; }
    .groups-container { display: flex; flex-direction: column; gap: 16px; }
    .group-block { border-left: 4px solid #16a34a; padding-left: 14px; }
    .group-title { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
    .group-emoji { font-size: 16px; }
    .group-label { font-size: 14px; font-weight: 700; color: #111827; }
    .group-count { margin-left: auto; font-size: 11px; color: #9ca3af; }
    .group-events { display: flex; flex-direction: column; gap: 6px; }
    .evt-row {
      background: #f9fafb;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      padding: 8px 12px;
    }
    .evt-meta { display: flex; align-items: center; flex-wrap: wrap; gap: 6px; margin-bottom: 2px; }
    .evt-time { font-size: 11px; font-weight: 600; color: #6b7280; background: #e5e7eb; padding: 1px 6px; border-radius: 4px; }
    .evt-culture { font-weight: 600; color: #16a34a; font-size: 13px; }
    .evt-plant { font-size: 12px; color: #6b7280; }
    .evt-global { font-size: 10px; color: #9ca3af; background: #f3f4f6; padding: 1px 6px; border-radius: 10px; }
    .evt-params { font-size: 11px; color: #4b5563; margin-top: 3px; display: flex; flex-wrap: wrap; gap: 6px; }
    .param { background: #eff6ff; color: #1d4ed8; padding: 1px 6px; border-radius: 4px; }
    .evt-note { font-size: 11px; color: #92400e; background: #fffbeb; border: 1px solid #fde68a; border-radius: 4px; padding: 4px 8px; margin-top: 4px; }
    .photos-section { margin-top: 20px; }
    .photos-section-title { font-size: 12px; font-weight: 700; color: #9d174d; margin-bottom: 10px; padding-bottom: 6px; border-bottom: 1px solid #fbcfe8; }
    .photos-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; }
    .photo-item { display: flex; flex-direction: column; gap: 4px; }
    .photo-thumb { width: 100%; aspect-ratio: 1; object-fit: cover; border-radius: 6px; border: 1px solid #e5e7eb; }
    .photo-note { font-size: 10px; color: #6b7280; text-align: center; }
    .sensor-section { margin-bottom: 20px; padding: 12px 14px; background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; }
    .sensor-section-title { font-size: 11px; font-weight: 700; color: #6b7280; text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 10px; }
    .sensor-chart { margin-bottom: 8px; }
    .sensor-chart:last-child { margin-bottom: 0; }
    .sensor-chart-label { font-size: 10px; font-weight: 600; color: #374151; margin-bottom: 2px; }
    @media print {
      @page { size: A4; margin: 0; }
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
  </style>
</head>
<body>
  <div class="cover">
    <div class="cover-logo">🌿</div>
    <div class="cover-title">${title}</div>
    <div class="cover-subtitle">${subtitle}</div>
    ${coverExtra}
    <div class="cover-range">
      <div class="cover-range-label">Période</div>
      <div class="cover-range-dates">${fmtDate(dateDebut)} → ${fmtDate(dateFin)}</div>
    </div>
    <div class="cover-stats">${days.length} jour${days.length > 1 ? 's' : ''} · ${events.length} événement${events.length > 1 ? 's' : ''} au total</div>
  </div>
  ${dayPages}
  <script>window.onload = () => window.print()</script>
</body>
</html>`

  const win = window.open('', '_blank')
  if (win) {
    win.document.write(html)
    win.document.close()
  }
}
