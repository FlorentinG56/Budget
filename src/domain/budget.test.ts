import { describe, expect, it } from 'vitest'
import {
  bilanPeriode, calculerBudgetJour, comptesBudget, depensesBudget, enveloppeEffective, enveloppeProposee,
  periodeCourante, previsionsPeriode, prochaineDatePaie, recurrencePaie, reportPourSuivante,
} from './budget'
import type { Compte, Operation, Periode, Recurrence } from './types'

let n = 0
const op = (p: Partial<Operation>): Operation => ({ id: `o${n++}`, date: '2026-11-12', montant: 0, type: 'depense', compteId: 'chq', creeLe: n, ...p })
const rec = (p: Partial<Recurrence>): Recurrence => ({
  id: 'r', type: 'charge_fixe', libelle: 'X', montant: 0, compteId: 'chq', moyenPaiement: 'compte', frequence: 'mensuel', jours: [1], dateDebut: '2026-01-01', actif: true, ...p,
})
const budget = new Set(['chq', 'cc'])
const paie = rec({ id: 'paie', type: 'revenu', libelle: 'Salaire', montant: 180000, frequence: '14_jours', jours: [], dateDebut: '2026-11-11', aConfirmer: true })

describe('comptes et paie', () => {
  it('comptes du budget : chèque et carte, pas les autres', () => {
    const c = (id: string, inclus: boolean, archive = false) => ({ id, inclusBudgetJournalier: inclus, archive }) as Compte
    expect([...comptesBudget([c('chq', true), c('cc', true), c('ca', false), c('old', true, true)])]).toEqual(['chq', 'cc'])
  })
  it('choisit la récurrence de paie', () => {
    const km = rec({ id: 'km', type: 'revenu', libelle: 'Remboursement km' })
    expect(recurrencePaie([km, paie], budget)?.id).toBe('paie')
    expect(recurrencePaie([km, paie], budget, 'km')?.id).toBe('km')
    expect(recurrencePaie([km], budget)?.id).toBe('km')
    expect(recurrencePaie([{ ...paie, compteId: 'ca' }], budget)).toBeUndefined()
  })
})

describe('periodeCourante', () => {
  it('de la paie à la veille de la suivante', () => {
    expect(periodeCourante(paie, '2026-11-17')).toEqual({ debut: '2026-11-11', fin: '2026-11-24' })
    expect(periodeCourante(paie, '2026-11-25')).toEqual({ debut: '2026-11-25', fin: '2026-12-08' })
    expect(periodeCourante(paie, '2026-11-24')).toEqual({ debut: '2026-11-11', fin: '2026-11-24' })
  })
  it('aucune période avant la première paie', () => {
    expect(periodeCourante(paie, '2026-11-05')).toBeUndefined()
    expect(prochaineDatePaie(paie, '2026-11-05')).toBe('2026-11-11')
  })
  it('suit la fréquence : passage au mensuel', () => {
    expect(periodeCourante({ ...paie, frequence: 'mensuel', jours: [15], dateDebut: '2026-01-01' }, '2026-11-17')).toEqual({ debut: '2026-11-15', fin: '2026-12-14' })
  })
})

describe('budget du jour', () => {
  it('exemple du cahier des charges : 600 $ sur 15 jours, 150 $ dépensés au jour 6 → 45 $/jour', () => {
    const b = { debut: '2026-11-01', fin: '2026-11-15' }
    expect(calculerBudgetJour(60000, [], budget, b, '2026-11-01').budgetJour).toBe(4000)
    const ops = [op({ date: '2026-11-02', montant: 10000 }), op({ date: '2026-11-04', compteId: 'cc', montant: 5000 })]
    const j6 = calculerBudgetJour(60000, ops, budget, b, '2026-11-06')
    expect(j6.budgetJour).toBe(4500)
    expect(j6.joursRestants).toBe(10)
    expect(j6.jourNumero).toBe(6)
    expect(j6.joursTotal).toBe(15)
  })
  it('les dépenses du jour ne changent pas le budget du jour, seulement le reste', () => {
    const b = { debut: '2026-11-01', fin: '2026-11-10' }
    const r = calculerBudgetJour(50000, [op({ date: '2026-11-06', montant: 1250 })], budget, b, '2026-11-06')
    expect(r.budgetJour).toBe(10000)
    expect(r.resteAujourdhui).toBe(8750)
    const depasse = calculerBudgetJour(50000, [op({ date: '2026-11-06', montant: 11200 })], budget, b, '2026-11-06')
    expect(depasse.resteAujourdhui).toBe(-1200)
  })
  it('dépenser moins aujourd’hui augmente le budget des jours suivants', () => {
    const b = { debut: '2026-11-01', fin: '2026-11-10' }
    const econome = calculerBudgetJour(50000, [op({ date: '2026-11-01', montant: 1000 })], budget, b, '2026-11-02')
    const depensier = calculerBudgetJour(50000, [op({ date: '2026-11-01', montant: 9000 })], budget, b, '2026-11-02')
    expect(econome.budgetJour).toBe(5444) // (500 − 10) / 9
    expect(depensier.budgetJour).toBe(4556) // (500 − 90) / 9
  })
  it('ne compte que les dépenses du budget', () => {
    const ops = [
      op({ montant: 100 }), op({ compteId: 'cc', montant: 200 }), op({ compteId: 'ca', montant: 400 }),
      op({ type: 'prelevement_fixe', montant: 800 }), op({ type: 'remboursement_carte', compteDestinationId: 'cc', montant: 1600 }),
      op({ type: 'virement', compteDestinationId: 'ca', montant: 3200 }), op({ type: 'ajustement', montant: -6400 }),
      op({ type: 'revenu', montant: 12800 }), op({ date: '2026-12-01', montant: 25600 }),
    ]
    expect(depensesBudget(ops, budget, '2026-11-01', '2026-11-30')).toBe(300)
  })
  it('projection des jours suivants : chaque dépense du jour la fait baisser', () => {
    const b = { debut: '2026-11-01', fin: '2026-11-15' }
    const avant = op({ date: '2026-11-02', montant: 15000 })
    const proj = (aujourdhui: number[]) => calculerBudgetJour(60000, [avant, ...aujourdhui.map((m) => op({ date: '2026-11-06', montant: m }))], budget, b, '2026-11-06').budgetJoursSuivants
    expect(proj([])).toBe(5000) // matin : 450 / 9
    expect(proj([500])).toBe(4944) // café 5 $ : 445 / 9
    expect(proj([4500])).toBe(4500) // pile le budget du jour
    expect(proj([500, 8000])).toBe(4056) // 85 $ : 365 / 9
  })
  it('la projection d’aujourd’hui est exactement le budget du jour de demain', () => {
    const b = { debut: '2026-11-11', fin: '2026-11-24' } // 17 nov : 8 jours restants (17→24), 7 après aujourd'hui (18→24)
    for (const depenseDuJour of [0, 1250, 6250, 7250, 50000]) {
      const ops = [op({ date: '2026-11-12', montant: 3000 }), op({ date: '2026-11-17', montant: depenseDuJour })]
      const aujourdhui = calculerBudgetJour(50000, ops, budget, b, '2026-11-17')
      const demain = calculerBudgetJour(50000, ops, budget, b, '2026-11-18')
      expect(aujourdhui.joursRestants).toBe(8)
      expect(demain.joursRestants).toBe(7)
      expect(aujourdhui.budgetJoursSuivants).toBe(demain.budgetJour)
    }
  })
  it('pas de projection le dernier jour', () => {
    expect(calculerBudgetJour(50000, [], budget, { debut: '2026-11-01', fin: '2026-11-10' }, '2026-11-10').budgetJoursSuivants).toBeUndefined()
  })
  it('dernier jour : tout le reste', () => {
    const b = { debut: '2026-11-01', fin: '2026-11-10' }
    expect(calculerBudgetJour(50000, [op({ date: '2026-11-03', montant: 45000 })], budget, b, '2026-11-10').budgetJour).toBe(5000)
  })
})

describe('enveloppe', () => {
  const b = { debut: '2026-11-25', fin: '2026-12-08' }
  const loyer = rec({ id: 'loyer', libelle: 'Loyer', montant: 120000, jours: [1], derniereEcheanceGeneree: '2026-11-24' })
  const netflix = rec({ id: 'nf', libelle: 'Netflix', montant: 2000, jours: [5], moyenPaiement: 'carte', carteId: 'cc', derniereEcheanceGeneree: '2026-11-24' })
  const ca = rec({ id: 'ca', libelle: 'Assurance FR', montant: 5000, jours: [3], compteId: 'ca' })
  const km = rec({ id: 'km', type: 'revenu', libelle: 'Km', montant: 15000, frequence: '14_jours', jours: [], dateDebut: '2026-11-18', derniereEcheanceGeneree: '2026-11-18' })
  const p = { ...paie, derniereEcheanceGeneree: '2026-11-24' }

  it('revenus et charges prévus de la période (charges par carte comprises, autres comptes exclus)', () => {
    const prev = previsionsPeriode([p, km, loyer, netflix, ca], [], budget, b)
    expect(prev.revenus).toBe(180000 + 15000) // paie du 25/11 + km du 2/12
    expect(prev.charges).toBe(120000 + 2000)
    expect(prev.detailCharges.map((d) => d.libelle)).toEqual(['Loyer', 'Netflix'])
  })
  it('utilise le montant réel une fois l’échéance confirmée, même payée en avance', () => {
    const confirmee = { ...p, derniereEcheanceGeneree: '2026-11-25' }
    const ops = [op({ type: 'revenu', recurrenceId: 'paie', note: 'Salaire', montant: 182345, date: '2026-11-24', echeance: '2026-11-25' })]
    const prev = previsionsPeriode([confirmee], ops, budget, b)
    expect(prev.revenus).toBe(182345)
    expect(prev.detailRevenus[0].estime).toBe(false)
  })
  it('un prélèvement annulé ne compte plus', () => {
    const passe = { ...loyer, derniereEcheanceGeneree: '2026-12-01' }
    expect(previsionsPeriode([passe], [], budget, b).charges).toBe(0)
  })
  it('enveloppe = revenus − charges − épargne + report', () => {
    expect(enveloppeProposee({ revenus: 195000, charges: 122000 }, 20000, 3000)).toBe(56000)
    expect(enveloppeProposee({ revenus: 195000, charges: 122000 }, 0, -5000)).toBe(68000)
  })
  it('enveloppe effective : ajouts dont l’opération existe encore', () => {
    const per: Periode = { id: 'p', dateDebut: '2026-11-25', dateFin: '2026-12-08', enveloppeValidee: 60000, epargneMiseDeCote: 0, reportPrecedent: 0, cloturee: false,
      ajouts: [{ operationId: 'vente', montant: 5000 }, { operationId: 'supprimee', montant: 9999 }] }
    expect(enveloppeEffective(per, [op({ id: 'vente' })])).toBe(65000)
  })
})

describe('bilan et report', () => {
  const per: Periode = { id: 'p', dateDebut: '2026-11-11', dateFin: '2026-11-24', enveloppeValidee: 60000, epargneMiseDeCote: 0, reportPrecedent: 0, ajouts: [], cloturee: false }
  it('écart positif ou négatif', () => {
    expect(bilanPeriode(per, [op({ montant: 45000 })], budget)).toEqual({ enveloppe: 60000, depense: 45000, ecart: 15000 })
    expect(bilanPeriode(per, [op({ montant: 61200 })], budget).ecart).toBe(-1200)
  })
  it('report selon le choix', () => {
    expect(reportPourSuivante({ affectationFin: 'report', montantAffecte: 15000 })).toBe(15000)
    expect(reportPourSuivante({ affectationFin: 'epargne', montantAffecte: 15000 })).toBe(0)
    expect(reportPourSuivante({ affectationFin: 'deficit_reporte', montantAffecte: -1200 })).toBe(-1200)
    expect(reportPourSuivante({ affectationFin: 'aucune' })).toBe(0)
  })
})

import { affectationAutomatique, depensesParCategorie, joursRespectes, nonAffecte } from './budget'

describe('bilan détaillé', () => {
  const per: Periode = { id: 'p', dateDebut: '2026-11-25', dateFin: '2026-12-08', enveloppeValidee: 50000, epargneMiseDeCote: 0, reportPrecedent: 0, ajouts: [], cloturee: false }
  it('dépenses par catégorie, triées, avec part et comparaison', () => {
    const ops = [
      op({ date: '2026-11-26', montant: 20000, categorieId: 'alim' }), op({ date: '2026-11-27', compteId: 'cc', montant: 10000, categorieId: 'alim' }),
      op({ date: '2026-11-28', montant: 10000, categorieId: 'transport' }), op({ date: '2026-11-29', montant: 10000 }),
      op({ date: '2026-11-30', compteId: 'ca', montant: 99999, categorieId: 'alim' }), // autre compte : ignoré
      op({ date: '2026-11-15', montant: 25000, categorieId: 'alim' }), op({ date: '2026-11-16', montant: 5000, categorieId: 'loisirs' }),
    ]
    const l = depensesParCategorie(ops, budget, '2026-11-25', '2026-12-08', { debut: '2026-11-11', fin: '2026-11-24' })
    expect(l.map((x) => [x.categorieId, x.montant, x.nombre, x.part, x.precedent])).toEqual([
      ['alim', 30000, 2, 0.6, 25000],
      ['transport', 10000, 1, 0.2, 0],
      [null, 10000, 1, 0.2, 0],
      ['loisirs', 0, 0, 0, 5000], // dépensée la période d'avant, plus celle-ci
    ])
  })
  it('les catégories comptent aussi les dépenses à côté du budget et payées avec l’épargne', () => {
    const ops = [
      op({ date: '2026-11-26', montant: 2000, categorieId: 'alim' }),
      op({ date: '2026-11-27', montant: 15000, categorieId: 'sport', horsBudget: true }),
      op({ date: '2026-11-28', montant: 40000, categorieId: 'transport', objectifEpargneId: 'sec' }),
    ]
    const l = depensesParCategorie(ops, budget, '2026-11-25', '2026-12-08')
    expect(l.map((x) => [x.categorieId, x.montant])).toEqual([['transport', 40000], ['sport', 15000], ['alim', 2000]])
  })
  it('jours où le budget du jour a été respecté', () => {
    // 500 $ / 14 j = 35,71 $ ; le 1er jour 50 $ (dépassé), puis rien
    const r = joursRespectes(per, [op({ date: '2026-11-25', montant: 5000 })], budget)
    expect(r).toEqual({ respectes: 13, total: 14 })
    expect(joursRespectes(per, [], budget, '2026-11-27')).toEqual({ respectes: 3, total: 3 })
  })
  it('non affecté = paie − charges − budget', () => {
    expect(nonAffecte({ revenus: 182345, charges: 122000 }, 50000)).toBe(10345)
  })
  it('sans report : reste → épargne, dépassement → noté', () => {
    expect(affectationAutomatique(1500)).toBe('epargne')
    expect(affectationAutomatique(-1500)).toBe('aucune')
    expect(affectationAutomatique(0)).toBe('aucune')
  })
})

import { periodesAVenir } from './budget'

describe('périodes à venir', () => {
  it('revenus, charges, budget et non affecté des prochaines périodes', () => {
    const p = { ...paie, derniereEcheanceGeneree: '2026-11-17' }
    const loyer = rec({ id: 'loyer', libelle: 'Loyer', montant: 120000, jours: [1], derniereEcheanceGeneree: '2026-11-17' })
    const netflix = rec({ id: 'nf', libelle: 'Netflix', montant: 2000, jours: [5], moyenPaiement: 'carte', carteId: 'cc', derniereEcheanceGeneree: '2026-11-17' })
    const l = periodesAVenir(p, [p, loyer, netflix], [], budget, [], '2026-11-17', 4, 50000)
    expect(l.map((x) => [x.bornes.debut, x.bornes.fin, x.previsions.revenus, x.previsions.charges, x.budget, x.nonAffecte])).toEqual([
      ['2026-11-25', '2026-12-08', 180000, 122000, 50000, 8000],
      ['2026-12-09', '2026-12-22', 180000, 0, 50000, 130000],
      ['2026-12-23', '2027-01-05', 180000, 122000, 50000, 8000],
      ['2027-01-06', '2027-01-19', 180000, 0, 50000, 130000],
    ])
  })
  it('utilise le budget déjà validé d’une période future', () => {
    const per = { id: 'x', dateDebut: '2026-11-25', dateFin: '2026-12-08', enveloppeValidee: 80000, epargneMiseDeCote: 0, reportPrecedent: 0, ajouts: [], cloturee: false }
    expect(periodesAVenir(paie, [paie], [], budget, [per], '2026-11-17', 1, 50000)[0].budget).toBe(80000)
  })
  it('avant la première paie : commence à la première période', () => {
    expect(periodesAVenir(paie, [paie], [], budget, [], '2026-11-01', 1, 50000)[0].bornes.debut).toBe('2026-11-11')
  })
})

describe('crédits dans les charges de la période', () => {
  const p = { ...paie, derniereEcheanceGeneree: '2026-11-17' }
  const auto = rec({ id: 'auto', type: 'credit', libelle: 'Crédit auto', montant: 35000, jours: [28], dateFin: '2027-01-28', derniereEcheanceGeneree: '2026-11-17' })
  it('le crédit auto est déduit, jusqu’à sa dernière mensualité', () => {
    const l = periodesAVenir(p, [p, auto], [], budget, [], '2026-11-17', 6, 50000)
    expect(l.map((x) => [x.bornes.debut, x.previsions.charges])).toEqual([
      ['2026-11-25', 35000], // 28 nov
      ['2026-12-09', 0],
      ['2026-12-23', 35000], // 28 déc
      ['2027-01-06', 0],
      ['2027-01-20', 35000], // 28 janv : dernière mensualité
      ['2027-02-03', 0], // terminé
    ])
  })
  it('s’arrête quand le capital est remboursé, même avant la date de fin', () => {
    // 700 $ restants à 350 $/mois sans taux : 2 mensualités (28 nov, 28 déc)
    const presqueFini = { ...auto, dateFin: '2028-12-28', capitalRestantDu: 70000, capitalReferenceDate: '2026-11-17' }
    const l = periodesAVenir(p, [p, presqueFini], [], budget, [], '2026-11-17', 4, 50000)
    expect(l.map((x) => x.previsions.charges)).toEqual([35000, 0, 35000, 0])
  })
  it('payé par carte : déduit aussi', () => {
    const parCarte = { ...auto, moyenPaiement: 'carte' as const, carteId: 'cc' }
    expect(periodesAVenir(p, [p, parCarte], [], budget, [], '2026-11-17', 1, 50000)[0].previsions.charges).toBe(35000)
  })
})

import { depensesParFinancement, resteACote, versSecuriteEnFin } from './budget'

describe('à côté du budget', () => {
  const per: Periode = { id: 'p', dateDebut: '2026-11-25', dateFin: '2026-12-08', enveloppeValidee: 50000, epargneMiseDeCote: 15000, reportPrecedent: 0, ajouts: [], cloturee: false, aCote: 15000 }
  const chaussures = op({ date: '2026-11-27', montant: 12000, categorieId: 'sport', horsBudget: true })
  const cafe = op({ date: '2026-11-27', montant: 500 })
  it('une dépense à côté ne compte pas dans le budget du jour', () => {
    expect(depensesBudget([chaussures, cafe], budget, '2026-11-25', '2026-12-08')).toBe(500)
    const j = calculerBudgetJour(50000, [chaussures, cafe], budget, { debut: '2026-11-25', fin: '2026-12-08' }, '2026-11-28')
    expect(j.depensePeriode).toBe(500)
  })
  it('répartition par financement et reste à côté', () => {
    const garage = op({ date: '2026-11-28', montant: 30000, objectifEpargneId: 'sec' })
    expect(depensesParFinancement([chaussures, cafe, garage], budget, '2026-11-25', '2026-12-08')).toEqual({ budget: 500, aCote: 12000, epargne: 30000 })
    expect(resteACote(per, [chaussures], budget)).toBe(3000)
    expect(resteACote(per, [chaussures, op({ date: '2026-11-29', montant: 5000, horsBudget: true })], budget)).toBe(-2000)
    expect(resteACote({ ...per, aCote: undefined }, [], budget)).toBe(0)
  })
  it('fin de période : reste du budget + reste à côté vers Sécurité (jamais négatif)', () => {
    expect(versSecuriteEnFin({ enveloppe: 50000, depense: 45000, ecart: 5000 }, 3000)).toEqual({ budget: 5000, aCote: 3000 })
    expect(versSecuriteEnFin({ enveloppe: 50000, depense: 52000, ecart: -2000 }, -1000)).toEqual({ budget: 0, aCote: 0 })
  })
})
