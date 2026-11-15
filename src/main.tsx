import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import App from './App'
import { memoriserEnregistrement } from './miseAJour'
import { VerrouProvider } from './lock/Verrou'
import './index.css'

// Service worker : l'app fonctionne hors connexion et se met à jour toute seule à l'ouverture suivante.
// Sur iPhone, l'app est rarement fermée complètement : on vérifie aussi les mises à jour
// à chaque retour au premier plan, et toutes les heures.
if (import.meta.env.PROD) {
  registerSW({
    immediate: true,
    onRegisteredSW(_url, enregistrement) {
      if (!enregistrement) return
      memoriserEnregistrement(enregistrement)
      const verifier = () => { void enregistrement.update().catch(() => { /* hors connexion */ }) }
      document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') verifier() })
      setInterval(verifier, 60 * 60 * 1000)
    },
  })
}

// Masque le contenu quand l'app passe en arrière-plan (aperçu du sélecteur d'apps).
document.addEventListener('visibilitychange', () => {
  document.documentElement.classList.toggle('masque', document.visibilityState === 'hidden')
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <VerrouProvider>
      <App />
    </VerrouProvider>
  </StrictMode>,
)
