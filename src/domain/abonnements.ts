import { equivalentMensuel } from './recurrences'
import type { Categorie, Centimes, Compte, Devise, Recurrence } from './types'

/** Suivi des abonnements (tâche E6) : charges fixes de la catégorie « Abonnements ». Fonctions pures. */

export const ID_ABONNEMENTS = 'abonnements'

/** La catégorie des abonnements : identifiant d'origine, sinon une catégorie principale nommée « Abonnement(s) ». */
export function categorieAbonnements(categories: Categorie[]): Categorie | undefined {
  return categories.find((c) => c.id === ID_ABONNEMENTS) ?? categories.find((c) => !c.parentId && /^abonnements?$/i.test(c.nom.trim()))
}

export function coutAnnuel(r: Pick<Recurrence, 'frequence' | 'montant'>): Centimes {
  if (r.frequence === '14_jours') return r.montant * 26
  if (r.frequence === 'deux_dates_par_mois') return r.montant * 24
  return r.montant * 12
}

export interface LigneAbonnement { recurrence: Recurrence; devise: Devise; mensuel: Centimes; annuel: Centimes }

export function abonnements(recurrences: Recurrence[], comptes: Compte[], categorieId: string | undefined): LigneAbonnement[] {
  if (!categorieId) return []
  const devises = new Map(comptes.map((c) => [c.id, c.devise]))
  return recurrences
    .filter((r) => r.type === 'charge_fixe' && r.categorieId === categorieId && devises.has(r.compteId))
    .map((r) => ({ recurrence: r, devise: devises.get(r.compteId)!, mensuel: equivalentMensuel(r), annuel: coutAnnuel(r) }))
    .sort((a, b) => Number(!a.recurrence.actif) - Number(!b.recurrence.actif) || b.mensuel - a.mensuel)
}

/** Totaux mensuel et annuel par devise (abonnements actifs). */
export function totauxAbonnements(lignes: LigneAbonnement[]): Map<Devise, { mensuel: Centimes; annuel: Centimes }> {
  const t = new Map<Devise, { mensuel: Centimes; annuel: Centimes }>()
  for (const l of lignes) {
    if (!l.recurrence.actif) continue
    const x = t.get(l.devise) ?? { mensuel: 0, annuel: 0 }
    t.set(l.devise, { mensuel: x.mensuel + l.mensuel, annuel: x.annuel + l.annuel })
  }
  return new Map([...t].sort((a) => (a[0] === 'CAD' ? -1 : 1)))
}

/** Plusieurs abonnements actifs dans la même sous-catégorie (et la même devise) : « 3 abonnements Streaming : 47 $/mois ». */
export function doublons(lignes: LigneAbonnement[], categories: Categorie[]): { sousCategorie: Categorie; nombre: number; mensuel: Centimes; devise: Devise }[] {
  const noms = new Map(categories.map((c) => [c.id, c]))
  const groupes = new Map<string, LigneAbonnement[]>()
  for (const l of lignes) {
    const s = l.recurrence.sousCategorieId
    if (!l.recurrence.actif || !s || !noms.has(s)) continue
    const k = `${s}|${l.devise}`
    groupes.set(k, [...(groupes.get(k) ?? []), l])
  }
  return [...groupes.values()].filter((g) => g.length >= 2).map((g) => ({
    sousCategorie: noms.get(g[0].recurrence.sousCategorieId!)!, nombre: g.length, devise: g[0].devise, mensuel: g.reduce((s, l) => s + l.mensuel, 0),
  })).sort((a, b) => b.mensuel - a.mensuel)
}
