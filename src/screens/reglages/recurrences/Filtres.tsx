import { LIBELLES_TRI, type Tri } from '../../../domain/charges'
import type { Genre } from './types'

/** Pastille de filtre ou de tri (menu natif iOS). */
export function Filtre({ libelle, valeur, surChange, options, actif }: {
  libelle: string; valeur: string; surChange: (v: string) => void; options: { valeur: string; libelle: string }[]; actif: boolean
}) {
  return (
    <label className={`relative flex min-h-[36px] shrink-0 items-center rounded-full px-3.5 text-[14px] font-medium shadow-carte ${actif ? 'bg-bleu text-white' : 'bg-white text-encre'}`}>
      <select value={valeur} onChange={(e) => surChange(e.target.value)} className="absolute inset-0 opacity-0" aria-label={libelle}>
        {options.map((o) => <option key={o.valeur} value={o.valeur}>{o.libelle}</option>)}
      </select>
      <span className="pointer-events-none max-w-[190px] truncate">{options.find((o) => o.valeur === valeur)?.libelle}</span>
      <span className="pointer-events-none ml-1 text-[10px] opacity-70" aria-hidden="true">▼</span>
    </label>
  )
}

export function lireTri(genre: Genre): Tri {
  try { const t = localStorage.getItem(`tri-${genre}`); if (t && t in LIBELLES_TRI) return t as Tri } catch { /* défaut */ }
  return 'jour'
}
