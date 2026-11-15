import type { DateISO, Operation } from './types'

export interface FiltreOperations {
  compteId?: string // inclut les opérations où le compte est destinataire
  categorieId?: string // catégorie principale
  du?: DateISO
  au?: DateISO
}

export function filtrerOperations(operations: Operation[], f: FiltreOperations): Operation[] {
  return operations.filter((op) =>
    (!f.compteId || op.compteId === f.compteId || op.compteDestinationId === f.compteId) &&
    (!f.categorieId || op.categorieId === f.categorieId) &&
    (!f.du || op.date >= f.du) &&
    (!f.au || op.date <= f.au),
  )
}

/** Plus récentes d'abord : par date, puis par heure de saisie. */
export function trierRecentes(operations: Operation[]): Operation[] {
  return [...operations].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.creeLe - a.creeLe))
}

export function grouperParJour(operations: Operation[]): { date: DateISO; operations: Operation[] }[] {
  const groupes: { date: DateISO; operations: Operation[] }[] = []
  for (const op of trierRecentes(operations)) {
    const dernier = groupes[groupes.length - 1]
    if (dernier?.date === op.date) dernier.operations.push(op)
    else groupes.push({ date: op.date, operations: [op] })
  }
  return groupes
}
