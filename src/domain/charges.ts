import { endOfMonth, parseISO, startOfMonth } from 'date-fns'
import { versISO } from './dates'
import { echeancesAVenir, equivalentMensuel, prochainesEcheances, lendemain } from './recurrences'
import type { Categorie, Centimes, DateISO, Operation, Recurrence } from './types'

/** Liste des charges fixes et crédits : tri, filtres et totaux (Réglages → Charges fixes et crédits). */

export type Tri = 'jour' | 'prochain' | 'montant_desc' | 'montant_asc' | 'nom' | 'categorie'

export const LIBELLES_TRI: Record<Tri, string> = {
  jour: 'Jour de prélèvement', prochain: 'Prochain prélèvement', montant_desc: 'Montant (du plus gros)',
  montant_asc: 'Montant (du plus petit)', nom: 'Nom (A → Z)', categorie: 'Catégorie',
}

/** Prochaine échéance (à partir de demain si celle d'aujourd'hui est déjà traitée). */
export function prochaineDate(r: Recurrence, aujourdhui: DateISO): DateISO | undefined {
  if (!r.actif) return undefined
  const depuis = r.derniereEcheanceGeneree && r.derniereEcheanceGeneree >= aujourdhui ? lendemain(r.derniereEcheanceGeneree) : aujourdhui
  return prochainesEcheances(r, depuis, 1)[0]
}

export function trier(recurrences: Recurrence[], tri: Tri, aujourdhui: DateISO, categories: Map<string, Categorie>): Recurrence[] {
  const nom = (r: Recurrence) => r.libelle.toLocaleLowerCase('fr')
  const jour = (r: Recurrence) => (r.frequence === '14_jours' ? Number(r.dateDebut.slice(8)) : r.jours[0] ?? 99)
  const cmp: Record<Tri, (a: Recurrence, b: Recurrence) => number> = {
    jour: (a, b) => jour(a) - jour(b),
    prochain: (a, b) => (prochaineDate(a, aujourdhui) ?? '9999').localeCompare(prochaineDate(b, aujourdhui) ?? '9999'),
    montant_desc: (a, b) => b.montant - a.montant,
    montant_asc: (a, b) => a.montant - b.montant,
    nom: () => 0,
    categorie: (a, b) => {
      const ca = categories.get(a.categorieId ?? '')?.nom
      const cb = categories.get(b.categorieId ?? '')?.nom
      if (!ca || !cb) return Number(!ca) - Number(!cb) // sans catégorie : à la fin
      return ca.localeCompare(cb, 'fr')
    },
  }
  // les récurrences en pause passent après ; à égalité, ordre alphabétique
  return [...recurrences].sort((a, b) => Number(!a.actif) - Number(!b.actif) || cmp[tri](a, b) || nom(a).localeCompare(nom(b), 'fr'))
}

/** Total mensuel des récurrences actives (paies aux 2 semaines lissées sur l'année). */
export function totalMensuel(recurrences: Recurrence[]): Centimes {
  return recurrences.filter((r) => r.actif).reduce((s, r) => s + equivalentMensuel(r), 0)
}

/** Déjà prélevé ce mois-ci (opérations générées ou confirmées de ces récurrences). */
export function prelevesCeMois(recurrences: Recurrence[], operations: Operation[], aujourdhui: DateISO): Centimes {
  const ids = new Set(recurrences.map((r) => r.id))
  const debut = versISO(startOfMonth(parseISO(aujourdhui)))
  return operations.filter((o) => o.recurrenceId && ids.has(o.recurrenceId) && o.date >= debut && o.date <= aujourdhui)
    .reduce((s, o) => s + o.montant, 0)
}

/** Reste à prélever d'ici la fin du mois (échéances à venir des récurrences actives). */
export function resteAPreleverCeMois(recurrences: Recurrence[], operations: Operation[], aujourdhui: DateISO): Centimes {
  const fin = versISO(endOfMonth(parseISO(aujourdhui)))
  return recurrences.reduce((s, r) => s + echeancesAVenir(r, operations, aujourdhui, fin).length * r.montant, 0)
}

/** La prochaine charge à venir parmi les récurrences actives. */
export function prochaineCharge(recurrences: Recurrence[], aujourdhui: DateISO): { recurrence: Recurrence; date: DateISO } | undefined {
  let meilleure: { recurrence: Recurrence; date: DateISO } | undefined
  for (const r of recurrences) {
    const d = prochaineDate(r, aujourdhui)
    if (d && (!meilleure || d < meilleure.date)) meilleure = { recurrence: r, date: d }
  }
  return meilleure
}
