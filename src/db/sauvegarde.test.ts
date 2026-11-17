import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'
import { chiffrer, dechiffrer } from '../security/sauvegarde'
import { enregistrerOperation, initialiserDonnees } from './actions'
import { BudgetDB, lireReglages, modifierReglages } from './db'
import { exporterDonnees, restaurerDonnees, validerContenu } from './sauvegarde'

describe('sauvegarde et restauration', () => {
  it('aller-retour complet, sans le code PIN, en gardant le code de l’appareil', async () => {
    const source = new BudgetDB('test-source')
    await initialiserDonnees(source)
    await enregistrerOperation({ date: '2026-11-18', montant: 1250, type: 'depense', compteId: 'chq', categorieId: 'alimentation' }, source)
    await modifierReglages({ pinHash: 'HASH-SOURCE', pinSel: 'SEL', pinIterations: 1, budgetParPeriode: 60000 }, source)
    const contenu = await exporterDonnees(source)
    expect(JSON.stringify(contenu)).not.toContain('HASH-SOURCE')

    const fichier = await chiffrer(JSON.stringify(contenu), 'mot-de-passe-solide', 100_000)
    const relu = validerContenu(await dechiffrer(fichier, 'mot-de-passe-solide'))

    const cible = new BudgetDB('test-cible') // nouvel iPhone : déjà un code, des données vides
    await modifierReglages({ pinHash: 'HASH-CIBLE', pinSel: 'SEL2', pinIterations: 1 }, cible)
    await restaurerDonnees(relu, cible)
    expect(await cible.comptes.count()).toBe(5)
    expect((await cible.operations.toArray()).map((o) => o.montant)).toEqual([1250])
    const r = await lireReglages(cible)
    expect(r.pinHash).toBe('HASH-CIBLE')
    expect(r.budgetParPeriode).toBe(60000)
    source.close(); cible.close()
  })
  it('refuse un contenu invalide', () => {
    expect(() => validerContenu('{"schema":2}')).toThrow()
    expect(() => validerContenu('{"schema":1,"tables":{"comptes":[]}}')).toThrow()
  })
})
