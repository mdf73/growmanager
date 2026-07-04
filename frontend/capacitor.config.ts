import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.growmanager.app',
  appName: 'GrowManager',
  webDir: 'dist',
  server: {
    // 'http' pour permettre les appels vers un serveur GrowManager en http://
    // (réseau local ou Tailscale). Android bloque le cleartext par défaut,
    // cleartext: true l'autorise (usesCleartextTraffic dans le manifest).
    androidScheme: 'http',
    cleartext: true,
  },
}

export default config
