import { useLiveQuery } from 'dexie-react-hooks'
import { db, lireReglages } from '../db/db'
import type { Categorie, Compte, Operation, Recurrence, Reglages } from '../domain/types'

/** Lectures réactives : l'écran se met à jour tout seul quand la base change. */
export function useComptes(avecArchives = false): Compte[] | undefined {
  return useLiveQuery(async () => {
    const l = await db.comptes.orderBy('ordre').toArray()
    return avecArchives ? l : l.filter((c) => !c.archive)
  }, [avecArchives])
}

export function useCategories(): Categorie[] | undefined {
  return useLiveQuery(() => db.categories.orderBy('ordre').toArray(), [])
}

export function useOperations(): Operation[] | undefined {
  return useLiveQuery(() => db.operations.toArray(), [])
}

export function useReglages(): Reglages | undefined {
  return useLiveQuery(() => lireReglages(), [])
}

export function indexer<T extends { id: string }>(liste: T[] | undefined): Map<string, T> {
  return new Map((liste ?? []).map((x) => [x.id, x]))
}

export function useRecurrences(): Recurrence[] | undefined {
  return useLiveQuery(() => db.recurrences.toArray(), [])
}

export function useObjectifs(): import('../domain/types').ObjectifEpargne[] | undefined {
  return useLiveQuery(() => db.objectifs.toArray(), [])
}

export function useVoyages(): import('../domain/types').Voyage[] | undefined {
  return useLiveQuery(() => db.voyages.toArray(), [])
}
