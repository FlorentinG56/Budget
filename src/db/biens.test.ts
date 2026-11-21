import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'
import { changerEtatBien, encaisserVente, ignorerVente, enregistrerBien, enregistrerOperation, enregistrerPhoto, modifierTauxCategorie, reactiverBien, sortirBien, supprimerBien } from './actions'
import { BudgetDB, lireReglages } from './db'
import { preparerUtilisateur } from './testUtils'

const iphone = { nom: 'iPhone', categorie: 'telephone' as const, origine: 'neuf' as const, dateAcquisition: '2025-09-20', prixAchat: 140000, devise: 'CAD' as const, etat: 'tres_bon' as const }

describe('biens', () => {
  it('fiche, état avec historique, photo remplacée supprimée', async () => {
    const base = new BudgetDB('test-biens-1')
    const photo = await enregistrerPhoto('data:image/jpeg;base64,AAA', 3, base)
    let b = await enregistrerBien({ ...iphone, photoId: photo.id }, base)
    await changerEtatBien(b.id, 'use', '2026-06-01', 'écran rayé', base)
    await changerEtatBien(b.id, 'use', '2026-07-01', undefined, base) // même état : rien
    b = (await base.biens.get(b.id))!
    expect([b.etat, b.historiqueEtat]).toEqual(['use', [{ date: '2026-06-01', ancien: 'tres_bon', nouveau: 'use', note: 'écran rayé' }]])
    const autre = await enregistrerPhoto('data:image/jpeg;base64,BBB', 3, base)
    await enregistrerBien({ ...b, photoId: autre.id }, base)
    expect((await base.photos.toArray()).map((p) => p.id)).toEqual([autre.id])
    expect((await base.biens.get(b.id))!.historiqueEtat).toHaveLength(1) // conservé
    base.close()
  })

  it('vente : sortie, puis « Ajouter au solde » crée un revenu « Vente » une seule fois ; réactivation', async () => {
    const base = new BudgetDB('test-biens-2')
    await preparerUtilisateur(base)
    const b = await enregistrerBien(iphone, base)
    await sortirBien(b.id, { motif: 'vendu', date: '2026-11-20', prixVente: 70000 }, base)
    const op = await encaisserVente(b.id, 'chq', base)
    expect([op?.type, op?.montant, op?.compteId, op?.categorieId, op?.date, op?.note]).toEqual(['revenu', 70000, 'chq', 'vente', '2026-11-20', 'Vente : iPhone'])
    expect((await base.categories.get('vente'))?.nom).toBe('Vente')
    expect(await encaisserVente(b.id, 'chq', base)).toBeUndefined()
    expect(await base.operations.count()).toBe(1)
    await ignorerVente(b.id, base)
    expect((await base.biens.get(b.id))!.sortie?.venteIgnoree).toBe(true)
    await reactiverBien(b.id, base)
    expect((await base.biens.get(b.id))!.sortie).toBeUndefined()
    // donné : pas de prix de vente
    await sortirBien(b.id, { motif: 'donne', date: '2026-11-21', prixVente: 5 }, base)
    expect((await base.biens.get(b.id))!.sortie).toEqual({ motif: 'donne', date: '2026-11-21' })
    base.close()
  })

  it('suppression : photos supprimées, réparations gardées sans lien', async () => {
    const base = new BudgetDB('test-biens-3')
    await preparerUtilisateur(base)
    const f = await enregistrerPhoto('data:x', 1, base)
    const b = await enregistrerBien({ ...iphone, factureId: f.id }, base)
    const rep = await enregistrerOperation({ date: '2026-10-01', montant: 12000, type: 'depense', compteId: 'chq', bienId: b.id }, base)
    await supprimerBien(b.id, base)
    expect([await base.biens.count(), await base.photos.count(), (await base.operations.get(rep.id))!.bienId]).toEqual([0, 0, undefined])
    base.close()
  })

  it('décote d’une catégorie modifiée puis remise par défaut', async () => {
    const base = new BudgetDB('test-biens-4')
    await modifierTauxCategorie('vehicule', { taux: 12, tauxAnnee1: 25 }, base)
    expect((await lireReglages(base)).tauxBiens).toEqual({ vehicule: { taux: 12, tauxAnnee1: 25 } })
    await modifierTauxCategorie('vehicule', null, base)
    expect((await lireReglages(base)).tauxBiens).toEqual({})
    base.close()
  })
})
