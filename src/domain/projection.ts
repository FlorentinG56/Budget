import { addDays, parseISO } from 'date-fns'
import { versISO } from './dates'
import { echeancesAVenir, lendemain } from './recurrences'
import type { Centimes, DateISO, Operation, Recurrence } from './types'
import { effetSurCompte } from './soldes'

/**
 * Calendrier et solde projeté (cahier des charges, « Calendrier »).
 * Projection : solde actuel + revenus prévus − charges fixes prévues − budget journalier, jour par jour.
 */

export interface EvenementPrevu {
  date: DateISO
  libelle: string
  montant: Centimes
  sens: 'revenu' | 'charge'
  recurrenceId: string
  compteId: string // compte réellement touché (la carte pour une charge payée par carte)
}

/** Échéances à venir (non encore traitées) des récurrences actives, entre deux dates incluses. */
export function evenementsPrevus(recurrences: Recurrence[], du: DateISO, au: DateISO, operations: Operation[] = []): EvenementPrevu[] {
  const liste: EvenementPrevu[] = []
  for (const r of recurrences) {
    for (const date of echeancesAVenir(r, operations, du, au)) {
      liste.push({
        date, libelle: r.libelle, montant: r.montant, recurrenceId: r.id,
        sens: r.type === 'revenu' ? 'revenu' : 'charge',
        compteId: r.type !== 'revenu' && r.moyenPaiement === 'carte' && r.carteId ? r.carteId : r.compteId,
      })
    }
  }
  return liste.sort((a, b) => a.date.localeCompare(b.date))
}

export interface JourProjete {
  date: DateISO
  solde: Centimes // solde projeté en fin de journée
  revenus: Centimes
  charges: Centimes
  depenseEstimee: Centimes // part du budget journalier supposée dépensée ce jour-là
}

export interface ParamsProjection {
  comptes: Set<string> // comptes additionnés (ex. compte courant + carte)
  aujourdhui: DateISO
  jusquAu: DateISO
  soldeFinAujourdhui: Centimes // solde réel, opérations du jour comprises
  enAttenteAujourdhui: Centimes // revenus « à confirmer » arrivés mais pas encore confirmés (comptés aujourd'hui)
  evenements: EvenementPrevu[] // à partir de demain
  operationsFutures: Operation[] // opérations saisies avec une date future
  depenseJour: (date: DateISO) => Centimes // dépense du quotidien supposée (0 hors budget journalier)
}

export function projeterSoldes(p: ParamsProjection): Map<DateISO, JourProjete> {
  const resultat = new Map<DateISO, JourProjete>()
  const parDate = new Map<DateISO, EvenementPrevu[]>()
  for (const e of p.evenements) {
    if (!p.comptes.has(e.compteId) || e.date <= p.aujourdhui) continue
    parDate.set(e.date, [...(parDate.get(e.date) ?? []), e])
  }
  const futures = new Map<DateISO, Centimes>()
  for (const op of p.operationsFutures) {
    if (op.date <= p.aujourdhui) continue
    let effet = 0
    for (const c of p.comptes) effet += effetSurCompte(op, c)
    if (effet) futures.set(op.date, (futures.get(op.date) ?? 0) + effet)
  }

  const depAujourdhui = p.depenseJour(p.aujourdhui)
  let solde = p.soldeFinAujourdhui + p.enAttenteAujourdhui - depAujourdhui
  resultat.set(p.aujourdhui, { date: p.aujourdhui, solde, revenus: p.enAttenteAujourdhui, charges: 0, depenseEstimee: depAujourdhui })

  for (let d = lendemain(p.aujourdhui); d <= p.jusquAu; d = lendemain(d)) {
    const evs = parDate.get(d) ?? []
    const revenus = evs.filter((e) => e.sens === 'revenu').reduce((s, e) => s + e.montant, 0)
    const charges = evs.filter((e) => e.sens === 'charge').reduce((s, e) => s + e.montant, 0)
    const dep = p.depenseJour(d)
    solde += revenus - charges - dep + (futures.get(d) ?? 0)
    resultat.set(d, { date: d, solde, revenus, charges, depenseEstimee: dep })
  }
  return resultat
}

/** Premier jour où le solde projeté passe sous zéro. */
export function premierJourNegatif(projection: Map<DateISO, JourProjete>): DateISO | undefined {
  for (const j of projection.values()) if (j.solde < 0) return j.date
  return undefined
}

/** Grille d'un mois, semaines du lundi au dimanche (null = case vide). */
export function grilleMois(annee: number, mois0: number): (DateISO | null)[][] {
  const premier = new Date(annee, mois0, 1)
  const decalage = (premier.getDay() + 6) % 7 // lundi = 0
  const cases: (DateISO | null)[] = Array(decalage).fill(null)
  for (let d = premier; d.getMonth() === mois0; d = addDays(d, 1)) cases.push(versISO(d))
  while (cases.length % 7) cases.push(null)
  const semaines: (DateISO | null)[][] = []
  for (let i = 0; i < cases.length; i += 7) semaines.push(cases.slice(i, i + 7))
  return semaines
}

/** Montant compact pour une case de calendrier : 1 234 → « 1,2k », 845 → « 845 ». */
export function montantCompact(centimes: Centimes): string {
  const v = Math.round(centimes / 100)
  const abs = Math.abs(v)
  const signe = v < 0 ? '−' : ''
  if (abs >= 10000) return `${signe}${Math.round(abs / 1000)}k`
  if (abs >= 1000) return `${signe}${(abs / 1000).toFixed(1).replace('.', ',').replace(',0', '')}k`
  return `${signe}${abs}`
}

export const ajouterJours = (d: DateISO, n: number) => versISO(addDays(parseISO(d), n))
