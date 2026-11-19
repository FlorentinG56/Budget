import { describe, expect, it } from 'vitest'
import { bilanVoyage, compteParDefaut, jourDeVoyage, statutVoyage, voyageAccueil } from './voyage'
import type { Compte, Operation, Voyage } from './types'

let n = 0
const op = (p: Partial<Operation>): Operation => ({ id: `o${n++}`, date: '2026-12-21', montant: 0, type: 'depense', compteId: 'voy', creeLe: 0, ...p })
const v: Voyage = { id: 'v', nom: 'Japon', compteId: 'voy', debut: '2026-12-20', fin: '2026-12-29', budget: 100000 } // 10 jours, 1 000 €

describe('mode voyage', () => {
  it('statut', () => {
    expect(statutVoyage(v, '2026-12-19')).toBe('a_venir'); expect(statutVoyage(v, '2026-12-20')).toBe('en_cours')
    expect(statutVoyage(v, '2026-12-29')).toBe('en_cours'); expect(statutVoyage(v, '2026-12-30')).toBe('termine')
  })
  it('budget par jour : reste ÷ jours restants (seules les dépenses du compte pendant le voyage)', () => {
    const ops = [op({ date: '2026-12-20', montant: 20000 }), op({ date: '2026-12-21', montant: 5000 }),
      op({ date: '2026-12-19', montant: 99999 }), op({ compteId: 'chq', montant: 99999 }), op({ type: 'revenu', montant: 99999 })]
    const j = jourDeVoyage(v, ops, '2026-12-21') // 800 € pour 9 jours
    expect(j.budgetJour).toBe(8889); expect(j.depenseAujourdhui).toBe(5000); expect(j.resteAujourdhui).toBe(3889); expect(j.joursRestants).toBe(9)
    expect(j.restePeriode).toBe(75000)
  })
  it('bilan : budget, dépensé, écart, catégories', () => {
    const b = bilanVoyage(v, [op({ montant: 60000, categorieId: 'voyages' }), op({ montant: 30000, categorieId: 'alim' }), op({ montant: 99999, date: '2027-01-02' })])
    expect([b.budget, b.depense, b.ecart, b.jours, b.parJour]).toEqual([100000, 90000, 10000, 10, 9000])
    expect(b.categories.map((c) => c.categorieId)).toEqual(['voyages', 'alim'])
  })
  it('accueil : en cours, sinon terminé depuis 3 jours au plus', () => {
    expect(voyageAccueil([v], '2026-12-25')?.id).toBe('v')
    expect(voyageAccueil([v], '2027-01-01')?.id).toBe('v')
    expect(voyageAccueil([v], '2027-01-02')).toBeUndefined()
    expect(voyageAccueil([v], '2026-12-10')).toBeUndefined()
  })
  it('compte par défaut : celui du dernier voyage, sinon le premier hors budget du jour', () => {
    const comptes = [
      { id: 'chq', type: 'cheque', inclusBudgetJournalier: true, archive: false }, { id: 'cc', type: 'carte_credit', inclusBudgetJournalier: true, archive: false },
      { id: 'eur', type: 'cheque', inclusBudgetJournalier: false, archive: false }, { id: 'voy', type: 'cheque', inclusBudgetJournalier: false, archive: false },
    ] as Compte[]
    expect(compteParDefaut([], comptes)).toBe('eur')
    expect(compteParDefaut([v], comptes)).toBe('voy')
  })
})
