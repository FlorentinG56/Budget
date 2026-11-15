/**
 * Modèle de données (cahier des charges, « Modèle de données »).
 * Montants en centimes (entiers). Dates calendaires au format 'AAAA-MM-JJ' (pas de fuseau horaire).
 * Les soldes ne sont jamais stockés : ils sont recalculés.
 */

export type Devise = 'CAD' | 'EUR'
export type DateISO = string // 'AAAA-MM-JJ'
export type Centimes = number

export type TypeCompte = 'cheque' | 'carte_credit' | 'epargne'

export interface Compte {
  id: string
  nom: string
  type: TypeCompte
  devise: Devise
  couleur: string
  soldeDepart: Centimes
  dateDepart: DateISO
  compteRemboursementId?: string // pour une carte de crédit : le compte qui la rembourse
  inclusBudgetJournalier: boolean
  archive: boolean
  ordre: number
}

export type TypeOperation =
  | 'depense'
  | 'revenu'
  | 'virement'
  | 'remboursement_carte'
  | 'ajustement'
  | 'prelevement_fixe'

export interface Operation {
  id: string
  date: DateISO
  montant: Centimes // toujours positif ; le sens vient du type
  type: TypeOperation
  compteId: string
  compteDestinationId?: string // virement, remboursement carte
  montantRecu?: Centimes // virement : montant reçu dans la devise d'arrivée
  categorieId?: string
  sousCategorieId?: string
  note?: string
  recurrenceId?: string
  creeLe: number // horodatage de saisie
}

export type TypeRecurrence = 'charge_fixe' | 'credit' | 'revenu'
export type Frequence = 'mensuel' | '14_jours' | 'deux_dates_par_mois'
export type MoyenPaiement = 'compte' | 'carte'

export interface Recurrence {
  id: string
  type: TypeRecurrence
  libelle: string
  montant: Centimes
  compteId: string
  moyenPaiement: MoyenPaiement
  carteId?: string
  categorieId?: string
  sousCategorieId?: string
  frequence: Frequence
  jours: number[] // mensuel : [jour] ; deux dates : [15, 31] ; 14 jours : inutilisé
  dateDebut: DateISO // pour « 14 jours » : date de référence
  dateFin?: DateISO
  capitalRestantDu?: Centimes
  tauxAnnuel?: number // en %, ex. 5.9
  actif: boolean
  derniereEcheanceGeneree?: DateISO
}

export interface Categorie {
  id: string
  nom: string
  icone: string
  couleur: string
  parentId?: string
  ordre: number
  archivee: boolean
}

export interface Periode {
  id: string
  dateDebut: DateISO
  dateFin: DateISO
  enveloppeValidee?: Centimes
  epargneMiseDeCote: Centimes
  reportPrecedent: Centimes
  cloturee: boolean
}

export interface MouvementEpargne {
  date: DateISO
  montant: Centimes
  sens: 'mise_de_cote' | 'reprise'
}

export interface ObjectifEpargne {
  id: string
  nom: string
  compteId: string
  montantCible?: Centimes
  dateCible?: DateISO
  mouvements: MouvementEpargne[]
  archive: boolean
}

export interface Reglages {
  id: 'app'
  dureePeriodeJours: number
  delaiAlerteJours: number
  heureRappel: string // 'HH:mm'
  pinHash?: string // base64
  pinSel?: string // base64
  pinIterations?: number
  faceIdActive: boolean
  derniereSauvegarde?: number
  verrouillageMinutes: number
  echecsPin: number
  bloqueJusqua?: number
}

export const REGLAGES_PAR_DEFAUT: Reglages = {
  id: 'app',
  dureePeriodeJours: 14,
  delaiAlerteJours: 2,
  heureRappel: '21:00',
  faceIdActive: false,
  verrouillageMinutes: 2,
  echecsPin: 0,
}
