import { describe, expect, it } from 'vitest'
import { prelevesCeMois, prochaineCharge, prochaineDate, resteAPreleverCeMois, totalMensuel, trier } from './charges'
import type { Categorie, Operation, Recurrence } from './types'

const rec = (p: Partial<Recurrence>): Recurrence => ({
  id: 'r', type: 'charge_fixe', libelle: 'X', montant: 0, compteId: 'chq', moyenPaiement: 'compte', frequence: 'mensuel', jours: [1], dateDebut: '2026-01-01', actif: true, derniereEcheanceGeneree: '2026-11-17', ...p,
})
const loyer = rec({ id: 'loyer', libelle: 'Loyer', montant: 120000, jours: [1], categorieId: 'logement' })
const netflix = rec({ id: 'nf', libelle: 'Netflix', montant: 2000, jours: [20], categorieId: 'abonnements' })
const auto = rec({ id: 'auto', type: 'credit', libelle: 'Crédit auto', montant: 35000, jours: [28] })
const gym = rec({ id: 'gym', libelle: 'Gym', montant: 5000, jours: [10], actif: false })
const cats = new Map([['logement', { nom: 'Logement' }], ['abonnements', { nom: 'Abonnements' }]] as [string, Categorie][])
const ids = (l: Recurrence[]) => l.map((r) => r.id)

describe('tri des charges', () => {
  const l = [netflix, gym, auto, loyer]
  it('par jour, prochain, montant, nom, catégorie (en pause à la fin)', () => {
    expect(ids(trier(l, 'jour', '2026-11-17', cats))).toEqual(['loyer', 'nf', 'auto', 'gym'])
    expect(ids(trier(l, 'prochain', '2026-11-17', cats))).toEqual(['nf', 'auto', 'loyer', 'gym']) // 20 nov, 28 nov, 1er déc
    expect(ids(trier(l, 'montant_desc', '2026-11-17', cats))).toEqual(['loyer', 'auto', 'nf', 'gym'])
    expect(ids(trier(l, 'montant_asc', '2026-11-17', cats))).toEqual(['nf', 'auto', 'loyer', 'gym'])
    expect(ids(trier(l, 'nom', '2026-11-17', cats))).toEqual(['auto', 'loyer', 'nf', 'gym'])
    expect(ids(trier(l, 'categorie', '2026-11-17', cats))).toEqual(['nf', 'loyer', 'auto', 'gym']) // Abonnements, Logement, sans
  })
  it('prochaine date : aujourd’hui si pas encore traitée', () => {
    expect(prochaineDate(rec({ jours: [17], derniereEcheanceGeneree: '2026-11-16' }), '2026-11-17')).toBe('2026-11-17')
    expect(prochaineDate(rec({ jours: [17], derniereEcheanceGeneree: '2026-11-17' }), '2026-11-17')).toBe('2026-12-17')
    expect(prochaineDate(gym, '2026-11-17')).toBeUndefined()
  })
})

describe('totaux', () => {
  it('total mensuel (actives seulement)', () => {
    expect(totalMensuel([loyer, netflix, auto, gym])).toBe(157000)
  })
  it('déjà prélevé et reste à prélever ce mois', () => {
    const ops = [
      { id: 'a', date: '2026-11-01', montant: 120000, type: 'prelevement_fixe', compteId: 'chq', recurrenceId: 'loyer', creeLe: 0 },
      { id: 'b', date: '2026-10-28', montant: 35000, type: 'prelevement_fixe', compteId: 'chq', recurrenceId: 'auto', creeLe: 0 },
    ] as Operation[]
    expect(prelevesCeMois([loyer, netflix, auto], ops, '2026-11-17')).toBe(120000)
    expect(resteAPreleverCeMois([loyer, netflix, auto, gym], ops, '2026-11-17')).toBe(2000 + 35000) // Netflix 20, auto 28
  })
  it('prochaine charge', () => {
    expect(prochaineCharge([loyer, netflix, auto, gym], '2026-11-17')).toEqual({ recurrence: netflix, date: '2026-11-20' })
  })
})
