import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'
import { soldeObjectif } from '../domain/epargne'
import { soldeCompte } from '../domain/soldes'
import { ajouterMouvement, convertirObjectif, enregistrerObjectif, enregistrerOperation, supprimerOperation, synchroniserSecurite, terminerQuinzaine, validerPeriode } from './actions'
import { COMPTES_TEST, preparerUtilisateur } from './testUtils'
import { BudgetDB, lireReglages } from './db'

const EPARGNE = { id: 'ep', nom: 'Compte épargne', type: 'epargne' as const, devise: 'CAD' as const, couleur: '#000', soldeDepart: 100000, dateDepart: '2026-01-01', inclusBudgetJournalier: false, archive: false, ordre: 3 }

describe('sécurité', () => {
  it('garde les montants d’avant, fixe la cible à 2 000 une fois, et n’ajoute plus rien automatiquement', async () => {
    const base = new BudgetDB('test-securite')
    await preparerUtilisateur(base)
    // données d'avant : Sécurité avec des mouvements automatiques, et une période avec épargne à la paie
    await base.objectifs.add({ id: 'sec', nom: 'Sécurité', compteId: 'chq', archive: false, mouvements: [
      { id: 'a', date: '2026-11-11', montant: 47750, sens: 'mise_de_cote', source: 'bilan:p-2026-10-28' },
    ] })
    await base.reglages.update('app', { objectifSecuriteId: 'sec' })
    await base.periodes.add({ id: 'p-2026-11-25', dateDebut: '2026-11-25', dateFin: '2026-12-08', enveloppeValidee: 50000, epargneMiseDeCote: 10345, reportPrecedent: 0, ajouts: [], cloturee: false })
    expect(await synchroniserSecurite(base)).toBe('sec')
    const sec = (await base.objectifs.get('sec'))!
    expect(sec.mouvements.map((m) => m.montant)).toEqual([47750]) // rien d'ajouté pour la paie
    expect(sec.montantCible).toBe(200000)
    expect((await lireReglages(base)).epargneV2).toBe(true)
    // cible modifiée ensuite par l'utilisateur : plus jamais écrasée
    await base.objectifs.update('sec', { montantCible: undefined })
    await synchroniserSecurite(base)
    expect((await base.objectifs.get('sec'))!.montantCible).toBeUndefined()
    // une nouvelle paie n'ajoute plus rien
    await validerPeriode({ debut: '2026-12-09', fin: '2026-12-22', enveloppe: 50000, epargne: 0, report: 0, aCote: 12000 }, base)
    expect((await base.objectifs.get('sec'))!.mouvements).toHaveLength(1)
    base.close()
  })

  it('nouvel utilisateur : Sécurité créée sur le compte courant, cible 2 000', async () => {
    const base = new BudgetDB('test-securite-neuf')
    await preparerUtilisateur(base)
    const id = await synchroniserSecurite(base)
    const sec = (await base.objectifs.get(id!))!
    expect([sec.nom, sec.compteId, sec.montantCible, sec.mouvements.length]).toEqual(['Sécurité', 'chq', 200000, 0])
    base.close()
  })
})

describe('fin de quinzaine', () => {
  const periode = { id: 'p-2026-11-11', dateDebut: '2026-11-11', dateFin: '2026-11-24', enveloppeValidee: 50000, epargneMiseDeCote: 0, reportPrecedent: 0, ajouts: [], cloturee: false }

  it('épargne : virement vers le compte épargne et projet ; le reste en sécurité ; période close', async () => {
    const base = new BudgetDB('test-fin-quinzaine')
    await preparerUtilisateur(base)
    await base.comptes.add(EPARGNE)
    const sec = await synchroniserSecurite(base)
    const ps5 = await enregistrerObjectif({ nom: 'PS5', compteId: 'ep', montantCible: 60000 }, base)
    await base.periodes.add(periode)
    await terminerQuinzaine(periode.id, { compteId: 'chq', reste: 40000, epargne: 15000, compteEpargneId: 'ep', projetId: ps5.id, date: '2026-11-25' }, base)
    const ops = await base.operations.toArray()
    expect(ops.map((o) => [o.type, o.compteId, o.compteDestinationId, o.montant, o.date])).toEqual([['virement', 'chq', 'ep', 15000, '2026-11-25']])
    expect(soldeCompte(EPARGNE, ops, '2026-11-25')).toBe(115000)
    expect(soldeObjectif((await base.objectifs.get(ps5.id))!, ops)).toBe(15000)
    expect(soldeObjectif((await base.objectifs.get(sec!))!, ops)).toBe(25000)
    const p = (await base.periodes.get(periode.id))!
    expect([p.cloturee, p.finReste, p.finEpargne, p.finSecurite, p.virementEpargneId]).toEqual([true, 40000, 15000, 25000, ops[0].id])
    // pas de double clôture
    await terminerQuinzaine(periode.id, { compteId: 'chq', reste: 40000, epargne: 15000, compteEpargneId: 'ep', date: '2026-11-25' }, base)
    expect(await base.operations.count()).toBe(1)
    base.close()
  })

  it('sans compte épargne : tout en sécurité ; reste négatif : rien', async () => {
    const base = new BudgetDB('test-fin-quinzaine-2')
    await preparerUtilisateur(base)
    const sec = await synchroniserSecurite(base)
    await base.periodes.bulkAdd([periode, { ...periode, id: 'p2', dateDebut: '2026-11-25', dateFin: '2026-12-08' }])
    await terminerQuinzaine(periode.id, { compteId: 'chq', reste: 40000, epargne: 15000, date: '2026-11-25' }, base)
    await terminerQuinzaine('p2', { compteId: 'chq', reste: -3000, epargne: 0, date: '2026-12-09' }, base)
    expect(await base.operations.count()).toBe(0)
    expect((await base.objectifs.get(sec!))!.mouvements.map((m) => m.montant)).toEqual([40000])
    expect((await base.periodes.get('p2'))!.cloturee).toBe(true)
    base.close()
  })
})

describe('imprévu payé avec l’épargne', () => {
  it('crée un virement épargne → compte principal, qui suit la dépense et disparaît avec elle', async () => {
    const base = new BudgetDB('test-imprevu-epargne')
    await preparerUtilisateur(base)
    await base.comptes.add(EPARGNE)
    const ps5 = await enregistrerObjectif({ nom: 'PS5', compteId: 'ep' }, base)
    await ajouterMouvement(ps5.id, { date: '2026-11-01', montant: 30000, sens: 'mise_de_cote' }, base)
    // dépense sur la carte : le virement va au compte qui rembourse la carte
    let op = await enregistrerOperation({ date: '2026-11-20', montant: 12000, type: 'depense', compteId: 'carte', note: 'Garage', epargneCompteId: 'ep', objectifEpargneId: ps5.id }, base)
    let vir = (await base.operations.get(op.virementLieId!))!
    expect([vir.type, vir.compteId, vir.compteDestinationId, vir.montant, vir.lieA, vir.note]).toEqual(['virement', 'ep', 'chq', 12000, op.id, 'Retrait d’épargne : Garage'])
    let ops = await base.operations.toArray()
    expect(soldeCompte(EPARGNE, ops)).toBe(88000)
    expect(soldeObjectif((await base.objectifs.get(ps5.id))!, ops)).toBe(18000)
    // montant modifié : le virement suit
    op = await enregistrerOperation({ ...op, montant: 10000, date: '2026-11-21' }, base)
    vir = (await base.operations.get(op.virementLieId!))!
    expect([vir.montant, vir.date, await base.operations.count()]).toEqual([10000, '2026-11-21', 2])
    // plus payée avec l'épargne : le virement disparaît
    op = await enregistrerOperation({ ...op, epargneCompteId: undefined, objectifEpargneId: undefined }, base)
    expect([op.virementLieId, await base.operations.count()]).toEqual([undefined, 1])
    // de nouveau, puis suppression de la dépense : le virement part avec
    op = await enregistrerOperation({ ...op, epargneCompteId: 'ep' }, base)
    expect(await base.operations.count()).toBe(2)
    await supprimerOperation(op.id, base)
    ops = await base.operations.toArray()
    expect(ops).toHaveLength(0)
    base.close()
  })
})

describe('conversion des anciens objectifs', () => {
  it('ajouter à la sécurité (même compte) ou archiver ; historique conservé', async () => {
    const base = new BudgetDB('test-conversion')
    await preparerUtilisateur(base)
    const sec = (await synchroniserSecurite(base))!
    const voyage = await enregistrerObjectif({ nom: 'Voyage', compteId: 'chq' }, base)
    await ajouterMouvement(voyage.id, { date: '2026-10-01', montant: 20000, sens: 'mise_de_cote' }, base)
    await enregistrerOperation({ date: '2026-10-05', montant: 5000, type: 'depense', compteId: 'chq', objectifEpargneId: voyage.id }, base)
    const euros = await enregistrerObjectif({ nom: 'Euros', compteId: COMPTES_TEST[2].id }, base)
    await convertirObjectif(voyage.id, 'securite', base)
    await expect(convertirObjectif(euros.id, 'securite', base)).rejects.toThrow()
    await convertirObjectif(euros.id, 'archiver', base)
    await convertirObjectif(sec, 'archiver', base) // la sécurité ne se convertit pas
    const ops = await base.operations.toArray()
    const s = (await base.objectifs.get(sec))!
    expect([s.archive, soldeObjectif(s, ops), s.mouvements[0].note]).toEqual([false, 15000, 'Ancien objectif « Voyage »'])
    expect((await base.objectifs.get(voyage.id))!.archive).toBe(true)
    expect((await base.objectifs.get(voyage.id))!.mouvements).toHaveLength(1)
    expect((await base.objectifs.get(euros.id))!.archive).toBe(true)
    base.close()
  })
})
