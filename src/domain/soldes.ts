import type { Centimes, Compte, DateISO, Operation } from './types'

/**
 * Effet d'une opération sur le solde d'un compte (en centimes, signé).
 * - dépense, prélèvement fixe : − sur le compte
 * - revenu : + sur le compte
 * - ajustement : montant signé, appliqué tel quel
 * - virement : − montant sur le compte de départ, + montant reçu sur le compte d'arrivée
 * - remboursement carte : − sur le compte chèque, + sur la carte (le montant dû baisse)
 * Une carte de crédit a un solde négatif : montant dû = −solde.
 */
export function effetSurCompte(op: Operation, compteId: string): Centimes {
  let effet = 0
  if (op.compteId === compteId) {
    switch (op.type) {
      case 'revenu': effet += op.montant; break
      case 'ajustement': effet += op.montant; break
      default: effet -= op.montant // dépense, prélèvement fixe, virement, remboursement carte
    }
  }
  if (op.compteDestinationId === compteId) {
    if (op.type === 'virement') effet += op.montantRecu ?? op.montant
    if (op.type === 'remboursement_carte') effet += op.montant
  }
  return effet
}

/**
 * Solde d'un compte à la fin d'une date (incluse). Sans date : toutes les opérations, y compris futures.
 * Les opérations antérieures à la date de départ sont ignorées : le solde de départ les inclut déjà.
 */
export function soldeCompte(compte: Compte, operations: Operation[], jusquAu?: DateISO): Centimes {
  let solde = compte.soldeDepart
  for (const op of operations) {
    if (op.date < compte.dateDepart) continue
    if (jusquAu && op.date > jusquAu) continue
    solde += effetSurCompte(op, compte.id)
  }
  return solde
}

/** Montant dû sur une carte de crédit (positif quand on doit de l'argent). */
export function montantDuCarte(carte: Compte, operations: Operation[], jusquAu?: DateISO): Centimes {
  return -soldeCompte(carte, operations, jusquAu)
}

/** Opération d'ajustement nécessaire pour que le solde calculé devienne le solde réel de la banque. */
export function montantAjustement(soldeCalcule: Centimes, soldeReel: Centimes): Centimes {
  return soldeReel - soldeCalcule
}

/** Pour l'affichage d'une opération : montant signé du point de vue de son compte principal. */
export function montantSigne(op: Operation): Centimes {
  return op.type === 'revenu' || op.type === 'ajustement' ? op.montant : -op.montant
}
