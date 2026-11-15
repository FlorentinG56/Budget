import { addDays, differenceInCalendarDays, getDaysInMonth, parseISO } from 'date-fns'
import { versISO } from './dates'
import type { Centimes, DateISO, Operation, Recurrence } from './types'

export const JOUR_FIN_DE_MOIS = 31

/** Jour J d'un mois donné, ramené au dernier jour si le mois est plus court (31 → 30, 28 ou 29). */
export function dateDuMois(annee: number, mois0: number, jour: number): DateISO {
  const j = Math.min(jour, getDaysInMonth(new Date(annee, mois0, 1)))
  return versISO(new Date(annee, mois0, j))
}

export function lendemain(d: DateISO): DateISO {
  return versISO(addDays(parseISO(d), 1))
}

export function veille(d: DateISO): DateISO {
  return versISO(addDays(parseISO(d), -1))
}

/** Toutes les échéances d'une récurrence entre deux dates (incluses), dans l'ordre. Ignore l'état actif. */
export function echeancesEntre(rec: Pick<Recurrence, 'frequence' | 'jours' | 'dateDebut' | 'dateFin'>, du: DateISO, au: DateISO): DateISO[] {
  const debut = du > rec.dateDebut ? du : rec.dateDebut
  const fin = rec.dateFin && rec.dateFin < au ? rec.dateFin : au
  if (debut > fin) return []
  const resultat: DateISO[] = []

  if (rec.frequence === '14_jours') {
    const ref = parseISO(rec.dateDebut)
    const ecart = differenceInCalendarDays(parseISO(debut), ref)
    let k = Math.max(0, Math.ceil(ecart / 14))
    for (;;) {
      const d = versISO(addDays(ref, 14 * k++))
      if (d > fin) break
      resultat.push(d)
    }
    return resultat
  }

  const jours = rec.frequence === 'mensuel' ? rec.jours.slice(0, 1) : rec.jours
  const d0 = parseISO(debut)
  const dFin = parseISO(fin)
  for (let a = d0.getFullYear(), m = d0.getMonth(); a < dFin.getFullYear() || (a === dFin.getFullYear() && m <= dFin.getMonth()); m === 11 ? (a++, m = 0) : m++) {
    const duMois = [...new Set(jours.map((j) => dateDuMois(a, m, j)))].sort()
    for (const d of duMois) if (d >= debut && d <= fin) resultat.push(d)
  }
  return resultat
}

/** Les prochaines échéances à partir d'une date (incluse). */
export function prochainesEcheances(rec: Recurrence, apartirDu: DateISO, nombre: number): DateISO[] {
  const fin = versISO(addDays(parseISO(apartirDu), 400))
  return echeancesEntre(rec, apartirDu, fin).slice(0, nombre)
}

/** Échéances passées pas encore transformées en opérations (rattrapage), jusqu'à aujourd'hui inclus. */
export function echeancesAGenerer(rec: Recurrence, aujourdhui: DateISO): DateISO[] {
  if (!rec.actif) return []
  const depuis = rec.derniereEcheanceGeneree ? lendemain(rec.derniereEcheanceGeneree) : rec.dateDebut
  return echeancesEntre(rec, depuis, aujourdhui)
}

// ---------- Crédits ----------

export interface Mensualite {
  interets: Centimes
  partCapital: Centimes
  capitalApres: Centimes
}

/**
 * Une mensualité : si le taux est connu, intérêts du mois = capital × taux / 12 et le capital baisse
 * de (mensualité − intérêts). Sinon le capital baisse de la mensualité entière. Jamais sous zéro.
 */
export function appliquerMensualite(capital: Centimes, mensualite: Centimes, tauxAnnuel?: number): Mensualite {
  const interets = tauxAnnuel ? Math.round((capital * tauxAnnuel) / 100 / 12) : 0
  const partCapital = Math.max(0, Math.min(capital, mensualite - interets))
  return { interets, partCapital, capitalApres: capital - partCapital }
}

/** Capital restant dû aujourd'hui : capital de référence moins les parts capital des mensualités prélevées depuis. */
export function capitalRestant(rec: Recurrence, operations: Operation[]): Centimes | undefined {
  if (rec.capitalRestantDu === undefined) return undefined
  const ref = rec.capitalReferenceDate ?? ''
  const rembourse = operations
    .filter((o) => o.recurrenceId === rec.id && o.date > ref)
    .reduce((s, o) => s + (o.partCapital ?? 0), 0)
  return Math.max(0, rec.capitalRestantDu - rembourse)
}

/**
 * Mensualités restantes après aujourd'hui. Avec une date de fin : nombre d'échéances jusqu'à elle.
 * Sinon, simulation à partir du capital (plafonnée à 50 ans). Undefined si on ne peut pas savoir.
 */
export function mensualitesRestantes(rec: Recurrence, capital: Centimes | undefined, aujourdhui: DateISO): number | undefined {
  if (rec.dateFin) {
    let n = echeancesEntre(rec, lendemain(aujourdhui), rec.dateFin).length
    if (capital !== undefined) n = Math.min(n, simulerNombre(capital, rec.montant, rec.tauxAnnuel))
    return n
  }
  if (capital === undefined) return undefined
  const n = simulerNombre(capital, rec.montant, rec.tauxAnnuel)
  return Number.isFinite(n) ? n : undefined
}

function simulerNombre(capital: Centimes, mensualite: Centimes, taux?: number): number {
  let c = capital
  let n = 0
  while (c > 0 && n < 600) {
    const m = appliquerMensualite(c, mensualite, taux)
    if (m.partCapital <= 0) return Infinity // la mensualité ne couvre pas les intérêts
    c = m.capitalApres
    n++
  }
  return c > 0 ? Infinity : n
}

/** Progression d'un crédit entre 0 et 1. */
export function progressionCredit(capitalInitial: Centimes | undefined, restant: Centimes | undefined): number | undefined {
  if (!capitalInitial || restant === undefined) return undefined
  return Math.min(1, Math.max(0, 1 - restant / capitalInitial))
}

// ---------- Génération des opérations ----------

/**
 * Transforme les échéances dues en opérations (pur : ne touche pas la base).
 * - charge fixe / crédit : « prélèvement fixe » sur le compte, ou sur la carte si payée par carte
 * - revenu : « revenu » sur le compte
 * - crédit : calcule la part capital échéance par échéance ; s'arrête quand le capital est remboursé
 * Renvoie aussi la date jusqu'à laquelle la récurrence est traitée.
 */
export function genererOperations(rec: Recurrence, aujourdhui: DateISO, operationsExistantes: Operation[], nouvelId: () => string, maintenant: number):
  { operations: Operation[]; traiteeJusquAu?: DateISO } {
  const dates = echeancesAGenerer(rec, aujourdhui)
  if (dates.length === 0) return { operations: [] }
  let capital = rec.type === 'credit' ? capitalRestant(rec, operationsExistantes) : undefined
  const operations: Operation[] = []
  for (const date of dates) {
    if (capital !== undefined && capital <= 0) break
    const op: Operation = {
      id: nouvelId(),
      date,
      montant: rec.montant,
      type: rec.type === 'revenu' ? 'revenu' : 'prelevement_fixe',
      compteId: rec.type !== 'revenu' && rec.moyenPaiement === 'carte' && rec.carteId ? rec.carteId : rec.compteId,
      categorieId: rec.categorieId,
      sousCategorieId: rec.sousCategorieId,
      note: rec.libelle,
      recurrenceId: rec.id,
      creeLe: maintenant,
    }
    if (capital !== undefined) {
      const m = appliquerMensualite(capital, rec.montant, rec.tauxAnnuel)
      op.partCapital = m.partCapital
      capital = m.capitalApres
    }
    operations.push(op)
  }
  return { operations, traiteeJusquAu: dates[dates.length - 1] }
}

/** Équivalent mensuel d'un montant récurrent (pour les totaux). */
export function equivalentMensuel(rec: Pick<Recurrence, 'frequence' | 'montant'>): Centimes {
  if (rec.frequence === '14_jours') return Math.round((rec.montant * 26) / 12)
  if (rec.frequence === 'deux_dates_par_mois') return rec.montant * 2
  return rec.montant
}

export function libelleFrequence(rec: Pick<Recurrence, 'frequence' | 'jours'>): string {
  const jour = (j: number) => (j >= JOUR_FIN_DE_MOIS ? 'dernier jour' : j === 1 ? '1er' : String(j))
  switch (rec.frequence) {
    case '14_jours': return 'Toutes les 2 semaines'
    case 'mensuel': return rec.jours[0] >= JOUR_FIN_DE_MOIS ? 'Le dernier jour du mois' : `Le ${jour(rec.jours[0])} du mois`
    case 'deux_dates_par_mois': return `Le ${jour(rec.jours[0])} et le ${jour(rec.jours[1])}`
  }
}
