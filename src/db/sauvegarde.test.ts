import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'
import { chiffrer, dechiffrer } from '../security/sauvegarde'
import {enregistrerOperation } from './actions'
import { preparerUtilisateur } from './testUtils'
import { BudgetDB, lireReglages, modifierReglages } from './db'
import { estimerTailleSauvegarde, exporterDonnees, restaurerDonnees, resumerSauvegarde, validerContenu } from './sauvegarde'

describe('sauvegarde et restauration', () => {
  it('aller-retour complet, sans le code PIN, en gardant le code de l’appareil', async () => {
    const source = new BudgetDB('test-source')
    await preparerUtilisateur(source)
    await enregistrerOperation({ date: '2026-11-18', montant: 1250, type: 'depense', compteId: 'chq', categorieId: 'alimentation' }, source)
    await modifierReglages({ pinHash: 'HASH-SOURCE', pinSel: 'SEL', pinIterations: 1, budgetParPeriode: 60000 }, source)
    const contenu = await exporterDonnees(source)
    expect(JSON.stringify(contenu)).not.toContain('HASH-SOURCE')

    const fichier = await chiffrer(JSON.stringify(contenu), 'mot-de-passe-solide', 100_000)
    const relu = validerContenu(await dechiffrer(fichier, 'mot-de-passe-solide'))

    const cible = new BudgetDB('test-cible') // nouvel iPhone : déjà un code, des données vides
    await modifierReglages({ pinHash: 'HASH-CIBLE', pinSel: 'SEL2', pinIterations: 1 }, cible)
    await restaurerDonnees(relu, cible)
    expect(await cible.comptes.count()).toBe(3)
    expect((await cible.operations.toArray()).map((o) => o.montant)).toEqual([1250])
    const r = await lireReglages(cible)
    expect(r.pinHash).toBe('HASH-CIBLE')
    expect(r.budgetParPeriode).toBe(60000)
    source.close(); cible.close()
  })
  it('restaure une sauvegarde créée avant les voyages, et sauvegarde les voyages', async () => {
    const source = new BudgetDB('test-voyages-src')
    await preparerUtilisateur(source)
    await source.voyages.add({ id: 'v', nom: 'Voyage', compteId: 'eur', debut: '2026-12-20', fin: '2026-12-29', budget: 100000 })
    const contenu = await exporterDonnees(source)
    expect(contenu.tables.voyages).toHaveLength(1)
    const ancienne = { ...contenu, tables: { ...contenu.tables } }; delete ancienne.tables.voyages
    const cible = new BudgetDB('test-voyages-cible')
    await cible.voyages.add({ id: 'x', nom: 'X', compteId: 'eur', debut: '2026-01-01', fin: '2026-01-02', budget: 1 })
    await restaurerDonnees(validerContenu(JSON.stringify(ancienne)), cible)
    expect(await cible.voyages.count()).toBe(0) // l'ancienne sauvegarde n'en avait pas
    await restaurerDonnees(validerContenu(JSON.stringify(contenu)), cible)
    expect((await cible.voyages.toArray()).map((v) => v.nom)).toEqual(['Voyage'])
    source.close(); cible.close()
  })
  it('sauvegarde et restaure les biens ; une sauvegarde plus ancienne se restaure toujours', async () => {
    const source = new BudgetDB('test-biens-src')
    await preparerUtilisateur(source)
    await source.biens.add({ id: 'b', nom: 'Mac', categorie: 'ordinateur', origine: 'neuf', dateAcquisition: '2026-01-10', prixAchat: 250000, devise: 'CAD', etat: 'bon', historiqueEtat: [], creeLe: 1 })
    const contenu = await exporterDonnees(source)
    expect(contenu.tables.biens).toHaveLength(1)
    const ancienne = { ...contenu, tables: { ...contenu.tables } }; delete ancienne.tables.biens
    const cible = new BudgetDB('test-biens-cible')
    await restaurerDonnees(validerContenu(JSON.stringify(contenu)), cible)
    expect((await cible.biens.toArray()).map((b) => b.nom)).toEqual(['Mac'])
    await restaurerDonnees(validerContenu(JSON.stringify(ancienne)), cible)
    expect(await cible.biens.count()).toBe(0)
    source.close(); cible.close()
  })
  it('photos : incluses ou non ; une sauvegarde sans photos garde celles de l’iPhone encore utilisées', async () => {
    const source = new BudgetDB('test-photos-src')
    await preparerUtilisateur(source)
    await source.photos.bulkAdd([{ id: 'p1', donnees: 'data:image/jpeg;base64,AAAA', taille: 3 }, { id: 'p2', donnees: 'data:x', taille: 1 }])
    await source.biens.add({ id: 'b', nom: 'Mac', categorie: 'ordinateur', origine: 'neuf', dateAcquisition: '2026-01-10', prixAchat: 250000, devise: 'CAD', etat: 'bon', historiqueEtat: [], photoId: 'p1', creeLe: 1 })
    const avec = await exporterDonnees(source)
    const sans = await exporterDonnees(source, new Date(), { photos: false })
    expect(avec.tables.photos).toHaveLength(2)
    expect(sans.tables.photos).toBeUndefined()
    expect(resumerSauvegarde(avec)).toMatchObject({ biens: 1, photos: 2 })
    const cible = new BudgetDB('test-photos-cible')
    await restaurerDonnees(validerContenu(JSON.stringify(avec)), cible)
    expect((await cible.photos.toArray()).map((p) => p.id)).toEqual(['p1']) // p2 n'était utilisée par aucun bien
    await cible.photos.add({ id: 'p3', donnees: 'data:y', taille: 1 })
    await restaurerDonnees(validerContenu(JSON.stringify(sans)), cible)
    expect((await cible.photos.toArray()).map((p) => p.id)).toEqual(['p1'])
    source.close(); cible.close()
  })
  it('taille estimée de la sauvegarde', () => {
    expect(estimerTailleSauvegarde(3000, 300000)).toBe(404400)
  })
  it('refuse un contenu invalide', () => {
    expect(() => validerContenu('{"schema":2}')).toThrow()
    expect(() => validerContenu('{"schema":1,"tables":{"comptes":[]}}')).toThrow()
  })
})
