import { aujourdhui } from '../domain/dates'
import { montantAjustement, soldeCompte } from '../domain/soldes'
import { genererOperations } from '../domain/recurrences'
import type { AffectationFin, Categorie, Centimes, Compte, Operation, Periode, Recurrence } from '../domain/types'
import { db, lireReglages, modifierReglages, type BudgetDB } from './db'
import { categoriesInitiales, comptesInitiaux } from './donneesInitiales'

export const nouvelId = () => crypto.randomUUID()

/** Crée les comptes et catégories de départ, une seule fois. */
export async function initialiserDonnees(base: BudgetDB = db): Promise<void> {
  await base.transaction('rw', base.comptes, base.categories, base.reglages, async () => {
    const r = await lireReglages(base)
    if (r.donneesInitialisees) return
    if ((await base.comptes.count()) === 0) await base.comptes.bulkAdd(comptesInitiaux(aujourdhui()))
    if ((await base.categories.count()) === 0) await base.categories.bulkAdd(categoriesInitiales())
    await modifierReglages({ donneesInitialisees: true }, base)
  })
}

export async function enregistrerOperation(op: Omit<Operation, 'id' | 'creeLe'> & { id?: string }, base: BudgetDB = db): Promise<Operation> {
  const existante = op.id ? await base.operations.get(op.id) : undefined
  const complete: Operation = { ...op, id: op.id ?? nouvelId(), creeLe: existante?.creeLe ?? Date.now() }
  await base.operations.put(complete)
  return complete
}

export async function supprimerOperation(id: string, base: BudgetDB = db): Promise<void> {
  await base.operations.delete(id)
}

export async function enregistrerCompte(c: Omit<Compte, 'id' | 'ordre'> & { id?: string; ordre?: number }, base: BudgetDB = db): Promise<Compte> {
  const ordre = c.ordre ?? (await base.comptes.count())
  const complet: Compte = { ...c, id: c.id ?? nouvelId(), ordre }
  await base.comptes.put(complet)
  return complet
}

/**
 * « Ajuster le solde » : enregistre une opération Ajustement égale à l'écart avec le solde réel de la banque.
 * Renvoie l'écart (0 = rien à faire).
 */
export async function ajusterSolde(compteId: string, soldeReel: Centimes, note?: string, base: BudgetDB = db): Promise<Centimes> {
  return base.transaction('rw', base.comptes, base.operations, async () => {
    const compte = await base.comptes.get(compteId)
    if (!compte) throw new Error('Compte introuvable')
    const date = aujourdhui()
    const ops = await base.operations.where('date').belowOrEqual(date).toArray()
    const ecart = montantAjustement(soldeCompte(compte, ops, date), soldeReel)
    if (ecart !== 0) {
      await base.operations.add({ id: nouvelId(), date, montant: ecart, type: 'ajustement', compteId, note: note || 'Ajustement de solde', creeLe: Date.now() })
    }
    return ecart
  })
}

export async function enregistrerCategorie(c: Omit<Categorie, 'id' | 'ordre'> & { id?: string; ordre?: number }, base: BudgetDB = db): Promise<Categorie> {
  let ordre = c.ordre
  if (ordre === undefined) {
    const soeurs = await base.categories.filter((x) => (x.parentId ?? null) === (c.parentId ?? null)).toArray()
    ordre = soeurs.reduce((m, x) => Math.max(m, x.ordre + 1), 0)
  }
  const complete: Categorie = { ...c, id: c.id ?? nouvelId(), ordre }
  await base.categories.put(complete)
  return complete
}

export async function marquerSoldesSaisis(base: BudgetDB = db) {
  await modifierReglages({ soldesDepartSaisis: true }, base)
}

// ---------- Récurrences (charges fixes, crédits, revenus) ----------


/**
 * Crée ou modifie une récurrence.
 * - À la création, les échéances jusqu'à aujourd'hui inclus ne sont pas générées : le solde actuel les inclut déjà.
 * - En réactivant une récurrence en pause, les échéances de la pause (et du jour) ne sont pas rattrapées.
 * - Si le capital d'un crédit est modifié à la main, il devient la nouvelle référence (au jour même).
 */
export async function enregistrerRecurrence(r: Omit<Recurrence, 'id'> & { id?: string }, base: BudgetDB = db): Promise<Recurrence> {
  return base.transaction('rw', base.recurrences, async () => {
    const existante = r.id ? await base.recurrences.get(r.id) : undefined
    const date = aujourdhui()
    const complete: Recurrence = { ...r, id: r.id ?? nouvelId() }
    if (!existante || (!existante.actif && r.actif)) complete.derniereEcheanceGeneree = date
    if (complete.type === 'credit' && complete.capitalRestantDu !== undefined && complete.capitalRestantDu !== existante?.capitalRestantDu) {
      complete.capitalReferenceDate = date
    }
    if (complete.type === 'credit' && complete.capitalRestantDu !== undefined) {
      // montant emprunté : celui saisi, sinon le plus gros capital connu (pour la barre de progression)
      complete.capitalInitial = Math.max(complete.capitalInitial ?? 0, complete.capitalRestantDu)
    }
    if (complete.type !== 'credit') {
      delete complete.capitalRestantDu; delete complete.capitalReferenceDate; delete complete.capitalInitial; delete complete.tauxAnnuel
    }
    await base.recurrences.put(complete)
    return complete
  })
}

export async function supprimerRecurrence(id: string, base: BudgetDB = db): Promise<void> {
  await base.recurrences.delete(id) // les opérations déjà prélevées sont conservées
}

/**
 * Prélèvements et revenus automatiques : transforme toutes les échéances passées non traitées en opérations
 * (rattrapage si l'app n'a pas été ouverte). Renvoie les opérations créées, pour le bandeau d'accueil.
 */
export async function genererEcheances(date: string = aujourdhui(), base: BudgetDB = db): Promise<Operation[]> {
  return base.transaction('rw', base.recurrences, base.operations, async () => {
    const recurrences = await base.recurrences.toArray()
    const creees: Operation[] = []
    for (const rec of recurrences) {
      const existantes = rec.type === 'credit' ? await base.operations.where('recurrenceId').equals(rec.id).toArray() : []
      const { operations, traiteeJusquAu } = genererOperations(rec, date, existantes, nouvelId, Date.now())
      if (!traiteeJusquAu) continue
      await base.operations.bulkAdd(operations)
      await base.recurrences.update(rec.id, { derniereEcheanceGeneree: traiteeJusquAu })
      creees.push(...operations)
    }
    return creees
  })
}

/**
 * Confirme une échéance « à confirmer » : crée le revenu (ou la charge) avec le montant réel,
 * et marque l'échéance comme traitée. montant = null : l'échéance est ignorée (pas reçue).
 */
export async function confirmerEcheance(recurrenceId: string, dateEcheance: string, montant: Centimes | null, dateOperation: string = dateEcheance, base: BudgetDB = db): Promise<Operation | null> {
  return base.transaction('rw', base.recurrences, base.operations, async () => {
    const rec = await base.recurrences.get(recurrenceId)
    if (!rec) throw new Error('Récurrence introuvable')
    let op: Operation | null = null
    if (montant !== null) {
      op = {
        id: nouvelId(), date: dateOperation, montant, type: rec.type === 'revenu' ? 'revenu' : 'prelevement_fixe',
        compteId: rec.type !== 'revenu' && rec.moyenPaiement === 'carte' && rec.carteId ? rec.carteId : rec.compteId,
        categorieId: rec.categorieId, sousCategorieId: rec.sousCategorieId, note: rec.libelle, recurrenceId: rec.id, echeance: dateEcheance, creeLe: Date.now(),
      }
      await base.operations.add(op)
    }
    if (!rec.derniereEcheanceGeneree || dateEcheance > rec.derniereEcheanceGeneree) {
      await base.recurrences.update(rec.id, { derniereEcheanceGeneree: dateEcheance })
    }
    return op
  })
}

// ---------- Carte de crédit ----------

/** « Rembourser la carte » : retiré du compte de remboursement et du montant dû. Pas une dépense. */
export async function rembourserCarte(carteId: string, montant: Centimes, date: string = aujourdhui(), base: BudgetDB = db): Promise<Operation> {
  const carte = await base.comptes.get(carteId)
  if (!carte?.compteRemboursementId) throw new Error('Carte sans compte de remboursement')
  return enregistrerOperation({ date, montant, type: 'remboursement_carte', compteId: carte.compteRemboursementId, compteDestinationId: carteId }, base)
}

// ---------- Périodes du budget journalier ----------

export const idPeriode = (dateDebut: string) => `p-${dateDebut}`

export async function validerPeriode(p: { debut: string; fin: string; enveloppe: Centimes; epargne: Centimes; report: Centimes; demarrageLe?: string }, base: BudgetDB = db): Promise<Periode> {
  const periode: Periode = {
    id: idPeriode(p.debut), dateDebut: p.debut, dateFin: p.fin, enveloppeValidee: p.enveloppe,
    epargneMiseDeCote: p.epargne, reportPrecedent: p.report, ajouts: [], cloturee: false,
    ...(p.demarrageLe && p.demarrageLe > p.debut ? { demarrageLe: p.demarrageLe } : {}),
  }
  await base.periodes.put(periode)
  return periode
}

export async function modifierEnveloppe(periodeId: string, enveloppe: Centimes, base: BudgetDB = db) {
  await base.periodes.update(periodeId, { enveloppeValidee: enveloppe })
}

/** Bilan de fin de période : le reste va en épargne ou est reporté ; un déficit peut être retiré de la suivante. */
export async function cloturerPeriode(periodeId: string, affectation: AffectationFin, montant: Centimes, base: BudgetDB = db) {
  await base.periodes.update(periodeId, { cloturee: true, affectationFin: affectation, montantAffecte: montant })
}

/** Revenu ponctuel ou virement reçu en cours de période : « l'ajouter à l'enveloppe ? » */
export async function ajouterAEnveloppe(periodeId: string, operationId: string, montant: Centimes, base: BudgetDB = db) {
  await base.transaction('rw', base.periodes, async () => {
    const p = await base.periodes.get(periodeId)
    if (!p || p.ajouts.some((a) => a.operationId === operationId)) return
    await base.periodes.update(periodeId, { ajouts: [...p.ajouts, { operationId, montant }] })
  })
}

export async function retirerDeEnveloppe(periodeId: string, operationId: string, base: BudgetDB = db) {
  await base.transaction('rw', base.periodes, async () => {
    const p = await base.periodes.get(periodeId)
    if (p) await base.periodes.update(periodeId, { ajouts: p.ajouts.filter((a) => a.operationId !== operationId) })
  })
}
