import { useState } from 'react'
import { Wifi, Loader2, CheckCircle2, AlertCircle, ArrowRight } from 'lucide-react'
import { setServerUrl, testServerConnection } from '../api/client'

/**
 * Écran de premier lancement de l'app mobile (Capacitor) :
 * affiché tant qu'aucune URL de serveur GrowManager n'est configurée.
 * En web classique (même origine), cet écran n'apparaît jamais.
 */
export default function ServerSetup() {
  const [url, setUrl] = useState('')
  const [testing, setTesting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [ok, setOk] = useState(false)

  const handleConnect = async () => {
    setError(null)
    setTesting(true)
    const reachable = await testServerConnection(url)
    setTesting(false)
    if (!reachable) {
      setError("Serveur injoignable. Vérifie l'adresse, que ton serveur GrowManager est démarré, et que ton téléphone est sur le même réseau (WiFi ou Tailscale).")
      return
    }
    setOk(true)
    setServerUrl(url)
    setTimeout(() => window.location.reload(), 600)
  }

  return (
    <div className="min-h-screen bg-grow-700 flex flex-col items-center justify-center p-6">
      <img src="/logo.png" alt="GrowManager" className="w-56 h-auto mb-8" />

      <div className="w-full max-w-sm bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-6 space-y-4">
        <div>
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
          disabled={testing || !url.trim() || ok}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-grow-600 text-white rounded-xl text-sm font-medium hover:bg-grow-700 disabled:opacity-50"
        >
          {testing ? <Loader2 size={16} className="animate-spin" /> : <Wifi size={16} />}
          {testing ? 'Test de connexion…' : 'Se connecter'}
          {!testing && !ok && <ArrowRight size={16} />}
        </button>

        <p className="text-xs text-gray-400 dark:text-gray-500">
          Exemples : http://192.168.1.50 (réseau local) · https://growmanager.tondomaine.fr ·
          http://100.x.y.z (Tailscale). Modifiable ensuite dans Paramétrage → Général.
        </p>
      </div>
    </div>
  )
}
