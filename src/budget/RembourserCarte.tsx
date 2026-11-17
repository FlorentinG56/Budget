import { useEffect, useState } from 'react'
import { rembourserCarte } from '../db/actions'
import { Feuille } from '../components/Feuille'
import { Bouton } from '../components/formulaire'
import { formaterMontant } from '../domain/argent'
import { aujourdhui } from '../domain/dates'
import type { Compte } from '../domain/types'
import { ChampMontant, lireMontant, versTexteMontant } from './ChampMontant'

/** « Rembourser la carte » : montant libre, quand on veut (par défaut : tout le montant dû). */
type Props = { ouverte: boolean; surFermer: () => void; carte: Compte; compte?: Compte; du: number }

export function RembourserCarte(props: Props) {
  // contenu recréé à chaque ouverture : le montant dû est prérempli dès l'affichage
  const [ouvertures, setOuvertures] = useState(0)
  useEffect(() => { if (props.ouverte) setOuvertures((n) => n + 1) }, [props.ouverte])
  return (
    <Feuille ouverte={props.ouverte} surFermer={props.surFermer} titre="Rembourser la carte">
      <Contenu key={ouvertures + (props.ouverte ? 1 : 0) * 1000} {...props} />
    </Feuille>
  )
}

function Contenu({ surFermer, carte, compte, du }: Props) {
  const [texte, setTexte] = useState(versTexteMontant(Math.max(0, du)))
  const [date, setDate] = useState(aujourdhui())
  const montant = lireMontant(texte)
  return (
    <>
      <p className="mb-3 text-[15px] leading-snug text-encre-douce">
        Montant dû : <b className="text-encre">{formaterMontant(du, carte.devise)}</b>. Le remboursement est retiré de {compte?.nom ?? 'ton compte'} et du montant dû. Ce n’est pas une dépense : les achats ont déjà été comptés.
      </p>
      <div className="flex flex-col gap-2">
        <ChampMontant valeur={texte} surChange={setTexte} devise={carte.devise} libelle="Montant remboursé" grand />
        <label className="flex min-h-[46px] items-center justify-between rounded-[12px] bg-white px-3 text-[16px] shadow-carte">
          <span className="text-encre-douce">Date</span>
          <input type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} className="bg-transparent text-right text-encre outline-none" />
        </label>
        {montant !== null && montant > du && du > 0 && <p className="px-1 text-[13px] text-encre-pale">C’est plus que le montant dû : la carte sera en crédit.</p>}
        <Bouton disabled={!montant} onClick={async () => { if (montant) { await rembourserCarte(carte.id, montant, date); surFermer() } }}>Rembourser</Bouton>
      </div>
    </>
  )
}
