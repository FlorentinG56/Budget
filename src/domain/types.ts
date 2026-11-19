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
  montant: Centimes // positif ; le sens vient du type (exception : « ajustement », signé)
  type: TypeOperation
  compteId: string
  compteDestinationId?: string // virement, remboursement carte
  montantRecu?: Centimes // virement : montant reçu dans la devise d'arrivée
  categorieId?: string
  sousCategorieId?: string
  note?: string
  recurrenceId?: string
  partCapital?: Centimes // mensualité de crédit : part qui rembourse le capital
  echeance?: DateISO // opération issue d'une récurrence : date d'échéance prévue (peut différer de la date réelle)
  objectifEpargneId?: string // dépense payée avec l'épargne : retirée de l'objectif, hors budget du jour
  horsBudget?: boolean // dépense « à côté du budget » : payée avec le non affecté laissé sur le compte, hors budget du jour
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
  capitalRestantDu?: Centimes // crédit : capital à la date de référence (saisi, modifiable)
  capitalReferenceDate?: DateISO // date à laquelle capitalRestantDu était exact
  capitalInitial?: Centimes // pour la barre de progression
  tauxAnnuel?: number // en %, ex. 5.9
  actif: boolean
  aConfirmer?: boolean // rien n'est généré automatiquement : l'app demande le montant réel le jour venu
  derniereEcheanceGeneree?: DateISO // les échéances jusqu'à cette date (incluse) sont déjà traitées
}

export interface Categorie {
  id: string
  nom: string
  icone: string
  couleur: string
  parentId?: string
  ordre: number
  archivee: boolean
  budgetMensuel?: Centimes // catégorie principale : budget du mois (comptes du budget du jour), facultatif
}

export interface AjoutEnveloppe {
  operationId: string // revenu ponctuel ou virement reçu en cours de période
  montant: Centimes
}

export type AffectationFin = 'epargne' | 'report' | 'deficit_reporte' | 'aucune'

export interface Periode {
  id: string
  dateDebut: DateISO
  dateFin: DateISO
  enveloppeValidee?: Centimes // inclut le report précédent, épargne déjà retirée
  epargneMiseDeCote: Centimes // mis de côté à la paie (ne réduit pas l'enveloppe)
  reportPrecedent: Centimes // ancien fonctionnement (report) : 0 désormais
  ajouts: AjoutEnveloppe[]
  demarrageLe?: DateISO // 1re période commencée en cours de route : jour du démarrage du budget
  aCote?: Centimes // non affecté laissé sur le compte à la paie, utilisable hors budget du jour
  aCoteVersSecurite?: Centimes // fin de période : reste « à côté » rangé dans Sécurité
  cloturee: boolean
  affectationFin?: AffectationFin // choix fait au bilan
  montantAffecte?: Centimes // reste (ou déficit) concerné par ce choix
}

export interface MouvementEpargne {
  id: string
  date: DateISO
  montant: Centimes // positif ; le sens dit s'il s'ajoute ou se retire
  sens: 'mise_de_cote' | 'reprise'
  note?: string
  source?: string // mouvement automatique : 'paie:<période>' ou 'bilan:<période>' (évite les doublons)
}

export interface ObjectifEpargne {
  id: string
  nom: string
  compteId: string
  montantCible?: Centimes
  dateCible?: DateISO
  mouvements: MouvementEpargne[]
  archive: boolean
  ordre?: number // ordre d'affichage choisi (sinon : Sécurité d'abord, puis par nom)
}

export interface Reglages {
  id: 'app'
  dureePeriodeJours: number
  delaiAlerteJours: number
  heureRappel: string // 'HH:mm' : heure du rappel du soir (notification)
  pinHash?: string // base64
  pinSel?: string // base64
  pinIterations?: number
  faceIdActive: boolean
  faceIdIdentifiant?: string // identifiant (base64) de la clé Face ID créée sur cet iPhone
  derniereSauvegarde?: number
  verrouillageMinutes: number
  echecsPin: number
  bloqueJusqua?: number
  donneesInitialisees: boolean // comptes et catégories de départ créés
  soldesDepartSaisis: boolean // l'utilisateur a renseigné ses soldes de départ
  dernierMoyenPaiement: 'debit' | 'carte'
  recurrencePaieId?: string // revenu récurrent qui ouvre chaque période du budget
  budgetParPeriode: Centimes // enveloppe fixe proposée à chaque paie (choisie au parcours d'accueil)
  objectifSecuriteId?: string // objectif qui reçoit l'épargne de la paie et le reste des périodes
  rappelSauvegardeJours: number // « Dernière sauvegarde il y a X jours » au-delà de ce délai
  parcoursAccueil?: 'en_cours' | 'termine' // premier lancement d'un nouvel utilisateur
  revuesVues?: string[] // revues de fin de mois déjà ouvertes ('AAAA-MM')
}

export const REGLAGES_PAR_DEFAUT: Reglages = {
  id: 'app',
  dureePeriodeJours: 14,
  delaiAlerteJours: 2,
  heureRappel: '21:00',
  faceIdActive: false,
  verrouillageMinutes: 2,
  echecsPin: 0,
  donneesInitialisees: false,
  soldesDepartSaisis: false,
  dernierMoyenPaiement: 'debit',
  budgetParPeriode: 0,
  rappelSauvegardeJours: 14,
}
