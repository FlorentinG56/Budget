import { lazy, Suspense, useEffect, useMemo, useState, type ReactNode } from 'react'
import { BarreOnglets, type Onglet } from './components/BarreOnglets'
import { Feuille } from './components/Feuille'
import { EcheancesCtx } from './components/BandeauEcheances'
import { genererEcheances, initialiserDonnees, synchroniserSecurite, terminerAccueil } from './db/actions'
import { nettoyerPhotos } from './db/sauvegarde'
import { ParcoursAccueil } from './accueil/ParcoursAccueil'
import type { Operation } from './domain/types'
import { NavCtx, type Nav } from './nav/Navigation'
import { SaisieRapide } from './saisie/SaisieRapide'
import { EcranCreationCode, EcranDeverrouillage } from './lock/EcransVerrou'
import { useVerrou } from './lock/Verrou'
import { Accueil } from './screens/Accueil'
import { Calendrier } from './screens/Calendrier'
import { Patrimoine } from './screens/Patrimoine'
import { Reglages } from './screens/Reglages'

// Les analyses (et leur bibliothèque de graphiques) ne sont chargées qu'à l'ouverture de l'onglet.
const Analyses = lazy(() => import('./screens/Analyses').then((m) => ({ default: m.Analyses })))

const ECRANS: Record<Onglet, React.ComponentType> = {
  accueil: Accueil,
  calendrier: Calendrier,
  analyses: Analyses,
  epargne: Patrimoine,
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
  const [numeroSaisie, setNumeroSaisie] = useState(0) // remet la saisie à zéro à chaque ouverture
  const [pile, setPile] = useState<ReactNode[]>([])
  const [pret, setPret] = useState(false)
  const [accueil, setAccueil] = useState(false) // parcours d'accueil d'un nouvel utilisateur

  const nav = useMemo<Nav>(() => ({
    ouvrir: (page) => { setPile((p) => [...p, page]); window.scrollTo(0, 0) },
    retour: () => setPile((p) => p.slice(0, -1)),
    changerOnglet: (o) => { setPile([]); setOnglet(o) },
  }), [])

  // Prélèvements et revenus automatiques : à l'ouverture, puis à chaque retour au premier plan.
  const [recentes, setRecentes] = useState<Operation[]>([])
  const echeances = useMemo(() => ({ recentes, effacer: () => setRecentes([]) }), [recentes])
  useEffect(() => {
    if (etat !== 'deverrouille') return
    const traiter = async () => {
      if (!pret) {
        if ((await initialiserDonnees()) === 'nouveau') { setAccueil(true); setPret(true); return }
        await synchroniserSecurite()
        await nettoyerPhotos() // photos choisies dans un formulaire abandonné
      }
      const creees = await genererEcheances()
      if (creees.length) setRecentes((r) => [...r, ...creees])
      setPret(true)
    }
    void traiter()
    const auRetour = () => { if (document.visibilityState === 'visible') void traiter() }
    document.addEventListener('visibilitychange', auRetour)
    return () => document.removeEventListener('visibilitychange', auRetour)
  }, [etat]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    try { sessionStorage.setItem('onglet', onglet) } catch { /* ignoré */ }
    setPile([])
    window.scrollTo(0, 0)
  }, [onglet])

  // Fermer la saisie si l'app se verrouille.
  useEffect(() => { if (etat !== 'deverrouille') setSaisie(false) }, [etat])

  if (etat === 'chargement') return <div className="h-full bg-fond" />
  if (etat === 'creation') return <EcranCreationCode />
  if (etat === 'verrouille') return <EcranDeverrouillage />
  if (!pret) return <div className="h-full bg-fond" />
  if (accueil) return <ParcoursAccueil surTermine={async () => { await terminerAccueil(); await synchroniserSecurite(); setAccueil(false) }} />

  const Ecran = ECRANS[onglet]
  return (
    <EcheancesCtx.Provider value={echeances}>
    <NavCtx.Provider value={nav}>
      {pile.length > 0 ? <div key={pile.length}>{pile[pile.length - 1]}</div> : <Suspense fallback={<div className="h-full bg-fond" />}><Ecran /></Suspense>}
      <BarreOnglets actif={onglet} surChoix={(o) => (o === onglet ? setPile([]) : setOnglet(o))}
        surAjout={() => { setNumeroSaisie((n) => n + 1); setSaisie(true) }} />
      <Feuille ouverte={saisie} surFermer={() => setSaisie(false)} titre="Nouvelle opération" titreVisible={false}>
        <SaisieRapide key={numeroSaisie} surFermer={() => setSaisie(false)} />
      </Feuille>
    </NavCtx.Provider>
    </EcheancesCtx.Provider>
  )
}
