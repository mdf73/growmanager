import { useState } from 'react'
import { Wifi, Loader2, CheckCircle2, AlertCircle, ArrowRight, Smartphone, Server, ChevronLeft } from 'lucide-react'
import { setServerUrl, setAppMode, testServerConnection } from '../api/client'
import { getDb } from '../local/db'

/**
 * Écran de premier lancement de l'app mobile (Capacitor) :
 * choix du mode de fonctionnement — autonome (SQLite local) ou serveur (Phase A).
 * En web classique (même origine), cet écran n'apparaît jamais.
 * Modifiable ensuite dans Paramétrage → Général.
 */
export default function ModeSetup() {
  const [step, setStep] = useState<'choice' | 'server'>('choice')
  const [url, setUrl] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [ok, setOk] = useState(false)

  const handleStandalone = async () => {
    setError(null)
    setBusy(true)
    try {
      await getDb() // crée la base + le schéma au premier lancement
      setAppMode('standalone')
      setOk(true)
      setTimeout(() => window.location.reload(), 600)
    } catch (e) {
      setBusy(false)
      setError(`Impossible d'initialiser la base locale : ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  const handleConnect = async () => {
    setError(null)
    setBusy(true)
    const reachable = await testServerConnection(url)
    setBusy(false)
    if (!reachable) {
      setError("Serveur injoignable. Vérifie l'adresse, que ton serveur GrowManager est démarré, et que ton téléphone est sur le même réseau (WiFi ou Tailscale).")
      return
    }
    setOk(true)
    setServerUrl(url)
    setAppMode('server')
    setTimeout(() => window.location.reload(), 600)
  }

  return (
    <div className="min-h-screen bg-grow-700 flex flex-col items-center justify-center p-6">
      <img src="/logo.png" alt="GrowManager" className="w-56 h-auto mb-8" />

      <div className="w-full max-w-sm bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-6 space-y-4">
        {step === 'choice' ? (
          <>
            <div>
              <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100">Comment veux-tu utiliser l'app ?</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Modifiable ensuite dans Paramétrage → Général.
              </p>
            </div>

            <button
              onClick={handleStandalone}
              disabled={busy || ok}
              className="w-full flex items-start gap-3 p-4 border-2 border-grow-600 rounded-xl text-left hover:bg-grow-600/5 disabled:opacity-50"
            >
              {busy ? <Loader2 size={22} className="shrink-0 mt-0.5 text-grow-600 animate-spin" /> : <Smartphone size={22} className="shrink-0 mt-0.5 text-grow-600" />}
              <span>
                <span className="block text-sm font-semibold text-gray-900 dark:text-gray-100">Autonome (sur ce téléphone)</span>
                <span className="block text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  Données 100% locales, aucun serveur requis. Fonctionne hors connexion.
                </span>
              </span>
            </button>

            <button
              onClick={() => { setStep('server'); setError(null) }}
              disabled={busy || ok}
              className="w-full flex items-start gap-3 p-4 border border-gray-300 dark:border-gray-600 rounded-xl text-left hover:bg-gray-50 dark:hover:bg-gray-700/40 disabled:opacity-50"
            >
              <Server size={22} className="shrink-0 mt-0.5 text-gray-500 dark:text-gray-400" />
              <span>
                <span className="block text-sm font-semibold text-gray-900 dark:text-gray-100">Connecté à un serveur</span>
                <span className="block text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  L'app parle à ton serveur GrowManager (réseau local, Tailscale ou internet).
                </span>
              </span>
            </button>

            {error && (
              <p className="text-sm text-red-600 dark:text-red-400 flex items-start gap-1.5">
                <AlertCircle size={15} className="shrink-0 mt-0.5" /> {error}
              </p>
            )}
            {ok && (
              <p className="text-sm text-green-600 dark:text-green-400 flex items-center gap-1.5">
                <CheckCircle2 size={15} /> Base locale prête ! Chargement…
              </p>
            )}
          </>
        ) : (
          <>
            <div>
              <button
                onClick={() => { setStep('choice'); setError(null) }}
                className="flex items-center gap-1 text-xs text-gray-400 dark:text-gray-500 hover:text-gray-600 mb-2"
              >
                <ChevronLeft size={14} /> Retour au choix du mode
              </button>
              <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100">Connexion au serveur</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Indique l'adresse de ton serveur GrowManager pour commencer.
              </p>
            </div>

            <input
              type="url"
              inputMode="url"
              autoCapitalize="none"
              value={url}
              onChange={e => { setUrl(e.target.value); setError(null) }}
              placeholder="http://192.168.1.50"
              className="w-full px-3 py-3 border border-gray-300 dark:border-gray-600 rounded-xl text-sm bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-grow-600"
            />

            {error && (
              <p className="text-sm text-red-600 dark:text-red-400 flex items-start gap-1.5">
                <AlertCircle size={15} className="shrink-0 mt-0.5" /> {error}
              </p>
            )}
            {ok && (
              <p className="text-sm text-green-600 dark:text-green-400 flex items-center gap-1.5">
                <CheckCircle2 size={15} /> Connecté ! Chargement…
              </p>
            )}

            <button
              onClick={handleConnect}
              disabled={busy || !url.trim() || ok}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-grow-600 text-white rounded-xl text-sm font-medium hover:bg-grow-700 disabled:opacity-50"
            >
              {busy ? <Loader2 size={16} className="animate-spin" /> : <Wifi size={16} />}
              {busy ? 'Test de connexion…' : 'Se connecter'}
              {!busy && !ok && <ArrowRight size={16} />}
            </button>

            <p className="text-xs text-gray-400 dark:text-gray-500">
              Exemples : http://192.168.1.50 (réseau local) · https://growmanager.tondomaine.fr ·
              http://100.x.y.z (Tailscale).
            </p>
          </>
        )}
      </div>
    </div>
  )
}
