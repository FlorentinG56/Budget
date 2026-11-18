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
