import type { ReactNode } from 'react'

export function Ecran({ titre, children, action }: { titre: string; children: ReactNode; action?: ReactNode }) {
  return (
    <main className="mx-auto w-full max-w-md px-4 pt-safe pb-tabbar">
      <header className="flex items-end justify-between pt-4 pb-3">
        <h1 className="text-[30px] font-bold leading-tight tracking-tight text-encre">{titre}</h1>
        {action}
      </header>
      <div className="flex flex-col gap-3">{children}</div>
    </main>
  )
}

export function Carte({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-carte bg-white p-4 shadow-carte ${className}`}>{children}</section>
}

export function TitreSection({ children }: { children: ReactNode }) {
  return <h2 className="px-1 pt-3 text-[13px] font-semibold uppercase tracking-wide text-encre-pale">{children}</h2>
}

/** Bloc annonçant une fonction pas encore construite : pas de faux chiffres. */
export function AVenir({ titre, etape, children }: { titre: string; etape: number; children?: ReactNode }) {
  return (
    <Carte>
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-[17px] font-semibold text-encre">{titre}</h3>
        <span className="shrink-0 rounded-full bg-bleu-pale px-2.5 py-1 text-[12px] font-semibold text-bleu">Étape {etape}</span>
      </div>
      {children && <p className="mt-1.5 text-[15px] leading-snug text-encre-douce">{children}</p>}
    </Carte>
  )
}
