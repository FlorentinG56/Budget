import { depuisBase64, versBase64 } from './pin'

/**
 * Sauvegarde chiffrée (cahier des charges, « Sauvegarde chiffrée ») : Web Crypto uniquement.
 * Clé dérivée du mot de passe par PBKDF2-SHA256 (sel aléatoire), chiffrement AES-GCM 256 bits
 * (l'authentification de GCM détecte un mauvais mot de passe ou un fichier modifié).
 */

export const FORMAT = 'budget-sauvegarde'
export const ITERATIONS_SAUVEGARDE = 600_000
export const LONGUEUR_MIN_MOT_DE_PASSE = 8

export interface FichierChiffre {
  format: typeof FORMAT
  version: 1
  creeLe: string // ISO, en clair pour l'affichage
  kdf: { nom: 'PBKDF2'; hash: 'SHA-256'; iterations: number; sel: string }
  chiffrement: { nom: 'AES-GCM'; iv: string }
  donnees: string // base64
}

export class MotDePasseIncorrect extends Error {
  constructor() { super('Mot de passe incorrect ou fichier endommagé') }
}
export class FichierInvalide extends Error {
  constructor(detail = '') { super(`Ce fichier n’est pas une sauvegarde de l’app Budget${detail ? ` (${detail})` : ''}`) }
}

async function cle(motDePasse: string, sel: Uint8Array<ArrayBuffer>, iterations: number): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(motDePasse), 'PBKDF2', false, ['deriveKey'])
  return crypto.subtle.deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt: sel, iterations }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'])
}

export async function chiffrer(texte: string, motDePasse: string, iterations = ITERATIONS_SAUVEGARDE, maintenant = new Date()): Promise<FichierChiffre> {
  if (motDePasse.length < LONGUEUR_MIN_MOT_DE_PASSE) throw new Error(`Mot de passe trop court (${LONGUEUR_MIN_MOT_DE_PASSE} caractères minimum)`)
  const sel = crypto.getRandomValues(new Uint8Array(16))
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const k = await cle(motDePasse, sel, iterations)
  const chiffre = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, k, new TextEncoder().encode(texte))
  return {
    format: FORMAT, version: 1, creeLe: maintenant.toISOString(),
    kdf: { nom: 'PBKDF2', hash: 'SHA-256', iterations, sel: versBase64(sel) },
    chiffrement: { nom: 'AES-GCM', iv: versBase64(iv) },
    donnees: versBase64(new Uint8Array(chiffre)),
  }
}

/** Lit et vérifie l'enveloppe d'un fichier (sans le déchiffrer). */
export function lireEnveloppe(contenu: string): FichierChiffre {
  let f: FichierChiffre
  try { f = JSON.parse(contenu) } catch { throw new FichierInvalide() }
  if (f?.format !== FORMAT) throw new FichierInvalide()
  if (f.version !== 1 || f.kdf?.nom !== 'PBKDF2' || f.chiffrement?.nom !== 'AES-GCM') throw new FichierInvalide('version non prise en charge')
  if (!Number.isInteger(f.kdf.iterations) || f.kdf.iterations < 100_000 || f.kdf.iterations > 10_000_000) throw new FichierInvalide('paramètres invalides')
  return f
}

export async function dechiffrer(f: FichierChiffre, motDePasse: string): Promise<string> {
  const k = await cle(motDePasse, depuisBase64(f.kdf.sel), f.kdf.iterations)
  try {
    const clair = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: depuisBase64(f.chiffrement.iv) }, k, depuisBase64(f.donnees))
    return new TextDecoder().decode(clair)
  } catch {
    throw new MotDePasseIncorrect()
  }
}
