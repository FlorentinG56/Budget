import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'
import { soldeObjectif } from '../domain/epargne'
import { ajouterMouvement, cloturerPeriode, enregistrerOperation, initialiserDonnees, synchroniserSecurite, validerPeriode } from './actions'
import { BudgetDB, lireReglages } from './db'

describe('objectif Sécurité', () => {
  it('reprend l’épargne de la paie et le reste des périodes, sans doublon', async () => {
    const base = new BudgetDB('test-securite')
    await initialiserDonnees(base)
    // données d'avant l'étape 7 : période close avec reste en épargne, nouvelle période avec épargne à la paie
    await base.periodes.bulkAdd([
      { id: 'p-2026-11-11', dateDebut: '2026-11-11', dateFin: '2026-11-24', enveloppeValidee: 53000, epargneMiseDeCote: 0, reportPrecedent: 0, ajouts: [], cloturee: true, affectationFin: 'epargne', montantAffecte: 47750 },
      { id: 'p-2026-11-25', dateDebut: '2026-11-25', dateFin: '2026-12-08', enveloppeValidee: 50000, epargneMiseDeCote: 10345, reportPrecedent: 0, ajouts: [], cloturee: false },
    ])
    const id = await synchroniserSecurite(base)
    await synchroniserSecurite(base)
    const sec = (await base.objectifs.get(id!))!
    expect(sec.nom).toBe('Sécurité')
    expect(sec.compteId).toBe('chq')
    expect((await lireReglages(base)).objectifSecuriteId).toBe(id)
    expect(sec.mouvements.map((m) => [m.source, m.montant])).toEqual([['bilan:p-2026-11-11', 47750], ['paie:p-2026-11-25', 10345]])

    // fin de période : le reste va dans Sécurité automatiquement
    await cloturerPeriode('p-2026-11-25', 'epargne', 2000, base)
    // paie suivante avec épargne
    await validerPeriode({ debut: '2026-12-09', fin: '2026-12-22', enveloppe: 50000, epargne: 30000, report: 0 }, base)
    // imprévu payé avec l'épargne
    await enregistrerOperation({ date: '2026-12-10', montant: 15000, type: 'depense', compteId: 'chq', objectifEpargneId: id }, base)
    await ajouterMouvement(id!, { date: '2026-12-11', montant: 1000, sens: 'reprise' }, base)
    const apres = (await base.objectifs.get(id!))!
    expect(soldeObjectif(apres, await base.operations.toArray())).toBe(47750 + 10345 + 2000 + 30000 - 15000 - 1000)
    base.close()
  })
})
