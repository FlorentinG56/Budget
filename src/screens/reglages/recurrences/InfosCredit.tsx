import { formaterMontant } from '../../../domain/argent'
import { aujourdhui } from '../../../domain/dates'
import { capitalRestant, mensualitesRestantes, progressionCredit } from '../../../domain/recurrences'
import type { Devise, Operation, Recurrence } from '../../../domain/types'

/** Capital restant, mensualités restantes et barre de progression d'un crédit. */
function BarreProgression({ valeur }: { valeur: number }) {
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-trait" role="progressbar" aria-valuenow={Math.round(valeur * 100)} aria-valuemin={0} aria-valuemax={100}>
      <div className="h-full rounded-full bg-vert" style={{ width: `${valeur * 100}%` }} />
    </div>
  )
}

export function InfosCredit({ rec, operations, devise }: { rec: Recurrence; operations: Operation[]; devise: Devise }) {
  const restant = capitalRestant(rec, operations)
  const nb = mensualitesRestantes(rec, restant, aujourdhui())
  const prog = progressionCredit(rec.capitalInitial, restant)
  return (
    <div className="mt-2 space-y-1.5">
      {prog !== undefined && <BarreProgression valeur={prog} />}
      <p className="flex justify-between text-[13px] text-encre-douce">
        <span>{restant !== undefined ? `Reste ${formaterMontant(restant, devise)}` : 'Capital non renseigné'}</span>
        <span>{nb !== undefined ? `${nb} mensualité${nb > 1 ? 's' : ''} restante${nb > 1 ? 's' : ''}` : ''}</span>
      </p>
    </div>
  )
}
