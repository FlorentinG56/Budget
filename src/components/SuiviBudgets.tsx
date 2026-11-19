import { formaterMontant } from '../domain/argent'
import type { SuiviBudget } from '../domain/budgetsCategories'
import type { Devise } from '../domain/types'

/** Barres de suivi des budgets mensuels par catégorie (bleu, orange à 80 %, rouge au-delà de 100 %). */
export function SuiviBudgets({ suivi, devise }: { suivi: SuiviBudget[]; devise: Devise }) {
  return (
    <div className="divide-y divide-trait overflow-hidden rounded-carte bg-white shadow-carte">
      {suivi.map((s) => {
        const depasse = s.depense > s.budget
        const proche = !depasse && s.part >= 0.8
        const couleur = depasse ? '#B42318' : proche ? '#B45309' : '#2F6FED'
        return (
          <div key={s.categorie.id} className="px-4 py-2.5">
            <p className="flex items-baseline justify-between gap-2 text-[15px]">
              <span className="truncate text-encre">{s.categorie.icone} {s.categorie.nom}</span>
              <span className="shrink-0 font-semibold text-encre">{formaterMontant(s.depense, devise)} <span className="font-normal text-encre-pale">/ {formaterMontant(s.budget, devise)}</span></span>
            </p>
            <span className="mt-1.5 block h-2 overflow-hidden rounded-full bg-fond" role="progressbar" aria-valuenow={Math.round(s.part * 100)} aria-valuemin={0} aria-valuemax={100}
              aria-label={`${s.categorie.nom} : ${Math.round(s.part * 100)} % du budget`}>
              <span className="block h-full rounded-[4px]" style={{ width: `${Math.min(100, s.part * 100)}%`, background: couleur }} />
            </span>
            <p className="mt-1 text-[12px]" style={{ color: depasse || proche ? couleur : '#5B6475' }}>
              {depasse ? `Dépassé de ${formaterMontant(-s.reste, devise)}` : `${Math.round(s.part * 100)} % · reste ${formaterMontant(s.reste, devise)}`}
            </p>
          </div>
        )
      })}
    </div>
  )
}
