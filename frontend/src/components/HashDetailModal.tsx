import { X, Layers } from 'lucide-react'
import type { HashExtraction } from '../api/stock'

interface Props {
  extraction: HashExtraction
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
  title: string; icon?: React.ElementType; children: React.ReactNode
}) {
  return (
    <div className="bg-gray-50 rounded-xl p-4">
      <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3 flex items-center gap-1.5">
        {Icon && <Icon size={13} />}
        {title}
      </h3>
      {children}
    </div>
  )
}

export default function HashDetailModal({ extraction, onClose }: Props) {
  const rdt = extraction.quantite_utilisee > 0
    ? ((extraction.quantite_extraite / extraction.quantite_utilisee) * 100).toFixed(1)
    : null

  const varieteLabel = extraction.variete_nom || extraction.nom_variete_hash || 'Extraction Hash'
  const isPolinator  = extraction.type_extraction === 'Polinator'
  const isIceolator  = extraction.type_extraction === 'Ice-o-lator'
  const typLabel     = isPolinator ? '🥁 Polinator' : isIceolator ? '🧊 Ice-o-lator' : '🍫 Hash'

  // Calcul durée totale Ice-o-lator
  const dureeTotaleIceo = (extraction.passages ?? []).reduce((s, p) => s + (p.duree || 0), 0)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[92vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 shrink-0">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🍫</span>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-semibold text-gray-900">{varieteLabel}</h2>
                <span className="text-xs px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full font-medium">
                  {typLabel}
                </span>
              </div>
              <p className="text-xs text-gray-400 mt-0.5">
                {new Date(extraction.date_hashextraction).toLocaleDateString('fr-FR', {
                  weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
                })}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100">
            <X size={18} />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-4">

          {/* Résumé entrée / sortie / rendement */}
          <div className="grid grid-cols-3 gap-3">
            <div className="text-center bg-blue-50 rounded-xl p-3">
              <p className="text-xs text-blue-500 mb-1">Entrée</p>
              <p className="text-lg font-bold text-blue-800">{extraction.quantite_utilisee.toFixed(1)} g</p>
            </div>
            <div className="text-center bg-amber-50 rounded-xl p-3">
              <p className="text-xs text-amber-600 mb-1">Hash extrait</p>
              <p className="text-lg font-bold text-amber-800">{extraction.quantite_extraite.toFixed(2)} g</p>
            </div>
            <div className="text-center bg-green-50 rounded-xl p-3">
              <p className="text-xs text-green-500 mb-1">Rendement</p>
              <p className="text-lg font-bold text-green-800">{rdt ? `${rdt}%` : '—'}</p>
            </div>
          </div>

          {/* ── Polinator ── */}
          {isPolinator && (
            <Section title="Paramètres Polinator">
              <Row label="Maillage"       value="120µ" />
              <Row label="Durée passage"  value={extraction.duree_polinator != null ? `${extraction.duree_polinator} min` : null} />
              <Row label="Poids entrée"   value={`${extraction.quantite_utilisee.toFixed(1)} g`} />
              <Row label="Poids sortie"   value={`${extraction.quantite_extraite.toFixed(2)} g`} />
            </Section>
          )}

          {/* ── Ice-o-lator : passages ── */}
          {isIceolator && (extraction.passages ?? []).length > 0 && (
            <Section title={`Passages (${extraction.passages!.length})`}>
              {extraction.passages!.map((p, i) => (
                <Row key={i} label={`Passage ${i + 1}`} value={`${p.duree} min`} />
              ))}
              {extraction.passages!.length > 1 && (
                <div className="flex justify-between pt-2 mt-1 border-t border-gray-200">
                  <span className="text-sm font-semibold text-gray-600">Durée totale</span>
                  <span className="text-sm font-bold text-gray-900">{dureeTotaleIceo} min</span>
                </div>
              )}
            </Section>
          )}

          {/* ── Ice-o-lator : sacs par maillage ── */}
          {isIceolator && (extraction.sacs ?? []).length > 0 && (
            <Section title={`Sacs filtrants (${extraction.sacs!.length})`} icon={Layers}>
              {extraction.sacs!.map((s, i) => (
                <Row key={i} label={s.maillage} value={`${Number(s.poids).toFixed(2)} g`} />
              ))}
              <div className="flex justify-between pt-2 mt-1 border-t border-gray-200">
                <span className="text-sm font-semibold text-gray-600">Total extrait</span>
                <span className="text-sm font-bold text-amber-700">{extraction.quantite_extraite.toFixed(2)} g</span>
              </div>
            </Section>
          )}

          {/* Notes */}
          {extraction.info_hashextraction && (
            <Section title="Notes" icon={Layers}>
              <p className="text-sm text-gray-700">{extraction.info_hashextraction}</p>
            </Section>
          )}
        </div>

        <div className="px-6 py-3 border-t border-gray-100 shrink-0 flex justify-end">
          <button onClick={onClose}
            className="px-4 py-2 bg-gray-100 text-gray-700 text-sm rounded-lg hover:bg-gray-200">
            Fermer
          </button>
        </div>
      </div>
    </div>
  )
}
