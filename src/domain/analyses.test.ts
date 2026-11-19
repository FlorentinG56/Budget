import { describe, expect, it } from 'vitest'
import { depensesParMois, ecart, fenetre, parCategorie, resumeFenetre, sansCategorie, soldesJournaliers, topDepenses } from './analyses'
import type { Compte, Operation, Recurrence } from './types'

let n = 0
const op = (p: Partial<Operation>): Operation => ({ id: `o${n++}`, date: '2026-11-18', montant: 0, type: 'depense', compteId: 'chq', creeLe: 0, ...p })
const compte = (p: Partial<Compte>): Compte => ({ id: 'chq', nom: 'D', type: 'cheque', devise: 'CAD', couleur: '', soldeDepart: 100000, dateDepart: '2026-11-15', inclusBudgetJournalier: true, archive: false, ordre: 0, ...p })
const paie: Recurrence = { id: 'paie', type: 'revenu', libelle: 'Salaire', montant: 180000, compteId: 'chq', moyenPaiement: 'compte', frequence: '14_jours', jours: [], dateDebut: '2026-11-11', actif: true }

describe('fenêtres', () => {
  it('semaine du lundi au dimanche, navigation', () => {
    expect(fenetre('semaine', '2026-11-18', 0)).toMatchObject({ debut: '2026-11-16', fin: '2026-11-22' })
    expect(fenetre('semaine', '2026-11-22', 0)).toMatchObject({ debut: '2026-11-16', fin: '2026-11-22' }) // dimanche
    expect(fenetre('semaine', '2026-11-18', -1)).toMatchObject({ debut: '2026-11-09', fin: '2026-11-15' })
  })
  it('mois calendaire', () => {
    expect(fenetre('mois', '2026-11-18', 0)).toMatchObject({ debut: '2026-11-01', fin: '2026-11-30', libelle: 'Novembre 2026' })
    expect(fenetre('mois', '2026-11-18', -11)).toMatchObject({ debut: '2025-12-01', fin: '2025-12-31' })
  })
  it('période de paie, avant et après', () => {
    expect(fenetre('paie', '2026-11-18', 0, paie)).toMatchObject({ debut: '2026-11-11', fin: '2026-11-24' })
    expect(fenetre('paie', '2026-11-18', 1, paie)).toMatchObject({ debut: '2026-11-25', fin: '2026-12-08' })
    expect(fenetre('paie', '2026-11-30', -1, paie)).toMatchObject({ debut: '2026-11-11', fin: '2026-11-24' })
    expect(fenetre('paie', '2026-11-18', -1, paie)).toBeUndefined() // avant la première paie connue
    expect(fenetre('paie', '2026-11-18', 0)).toBeUndefined()
  })
})

describe('soldes jour par jour', () => {
  it('solde de fin de journée, jusqu’à aujourd’hui', () => {
    const ops = [op({ date: '2026-11-16', montant: 2000 }), op({ date: '2026-11-17', type: 'revenu', montant: 50000 }), op({ date: '2026-11-19', montant: 999 })]
    const pts = soldesJournaliers([compte({})], ops, { debut: '2026-11-16', fin: '2026-11-22' }, '2026-11-18')
    expect(pts.map((p) => [p.date, p.reel])).toEqual([['2026-11-16', 98000], ['2026-11-17', 148000], ['2026-11-18', 148000]])
  })
  it('commence à la date de départ du compte (pas de double comptage du solde de départ)', () => {
    const pts = soldesJournaliers([compte({ dateDepart: '2026-11-18' })], [op({ date: '2026-11-18', montant: 500 })], { debut: '2026-11-16', fin: '2026-11-22' }, '2026-11-19')
    expect(pts.map((p) => [p.date, p.reel])).toEqual([['2026-11-18', 99500], ['2026-11-19', 99500]])
  })
  it('additionne compte chèque et carte (solde après remboursement)', () => {
    const carte = compte({ id: 'cc', type: 'carte_credit', soldeDepart: -10000 })
    const ops = [op({ date: '2026-11-16', compteId: 'cc', montant: 3000 }), op({ date: '2026-11-17', type: 'remboursement_carte', compteId: 'chq', compteDestinationId: 'cc', montant: 13000 })]
    const pts = soldesJournaliers([compte({}), carte], ops, { debut: '2026-11-16', fin: '2026-11-17' }, '2026-11-30')
    expect(pts.map((p) => p.reel)).toEqual([87000, 87000]) // le remboursement ne change pas le total
  })
})

describe('résumé et catégories', () => {
  const ops = [
    op({ date: '2026-11-12', type: 'revenu', montant: 180000 }),
    op({ date: '2026-11-13', type: 'prelevement_fixe', montant: 120000, categorieId: 'logement', sousCategorieId: 'logement/loyer' }),
    op({ date: '2026-11-14', montant: 3000, categorieId: 'alim', sousCategorieId: 'alim/epicerie' }),
    op({ date: '2026-11-15', montant: 1000, categorieId: 'alim', sousCategorieId: 'alim/resto' }),
    op({ date: '2026-11-16', montant: 500, categorieId: 'alim', sousCategorieId: 'alim/epicerie' }),
    op({ date: '2026-11-16', type: 'virement', compteDestinationId: 'ca', montant: 99999 }),
    op({ date: '2026-11-16', type: 'ajustement', montant: -777 }),
    op({ date: '2026-11-02', montant: 2000, categorieId: 'alim', sousCategorieId: 'alim/resto' }), // période précédente
  ]
  const f = { debut: '2026-11-11', fin: '2026-11-24' }
  const avant = { debut: '2026-10-28', fin: '2026-11-10' }
  it('résumé : revenus, charges fixes, dépenses, épargne (virements et ajustements exclus)', () => {
    const ep = compte({ id: 'ep', type: 'epargne', dateDepart: '2026-11-01' })
    const versEpargne = [
      op({ date: '2026-11-12', type: 'virement', compteDestinationId: 'ep', montant: 10000 }),
      op({ date: '2026-11-14', type: 'virement', compteId: 'ep', compteDestinationId: 'chq', montant: 2500 }),
      op({ date: '2026-10-01', type: 'virement', compteDestinationId: 'ep', montant: 1 }), // hors fenêtre
    ]
    const r = resumeFenetre([compte({ dateDepart: '2026-11-01' })], [...ops, ...versEpargne], [compte({}), ep], f, '2026-11-30')
    expect(r).toEqual({ revenus: 180000, chargesFixes: 120000, depensesQuotidien: 4500, epargne: 7500, soldeFin: 100000 + 180000 - 120000 - 4500 - 99999 - 777 - 2000 - 7500 })
  })
  it('par catégorie, charges fixes incluses ou non, comparaison', () => {
    const avec = parCategorie(ops, new Set(['chq']), f, avant, { chargesFixes: true })
    expect(avec.map((l) => [l.id, l.montant, l.precedent])).toEqual([['logement', 120000, 0], ['alim', 4500, 2000]])
    const sans = parCategorie(ops, new Set(['chq']), f, avant, { chargesFixes: false })
    expect(sans.map((l) => [l.id, l.montant, l.part])).toEqual([['alim', 4500, 1]])
  })
  it('détail par sous-catégorie', () => {
    const l = parCategorie(ops, new Set(['chq']), f, avant, { chargesFixes: false, categorie: 'alim' })
    expect(l.map((x) => [x.id, x.montant, x.precedent])).toEqual([['alim/epicerie', 3500, 0], ['alim/resto', 1000, 2000]])
  })
})

describe('tâche B : moyenne, mois par mois, top, à classer', () => {
  const f = { debut: '2026-11-01', fin: '2026-11-30' }
  const p1 = { debut: '2026-10-01', fin: '2026-10-31' }, p2 = { debut: '2026-09-01', fin: '2026-09-30' }, p3 = { debut: '2026-08-01', fin: '2026-08-31' }
  const ops = [
    op({ date: '2026-11-05', montant: 30000, categorieId: 'alim' }),
    op({ date: '2026-10-05', montant: 20000, categorieId: 'alim' }),
    op({ date: '2026-09-05', montant: 25000, categorieId: 'alim' }),
    op({ date: '2026-08-05', montant: 15000, categorieId: 'alim' }), op({ date: '2026-08-06', montant: 6000, categorieId: 'loisirs' }),
    op({ date: '2026-07-05', montant: 99999, categorieId: 'alim' }), // 4e mois avant : hors moyenne
  ]
  it('moyenne des 3 périodes précédentes, en plus de la précédente', () => {
    const l = parCategorie(ops, new Set(['chq']), f, [p1, p2, p3], { chargesFixes: false })
    expect(l.map((x) => [x.id, x.montant, x.precedent, x.moyenne])).toEqual([['alim', 30000, 20000, 20000], ['loisirs', 0, 0, 2000]])
  })
  it('moyenne sur les seules périodes qui existent ; aucune si pas de période précédente', () => {
    expect(parCategorie(ops, new Set(['chq']), f, [p1, undefined, undefined], { chargesFixes: false })[0].moyenne).toBe(20000)
    expect(parCategorie(ops, new Set(['chq']), f, [], { chargesFixes: false })[0].moyenne).toBeUndefined()
  })
  it('écart en montant et en %', () => {
    expect(ecart(30000, 20000)).toEqual({ montant: 10000, pourcent: 50 })
    expect(ecart(1000, 0)).toEqual({ montant: 1000, pourcent: undefined })
  })
  it('dépenses du quotidien mois par mois (charges fixes exclues)', () => {
    const m = depensesParMois([...ops, op({ date: '2026-11-01', type: 'prelevement_fixe', montant: 120000 })], new Set(['chq']), '2026-11-18', 6)
    expect(m.map((x) => [x.debut, x.montant, x.decalage])).toEqual([
      ['2026-06-01', 0, -5], ['2026-07-01', 99999, -4], ['2026-08-01', 21000, -3], ['2026-09-01', 25000, -2], ['2026-10-01', 20000, -1], ['2026-11-01', 30000, 0],
    ])
    expect(m[5].libelle).toBe('nov')
  })
  it('top des plus grosses dépenses et dépenses à classer', () => {
    const l = [op({ id: 'a', date: '2026-11-02', montant: 500 }), op({ id: 'b', date: '2026-11-03', montant: 8000, categorieId: 'x' }), op({ id: 'c', date: '2026-11-04', montant: 1200 }),
      op({ id: 'd', date: '2026-10-30', montant: 99999 }), op({ id: 'e', date: '2026-11-04', montant: 99999, type: 'revenu' })]
    expect(topDepenses(l, new Set(['chq']), f, 2).map((o) => o.id)).toEqual(['b', 'c'])
    expect(sansCategorie(l, new Set(['chq']), f).map((o) => o.id)).toEqual(['c', 'a'])
  })
})
