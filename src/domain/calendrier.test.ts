import { describe, expect, it } from 'vitest'
import { apparenceCase } from './calendrier'

const auj = '2026-11-18'
describe('apparence des cases du calendrier', () => {
  it('jour passé : dépensé, vert si budget respecté, rouge sinon', () => {
    expect(apparenceCase({ date: '2026-11-17', aujourdhui: auj, depense: 1250, budgetJour: 3500 })).toEqual({ fond: 'passe', ton: 'respecte', montant: 1250 })
    expect(apparenceCase({ date: '2026-11-17', aujourdhui: auj, depense: 3600, budgetJour: 3500 })).toEqual({ fond: 'passe', ton: 'depasse', montant: 3600 })
    expect(apparenceCase({ date: '2026-11-17', aujourdhui: auj, depense: 0, budgetJour: 3500 })).toEqual({ fond: 'passe', ton: 'respecte', montant: 0 })
  })
  it('jour passé sans budget du jour : neutre, rien si aucune dépense', () => {
    expect(apparenceCase({ date: '2026-11-17', aujourdhui: auj, depense: 800 })).toEqual({ fond: 'passe', ton: 'neutre', montant: 800 })
    expect(apparenceCase({ date: '2026-11-17', aujourdhui: auj, depense: 0 })).toEqual({ fond: 'passe', ton: 'neutre', montant: undefined })
  })
  it('jour futur : solde projeté sur fond bleu pâle, rouge pâle si négatif', () => {
    expect(apparenceCase({ date: '2026-11-19', aujourdhui: auj, soldeProjete: 150000 })).toEqual({ fond: 'futur', ton: 'projete', montant: 150000 })
    expect(apparenceCase({ date: '2026-11-19', aujourdhui: auj, soldeProjete: -2000 })).toEqual({ fond: 'negatif', ton: 'negatif', montant: -2000 })
  })
  it('aujourd’hui : inchangé, solde projeté', () => {
    expect(apparenceCase({ date: auj, aujourdhui: auj, soldeProjete: 98000 })).toEqual({ fond: 'aujourdhui', ton: 'projete', montant: 98000 })
  })
})
