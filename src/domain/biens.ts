import { differenceInCalendarDays, parseISO } from 'date-fns'
import type { Bien, CategorieBien, Centimes, DateISO, Devise, EtatBien, MotifSortie, Reglages } from './types'

/**
 * Patrimoine : valeur actuelle des biens selon leur décote. Fonctions pures, testées dans biens.test.ts.
 *
 * valeur = prix × (1 − taux)^années × coefficient d'état, jamais sous le plancher.
 * Années comptées au jour près depuis l'acquisition. Véhicule : taux de la 1re année puis taux des suivantes.
 * Une valeur saisie à la main remplace le calcul à partir de sa date.
 */

export interface InfoCategorieBien { id: CategorieBien; nom: string; icone: string; taux: number; tauxAnnee1?: number }

export const CATEGORIES_BIENS: InfoCategorieBien[] = [
  { id: 'telephone', nom: 'Téléphones, tablettes, montres connectées', icone: '📱', taux: 30 },
  { id: 'ordinateur', nom: 'Ordinateurs', icone: '💻', taux: 20 },
  { id: 'tv_audio', nom: 'TV, audio, consoles', icone: '📺', taux: 20 },
  { id: 'vehicule', nom: 'Voiture, moto', icone: '🚗', taux: 15, tauxAnnee1: 20 },
  { id: 'velo_sport', nom: 'Vélo, sport, plein air', icone: '🚲', taux: 15 },
  { id: 'electromenager', nom: 'Électroménager', icone: '🧊', taux: 12 },
  { id: 'mobilier', nom: 'Mobilier, déco', icone: '🛋️', taux: 10 },
  { id: 'outils', nom: 'Outils, bricolage', icone: '🔧', taux: 10 },
  { id: 'bijoux', nom: 'Bijoux, montres, art, collection', icone: '💍', taux: 0 },
  { id: 'autres', nom: 'Autres', icone: '📦', taux: 15 },
]

export const ETATS_BIENS: { id: EtatBien; nom: string; coefficient: number }[] = [
  { id: 'tres_bon', nom: 'Très bon', coefficient: 1 },
  { id: 'bon', nom: 'Bon', coefficient: 0.9 },
  { id: 'use', nom: 'Usé', coefficient: 0.75 },
  { id: 'abime', nom: 'Abîmé', coefficient: 0.55 },
  { id: 'hors_service', nom: 'Hors service', coefficient: 0.1 },
]

export const MOTIFS_SORTIE: { id: MotifSortie; nom: string }[] = [
  { id: 'vendu', nom: 'Vendu' }, { id: 'donne', nom: 'Donné' }, { id: 'jete', nom: 'Jeté / cassé' }, { id: 'perdu', nom: 'Perdu / volé' },
]

export const PLANCHER_DEFAUT = 10 // % du prix d'achat
export const SEUIL_BIENS_DEFAUT: Centimes = 20000

export const infoCategorie = (c: CategorieBien) => CATEGORIES_BIENS.find((x) => x.id === c) ?? CATEGORIES_BIENS[CATEGORIES_BIENS.length - 1]
export const coefficientEtat = (e: EtatBien) => ETATS_BIENS.find((x) => x.id === e)?.coefficient ?? 1
export const nomEtat = (e: EtatBien) => ETATS_BIENS.find((x) => x.id === e)?.nom ?? e

/** Décote (en %) qui s'applique au bien : la sienne, sinon celle de sa catégorie (modifiée dans Réglages ou par défaut). */
export function tauxDuBien(b: Pick<Bien, 'categorie' | 'taux' | 'tauxAnnee1'>, reglages?: Pick<Reglages, 'tauxBiens'>): { taux: number; tauxAnnee1?: number } {
  const cat = infoCategorie(b.categorie)
  const regle = reglages?.tauxBiens?.[b.categorie]
  const taux = b.taux ?? regle?.taux ?? cat.taux
  const annee1 = b.categorie === 'vehicule' ? (b.tauxAnnee1 ?? regle?.tauxAnnee1 ?? cat.tauxAnnee1 ?? taux) : undefined
  return annee1 === undefined ? { taux } : { taux, tauxAnnee1: annee1 }
}

/** Années écoulées (au jour près, fractionnaires) entre deux dates. */
export function anneesEcoulees(du: DateISO, au: DateISO): number {
  return Math.max(0, differenceInCalendarDays(parseISO(au), parseISO(du))) / 365.25
}

/** État du bien à une date (d'après l'historique des changements). */
export function etatA(b: Pick<Bien, 'etat' | 'historiqueEtat'>, date: DateISO): EtatBien {
  const changements = [...b.historiqueEtat].sort((x, y) => x.date.localeCompare(y.date))
  if (changements.length === 0) return b.etat
  let etat = changements[0].ancien
  for (const c of changements) if (c.date <= date) etat = c.nouveau
  return etat
}

/** Valeur calculée (sans valeur manuelle) à une date. */
export function valeurCalculee(b: Bien, date: DateISO, reglages?: Pick<Reglages, 'tauxBiens'>): Centimes {
  const { taux, tauxAnnee1 } = tauxDuBien(b, reglages)
  const a = anneesEcoulees(b.dateAcquisition, date)
  const decote = tauxAnnee1 !== undefined
    ? Math.pow(1 - tauxAnnee1 / 100, Math.min(a, 1)) * Math.pow(1 - taux / 100, Math.max(0, a - 1))
    : Math.pow(1 - taux / 100, a)
  const plancher = b.prixAchat * (b.planchePct ?? PLANCHER_DEFAUT) / 100
  return Math.round(Math.max(plancher, b.prixAchat * decote * coefficientEtat(etatA(b, date))))
}

/**
 * Valeur du bien à une date : 0 avant l'acquisition et à partir de sa sortie ; la valeur manuelle
 * à partir de sa date ; sinon la valeur calculée.
 */
export function valeurBien(b: Bien, date: DateISO, reglages?: Pick<Reglages, 'tauxBiens'>): Centimes {
  if (date < b.dateAcquisition) return 0
  if (b.sortie && date >= b.sortie.date) return 0
  if (b.valeurManuelle && date >= b.valeurManuelle.date) return b.valeurManuelle.montant
  return valeurCalculee(b, date, reglages)
}

/** Valeur estimée juste avant la sortie (pour le gain ou la perte d'une vente). */
export function valeurAvantSortie(b: Bien, reglages?: Pick<Reglages, 'tauxBiens'>): Centimes {
  return valeurBien({ ...b, sortie: undefined }, b.sortie?.date ?? b.dateAcquisition, reglages)
}

/** Décote en % depuis l'achat (0 à 100). */
export function decotePct(prix: Centimes, valeur: Centimes): number {
  return prix > 0 ? Math.round((1 - valeur / prix) * 100) : 0
}

export const biensActifs = (biens: Bien[]) => biens.filter((b) => !b.sortie)

export interface TotauxBiens { achat: Centimes; valeur: Centimes; perte: Centimes; nombre: number }

/** Totaux par devise des biens actifs : coût d'achat, valeur actuelle, perte de valeur. */
export function totauxBiens(biens: Bien[], date: DateISO, reglages?: Pick<Reglages, 'tauxBiens'>): Map<Devise, TotauxBiens> {
  const t = new Map<Devise, TotauxBiens>()
  for (const b of biensActifs(biens)) {
    const x = t.get(b.devise) ?? { achat: 0, valeur: 0, perte: 0, nombre: 0 }
    const v = valeurBien(b, date, reglages)
    x.achat += b.prixAchat; x.valeur += v; x.perte += b.prixAchat - v; x.nombre++
    t.set(b.devise, x)
  }
  return trier(t)
}

/** Détail par catégorie (et devise) des biens actifs. */
export function totauxParCategorie(biens: Bien[], date: DateISO, reglages?: Pick<Reglages, 'tauxBiens'>): { categorie: CategorieBien; devise: Devise; totaux: TotauxBiens }[] {
  const lignes: { categorie: CategorieBien; devise: Devise; totaux: TotauxBiens }[] = []
  for (const c of CATEGORIES_BIENS) {
    for (const [devise, totaux] of totauxBiens(biens.filter((b) => b.categorie === c.id), date, reglages)) lignes.push({ categorie: c.id, devise, totaux })
  }
  return lignes.sort((a, b) => b.totaux.valeur - a.totaux.valeur)
}

function trier<T>(m: Map<Devise, T>): Map<Devise, T> {
  return new Map([...m].sort((a, b) => (a[0] === 'CAD' ? -1 : b[0] === 'CAD' ? 1 : 0)))
}

/** Valeur nette par devise = épargne + valeur des biens − capital restant dû des dettes. */
export function valeurNette(epargne: Map<Devise, Centimes>, biens: Map<Devise, TotauxBiens>, dettes: Map<Devise, Centimes>): Map<Devise, Centimes> {
  const t = new Map<Devise, Centimes>()
  const ajouter = (d: Devise, v: Centimes) => t.set(d, (t.get(d) ?? 0) + v)
  for (const [d, v] of epargne) ajouter(d, v)
  for (const [d, v] of biens) ajouter(d, v.valeur)
  for (const [d, v] of dettes) ajouter(d, -v)
  return trier(t)
}

/** Coût total d'un bien = prix d'achat + réparations et entretien rattachés. */
export function coutTotal(b: Pick<Bien, 'prixAchat'>, reparations: Centimes): Centimes {
  return b.prixAchat + reparations
}

/** Garanties qui se terminent dans les 30 jours (biens actifs avec une date de fin de garantie). */
export function garantiesBientotFinies(biens: Bien[], aujourdhui: DateISO, jours = 30): Bien[] {
  return biensActifs(biens).filter((b) => b.finGarantie && b.finGarantie >= aujourdhui && differenceInCalendarDays(parseISO(b.finGarantie), parseISO(aujourdhui)) <= jours)
}

/** Dimensions d'une photo réduite : le plus grand côté ne dépasse pas max (jamais agrandie). */
export function dimensionsReduites(largeur: number, hauteur: number, max = 1600): { largeur: number; hauteur: number } {
  const r = Math.min(1, max / Math.max(largeur, hauteur, 1))
  return { largeur: Math.max(1, Math.round(largeur * r)), hauteur: Math.max(1, Math.round(hauteur * r)) }
}

/** Taille en octets d'une data URL base64. */
export function tailleDataUrl(dataUrl: string): number {
  const b64 = dataUrl.slice(dataUrl.indexOf(',') + 1)
  return Math.floor(b64.length * 3 / 4) - (b64.endsWith('==') ? 2 : b64.endsWith('=') ? 1 : 0)
}

/** Vente : gain (+) ou perte (−) par rapport à la valeur estimée et par rapport au prix d'achat. */
export function resultatVente(b: Bien, reglages?: Pick<Reglages, 'tauxBiens'>): { valeurEstimee: Centimes; parRapportEstimation: Centimes; parRapportAchat: Centimes } | undefined {
  if (b.sortie?.motif !== 'vendu' || b.sortie.prixVente === undefined) return undefined
  const valeurEstimee = valeurAvantSortie(b, reglages)
  return { valeurEstimee, parRapportEstimation: b.sortie.prixVente - valeurEstimee, parRapportAchat: b.sortie.prixVente - b.prixAchat }
}

// ---------- F5 : courbe, tri, filtre ----------

export interface PointValeur { date: DateISO; valeur: Centimes }

/**
 * Évolution de la valeur totale des biens d'une devise, calculée (rien n'est stocké) : un point le 1er de chaque mois
 * depuis la première acquisition, plus aujourd'hui. Les biens sortis comptent jusqu'à leur sortie.
 */
export function courbeValeurBiens(biens: Bien[], devise: Devise, aujourdhui: DateISO, reglages?: Pick<Reglages, 'tauxBiens'>): PointValeur[] {
  const liste = biens.filter((b) => b.devise === devise)
  if (liste.length === 0) return []
  const debut = liste.map((b) => b.dateAcquisition).sort()[0]
  const dates: DateISO[] = [debut]
  let [a, m] = [Number(debut.slice(0, 4)), Number(debut.slice(5, 7))]
  for (;;) {
    m++; if (m > 12) { m = 1; a++ }
    const d = `${a}-${String(m).padStart(2, '0')}-01`
    if (d >= aujourdhui) break
    dates.push(d)
  }
  if (aujourdhui > debut) dates.push(aujourdhui)
  return dates.map((date) => ({ date, valeur: liste.reduce((s, b) => s + valeurBien(b, date, reglages), 0) }))
}

export type TriBiens = 'valeur' | 'date' | 'nom' | 'categorie'

/** Tri de la liste : valeur (la plus haute d'abord), date (le plus récent d'abord), nom, catégorie (puis valeur). */
export function trierBiens(biens: Bien[], tri: TriBiens, date: DateISO, reglages?: Pick<Reglages, 'tauxBiens'>): Bien[] {
  const v = new Map(biens.map((b) => [b.id, valeurBien(b, date, reglages)]))
  const ordreCat = new Map(CATEGORIES_BIENS.map((c, i) => [c.id, i]))
  const parValeur = (x: Bien, y: Bien) => v.get(y.id)! - v.get(x.id)!
  return [...biens].sort((x, y) => {
    switch (tri) {
      case 'date': return y.dateAcquisition.localeCompare(x.dateAcquisition) || x.nom.localeCompare(y.nom, 'fr')
      case 'nom': return x.nom.localeCompare(y.nom, 'fr')
      case 'categorie': return ordreCat.get(x.categorie)! - ordreCat.get(y.categorie)! || parValeur(x, y)
      default: return parValeur(x, y) || x.nom.localeCompare(y.nom, 'fr')
    }
  })
}

// ---------- F6 : « L'ajouter à tes biens ? » après une dépense ----------

/** Catégories (principales) où une grosse dépense est proposée aux biens. */
export const CATEGORIES_PROPOSEES_AUX_BIENS = ['shopping', 'transport', 'activite-pro', 'loisirs']
/** Sous-catégories exclues : une réparation se rattache à un bien existant (champ « Objet »), ce n'est pas un nouveau bien. */
export const SOUS_CATEGORIES_EXCLUES = ['transport/entretien-reparations', 'transport/essence', 'transport/stationnement', 'transport/transport-en-commun', 'transport/taxi-uber']

/** Proposer d'ajouter la dépense aux biens : dépense d'au moins le seuil, catégorie concernée, pas déjà une réparation. */
export function proposerAuxBiens(op: Pick<import('./types').Operation, 'type' | 'montant' | 'categorieId' | 'sousCategorieId' | 'bienId'>, seuil: Centimes = SEUIL_BIENS_DEFAUT): boolean {
  if (op.type !== 'depense' || op.montant < seuil || op.bienId || !op.categorieId) return false
  if (op.sousCategorieId && SOUS_CATEGORIES_EXCLUES.includes(op.sousCategorieId)) return false
  return CATEGORIES_PROPOSEES_AUX_BIENS.includes(op.categorieId)
}
