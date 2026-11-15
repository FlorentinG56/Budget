import { describe, expect, it } from 'vitest'
import { trierParUsage } from './categories'
import { libelleJour } from './dates'
import { filtrerOperations, grouperParJour, trierRecentes } from './operations'
import type { Categorie, Operation } from './types'

let n = 0
const op = (p: Partial<Operation>): Operation => ({ id: `o${n++}`, date: '2026-11-10', montant: 100, type: 'depense', compteId: 'chq', creeLe: n, ...p })
const cat = (id: string, ordre: number, p: Partial<Categorie> = {}): Categorie => ({ id, nom: id, icone: '', couleur: '', ordre, archivee: false, ...p })

describe('filtrerOperations', () => {
  const ops = [
    op({ id: 'a', compteId: 'chq', categorieId: 'alim', date: '2026-11-01' }),
    op({ id: 'b', compteId: 'cc', categorieId: 'transport', date: '2026-11-12' }),
    op({ id: 'c', type: 'virement', compteId: 'ca', compteDestinationId: 'chq', date: '2026-11-15' }),
  ]
  const ids = (l: Operation[]) => l.map((o) => o.id)
  it('par compte, y compris comme destinataire', () => expect(ids(filtrerOperations(ops, { compteId: 'chq' }))).toEqual(['a', 'c']))
  it('par catégorie', () => expect(ids(filtrerOperations(ops, { categorieId: 'transport' }))).toEqual(['b']))
  it('par période (bornes incluses)', () => expect(ids(filtrerOperations(ops, { du: '2026-11-12', au: '2026-11-15' }))).toEqual(['b', 'c']))
})

describe('tri et regroupement', () => {
  it('plus récentes d’abord, puis par heure de saisie', () => {
    const l = trierRecentes([op({ id: 'x', date: '2026-11-01', creeLe: 5 }), op({ id: 'y', date: '2026-11-03', creeLe: 1 }), op({ id: 'z', date: '2026-11-03', creeLe: 9 })])
    expect(l.map((o) => o.id)).toEqual(['z', 'y', 'x'])
  })
  it('regroupe par jour', () => {
    const g = grouperParJour([op({ date: '2026-11-01' }), op({ date: '2026-11-03' }), op({ date: '2026-11-03' })])
    expect(g.map((x) => [x.date, x.operations.length])).toEqual([['2026-11-03', 2], ['2026-11-01', 1]])
  })
})

describe('trierParUsage', () => {
  const cats = [cat('alim', 0), cat('transport', 1), cat('loisirs', 2), cat('epicerie', 0, { parentId: 'alim' }), cat('vieux', 3, { archivee: true })]
  it('met les plus utilisées en premier, sans sous-catégories ni archivées', () => {
    const ops = [op({ categorieId: 'loisirs' }), op({ categorieId: 'loisirs' }), op({ categorieId: 'transport' }), op({ type: 'revenu', categorieId: 'alim' })]
    expect(trierParUsage(cats, ops).map((c) => c.id)).toEqual(['loisirs', 'transport', 'alim'])
  })
  it('garde l’ordre défini sans historique', () => {
    expect(trierParUsage(cats, []).map((c) => c.id)).toEqual(['alim', 'transport', 'loisirs'])
  })
  it('peut ignorer les opérations anciennes', () => {
    expect(trierParUsage(cats, [op({ categorieId: 'loisirs', date: '2026-01-01' })], '2026-08-01').map((c) => c.id)[0]).toBe('alim')
  })
})

describe('libelleJour', () => {
  it('affiche Aujourd’hui, Hier ou la date', () => {
    expect(libelleJour('2026-11-15', '2026-11-15')).toBe('Aujourd’hui')
    expect(libelleJour('2026-11-14', '2026-11-15')).toBe('Hier')
    expect(libelleJour('2026-11-11', '2026-11-15')).toBe('Mercredi 11 novembre')
    expect(libelleJour('2025-12-01', '2026-11-15')).toBe('Lundi 1 décembre 2025')
  })
  it('gère le passage de mois pour « hier »', () => {
    expect(libelleJour('2026-10-31', '2026-11-01')).toBe('Hier')
  })
})
