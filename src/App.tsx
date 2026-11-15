import { useEffect, useState } from 'react'
import { BarreOnglets, type Onglet } from './components/BarreOnglets'
import { Feuille } from './components/Feuille'
import { EcranCreationCode, EcranDeverrouillage } from './lock/EcransVerrou'
import { useVerrou } from './lock/Verrou'
import { Accueil } from './screens/Accueil'
import { Analyses } from './screens/Analyses'
import { Calendrier } from './screens/Calendrier'
import { Epargne } from './screens/Epargne'
import { Reglages } from './screens/Reglages'

const ECRANS: Record<Onglet, () => JSX.Element> = {
  accueil: Accueil,
  calendrier: Calendrier,
  analyses: Analyses,
  epargne: Epargne,
  reglages: Reglages,
}

function lireOnglet(): Onglet {
  try {
    const o = sessionStorage.getItem('onglet')
    if (o && o in ECRANS) return o as Onglet
  } catch { /* stockage indisponible : onglet par défaut */ }
  return 'accueil'
}

export default function App() {
  const { etat } = useVerrou()
  const [onglet, setOnglet] = useState<Onglet>(lireOnglet)
  const [saisie, setSaisie] = useState(false)

  useEffect(() => {
    try { sessionStorage.setItem('onglet', onglet) } catch { /* ignoré */ }
    window.scrollTo(0, 0)
  }, [onglet])

  // Fermer la saisie si l'app se verrouille.
  useEffect(() => { if (etat !== 'deverrouille') setSaisie(false) }, [etat])

  if (etat === 'chargement') return <div className="h-full bg-fond" />
  if (etat === 'creation') return <EcranCreationCode />
  if (etat === 'verrouille') return <EcranDeverrouillage />

  const Ecran = ECRANS[onglet]
  return (
    <>
      <Ecran />
      <BarreOnglets actif={onglet} surChoix={setOnglet} surAjout={() => setSaisie(true)} />
      <Feuille ouverte={saisie} surFermer={() => setSaisie(false)} titre="Nouvelle dépense">
        <p className="rounded-carte bg-white p-4 text-[15px] leading-snug text-encre-douce shadow-carte">
          La saisie rapide (montant, catégorie, terminé) arrive à l’étape 2.
        </p>
      </Feuille>
    </>
  )
}
