import { modifierReglages } from '../../db/db'
import { useEffect, useState } from 'react'
import { Bouton, Champ, Choix, Groupe, Saisie } from '../../components/formulaire'
import { formaterMontant } from '../../domain/argent'
import { lireMontant, versTexteMontant } from '../../budget/ChampMontant'
import { HistoriquePeriodes } from '../../budget/PageBilan'
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
  const [texte, setTexte] = useState('')
  useEffect(() => { if (reglages) setTexte(versTexteMontant(reglages.budgetParPeriode)) }, [reglages?.budgetParPeriode]) // eslint-disable-line react-hooks/exhaustive-deps
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
      <Groupe>
        <Champ libelle="Budget par période" aide={lireMontant(texte) === null ? 'Montant invalide' : 'Proposé à chaque paie, modifiable pour une période'}>
          <Saisie inputMode="decimal" value={texte} onChange={(e) => setTexte(e.target.value)}
            onBlur={() => { const v = lireMontant(texte); if (v !== null && v !== reglages.budgetParPeriode) void modifierReglages({ budgetParPeriode: v }) }} />
        </Champ>
      </Groupe>
      <p className="-mt-1 px-1 text-[13px] leading-snug text-encre-pale">
        Le calendrier suppose que ce budget est entièrement dépensé à chaque période future ({formaterMontant(reglages.budgetParPeriode, 'CAD')} réparti sur les jours de la période).
        À la fin d’une période, un reste part en épargne et un dépassement est noté dans le bilan.
      </p>
      <Bouton variante="secondaire" onClick={() => nav.ouvrir(<HistoriquePeriodes />)}>Historique et bilans des périodes</Bouton>
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
