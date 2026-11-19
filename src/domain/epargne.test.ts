import { describe, expect, it } from 'vitest'
import { depensesBudget } from './budget'
import { champsImprevu, choixImprevu, disponible, epargneNonRepartie, epargneReservee, estImprevu, historiqueObjectif, objectifsAConvertir, parMoisPourAtteindre, partDuSolde, progressionObjectif, projetsEpargne, repartirFinQuinzaine, resteFinQuinzaine, soldeObjectif, totalEpargne, totalParDevise, type ChoixImprevu } from './epargne'
import type { Compte, ObjectifEpargne, Operation } from './types'

const obj = (p: Partial<ObjectifEpargne>): ObjectifEpargne => ({ id: 'sec', nom: 'Sécurité', compteId: 'chq', mouvements: [], archive: false, ...p })
const mv = (montant: number, sens: 'mise_de_cote' | 'reprise' = 'mise_de_cote', p = {}) => ({ id: `m${montant}${sens}`, date: '2026-11-25', montant, sens, ...p })
const op = (p: Partial<Operation>): Operation => ({ id: 'o', date: '2026-11-26', montant: 0, type: 'depense', compteId: 'chq', creeLe: 0, ...p })

describe('épargne virtuelle', () => {
  const securite = obj({ mouvements: [mv(10345, 'mise_de_cote', { source: 'paie:p-2026-11-25' }), mv(47750, 'mise_de_cote', { source: 'bilan:p-2026-11-11' }), mv(5000, 'reprise')] })
  const imprevu = op({ id: 'garage', montant: 20000, objectifEpargneId: 'sec', note: 'Garage' })

  it('solde : mises de côté − reprises − dépenses payées avec l’épargne', () => {
    expect(soldeObjectif(securite, [])).toBe(53095)
    expect(soldeObjectif(securite, [imprevu])).toBe(33095)
  })
  it('une dépense payée avec l’épargne ne compte pas dans le budget du jour', () => {
    expect(depensesBudget([imprevu, op({ id: 'cafe', montant: 500 })], new Set(['chq']), '2026-11-25', '2026-12-08')).toBe(500)
  })
  it('réservé par compte, total par devise', () => {
    const france = obj({ id: 'fr', nom: 'Épargne', compteId: 'ca', mouvements: [mv(500000)] })
    const archive = obj({ id: 'old', compteId: 'chq', mouvements: [mv(99999)], archive: true })
    const comptes = [{ id: 'chq', devise: 'CAD' }, { id: 'ca', devise: 'EUR' }] as Compte[]
    expect(epargneReservee([securite, france, archive], [imprevu], 'chq')).toBe(33095)
    expect([...totalParDevise([securite, france, archive], [imprevu], comptes)]).toEqual([['CAD', 33095], ['EUR', 500000]])
    expect([...totalParDevise([france, securite], [], comptes)].map(([d]) => d)).toEqual(['CAD', 'EUR']) // ordre stable
  })
  it('progression et montant par mois pour atteindre la cible', () => {
    expect(progressionObjectif(25000, 100000)).toBe(0.25)
    expect(progressionObjectif(25000)).toBeUndefined()
    expect(parMoisPourAtteindre(25000, 100000, '2027-05-15', '2026-11-17')).toBe(12500) // 750 $ sur 6 mois
    expect(parMoisPourAtteindre(100000, 100000, '2027-05-15', '2026-11-17')).toBeUndefined()
    expect(parMoisPourAtteindre(0, 100000, '2026-11-30', '2026-11-17')).toBe(100000) // moins d'un mois : tout
  })
  it('historique : mouvements et dépenses, le plus récent d’abord', () => {
    const h = historiqueObjectif(securite, [imprevu])
    expect(h.map((l) => [l.libelle, l.montant])).toEqual([
      ['Garage', -20000], ['Mis de côté à la paie', 10345], ['Reste de la période', 47750], ['Repris', -5000],
    ])
  })
})

describe('sécurité et épargne réelle', () => {
  const cpt = (p: Partial<Compte>): Compte => ({ id: 'chq', nom: 'Compte', type: 'cheque', devise: 'CAD', couleur: '', soldeDepart: 0, dateDepart: '2026-01-01', inclusBudgetJournalier: true, archive: false, ordre: 0, ...p })
  const comptes = [cpt({}), cpt({ id: 'ep', type: 'epargne', soldeDepart: 100000 }), cpt({ id: 'ep-eur', type: 'epargne', devise: 'EUR', soldeDepart: 5000 }), cpt({ id: 'vieux', type: 'epargne', archive: true, soldeDepart: 999 })]

  it('total épargné : solde réel des comptes épargne, par devise', () => {
    const ops = [op({ type: 'virement', compteId: 'chq', compteDestinationId: 'ep', montant: 25000, date: '2026-11-20' })]
    expect([...totalEpargne(comptes, ops, '2026-11-30')]).toEqual([['CAD', 125000], ['EUR', 5000]])
    expect([...totalEpargne(comptes, ops, '2026-11-19')]).toEqual([['CAD', 100000], ['EUR', 5000]])
    expect(totalEpargne([cpt({})], [], '2026-11-30').size).toBe(0)
  })

  it('projets : seulement sur un compte épargne ; le non réparti = total − projets', () => {
    const ps5 = obj({ id: 'ps5', nom: 'PS5', compteId: 'ep', mouvements: [mv(30000)] })
    const fini = obj({ id: 'fini', nom: 'Vélo', compteId: 'ep', archive: true, mouvements: [mv(50000)] })
    const ancien = obj({ id: 'anc', nom: 'Voyage', compteId: 'chq', mouvements: [mv(1000)] })
    expect(projetsEpargne([ps5, fini, ancien], comptes).map((o) => o.id)).toEqual(['ps5'])
    // un imprévu payé avec ce projet le réduit
    const ops = [op({ id: 'i', montant: 5000, objectifEpargneId: 'ps5', epargneCompteId: 'ep' })]
    expect([...epargneNonRepartie(comptes, [ps5, fini, ancien], ops, '2026-11-30')]).toEqual([['CAD', 100000 - 25000], ['EUR', 5000]])
  })

  it('disponible et reste de fin de quinzaine : solde − dû carte − sécurité', () => {
    expect(disponible(90000, 30000, 20000)).toBe(40000) // 900 − 300 − 200 = 400
    expect(disponible(90000, -500, 20000)).toBe(70000) // carte créditrice : rien à déduire
    expect(resteFinQuinzaine(50000, 40000, 20000)).toBe(-10000)
  })

  it('répartition de fin de quinzaine', () => {
    expect(repartirFinQuinzaine(40000, 15000, true)).toEqual({ epargne: 15000, securite: 25000 })
    expect(repartirFinQuinzaine(40000, 99999, true)).toEqual({ epargne: 40000, securite: 0 })
    expect(repartirFinQuinzaine(40000, -5, true)).toEqual({ epargne: 0, securite: 40000 })
    expect(repartirFinQuinzaine(40000, 15000, false)).toEqual({ epargne: 0, securite: 40000 }) // pas de compte épargne
    expect(repartirFinQuinzaine(-100, 15000, true)).toEqual({ epargne: 0, securite: 0 })
    expect(repartirFinQuinzaine(0, 0, true)).toEqual({ epargne: 0, securite: 0 })
  })

  it('part du solde que représente la sécurité', () => {
    expect(partDuSolde(25000, 50000)).toBe(0.5)
    expect(partDuSolde(60000, 50000)).toBe(1)
    expect(partDuSolde(0, 50000)).toBe(0)
    expect(partDuSolde(100, -20)).toBe(1)
    expect(partDuSolde(0, 0)).toBe(0)
  })

  it('solde d’un objectif à une date', () => {
    const o = obj({ mouvements: [mv(1000, 'mise_de_cote', { date: '2026-11-10', id: 'a' }), mv(500, 'mise_de_cote', { date: '2026-11-20', id: 'b' })] })
    const ops = [op({ date: '2026-11-15', montant: 200, objectifEpargneId: 'sec' })]
    expect(soldeObjectif(o, ops, '2026-11-12')).toBe(1000)
    expect(soldeObjectif(o, ops, '2026-11-15')).toBe(800)
    expect(soldeObjectif(o, ops)).toBe(1300)
  })

  it('anciens objectifs à convertir : hors Sécurité, hors compte épargne, non archivés', () => {
    const liste = [obj({}), obj({ id: 'a', compteId: 'chq' }), obj({ id: 'b', compteId: 'ep' }), obj({ id: 'c', compteId: 'chq', archive: true })]
    expect(objectifsAConvertir(liste, comptes, 'sec').map((o) => o.id)).toEqual(['a'])
  })

  it('imprévu « Payé comment ? » : aller-retour entre le choix et les champs de la dépense', () => {
    const cas: [ChoixImprevu, Partial<Operation>][] = [
      ['', {}], ['solde', { horsBudget: true }], ['securite', { objectifEpargneId: 'sec' }],
      ['epargne', { epargneCompteId: 'ep' }], ['projet:ps5', { epargneCompteId: 'ep', objectifEpargneId: 'ps5' }], ['objectif:anc', { objectifEpargneId: 'anc' }],
    ]
    for (const [choix, champs] of cas) {
      const c = champsImprevu(choix, 'sec', 'ep')
      expect(Object.fromEntries(Object.entries(c).filter(([, v]) => v !== undefined))).toEqual(champs)
      const o = op({ ...c })
      expect(choixImprevu(o, 'sec')).toBe(choix)
      expect(estImprevu(o)).toBe(choix !== '')
      // hors budget du jour, quel que soit le moyen
      expect(depensesBudget([op({ ...c, montant: 1000 })], new Set(['chq']), '2026-11-01', '2026-11-30')).toBe(choix === '' ? 1000 : 0)
    }
    expect(champsImprevu('epargne', 'sec', undefined)).toEqual({ horsBudget: undefined, objectifEpargneId: undefined, epargneCompteId: undefined })
  })
})
