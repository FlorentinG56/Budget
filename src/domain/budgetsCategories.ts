import { endOfMonth, format, parseISO, startOfMonth } from 'date-fns'
import { fr } from 'date-fns/locale/fr'
import { versISO } from './dates'
import type { Categorie, Centimes, DateISO, Operation } from './types'

/**
 * Budgets mensuels par catégorie principale (tâche E3), sur les comptes du budget du jour.
 * Toutes les dépenses de la catégorie comptent (budget du jour, à côté, payées avec l'épargne) ; pas les charges fixes.
 */

export interface SuiviBudget {
  categorie: Categorie
  budget: Centimes
  depense: Centimes
  part: number // dépense ÷ budget (peut dépasser 1)
  reste: Centimes // budget − dépense (négatif : dépassé)
}

export function moisDe(date: DateISO): { debut: DateISO; fin: DateISO; libelle: string } {
  const d = parseISO(date)
  return { debut: versISO(startOfMonth(d)), fin: versISO(endOfMonth(d)), libelle: format(d, 'MMMM', { locale: fr }) }
}

export function suiviBudgets(categories: Categorie[], operations: Operation[], comptes: Set<string>, date: DateISO): SuiviBudget[] {
  const m = moisDe(date)
  return categories
    .filter((c) => !c.parentId && !c.archivee && (c.budgetMensuel ?? 0) > 0)
    .map((c) => {
      const depense = operations
        .filter((o) => o.type === 'depense' && o.categorieId === c.id && comptes.has(o.compteId) && o.date >= m.debut && o.date <= m.fin)
        .reduce((s, o) => s + o.montant, 0)
      const budget = c.budgetMensuel!
      return { categorie: c, budget, depense, part: depense / budget, reste: budget - depense }
    })
    .sort((a, b) => b.part - a.part)
}

/** Seuil atteint : 100 % (dépassé) ou 80 %, sinon aucun. */
export function seuilBudget(s: SuiviBudget): 100 | 80 | undefined {
  if (s.depense > s.budget) return 100
  if (s.part >= 0.8) return 80
  return undefined
}
