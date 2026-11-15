import type { Centimes, Devise } from './types'

const SYMBOLES: Record<Devise, string> = { CAD: '$', EUR: '€' }
const NBSP = ' '

const ESPACE_FINE = '\u202f' // séparateur des milliers (espace fine insécable)

/**
 * Formatage fait main plutôt qu'avec Intl : selon le navigateur, Intl groupe ou non les nombres
 * à 4 chiffres (« 1487,50 » contre « 1 487,50 »). Ici le résultat est le même partout.
 */
function grouper(entier: number): string {
  return String(entier).replace(/\B(?=(\d{3})+(?!\d))/g, ESPACE_FINE)
}

/** 123456 centimes, CAD → « 1 234,56 $ » ; EUR → « 1 234,56 € ». */
export function formaterMontant(centimes: Centimes, devise: Devise, options: { sansDecimales?: boolean; signe?: boolean } = {}): string {
  if (!Number.isInteger(centimes)) throw new Error('Montant attendu en centimes entiers')
  const negatif = centimes < 0
  const abs = Math.abs(centimes)
  const texte = options.sansDecimales
    ? grouper(Math.round(abs / 100))
    : `${grouper(Math.floor(abs / 100))},${String(abs % 100).padStart(2, '0')}`
  const signe = negatif ? '−' : options.signe && centimes > 0 ? '+' : ''
  return `${signe}${texte}${NBSP}${SYMBOLES[devise]}`
}

/** Saisie au pavé numérique : « 12,5 » ou « 12.50 » → 1250. Renvoie null si invalide. */
export function analyserMontant(saisie: string): Centimes | null {
  const propre = saisie.replace(/[\s  ]/g, '').replace(',', '.')
  if (!/^\d+(\.\d{0,2})?$/.test(propre)) return null
  const [entier, dec = ''] = propre.split('.')
  return Number(entier) * 100 + Number(dec.padEnd(2, '0'))
}
