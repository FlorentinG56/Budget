import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import App from './App'
import { VerrouProvider } from './lock/Verrou'
import './index.css'

// Service worker : l'app fonctionne hors connexion et se met à jour toute seule à l'ouverture suivante.
if (import.meta.env.PROD) registerSW({ immediate: true })

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
