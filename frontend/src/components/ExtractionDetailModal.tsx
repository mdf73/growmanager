import { X, Thermometer, Timer, Layers, FlaskConical, Package } from 'lucide-react'
import type { RosinExtraction } from '../api/stock'

interface Props {
  extraction: RosinExtraction
  onClose: () => void
}

function Row({ label, value }: { label: string; value?: string | number | null }) {
  if (value == null || value === '') return null
  return (
    <div className="flex justify-between py-1.5 border-b border-gray-100 last:border-0">
      <span className="text-sm text-gray-500">{label}</span>
      <span className="text-sm font-medium text-gray-900">{value}</span>
    </div>
  )
}

function Section({ title, icon: Icon, children }: {
  title: string
  icon: React.ElementType
  children: React.ReactNode
}) {
  return (
    <div className="bg-gray-50 rounded-xl p-4">
      <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3 flex items-center gap-1.5">
        <Icon size={13} />
        {title}
      </h3>
      {children}
    </div>
  )
}

export default function ExtractionDetailModal({ extraction, onClose }: Props) {
  const rdt = extraction.quantite_utilisee > 0
    ? ((extraction.quantite_extraite / extraction.quantite_utilisee) * 100).toFixed(1)
    : null

  // Sacs
  const sacsData = [
    extraction.sac_1_poids,
    extraction.sac_2_poids,
    extraction.sac_3_poids,
    extraction.sac_4_poids,
  ].filter((v): v is number => v != null && v > 0)

  // Passes de presse
  const pressesData = [
    extraction.presse_1_poids,
    extraction.presse_2_poids,
    extraction.presse_3_poids,
    extraction.presse_4_poids,
  ].filter((v): v is number => v != null && v > 0)

  const fmt = (v?: number | null) => v != null ? `${v.toFixed(2)} g` : null
  const fmtSec = (v?: number | null) => {
    if (v == null) return null
    if (v < 60) return `${v} sec`
    return `${Math.floor(v / 60)}min ${v % 60 > 0 ? `${v % 60}sec` : ''}`.trim()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 shrink-0">
          <div>
            <h2 className="text-base font-semibold text-gray-900">
              {extraction.variete_nom || extraction.nom_variete_extract || 'Extraction'}
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">
              {new Date(extraction.date_rosinextraction).toLocaleDateString('fr-FR', {
                weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
              })}
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100">
            <X size={18} />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-4">

          {/* Résumé rendement */}
          <div className="grid grid-cols-3 gap-3">
            <div className="text-center bg-blue-50 rounded-xl p-3">
              <p className="text-xs text-blue-500 mb-1">Entrée</p>
              <p className="text-lg font-bold text-blue-800">{extraction.quantite_utilisee.toFixed(1)} g</p>
            </div>
            <div className="text-center bg-purple-50 rounded-xl p-3">
              <p className="text-xs text-purple-500 mb-1">Sortie</p>
              <p className="text-lg font-bold text-purple-800">{extraction.quantite_extraite.toFixed(2)} g</p>
            </div>
            <div className="text-center bg-grow-50 rounded-xl p-3">
              <p className="text-xs text-grow-500 mb-1">Rendement</p>
              <p className="text-lg font-bold text-grow-800">{rdt ? `${rdt}%` : '—'}</p>
            </div>
          </div>

          {/* Paramètres d'extraction */}
          <Section title="Paramètres d'extraction" icon={Thermometer}>
            <Row label="Température" value={extraction.temperature_extraction != null ? `${extraction.temperature_extraction} °C` : null} />
            <Row label="Maillage du sac" value={extraction.maillage} />
            <Row label="Pré-chauffe" value={fmtSec(extraction.duree_preheat)} />
            <Row label="Durée extraction" value={fmtSec(extraction.duree_extraction)} />
          </Section>

          {/* Sacs d'entrée */}
          <Section title={`Sacs d'entrée (${sacsData.length})`} icon={Package}>
            {sacsData.length > 0
              ? sacsData.map((v, i) => (
                  <Row key={i} label={`Sac ${i + 1}`} value={`${v.toFixed(1)} g`} />
                ))
              : <p className="text-sm text-gray-400">— Non renseigné</p>
            }
            {sacsData.length > 0 && (
              <div className="flex justify-between pt-2 mt-1 border-t border-gray-200">
                <span className="text-sm font-semibold text-gray-600">Total</span>
                <span className="text-sm font-bold text-gray-900">{extraction.quantite_utilisee.toFixed(1)} g</span>
              </div>
            )}
          </Section>

          {/* Passes de presse */}
          <Section title={`Passes de presse (${pressesData.length})`} icon={FlaskConical}>
            {pressesData.length > 0
              ? pressesData.map((v, i) => (
                  <Row key={i} label={`Passe ${i + 1}`} value={`${v.toFixed(2)} g`} />
                ))
              : <p className="text-sm text-gray-400">— Non renseigné</p>
            }
            {pressesData.length > 0 && (
              <div className="flex justify-between pt-2 mt-1 border-t border-gray-200">
                <span className="text-sm font-semibold text-gray-600">Total</span>
                <span className="text-sm font-bold text-purple-700">{extraction.quantite_extraite.toFixed(2)} g</span>
              </div>
            )}
          </Section>

          {/* Notes */}
          {extraction.info_rosinextraction && (
            <Section title="Notes" icon={Layers}>
              <p className="text-sm text-gray-700">{extraction.info_rosinextraction}</p>
            </Section>
          )}
        </div>

        <div className="px-6 py-3 border-t border-gray-100 shrink-0 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-100 text-gray-700 text-sm rounded-lg hover:bg-gray-200"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  )
}
