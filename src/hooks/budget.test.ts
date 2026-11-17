import { describe, expect, it } from 'vitest'
import { etatBudget, type ContexteBudget } from './budget'
import type { Operation, Periode, Recurrence } from '../domain/types'

const paie: Recurrence = { id: 'paie', type: 'revenu', libelle: 'Salaire', montant: 180000, compteId: 'chq', moyenPaiement: 'compte',
  frequence: '14_jours', jours: [], dateDebut: '2026-11-11', actif: true, aConfirmer: true, derniereEcheanceGeneree: '2026-11-17' }
const ctx = (p: Partial<ContexteBudget>): ContexteBudget => ({ comptes: [], operations: [], recurrences: [paie], periodes: [], budget: new Set(['chq', 'cc']), paie, date: '2026-11-17', ...p })
const per = (p: Partial<Periode>): Periode => ({ id: 'p', dateDebut: '2026-11-11', dateFin: '2026-11-24', enveloppeValidee: 60000, epargneMiseDeCote: 0, reportPrecedent: 0, ajouts: [], cloturee: false, ...p })
const dep = (date: string, montant: number): Operation => ({ id: date + montant, date, montant, type: 'depense', compteId: 'chq', creeLe: 0 })

describe('etatBudget', () => {
  it('sans paie configurée', () => expect(etatBudget(ctx({ paie: undefined })).etat).toBe('sans_paie'))
  it('avant la première paie', () => expect(etatBudget(ctx({ date: '2026-11-01' }))).toEqual({ etat: 'avant', prochaine: '2026-11-11' }))
  it('première période : à valider, avec les dépenses déjà saisies', () => {
    const e = etatBudget(ctx({ operations: [dep('2026-11-12', 5000), dep('2026-11-17', 1000)] }))
    expect(e.etat).toBe('a_valider')
    if (e.etat === 'a_valider') { expect(e.premiere).toBe(true); expect(e.depenseJusquIci).toBe(6000); expect(e.bornes).toEqual({ debut: '2026-11-11', fin: '2026-11-24' }) }
  })
  it('période validée : budget du jour', () => {
    const e = etatBudget(ctx({ periodes: [per({})], operations: [dep('2026-11-12', 6000)] }))
    expect(e.etat).toBe('actif')
    if (e.etat === 'actif') expect(e.jour.budgetJour).toBe(Math.round(54000 / 8))
  })
  it('nouvelle paie : bilan de la période précédente, puis nouvelle enveloppe avec report', () => {
    const e1 = etatBudget(ctx({ date: '2026-11-25', periodes: [per({})], operations: [dep('2026-11-12', 45000)] }))
    expect(e1.etat).toBe('bilan')
    if (e1.etat === 'bilan') expect(e1.bilan.ecart).toBe(15000)
    const e2 = etatBudget(ctx({ date: '2026-11-25', periodes: [per({ cloturee: true, affectationFin: 'report', montantAffecte: 15000 })] }))
    expect(e2.etat).toBe('a_valider')
    if (e2.etat === 'a_valider') { expect(e2.report).toBe(15000); expect(e2.premiere).toBe(false) }
  })
})
