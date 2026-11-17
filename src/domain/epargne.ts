import { differenceInCalendarMonths, parseISO } from 'date-fns'
import type { Centimes, Compte, DateISO, Devise, ObjectifEpargne, Operation } from './types'

/**
 * Épargne virtuelle (cahier des charges, « Épargne virtuelle ») : des enveloppes qui réservent une partie
 * du solde d'un compte. L'argent ne quitte jamais le compte. Fonctions pures, testées dans epargne.test.ts.
 */

/** Solde d'un objectif : mises de côté − reprises − dépenses payées avec cette épargne. */
export function soldeObjectif(o: ObjectifEpargne, operations: Operation[]): Centimes {
  const mouvements = o.mouvements.reduce((s, m) => s + (m.sens === 'mise_de_cote' ? m.montant : -m.montant), 0)
  const depenses = operations.filter((op) => op.objectifEpargneId === o.id).reduce((s, op) => s + op.montant, 0)
  return mouvements - depenses
}

export function progressionObjectif(solde: Centimes, cible?: Centimes): number | undefined {
  if (!cible) return undefined
  return Math.min(1, Math.max(0, solde / cible))
}

/** Épargne réservée sur un compte (objectifs non archivés). */
export function epargneReservee(objectifs: ObjectifEpargne[], operations: Operation[], compteId: string): Centimes {
  return objectifs.filter((o) => o.compteId === compteId && !o.archive).reduce((s, o) => s + soldeObjectif(o, operations), 0)
}

/** Total de l'épargne par devise (pas de conversion : 3 200 $ + 5 000 €). */
export function totalParDevise(objectifs: ObjectifEpargne[], operations: Operation[], comptes: Compte[]): Map<Devise, Centimes> {
  const devises = new Map(comptes.map((c) => [c.id, c.devise]))
  const total = new Map<Devise, Centimes>()
  for (const o of objectifs) {
    if (o.archive) continue
    const d = devises.get(o.compteId)
    if (d) total.set(d, (total.get(d) ?? 0) + soldeObjectif(o, operations))
  }
  return total
}

/** Montant à mettre de côté par mois pour atteindre la cible à la date cible (undefined si sans objet). */
export function parMoisPourAtteindre(solde: Centimes, cible: Centimes | undefined, dateCible: DateISO | undefined, aujourdhui: DateISO): Centimes | undefined {
  if (!cible || !dateCible || solde >= cible) return undefined
  const mois = Math.max(1, differenceInCalendarMonths(parseISO(dateCible), parseISO(aujourdhui)))
  return Math.ceil((cible - solde) / mois)
}

export interface LigneHistorique {
  date: DateISO
  montant: Centimes // signé : + mise de côté, − reprise ou dépense
  libelle: string
  operationId?: string
  mouvementId?: string
}

/** Historique d'un objectif (mouvements et dépenses payées avec l'épargne), le plus récent d'abord. */
export function historiqueObjectif(o: ObjectifEpargne, operations: Operation[]): LigneHistorique[] {
  const lignes: LigneHistorique[] = [
    ...o.mouvements.map((m) => ({
      date: m.date, mouvementId: m.id,
      montant: m.sens === 'mise_de_cote' ? m.montant : -m.montant,
      libelle: m.note || (m.source?.startsWith('paie:') ? 'Mis de côté à la paie' : m.source?.startsWith('bilan:') ? 'Reste de la période' : m.sens === 'mise_de_cote' ? 'Mis de côté' : 'Repris'),
    })),
    ...operations.filter((op) => op.objectifEpargneId === o.id).map((op) => ({
      date: op.date, operationId: op.id, montant: -op.montant, libelle: op.note || 'Dépense payée avec l’épargne',
    })),
  ]
  return lignes.sort((a, b) => b.date.localeCompare(a.date))
}
