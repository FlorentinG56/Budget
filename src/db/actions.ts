import { aujourdhui } from '../domain/dates'
import { montantAjustement, soldeCompte } from '../domain/soldes'
import type { Categorie, Centimes, Compte, Operation } from '../domain/types'
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
