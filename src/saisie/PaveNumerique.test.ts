import { describe, expect, it } from 'vitest'
import { appliquerTouche } from './PaveNumerique'

const taper = (touches: string) => [...touches].reduce(appliquerTouche, '')

describe('pavé numérique', () => {
  it('compose un montant', () => {
    expect(taper('1250')).toBe('1250')
    expect(taper('12,5')).toBe('12,5')
    expect(taper(',5')).toBe('0,5')
  })
  it('limite à 2 décimales et une seule virgule', () => {
    expect(taper('12,345')).toBe('12,34')
    expect(taper('12,,3')).toBe('12,3')
  })
  it('évite les zéros en tête', () => expect(taper('007')).toBe('7'))
  it('limite la longueur', () => expect(taper('123456789')).toBe('1234567'))
  it('efface', () => expect(appliquerTouche('12,5', '⌫')).toBe('12,'))
})
