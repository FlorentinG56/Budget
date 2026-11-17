import { analyserMontant } from '../domain/argent'
import type { Devise } from '../domain/types'

export const versTexteMontant = (c: number) => (c < 0 ? '-' : '') + (Math.abs(c) / 100).toFixed(2).replace('.', ',')

/** Lit « 12,50 » ou « -12,50 » ; null si invalide. */
export function lireMontant(t: string, signe = false): number | null {
  const s = t.trim()
  const negatif = signe && /^[-−]/.test(s)
  const v = analyserMontant(s.replace(/^[-−]/, ''))
  return v === null ? null : negatif ? -v : v
}

export function ChampMontant({ valeur, surChange, devise, libelle, grand }: { valeur: string; surChange: (v: string) => void; devise: Devise; libelle: string; grand?: boolean }) {
  return (
    <label className={`flex items-center rounded-[12px] bg-white px-3 shadow-carte ${grand ? 'min-h-[56px]' : 'min-h-[46px]'}`}>
      <input inputMode="decimal" value={valeur} onChange={(e) => surChange(e.target.value)} onFocus={(e) => e.target.select()} aria-label={libelle}
        className={`w-full min-w-0 bg-transparent font-semibold text-encre outline-none ${grand ? 'text-[24px]' : 'text-[18px]'}`} />
      <span className="text-[17px] text-encre-douce">{devise === 'EUR' ? '€' : '$'}</span>
    </label>
  )
}
