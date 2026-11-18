import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'
import { capitalRestant } from '../domain/recurrences'
import { aujourdhui } from '../domain/dates'
import { soldeCompte } from '../domain/soldes'
import {confirmerEcheance, enregistrerRecurrence, genererEcheances, supprimerOperation } from './actions'
import { preparerUtilisateur } from './testUtils'
import { echeancesEnAttente } from '../domain/recurrences'
import { BudgetDB } from './db'

const base0 = { compteId: 'chq', moyenPaiement: 'compte' as const, actif: true, jours: [1], frequence: 'mensuel' as const }

describe('prélèvements automatiques', () => {
  it('ne génère pas les échéances antérieures à la création, puis rattrape', async () => {
    const base = new BudgetDB('test-rec-1')
    await preparerUtilisateur(base)
    const r = await enregistrerRecurrence({ ...base0, type: 'charge_fixe', libelle: 'Loyer', montant: 120000, dateDebut: '2026-01-01', categorieId: 'logement' }, base)
    expect(r.derniereEcheanceGeneree).toBe(aujourdhui())
    // simulation : l'app n'est pas ouverte pendant 3 mois
    await base.recurrences.update(r.id, { derniereEcheanceGeneree: '2026-07-15' })
    const creees = await genererEcheances('2026-10-20', base)
    expect(creees.map((o) => o.date)).toEqual(['2026-08-01', '2026-09-01', '2026-10-01'])
    expect(await genererEcheances('2026-10-20', base)).toEqual([]) // pas de doublon
    expect((await base.recurrences.get(r.id))?.derniereEcheanceGeneree).toBe('2026-10-01')
    base.close()
  })

  it('une échéance annulée (supprimée) n’est pas recréée', async () => {
    const base = new BudgetDB('test-rec-2')
    await preparerUtilisateur(base)
    const r = await enregistrerRecurrence({ ...base0, type: 'charge_fixe', libelle: 'Internet', montant: 8000, dateDebut: '2026-01-01' }, base)
    await base.recurrences.update(r.id, { derniereEcheanceGeneree: '2026-09-15' })
    const [op] = await genererEcheances('2026-10-05', base)
    await supprimerOperation(op.id, base)
    expect(await genererEcheances('2026-10-05', base)).toEqual([])
    base.close()
  })

  it('un revenu crédite le compte ; une charge par carte augmente le dû', async () => {
    const base = new BudgetDB('test-rec-3')
    await preparerUtilisateur(base)
    const paie = await enregistrerRecurrence({ ...base0, type: 'revenu', libelle: 'Salaire', montant: 180000, frequence: '14_jours', jours: [], dateDebut: '2026-11-11' }, base)
    const abo = await enregistrerRecurrence({ ...base0, type: 'charge_fixe', libelle: 'Netflix', montant: 2000, jours: [20], dateDebut: '2026-01-01', moyenPaiement: 'carte', carteId: 'carte' }, base)
    await base.recurrences.update(paie.id, { derniereEcheanceGeneree: '2026-11-11' })
    await base.recurrences.update(abo.id, { derniereEcheanceGeneree: '2026-11-15' })
    await base.comptes.update('chq', { dateDepart: '2026-11-01' })
    await base.comptes.update('carte', { dateDepart: '2026-11-01' })
    await genererEcheances('2026-11-26', base)
    const ops = await base.operations.toArray()
    expect(soldeCompte((await base.comptes.get('chq'))!, ops)).toBe(180000)
    expect(-soldeCompte((await base.comptes.get('carte'))!, ops)).toBe(2000)
    base.close()
  })

  it('crédit : le capital baisse à chaque mensualité et remonte si on annule', async () => {
    const base = new BudgetDB('test-rec-4')
    await preparerUtilisateur(base)
    const c = await enregistrerRecurrence({ ...base0, type: 'credit', libelle: 'Auto', montant: 35000, jours: [15], dateDebut: '2026-01-15', capitalRestantDu: 840000, tauxAnnuel: 6 }, base)
    expect(c.capitalInitial).toBe(840000)
    const ref = c.capitalReferenceDate!
    await base.recurrences.update(c.id, { derniereEcheanceGeneree: ref, capitalReferenceDate: ref })
    const lendemainMois = (d: string, m: number) => { const x = new Date(d); x.setMonth(x.getMonth() + m); return x.toISOString().slice(0, 10) }
    const creees = await genererEcheances(lendemainMois(ref, 2), base)
    expect(creees.length).toBe(2)
    // 1re : intérêts 42 $ → capital 3 080 $... soit 8 400 − 308 = 8 092 $ ; 2e : intérêts 40,46 $ → 309,54 $
    expect(creees.map((o) => o.partCapital)).toEqual([30800, 30954])
    const rec = (await base.recurrences.get(c.id))!
    expect(capitalRestant(rec, await base.operations.toArray())).toBe(840000 - 30800 - 30954)
    await supprimerOperation(creees[1].id, base)
    expect(capitalRestant(rec, await base.operations.toArray())).toBe(840000 - 30800)
    base.close()
  })

  it('réactiver une récurrence en pause ne rattrape pas la pause', async () => {
    const base = new BudgetDB('test-rec-5')
    await preparerUtilisateur(base)
    const r = await enregistrerRecurrence({ ...base0, type: 'charge_fixe', libelle: 'Gym', montant: 5000, dateDebut: '2026-01-01' }, base)
    await base.recurrences.update(r.id, { derniereEcheanceGeneree: '2026-03-01', actif: false })
    await enregistrerRecurrence({ ...(await base.recurrences.get(r.id))!, actif: true }, base)
    expect((await base.recurrences.get(r.id))!.derniereEcheanceGeneree! >= '2026-11-01').toBe(true)
    base.close()
  })
})

describe('paie à confirmer', () => {
  it('confirmer crée le revenu avec le montant réel ; ignorer ne crée rien', async () => {
    const base = new BudgetDB('test-confirmer')
    await preparerUtilisateur(base)
    const r = await enregistrerRecurrence({ ...base0, type: 'revenu', libelle: 'Salaire', montant: 180000, frequence: '14_jours', jours: [], dateDebut: '2026-11-11', aConfirmer: true }, base)
    await base.recurrences.update(r.id, { derniereEcheanceGeneree: '2026-11-15' })
    expect(await genererEcheances('2026-12-10', base)).toEqual([])
    const op = await confirmerEcheance(r.id, '2026-11-25', 182345, '2026-11-25', base)
    expect(op?.montant).toBe(182345)
    expect(op?.recurrenceId).toBe(r.id)
    expect(await confirmerEcheance(r.id, '2026-12-09', null, undefined, base)).toBeNull()
    expect(echeancesEnAttente([(await base.recurrences.get(r.id))!], '2026-12-10')).toEqual([])
    expect(await base.operations.count()).toBe(1)
    base.close()
  })
})
