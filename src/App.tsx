import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { BarreOnglets, type Onglet } from './components/BarreOnglets'
import { Feuille } from './components/Feuille'
import { initialiserDonnees } from './db/actions'
import { NavCtx, type Nav } from './nav/Navigation'
import { SaisieRapide } from './saisie/SaisieRapide'
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
  const [numeroSaisie, setNumeroSaisie] = useState(0) // remet la saisie à zéro à chaque ouverture
  const [pile, setPile] = useState<ReactNode[]>([])
  const [pret, setPret] = useState(false)

  const nav = useMemo<Nav>(() => ({
    ouvrir: (page) => { setPile((p) => [...p, page]); window.scrollTo(0, 0) },
    retour: () => setPile((p) => p.slice(0, -1)),
  }), [])

  useEffect(() => {
    if (etat === 'deverrouille' && !pret) void initialiserDonnees().then(() => setPret(true))
  }, [etat, pret])

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

  const Ecran = ECRANS[onglet]
  return (
    <NavCtx.Provider value={nav}>
      {pile.length > 0 ? <div key={pile.length}>{pile[pile.length - 1]}</div> : <Ecran />}
      <BarreOnglets actif={onglet} surChoix={(o) => (o === onglet ? setPile([]) : setOnglet(o))}
        surAjout={() => { setNumeroSaisie((n) => n + 1); setSaisie(true) }} />
      <Feuille ouverte={saisie} surFermer={() => setSaisie(false)} titre="Nouvelle opération" titreVisible={false}>
        <SaisieRapide key={numeroSaisie} surFermer={() => setSaisie(false)} />
      </Feuille>
    </NavCtx.Provider>
  )
}
