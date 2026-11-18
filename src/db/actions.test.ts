import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'
import { soldeCompte } from '../domain/soldes'
import { aujourdhui } from '../domain/dates'
import { ajusterSolde, choisirComptesBudget, enregistrerCategorie, enregistrerOperation, initialiserDonnees, terminerAccueil } from './actions'
import { COMPTES_TEST, preparerUtilisateur } from './testUtils'
import { BudgetDB, lireReglages, modifierReglages } from './db'

describe('premier lancement', () => {
  it('nouvel utilisateur : catégories proposées, aucun compte, parcours d’accueil ouvert', async () => {
    const base = new BudgetDB('test-nouveau')
    expect(await initialiserDonnees(base)).toBe('nouveau')
    expect(await initialiserDonnees(base)).toBe('nouveau') // parcours interrompu : repris
    expect(await base.comptes.count()).toBe(0)
    const cats = await base.categories.toArray()
    expect(cats.filter((c) => !c.parentId)).toHaveLength(12)
    expect(cats.filter((c) => c.parentId === 'alimentation').sort((a, b) => a.ordre - b.ordre).map((c) => c.nom)).toEqual(['Épicerie', 'Restaurant', 'Café/boulangerie', 'Fast-food/livraison'])
    expect(cats.find((c) => c.nom === 'Électricité')?.id).toBe('logement/electricite')
    expect((await lireReglages(base)).budgetParPeriode).toBe(0) // aucun montant prérempli
    await terminerAccueil(base)
    expect(await initialiserDonnees(base)).toBe('existant')
    base.close()
  })

  it('utilisateur existant : rien n’est créé, renommé ni supprimé', async () => {
    const base = new BudgetDB('test-existant')
    // données d'un utilisateur de la version précédente
    await base.comptes.bulkAdd(COMPTES_TEST)
    await base.categories.bulkAdd([
      { id: 'logement', nom: 'Logement', icone: '🏠', couleur: '#8B5CF6', ordre: 0, archivee: false },
      { id: 'logement/perso', nom: 'Mon électricité', icone: '', couleur: '#8B5CF6', parentId: 'logement', ordre: 0, archivee: false },
    ])
    await base.operations.add({ id: 'op', date: '2026-11-10', montant: 1250, type: 'depense', compteId: 'chq', creeLe: 1 })
    await modifierReglages({ donneesInitialisees: true, budgetParPeriode: 42000, pinHash: 'H' }, base)
    const avant = { comptes: await base.comptes.toArray(), categories: await base.categories.toArray(), operations: await base.operations.toArray(), reglages: await base.reglages.toArray() }
    expect(await initialiserDonnees(base)).toBe('existant')
    expect(await initialiserDonnees(base)).toBe('existant')
    const apres = { comptes: await base.comptes.toArray(), categories: await base.categories.toArray(), operations: await base.operations.toArray(), reglages: await base.reglages.toArray() }
    expect(apres).toEqual(avant)
    base.close()
  })

  it('des comptes sans indicateur d’initialisation : rien n’est créé non plus', async () => {
    const base = new BudgetDB('test-comptes-seuls')
    await base.comptes.bulkAdd(COMPTES_TEST)
    expect(await initialiserDonnees(base)).toBe('existant')
    expect(await base.categories.count()).toBe(0)
    expect((await lireReglages(base)).parcoursAccueil).toBeUndefined()
    base.close()
  })

  it('choisir le compte du budget du jour et sa carte', async () => {
    const base = new BudgetDB('test-choix-budget')
    await base.comptes.bulkAdd(COMPTES_TEST.map((c) => ({ ...c, inclusBudgetJournalier: false, compteRemboursementId: undefined })))
    await choisirComptesBudget('eur', 'carte', base)
    const c = new Map((await base.comptes.toArray()).map((x) => [x.id, x]))
    expect([c.get('chq')!.inclusBudgetJournalier, c.get('carte')!.inclusBudgetJournalier, c.get('eur')!.inclusBudgetJournalier]).toEqual([false, true, true])
    expect(c.get('carte')!.compteRemboursementId).toBe('eur')
    base.close()
  })
})

describe('ajusterSolde', () => {
  it('enregistre l’écart comme opération Ajustement', async () => {
    const base = new BudgetDB('test-ajust')
    await preparerUtilisateur(base)
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
    await preparerUtilisateur(base)
    const c = await enregistrerCategorie({ nom: 'Marché', icone: '', couleur: '#000', parentId: 'alimentation', archivee: false }, base)
    expect(c.ordre).toBe(4)
    base.close()
  })
})
