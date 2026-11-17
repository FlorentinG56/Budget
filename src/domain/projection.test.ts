import { describe, expect, it } from 'vitest'
import { evenementsPrevus, grilleMois, montantCompact, premierJourNegatif, projeterSoldes } from './projection'
import type { Operation, Recurrence } from './types'

const rec = (p: Partial<Recurrence>): Recurrence => ({
  id: 'r', type: 'charge_fixe', libelle: 'X', montant: 0, compteId: 'chq', moyenPaiement: 'compte', frequence: 'mensuel', jours: [1], dateDebut: '2026-01-01', actif: true, ...p,
})

describe('evenementsPrevus', () => {
  it('échéances non traitées, charge par carte sur la carte, pas les récurrences en pause', () => {
    const evs = evenementsPrevus([
      rec({ id: 'loyer', libelle: 'Loyer', montant: 120000, jours: [1], derniereEcheanceGeneree: '2026-11-17' }),
      rec({ id: 'nf', libelle: 'Netflix', montant: 2000, jours: [5], moyenPaiement: 'carte', carteId: 'cc', derniereEcheanceGeneree: '2026-11-17' }),
      rec({ id: 'paie', type: 'revenu', libelle: 'Salaire', montant: 180000, frequence: '14_jours', jours: [], dateDebut: '2026-11-11', derniereEcheanceGeneree: '2026-11-17' }),
      rec({ id: 'pause', actif: false, jours: [2] }),
    ], '2026-11-18', '2026-12-10')
    expect(evs.map((e) => [e.date, e.libelle, e.sens, e.compteId])).toEqual([
      ['2026-11-25', 'Salaire', 'revenu', 'chq'],
      ['2026-12-01', 'Loyer', 'charge', 'chq'],
      ['2026-12-05', 'Netflix', 'charge', 'cc'],
      ['2026-12-09', 'Salaire', 'revenu', 'chq'],
    ])
  })
})

describe('projeterSoldes', () => {
  const base = {
    comptes: new Set(['chq', 'cc']), aujourdhui: '2026-11-28', jusquAu: '2026-12-03', soldeFinAujourdhui: 100000, enAttenteAujourdhui: 0,
    operationsFutures: [] as Operation[], depenseJour: () => 2000,
    evenements: [
      { date: '2026-12-01', libelle: 'Loyer', montant: 120000, sens: 'charge' as const, recurrenceId: 'l', compteId: 'chq' },
      { date: '2026-12-02', libelle: 'Paie', montant: 180000, sens: 'revenu' as const, recurrenceId: 'p', compteId: 'chq' },
      { date: '2026-12-02', libelle: 'Assurance FR', montant: 9999, sens: 'charge' as const, recurrenceId: 'a', compteId: 'ca' },
    ],
  }
  it('solde actuel + revenus − charges − budget journalier, jour par jour', () => {
    const p = projeterSoldes(base)
    expect([...p.values()].map((j) => [j.date, j.solde])).toEqual([
      ['2026-11-28', 98000], // 1000 − 20 (reste du jour)
      ['2026-11-29', 96000],
      ['2026-11-30', 94000],
      ['2026-12-01', -28000], // − loyer
      ['2026-12-02', 150000], // + paie ; l'assurance d'un autre compte est ignorée
      ['2026-12-03', 148000],
    ])
    expect(premierJourNegatif(p)).toBe('2026-12-01')
  })
  it('compte les revenus en attente de confirmation et les opérations saisies à une date future', () => {
    const p = projeterSoldes({ ...base, depenseJour: () => 0, evenements: [], enAttenteAujourdhui: 50000,
      operationsFutures: [{ id: 'f', date: '2026-11-30', montant: 3000, type: 'depense', compteId: 'cc', creeLe: 0 }] })
    expect(p.get('2026-11-28')?.solde).toBe(150000)
    expect(p.get('2026-11-30')?.solde).toBe(147000)
    expect(premierJourNegatif(p)).toBeUndefined()
  })
})

describe('grille et affichage', () => {
  it('semaines commençant le lundi', () => {
    const g = grilleMois(2026, 10) // novembre 2026 : commence un dimanche
    expect(g[0]).toEqual([null, null, null, null, null, null, '2026-11-01'])
    expect(g[1][0]).toBe('2026-11-02')
    expect(g[g.length - 1].filter(Boolean).pop()).toBe('2026-11-30')
    expect(grilleMois(2026, 5)[0][0]).toBe('2026-06-01') // juin 2026 commence un lundi
  })
  it('montants compacts', () => {
    expect(montantCompact(84512)).toBe('845')
    expect(montantCompact(123456)).toBe('1,2k')
    expect(montantCompact(200000)).toBe('2k')
    expect(montantCompact(-28000)).toBe('−280')
    expect(montantCompact(1534500)).toBe('15k')
  })
})
