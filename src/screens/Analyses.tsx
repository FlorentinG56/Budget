import { AVenir, Ecran } from '../components/ui'
export function Analyses() {
  return (
    <Ecran titre="Analyses">
      <AVenir titre="Évolution du solde" etape={9}>Courbe jour par jour, avec la projection jusqu’à la fin du mois.</AVenir>
      <AVenir titre="Dépenses par catégorie" etape={9}>Répartition, détail par sous-catégorie et comparaison avec la période précédente.</AVenir>
    </Ecran>
  )
}
