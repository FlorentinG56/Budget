import { depuisBase64, versBase64 } from './pin'

/**
 * Face ID via WebAuthn (clé « plateforme » de l'iPhone, vérification de l'utilisateur obligatoire).
 * Sans serveur, il n'y a pas de vérification de signature : Face ID sert de raccourci pour déverrouiller l'app,
 * le code PIN reste la protection de référence.
 */

export async function faceIdDisponible(): Promise<boolean> {
  try {
    return !!window.PublicKeyCredential && await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()
  } catch {
    return false
  }
}

const aleatoire = (n: number) => crypto.getRandomValues(new Uint8Array(n))

/** Crée la clé sur cet iPhone (déclenche Face ID). Renvoie son identifiant. */
export async function activerFaceId(): Promise<string> {
  const cred = await navigator.credentials.create({
    publicKey: {
      challenge: aleatoire(32),
      rp: { name: 'Budget', id: location.hostname },
      user: { id: aleatoire(16), name: 'budget', displayName: 'Budget' },
      pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
      authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required', residentKey: 'discouraged' },
      attestation: 'none',
      timeout: 60_000,
    },
  }) as PublicKeyCredential | null
  if (!cred) throw new Error('Face ID annulé')
  return versBase64(new Uint8Array(cred.rawId))
}

/** Demande Face ID ; vrai si l'iPhone a vérifié l'utilisateur. */
export async function verifierFaceId(identifiant: string): Promise<boolean> {
  try {
    const rep = await navigator.credentials.get({
      publicKey: {
        challenge: aleatoire(32),
        rpId: location.hostname,
        allowCredentials: [{ type: 'public-key', id: depuisBase64(identifiant) }],
        userVerification: 'required',
        timeout: 60_000,
      },
    }) as PublicKeyCredential | null
    if (!rep) return false
    const donnees = new Uint8Array((rep.response as AuthenticatorAssertionResponse).authenticatorData)
    return (donnees[32] & 0x04) !== 0 // bit « utilisateur vérifié »
  } catch {
    return false
  }
}
