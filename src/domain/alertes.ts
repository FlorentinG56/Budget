import { differenceInCalendarDays, parseISO } from 'date-fns'
import { formaterMontant } from './argent'
import { libelleJour } from './dates'
import { evenementsPrevus, type JourProjete } from './projection'
import { finEffectiveCredit, lendemain } from './recurrences'
import type { Compte, DateISO, Devise, Operation, Recurrence } from './types'
import { addDays } from 'date-fns'
import { versISO } from './dates'

/**
 * Bandeaux d'alerte de l'accueil (cahier des charges, « Alertes et notifications », V1 sans serveur).
 * Fonction pure : calcule les alertes du jour à partir des données. Testée dans alertes.test.ts.
 */

export type Niveau = 'info' | 'attention' | 'danger'

export interface Alerte {
  id: string // stable pour la journée : sert à masquer un bandeau jusqu'au lendemain
  niveau: Niveau
  icone: string
  texte: string
  cible?: 'calendrier' | 'charges' | 'sauvegarde' | 'periode'
  date?: DateISO
}

export interface ParamsAlertes {
  aujourdhui: DateISO
  delaiJours: number // « Dans 2 jours : Loyer » (réglable)
  recurrences: Recurrence[]
  operations: Operation[]
  comptes: Compte[]
  resteAujourdhui?: number // budget du jour : négatif = dépassé
  devise: Devise
  projection?: Map<DateISO, JourProjete> // solde projeté du compte du budget
  derniereSauvegarde?: number // horodatage
  rappelSauvegardeJours: number
  sauvegardeDisponible: boolean // la sauvegarde existe (étape 10)
  maintenant: number
}

const quand = (date: DateISO, aujourdhui: DateISO) => {
  const n = differenceInCalendarDays(parseISO(date), parseISO(aujourdhui))
  return n === 1 ? 'Demain' : `Dans ${n} jours`
}

export function calculerAlertes(p: ParamsAlertes): Alerte[] {
  const alertes: Alerte[] = []
  const devises = new Map(p.comptes.map((c) => [c.id, c.devise]))

  // 1. Budget du jour dépassé
  if (p.resteAujourdhui !== undefined && p.resteAujourdhui < 0) {
    alertes.push({ id: `depasse-${p.aujourdhui}`, niveau: 'danger', icone: '🔴', cible: 'periode',
      texte: `Budget du jour dépassé de ${formaterMontant(-p.resteAujourdhui, p.devise)}` })
  }

  // 2. Solde projeté négatif (premier jour)
  if (p.projection) {
    for (const j of p.projection.values()) {
      if (j.solde < 0) {
        alertes.push({ id: `negatif-${j.date}`, niveau: 'danger', icone: '⚠️', cible: 'calendrier', date: j.date,
          texte: `Solde projeté négatif ${j.date === p.aujourdhui ? 'ce soir' : `le ${libelleJour(j.date, p.aujourdhui).toLowerCase()}`}` })
        break
      }
    }
  }

  // 3. Charges à venir dans le délai (demain → aujourd'hui + délai)
  if (p.delaiJours > 0) {
    const au = versISO(addDays(parseISO(p.aujourdhui), p.delaiJours))
    for (const e of evenementsPrevus(p.recurrences, lendemain(p.aujourdhui), au, p.operations)) {
      if (e.sens !== 'charge') continue
      const devise = devises.get(e.compteId) ?? p.devise
      alertes.push({ id: `charge-${e.recurrenceId}-${e.date}`, niveau: 'attention', icone: '📅', cible: 'charges', date: e.date,
        texte: `${quand(e.date, p.aujourdhui)} : ${e.libelle} – ${formaterMontant(e.montant, devise)}` })
    }
  }

  // 4. Dernière mensualité d'un crédit : ce mois-ci ou le mois prochain
  const moisCourant = p.aujourdhui.slice(0, 7)
  const d = parseISO(p.aujourdhui)
  const moisProchain = versISO(new Date(d.getFullYear(), d.getMonth() + 1, 1)).slice(0, 7)
  for (const r of p.recurrences) {
    if (r.type !== 'credit' || !r.actif) continue
    const finCapital = finEffectiveCredit(r, p.operations)
    const fin = [finCapital, r.dateFin].filter(Boolean).sort()[0]
    if (!fin || fin <= p.aujourdhui) continue
    const mois = fin.slice(0, 7)
    if (mois !== moisCourant && mois !== moisProchain) continue
    alertes.push({ id: `credit-fin-${r.id}-${fin}`, niveau: 'info', icone: '🎉', cible: 'charges', date: fin,
      texte: `Dernier paiement du ${r.libelle.charAt(0).toLowerCase() + r.libelle.slice(1)} ${mois === moisCourant ? 'ce mois-ci' : 'le mois prochain'} (${libelleJour(fin, p.aujourdhui).toLowerCase()})` })
  }

  // 5. Rappel de sauvegarde (supprimer l'icône de l'app efface ses données)
  if (p.sauvegardeDisponible && p.rappelSauvegardeJours > 0) {
    const jours = p.derniereSauvegarde ? Math.floor((p.maintenant - p.derniereSauvegarde) / 86_400_000) : undefined
    if (jours === undefined || jours >= p.rappelSauvegardeJours) {
      alertes.push({ id: `sauvegarde-${p.aujourdhui}`, niveau: 'attention', icone: '💾', cible: 'sauvegarde',
        texte: jours === undefined ? 'Aucune sauvegarde : pense à en faire une' : `Dernière sauvegarde il y a ${jours} jours` })
    }
  }

  return alertes
}
