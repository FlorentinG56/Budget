import { describe, expect, it } from 'vitest'
import {
  anneesEcoulees, coutTotal, decotePct, etatA, garantiesBientotFinies, tauxDuBien, totauxBiens, totauxParCategorie,
  valeurAvantSortie, valeurBien, valeurCalculee, valeurNette,
} from './biens'
import type { Bien } from './types'

const bien = (p: Partial<Bien>): Bien => ({
  id: 'b', nom: 'iPhone', categorie: 'telephone', origine: 'neuf', dateAcquisition: '2024-11-21', prixAchat: 100000, devise: 'CAD',
  etat: 'tres_bon', historiqueEtat: [], creeLe: 0, ...p,
})

describe('valeur d’un bien', () => {
  it('pourcentage par an sur la valeur restante, au jour près', () => {
    expect(anneesEcoulees('2024-11-21', '2026-11-21')).toBeCloseTo(730 / 365.25)
    // téléphone 30 % : 2 ans ≈ 1 000 × 0,7^1,9986
    expect(valeurCalculee(bien({}), '2026-11-21')).toBe(Math.round(100000 * Math.pow(0.7, 730 / 365.25)))
    expect(valeurCalculee(bien({}), '2024-11-21')).toBe(100000) // jour d'achat
    expect(valeurCalculee(bien({}), '2025-05-22')).toBeGreaterThan(80000) // un peu moins de 6 mois
  })

  it('plancher : 10 % par défaut, modifiable', () => {
    expect(valeurCalculee(bien({ dateAcquisition: '2010-01-01' }), '2026-11-21')).toBe(10000)
    expect(valeurCalculee(bien({ dateAcquisition: '2010-01-01', planchePct: 25 }), '2026-11-21')).toBe(25000)
    expect(valeurCalculee(bien({ dateAcquisition: '2010-01-01', planchePct: 0 }), '2026-11-21')).toBeLessThan(500)
  })

  it('coefficient d’état, et état à une date d’après l’historique', () => {
    const b = bien({ dateAcquisition: '2026-11-21', etat: 'abime', historiqueEtat: [
      { date: '2027-01-01', ancien: 'tres_bon', nouveau: 'use' }, { date: '2027-06-01', ancien: 'use', nouveau: 'abime', note: 'écran cassé' },
    ] })
    expect(etatA(b, '2026-12-01')).toBe('tres_bon')
    expect(etatA(b, '2027-03-01')).toBe('use')
    expect(etatA(b, '2027-06-01')).toBe('abime')
    expect(valeurCalculee({ ...b, historiqueEtat: [], etat: 'bon' }, '2026-11-21')).toBe(90000)
    expect(valeurCalculee({ ...b, historiqueEtat: [], etat: 'hors_service' }, '2026-11-21')).toBe(10000) // 0,10, au plancher
    expect(valeurCalculee(b, '2027-06-01')).toBe(Math.round(100000 * Math.pow(0.7, 192 / 365.25) * 0.55))
  })

  it('voiture : 20 % la 1re année puis 15 %', () => {
    const v = bien({ categorie: 'vehicule', prixAchat: 3000000, dateAcquisition: '2024-01-01' })
    expect(tauxDuBien(v)).toEqual({ taux: 15, tauxAnnee1: 20 })
    const un = '2024-12-31', deux = '2026-01-01'
    expect(valeurCalculee(v, un)).toBe(Math.round(3000000 * Math.pow(0.8, 365 / 365.25)))
    const a = anneesEcoulees('2024-01-01', deux)
    expect(valeurCalculee(v, deux)).toBe(Math.round(3000000 * 0.8 * Math.pow(0.85, a - 1)))
  })

  it('taux : celui du bien, sinon celui des Réglages, sinon celui de la catégorie', () => {
    expect(tauxDuBien(bien({}))).toEqual({ taux: 30 })
    expect(tauxDuBien(bien({}), { tauxBiens: { telephone: { taux: 25 } } })).toEqual({ taux: 25 })
    expect(tauxDuBien(bien({ taux: 40 }), { tauxBiens: { telephone: { taux: 25 } } })).toEqual({ taux: 40 })
    expect(tauxDuBien(bien({ categorie: 'vehicule', tauxAnnee1: 30 }), { tauxBiens: { vehicule: { taux: 10, tauxAnnee1: 25 } } })).toEqual({ taux: 10, tauxAnnee1: 30 })
    expect(valeurCalculee(bien({ categorie: 'bijoux', dateAcquisition: '2000-01-01' }), '2026-11-21')).toBe(100000) // 0 %
  })

  it('valeur manuelle : remplace le calcul à partir de sa date', () => {
    const b = bien({ categorie: 'bijoux', valeurManuelle: { montant: 250000, date: '2026-01-01' } })
    expect(valeurBien(b, '2025-12-31')).toBe(100000)
    expect(valeurBien(b, '2026-11-21')).toBe(250000)
  })

  it('0 avant l’acquisition et après la sortie ; valeur avant sortie pour une vente', () => {
    const b = bien({ sortie: { motif: 'vendu', date: '2025-11-21', prixVente: 60000 } })
    expect(valeurBien(b, '2024-01-01')).toBe(0)
    expect(valeurBien(b, '2025-11-21')).toBe(0)
    expect(valeurAvantSortie(b)).toBe(Math.round(100000 * Math.pow(0.7, 365 / 365.25)))
  })

  it('décote en %, coût total', () => {
    expect(decotePct(100000, 70000)).toBe(30)
    expect(decotePct(0, 0)).toBe(0)
    expect(coutTotal(bien({}), 15000)).toBe(115000)
  })
})

describe('totaux et valeur nette', () => {
  const biens = [
    bien({ id: 'a', dateAcquisition: '2026-11-21' }),
    bien({ id: 'b', categorie: 'ordinateur', prixAchat: 200000, dateAcquisition: '2026-11-21' }),
    bien({ id: 'c', devise: 'EUR', categorie: 'mobilier', prixAchat: 50000, dateAcquisition: '2026-11-21', etat: 'bon' }),
    bien({ id: 'd', sortie: { motif: 'donne', date: '2026-01-01' } }),
  ]
  it('par devise, sans conversion, biens sortis exclus', () => {
    expect([...totauxBiens(biens, '2026-11-21')]).toEqual([
      ['CAD', { achat: 300000, valeur: 300000, perte: 0, nombre: 2 }],
      ['EUR', { achat: 50000, valeur: 45000, perte: 5000, nombre: 1 }],
    ])
    expect(totauxParCategorie(biens, '2026-11-21').map((l) => [l.categorie, l.devise, l.totaux.valeur])).toEqual([
      ['ordinateur', 'CAD', 200000], ['telephone', 'CAD', 100000], ['mobilier', 'EUR', 45000],
    ])
  })
  it('valeur nette = épargne + biens − dettes', () => {
    const v = valeurNette(new Map([['CAD', 500000]]), totauxBiens(biens, '2026-11-21'), new Map([['CAD', 840000]]))
    expect([...v]).toEqual([['CAD', 500000 + 300000 - 840000], ['EUR', 45000]])
  })
  it('garantie : alerte dans les 30 jours seulement si une date est saisie', () => {
    const l = [bien({ id: 'g1', finGarantie: '2026-12-15' }), bien({ id: 'g2', finGarantie: '2027-03-01' }), bien({ id: 'g3' }),
      bien({ id: 'g4', finGarantie: '2026-11-01' }), bien({ id: 'g5', finGarantie: '2026-12-01', sortie: { motif: 'perdu', date: '2026-11-01' } })]
    expect(garantiesBientotFinies(l, '2026-11-21').map((b) => b.id)).toEqual(['g1'])
  })
})

describe('photos', () => {
  it('réduction à 1 600 px de côté au plus, sans agrandir', async () => {
    const { dimensionsReduites, tailleDataUrl } = await import('./biens')
    expect(dimensionsReduites(4032, 3024)).toEqual({ largeur: 1600, hauteur: 1200 })
    expect(dimensionsReduites(3024, 4032)).toEqual({ largeur: 1200, hauteur: 1600 })
    expect(dimensionsReduites(800, 600)).toEqual({ largeur: 800, hauteur: 600 })
    expect(tailleDataUrl('data:image/jpeg;base64,QUJD')).toBe(3)
    expect(tailleDataUrl('data:image/jpeg;base64,QUI=')).toBe(2)
  })
})

describe('vente', () => {
  it('gain ou perte par rapport à la valeur estimée et au prix d’achat', async () => {
    const { resultatVente } = await import('./biens')
    const b = bien({ dateAcquisition: '2025-11-21', sortie: { motif: 'vendu', date: '2026-11-21', prixVente: 75000 } })
    const estimee = Math.round(100000 * Math.pow(0.7, 365 / 365.25))
    expect(resultatVente(b)).toEqual({ valeurEstimee: estimee, parRapportEstimation: 75000 - estimee, parRapportAchat: -25000 })
    expect(resultatVente(bien({ sortie: { motif: 'donne', date: '2026-11-21' } }))).toBeUndefined()
  })
})

describe('F5 : courbe et tri', () => {
  it('courbe : 1er de chaque mois depuis la première acquisition, sorties prises en compte', async () => {
    const { courbeValeurBiens } = await import('./biens')
    const l = [
      bien({ id: 'a', categorie: 'bijoux', prixAchat: 10000, dateAcquisition: '2026-08-15' }),
      bien({ id: 'b', categorie: 'bijoux', prixAchat: 5000, dateAcquisition: '2026-09-10', sortie: { motif: 'donne', date: '2026-11-01' } }),
      bien({ id: 'e', devise: 'EUR', dateAcquisition: '2020-01-01' }),
    ]
    expect(courbeValeurBiens(l, 'CAD', '2026-11-21')).toEqual([
      { date: '2026-08-15', valeur: 10000 }, { date: '2026-09-01', valeur: 10000 }, { date: '2026-10-01', valeur: 15000 },
      { date: '2026-11-01', valeur: 10000 }, { date: '2026-11-21', valeur: 10000 },
    ])
    expect(courbeValeurBiens(l, 'EUR', '2026-11-21')).toHaveLength(84) // 2020-01-01 → 2026-11-01 (83 mois) + aujourd'hui
    expect(courbeValeurBiens([], 'CAD', '2026-11-21')).toEqual([])
  })
  it('tri par valeur, date, nom, catégorie', async () => {
    const { trierBiens } = await import('./biens')
    const l = [
      bien({ id: 'tv', nom: 'TV', categorie: 'tv_audio', prixAchat: 80000, dateAcquisition: '2026-01-01' }),
      bien({ id: 'mac', nom: 'Mac', categorie: 'ordinateur', prixAchat: 250000, dateAcquisition: '2024-05-01' }),
      bien({ id: 'tel', nom: 'iPhone', categorie: 'telephone', prixAchat: 140000, dateAcquisition: '2026-09-01' }),
    ]
    const ids = (t: 'valeur' | 'date' | 'nom' | 'categorie') => trierBiens(l, t, '2026-11-21').map((b) => b.id)
    expect(ids('valeur')).toEqual(['mac', 'tel', 'tv'])
    expect(ids('date')).toEqual(['tel', 'tv', 'mac'])
    expect(ids('nom')).toEqual(['tel', 'mac', 'tv'])
    expect(ids('categorie')).toEqual(['tel', 'mac', 'tv'])
  })
})

describe('F6 : proposer d’ajouter une dépense aux biens', () => {
  it('au moins 200 $, catégories concernées, pas les réparations ni l’essence', async () => {
    const { proposerAuxBiens } = await import('./biens')
    const d = (p: object) => ({ type: 'depense' as const, montant: 25000, categorieId: 'shopping', ...p })
    expect(proposerAuxBiens(d({}))).toBe(true)
    expect(proposerAuxBiens(d({ montant: 20000 }))).toBe(true)
    expect(proposerAuxBiens(d({ montant: 19999 }))).toBe(false)
    expect(proposerAuxBiens(d({ montant: 19999 }), 15000)).toBe(true)
    for (const c of ['transport', 'activite-pro', 'loisirs']) expect(proposerAuxBiens(d({ categorieId: c }))).toBe(true)
    expect(proposerAuxBiens(d({ categorieId: 'alimentation' }))).toBe(false)
    expect(proposerAuxBiens(d({ categorieId: undefined }))).toBe(false)
    expect(proposerAuxBiens(d({ categorieId: 'transport', sousCategorieId: 'transport/entretien-reparations' }))).toBe(false)
    expect(proposerAuxBiens(d({ bienId: 'x' }))).toBe(false)
    expect(proposerAuxBiens(d({ type: 'revenu' }))).toBe(false)
  })
})

describe('F8 : inventaire', () => {
  it('biens actifs par catégorie, valeur, état ; totaux par devise', async () => {
    const { inventaire } = await import('./biens')
    const l = [
      bien({ id: 'mac', nom: 'Mac', categorie: 'ordinateur', prixAchat: 250000, dateAcquisition: '2026-11-21', etat: 'bon' }),
      bien({ id: 'tel', nom: 'iPhone', dateAcquisition: '2026-11-21' }),
      bien({ id: 'v', nom: 'Vendu', sortie: { motif: 'vendu', date: '2026-01-01', prixVente: 1 } }),
    ]
    const r = inventaire(l, '2026-11-21')
    expect(r.lignes.map((x) => [x.bien.id, x.categorie, x.valeur, x.etat])).toEqual([
      ['tel', 'Téléphones, tablettes, montres connectées', 100000, 'Très bon'], ['mac', 'Ordinateurs', 225000, 'Bon'],
    ])
    expect(r.totaux.get('CAD')).toEqual({ achat: 350000, valeur: 325000, perte: 25000, nombre: 2 })
  })
  it('texte compatible PDF', async () => {
    const { textePdf } = await import('./biens')
    expect(textePdf('1 400,00 $ − l’iPhone 📱 « neuf »')).toBe("1 400,00 $ - l'iPhone « neuf »")
    expect(textePdf('5 000,00 €')).toBe('5 000,00 €')
  })
})
