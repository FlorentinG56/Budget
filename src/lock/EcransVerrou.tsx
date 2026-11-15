import { useEffect, useState } from 'react'
import { IconeCadenas } from '../components/Icones'
import { pinTropSimple } from '../security/pin'
import { PavePin } from './PavePin'
import { useVerrou, type ResultatPin } from './Verrou'

function Logo() {
  return (
    <div className="flex h-16 w-16 items-center justify-center rounded-[20px] bg-bleu text-white shadow-carte">
      <IconeCadenas taille={30} />
    </div>
  )
}

export function messageEchec(res: ResultatPin): string | null {
  if (res.ok) return null
  if (res.restantMs > 0) return 'Code incorrect.'
  const avantBlocage = 5 - res.echecs
  return avantBlocage > 0 && avantBlocage <= 2
    ? `Code incorrect. Encore ${avantBlocage} essai${avantBlocage > 1 ? 's' : ''} avant un délai d’attente.`
    : 'Code incorrect.'
}

export function EcranDeverrouillage() {
  const { deverrouiller, bloqueJusqua } = useVerrou()
  const [bloque, setBloque] = useState(0)
  useEffect(() => { void bloqueJusqua().then(setBloque) }, [bloqueJusqua])

  return (
    <PavePin
      enHaut={<Logo />}
      titre="Saisis ton code"
      bloqueJusqua={bloque}
      surCode={async (pin) => {
        const res = await deverrouiller(pin)
        if (!res.ok && res.restantMs > 0) setBloque(Date.now() + res.restantMs)
        return messageEchec(res)
      }}
    />
  )
}

/** Choix du code puis confirmation. Sert à la création et à la modification. */
export function ChoixCode({ surValide, titreInitial = 'Choisis un code à 6 chiffres', sousTitreInitial }: {
  surValide: (pin: string) => Promise<void>
  titreInitial?: string
  sousTitreInitial?: string
}) {
  const [premier, setPremier] = useState<string | null>(null)
  return (
    <PavePin
      key={premier ? 'confirmation' : 'choix'}
      enHaut={<Logo />}
      titre={premier ? 'Confirme ton code' : titreInitial}
      sousTitre={premier ? 'Saisis-le une deuxième fois.' : sousTitreInitial}
      surCode={async (pin) => {
        if (!premier) {
          if (pinTropSimple(pin)) return 'Code trop simple, choisis-en un autre.'
          setPremier(pin)
          return null
        }
        if (pin !== premier) {
          setPremier(null)
          return 'Les deux codes ne correspondent pas. Recommence.'
        }
        await surValide(pin)
        return null
      }}
    />
  )
}

export function EcranCreationCode() {
  const { creerPin } = useVerrou()
  return (
    <ChoixCode
      surValide={creerPin}
      sousTitreInitial="Il protégera l’accès à l’app. Il n’est enregistré nulle part en clair."
    />
  )
}
