/**
 * Remonte automatiquement le champ en cours de saisie au-dessus du clavier
 * (application mobile). Complète le correctif natif (native/android/MainActivity.java)
 * qui réduit la WebView quand le clavier s'ouvre : une fois la page réduite,
 * on recentre le champ actif dans la zone visible, y compris dans les modales
 * qui ont leur propre défilement.
 */

const SAISIE = 'input, textarea, select, [contenteditable="true"]'
const TYPES_SANS_CLAVIER = new Set(['checkbox', 'radio', 'button', 'submit', 'reset', 'file', 'range', 'color'])

function estChampSaisie(el: Element | null): el is HTMLElement {
  if (!el || !(el instanceof HTMLElement) || !el.matches(SAISIE)) return false
  if (el instanceof HTMLInputElement && TYPES_SANS_CLAVIER.has(el.type)) return false
  return true
}

function recentrer(el: HTMLElement) {
  const rect = el.getBoundingClientRect()
  const hauteurVisible = window.visualViewport?.height ?? window.innerHeight
  // Déjà bien visible (marge de 16px) : on ne bouge rien.
  if (rect.top >= 16 && rect.bottom <= hauteurVisible - 16) return
  el.scrollIntoView({ block: 'center', behavior: 'smooth' })
}

export function installerRemonteeClavier() {
  // Uniquement sur écran tactile : inutile (et gênant) sur ordinateur.
  if (!window.matchMedia('(pointer: coarse)').matches) return

  let minuterie: number | undefined

  const planifier = (delai: number) => {
    window.clearTimeout(minuterie)
    minuterie = window.setTimeout(() => {
      const actif = document.activeElement
      if (estChampSaisie(actif)) recentrer(actif)
    }, delai)
  }

  // Le clavier met ~250-300 ms à s'ouvrir : on attend que la page soit réduite.
  document.addEventListener('focusin', (e) => {
    if (estChampSaisie(e.target as Element)) planifier(350)
  })

  // La hauteur change quand le clavier s'ouvre (ou change de taille) :
  // on recentre le champ toujours actif.
  const surRedimension = () => planifier(80)
  window.addEventListener('resize', surRedimension)
  window.visualViewport?.addEventListener('resize', surRedimension)
}
