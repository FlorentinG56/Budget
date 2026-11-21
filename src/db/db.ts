import Dexie, { type Table } from 'dexie'
import {
  REGLAGES_PAR_DEFAUT,
  type Categorie,
  type Compte,
  type ObjectifEpargne,
  type Operation,
  type Periode,
  type Recurrence,
  type Reglages,
  type Voyage,
  type Bien,
  type PhotoBien,
} from '../domain/types'

/** Base locale IndexedDB : rien ne quitte l'iPhone. */
export class BudgetDB extends Dexie {
  comptes!: Table<Compte, string>
  operations!: Table<Operation, string>
  recurrences!: Table<Recurrence, string>
  categories!: Table<Categorie, string>
  periodes!: Table<Periode, string>
  objectifs!: Table<ObjectifEpargne, string>
  reglages!: Table<Reglages, string>
  voyages!: Table<Voyage, string>
  biens!: Table<Bien, string>
  photos!: Table<PhotoBien, string>

  constructor(nom = 'budget') {
    super(nom)
    // Seuls les champs indexés sont listés ; les autres sont stockés quand même.
    this.version(1).stores({
      comptes: 'id, ordre, archive',
      operations: 'id, date, compteId, compteDestinationId, type, categorieId, recurrenceId, [compteId+date]',
      recurrences: 'id, type, compteId, actif',
      categories: 'id, parentId, ordre, archivee',
      periodes: 'id, dateDebut, dateFin',
      objectifs: 'id, compteId',
      reglages: 'id',
    })
    // version 2 : ajout des voyages (aucune donnée existante n'est modifiée)
    this.version(2).stores({ voyages: 'id, debut, fin, compteId' })
    // version 3 : patrimoine (biens et leurs photos), sans modifier les données existantes
    this.version(3).stores({ biens: 'id, categorie, dateAcquisition', photos: 'id' })
  }
}

export const db = new BudgetDB()

export async function lireReglages(base: BudgetDB = db): Promise<Reglages> {
  const r = await base.reglages.get('app')
  return { ...REGLAGES_PAR_DEFAUT, ...r }
}

export async function modifierReglages(changements: Partial<Omit<Reglages, 'id'>>, base: BudgetDB = db): Promise<Reglages> {
  return base.transaction('rw', base.reglages, async () => {
    const actuels = await lireReglages(base)
    const nouveaux = { ...actuels, ...changements, id: 'app' as const }
    await base.reglages.put(nouveaux)
    return nouveaux
  })
}

/**
 * Demande à Safari de ne jamais effacer les données automatiquement.
 * (Une app installée sur l'écran d'accueil est déjà protégée, ceci renforce la garantie.)
 */
export async function demanderStockagePersistant(): Promise<boolean> {
  try {
    if (navigator.storage?.persisted && (await navigator.storage.persisted())) return true
    return (await navigator.storage?.persist?.()) ?? false
  } catch {
    return false
  }
}
