import { describe, expect, it } from 'vitest'
import { abonnements, categorieAbonnements, coutAnnuel, doublons, totauxAbonnements } from './abonnements'
import type { Categorie, Compte, Recurrence } from './types'

const rec = (p: Partial<Recurrence>): Recurrence => ({
  id: 'r', type: 'charge_fixe', libelle: 'X', montant: 0, compteId: 'chq', moyenPaiement: 'carte', frequence: 'mensuel', jours: [5], dateDebut: '2026-01-01', actif: true,
  categorieId: 'abonnements', ...p,
})
const cats = [
  { id: 'abonnements', nom: 'Abonnements', icone: '📺', couleur: '', ordre: 0, archivee: false },
  { id: 'abonnements/streaming', nom: 'Streaming', icone: '', couleur: '', parentId: 'abonnements', ordre: 0, archivee: false },
  { id: 'abonnements/applis', nom: 'Applis/logiciels', icone: '', couleur: '', parentId: 'abonnements', ordre: 1, archivee: false },
] as Categorie[]
const comptes = [{ id: 'chq', devise: 'CAD' }, { id: 'eur', devise: 'EUR' }] as Compte[]

describe('abonnements', () => {
  const recs = [
    rec({ id: 'nf', libelle: 'Netflix', montant: 2000, sousCategorieId: 'abonnements/streaming' }),
    rec({ id: 'dp', libelle: 'Disney+', montant: 1500, sousCategorieId: 'abonnements/streaming' }),
    rec({ id: 'sp', libelle: 'Spotify', montant: 1200, sousCategorieId: 'abonnements/streaming' }),
    rec({ id: 'ic', libelle: 'iCloud', montant: 400, sousCategorieId: 'abonnements/applis' }),
    rec({ id: 'fr', libelle: 'Box FR', montant: 3000, compteId: 'eur' }),
    rec({ id: 'pause', libelle: 'Ancien', montant: 999, actif: false, sousCategorieId: 'abonnements/streaming' }),
    rec({ id: 'loyer', libelle: 'Loyer', montant: 120000, categorieId: 'logement' }),
    rec({ id: 'credit', type: 'credit', libelle: 'Crédit', montant: 1, categorieId: 'abonnements' }),
  ]
  it('trouve la catégorie, même renommée par son identifiant, ou par son nom', () => {
    expect(categorieAbonnements(cats)?.id).toBe('abonnements')
    expect(categorieAbonnements([{ ...cats[0], id: 'x', nom: 'abonnement' }])?.id).toBe('x')
  })
  it('coût mensuel et annuel de chaque abonnement, en pause à la fin', () => {
    const l = abonnements(recs, comptes, 'abonnements')
    expect(l.map((x) => [x.recurrence.id, x.mensuel, x.annuel])).toEqual([
      ['fr', 3000, 36000], ['nf', 2000, 24000], ['dp', 1500, 18000], ['sp', 1200, 14400], ['ic', 400, 4800], ['pause', 999, 11988],
    ])
    expect(coutAnnuel({ frequence: '14_jours', montant: 1000 })).toBe(26000)
  })
  it('totaux par devise (actifs seulement)', () => {
    expect([...totauxAbonnements(abonnements(recs, comptes, 'abonnements'))]).toEqual([['CAD', { mensuel: 5100, annuel: 61200 }], ['EUR', { mensuel: 3000, annuel: 36000 }]])
  })
  it('alerte douce : plusieurs abonnements dans la même sous-catégorie', () => {
    const d = doublons(abonnements(recs, comptes, 'abonnements'), cats)
    expect(d.map((x) => [x.sousCategorie.nom, x.nombre, x.mensuel, x.devise])).toEqual([['Streaming', 3, 4700, 'CAD']])
  })
})
