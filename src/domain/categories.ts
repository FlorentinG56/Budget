import type { Categorie, Operation } from './types'

export function categoriesPrincipales(categories: Categorie[]): Categorie[] {
  return categories.filter((c) => !c.parentId && !c.archivee)
}

export function sousCategories(categories: Categorie[], parentId: string): Categorie[] {
  return categories.filter((c) => c.parentId === parentId && !c.archivee).sort((a, b) => a.ordre - b.ordre)
}

/**
 * Catégories pour la saisie rapide : les plus utilisées (sur les 90 derniers jours) en premier,
 * puis l'ordre défini. Le tri est stable : une catégorie jamais utilisée garde sa place.
 */
export function trierParUsage(categories: Categorie[], operations: Operation[], depuis?: string): Categorie[] {
  const usage = new Map<string, number>()
  for (const op of operations) {
    if (op.type !== 'depense' || !op.categorieId) continue
    if (depuis && op.date < depuis) continue
    usage.set(op.categorieId, (usage.get(op.categorieId) ?? 0) + 1)
  }
  return categoriesPrincipales(categories).sort((a, b) => (usage.get(b.id) ?? 0) - (usage.get(a.id) ?? 0) || a.ordre - b.ordre)
}
