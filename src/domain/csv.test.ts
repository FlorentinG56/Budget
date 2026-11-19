import { describe, expect, it } from 'vitest'
import { operationsVersCsv } from './csv'
import type { Categorie, Compte, Operation } from './types'

describe('export CSV', () => {
  const comptes = [{ id: 'chq', nom: 'Compte courant', devise: 'CAD' }, { id: 'ca', nom: 'Compte en euros', devise: 'EUR' }] as Compte[]
  const cats = [{ id: 'alim', nom: 'Alimentation' }, { id: 'alim/epicerie', nom: 'Épicerie', parentId: 'alim' }] as Categorie[]
  const op = (p: Partial<Operation>): Operation => ({ id: 'x', date: '2026-11-18', montant: 0, type: 'depense', compteId: 'chq', creeLe: 0, ...p })
  it('format Excel français : « ; », virgule décimale, BOM, montants signés', () => {
    const csv = operationsVersCsv([
      op({ id: 'b', date: '2026-11-19', type: 'revenu', montant: 150000, note: 'Salaire' }),
      op({ id: 'a', montant: 1250, categorieId: 'alim', sousCategorieId: 'alim/epicerie', note: 'Épicerie du coin; "promo"' }),
      op({ id: 'c', date: '2026-11-20', type: 'virement', compteId: 'ca', compteDestinationId: 'chq', montant: 10000, montantRecu: 14520 }),
      op({ id: 'd', date: '2026-11-21', montant: 12000, horsBudget: true }),
    ], comptes, cats)
    expect(csv.startsWith('﻿')).toBe(true)
    const lignes = csv.slice(1).trim().split('\r\n')
    expect(lignes[0]).toBe('Date;Type;Compte;Devise;Montant;Catégorie;Sous-catégorie;Note;Compte destination;Montant reçu;Budget du jour')
    expect(lignes[1]).toBe('2026-11-18;Dépense;Compte courant;CAD;-12,50;Alimentation;Épicerie;"Épicerie du coin; ""promo""";;;Comptée')
    expect(lignes[2]).toBe('2026-11-19;Revenu;Compte courant;CAD;1500,00;;;Salaire;;;')
    expect(lignes[3]).toBe('2026-11-20;Virement;Compte en euros;EUR;-100,00;;;;Compte courant;145,20;')
    expect(lignes[4]).toBe('2026-11-21;Dépense;Compte courant;CAD;-120,00;;;;;;Imprévu (solde du compte)')
  })
})
