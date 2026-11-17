import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import {
  bilanPeriode, calculerBudgetJour, comptesBudget, depensesBudget, enveloppeEffective, periodeCourante,
  previsionsPeriode, prochaineDatePaie, recurrencePaie, resteACote, type Bilan, type Bornes, type BudgetJour, type Previsions,
} from '../domain/budget'
import { aujourdhui } from '../domain/dates'
import type { Compte, Operation, Periode, Recurrence } from '../domain/types'
import { useComptes, useOperations, useRecurrences, useReglages } from './donnees'

export type EtatBudget =
  | { etat: 'chargement' }
  | { etat: 'sans_paie' }
  | { etat: 'avant'; prochaine?: string }
  | { etat: 'bilan'; periode: Periode; bilan: Bilan; bornes: Bornes }
  | { etat: 'a_valider'; bornes: Bornes; previsions: Previsions; proposition: number; premiere: boolean; depenseJusquIci: number }
  | { etat: 'actif'; periode: Periode; bornes: Bornes; enveloppe: number; jour: BudgetJour; resteACote?: number }

export interface ContexteBudget {
  comptes: Compte[]
  operations: Operation[]
  recurrences: Recurrence[]
  periodes: Periode[]
  budget: Set<string>
  paie?: Recurrence
  date: string
  budgetParPeriode: number // enveloppe fixe proposée à chaque paie
}

/** Calcule l'état du budget journalier à partir des données (logique dans domain/budget.ts). */
export function etatBudget(c: ContexteBudget): EtatBudget {
  if (!c.paie) return { etat: 'sans_paie' }
  const bornes = periodeCourante(c.paie, c.date)
  if (!bornes) return { etat: 'avant', prochaine: prochaineDatePaie(c.paie, c.date) }

  // une période passée pas encore clôturée → bilan d'abord (la plus ancienne)
  const aCloturer = c.periodes.filter((p) => !p.cloturee && p.dateFin < bornes.debut).sort((a, b) => a.dateDebut.localeCompare(b.dateDebut))[0]
  if (aCloturer) return { etat: 'bilan', periode: aCloturer, bilan: bilanPeriode(aCloturer, c.operations, c.budget), bornes }

  const enCours = c.periodes.find((p) => p.dateDebut === bornes.debut)
  if (!enCours) {
    return {
      etat: 'a_valider', bornes,
      previsions: previsionsPeriode(c.recurrences, c.operations, c.budget, bornes),
      proposition: c.budgetParPeriode,
      premiere: c.periodes.length === 0,
      depenseJusquIci: depensesBudget(c.operations, c.budget, bornes.debut, c.date),
    }
  }
  const enveloppe = enveloppeEffective(enCours, c.operations)
  const aCote = enCours.aCote || c.operations.some((o) => o.horsBudget && o.date >= bornes.debut && o.date <= bornes.fin)
  return {
    etat: 'actif', periode: enCours, bornes, enveloppe, jour: calculerBudgetJour(enveloppe, c.operations, c.budget, bornes, c.date),
    resteACote: aCote ? resteACote(enCours, c.operations, c.budget) : undefined,
  }
}

export function useContexteBudget(): ContexteBudget | undefined {
  const comptes = useComptes()
  const operations = useOperations()
  const recurrences = useRecurrences()
  const reglages = useReglages()
  const periodes = useLiveQuery(() => db.periodes.toArray(), [])
  if (!comptes || !operations || !recurrences || !reglages || !periodes) return undefined
  const budget = comptesBudget(comptes)
  return {
    comptes, operations, recurrences, periodes, budget, paie: recurrencePaie(recurrences, budget, reglages.recurrencePaieId), date: aujourdhui(),
    budgetParPeriode: reglages.budgetParPeriode,
  }
}

export function useBudget(): { ctx?: ContexteBudget; etat: EtatBudget } {
  const ctx = useContexteBudget()
  return { ctx, etat: ctx ? etatBudget(ctx) : { etat: 'chargement' } }
}
