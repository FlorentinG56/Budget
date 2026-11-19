import { describe, expect, it } from 'vitest'
import { moisDe, seuilBudget, suiviBudgets } from './budgetsCategories'
import type { Categorie, Operation } from './types'

const cat = (id: string, p: Partial<Categorie> = {}): Categorie => ({ id, nom: id, icone: '', couleur: '', ordre: 0, archivee: false, ...p })
let n = 0
const op = (p: Partial<Operation>): Operation => ({ id: `o${n++}`, date: '2026-11-10', montant: 0, type: 'depense', compteId: 'chq', creeLe: 0, ...p })

describe('budgets par catégorie', () => {
  const cats = [cat('alim', { budgetMensuel: 40000 }), cat('loisirs', { budgetMensuel: 10000 }), cat('transport'), cat('alim/epicerie', { parentId: 'alim', budgetMensuel: 1 }), cat('vieux', { archivee: true, budgetMensuel: 5 })]
  const ops = [
    op({ categorieId: 'alim', sousCategorieId: 'alim/epicerie', montant: 25000 }),
    op({ categorieId: 'alim', montant: 8000, horsBudget: true }), // à côté : compte
    op({ categorieId: 'alim', montant: 1000, objectifEpargneId: 's' }), // épargne : compte
    op({ categorieId: 'alim', montant: 99999, compteId: 'eur' }), // autre compte : non
    op({ categorieId: 'alim', montant: 99999, date: '2026-10-31' }), // autre mois : non
    op({ categorieId: 'alim', montant: 99999, type: 'prelevement_fixe' }), // charge fixe : non
    op({ categorieId: 'loisirs', montant: 11200, compteId: 'carte' }),
  ]
  it('seules les catégories principales avec un budget ; toutes les dépenses du mois sur les comptes du budget', () => {
    const l = suiviBudgets(cats, ops, new Set(['chq', 'carte']), '2026-11-18')
    expect(l.map((s) => [s.categorie.id, s.budget, s.depense, s.reste])).toEqual([['loisirs', 10000, 11200, -1200], ['alim', 40000, 34000, 6000]])
  })
  it('seuils 80 % et 100 %', () => {
    const l = suiviBudgets(cats, ops, new Set(['chq', 'carte']), '2026-11-18')
    expect(l.map(seuilBudget)).toEqual([100, 80]) // 112 % et 85 %
    expect(seuilBudget({ categorie: cats[0], budget: 100, depense: 79, part: 0.79, reste: 21 })).toBeUndefined()
    expect(seuilBudget({ categorie: cats[0], budget: 100, depense: 100, part: 1, reste: 0 })).toBe(80) // pile : pas encore dépassé
  })
  it('mois civil', () => expect(moisDe('2026-11-18')).toEqual({ debut: '2026-11-01', fin: '2026-11-30', libelle: 'novembre' }))
})
