import { addMonths, differenceInCalendarMonths, parseISO, subMonths } from 'date-fns'
import { versISO } from './dates'
import { soldeCompte } from './soldes'
import type { Centimes, Compte, DateISO, Devise, ObjectifEpargne, Operation } from './types'

/**
 * Épargne virtuelle (cahier des charges, « Épargne virtuelle ») : des enveloppes qui réservent une partie
 * du solde d'un compte. L'argent ne quitte jamais le compte. Fonctions pures, testées dans epargne.test.ts.
 */

/** Solde d'un objectif : mises de côté − reprises − dépenses payées avec cette épargne (jusqu'à une date, incluse, si donnée). */
export function soldeObjectif(o: ObjectifEpargne, operations: Operation[], jusquAu?: DateISO): Centimes {
  const mouvements = o.mouvements.filter((m) => !jusquAu || m.date <= jusquAu).reduce((s, m) => s + (m.sens === 'mise_de_cote' ? m.montant : -m.montant), 0)
  const depenses = operations.filter((op) => op.objectifEpargneId === o.id && (!jusquAu || op.date <= jusquAu)).reduce((s, op) => s + op.montant, 0)
  return mouvements - depenses
}

export function progressionObjectif(solde: Centimes, cible?: Centimes): number | undefined {
  if (!cible) return undefined
  return Math.min(1, Math.max(0, solde / cible))
}

/** Épargne réservée sur un compte (objectifs non archivés). */
export function epargneReservee(objectifs: ObjectifEpargne[], operations: Operation[], compteId: string): Centimes {
  return objectifs.filter((o) => o.compteId === compteId && !o.archive).reduce((s, o) => s + soldeObjectif(o, operations), 0)
}

/** Total de l'épargne par devise (pas de conversion : 3 200 $ + 5 000 €). */
export function totalParDevise(objectifs: ObjectifEpargne[], operations: Operation[], comptes: Compte[]): Map<Devise, Centimes> {
  const devises = new Map(comptes.map((c) => [c.id, c.devise]))
  const total = new Map<Devise, Centimes>()
  for (const o of objectifs) {
    if (o.archive) continue
    const d = devises.get(o.compteId)
    if (d) total.set(d, (total.get(d) ?? 0) + soldeObjectif(o, operations))
  }
  // ordre stable à l'affichage : dollars puis euros
  const ordre: Devise[] = ['CAD', 'EUR']
  return new Map([...total].sort((a, b) => ordre.indexOf(a[0]) - ordre.indexOf(b[0])))
}

/** Montant à mettre de côté par mois pour atteindre la cible à la date cible (undefined si sans objet). */
export function parMoisPourAtteindre(solde: Centimes, cible: Centimes | undefined, dateCible: DateISO | undefined, aujourdhui: DateISO): Centimes | undefined {
  if (!cible || !dateCible || solde >= cible) return undefined
  const mois = Math.max(1, differenceInCalendarMonths(parseISO(dateCible), parseISO(aujourdhui)))
  return Math.ceil((cible - solde) / mois)
}

export interface LigneHistorique {
  date: DateISO
  montant: Centimes // signé : + mise de côté, − reprise ou dépense
  libelle: string
  operationId?: string
  mouvementId?: string
}

/** Historique d'un objectif (mouvements et dépenses payées avec l'épargne), le plus récent d'abord. */
export function historiqueObjectif(o: ObjectifEpargne, operations: Operation[]): LigneHistorique[] {
  const lignes: LigneHistorique[] = [
    ...o.mouvements.map((m) => ({
      date: m.date, mouvementId: m.id,
      montant: m.sens === 'mise_de_cote' ? m.montant : -m.montant,
      libelle: m.note || (m.source?.startsWith('fin:') ? 'Fin de quinzaine' : m.source?.startsWith('virement:') ? (m.sens === 'reprise' ? 'Retiré du compte épargne' : 'Épargné') : m.source?.startsWith('paie:') ? 'Mis de côté à la paie' : m.source?.startsWith('bilan:') ? 'Reste de la période' : m.source?.startsWith('acote:') ? 'Reste « à côté du budget »' : m.sens === 'mise_de_cote' ? 'Mis de côté' : 'Repris'),
    })),
    ...operations.filter((op) => op.objectifEpargneId === o.id).map((op) => ({
      date: op.date, operationId: op.id, montant: -op.montant, libelle: op.note || 'Imprévu payé avec cet argent',
    })),
  ]
  return lignes.sort((a, b) => b.date.localeCompare(a.date))
}

// ---------- Projection d'un objectif ----------

export type Rythme =
  | { etat: 'sans_cible' }
  | { etat: 'atteint' }
  | { etat: 'sans_rythme' } // aucune mise de côté sur les 3 derniers mois
  | { etat: 'projete'; parMois: Centimes; atteintLe: DateISO }

/**
 * « À ce rythme, atteint en juin 2027 » : moyenne mensuelle des mises de côté des 3 derniers mois
 * (reprises non déduites), appliquée à ce qui manque pour atteindre la cible.
 */
export function rythmeObjectif(o: ObjectifEpargne, solde: Centimes, aujourdhui: DateISO): Rythme {
  if (!o.montantCible) return { etat: 'sans_cible' }
  if (solde >= o.montantCible) return { etat: 'atteint' }
  const debut = versISO(subMonths(parseISO(aujourdhui), 3))
  const misDeCote = o.mouvements.filter((m) => m.sens === 'mise_de_cote' && m.date > debut && m.date <= aujourdhui).reduce((s, m) => s + m.montant, 0)
  if (misDeCote <= 0) return { etat: 'sans_rythme' }
  const parMois = Math.round(misDeCote / 3)
  const mois = Math.ceil((o.montantCible - solde) / parMois)
  return { etat: 'projete', parMois, atteintLe: versISO(addMonths(parseISO(aujourdhui), mois)) }
}

// ---------- Ordre des objectifs ----------

/** Ordre d'affichage : l'ordre choisi s'il existe, sinon Sécurité d'abord puis par nom. */
export function ordonnerObjectifs(objectifs: ObjectifEpargne[], securiteId?: string): ObjectifEpargne[] {
  const parDefaut = (a: ObjectifEpargne, b: ObjectifEpargne) =>
    (a.id === securiteId ? -1 : b.id === securiteId ? 1 : 0) || a.nom.localeCompare(b.nom, 'fr')
  return [...objectifs].sort((a, b) => {
    if (a.ordre !== undefined && b.ordre !== undefined) return a.ordre - b.ordre
    if (a.ordre !== undefined) return -1
    if (b.ordre !== undefined) return 1
    return parDefaut(a, b)
  })
}

/** Déplace un objectif d'un cran (−1 : monter, +1 : descendre). Renvoie le nouvel ordre de chacun (0, 1, 2…). */
export function deplacerObjectif(ordonnes: ObjectifEpargne[], id: string, sens: -1 | 1): Map<string, number> {
  const ids = ordonnes.map((o) => o.id)
  const i = ids.indexOf(id)
  const j = i + sens
  if (i >= 0 && j >= 0 && j < ids.length) [ids[i], ids[j]] = [ids[j], ids[i]]
  return new Map(ids.map((x, k) => [x, k]))
}

// ---------- Sécurité et épargne réelle (fonctions pures) ----------
//
// Sécurité : argent laissé sur le compte principal, mis de côté pour les imprévus (enregistrée dans l'objectif Sécurité).
// Épargne : le solde réel des comptes de type « épargne ». Les projets (PS5, voyage…) en répartissent le total,
// virtuellement : ils ne changent aucun compte.

export const CIBLE_SECURITE_DEFAUT: Centimes = 200000

/** Comptes épargne (non archivés). */
export function comptesEpargne(comptes: Compte[]): Compte[] {
  return comptes.filter((c) => c.type === 'epargne' && !c.archive)
}

const ORDRE_DEVISES: Devise[] = ['CAD', 'EUR']
const trierDevises = (m: Map<Devise, Centimes>) => new Map([...m].sort((a, b) => ORDRE_DEVISES.indexOf(a[0]) - ORDRE_DEVISES.indexOf(b[0])))

/** Total épargné : solde réel des comptes épargne, par devise. */
export function totalEpargne(comptes: Compte[], operations: Operation[], date: DateISO): Map<Devise, Centimes> {
  const total = new Map<Devise, Centimes>()
  for (const c of comptesEpargne(comptes)) total.set(c.devise, (total.get(c.devise) ?? 0) + soldeCompte(c, operations, date))
  return trierDevises(total)
}

/** Projets d'épargne : objectifs (non archivés) posés sur un compte épargne. */
export function projetsEpargne(objectifs: ObjectifEpargne[], comptes: Compte[]): ObjectifEpargne[] {
  const ids = new Set(comptesEpargne(comptes).map((c) => c.id))
  return objectifs.filter((o) => !o.archive && ids.has(o.compteId))
}

/** Épargne qui n'est dans aucun projet, par devise : total épargné − montants des projets. */
export function epargneNonRepartie(comptes: Compte[], objectifs: ObjectifEpargne[], operations: Operation[], date: DateISO): Map<Devise, Centimes> {
  const reste = totalEpargne(comptes, operations, date)
  const devises = new Map(comptes.map((c) => [c.id, c.devise]))
  for (const o of projetsEpargne(objectifs, comptes)) {
    const d = devises.get(o.compteId)!
    reste.set(d, (reste.get(d) ?? 0) - soldeObjectif(o, operations))
  }
  return trierDevises(reste)
}

/** Disponible = solde du compte − dû sur la carte − sécurité. */
export function disponible(solde: Centimes, duCarte: Centimes, securite: Centimes): Centimes {
  return solde - Math.max(0, duCarte) - securite
}

/** Fin de quinzaine : ce qu'il reste à décider (le soir du dernier jour) = solde − dû carte − sécurité déjà là. */
export const resteFinQuinzaine = disponible

/**
 * Répartition du reste de fin de quinzaine : la part épargnée (bornée entre 0 et le reste), le reste en sécurité.
 * Sans compte épargne, tout va en sécurité. Reste ≤ 0 : rien à répartir.
 */
export function repartirFinQuinzaine(reste: Centimes, epargne: Centimes, avecCompteEpargne: boolean): { epargne: Centimes; securite: Centimes } {
  if (reste <= 0) return { epargne: 0, securite: 0 }
  const e = avecCompteEpargne ? Math.min(reste, Math.max(0, Math.round(epargne))) : 0
  return { epargne: e, securite: reste - e }
}

/** Part du solde du compte que représente la sécurité (0 à 1). */
export function partDuSolde(securite: Centimes, solde: Centimes): number {
  if (solde <= 0) return securite > 0 ? 1 : 0
  return Math.min(1, Math.max(0, securite / solde))
}

/** Anciens objectifs à convertir : objectifs actifs, hors Sécurité, qui ne sont pas sur un compte épargne. */
export function objectifsAConvertir(objectifs: ObjectifEpargne[], comptes: Compte[], securiteId?: string): ObjectifEpargne[] {
  const epargne = new Set(comptesEpargne(comptes).map((c) => c.id))
  return objectifs.filter((o) => !o.archive && o.id !== securiteId && !epargne.has(o.compteId))
}

// ---------- Imprévu : « Payé comment ? » ----------

/** '' : comptée dans le budget du jour ; sinon imprévu payé avec le solde (ou la carte), la sécurité, l'épargne (et un projet). */
export type ChoixImprevu = '' | 'solde' | 'securite' | 'epargne' | `projet:${string}` | `objectif:${string}`

/** Une dépense hors budget du jour (imprévu) : toujours dans sa catégorie. */
export function estImprevu(op: Operation): boolean {
  return !!(op.objectifEpargneId || op.horsBudget || op.epargneCompteId)
}

export function choixImprevu(op: Operation, securiteId?: string): ChoixImprevu {
  if (op.epargneCompteId) return op.objectifEpargneId ? `projet:${op.objectifEpargneId}` : 'epargne'
  if (op.objectifEpargneId) return op.objectifEpargneId === securiteId ? 'securite' : `objectif:${op.objectifEpargneId}`
  return op.horsBudget ? 'solde' : ''
}

/** Champs de la dépense pour un choix (compteEpargneId : compte épargne utilisé pour « épargne » et les projets). */
export function champsImprevu(choix: ChoixImprevu, securiteId: string | undefined, compteEpargneId: string | undefined):
  Pick<Operation, 'horsBudget' | 'objectifEpargneId' | 'epargneCompteId'> {
  const vide = { horsBudget: undefined, objectifEpargneId: undefined, epargneCompteId: undefined }
  if (choix === 'solde') return { ...vide, horsBudget: true }
  if (choix === 'securite') return securiteId ? { ...vide, objectifEpargneId: securiteId } : vide
  if (choix === 'epargne') return compteEpargneId ? { ...vide, epargneCompteId: compteEpargneId } : vide
  if (choix.startsWith('projet:')) return compteEpargneId ? { ...vide, epargneCompteId: compteEpargneId, objectifEpargneId: choix.slice(7) } : vide
  if (choix.startsWith('objectif:')) return { ...vide, objectifEpargneId: choix.slice(9) }
  return vide
}
