/**
 * Statut en ligne / hors ligne d'un capteur, partagé par toutes les pages.
 * Un capteur est hors ligne si sa dernière lecture date de plus de 15 min
 * (ou s'il n'a jamais remonté de lecture).
 */

export const SENSOR_OFFLINE_THRESHOLD_MS = 15 * 60 * 1000

const HOUR_MS = 60 * 60 * 1000
const DAY_MS = 24 * HOUR_MS

export function isSensorOnline(derniereLecture?: string | null): boolean {
  if (!derniereLecture) return false
  return Date.now() - new Date(derniereLecture).getTime() < SENSOR_OFFLINE_THRESHOLD_MS
}

/**
 * Libellé "Hors ligne depuis X" :
 * - moins d'1 h        → en minutes
 * - de 1 h à 48 h      → en heures
 * - de 48 h à 30 jours → en jours
 * - au-delà de 30 j    → "Hors ligne" sans durée
 */
export function offlineLabel(derniereLecture?: string | null): string {
  if (!derniereLecture) return 'Hors ligne'
  const diff = Date.now() - new Date(derniereLecture).getTime()
  if (diff > 30 * DAY_MS) return 'Hors ligne'
  if (diff > 48 * HOUR_MS) return `Hors ligne depuis ${Math.floor(diff / DAY_MS)} j`
  if (diff >= HOUR_MS) return `Hors ligne depuis ${Math.floor(diff / HOUR_MS)} h`
  return `Hors ligne depuis ${Math.max(1, Math.floor(diff / 60000))} min`
}
