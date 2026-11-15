import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from 'react'

export function Groupe({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`divide-y divide-trait overflow-hidden rounded-carte bg-white shadow-carte ${className}`}>{children}</div>
}

export function Champ({ libelle, children, aide }: { libelle: string; children: ReactNode; aide?: ReactNode }) {
  return (
    <label className="flex min-h-[50px] items-center justify-between gap-3 px-4 py-2">
      <span className="shrink-0 text-[17px] text-encre">{libelle}</span>
      <span className="flex min-w-0 flex-1 flex-col items-end">
        {children}
        {aide && <span className="text-[12px] text-encre-pale">{aide}</span>}
      </span>
    </label>
  )
}

export function Saisie(p: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...p} className={`w-full min-w-0 bg-transparent text-right text-[17px] text-encre outline-none placeholder:text-encre-pale ${p.className ?? ''}`} />
}

export function Choix({ children, ...p }: SelectHTMLAttributes<HTMLSelectElement> & { children: ReactNode }) {
  return (
    <select {...p} className={`w-full min-w-0 appearance-none bg-transparent text-right text-[17px] text-encre-douce outline-none ${p.className ?? ''}`} dir="rtl">
      {children}
    </select>
  )
}

export function Interrupteur({ actif, surChange, libelle }: { actif: boolean; surChange: (v: boolean) => void; libelle: string }) {
  return (
    <button type="button" role="switch" aria-checked={actif} aria-label={libelle} onClick={() => surChange(!actif)}
      className={`relative h-[31px] w-[51px] shrink-0 rounded-full transition-colors ${actif ? 'bg-vert' : 'bg-trait'}`}>
      <span className={`absolute top-[2px] h-[27px] w-[27px] rounded-full bg-white shadow transition-transform ${actif ? 'translate-x-[22px]' : 'translate-x-[2px]'}`} />
    </button>
  )
}

export function Bouton({ children, variante = 'principal', className = '', ...p }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variante?: 'principal' | 'secondaire' | 'danger' }) {
  const styles = {
    principal: 'bg-bleu text-white active:bg-bleu-fonce disabled:opacity-40',
    secondaire: 'bg-white text-bleu shadow-carte active:bg-bleu-pale',
    danger: 'bg-white text-rouge shadow-carte active:bg-rouge-pale',
  }[variante]
  return <button type="button" {...p} className={`min-h-[50px] w-full rounded-[14px] px-4 text-[17px] font-semibold transition ${styles} ${className}`}>{children}</button>
}

export const PALETTE = ['#00874E', '#2E9C6A', '#008C8C', '#2F6FED', '#6366F1', '#7A5AF8', '#EC4899', '#EF4444', '#F97316', '#F59E0B', '#10B981', '#06B6D4', '#3D4A5C', '#94A3B8']

export function ChoixCouleur({ valeur, surChange }: { valeur: string; surChange: (c: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2.5 px-4 py-3">
      {PALETTE.map((c) => (
        <button key={c} type="button" onClick={() => surChange(c)} aria-label={`Couleur ${c}`}
          className={`h-9 w-9 rounded-full transition ${valeur === c ? 'ring-2 ring-encre ring-offset-2' : ''}`} style={{ background: c }} />
      ))}
    </div>
  )
}
