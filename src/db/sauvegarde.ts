import type { Reglages, Voyage } from '../domain/types'
import { db, lireReglages, modifierReglages, type BudgetDB } from './db'

/** Contenu d'une sauvegarde (avant chiffrement). Le code PIN et l'état du verrouillage ne sont jamais sauvegardés. */
export interface ContenuSauvegarde {
  schema: 1
  exporteLe: string
  tables: {
    comptes: unknown[]; operations: unknown[]; recurrences: unknown[]; categories: unknown[]
    periodes: unknown[]; objectifs: unknown[]; reglages: Partial<Reglages>
    voyages?: unknown[] // absent des sauvegardes créées avant le mode voyage
  }
}

const SECURITE: (keyof Reglages)[] = ['pinHash', 'pinSel', 'pinIterations', 'echecsPin', 'bloqueJusqua', 'faceIdActive', 'faceIdIdentifiant']
const TABLES = ['comptes', 'operations', 'recurrences', 'categories', 'periodes', 'objectifs'] as const
const TABLES_FACULTATIVES = ['voyages'] as const

export async function exporterDonnees(base: BudgetDB = db, maintenant = new Date()): Promise<ContenuSauvegarde> {
  return base.transaction('r', [...TABLES.map((t) => base[t]), base.voyages, base.reglages], async () => {
    const reglages: Partial<Reglages> = { ...(await lireReglages(base)) }
    for (const k of SECURITE) delete reglages[k]
    const [comptes, operations, recurrences, categories, periodes, objectifs] = await Promise.all(TABLES.map((t) => base[t].toArray()))
    const voyages = await base.voyages.toArray()
    return { schema: 1, exporteLe: maintenant.toISOString(), tables: { comptes, operations, recurrences, categories, periodes, objectifs, voyages, reglages } }
  })
}

/** Petit résumé lisible d'une sauvegarde (avant de la restaurer). */
export function resumerSauvegarde(c: ContenuSauvegarde) {
  return { comptes: c.tables.comptes.length, operations: c.tables.operations.length, objectifs: c.tables.objectifs.length, exporteLe: c.exporteLe }
}

export function validerContenu(texte: string): ContenuSauvegarde {
  const c = JSON.parse(texte) as ContenuSauvegarde
  if (c?.schema !== 1 || typeof c.tables !== 'object') throw new Error('Contenu de sauvegarde invalide')
  for (const t of TABLES) if (!Array.isArray(c.tables[t])) throw new Error(`Contenu de sauvegarde invalide (${t})`)
  for (const t of TABLES_FACULTATIVES) if (c.tables[t] !== undefined && !Array.isArray(c.tables[t])) throw new Error(`Contenu de sauvegarde invalide (${t})`)
  return c
}

/**
 * Restaure une sauvegarde : remplace toutes les données de l'app (comptes, opérations, catégories…).
 * Le code PIN et Face ID de cet appareil sont conservés.
 */
export async function restaurerDonnees(c: ContenuSauvegarde, base: BudgetDB = db): Promise<void> {
  await base.transaction('rw', [...TABLES.map((t) => base[t]), base.voyages, base.reglages], async () => {
    for (const t of TABLES) {
      await base[t].clear()
      await (base[t] as unknown as { bulkAdd: (x: unknown[]) => Promise<unknown> }).bulkAdd(c.tables[t])
    }
    await base.voyages.clear()
    await base.voyages.bulkAdd((c.tables.voyages ?? []) as Voyage[])
    const actuels = await lireReglages(base)
    const garder: Partial<Reglages> = {}
    for (const k of SECURITE) if (actuels[k] !== undefined) (garder as Record<string, unknown>)[k] = actuels[k]
    const restaures = { ...c.tables.reglages }
    for (const k of SECURITE) delete restaures[k]
    await base.reglages.clear()
    await modifierReglages({ ...restaures, ...garder, donneesInitialisees: true }, base)
  })
}
