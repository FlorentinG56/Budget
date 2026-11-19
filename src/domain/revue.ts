import { addMonths, format, parseISO } from 'date-fns'
import { fr } from 'date-fns/locale/fr'
import { fenetre, parCategorie, resumeFenetre, type LigneAnalyse, type Resume } from './analyses'
import { joursRespectes } from './budget'
import { suiviBudgets, type SuiviBudget } from './budgetsCategories'
import { versISO } from './dates'
import type { Categorie, Centimes, Compte, DateISO, ObjectifEpargne, Operation, Periode } from './types'

/**
 * Revue de fin de mois (tâche E4) : récapitulatif d'un mois écoulé, pour les comptes du budget du jour.
 * Fonctions pures, testées dans revue.test.ts.
 */

export type Mois = string // 'AAAA-MM'

export const moisDeDate = (d: DateISO): Mois => d.slice(0, 7)
export const moisPrecedent = (m: Mois): Mois => versISO(addMonths(parseISO(`${m}-01`), -1)).slice(0, 7)
export function nomMois(m: Mois, avecAnnee = false): string {
  return format(parseISO(`${m}-01`), avecAnnee ? 'MMMM yyyy' : 'MMMM', { locale: fr })
}
/** « Ta revue d'octobre » / « de novembre » : élision devant une voyelle. */
export const deMois = (m: Mois) => (/^[aeiouo]/i.test(nomMois(m)) ? `d’${nomMois(m)}` : `de ${nomMois(m)}`)

export interface Revue {
  mois: Mois
  resume: Resume
  totalDepense: Centimes // dépenses du quotidien + charges fixes
  precedent?: Centimes // même total, mois précédent (s'il a des données)
  moyenne3?: Centimes // même total, moyenne des 3 mois précédents (ceux qui ont des données)
  top: LigneAnalyse[] // 3 premières catégories, avec comparaison
  budgets: (SuiviBudget & { respecte: boolean })[]
  jours: { respectes: number; total: number }
}

export function revueDuMois(m: Mois, p: {
  comptes: Compte[]; budget: Set<string>; operations: Operation[]; objectifs: ObjectifEpargne[]; categories: Categorie[]; periodes: Periode[]; aujourdhui: DateISO
}): Revue {
  const date = `${m}-01`
  const f = fenetre('mois', date, 0)!
  const precedentes = [1, 2, 3].map((k) => fenetre('mois', date, -k)!)
  const comptesBudget = p.comptes.filter((c) => p.budget.has(c.id))
  const resume = resumeFenetre(comptesBudget, p.operations, p.comptes, f, p.aujourdhui)
  const total = (b: { debut: DateISO; fin: DateISO }) => p.operations
    .filter((o) => (o.type === 'depense' || o.type === 'prelevement_fixe') && p.budget.has(o.compteId) && o.date >= b.debut && o.date <= b.fin)
    .reduce((s, o) => s + o.montant, 0)
  const aDesDonnees = (b: { debut: DateISO; fin: DateISO }) => p.operations.some((o) => p.budget.has(o.compteId) && o.date >= b.debut && o.date <= b.fin)
  const anciennes = precedentes.filter(aDesDonnees)
  const jours = p.periodes.filter((x) => x.dateDebut <= f.fin && x.dateFin >= f.debut && x.enveloppeValidee !== undefined)
    .map((x) => joursRespectes(x, p.operations, p.budget, f.fin < p.aujourdhui ? f.fin : p.aujourdhui, f.debut))
    .reduce((a, b) => ({ respectes: a.respectes + b.respectes, total: a.total + b.total }), { respectes: 0, total: 0 })
  return {
    mois: m, resume,
    totalDepense: total(f), precedent: aDesDonnees(precedentes[0]) ? total(precedentes[0]) : undefined,
    moyenne3: anciennes.length ? Math.round(anciennes.reduce((s, b) => s + total(b), 0) / anciennes.length) : undefined,
    top: parCategorie(p.operations, p.budget, f, anciennes, { chargesFixes: false }).filter((l) => l.montant > 0).slice(0, 3),
    budgets: suiviBudgets(p.categories, p.operations, p.budget, date).map((s) => ({ ...s, respecte: s.depense <= s.budget })),
    jours,
  }
}

/** Mois écoulés qui ont des données (du plus récent au plus ancien), pour l'historique des revues. */
export function moisAvecRevue(operations: Operation[], budget: Set<string>, aujourdhui: DateISO, max = 12): Mois[] {
  const avec = new Set(operations.filter((o) => budget.has(o.compteId)).map((o) => moisDeDate(o.date)))
  const liste: Mois[] = []
  for (let m = moisPrecedent(moisDeDate(aujourdhui)); liste.length < max && m >= '2000-01'; m = moisPrecedent(m)) {
    if (avec.has(m)) liste.push(m)
    if (liste.length && ![...avec].some((x) => x < m)) break
  }
  return liste
}

/** Bandeau « Ta revue d'octobre est prête » : du 1er au 7 du mois, tant que la revue n'a pas été ouverte. */
export function revueAAnnoncer(aujourdhui: DateISO, operations: Operation[], budget: Set<string>, vues: Mois[]): Mois | undefined {
  if (Number(aujourdhui.slice(8)) > 7) return undefined
  const m = moisPrecedent(moisDeDate(aujourdhui))
  if (vues.includes(m)) return undefined
  return operations.some((o) => budget.has(o.compteId) && moisDeDate(o.date) === m) ? m : undefined
}
