import { describe, expect, it } from 'vitest'
import { delaiApresEchecs, hacherPin, pinTropSimple, pinValide, verifierPin } from './pin'

const RAPIDE = 1_000 // moins d'itérations pour accélérer les tests

describe('code PIN', () => {
  it('valide le format (6 chiffres)', () => {
    expect(pinValide('482915')).toBe(true)
    expect(pinValide('4829')).toBe(false)
    expect(pinValide('48291a')).toBe(false)
  })

  it('détecte les codes trop simples', () => {
    for (const p of ['000000', '111111', '123456', '654321', '345678']) expect(pinTropSimple(p)).toBe(true)
    for (const p of ['482915', '112233', '135790']) expect(pinTropSimple(p)).toBe(false)
  })

  it('ne stocke pas le code en clair et le vérifie', async () => {
    const h = await hacherPin('482915', RAPIDE)
    expect(h.hash).not.toContain('482915')
    expect(await verifierPin('482915', h)).toBe(true)
    expect(await verifierPin('482916', h)).toBe(false)
    expect(await verifierPin('', h)).toBe(false)
  })

  it('utilise un sel aléatoire : deux hachages du même code diffèrent', async () => {
    const a = await hacherPin('482915', RAPIDE)
    const b = await hacherPin('482915', RAPIDE)
    expect(a.sel).not.toBe(b.sel)
    expect(a.hash).not.toBe(b.hash)
  })

  it('est déterministe à sel égal', async () => {
    const sel = new Uint8Array(16).fill(7)
    const a = await hacherPin('482915', RAPIDE, sel)
    const b = await hacherPin('482915', RAPIDE, sel)
    expect(a.hash).toBe(b.hash)
  })

  it('refuse de hacher un code invalide', async () => {
    await expect(hacherPin('12', RAPIDE)).rejects.toThrow()
  })

  it('impose un délai croissant après 5 erreurs', () => {
    expect(delaiApresEchecs(0)).toBe(0)
    expect(delaiApresEchecs(4)).toBe(0)
    expect(delaiApresEchecs(5)).toBe(30_000)
    expect(delaiApresEchecs(6)).toBe(60_000)
    expect(delaiApresEchecs(7)).toBe(120_000)
    expect(delaiApresEchecs(50)).toBe(3_600_000)
  })
})
