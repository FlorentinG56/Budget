/** Accès à l'enregistrement du service worker, pour le bouton « Rechercher une mise à jour ». */
let enregistrement: ServiceWorkerRegistration | undefined

export function memoriserEnregistrement(r: ServiceWorkerRegistration) {
  enregistrement = r
}

export type ResultatMiseAJour = 'a_jour' | 'installation' | 'indisponible' | 'hors_connexion'

/**
 * Cherche une nouvelle version. Si elle existe, elle s'installe et l'app se recharge toute seule
 * (le service worker prend la main immédiatement, puis la page est rechargée).
 */
export async function rechercherMiseAJour(): Promise<ResultatMiseAJour> {
  if (!enregistrement) return 'indisponible'
  try {
    await enregistrement.update()
  } catch {
    return 'hors_connexion'
  }
  const nouveau = enregistrement.installing ?? enregistrement.waiting
  if (!nouveau) return 'a_jour'
  navigator.serviceWorker.addEventListener('controllerchange', () => window.location.reload(), { once: true })
  nouveau.postMessage({ type: 'SKIP_WAITING' })
  // filet de sécurité si l'événement n'arrive pas (iOS)
  setTimeout(() => window.location.reload(), 8000)
  return 'installation'
}
