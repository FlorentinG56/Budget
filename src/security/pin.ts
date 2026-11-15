/**
 * Code PIN : jamais stocké en clair. On garde seulement un hachage PBKDF2-SHA256 salé (Web Crypto, sans bibliothèque).
 * Fonctions pures (hors aléatoire du sel), testées dans pin.test.ts.
 */

export const LONGUEUR_PIN = 6
export const ITERATIONS_PIN = 210_000

export interface PinHache {
  hash: string
  sel: string
  iterations: number
}

const enc = new TextEncoder()

export function versBase64(octets: Uint8Array): string {
  let s = ''
  for (const o of octets) s += String.fromCharCode(o)
  return btoa(s)
}

export function depuisBase64(b64: string): Uint8Array<ArrayBuffer> {
  const s = atob(b64)
  const octets = new Uint8Array(s.length)
  for (let i = 0; i < s.length; i++) octets[i] = s.charCodeAt(i)
  return octets
}

export function pinValide(pin: string): boolean {
  return new RegExp(`^\\d{${LONGUEUR_PIN}}$`).test(pin)
}

/** Refuse les codes trop évidents : 000000, 123456, 654321… */
export function pinTropSimple(pin: string): boolean {
  if (/^(\d)\1+$/.test(pin)) return true
  const chiffres = [...pin].map(Number)
  const ecarts = chiffres.slice(1).map((c, i) => c - chiffres[i])
  return ecarts.every((e) => e === 1) || ecarts.every((e) => e === -1)
}

async function deriver(pin: string, sel: Uint8Array<ArrayBuffer>, iterations: number): Promise<Uint8Array> {
  const cle = await crypto.subtle.importKey('raw', enc.encode(pin), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: sel, iterations }, cle, 256)
  return new Uint8Array(bits)
}

export async function hacherPin(pin: string, iterations = ITERATIONS_PIN, sel?: Uint8Array<ArrayBuffer>): Promise<PinHache> {
  if (!pinValide(pin)) throw new Error(`Le code doit contenir ${LONGUEUR_PIN} chiffres`)
  const s = sel ?? crypto.getRandomValues(new Uint8Array(16))
  return { hash: versBase64(await deriver(pin, s, iterations)), sel: versBase64(s), iterations }
}

export async function verifierPin(pin: string, stocke: PinHache): Promise<boolean> {
  if (!pinValide(pin)) return false
  const calcule = await deriver(pin, depuisBase64(stocke.sel), stocke.iterations)
  const attendu = depuisBase64(stocke.hash)
  if (calcule.length !== attendu.length) return false
  let diff = 0 // comparaison à temps constant
  for (let i = 0; i < calcule.length; i++) diff |= calcule[i] ^ attendu[i]
  return diff === 0
}

/**
 * Délai imposé après des erreurs : 5 essais libres, puis 30 s, 1 min, 2 min… plafonné à 1 h.
 * Le compteur est enregistré dans la base : recharger l'app ne le remet pas à zéro.
 */
export function delaiApresEchecs(echecs: number): number {
  const ESSAIS_LIBRES = 5
  if (echecs < ESSAIS_LIBRES) return 0
  return Math.min(30_000 * 2 ** (echecs - ESSAIS_LIBRES), 3_600_000)
}
