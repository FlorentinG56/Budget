import { describe, expect, it } from 'vitest'
import { depensesBudget } from './budget'
import { epargneReservee, historiqueObjectif, parMoisPourAtteindre, progressionObjectif, soldeObjectif, totalParDevise } from './epargne'
import type { Compte, ObjectifEpargne, Operation } from './types'

const obj = (p: Partial<ObjectifEpargne>): ObjectifEpargne => ({ id: 'sec', nom: 'Sécurité', compteId: 'chq', mouvements: [], archive: false, ...p })
const mv = (montant: number, sens: 'mise_de_cote' | 'reprise' = 'mise_de_cote', p = {}) => ({ id: `m${montant}${sens}`, date: '2026-11-25', montant, sens, ...p })
const op = (p: Partial<Operation>): Operation => ({ id: 'o', date: '2026-11-26', montant: 0, type: 'depense', compteId: 'chq', creeLe: 0, ...p })

describe('épargne virtuelle', () => {
  const securite = obj({ mouvements: [mv(10345, 'mise_de_cote', { source: 'paie:p-2026-11-25' }), mv(47750, 'mise_de_cote', { source: 'bilan:p-2026-11-11' }), mv(5000, 'reprise')] })
  const imprevu = op({ id: 'garage', montant: 20000, objectifEpargneId: 'sec', note: 'Garage' })

  it('solde : mises de côté − reprises − dépenses payées avec l’épargne', () => {
    expect(soldeObjectif(securite, [])).toBe(53095)
    expect(soldeObjectif(securite, [imprevu])).toBe(33095)
  })
  it('une dépense payée avec l’épargne ne compte pas dans le budget du jour', () => {
    expect(depensesBudget([imprevu, op({ id: 'cafe', montant: 500 })], new Set(['chq']), '2026-11-25', '2026-12-08')).toBe(500)
  })
  it('réservé par compte, total par devise', () => {
    const france = obj({ id: 'fr', nom: 'Épargne', compteId: 'ca', mouvements: [mv(500000)] })
    const archive = obj({ id: 'old', compteId: 'chq', mouvements: [mv(99999)], archive: true })
    const comptes = [{ id: 'chq', devise: 'CAD' }, { id: 'ca', devise: 'EUR' }] as Compte[]
    expect(epargneReservee([securite, france, archive], [imprevu], 'chq')).toBe(33095)
    expect([...totalParDevise([securite, france, archive], [imprevu], comptes)]).toEqual([['CAD', 33095], ['EUR', 500000]])
    expect([...totalParDevise([france, securite], [], comptes)].map(([d]) => d)).toEqual(['CAD', 'EUR']) // ordre stable
  })
  it('progression et montant par mois pour atteindre la cible', () => {
    expect(progressionObjectif(25000, 100000)).toBe(0.25)
    expect(progressionObjectif(25000)).toBeUndefined()
    expect(parMoisPourAtteindre(25000, 100000, '2027-05-15', '2026-11-17')).toBe(12500) // 750 $ sur 6 mois
    expect(parMoisPourAtteindre(100000, 100000, '2027-05-15', '2026-11-17')).toBeUndefined()
    expect(parMoisPourAtteindre(0, 100000, '2026-11-30', '2026-11-17')).toBe(100000) // moins d'un mois : tout
  })
  it('historique : mouvements et dépenses, le plus récent d’abord', () => {
    const h = historiqueObjectif(securite, [imprevu])
    expect(h.map((l) => [l.libelle, l.montant])).toEqual([
      ['Garage', -20000], ['Mis de côté à la paie', 10345], ['Reste de la période', 47750], ['Repris', -5000],
    ])
  })
})
