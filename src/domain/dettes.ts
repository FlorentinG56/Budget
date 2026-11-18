import { capitalRestant, finEffectiveCredit, mensualitesRestantes, progressionCredit } from './recurrences'
import type { Centimes, Compte, DateISO, Devise, Operation, Recurrence } from './types'

/** Section « Dettes » de l'onglet Épargne : les crédits actifs et leur état. */
export interface Dette {
  recurrence: Recurrence
  devise: Devise
  capitalRestant?: Centimes // non renseigné : inconnu
  progression?: number // 0 → 1 (montant emprunté → 0)
  derniereMensualite?: DateISO
  mensualitesRestantes?: number
}

export function dettes(recurrences: Recurrence[], operations: Operation[], comptes: Compte[], aujourdhui: DateISO): Dette[] {
  const devises = new Map(comptes.map((c) => [c.id, c.devise]))
  return recurrences
    .filter((r) => r.type === 'credit' && r.actif && devises.has(r.compteId))
    .map((r) => {
      const capital = capitalRestant(r, operations)
      const finCapital = finEffectiveCredit(r, operations)
      const fin = [finCapital, r.dateFin].filter((x): x is DateISO => !!x).sort()[0]
      return {
        recurrence: r, devise: devises.get(r.compteId)!, capitalRestant: capital,
        progression: progressionCredit(r.capitalInitial, capital),
        derniereMensualite: fin, mensualitesRestantes: mensualitesRestantes(r, capital, aujourdhui),
      }
    })
    .filter((d) => d.capitalRestant === undefined || d.capitalRestant > 0)
    .sort((a, b) => (a.derniereMensualite ?? '9999').localeCompare(b.derniereMensualite ?? '9999'))
}

/** Total du capital restant dû par devise (crédits dont le capital est renseigné). */
export function totalDettes(liste: Dette[]): Map<Devise, Centimes> {
  const t = new Map<Devise, Centimes>()
  for (const d of liste) if (d.capitalRestant !== undefined) t.set(d.devise, (t.get(d.devise) ?? 0) + d.capitalRestant)
  return new Map([...t].sort((a, b) => (a[0] === 'CAD' ? -1 : b[0] === 'CAD' ? 1 : 0)))
}
