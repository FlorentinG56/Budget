import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'
import Dexie from 'dexie'
import { BudgetDB, lireReglages, modifierReglages } from './db'

describe('base locale', () => {
  it('crée les 10 tables', async () => {
    const base = new BudgetDB('test-tables')
    await base.open()
    expect(base.tables.map((t) => t.name).sort()).toEqual(
      ['biens', 'categories', 'comptes', 'objectifs', 'operations', 'periodes', 'photos', 'recurrences', 'reglages', 'voyages'],
    )
    base.close()
  })

  it('renvoie les réglages par défaut puis les modifie', async () => {
    const base = new BudgetDB('test-reglages')
    const r = await lireReglages(base)
    expect(r.verrouillageMinutes).toBe(2)
    expect(r.pinHash).toBeUndefined()
    await modifierReglages({ verrouillageMinutes: 5, echecsPin: 1 }, base)
    const r2 = await lireReglages(base)
    expect(r2.verrouillageMinutes).toBe(5)
    expect(r2.echecsPin).toBe(1)
    expect(r2.delaiAlerteJours).toBe(2)
    base.close()
  })
})

describe('mise à jour de la base (version 1 → 3 : voyages, puis biens et photos)', () => {
  it('les données existantes restent intactes', async () => {
    const v1 = new Dexie('test-migration')
    v1.version(1).stores({ comptes: 'id, ordre, archive', operations: 'id, date, compteId, compteDestinationId, type, categorieId, recurrenceId, [compteId+date]',
      recurrences: 'id, type, compteId, actif', categories: 'id, parentId, ordre, archivee', periodes: 'id, dateDebut, dateFin', objectifs: 'id, compteId', reglages: 'id' })
    await v1.open()
    await v1.table('comptes').add({ id: 'chq', nom: 'Compte', ordre: 0 })
    await v1.table('operations').add({ id: 'o', date: '2026-11-10', montant: 1250, type: 'depense', compteId: 'chq', creeLe: 1 })
    await v1.table('reglages').add({ id: 'app', budgetParPeriode: 42000, donneesInitialisees: true })
    v1.close()
    const base = new BudgetDB('test-migration')
    await base.open()
    expect(base.verno).toBe(3)
    expect(await base.comptes.toArray()).toEqual([{ id: 'chq', nom: 'Compte', ordre: 0 }])
    expect((await base.operations.get('o'))?.montant).toBe(1250)
    expect((await lireReglages(base)).budgetParPeriode).toBe(42000)
    expect(await base.voyages.count()).toBe(0)
    expect(await base.biens.count()).toBe(0)
    expect(await base.photos.count()).toBe(0)
    base.close()
  })
})
