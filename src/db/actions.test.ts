import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'
import { soldeCompte } from '../domain/soldes'
import { aujourdhui } from '../domain/dates'
import { ajusterSolde, enregistrerCategorie, enregistrerOperation, initialiserDonnees } from './actions'
import { BudgetDB } from './db'

describe('données de départ', () => {
  it('crée 5 comptes et 12 catégories, une seule fois', async () => {
    const base = new BudgetDB('test-init')
    await initialiserDonnees(base)
    await initialiserDonnees(base)
    const comptes = await base.comptes.orderBy('ordre').toArray()
    expect(comptes).toHaveLength(5)
    expect(comptes.filter((c) => c.devise === 'EUR').map((c) => c.nom)).toEqual(['Compte en euros', 'Compte voyage', 'Compte secondaire'])
    expect(comptes.find((c) => c.type === 'carte_credit')?.compteRemboursementId).toBe('chq')
    const cats = await base.categories.toArray()
    expect(cats.filter((c) => !c.parentId)).toHaveLength(12)
    expect(cats.filter((c) => c.parentId === 'alimentation').sort((a, b) => a.ordre - b.ordre).map((c) => c.nom)).toEqual(['Épicerie', 'Restaurant', 'Café/boulangerie', 'Fast-food/livraison'])
    expect(cats.find((c) => c.nom === 'Électricité')?.id).toBe('logement/electricite')
    base.close()
  })
})

describe('ajusterSolde', () => {
  it('enregistre l’écart comme opération Ajustement', async () => {
    const base = new BudgetDB('test-ajust')
    await initialiserDonnees(base)
    await base.comptes.update('chq', { soldeDepart: 100000 })
    await enregistrerOperation({ date: aujourdhui(), montant: 2500, type: 'depense', compteId: 'chq', categorieId: 'alimentation' }, base)
    expect(await ajusterSolde('chq', 97000, undefined, base)).toBe(-500)
    expect(await ajusterSolde('chq', 97000, undefined, base)).toBe(0)
    const compte = (await base.comptes.get('chq'))!
    expect(soldeCompte(compte, await base.operations.toArray())).toBe(97000)
    expect((await base.operations.where('type').equals('ajustement').toArray())).toHaveLength(1)
    base.close()
  })
})

describe('enregistrerOperation / enregistrerCategorie', () => {
  it('garde l’heure de saisie lors d’une modification', async () => {
    const base = new BudgetDB('test-modif')
    const o = await enregistrerOperation({ date: '2026-11-10', montant: 100, type: 'depense', compteId: 'x' }, base)
    const m = await enregistrerOperation({ ...o, montant: 200 }, base)
    expect(m.creeLe).toBe(o.creeLe)
    expect((await base.operations.get(o.id))?.montant).toBe(200)
    base.close()
  })
  it('place une nouvelle sous-catégorie en dernier', async () => {
    const base = new BudgetDB('test-cat')
    await initialiserDonnees(base)
    const c = await enregistrerCategorie({ nom: 'Marché', icone: '', couleur: '#000', parentId: 'alimentation', archivee: false }, base)
    expect(c.ordre).toBe(4)
    base.close()
  })
})
