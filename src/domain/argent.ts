import type { Centimes, Devise } from './types'

const SYMBOLES: Record<Devise, string> = { CAD: '$', EUR: '€' }
const NBSP = ' '

const fmt = new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const fmtEntier = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 })

/** 123456 centimes, CAD → « 1 234,56 $ » ; EUR → « 1 234,56 € ». */
export function formaterMontant(centimes: Centimes, devise: Devise, options: { sansDecimales?: boolean; signe?: boolean } = {}): string {
  if (!Number.isInteger(centimes)) throw new Error('Montant attendu en centimes entiers')
  const negatif = centimes < 0
  const valeur = Math.abs(centimes) / 100
  const texte = options.sansDecimales ? fmtEntier.format(Math.round(valeur)) : fmt.format(valeur)
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
