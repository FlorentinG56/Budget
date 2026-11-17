import { joursDansPeriode, periodeCourante } from '../domain/budget'
import { lendemain, echeancesEnAttente } from '../domain/recurrences'
import { ajouterJours, evenementsPrevus, projeterSoldes, type JourProjete } from '../domain/projection'
import { soldeCompte } from '../domain/soldes'
import type { DateISO } from '../domain/types'
import { etatBudget, type ContexteBudget } from './budget'

/**
 * Solde projeté jour par jour d'un ensemble de comptes (utilisé par le calendrier et les alertes).
 * Pour les comptes du budget journalier : budget du jour restant, budget des jours suivants et reste « à côté »
 * jusqu'à la fin de la période, puis le budget par période réparti sur les jours des périodes futures.
 */
export function calculerProjection(ctx: ContexteBudget, comptes: Set<string>, avecBudget: boolean, horizonJours: number): Map<DateISO, JourProjete> {
  const etat = etatBudget(ctx)
  const aujourdhui = ctx.date
  const fin = ajouterJours(aujourdhui, horizonJours)
  const comptesVue = ctx.comptes.filter((c) => comptes.has(c.id))
  const depenseJour = (d: DateISO): number => {
    if (!avecBudget || etat.etat !== 'actif') return 0
    const { jour, bornes, enveloppe } = etat
    const cote = Math.max(0, etat.resteACote ?? 0) // l'argent « à côté » est supposé dépensé d'ici la fin de la période
    const parJourCote = d <= bornes.fin ? Math.round(cote / jour.joursRestants) : 0
    if (d === aujourdhui) return Math.max(0, jour.resteAujourdhui) + parJourCote
    if (d <= bornes.fin) return Math.max(0, jour.budgetJoursSuivants ?? 0) + parJourCote
    // périodes futures : le budget par période supposé entièrement dépensé, réparti sur ses jours
    const future = ctx.paie ? periodeCourante(ctx.paie, d) : undefined
    return future ? Math.round(ctx.budgetParPeriode / joursDansPeriode(future)) : Math.round(enveloppe / jour.joursTotal)
  }
  return projeterSoldes({
    comptes, aujourdhui, jusquAu: fin,
    soldeFinAujourdhui: comptesVue.reduce((s, c) => s + soldeCompte(c, ctx.operations, aujourdhui), 0),
    enAttenteAujourdhui: echeancesEnAttente(ctx.recurrences, aujourdhui).filter((e) => comptes.has(e.recurrence.compteId)).reduce((s, e) => s + e.recurrence.montant, 0),
    evenements: evenementsPrevus(ctx.recurrences, lendemain(aujourdhui), fin, ctx.operations),
    operationsFutures: ctx.operations.filter((o) => o.date > aujourdhui),
    depenseJour,
  })
}
