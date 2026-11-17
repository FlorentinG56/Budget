import { addDays, parseISO } from 'date-fns'
import { useState } from 'react'
import { modifierEnveloppe, retirerDeEnveloppe } from '../db/actions'
import { Bouton, Groupe } from '../components/formulaire'
import { TitreSection } from '../components/ui'
import { formaterMontant } from '../domain/argent'
import { budgetDuJourA, depensesBudget, periodesAVenir, previsionsPeriode, type PeriodeAVenir } from '../domain/budget'
import { libelleCourt, libelleJour, versISO } from '../domain/dates'
import type { Devise } from '../domain/types'
import { useBudget } from '../hooks/budget'
import { Page, useNav } from '../nav/Navigation'
import { HistoriquePeriodes, PageBilan } from './PageBilan'
import { ChampMontant, lireMontant, versTexteMontant } from './ChampMontant'
import { Projection } from './CarteBudget'

const court = (d: string) => libelleCourt(d).replace(/ \d{4}$/, '')

export function PagePeriode() {
  const { ctx, etat } = useBudget()
  const nav = useNav()
  const [edition, setEdition] = useState<string | null>(null)
  if (!ctx || etat.etat !== 'actif') return <Page titre="Période"><p className="text-encre-douce">Aucune période en cours.</p></Page>
  const { periode, bornes, enveloppe, jour } = etat
  const devise: Devise = ctx.comptes.find((c) => ctx.budget.has(c.id))?.devise ?? 'CAD'
  const ops = new Map(ctx.operations.map((o) => [o.id, o]))

  // jours de la période jusqu'à aujourd'hui : dépensé vs budget du jour
  const jours: string[] = []
  // 1re période démarrée en cours de route : pas de budget « rétroactif » avant le démarrage
  for (let d = periode.demarrageLe ?? bornes.debut; d <= ctx.date; d = versISO(addDays(parseISO(d), 1))) jours.push(d)
  const charges = previsionsPeriode(ctx.recurrences, ctx.operations, ctx.budget, bornes)
  const resteAPrelever = charges.detailCharges.filter((c) => c.estime).reduce((t, c) => t + c.montant, 0)
  const nouvelle = edition !== null ? lireMontant(edition, true) : null

  return (
    <Page titre={`Du ${court(bornes.debut)} au ${court(bornes.fin)}`}>
      <Groupe>
        <div className="space-y-1.5 p-4 text-[15px]">
          <p className="flex justify-between"><span className="text-encre-douce">Budget validé</span><span className="font-semibold">{formaterMontant(periode.enveloppeValidee ?? 0, devise)}</span></p>
          {periode.reportPrecedent !== 0 && <p className="flex justify-between pl-3 text-[13px] text-encre-pale"><span>dont période précédente</span><span>{formaterMontant(periode.reportPrecedent, devise, { signe: true })}</span></p>}
          {periode.ajouts.filter((a) => ops.has(a.operationId)).map((a) => (
            <p key={a.operationId} className="flex items-center justify-between">
              <span className="text-encre-douce">+ {ops.get(a.operationId)?.note || 'Revenu ajouté'}</span>
              <span className="flex items-center gap-2"><span className="font-semibold text-vert">{formaterMontant(a.montant, devise, { signe: true })}</span>
                <button type="button" onClick={() => void retirerDeEnveloppe(periode.id, a.operationId)} className="min-h-[36px] text-[13px] text-encre-pale">retirer</button></span>
            </p>
          ))}
          <p className="flex justify-between border-t border-trait pt-1.5"><span className="font-semibold">Budget total</span><span className="font-bold text-bleu">{formaterMontant(enveloppe, devise)}</span></p>
          <p className="flex justify-between"><span className="text-encre-douce">Dépensé</span><span className="font-semibold">{formaterMontant(jour.depensePeriode, devise)}</span></p>
          <p className="flex justify-between"><span className="text-encre-douce">Reste pour {jour.joursRestants} jour{jour.joursRestants > 1 ? 's' : ''}</span>
            <span className={`font-semibold ${jour.restePeriode < 0 ? 'text-rouge' : 'text-encre'}`}>{formaterMontant(jour.restePeriode, devise)}</span></p>
          <Projection jour={jour} devise={devise} />
        </div>
      </Groupe>

      {edition === null ? (
        <Bouton variante="secondaire" onClick={() => setEdition(versTexteMontant(periode.enveloppeValidee ?? 0))}>Modifier le budget de cette période</Bouton>
      ) : (
        <div className="flex gap-2">
          <div className="flex-1"><ChampMontant valeur={edition} surChange={setEdition} devise={devise} libelle="Enveloppe validée" /></div>
          <Bouton className="!w-auto" disabled={nouvelle === null} onClick={async () => { if (nouvelle !== null) { await modifierEnveloppe(periode.id, nouvelle); setEdition(null) } }}>OK</Bouton>
        </div>
      )}

      <TitreSection>Charges de la période</TitreSection>
      {charges.detailCharges.length === 0 ? <p className="px-1 text-[15px] text-encre-douce">Aucune charge fixe sur cette période.</p> : (
        <Groupe>
          {charges.detailCharges.map((c, i) => (
            <div key={i} className="flex min-h-[48px] items-center justify-between gap-3 px-4 py-2 text-[15px]">
              <span className="flex min-w-0 items-center gap-2.5">
                <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[12px] ${c.estime ? 'border-2 border-trait' : 'bg-vert text-white'}`}>{c.estime ? '' : '✓'}</span>
                <span className="min-w-0"><span className="block truncate text-encre">{c.libelle}</span>
                  <span className="block text-[12px] text-encre-pale">{court(c.date)} · {c.estime ? 'prévu' : 'prélevé'}</span></span>
              </span>
              <span className={`shrink-0 font-semibold ${c.estime ? 'text-encre-douce' : 'text-encre'}`}>{formaterMontant(-c.montant, devise)}</span>
            </div>
          ))}
          <div className="flex min-h-[46px] items-center justify-between px-4 py-2 text-[15px]">
            <span className="font-semibold text-encre">Total</span>
            <span className="text-right"><span className="block font-bold text-encre">{formaterMontant(-charges.charges, devise)}</span>
              {resteAPrelever > 0 && <span className="block text-[12px] text-encre-pale">dont {formaterMontant(resteAPrelever, devise)} encore à prélever</span>}</span>
          </div>
        </Groupe>
      )}

      {ctx.paie && <PeriodesAVenir liste={periodesAVenir(ctx.paie, ctx.recurrences, ctx.operations, ctx.budget, ctx.periodes, ctx.date, 6, ctx.budgetParPeriode)} devise={devise} />}

      <TitreSection>Jour par jour</TitreSection>
      <Groupe>
        {[...jours].reverse().map((d) => {
          const depense = depensesBudget(ctx.operations, ctx.budget, d, d)
          const budgetJ = budgetDuJourA(enveloppe, ctx.operations, ctx.budget, bornes, d)
          const ok = depense <= budgetJ
          return (
            <div key={d} className="flex min-h-[46px] items-center justify-between px-4 py-2 text-[15px]">
              <span className="text-encre">{libelleJour(d, ctx.date)}</span>
              <span className="text-right">
                <span className={`font-semibold ${d === ctx.date ? 'text-encre' : ok ? 'text-vert' : 'text-rouge'}`}>{formaterMontant(depense, devise)}</span>
                <span className="text-[13px] text-encre-pale"> / {formaterMontant(budgetJ, devise)}</span>
              </span>
            </div>
          )
        })}
      </Groupe>
      <p className="px-1 text-[13px] text-encre-pale">Dépensé ce jour-là / budget du jour. Vert : budget respecté.</p>

      <div className="flex gap-2">
        <Bouton variante="secondaire" onClick={() => nav.ouvrir(<PageBilan periodeId={periode.id} />)}>Par catégorie</Bouton>
        <Bouton variante="secondaire" onClick={() => nav.ouvrir(<HistoriquePeriodes />)}>Historique</Bouton>
      </div>
    </Page>
  )
}

/** Les prochaines périodes : revenus, charges, budget et non affecté (prévisions). */
function PeriodesAVenir({ liste, devise }: { liste: PeriodeAVenir[]; devise: Devise }) {
  const [ouverte, setOuverte] = useState<string | null>(null)
  if (liste.length === 0) return null
  return (
    <>
      <TitreSection>Périodes à venir</TitreSection>
      <Groupe>
        {liste.map((p) => {
          const deplie = ouverte === p.bornes.debut
          return (
            <div key={p.bornes.debut}>
              <button type="button" onClick={() => setOuverte(deplie ? null : p.bornes.debut)} aria-expanded={deplie}
                className="block w-full px-4 py-3 text-left active:bg-fond">
                <span className="flex items-center justify-between gap-2">
                  <span className="text-[16px] font-medium text-encre">{court(p.bornes.debut)} – {court(p.bornes.fin)} <span className="text-encre-pale">{deplie ? '▴' : '▾'}</span></span>
                  <span className="text-right">
                    <span className={`block text-[16px] font-bold ${p.nonAffecte < 0 ? 'text-rouge' : 'text-encre'}`}>{formaterMontant(p.nonAffecte, devise)}</span>
                    <span className="block text-[11px] text-encre-pale">non affecté</span>
                  </span>
                </span>
                <span className="mt-1 flex flex-wrap gap-x-3 text-[13px] text-encre-douce">
                  <span>Revenus <span className="text-vert">{formaterMontant(p.previsions.revenus, devise)}</span></span>
                  <span>Charges {formaterMontant(p.previsions.charges, devise)}</span>
                  <span>Budget {formaterMontant(p.budget, devise)}</span>
                </span>
              </button>
              {deplie && (
                <div className="space-y-0.5 border-t border-trait bg-fond/60 px-4 py-2 text-[13px]">
                  {p.previsions.detailRevenus.map((d, i) => (
                    <p key={'r' + i} className="flex justify-between"><span className="text-encre-douce">{d.libelle} · {court(d.date)}</span><span className="text-vert">{formaterMontant(d.montant, devise, { signe: true })}</span></p>
                  ))}
                  {p.previsions.detailCharges.map((d, i) => (
                    <p key={'c' + i} className="flex justify-between"><span className="text-encre-douce">{d.libelle} · {court(d.date)}</span><span className="text-encre">{formaterMontant(-d.montant, devise)}</span></p>
                  ))}
                  {p.previsions.detailCharges.length === 0 && <p className="text-encre-pale">Aucune charge fixe sur cette période.</p>}
                </div>
              )}
            </div>
          )
        })}
      </Groupe>
      <p className="px-1 text-[13px] leading-snug text-encre-pale">Prévisions avec les montants habituels. Non affecté = revenus − charges − budget : ce que tu pourras mettre de côté (en rouge si la paie ne suffit pas).</p>
    </>
  )
}
