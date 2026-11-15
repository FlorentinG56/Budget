import { AVenir, Ecran } from '../components/ui'
export function Calendrier() {
  return (
    <Ecran titre="Calendrier">
      <AVenir titre="Vue du mois" etape={6}>Charges fixes, revenus, dépenses du jour et solde projeté, jusqu’à 12 mois à l’avance.</AVenir>
    </Ecran>
  )
}
