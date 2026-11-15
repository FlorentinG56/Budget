import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'
import { BudgetDB, lireReglages, modifierReglages } from './db'

describe('base locale', () => {
  it('crée les 7 tables', async () => {
    const base = new BudgetDB('test-tables')
    await base.open()
    expect(base.tables.map((t) => t.name).sort()).toEqual(
      ['categories', 'comptes', 'objectifs', 'operations', 'periodes', 'recurrences', 'reglages'],
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
