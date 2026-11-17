import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { demanderStockagePersistant, lireReglages, modifierReglages } from '../db/db'
import { delaiApresEchecs, hacherPin, verifierPin } from '../security/pin'
import { verifierFaceId } from '../security/faceid'
import { doitVerrouiller } from '../security/verrouillage'

type Etat = 'chargement' | 'creation' | 'verrouille' | 'deverrouille'

export type ResultatPin = { ok: true } | { ok: false; restantMs: number; echecs: number }

interface ContexteVerrou {
  etat: Etat
  delaiMinutes: number
  creerPin: (pin: string) => Promise<void>
  deverrouiller: (pin: string) => Promise<ResultatPin>
  /** Vérifie le code sans changer l'état (ex. avant de le modifier). */
  verifier: (pin: string) => Promise<ResultatPin>
  changerPin: (nouveau: string) => Promise<void>
  verrouiller: () => void
  changerDelai: (minutes: number) => Promise<void>
  bloqueJusqua: () => Promise<number>
  faceId: boolean
  deverrouillerFaceId: () => Promise<boolean>
  rafraichirFaceId: () => Promise<void>
}

const Ctx = createContext<ContexteVerrou | null>(null)

export function useVerrou() {
  const c = useContext(Ctx)
  if (!c) throw new Error('useVerrou hors de VerrouProvider')
  return c
}

export function VerrouProvider({ children }: { children: ReactNode }) {
  const [etat, setEtat] = useState<Etat>('chargement')
  const [delaiMinutes, setDelai] = useState(2)
  const masqueeDepuis = useRef<number | null>(null)
  const [faceId, setFaceId] = useState(false)
  const rafraichirFaceId = useCallback(async () => {
    const r = await lireReglages()
    setFaceId(r.faceIdActive && !!r.faceIdIdentifiant)
  }, [])

  useEffect(() => {
    lireReglages().then((r) => {
      setDelai(r.verrouillageMinutes)
      setFaceId(r.faceIdActive && !!r.faceIdIdentifiant)
      setEtat(r.pinHash ? 'verrouille' : 'creation')
    })
  }, [])

  // Verrouillage automatique après N minutes en arrière-plan.
  useEffect(() => {
    const surChangement = () => {
      if (document.visibilityState === 'hidden') {
        masqueeDepuis.current = Date.now()
      } else {
        if (doitVerrouiller(masqueeDepuis.current, Date.now(), delaiMinutes)) {
          setEtat((e) => (e === 'deverrouille' ? 'verrouille' : e))
        }
        masqueeDepuis.current = null
      }
    }
    document.addEventListener('visibilitychange', surChangement)
    return () => document.removeEventListener('visibilitychange', surChangement)
  }, [delaiMinutes])

  const controler = useCallback(async (pin: string): Promise<ResultatPin> => {
    const r = await lireReglages()
    const maintenant = Date.now()
    if (r.bloqueJusqua && r.bloqueJusqua > maintenant) return { ok: false, restantMs: r.bloqueJusqua - maintenant, echecs: r.echecsPin }
    if (!r.pinHash || !r.pinSel || !r.pinIterations) return { ok: false, restantMs: 0, echecs: 0 }
    if (await verifierPin(pin, { hash: r.pinHash, sel: r.pinSel, iterations: r.pinIterations })) {
      await modifierReglages({ echecsPin: 0, bloqueJusqua: undefined })
      return { ok: true }
    }
    const echecs = r.echecsPin + 1
    const delai = delaiApresEchecs(echecs)
    await modifierReglages({ echecsPin: echecs, bloqueJusqua: delai ? Date.now() + delai : undefined })
    return { ok: false, restantMs: delai, echecs }
  }, [])

  const enregistrerPin = useCallback(async (pin: string) => {
    const h = await hacherPin(pin)
    await modifierReglages({ pinHash: h.hash, pinSel: h.sel, pinIterations: h.iterations, echecsPin: 0, bloqueJusqua: undefined })
  }, [])

  const valeur: ContexteVerrou = {
    etat,
    delaiMinutes,
    creerPin: async (pin) => {
      await enregistrerPin(pin)
      void demanderStockagePersistant()
      setEtat('deverrouille')
    },
    deverrouiller: async (pin) => {
      const res = await controler(pin)
      if (res.ok) setEtat('deverrouille')
      return res
    },
    verifier: controler,
    changerPin: enregistrerPin,
    verrouiller: () => setEtat('verrouille'),
    changerDelai: async (minutes) => {
      await modifierReglages({ verrouillageMinutes: minutes })
      setDelai(minutes)
    },
    bloqueJusqua: async () => (await lireReglages()).bloqueJusqua ?? 0,
    faceId,
    rafraichirFaceId,
    deverrouillerFaceId: async () => {
      const r = await lireReglages()
      if (!r.faceIdActive || !r.faceIdIdentifiant) return false
      if (r.bloqueJusqua && r.bloqueJusqua > Date.now()) return false // après trop d'erreurs de code : attendre
      if (!(await verifierFaceId(r.faceIdIdentifiant))) return false
      setEtat('deverrouille')
      return true
    },
  }

  return <Ctx.Provider value={valeur}>{children}</Ctx.Provider>
}
