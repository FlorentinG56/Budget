import { aujourdhui } from '../domain/dates'
import { montantAjustement, soldeCompte } from '../domain/soldes'
import { genererOperations } from '../domain/recurrences'
import { CIBLE_SECURITE_DEFAUT, repartirFinQuinzaine, soldeObjectif } from '../domain/epargne'
import type { AffectationFin, Bien, CategorieBien, EtatBien, MotifSortie, PhotoBien, Categorie, Centimes, Compte, DateISO, MouvementEpargne, ObjectifEpargne, Operation, Periode, Recurrence, Voyage } from '../domain/types'
import { db, lireReglages, modifierReglages, type BudgetDB } from './db'
import { categoriesInitiales } from './donneesInitiales'

export const nouvelId = () => crypto.randomUUID()

/**
 * Premier lancement. Pour un nouvel utilisateur (aucun compte, données jamais initialisées) : crée les catégories
 * proposées et ouvre le parcours d'accueil. Pour un utilisateur existant (des comptes, ou données déjà initialisées) :
 * ne crée, ne renomme et ne supprime rien.
 */
export async function initialiserDonnees(base: BudgetDB = db): Promise<'nouveau' | 'existant'> {
  return base.transaction('rw', base.comptes, base.categories, base.reglages, async () => {
    const r = await lireReglages(base)
    if (r.parcoursAccueil === 'en_cours') return 'nouveau' // parcours commencé puis interrompu : on le reprend
    if (r.donneesInitialisees || (await base.comptes.count()) > 0) return 'existant'
    if ((await base.categories.count()) === 0) await base.categories.bulkAdd(categoriesInitiales())
    await modifierReglages({ parcoursAccueil: 'en_cours' }, base)
    return 'nouveau'
  })
}

/** Fin du parcours d'accueil. */
export async function terminerAccueil(base: BudgetDB = db): Promise<void> {
  await modifierReglages({ parcoursAccueil: 'termine', donneesInitialisees: true, soldesDepartSaisis: true }, base)
}

/**
 * Compte du budget du jour (et sa carte de crédit éventuelle) : seuls ceux-là comptent dans le budget journalier,
 * et la carte est remboursée depuis ce compte.
 */
export async function choisirComptesBudget(compteId: string, carteId: string | null, base: BudgetDB = db): Promise<void> {
  await base.transaction('rw', base.comptes, async () => {
    for (const c of await base.comptes.toArray()) {
      const inclus = c.id === compteId || c.id === carteId
      await base.comptes.update(c.id, {
        inclusBudgetJournalier: inclus,
        ...(c.id === carteId ? { compteRemboursementId: compteId } : {}),
      })
    }
  })
}

export async function enregistrerOperation(op: Omit<Operation, 'id' | 'creeLe'> & { id?: string }, base: BudgetDB = db): Promise<Operation> {
  return base.transaction('rw', base.operations, base.comptes, async () => {
    const existante = op.id ? await base.operations.get(op.id) : undefined
    const complete: Operation = { ...op, id: op.id ?? nouvelId(), creeLe: existante?.creeLe ?? Date.now() }
    await synchroniserVirementLie(complete, base)
    await base.operations.put(complete)
    return complete
  })
}

/**
 * Imprévu payé avec l'épargne : la dépense reste sur le compte (ou la carte) et un virement du même montant
 * va du compte épargne vers le compte principal (à refaire à la banque). Le virement suit la dépense
 * (montant, date) ; il est supprimé si la dépense n'est plus payée avec l'épargne.
 */
async function synchroniserVirementLie(op: Operation, base: BudgetDB): Promise<void> {
  const ancien = op.virementLieId ? await base.operations.get(op.virementLieId) : undefined
  const compte = await base.comptes.get(op.compteId)
  const destination = compte?.type === 'carte_credit' ? compte.compteRemboursementId : op.compteId
  if (op.type !== 'depense' || !op.epargneCompteId || !destination) {
    if (ancien) await base.operations.delete(ancien.id)
    delete op.virementLieId
    return
  }
  const virement: Operation = {
    id: ancien?.id ?? nouvelId(), creeLe: ancien?.creeLe ?? Date.now(), date: op.date, montant: op.montant, type: 'virement',
    compteId: op.epargneCompteId, compteDestinationId: destination, note: `Retrait d’épargne${op.note ? ` : ${op.note}` : ' (imprévu)'}`, lieA: op.id,
  }
  await base.operations.put(virement)
  op.virementLieId = virement.id
}

export async function supprimerOperation(id: string, base: BudgetDB = db): Promise<void> {
  await base.transaction('rw', base.operations, base.objectifs, async () => {
    const op = await base.operations.get(id)
    if (op?.virementLieId) await base.operations.delete(op.virementLieId)
    if (op?.lieA) await base.operations.update(op.lieA, { virementLieId: undefined })
    // mouvement de projet créé avec ce virement (épargner / retirer) : supprimé avec lui
    for (const o of await base.objectifs.toArray()) {
      if (o.mouvements.some((m) => m.source === `virement:${id}`)) await base.objectifs.update(o.id, { mouvements: o.mouvements.filter((m) => m.source !== `virement:${id}`) })
    }
    await base.operations.delete(id)
  })
}

/**
 * Onglet Épargne : « Épargner » (compte principal → compte épargne) ou « Retirer » (compte épargne → compte principal).
 * Un vrai virement, à refaire à la banque. Avec un projet : le projet reçoit (épargner) ou perd (retirer) le même montant.
 */
export async function virementEpargne(v: { sens: 'epargner' | 'retirer'; comptePrincipalId: string; compteEpargneId: string; montant: Centimes; date: DateISO; projetId?: string }, base: BudgetDB = db): Promise<Operation> {
  return base.transaction('rw', base.operations, base.objectifs, async () => {
    const retirer = v.sens === 'retirer'
    const op: Operation = {
      id: nouvelId(), date: v.date, montant: v.montant, type: 'virement', creeLe: Date.now(),
      compteId: retirer ? v.compteEpargneId : v.comptePrincipalId, compteDestinationId: retirer ? v.comptePrincipalId : v.compteEpargneId,
      note: retirer ? 'Retrait d’épargne' : 'Épargne',
    }
    await base.operations.add(op)
    const projet = v.projetId ? await base.objectifs.get(v.projetId) : undefined
    if (projet) {
      await base.objectifs.update(projet.id, { mouvements: [...projet.mouvements, { id: nouvelId(), date: v.date, montant: v.montant, sens: retirer ? 'reprise' : 'mise_de_cote', source: `virement:${op.id}` }] })
    }
    return op
  })
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

export async function validerPeriode(p: { debut: string; fin: string; enveloppe: Centimes; epargne: Centimes; report: Centimes; demarrageLe?: string; aCote?: Centimes }, base: BudgetDB = db): Promise<Periode> {
  const periode: Periode = {
    id: idPeriode(p.debut), dateDebut: p.debut, dateFin: p.fin, enveloppeValidee: p.enveloppe,
    epargneMiseDeCote: p.epargne, reportPrecedent: p.report, ajouts: [], cloturee: false,
    ...(p.demarrageLe && p.demarrageLe > p.debut ? { demarrageLe: p.demarrageLe } : {}),
    ...(p.aCote && p.aCote > 0 ? { aCote: p.aCote } : {}),
  }
  await base.periodes.put(periode)
  return periode
}

export async function modifierEnveloppe(periodeId: string, enveloppe: Centimes, base: BudgetDB = db) {
  await base.periodes.update(periodeId, { enveloppeValidee: enveloppe })
}

/** Bilan de fin de période : le reste va en épargne ou est reporté ; un déficit peut être retiré de la suivante. */
export async function cloturerPeriode(periodeId: string, affectation: AffectationFin, montant: Centimes, aCoteVersSecurite = 0, base: BudgetDB = db) {
  await base.periodes.update(periodeId, { cloturee: true, affectationFin: affectation, montantAffecte: montant, aCoteVersSecurite: Math.max(0, aCoteVersSecurite) })
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

// ---------- Épargne virtuelle ----------

export async function enregistrerObjectif(o: Omit<ObjectifEpargne, 'id' | 'mouvements' | 'archive'> & { id?: string; mouvements?: MouvementEpargne[]; archive?: boolean }, base: BudgetDB = db): Promise<ObjectifEpargne> {
  const existant = o.id ? await base.objectifs.get(o.id) : undefined
  const complet: ObjectifEpargne = { mouvements: existant?.mouvements ?? [], archive: existant?.archive ?? false, ...o, id: o.id ?? nouvelId() }
  await base.objectifs.put(complet)
  return complet
}

export async function ajouterMouvement(objectifId: string, m: Omit<MouvementEpargne, 'id'>, base: BudgetDB = db): Promise<void> {
  await base.transaction('rw', base.objectifs, async () => {
    const o = await base.objectifs.get(objectifId)
    if (!o) throw new Error('Objectif introuvable')
    await base.objectifs.update(objectifId, { mouvements: [...o.mouvements, { ...m, id: nouvelId() }] })
  })
}

export async function supprimerMouvement(objectifId: string, mouvementId: string, base: BudgetDB = db): Promise<void> {
  await base.transaction('rw', base.objectifs, async () => {
    const o = await base.objectifs.get(objectifId)
    if (o) await base.objectifs.update(objectifId, { mouvements: o.mouvements.filter((m) => m.id !== mouvementId) })
  })
}

/**
 * Sécurité : argent laissé sur le compte principal pour les imprévus. Elle est enregistrée dans l'objectif « Sécurité »
 * (créé sur le compte du budget du jour, cible 2 000 par défaut). Plus aucun mouvement automatique : elle n'augmente
 * qu'à la fin de quinzaine (choix de l'utilisateur) ou à la main. Les mouvements automatiques d'avant sont conservés.
 */
export async function synchroniserSecurite(base: BudgetDB = db): Promise<string | undefined> {
  return base.transaction('rw', base.objectifs, base.reglages, base.comptes, async () => {
    const r = await lireReglages(base)
    let securite = r.objectifSecuriteId ? await base.objectifs.get(r.objectifSecuriteId) : undefined
    if (!securite) {
      const comptes = await base.comptes.orderBy('ordre').toArray()
      const compte = comptes.find((c) => c.inclusBudgetJournalier && c.type === 'cheque' && !c.archive) ?? comptes.find((c) => c.type === 'cheque')
      if (!compte) return undefined
      securite = { id: nouvelId(), nom: 'Sécurité', compteId: compte.id, montantCible: CIBLE_SECURITE_DEFAUT, mouvements: [], archive: false }
      await base.objectifs.add(securite)
      await modifierReglages({ objectifSecuriteId: securite.id, epargneV2: true }, base)
    } else if (!r.epargneV2) {
      // passage à la nouvelle épargne : cible de 2 000 si aucune n'était fixée (une seule fois, modifiable ensuite)
      if (!securite.montantCible) await base.objectifs.update(securite.id, { montantCible: CIBLE_SECURITE_DEFAUT })
      if (securite.archive) await base.objectifs.update(securite.id, { archive: false })
      await modifierReglages({ epargneV2: true }, base)
    }
    return securite.id
  })
}

export interface DecisionFinQuinzaine {
  compteId: string // compte principal
  reste: Centimes // solde − dû carte − sécurité, le soir du dernier jour
  epargne: Centimes // part à épargner (virement vers compteEpargneId)
  compteEpargneId?: string
  projetId?: string // projet qui reçoit la part épargnée (facultatif)
  date: DateISO // date du virement d'épargne
}

/**
 * Fin de quinzaine (jour de paie) : la part épargnée devient un virement compte principal → compte épargne
 * (l'utilisateur fait le même à sa banque), le reste s'ajoute à la sécurité ; la période est close.
 */
export async function terminerQuinzaine(periodeId: string, d: DecisionFinQuinzaine, base: BudgetDB = db): Promise<void> {
  await base.transaction('rw', [base.periodes, base.operations, base.objectifs, base.reglages, base.comptes], async () => {
    const periode = await base.periodes.get(periodeId)
    if (!periode || periode.cloturee) return
    const compteEpargne = d.compteEpargneId ? await base.comptes.get(d.compteEpargneId) : undefined
    const { epargne, securite } = repartirFinQuinzaine(d.reste, d.epargne, !!compteEpargne && compteEpargne.type === 'epargne')
    let virementEpargneId: string | undefined
    if (epargne > 0 && compteEpargne) {
      virementEpargneId = nouvelId()
      await base.operations.add({ id: virementEpargneId, date: d.date, montant: epargne, type: 'virement', compteId: d.compteId, compteDestinationId: compteEpargne.id,
        note: 'Épargne de fin de quinzaine', creeLe: Date.now() })
      if (d.projetId && (await base.objectifs.get(d.projetId))) {
        const p = (await base.objectifs.get(d.projetId))!
        await base.objectifs.update(p.id, { mouvements: [...p.mouvements, { id: nouvelId(), date: d.date, montant: epargne, sens: 'mise_de_cote', source: `fin:${periodeId}` }] })
      }
    }
    if (securite > 0) {
      const id = (await lireReglages(base)).objectifSecuriteId
      const sec = id ? await base.objectifs.get(id) : undefined
      if (sec) await base.objectifs.update(sec.id, { mouvements: [...sec.mouvements, { id: nouvelId(), date: periode.dateFin, montant: securite, sens: 'mise_de_cote', source: `fin:${periodeId}` }] })
    }
    await base.periodes.update(periodeId, {
      cloturee: true, affectationFin: 'aucune', montantAffecte: 0,
      finReste: d.reste, finEpargne: epargne, finSecurite: securite, ...(virementEpargneId ? { virementEpargneId } : {}),
    })
  })
}

/**
 * Conversion (une fois) des anciens objectifs : « securite » ajoute leur montant à la sécurité (même compte seulement),
 * puis l'objectif est archivé (historique conservé) ; « archiver » l'archive seulement.
 */
export async function convertirObjectif(objectifId: string, choix: 'securite' | 'archiver', base: BudgetDB = db): Promise<void> {
  await base.transaction('rw', base.objectifs, base.operations, base.reglages, async () => {
    const o = await base.objectifs.get(objectifId)
    const secId = (await lireReglages(base)).objectifSecuriteId
    if (!o || o.archive || o.id === secId) return
    if (choix === 'securite') {
      const sec = secId ? await base.objectifs.get(secId) : undefined
      const montant = soldeObjectif(o, await base.operations.toArray())
      if (!sec || sec.compteId !== o.compteId) throw new Error('Pas sur le même compte que la sécurité')
      if (montant > 0) await base.objectifs.update(sec.id, { mouvements: [...sec.mouvements, { id: nouvelId(), date: aujourdhui(), montant, sens: 'mise_de_cote', note: `Ancien objectif « ${o.nom} »` }] })
    }
    await base.objectifs.update(o.id, { archive: true })
  })
}

/** Montant « à côté du budget » de la période (modifiable à tout moment, 0 possible). */
export async function modifierACote(periodeId: string, montant: Centimes, base: BudgetDB = db) {
  await base.periodes.update(periodeId, { aCote: Math.max(0, montant) })
}

// ---------- Voyages ----------

export async function enregistrerVoyage(v: Omit<Voyage, 'id'> & { id?: string }, base: BudgetDB = db): Promise<Voyage> {
  const complet: Voyage = { ...v, id: v.id ?? nouvelId() }
  await base.voyages.put(complet)
  return complet
}

export async function supprimerVoyage(id: string, base: BudgetDB = db): Promise<void> {
  await base.voyages.delete(id) // les dépenses restent sur le compte
}

// ---------- Patrimoine : biens ----------

export type NouveauBien = Omit<Bien, 'id' | 'creeLe' | 'historiqueEtat'> & { id?: string; historiqueEtat?: Bien['historiqueEtat'] }

export async function enregistrerBien(b: NouveauBien, base: BudgetDB = db): Promise<Bien> {
  return base.transaction('rw', base.biens, base.photos, async () => {
    const existant = b.id ? await base.biens.get(b.id) : undefined
    const complet: Bien = { ...b, historiqueEtat: b.historiqueEtat ?? existant?.historiqueEtat ?? [], id: b.id ?? nouvelId(), creeLe: existant?.creeLe ?? Date.now() }
    // photo ou facture remplacée : l'ancienne est supprimée
    for (const k of ['photoId', 'factureId'] as const) if (existant?.[k] && existant[k] !== complet[k]) await base.photos.delete(existant[k]!)
    await base.biens.put(complet)
    return complet
  })
}

/** Changement d'état (historique : date, ancien, nouveau, note). */
export async function changerEtatBien(id: string, nouveau: EtatBien, date: string, note?: string, base: BudgetDB = db): Promise<void> {
  await base.transaction('rw', base.biens, async () => {
    const b = await base.biens.get(id)
    if (!b || b.etat === nouveau) return
    await base.biens.update(id, { etat: nouveau, historiqueEtat: [...b.historiqueEtat, { date, ancien: b.etat, nouveau, ...(note ? { note } : {}) }] })
  })
}

/** « Ce bien n'est plus à moi » : vendu, donné, jeté / cassé, perdu / volé. */
export async function sortirBien(id: string, sortie: { motif: MotifSortie; date: string; prixVente?: Centimes }, base: BudgetDB = db): Promise<void> {
  await base.biens.update(id, { sortie: { motif: sortie.motif, date: sortie.date, ...(sortie.motif === 'vendu' && sortie.prixVente !== undefined ? { prixVente: sortie.prixVente } : {}) } })
}

/** Après une vente : « Ignorer » la proposition d'ajouter le prix au solde. */
export async function ignorerVente(id: string, base: BudgetDB = db): Promise<void> {
  const b = await base.biens.get(id)
  if (b?.sortie) await base.biens.update(id, { sortie: { ...b.sortie, venteIgnoree: true } })
}

export async function reactiverBien(id: string, base: BudgetDB = db): Promise<void> {
  await base.biens.update(id, { sortie: undefined })
}

/** Après une vente : ajoute le prix de vente au solde d'un compte (revenu, catégorie « Vente »). Jamais automatique. */
export async function encaisserVente(id: string, compteId: string, base: BudgetDB = db): Promise<Operation | undefined> {
  return base.transaction('rw', [base.biens, base.operations, base.categories, base.comptes], async () => {
    const b = await base.biens.get(id)
    if (!b?.sortie || b.sortie.motif !== 'vendu' || !b.sortie.prixVente || b.sortie.operationId) return undefined
    if (!(await base.categories.get(CATEGORIE_VENTE))) {
      await base.categories.add({ id: CATEGORIE_VENTE, nom: 'Vente', icone: '🏷️', couleur: '#22C55E', ordre: await base.categories.count(), archivee: false })
    }
    const op: Operation = { id: nouvelId(), date: b.sortie.date, montant: b.sortie.prixVente, type: 'revenu', compteId, categorieId: CATEGORIE_VENTE, note: `Vente : ${b.nom}`, creeLe: Date.now() }
    await base.operations.add(op)
    await base.biens.update(id, { sortie: { ...b.sortie, operationId: op.id } })
    return op
  })
}

export const CATEGORIE_VENTE = 'vente'

export async function supprimerBien(id: string, base: BudgetDB = db): Promise<void> {
  await base.transaction('rw', base.biens, base.photos, base.operations, async () => {
    const b = await base.biens.get(id)
    if (!b) return
    for (const p of [b.photoId, b.factureId]) if (p) await base.photos.delete(p)
    // les dépenses de réparation restent, sans lien
    for (const op of await base.operations.filter((o) => o.bienId === id).toArray()) await base.operations.update(op.id, { bienId: undefined })
    await base.biens.delete(id)
  })
}

export async function enregistrerPhoto(donnees: string, taille: number, base: BudgetDB = db): Promise<PhotoBien> {
  const p: PhotoBien = { id: nouvelId(), donnees, taille }
  await base.photos.add(p)
  return p
}

/** Décote d'une catégorie de biens (Réglages → Catégories de biens). null : revenir au défaut. */
export async function modifierTauxCategorie(categorie: CategorieBien, valeur: { taux: number; tauxAnnee1?: number } | null, base: BudgetDB = db): Promise<void> {
  const r = await lireReglages(base)
  const t = { ...(r.tauxBiens ?? {}) }
  if (valeur) t[categorie] = valeur
  else delete t[categorie]
  await modifierReglages({ tauxBiens: t }, base)
}
