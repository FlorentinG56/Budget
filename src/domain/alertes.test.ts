import { describe, expect, it } from 'vitest'
import { calculerAlertes, type ParamsAlertes } from './alertes'
import type { Recurrence } from './types'

const rec = (p: Partial<Recurrence>): Recurrence => ({
  id: 'r', type: 'charge_fixe', libelle: 'X', montant: 0, compteId: 'chq', moyenPaiement: 'compte', frequence: 'mensuel', jours: [1], dateDebut: '2026-01-01', actif: true, derniereEcheanceGeneree: '2026-11-28', ...p,
})
const base: ParamsAlertes = {
  aujourdhui: '2026-11-28', delaiJours: 2, recurrences: [], operations: [], comptes: [{ id: 'chq', devise: 'CAD' } as never, { id: 'ca', devise: 'EUR' } as never],
  devise: 'CAD', rappelSauvegardeJours: 14, sauvegardeDisponible: false, maintenant: new Date('2026-11-28T12:00:00').getTime(),
}
const textes = (p: Partial<ParamsAlertes>) => calculerAlertes({ ...base, ...p }).map((a) => a.texte.replace(/[  ]/g, ' '))

describe('bandeaux d’alerte', () => {
  it('charges dans les 2 prochains jours (pas au-delà, pas en pause)', () => {
    const recs = [
      rec({ id: 'loyer', libelle: 'Loyer', montant: 120000, jours: [30] }),
      rec({ id: 'assur', libelle: 'Assurance FR', montant: 4500, jours: [29], compteId: 'ca' }),
      rec({ id: 'loin', libelle: 'Internet', montant: 8000, jours: [5] }),
      rec({ id: 'pause', libelle: 'Gym', montant: 5000, jours: [29], actif: false }),
      rec({ id: 'paie', type: 'revenu', libelle: 'Salaire', montant: 180000, jours: [29] }),
    ]
    expect(textes({ recurrences: recs })).toEqual(['Demain : Assurance FR – 45,00 €', 'Dans 2 jours : Loyer – 1 200,00 $'])
    expect(textes({ recurrences: recs, delaiJours: 0 })).toEqual([])
  })
  it('budget du jour dépassé', () => {
    expect(textes({ resteAujourdhui: -1200 })).toEqual(['Budget du jour dépassé de 12,00 $'])
    expect(textes({ resteAujourdhui: 0 })).toEqual([])
  })
  it('solde projeté négatif ce soir', () => {
    const projection = new Map([['2026-11-28', { date: '2026-11-28', solde: -1, revenus: 0, charges: 0, depenseEstimee: 0 }]])
    expect(textes({ projection })).toEqual(['Solde projeté négatif ce soir'])
  })
  it('solde projeté négatif : le premier jour', () => {
    const projection = new Map([
      ['2026-11-28', { date: '2026-11-28', solde: 5000, revenus: 0, charges: 0, depenseEstimee: 0 }],
      ['2026-11-29', { date: '2026-11-29', solde: -100, revenus: 0, charges: 0, depenseEstimee: 0 }],
      ['2026-11-30', { date: '2026-11-30', solde: -900, revenus: 0, charges: 0, depenseEstimee: 0 }],
    ])
    expect(textes({ projection })).toEqual(['Solde projeté négatif le dimanche 29 novembre'])
    expect(calculerAlertes({ ...base, projection })[0].date).toBe('2026-11-29')
  })
  it('dernier paiement d’un crédit ce mois-ci ou le mois prochain', () => {
    const auto = rec({ id: 'auto', type: 'credit', libelle: 'Crédit auto', montant: 35000, jours: [28], dateFin: '2026-12-28', derniereEcheanceGeneree: '2026-11-28' })
    expect(textes({ recurrences: [auto] })).toEqual(['Dernier paiement du crédit auto le mois prochain (lundi 28 décembre)'])
    expect(textes({ recurrences: [{ ...auto, dateFin: '2027-03-28' }] })).toEqual([])
    // capital presque remboursé : la fin réelle arrive avant la date de fin
    expect(textes({ recurrences: [{ ...auto, dateFin: '2028-01-28', capitalRestantDu: 35000, capitalReferenceDate: '2026-11-28' }] }))
      .toEqual(['Dernier paiement du crédit auto le mois prochain (lundi 28 décembre)'])
  })
  it('rappel de sauvegarde selon la fréquence (seulement si la sauvegarde existe)', () => {
    const il_y_a = (j: number) => base.maintenant - j * 86_400_000
    expect(textes({ derniereSauvegarde: il_y_a(20) })).toEqual([])
    expect(textes({ sauvegardeDisponible: true, derniereSauvegarde: il_y_a(14) })).toEqual(['Dernière sauvegarde il y a 14 jours'])
    expect(textes({ sauvegardeDisponible: true, derniereSauvegarde: il_y_a(3) })).toEqual([])
    expect(textes({ sauvegardeDisponible: true })).toEqual(['Aucune sauvegarde : pense à en faire une'])
  })
})
