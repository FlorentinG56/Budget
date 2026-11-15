import { describe, expect, it } from 'vitest'
import {
  appliquerMensualite, capitalRestant, echeanceARattacher, echeancesEnAttente, dateDuMois, echeancesAGenerer, echeancesEntre, equivalentMensuel,
  genererOperations, libelleFrequence, mensualitesRestantes, progressionCredit,
} from './recurrences'
import type { Operation, Recurrence } from './types'

const rec = (p: Partial<Recurrence>): Recurrence => ({
  id: 'r1', type: 'charge_fixe', libelle: 'Loyer', montant: 120000, compteId: 'chq', moyenPaiement: 'compte',
  frequence: 'mensuel', jours: [1], dateDebut: '2026-01-01', actif: true, ...p,
})
let n = 0
const id = () => `g${n++}`

describe('dateDuMois', () => {
  it('ramène le 31 au dernier jour des mois courts', () => {
    expect(dateDuMois(2026, 1, 31)).toBe('2026-02-28')
    expect(dateDuMois(2028, 1, 31)).toBe('2028-02-29')
    expect(dateDuMois(2026, 3, 31)).toBe('2026-04-30')
    expect(dateDuMois(2026, 0, 31)).toBe('2026-01-31')
  })
})

describe('echeancesEntre', () => {
  it('mensuel', () => {
    expect(echeancesEntre(rec({ jours: [5] }), '2026-11-01', '2027-01-31')).toEqual(['2026-11-05', '2026-12-05', '2027-01-05'])
  })
  it('mensuel le 31', () => {
    expect(echeancesEntre(rec({ jours: [31] }), '2027-01-01', '2027-04-30')).toEqual(['2027-01-31', '2027-02-28', '2027-03-31', '2027-04-30'])
  })
  it('toutes les 2 semaines à partir de la date de référence', () => {
    const paie = rec({ frequence: '14_jours', dateDebut: '2026-11-11', jours: [] })
    expect(echeancesEntre(paie, '2026-11-01', '2027-01-10')).toEqual(['2026-11-11', '2026-11-25', '2026-12-09', '2026-12-23', '2027-01-06'])
    expect(echeancesEntre(paie, '2026-11-12', '2026-12-09')).toEqual(['2026-11-25', '2026-12-09'])
  })
  it('14 jours : pas de décalage au changement d’heure', () => {
    const paie = rec({ frequence: '14_jours', dateDebut: '2026-03-01', jours: [] })
    expect(echeancesEntre(paie, '2026-03-01', '2026-04-01')).toEqual(['2026-03-01', '2026-03-15', '2026-03-29'])
  })
  it('deux dates par mois, dont le dernier jour', () => {
    const r = rec({ frequence: 'deux_dates_par_mois', jours: [15, 31] })
    expect(echeancesEntre(r, '2027-02-01', '2027-03-31')).toEqual(['2027-02-15', '2027-02-28', '2027-03-15', '2027-03-31'])
  })
  it('respecte les dates de début et de fin', () => {
    const r = rec({ jours: [10], dateDebut: '2026-11-15', dateFin: '2027-01-09' })
    expect(echeancesEntre(r, '2026-10-01', '2027-06-01')).toEqual(['2026-12-10'])
  })
  it('passe l’année', () => {
    expect(echeancesEntre(rec({ jours: [1] }), '2026-12-01', '2027-02-01')).toEqual(['2026-12-01', '2027-01-01', '2027-02-01'])
  })
})

describe('rattrapage', () => {
  it('rattrape toutes les échéances depuis la dernière générée', () => {
    expect(echeancesAGenerer(rec({ jours: [1], derniereEcheanceGeneree: '2026-08-01' }), '2026-11-15')).toEqual(['2026-09-01', '2026-10-01', '2026-11-01'])
  })
  it('rien si déjà à jour ou en pause', () => {
    expect(echeancesAGenerer(rec({ derniereEcheanceGeneree: '2026-11-14' }), '2026-11-15')).toEqual([])
    expect(echeancesAGenerer(rec({ actif: false, derniereEcheanceGeneree: '2026-01-01' }), '2026-11-15')).toEqual([])
  })
  it('génère l’échéance du jour même', () => {
    expect(echeancesAGenerer(rec({ jours: [15], derniereEcheanceGeneree: '2026-11-14' }), '2026-11-15')).toEqual(['2026-11-15'])
  })
})

describe('crédits', () => {
  it('sans taux : le capital baisse de la mensualité', () => {
    expect(appliquerMensualite(100000, 30000)).toEqual({ interets: 0, partCapital: 30000, capitalApres: 70000 })
  })
  it('avec taux : intérêts du mois déduits', () => {
    // 10 000 $ à 6 % : 50 $ d'intérêts, mensualité 300 $ → 250 $ de capital
    expect(appliquerMensualite(1000000, 30000, 6)).toEqual({ interets: 5000, partCapital: 25000, capitalApres: 975000 })
  })
  it('jamais sous zéro', () => {
    expect(appliquerMensualite(10000, 30000).capitalApres).toBe(0)
  })
  it('capital restant = référence − parts capital prélevées après la référence', () => {
    const credit = rec({ type: 'credit', capitalRestantDu: 500000, capitalReferenceDate: '2026-11-15' })
    const ops = [
      { recurrenceId: 'r1', date: '2026-11-15', partCapital: 9999 }, // le jour de référence : déjà inclus
      { recurrenceId: 'r1', date: '2026-12-01', partCapital: 30000 },
      { recurrenceId: 'autre', date: '2026-12-01', partCapital: 30000 },
    ] as Operation[]
    expect(capitalRestant(credit, ops)).toBe(470000)
  })
  it('mensualités restantes : date de fin ou simulation', () => {
    const credit = rec({ type: 'credit', jours: [15], dateFin: '2027-04-15', montant: 30000 })
    expect(mensualitesRestantes(credit, undefined, '2026-11-15')).toBe(5)
    expect(mensualitesRestantes(credit, 60000, '2026-11-15')).toBe(2)
    expect(mensualitesRestantes(rec({ type: 'credit', montant: 30000 }), 100000, '2026-11-15')).toBe(4)
    // plus de 50 ans de mensualités, ou mensualité qui ne couvre pas les intérêts : inconnu
    expect(mensualitesRestantes(rec({ type: 'credit', montant: 1000 }), 10000000, '2026-11-15')).toBeUndefined()
    expect(mensualitesRestantes(rec({ type: 'credit', montant: 1000, tauxAnnuel: 12 }), 200000, '2026-11-15')).toBeUndefined()
  })
  it('progression', () => {
    expect(progressionCredit(1000000, 250000)).toBe(0.75)
    expect(progressionCredit(undefined, 250000)).toBeUndefined()
  })
})

describe('genererOperations', () => {
  it('charge fixe prélevée sur le compte', () => {
    const { operations, traiteeJusquAu } = genererOperations(rec({ derniereEcheanceGeneree: '2026-09-15', categorieId: 'logement' }), '2026-11-15', [], id, 1)
    expect(operations.map((o) => [o.date, o.type, o.compteId, o.montant, o.note, o.categorieId])).toEqual([
      ['2026-10-01', 'prelevement_fixe', 'chq', 120000, 'Loyer', 'logement'],
      ['2026-11-01', 'prelevement_fixe', 'chq', 120000, 'Loyer', 'logement'],
    ])
    expect(traiteeJusquAu).toBe('2026-11-01')
  })
  it('charge fixe payée par carte : sur la carte', () => {
    const r = rec({ moyenPaiement: 'carte', carteId: 'carte', derniereEcheanceGeneree: '2026-10-15' })
    expect(genererOperations(r, '2026-11-15', [], id, 1).operations[0].compteId).toBe('carte')
  })
  it('revenu tous les 14 jours', () => {
    const paie = rec({ type: 'revenu', libelle: 'Salaire', montant: 180000, frequence: '14_jours', dateDebut: '2026-11-11', jours: [], derniereEcheanceGeneree: '2026-11-11' })
    const { operations } = genererOperations(paie, '2026-12-10', [], id, 1)
    expect(operations.map((o) => [o.date, o.type])).toEqual([['2026-11-25', 'revenu'], ['2026-12-09', 'revenu']])
  })
  it('crédit : part capital par échéance, arrêt quand remboursé', () => {
    const credit = rec({ type: 'credit', montant: 30000, capitalRestantDu: 70000, capitalReferenceDate: '2026-07-31', derniereEcheanceGeneree: '2026-07-31' })
    const { operations, traiteeJusquAu } = genererOperations(credit, '2026-12-15', [], id, 1)
    expect(operations.map((o) => o.partCapital)).toEqual([30000, 30000, 10000])
    expect(traiteeJusquAu).toBe('2026-12-01')
  })
  it('rien à générer', () => {
    expect(genererOperations(rec({ derniereEcheanceGeneree: '2026-11-15' }), '2026-11-15', [], id, 1)).toEqual({ operations: [] })
  })
})

describe('affichage', () => {
  it('équivalent mensuel', () => {
    expect(equivalentMensuel({ frequence: '14_jours', montant: 120000 })).toBe(260000)
    expect(equivalentMensuel({ frequence: 'deux_dates_par_mois', montant: 1000 })).toBe(2000)
  })
  it('libellé de fréquence', () => {
    expect(libelleFrequence({ frequence: 'mensuel', jours: [1] })).toBe('Le 1er du mois')
    expect(libelleFrequence({ frequence: 'mensuel', jours: [31] })).toBe('Le dernier jour du mois')
    expect(libelleFrequence({ frequence: 'deux_dates_par_mois', jours: [15, 31] })).toBe('Le 15 et le dernier jour')
  })
})

describe('montants à confirmer', () => {
  const paie = rec({ id: 'paie', type: 'revenu', libelle: 'Salaire', montant: 180000, frequence: '14_jours', jours: [], dateDebut: '2026-11-11', aConfirmer: true, derniereEcheanceGeneree: '2026-11-15' })
  it('rien n’est généré automatiquement', () => {
    expect(genererOperations(paie, '2026-12-31', [], id, 1)).toEqual({ operations: [] })
  })
  it('liste les échéances arrivées non confirmées', () => {
    expect(echeancesEnAttente([paie], '2026-11-24')).toEqual([])
    expect(echeancesEnAttente([paie], '2026-11-25').map((e) => e.date)).toEqual(['2026-11-25'])
    expect(echeancesEnAttente([paie], '2026-12-10').map((e) => e.date)).toEqual(['2026-11-25', '2026-12-09'])
    expect(echeancesEnAttente([{ ...paie, derniereEcheanceGeneree: '2026-11-25' }], '2026-12-01')).toEqual([])
    expect(echeancesEnAttente([{ ...paie, actif: false }], '2026-12-10')).toEqual([])
  })
  it('rattache une paie saisie à la main, même en avance', () => {
    expect(echeanceARattacher([paie], 'chq', '2026-11-24')?.date).toBe('2026-11-25')
    expect(echeanceARattacher([paie], 'chq', '2026-11-27')?.date).toBe('2026-11-25')
    expect(echeanceARattacher([paie], 'activite', '2026-11-25')).toBeUndefined()
    expect(echeanceARattacher([paie], 'chq', '2026-11-17')).toBeUndefined()
    expect(echeanceARattacher([{ ...paie, derniereEcheanceGeneree: '2026-11-25' }], 'chq', '2026-11-26')).toBeUndefined()
  })
})
