/**
 * Verrouillage automatique : l'app se reverrouille si elle est restée en arrière-plan plus de N minutes.
 * Fonction pure, testée dans verrouillage.test.ts.
 */
export function doitVerrouiller(masqueeDepuis: number | null, maintenant: number, delaiMinutes: number): boolean {
  if (masqueeDepuis === null) return false
  if (delaiMinutes <= 0) return true // « immédiatement »
  return maintenant - masqueeDepuis >= delaiMinutes * 60_000
}

export const CHOIX_DELAI_VERROUILLAGE = [
  { minutes: 0, libelle: 'Immédiatement' },
  { minutes: 1, libelle: 'Après 1 minute' },
  { minutes: 2, libelle: 'Après 2 minutes' },
  { minutes: 5, libelle: 'Après 5 minutes' },
  { minutes: 15, libelle: 'Après 15 minutes' },
] as const
