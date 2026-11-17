import { modifierReglages } from '../../db/db'
import { Bouton, Champ, Choix, Groupe } from '../../components/formulaire'
import { libelleCourt } from '../../domain/dates'
import { libelleFrequence } from '../../domain/recurrences'
import { useBudget } from '../../hooks/budget'
import { useReglages } from '../../hooks/donnees'
import { Page, useNav } from '../../nav/Navigation'
import { PagePeriode } from '../../budget/PagePeriode'
import { ListeRecurrences } from './Recurrences'

export function PeriodeBudget() {
  const nav = useNav()
  const { ctx, etat } = useBudget()
  const reglages = useReglages()
  if (!ctx || !reglages) return <Page titre="Période du budget"><div /></Page>
  const revenus = ctx.recurrences.filter((r) => r.type === 'revenu' && r.actif && ctx.budget.has(r.compteId))

  return (
    <Page titre="Période du budget">
      <p className="px-1 text-[15px] leading-snug text-encre-douce">
        Chaque période va d’une paie à la veille de la suivante. Sa durée suit la fréquence de ta paie : toutes les 2 semaines aujourd’hui,
        il suffira de passer ton salaire en mensuel pour avoir des périodes mensuelles.
      </p>
      {revenus.length === 0 ? (
        <Bouton onClick={() => nav.ouvrir(<ListeRecurrences genre="revenus" />)}>Ajouter mon salaire</Bouton>
      ) : (
        <Groupe>
          <Champ libelle="Période ouverte par" aide={ctx.paie ? libelleFrequence(ctx.paie) : undefined}>
            <Choix value={ctx.paie?.id ?? ''} onChange={(e) => void modifierReglages({ recurrencePaieId: e.target.value })}>
              {revenus.map((r) => <option key={r.id} value={r.id}>{r.libelle}</option>)}
            </Choix>
          </Champ>
        </Groupe>
      )}
      {etat.etat === 'actif' && (
        <Bouton variante="secondaire" onClick={() => nav.ouvrir(<PagePeriode />)}>
          Période en cours : {libelleCourt(etat.bornes.debut)} – {libelleCourt(etat.bornes.fin)}
        </Bouton>
      )}
      <p className="px-1 text-[13px] leading-snug text-encre-pale">
        Comptent dans le budget du jour : les dépenses sur le compte courant et sur la carte. Les charges fixes sont déjà retirées de l’enveloppe ;
        les remboursements de carte, virements et ajustements ne comptent pas.
      </p>
    </Page>
  )
}
