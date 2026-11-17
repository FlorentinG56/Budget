import { describe, expect, it } from 'vitest'
import { fenetre, parCategorie, resumeFenetre, soldesJournaliers } from './analyses'
import type { Compte, ObjectifEpargne, Operation, Recurrence } from './types'

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
    const sec: ObjectifEpargne = { id: 's', nom: 'S', compteId: 'chq', archive: false, mouvements: [
      { id: 'a', date: '2026-11-12', montant: 10000, sens: 'mise_de_cote' }, { id: 'b', date: '2026-11-14', montant: 2500, sens: 'reprise' }, { id: 'c', date: '2026-10-01', montant: 1, sens: 'mise_de_cote' },
    ] }
    const r = resumeFenetre([compte({ dateDepart: '2026-11-01' })], ops, [sec], f, '2026-11-30')
    expect(r).toEqual({ revenus: 180000, chargesFixes: 120000, depensesQuotidien: 4500, epargne: 7500, soldeFin: 100000 + 180000 - 120000 - 4500 - 99999 - 777 - 2000 })
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
