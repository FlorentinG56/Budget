import { describe, expect, it } from 'vitest'
import { effetSurCompte, montantAjustement, montantDuCarte, soldeCompte } from './soldes'
import type { Compte, Operation } from './types'

const compte = (p: Partial<Compte>): Compte => ({
  id: 'chq', nom: 'Compte courant', type: 'cheque', devise: 'CAD', couleur: '#000', soldeDepart: 100000,
  dateDepart: '2026-11-01', inclusBudgetJournalier: true, archive: false, ordre: 0, ...p,
})
let n = 0
const op = (p: Partial<Operation>): Operation => ({ id: `o${n++}`, date: '2026-11-10', montant: 0, type: 'depense', compteId: 'chq', creeLe: 0, ...p })

const chq = compte({})
const carte = compte({ id: 'cc', type: 'carte_credit', soldeDepart: -20000, compteRemboursementId: 'chq', nom: 'Carte' })
const ca = compte({ id: 'ca', devise: 'EUR', soldeDepart: 500000, inclusBudgetJournalier: false })

describe('soldeCompte', () => {
  it('part du solde de départ et applique dépenses et revenus', () => {
    const ops = [op({ montant: 2550 }), op({ type: 'revenu', montant: 180000 }), op({ type: 'prelevement_fixe', montant: 120000 })]
    expect(soldeCompte(chq, ops)).toBe(100000 - 2550 + 180000 - 120000)
  })

  it('ignore les opérations avant la date de départ', () => {
    expect(soldeCompte(chq, [op({ date: '2026-10-31', montant: 5000 })])).toBe(100000)
    expect(soldeCompte(chq, [op({ date: '2026-11-01', montant: 5000 })])).toBe(95000)
  })

  it('peut s’arrêter à une date', () => {
    const ops = [op({ date: '2026-11-05', montant: 1000 }), op({ date: '2026-11-20', montant: 3000 })]
    expect(soldeCompte(chq, ops, '2026-11-10')).toBe(99000)
    expect(soldeCompte(chq, ops)).toBe(96000)
  })

  it('applique un ajustement signé', () => {
    expect(soldeCompte(chq, [op({ type: 'ajustement', montant: -1234 })])).toBe(98766)
    expect(soldeCompte(chq, [op({ type: 'ajustement', montant: 500 })])).toBe(100500)
  })

  it('n’affecte pas les autres comptes', () => {
    expect(soldeCompte(ca, [op({ montant: 5000 })])).toBe(500000)
  })
})

describe('virements', () => {
  it('retire dans la devise de départ et ajoute le montant reçu à l’arrivée', () => {
    const v = op({ type: 'virement', compteId: 'ca', compteDestinationId: 'chq', montant: 10000, montantRecu: 14500 })
    expect(effetSurCompte(v, 'ca')).toBe(-10000)
    expect(effetSurCompte(v, 'chq')).toBe(14500)
    expect(soldeCompte(ca, [v])).toBe(490000)
    expect(soldeCompte(chq, [v])).toBe(114500)
  })
})

describe('carte de crédit', () => {
  it('un achat par carte augmente le montant dû sans toucher le compte chèque', () => {
    const achat = op({ compteId: 'cc', montant: 4500 })
    expect(montantDuCarte(carte, [achat])).toBe(24500)
    expect(soldeCompte(chq, [achat])).toBe(100000)
  })

  it('un remboursement baisse le compte chèque et le montant dû', () => {
    const remb = op({ type: 'remboursement_carte', compteId: 'chq', compteDestinationId: 'cc', montant: 15000 })
    expect(soldeCompte(chq, [remb])).toBe(85000)
    expect(montantDuCarte(carte, [remb])).toBe(5000)
  })
})

describe('montantAjustement', () => {
  it('donne l’écart à enregistrer', () => {
    expect(montantAjustement(100000, 98750)).toBe(-1250)
    expect(montantAjustement(100000, 100000)).toBe(0)
  })
})
