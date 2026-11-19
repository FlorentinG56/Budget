import { calculerBudgetJour, depensesParCategorie, joursDansPeriode, type BudgetJour, type LigneCategorie } from './budget'
import type { Centimes, Compte, DateISO, Operation, Voyage } from './types'

/**
 * Mode voyage (tâche E5) : un budget total sur un compte et des dates. Les dépenses de ce compte pendant
 * le voyage y sont rattachées. Même logique que le budget du jour : reste ÷ jours restants.
 * Le budget journalier principal n'est pas modifié.
 */

export type StatutVoyage = 'a_venir' | 'en_cours' | 'termine'

export function statutVoyage(v: Voyage, aujourdhui: DateISO): StatutVoyage {
  return aujourdhui < v.debut ? 'a_venir' : aujourdhui > v.fin ? 'termine' : 'en_cours'
}

export function depensesVoyage(v: Voyage, operations: Operation[]): Operation[] {
  return operations.filter((o) => o.type === 'depense' && o.compteId === v.compteId && o.date >= v.debut && o.date <= v.fin)
}

/** Pendant le voyage : budget par jour, reste du jour, reste du voyage. */
export function jourDeVoyage(v: Voyage, operations: Operation[], aujourdhui: DateISO): BudgetJour {
  return calculerBudgetJour(v.budget, depensesVoyage(v, operations), new Set([v.compteId]), { debut: v.debut, fin: v.fin }, aujourdhui)
}

export interface BilanVoyage {
  budget: Centimes
  depense: Centimes
  ecart: Centimes // > 0 : sous le budget
  jours: number
  parJour: Centimes // dépense moyenne par jour
  categories: LigneCategorie[]
}

export function bilanVoyage(v: Voyage, operations: Operation[]): BilanVoyage {
  const ops = depensesVoyage(v, operations)
  const depense = ops.reduce((s, o) => s + o.montant, 0)
  const jours = joursDansPeriode({ debut: v.debut, fin: v.fin })
  return { budget: v.budget, depense, ecart: v.budget - depense, jours, parJour: Math.round(depense / jours),
    categories: depensesParCategorie(ops, new Set([v.compteId]), v.debut, v.fin) }
}

/** Voyage à mettre en avant sur l'accueil : en cours, sinon terminé depuis 3 jours au plus (pour son bilan). */
export function voyageAccueil(voyages: Voyage[], aujourdhui: DateISO): Voyage | undefined {
  const enCours = voyages.filter((v) => statutVoyage(v, aujourdhui) === 'en_cours').sort((a, b) => a.debut.localeCompare(b.debut))[0]
  if (enCours) return enCours
  const limite = veilleDe(veilleDe(veilleDe(aujourdhui)))
  return voyages.filter((v) => v.fin < aujourdhui && v.fin >= limite).sort((a, b) => b.fin.localeCompare(a.fin))[0]
}
const veilleDe = (d: DateISO) => { const x = new Date(`${d}T12:00:00`); x.setDate(x.getDate() - 1); return x.toISOString().slice(0, 10) }

/** Compte proposé pour un nouveau voyage : celui du dernier voyage, sinon le premier compte hors budget du jour. */
export function compteParDefaut(voyages: Voyage[], comptes: Compte[]): string | undefined {
  const dernier = [...voyages].sort((a, b) => b.debut.localeCompare(a.debut))[0]
  if (dernier && comptes.some((c) => c.id === dernier.compteId && !c.archive)) return dernier.compteId
  const possibles = comptes.filter((c) => !c.archive && c.type !== 'carte_credit')
  return (possibles.find((c) => !c.inclusBudgetJournalier) ?? possibles[0])?.id
}

