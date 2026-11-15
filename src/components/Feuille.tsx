import { useEffect, type ReactNode } from 'react'
import { IconeFermer } from './Icones'

/** Panneau qui monte du bas de l'écran (style iOS). */
export function Feuille({ ouverte, surFermer, titre, children }: { ouverte: boolean; surFermer: () => void; titre: string; children: ReactNode }) {
  useEffect(() => {
    if (!ouverte) return
    const k = (e: KeyboardEvent) => e.key === 'Escape' && surFermer()
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [ouverte, surFermer])

  return (
    <div className={`fixed inset-0 z-40 ${ouverte ? '' : 'pointer-events-none'}`} aria-hidden={!ouverte}
      // fermé : invisible (ni affiché, ni focalisable) une fois l'animation de fermeture terminée
      style={{ visibility: ouverte ? 'visible' : 'hidden', transition: ouverte ? 'none' : 'visibility 0s 300ms' }}>
      <div onClick={surFermer} className={`absolute inset-0 bg-black/30 transition-opacity duration-300 ${ouverte ? 'opacity-100' : 'opacity-0'}`} />
      <div role="dialog" aria-modal="true" aria-label={titre}
        className={`absolute inset-x-0 bottom-0 mx-auto max-w-md rounded-t-[24px] bg-fond pb-safe shadow-2xl transition-transform duration-300 ease-out ${
          ouverte ? 'translate-y-0' : 'translate-y-full'}`}>
        <div className="flex items-center justify-between px-4 pt-3 pb-2">
          <span className="w-11" />
          <div className="h-1.5 w-10 rounded-full bg-encre-pale/40" />
          <button type="button" onClick={surFermer} aria-label="Fermer" className="flex h-11 w-11 items-center justify-center rounded-full text-encre-douce active:bg-black/5">
            <IconeFermer taille={22} />
          </button>
        </div>
        <div className="px-4 pb-6">
          <h2 className="mb-3 text-[22px] font-bold text-encre">{titre}</h2>
          {children}
        </div>
      </div>
    </div>
  )
}
