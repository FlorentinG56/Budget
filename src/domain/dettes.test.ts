import { describe, expect, it } from 'vitest'
import { dettes, totalDettes } from './dettes'
import { deplacerObjectif, ordonnerObjectifs, rythmeObjectif } from './epargne'
import type { Compte, ObjectifEpargne, Operation, Recurrence } from './types'

const comptes = [{ id: 'chq', devise: 'CAD' }, { id: 'eur', devise: 'EUR' }] as Compte[]
const credit = (p: Partial<Recurrence>): Recurrence => ({
  id: 'c', type: 'credit', libelle: 'Crédit auto', montant: 35000, compteId: 'chq', moyenPaiement: 'compte', frequence: 'mensuel', jours: [28],
  dateDebut: '2026-01-28', actif: true, derniereEcheanceGeneree: '2026-11-18', ...p,
})

describe('dettes', () => {
  it('capital restant, progression, dernière mensualité, mensualités restantes', () => {
    const auto = credit({ capitalRestantDu: 840000, capitalReferenceDate: '2026-11-18', capitalInitial: 1500000, dateFin: '2028-12-28', derniereEcheanceGeneree: '2026-11-28' })
    const ops = [{ id: 'x', date: '2026-11-28', montant: 35000, type: 'prelevement_fixe', compteId: 'chq', recurrenceId: 'c', partCapital: 35000, creeLe: 0 }] as Operation[]
    const [d] = dettes([auto], ops, comptes, '2026-11-30')
    expect(d.capitalRestant).toBe(805000)
    expect(d.progression).toBeCloseTo(1 - 805000 / 1500000)
    expect(d.mensualitesRestantes).toBe(23) // 805 000 / 35 000
    expect(d.derniereMensualite).toBe('2028-10-28') // capital remboursé avant la date de fin
  })
  it('crédits en pause ou remboursés exclus ; capital inconnu gardé ; total par devise', () => {
    const l = dettes([
      credit({ id: 'a', capitalRestantDu: 100000, capitalReferenceDate: '2026-11-18' }),
      credit({ id: 'b', compteId: 'eur', capitalRestantDu: 50000, capitalReferenceDate: '2026-11-18' }),
      credit({ id: 'c', dateFin: '2027-06-28' }),
      credit({ id: 'pause', actif: false, capitalRestantDu: 1 }),
      credit({ id: 'fini', capitalRestantDu: 0, capitalReferenceDate: '2026-11-18' }),
      { ...credit({ id: 'charge' }), type: 'charge_fixe' },
    ], [], comptes, '2026-11-18')
    expect(l.map((d) => d.recurrence.id).sort()).toEqual(['a', 'b', 'c'])
    expect([...totalDettes(l)]).toEqual([['CAD', 100000], ['EUR', 50000]])
  })
})

describe('projection et ordre des objectifs', () => {
  const obj = (p: Partial<ObjectifEpargne>): ObjectifEpargne => ({ id: 'o', nom: 'Voyage', compteId: 'chq', mouvements: [], archive: false, ...p })
  const mv = (date: string, montant: number, sens: 'mise_de_cote' | 'reprise' = 'mise_de_cote') => ({ id: date + sens, date, montant, sens })
  it('à ce rythme, atteint en…', () => {
    // 600 $ mis de côté sur 3 mois → 200 $/mois ; il manque 1 000 $ → 5 mois
    const o = obj({ montantCible: 200000, mouvements: [mv('2026-09-01', 30000), mv('2026-10-01', 20000), mv('2026-11-01', 10000), mv('2026-11-02', 5000, 'reprise'), mv('2026-05-01', 99999)] })
    expect(rythmeObjectif(o, 100000, '2026-11-18')).toEqual({ etat: 'projete', parMois: 20000, atteintLe: '2027-04-18' })
  })
  it('sans cible, atteint, ou pas encore de rythme', () => {
    expect(rythmeObjectif(obj({}), 100, '2026-11-18')).toEqual({ etat: 'sans_cible' })
    expect(rythmeObjectif(obj({ montantCible: 1000 }), 1000, '2026-11-18')).toEqual({ etat: 'atteint' })
    expect(rythmeObjectif(obj({ montantCible: 9000, mouvements: [mv('2026-05-01', 500)] }), 500, '2026-11-18')).toEqual({ etat: 'sans_rythme' })
  })
  it('ordre : Sécurité d’abord puis par nom, sauf ordre choisi ; déplacer', () => {
    const l = [obj({ id: 'v', nom: 'Voyage' }), obj({ id: 's', nom: 'Sécurité' }), obj({ id: 'a', nom: 'Auto' })]
    const parDefaut = ordonnerObjectifs(l, 's')
    expect(parDefaut.map((o) => o.id)).toEqual(['s', 'a', 'v'])
    const ordre = deplacerObjectif(parDefaut, 'v', -1)
    expect([...ordre]).toEqual([['s', 0], ['v', 1], ['a', 2]])
    const choisi = l.map((o) => ({ ...o, ordre: ordre.get(o.id) }))
    expect(ordonnerObjectifs(choisi, 's').map((o) => o.id)).toEqual(['s', 'v', 'a'])
    expect([...deplacerObjectif(ordonnerObjectifs(choisi, 's'), 's', 1)].map(([id]) => id)).toEqual(['v', 's', 'a']) // Sécurité peut descendre
    expect([...deplacerObjectif(parDefaut, 's', -1)].map(([id]) => id)).toEqual(['s', 'a', 'v']) // déjà en haut
  })
})
