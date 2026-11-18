import type { Compte } from '../domain/types'
import type { BudgetDB } from './db'
import { initialiserDonnees, terminerAccueil } from './actions'

/** Pour les tests : un utilisateur avec un compte courant (budget du jour), sa carte et un compte en euros. */
export const COMPTES_TEST: Compte[] = [
  { id: 'chq', nom: 'Compte courant', type: 'cheque', devise: 'CAD', couleur: '#00874E', soldeDepart: 0, dateDepart: '2026-01-01', inclusBudgetJournalier: true, archive: false, ordre: 0 },
  { id: 'carte', nom: 'Carte de crédit', type: 'carte_credit', devise: 'CAD', couleur: '#2E9C6A', soldeDepart: 0, dateDepart: '2026-01-01', compteRemboursementId: 'chq', inclusBudgetJournalier: true, archive: false, ordre: 1 },
  { id: 'eur', nom: 'Compte en euros', type: 'cheque', devise: 'EUR', couleur: '#008C8C', soldeDepart: 0, dateDepart: '2026-01-01', inclusBudgetJournalier: false, archive: false, ordre: 2 },
]

export async function preparerUtilisateur(base: BudgetDB, dateDepart?: string): Promise<void> {
  await initialiserDonnees(base)
  await base.comptes.bulkAdd(COMPTES_TEST.map((c) => ({ ...c, ...(dateDepart ? { dateDepart } : {}) })))
  await terminerAccueil(base)
}
