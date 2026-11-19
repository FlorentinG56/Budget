import { describe, expect, it } from 'vitest'
import { deMois, moisAvecRevue, revueAAnnoncer, revueDuMois } from './revue'
import type { Categorie, Compte, Operation, Periode } from './types'

let n = 0
const op = (p: Partial<Operation>): Operation => ({ id: `o${n++}`, date: '2026-10-10', montant: 0, type: 'depense', compteId: 'chq', creeLe: 0, ...p })
const comptes = [{ id: 'chq', devise: 'CAD', soldeDepart: 100000, dateDepart: '2026-01-01' }, { id: 'eur', devise: 'EUR', soldeDepart: 0, dateDepart: '2026-01-01' }] as Compte[]
const budget = new Set(['chq'])

describe('revue de fin de mois', () => {
  const ops = [
    op({ date: '2026-10-03', type: 'revenu', montant: 180000 }),
    op({ date: '2026-10-01', type: 'prelevement_fixe', montant: 120000, categorieId: 'logement' }),
    op({ date: '2026-10-05', montant: 30000, categorieId: 'alim' }), op({ date: '2026-10-06', montant: 5000, categorieId: 'loisirs' }),
    op({ date: '2026-10-07', montant: 2000, categorieId: 'transport' }), op({ date: '2026-10-08', montant: 1000, categorieId: 'divers' }),
    op({ date: '2026-10-09', montant: 99999, compteId: 'eur' }),
    op({ date: '2026-09-05', montant: 140000 }), op({ date: '2026-08-05', montant: 100000 }), // mois précédents (dont charges : non)
  ]
  const cats = [{ id: 'alim', nom: 'Alimentation', icone: '🛒', couleur: '', ordre: 0, archivee: false, budgetMensuel: 25000 }] as Categorie[]
  const periode: Periode = { id: 'p', dateDebut: '2026-10-01', dateFin: '2026-10-14', enveloppeValidee: 14000, epargneMiseDeCote: 0, reportPrecedent: 0, ajouts: [], cloturee: true }
  const r = revueDuMois('2026-10', { comptes, budget, operations: ops, objectifs: [], categories: cats, periodes: [periode], aujourdhui: '2026-11-01' })
  it('total dépensé (quotidien + charges fixes), revenus, comparaisons', () => {
    expect(r.totalDepense).toBe(120000 + 38000)
    expect(r.resume.revenus).toBe(180000)
    expect(r.precedent).toBe(140000)
    expect(r.moyenne3).toBe(120000) // septembre 1 400 $, août 1 000 $ (juillet sans données : ignoré)
  })
  it('pas de comparaison avec un mois sans données', () => {
    const r2 = revueDuMois('2026-08', { comptes, budget, operations: ops, objectifs: [], categories: cats, periodes: [], aujourdhui: '2026-11-01' })
    expect(r2.precedent).toBeUndefined(); expect(r2.moyenne3).toBeUndefined()
  })
  it('top 3 des catégories, budgets respectés ou non, jours dans le budget', () => {
    expect(r.top.map((l) => l.id)).toEqual(['alim', 'loisirs', 'transport'])
    expect(r.budgets.map((b) => [b.categorie.id, b.respecte])).toEqual([['alim', false]])
    expect(r.jours.total).toBe(14)
  })
  it('bandeau du 1er au 7, une fois ; historique des mois', () => {
    expect(revueAAnnoncer('2026-11-01', ops, budget, [])).toBe('2026-10')
    expect(revueAAnnoncer('2026-11-07', ops, budget, [])).toBe('2026-10')
    expect(revueAAnnoncer('2026-11-08', ops, budget, [])).toBeUndefined()
    expect(revueAAnnoncer('2026-11-02', ops, budget, ['2026-10'])).toBeUndefined()
    expect(revueAAnnoncer('2026-08-02', ops, budget, [])).toBeUndefined() // juillet sans données
    expect(moisAvecRevue(ops, budget, '2026-11-18')).toEqual(['2026-10', '2026-09', '2026-08'])
  })
  it('« d’octobre », « de novembre »', () => {
    expect(deMois('2026-10')).toBe('d’octobre'); expect(deMois('2026-11')).toBe('de novembre'); expect(deMois('2026-08')).toBe('d’août')
  })
})
