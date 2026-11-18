import type { Centimes, DateISO } from './types'

/**
 * Apparence d'une case du calendrier (tâche A) :
 * - jour passé : fond blanc, montant = dépensé (vert si budget du jour respecté, rouge sinon, neutre sans budget)
 * - aujourd'hui : inchangé (pastille bleue), montant = solde projeté en fin de journée
 * - jour futur : fond bleu très pâle, montant = solde projeté ; fond rouge pâle si le solde projeté est négatif
 */
export type FondCase = 'passe' | 'aujourdhui' | 'futur' | 'negatif'
export type TonMontant = 'respecte' | 'depasse' | 'neutre' | 'projete' | 'negatif'

export interface ApparenceCase { fond: FondCase; ton: TonMontant; montant?: Centimes }

export function apparenceCase(p: { date: DateISO; aujourdhui: DateISO; depense?: Centimes; budgetJour?: Centimes; soldeProjete?: Centimes }): ApparenceCase {
  if (p.date < p.aujourdhui) {
    const depense = p.depense ?? 0
    const montant = depense > 0 || p.budgetJour !== undefined ? depense : undefined
    const ton: TonMontant = p.budgetJour === undefined ? 'neutre' : depense <= p.budgetJour ? 'respecte' : 'depasse'
    return { fond: 'passe', ton, montant }
  }
  const negatif = p.soldeProjete !== undefined && p.soldeProjete < 0
  return {
    fond: p.date === p.aujourdhui ? 'aujourdhui' : negatif ? 'negatif' : 'futur',
    ton: negatif ? 'negatif' : 'projete',
    montant: p.soldeProjete,
  }
}
