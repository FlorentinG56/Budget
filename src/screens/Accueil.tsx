import { format } from 'date-fns'
import { fr } from 'date-fns/locale/fr'
import { BandeauInstallation } from '../components/BandeauInstallation'
import { AVenir, Ecran } from '../components/ui'

export function Accueil() {
  const aujourdhui = format(new Date(), 'EEEE d MMMM', { locale: fr })
  return (
    <Ecran titre="Accueil" action={<span className="inline-block pb-1.5 text-[15px] text-encre-douce first-letter:uppercase">{aujourdhui}</span>}>
      <BandeauInstallation />
      <AVenir titre="Budget du jour" etape={5}>Combien tu peux encore dépenser aujourd’hui sur Banque, et la progression de la période.</AVenir>
      <AVenir titre="Banque" etape={4}>Solde du compte chèque, montant dû sur la carte et solde après remboursement.</AVenir>
      <AVenir titre="Dernières dépenses" etape={2}>Les 5 dernières opérations saisies.</AVenir>
      <AVenir titre="Autres comptes" etape={2}>Compte en euros, Compte voyage, compte secondaire.</AVenir>
    </Ecran>
  )
}
