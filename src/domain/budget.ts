import { differenceInCalendarDays, parseISO } from 'date-fns'
import { echeancesEntre, lendemain, veille } from './recurrences'
import type { Centimes, Compte, DateISO, Operation, Periode, Recurrence } from './types'
import { addDays } from 'date-fns'
import { versISO } from './dates'

/**
 * Budget journalier (cahier des charges, « Budget journalier et reste à vivre »).
 * Toutes les fonctions sont pures et testées dans budget.test.ts.
 */

export interface Bornes {
  debut: DateISO
  fin: DateISO // incluse : veille de la paie suivante
}

/** Comptes qui comptent dans le budget du jour : compte courant et sa carte. */
export function comptesBudget(comptes: Compte[]): Set<string> {
  return new Set(comptes.filter((c) => c.inclusBudgetJournalier && !c.archive).map((c) => c.id))
}

/**
 * Revenu récurrent qui ouvre les périodes : celui choisi dans les réglages, sinon le premier revenu
 * actif d'un compte du budget dont le libellé évoque une paie, sinon le premier revenu actif d'un compte du budget.
 */
export function recurrencePaie(recurrences: Recurrence[], budget: Set<string>, choisie?: string): Recurrence | undefined {
  const revenus = recurrences.filter((r) => r.type === 'revenu' && r.actif && budget.has(r.compteId))
  return revenus.find((r) => r.id === choisie) ?? revenus.find((r) => /salaire|paie|paye/i.test(r.libelle)) ?? revenus[0]
}

/** Période en cours : de la dernière paie prévue (≤ date) à la veille de la suivante. */
export function periodeCourante(paie: Recurrence, date: DateISO): Bornes | undefined {
  const d = parseISO(date)
  const autour = echeancesEntre(paie, versISO(addDays(d, -62)), versISO(addDays(d, 62)))
  const debut = [...autour].reverse().find((e) => e <= date)
  const suivante = autour.find((e) => e > date)
  if (!debut || !suivante) return undefined
  return { debut, fin: veille(suivante) }
}

/** Prochaine période qui commencera (si aucune n'est en cours, ex. avant la première paie). */
export function prochaineDatePaie(paie: Recurrence, date: DateISO): DateISO | undefined {
  return echeancesEntre(paie, lendemain(date), versISO(addDays(parseISO(date), 62)))[0]
}

export function joursDansPeriode(b: Bornes): number {
  return differenceInCalendarDays(parseISO(b.fin), parseISO(b.debut)) + 1
}

/** Jours restants, aujourd'hui compris (au moins 1). */
export function joursRestants(b: Bornes, date: DateISO): number {
  return Math.max(1, differenceInCalendarDays(parseISO(b.fin), parseISO(date)) + 1)
}

export interface Previsions {
  revenus: Centimes
  charges: Centimes
  detailRevenus: { libelle: string; montant: Centimes; date: DateISO; estime: boolean }[]
  detailCharges: { libelle: string; montant: Centimes; date: DateISO; estime: boolean }[]
}

/**
 * Revenus et charges fixes du budget dont l'échéance tombe dans la période :
 * - échéance déjà traitée : montant réel de l'opération (0 si annulée ou ignorée)
 * - échéance à venir : montant prévu de la récurrence
 * Une charge payée par carte est comptée (elle est retirée de l'enveloppe, cf. décisions).
 */
export function previsionsPeriode(recurrences: Recurrence[], operations: Operation[], budget: Set<string>, b: Bornes): Previsions {
  const p: Previsions = { revenus: 0, charges: 0, detailRevenus: [], detailCharges: [] }
  const ajouter = (estRevenu: boolean, libelle: string, montant: Centimes, date: DateISO, estime: boolean) => {
    if (estRevenu) { p.revenus += montant; p.detailRevenus.push({ libelle, montant, date, estime }) }
    else { p.charges += montant; p.detailCharges.push({ libelle, montant, date, estime }) }
  }
  // réalisé
  for (const op of operations) {
    if (!op.recurrenceId || (op.type !== 'revenu' && op.type !== 'prelevement_fixe')) continue
    if (!budget.has(op.compteId)) continue
    const e = op.echeance ?? op.date
    if (e < b.debut || e > b.fin) continue
    ajouter(op.type === 'revenu', op.note ?? '', op.montant, e, false)
  }
  // à venir
  for (const r of recurrences) {
    if (!r.actif || !budget.has(r.compteId)) continue
    const depuis = r.derniereEcheanceGeneree && lendemain(r.derniereEcheanceGeneree) > b.debut ? lendemain(r.derniereEcheanceGeneree) : b.debut
    for (const e of echeancesEntre(r, depuis, b.fin)) ajouter(r.type === 'revenu', r.libelle, r.montant, e, true)
  }
  const tri = (a: { date: string }, z: { date: string }) => a.date.localeCompare(z.date)
  p.detailRevenus.sort(tri); p.detailCharges.sort(tri)
  return p
}

/** Enveloppe = revenus − charges fixes − épargne mise de côté + report de la période précédente. */
export function enveloppeProposee(prev: Pick<Previsions, 'revenus' | 'charges'>, epargne: Centimes, report: Centimes): Centimes {
  return prev.revenus - prev.charges - epargne + report
}

/**
 * Dépenses qui comptent dans le budget : les dépenses saisies sur les comptes du budget (chèque et carte).
 * Ne comptent pas : charges fixes, remboursements de carte, virements, ajustements, revenus.
 */
export function depensesBudget(operations: Operation[], budget: Set<string>, du: DateISO, au: DateISO): Centimes {
  let total = 0
  for (const op of operations) {
    if (op.type === 'depense' && budget.has(op.compteId) && op.date >= du && op.date <= au) total += op.montant
  }
  return total
}

/** Enveloppe en vigueur : enveloppe validée + revenus ponctuels ajoutés (si l'opération existe encore). */
export function enveloppeEffective(periode: Periode, operations: Operation[]): Centimes {
  const ids = new Set(operations.map((o) => o.id))
  return (periode.enveloppeValidee ?? 0) + periode.ajouts.filter((a) => ids.has(a.operationId)).reduce((s, a) => s + a.montant, 0)
}

export interface BudgetJour {
  budgetJour: Centimes // ce qu'on peut dépenser aujourd'hui
  depenseAujourdhui: Centimes
  resteAujourdhui: Centimes // en rouge si négatif
  depensePeriode: Centimes
  restePeriode: Centimes // enveloppe − toutes les dépenses de la période
  joursRestants: number
  /** Projection : budget par jour des jours suivants si l'on ne dépense plus rien aujourd'hui (absent le dernier jour). */
  budgetJoursSuivants?: Centimes
  jourNumero: number
  joursTotal: number
}

/**
 * Budget du jour = (enveloppe − dépenses depuis le début de la période, hors aujourd'hui) ÷ jours restants (aujourd'hui compris).
 * Exemple du cahier des charges : 600 $ sur 15 jours, 150 $ dépensés avant le jour 6 → 450 $ ÷ 10 = 45 $.
 */
export function calculerBudgetJour(enveloppe: Centimes, operations: Operation[], budget: Set<string>, b: Bornes, date: DateISO): BudgetJour {
  const avant = date > b.debut ? depensesBudget(operations, budget, b.debut, veille(date)) : 0
  const aujourdhui = depensesBudget(operations, budget, date, date)
  const n = joursRestants(b, date)
  const budgetJour = Math.round((enveloppe - avant) / n)
  const depensePeriode = depensesBudget(operations, budget, b.debut, b.fin)
  return {
    budgetJour,
    depenseAujourdhui: aujourdhui,
    resteAujourdhui: budgetJour - aujourdhui,
    depensePeriode,
    restePeriode: enveloppe - depensePeriode,
    joursRestants: n,
    budgetJoursSuivants: n > 1 ? Math.round((enveloppe - avant - aujourdhui) / (n - 1)) : undefined,
    jourNumero: joursDansPeriode({ debut: b.debut, fin: date }),
    joursTotal: joursDansPeriode(b),
  }
}

export interface Bilan {
  enveloppe: Centimes
  depense: Centimes
  ecart: Centimes // > 0 : il reste de l'argent ; < 0 : dépassement
}

export function bilanPeriode(periode: Periode, operations: Operation[], budget: Set<string>): Bilan {
  const enveloppe = enveloppeEffective(periode, operations)
  const depense = depensesBudget(operations, budget, periode.dateDebut, periode.dateFin)
  return { enveloppe, depense, ecart: enveloppe - depense }
}

/** Report à appliquer à la période suivante selon le choix fait au bilan. */
export function reportPourSuivante(p: Pick<Periode, 'affectationFin' | 'montantAffecte'>): Centimes {
  if (p.affectationFin === 'report') return Math.max(0, p.montantAffecte ?? 0)
  if (p.affectationFin === 'deficit_reporte') return -Math.abs(p.montantAffecte ?? 0)
  return 0
}

/** Budget journalier d'un jour passé (pour le calendrier) : même formule, en se plaçant ce jour-là. */
export function budgetDuJourA(enveloppe: Centimes, operations: Operation[], budget: Set<string>, b: Bornes, date: DateISO): Centimes {
  return calculerBudgetJour(enveloppe, operations, budget, b, date).budgetJour
}
