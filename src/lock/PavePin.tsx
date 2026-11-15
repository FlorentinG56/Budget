import { useEffect, useState, type ReactNode } from 'react'
import { IconeEffacer } from '../components/Icones'
import { LONGUEUR_PIN } from '../security/pin'

interface Props {
  titre: string
  sousTitre?: ReactNode
  /** Appelé quand les 6 chiffres sont saisis. Renvoie un message d'erreur, ou null si c'est bon. */
  surCode: (pin: string) => Promise<string | null>
  /** Horodatage jusqu'auquel la saisie est bloquée (trop d'erreurs). */
  bloqueJusqua?: number
  enHaut?: ReactNode
}

const TOUCHES = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'effacer'] as const

function formaterAttente(ms: number) {
  const s = Math.ceil(ms / 1000)
  return s >= 60 ? `${Math.floor(s / 60)} min ${String(s % 60).padStart(2, '0')} s` : `${s} s`
}

export function PavePin({ titre, sousTitre, surCode, bloqueJusqua = 0, enHaut }: Props) {
  const [pin, setPin] = useState('')
  const [erreur, setErreur] = useState<string | null>(null)
  const [secoue, setSecoue] = useState(false)
  const [occupe, setOccupe] = useState(false)
  const [maintenant, setMaintenant] = useState(Date.now())

  const restant = Math.max(0, bloqueJusqua - maintenant)
  useEffect(() => {
    if (bloqueJusqua <= Date.now()) return
    const t = setInterval(() => setMaintenant(Date.now()), 500)
    return () => clearInterval(t)
  }, [bloqueJusqua])

  const appuyer = async (t: (typeof TOUCHES)[number]) => {
    if (occupe || restant > 0 || t === '') return
    if (t === 'effacer') return setPin((p) => p.slice(0, -1))
    const suivant = (pin + t).slice(0, LONGUEUR_PIN)
    setPin(suivant)
    setErreur(null)
    if (suivant.length === LONGUEUR_PIN) {
      setOccupe(true)
      const msg = await surCode(suivant)
      setOccupe(false)
      if (msg) {
        setErreur(msg)
        setSecoue(true)
        navigator.vibrate?.(80)
        setTimeout(() => { setSecoue(false); setPin('') }, 420)
      }
    }
  }

  // Clavier physique (utile en test sur ordinateur).
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (/^\d$/.test(e.key)) void appuyer(e.key as (typeof TOUCHES)[number])
      else if (e.key === 'Backspace') void appuyer('effacer')
    }
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  })

  return (
    <div className="flex min-h-full flex-col items-center justify-between px-6 pt-safe pb-safe">
      <div className="flex w-full flex-col items-center pt-[9vh]">
        {enHaut}
        <h1 className="mt-4 text-center text-[22px] font-semibold text-encre">{titre}</h1>
        <div className="mt-1.5 min-h-[40px] text-center text-[15px] leading-snug text-encre-douce">
          {restant > 0 ? (
            <span className="text-rouge">Trop d’essais. Réessaie dans {formaterAttente(restant)}.</span>
          ) : erreur ? (
            <span className="text-rouge">{erreur}</span>
          ) : (
            sousTitre
          )}
        </div>
        <div className={`mt-5 flex gap-4 ${secoue ? 'animate-secousse' : ''}`} aria-label={`${pin.length} chiffres saisis sur ${LONGUEUR_PIN}`}>
          {Array.from({ length: LONGUEUR_PIN }, (_, i) => (
            <span key={i} className={`h-3.5 w-3.5 rounded-full border-2 transition-colors ${
              i < pin.length ? 'border-bleu bg-bleu' : 'border-encre-pale/60 bg-transparent'}`} />
          ))}
        </div>
      </div>

      <div className="mb-6 grid w-full max-w-[300px] grid-cols-3 gap-x-6 gap-y-4">
        {TOUCHES.map((t, i) =>
          t === '' ? <span key={i} /> : (
            <button key={i} type="button" onClick={() => void appuyer(t)} disabled={restant > 0}
              aria-label={t === 'effacer' ? 'Effacer' : t}
              className={`mx-auto flex h-[76px] w-[76px] items-center justify-center rounded-full text-[30px] font-normal text-encre
                transition active:scale-95 disabled:opacity-40 ${t === 'effacer' ? 'active:bg-black/5' : 'bg-white shadow-carte active:bg-bleu-pale'}`}>
              {t === 'effacer' ? <IconeEffacer taille={28} className="text-encre-douce" /> : t}
            </button>
          ),
        )}
      </div>
    </div>
  )
}
