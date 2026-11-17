import { describe, expect, it } from 'vitest'
import { chiffrer, dechiffrer, FichierInvalide, lireEnveloppe, MotDePasseIncorrect } from './sauvegarde'

const RAPIDE = 100_000 // minimum accepté, pour accélérer les tests

describe('sauvegarde chiffrée', () => {
  it('chiffre puis déchiffre avec le bon mot de passe', async () => {
    const f = await chiffrer('{"comptes":[1,2,3]}', 'mon mot de passe', RAPIDE)
    expect(f.format).toBe('budget-sauvegarde')
    expect(f.donnees).not.toContain('comptes')
    expect(await dechiffrer(lireEnveloppe(JSON.stringify(f)), 'mon mot de passe')).toBe('{"comptes":[1,2,3]}')
  })
  it('refuse un mauvais mot de passe', async () => {
    const f = await chiffrer('secret', 'bon-mot-de-passe', RAPIDE)
    await expect(dechiffrer(f, 'mauvais-mot-de-passe')).rejects.toBeInstanceOf(MotDePasseIncorrect)
  })
  it('détecte un fichier modifié', async () => {
    const f = await chiffrer('secret', 'bon-mot-de-passe', RAPIDE)
    const octets = atob(f.donnees).split('')
    octets[0] = String.fromCharCode(octets[0].charCodeAt(0) ^ 1)
    await expect(dechiffrer({ ...f, donnees: btoa(octets.join('')) }, 'bon-mot-de-passe')).rejects.toBeInstanceOf(MotDePasseIncorrect)
  })
  it('sel et vecteur aléatoires : deux sauvegardes identiques diffèrent', async () => {
    const a = await chiffrer('x', 'bon-mot-de-passe', RAPIDE)
    const b = await chiffrer('x', 'bon-mot-de-passe', RAPIDE)
    expect(a.kdf.sel).not.toBe(b.kdf.sel)
    expect(a.donnees).not.toBe(b.donnees)
  })
  it('exige 8 caractères minimum', async () => {
    await expect(chiffrer('x', 'court', RAPIDE)).rejects.toThrow()
  })
  it('refuse un fichier qui n’est pas une sauvegarde', () => {
    expect(() => lireEnveloppe('pas du json')).toThrow(FichierInvalide)
    expect(() => lireEnveloppe('{"format":"autre"}')).toThrow(FichierInvalide)
    expect(() => lireEnveloppe(JSON.stringify({ format: 'budget-sauvegarde', version: 1, kdf: { nom: 'PBKDF2', iterations: 10 }, chiffrement: { nom: 'AES-GCM' } }))).toThrow(FichierInvalide)
  })
})
