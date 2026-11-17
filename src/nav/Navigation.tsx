import { createContext, useContext, type ReactNode } from 'react'
import { IconeChevron } from '../components/Icones'

/** Pile de sous-écrans (style iOS) à l'intérieur d'un onglet. */
export interface Nav {
  ouvrir: (page: ReactNode) => void
  retour: () => void
  changerOnglet: (onglet: 'accueil' | 'calendrier' | 'analyses' | 'epargne' | 'reglages') => void
}

export const NavCtx = createContext<Nav | null>(null)

export function useNav(): Nav {
  const n = useContext(NavCtx)
  if (!n) throw new Error('useNav hors navigation')
  return n
}

export function Page({ titre, children, action, retourLibelle = 'Retour' }: { titre: string; children: ReactNode; action?: ReactNode; retourLibelle?: string }) {
  const { retour } = useNav()
  return (
    <main className="mx-auto w-full max-w-md px-4 pt-safe pb-tabbar">
      <div className="flex min-h-[48px] items-center justify-between pt-1">
        <button type="button" onClick={retour} className="-ml-2 flex min-h-[44px] items-center pr-3 text-[17px] text-bleu active:opacity-60">
          <IconeChevron taille={22} className="rotate-180" strokeWidth={2.4} />
          {retourLibelle}
        </button>
        {action}
      </div>
      <h1 className="pb-3 pt-1 text-[28px] font-bold leading-tight tracking-tight text-encre">{titre}</h1>
      <div className="flex flex-col gap-3">{children}</div>
    </main>
  )
}
