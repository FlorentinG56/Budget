import { describe, expect, it } from 'vitest'
import { analyserMontant, formaterMontant } from './argent'

// Intl utilise une espace fine insécable (U+202F) pour les milliers : on la normalise pour les tests.
const n = (s: string) => s.replace(/[  ]/g, ' ')

describe('formaterMontant', () => {
  it('formate à la française, avec le symbole après', () => {
    expect(n(formaterMontant(123456, 'CAD'))).toBe('1 234,56 $')
    expect(n(formaterMontant(123456, 'EUR'))).toBe('1 234,56 €')
    expect(n(formaterMontant(5, 'EUR'))).toBe('0,05 €')
    expect(n(formaterMontant(0, 'CAD'))).toBe('0,00 $')
  })
  it('gère les négatifs et le signe +', () => {
    expect(n(formaterMontant(-1200, 'CAD'))).toBe('−12,00 $')
    expect(n(formaterMontant(1200, 'CAD', { signe: true }))).toBe('+12,00 $')
  })
  it('peut arrondir à l’unité', () => {
    expect(n(formaterMontant(4550, 'CAD', { sansDecimales: true }))).toBe('46 $')
  })
  it('refuse un montant non entier', () => {
    expect(() => formaterMontant(12.5, 'CAD')).toThrow()
  })
})

describe('analyserMontant', () => {
  it('lit virgule ou point', () => {
    expect(analyserMontant('12,5')).toBe(1250)
    expect(analyserMontant('12.50')).toBe(1250)
    expect(analyserMontant('1 234,56')).toBe(123456)
    expect(analyserMontant('7')).toBe(700)
    expect(analyserMontant('0,1')).toBe(10)
  })
  it('évite les erreurs de virgule flottante', () => {
    expect(analyserMontant('0,29')).toBe(29)
    expect(analyserMontant('1,15')).toBe(115)
  })
  it('refuse les saisies invalides', () => {
    expect(analyserMontant('')).toBeNull()
    expect(analyserMontant('12,345')).toBeNull()
    expect(analyserMontant('-3')).toBeNull()
    expect(analyserMontant('abc')).toBeNull()
  })
})
