import { addDays, addMonths, endOfMonth, endOfWeek, format, parseISO, startOfMonth, startOfWeek } from 'date-fns'
import { fr } from 'date-fns/locale/fr'
import { periodeCourante, type Bornes } from './budget'
import { versISO } from './dates'
import { lendemain, veille } from './recurrences'
import { effetSurCompte, soldeCompte } from './soldes'
import type { Centimes, Compte, DateISO, ObjectifEpargne, Operation, Recurrence } from './types'

/**
 * Analyses (cahier des charges, « Analyses ») : par semaine (lundi → dimanche), par période de paie, par mois.
 * Exclus des dépenses : virements, remboursements de carte, ajustements. Fonctions pures, testées.
 */

export type Granularite = 'semaine' | 'paie' | 'mois'

export interface Fenetre extends Bornes { libelle: string }

/** Fenêtre d'analyse : celle qui contient la date de référence, décalée de n fenêtres (n < 0 : passé). */
export function fenetre(g: Granularite, date: DateISO, decalage: number, paie?: Recurrence): Fenetre | undefined {
  const d = parseISO(date)
  if (g === 'semaine') {
    const debut = addDays(startOfWeek(d, { weekStartsOn: 1 }), 7 * decalage)
    const fin = endOfWeek(debut, { weekStartsOn: 1 })
    return { debut: versISO(debut), fin: versISO(fin), libelle: `${format(debut, 'd MMM', { locale: fr })} – ${format(fin, 'd MMM yyyy', { locale: fr })}` }
  }
  if (g === 'mois') {
    const m = addMonths(startOfMonth(d), decalage)
    const t = format(m, 'MMMM yyyy', { locale: fr })
    return { debut: versISO(m), fin: versISO(endOfMonth(m)), libelle: t.charAt(0).toUpperCase() + t.slice(1) }
  }
  if (!paie) return undefined
  let b = periodeCourante(paie, date)
  for (let i = 0; b && i < Math.abs(decalage); i++) b = periodeCourante(paie, decalage < 0 ? veille(b.debut) : lendemain(b.fin))
  if (!b) return undefined
  return { ...b, libelle: `${format(parseISO(b.debut), 'd MMM', { locale: fr })} – ${format(parseISO(b.fin), 'd MMM yyyy', { locale: fr })}` }
}

export interface PointSolde { date: DateISO; reel?: Centimes; projete?: Centimes }

/**
 * Solde de fin de journée des comptes, jour par jour, sur la fenêtre (jusqu'à aujourd'hui).
 * Commence au jour où tous les comptes ont un solde connu (leur date de départ) : avant, il n'y a rien à tracer.
 */
export function soldesJournaliers(comptes: Compte[], operations: Operation[], f: Bornes, aujourdhui: DateISO): PointSolde[] {
  if (comptes.length === 0) return []
  const depart = comptes.reduce((m, c) => (c.dateDepart > m ? c.dateDepart : m), f.debut)
  const fin = f.fin < aujourdhui ? f.fin : aujourdhui
  if (depart > fin) return []
  // solde au matin du premier jour (= solde de départ si le compte démarre ce jour-là)
  let solde = comptes.reduce((s, c) => s + soldeCompte(c, operations, veille(depart)), 0)
  const parJour = new Map<DateISO, Centimes>()
  for (const op of operations) {
    if (op.date < depart || op.date > fin) continue
    let effet = 0
    for (const c of comptes) effet += effetSurCompte(op, c.id)
    if (effet) parJour.set(op.date, (parJour.get(op.date) ?? 0) + effet)
  }
  const points: PointSolde[] = []
  for (let d = depart; d <= fin; d = lendemain(d)) {
    solde += parJour.get(d) ?? 0
    points.push({ date: d, reel: solde })
  }
  return points
}

export interface Resume {
  revenus: Centimes
  chargesFixes: Centimes
  depensesQuotidien: Centimes
  epargne: Centimes // mis de côté − repris sur les objectifs de ces comptes
  soldeFin: Centimes
}

export function resumeFenetre(comptes: Compte[], operations: Operation[], objectifs: ObjectifEpargne[], f: Bornes, aujourdhui: DateISO): Resume {
  const ids = new Set(comptes.map((c) => c.id))
  const r: Resume = { revenus: 0, chargesFixes: 0, depensesQuotidien: 0, epargne: 0, soldeFin: 0 }
  for (const op of operations) {
    if (op.date < f.debut || op.date > f.fin || !ids.has(op.compteId)) continue
    if (op.type === 'revenu') r.revenus += op.montant
    else if (op.type === 'prelevement_fixe') r.chargesFixes += op.montant
    else if (op.type === 'depense') r.depensesQuotidien += op.montant
  }
  for (const o of objectifs) {
    if (!ids.has(o.compteId)) continue
    for (const m of o.mouvements) if (m.date >= f.debut && m.date <= f.fin) r.epargne += m.sens === 'mise_de_cote' ? m.montant : -m.montant
  }
  const fin = f.fin < aujourdhui ? f.fin : aujourdhui
  r.soldeFin = comptes.reduce((s, c) => s + soldeCompte(c, operations, fin), 0)
  return r
}

export interface LigneAnalyse {
  id: string | null // catégorie (ou sous-catégorie) ; null : sans catégorie
  montant: Centimes
  part: number
  precedent: Centimes
}

/**
 * Dépenses par catégorie (ou par sous-catégorie d'une catégorie), triées, avec la fenêtre précédente.
 * Les charges fixes sont incluses ou non (elles ont aussi une catégorie : loyer → Logement).
 */
export function parCategorie(operations: Operation[], comptes: Set<string>, f: Bornes, precedente: Bornes | undefined,
  options: { chargesFixes: boolean; categorie?: string }): LigneAnalyse[] {
  const somme = (b: Bornes) => {
    const m = new Map<string | null, Centimes>()
    for (const op of operations) {
      if (!comptes.has(op.compteId) || op.date < b.debut || op.date > b.fin) continue
      if (op.type !== 'depense' && !(options.chargesFixes && op.type === 'prelevement_fixe')) continue
      if (options.categorie !== undefined && (op.categorieId ?? null) !== options.categorie) continue
      const k = options.categorie !== undefined ? op.sousCategorieId ?? null : op.categorieId ?? null
      m.set(k, (m.get(k) ?? 0) + op.montant)
    }
    return m
  }
  const actuel = somme(f)
  const avant = precedente ? somme(precedente) : new Map<string | null, Centimes>()
  const total = [...actuel.values()].reduce((s, v) => s + v, 0)
  return [...new Set([...actuel.keys(), ...avant.keys()])]
    .map((id) => ({ id, montant: actuel.get(id) ?? 0, part: total ? (actuel.get(id) ?? 0) / total : 0, precedent: avant.get(id) ?? 0 }))
    .sort((a, b) => b.montant - a.montant || b.precedent - a.precedent)
}
