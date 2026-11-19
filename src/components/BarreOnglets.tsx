import { useEffect, useState, type ComponentType } from 'react'
import { IconeAccueil, IconeAnalyses, IconeCalendrier, IconeEpargne, IconePlus, IconeReglages } from './Icones'

export type Onglet = 'accueil' | 'calendrier' | 'analyses' | 'epargne' | 'reglages'

const ONGLETS: { id: Onglet; libelle: string; Icone: ComponentType<{ taille?: number }> }[] = [
  { id: 'accueil', libelle: 'Accueil', Icone: IconeAccueil },
  { id: 'calendrier', libelle: 'Calendrier', Icone: IconeCalendrier },
  { id: 'analyses', libelle: 'Analyses', Icone: IconeAnalyses },
  { id: 'epargne', libelle: 'Épargne', Icone: IconeEpargne },
  { id: 'reglages', libelle: 'Réglages', Icone: IconeReglages },
]

/**
 * La barre se cache quand on défile vers le bas (elle ne masque plus le contenu) et revient dès qu'on
 * remonte un peu, en haut de page et en bas de page (comme Safari).
 */
export function useBarreVisible(): boolean {
  const [visible, setVisible] = useState(true)
  useEffect(() => {
    let dernier = window.scrollY
    let attente = false
    const maj = () => {
      attente = false
      const y = Math.max(0, window.scrollY)
      const bas = window.innerHeight + y >= document.documentElement.scrollHeight - 24
      if (y < 40 || bas) setVisible(true)
      else if (y > dernier + 6) setVisible(false) // vers le bas
      else if (y < dernier - 2) setVisible(true) // vers le haut
      if (Math.abs(y - dernier) > 2 || y < 40) dernier = y
    }
    const surDefilement = () => { if (!attente) { attente = true; requestAnimationFrame(maj) } }
    window.addEventListener('scroll', surDefilement, { passive: true })
    window.addEventListener('resize', surDefilement)
    return () => { window.removeEventListener('scroll', surDefilement); window.removeEventListener('resize', surDefilement) }
  }, [])
  return visible
}

export function BarreOnglets({ actif, surChoix, surAjout }: { actif: Onglet; surChoix: (o: Onglet) => void; surAjout: () => void }) {
  const bouton = (o: (typeof ONGLETS)[number]) => {
    const estActif = o.id === actif
    return (
      <button key={o.id} type="button" onClick={() => surChoix(o.id)} aria-current={estActif ? 'page' : undefined}
        className={`flex min-h-[50px] flex-1 flex-col items-center justify-center gap-0.5 pt-1.5 text-[10.5px] font-medium transition-colors ${
          estActif ? 'text-bleu' : 'text-encre-pale active:text-encre-douce'}`}>
        <o.Icone taille={25} />
        <span>{o.libelle}</span>
      </button>
    )
  }
  const visible = useBarreVisible()
  return (
    <nav className={`fixed inset-x-0 bottom-0 z-30 border-t border-trait bg-white/90 pb-safe backdrop-blur-xl transition-transform duration-300 ease-out motion-reduce:transition-none ${
      visible ? 'translate-y-0' : 'translate-y-[calc(100%+32px)]'}`} aria-label="Navigation principale" data-visible={visible}>
      <div className="mx-auto flex max-w-md items-stretch px-1">
        {ONGLETS.slice(0, 2).map(bouton)}
        <div className="flex w-[68px] shrink-0 items-start justify-center">
          <button type="button" onClick={surAjout} aria-label="Ajouter une dépense"
            className="-mt-5 flex h-[58px] w-[58px] items-center justify-center rounded-full bg-bleu text-white shadow-[0_6px_16px_rgba(47,111,237,.45)] transition active:scale-95 active:bg-bleu-fonce">
            <IconePlus taille={28} />
          </button>
        </div>
        {ONGLETS.slice(2).map(bouton)}
      </div>
    </nav>
  )
}
