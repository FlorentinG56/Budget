import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { db } from '../db/db'
import { Groupe } from '../components/formulaire'
import { LigneOperation } from '../components/LigneOperation'
import { TitreSection } from '../components/ui'
import { formaterMontant } from '../domain/argent'
import { bilanPeriode, depensesParCategorie, depensesParFinancement, joursRespectes, resteACote } from '../domain/budget'
import { libelleCourt } from '../domain/dates'
import type { Devise, Periode } from '../domain/types'
import { useContexteBudget } from '../hooks/budget'
import { indexer, useCategories } from '../hooks/donnees'
import { Page, useNav } from '../nav/Navigation'
import { EditionOperation } from '../screens/operations/EditionOperation'

const court = (d: string) => libelleCourt(d).replace(/ \d{4}$/, '')

/** Bilan d'une période (en cours ou passée) : chiffres clés, catégories, comparaison avec la précédente. */
export function PageBilan({ periodeId }: { periodeId: string }) {
  const periode = useLiveQuery(async () => (await db.periodes.get(periodeId)) ?? null, [periodeId])
  const ctx = useContexteBudget()
  const categories = useCategories()
  if (!periode || !ctx || !categories) return <Page titre="Bilan"><div /></Page>
  return <ContenuBilan periode={periode} ctx={ctx} categories={categories} />
}

function ContenuBilan({ periode, ctx, categories }: { periode: Periode; ctx: NonNullable<ReturnType<typeof useContexteBudget>>; categories: NonNullable<ReturnType<typeof useCategories>> }) {
  const nav = useNav()
  const [ouverte, setOuverte] = useState<string | null | undefined>(undefined)
  const devise: Devise = ctx.comptes.find((c) => ctx.budget.has(c.id))?.devise ?? 'CAD'
  const enCours = periode.dateFin >= ctx.date
  const fin = enCours ? ctx.date : periode.dateFin
  const precedente = ctx.periodes.filter((p) => p.dateFin < periode.dateDebut).sort((a, b) => b.dateFin.localeCompare(a.dateFin))[0]
  const bilan = bilanPeriode(periode, ctx.operations, ctx.budget)
  const jours = joursRespectes(periode, ctx.operations, ctx.budget, fin)
  const lignes = depensesParCategorie(ctx.operations, ctx.budget, periode.dateDebut, fin, precedente ? { debut: precedente.dateDebut, fin: precedente.dateFin } : undefined)
  const max = Math.max(1, ...lignes.map((l) => l.montant))
  const fin2 = depensesParFinancement(ctx.operations, ctx.budget, periode.dateDebut, fin)
  const resteCote = resteACote(periode, ctx.operations, ctx.budget)
  const cats = indexer(categories)
  const mapComptes = indexer(ctx.comptes)

  return (
    <Page titre={`Bilan du ${court(periode.dateDebut)} au ${court(periode.dateFin)}`}>
      <Groupe>
        <div className="space-y-1.5 p-4 text-[15px]">
          <p className="flex justify-between"><span className="text-encre-douce">Budget</span><span className="font-semibold">{formaterMontant(bilan.enveloppe, devise)}</span></p>
          <p className="flex justify-between"><span className="text-encre-douce">Dépensé{enCours ? ' (jusqu’ici)' : ''}</span><span className="font-semibold">{formaterMontant(bilan.depense, devise)}</span></p>
          <p className="flex justify-between border-t border-trait pt-1.5">
            <span className="font-semibold">{enCours ? 'Reste' : bilan.ecart > 0 ? (periode.affectationFin === 'epargne' ? 'Reste → épargne' : 'Reste du budget') : bilan.ecart < 0 ? 'Dépassement' : 'Pile dans le budget'}</span>
            <span className={`text-[18px] font-bold ${bilan.ecart > 0 ? 'text-vert' : bilan.ecart < 0 ? 'text-rouge' : ''}`}>{formaterMontant(enCours ? bilan.ecart : Math.abs(bilan.ecart), devise)}</span>
          </p>
          <p className="flex justify-between"><span className="text-encre-douce">Jours dans le budget du jour</span><span className="font-semibold">{jours.respectes} / {jours.total}</span></p>
          {periode.epargneMiseDeCote > 0 && <p className="flex justify-between"><span className="text-encre-douce">Mis de côté à la paie</span><span className="font-semibold">{formaterMontant(periode.epargneMiseDeCote, devise)}</span></p>}
          {(periode.aCote || fin2.aCote > 0) ? (<>
            <p className="flex justify-between border-t border-trait pt-1.5"><span className="text-encre-douce">🛍️ Non affecté</span><span className="font-semibold">{formaterMontant(periode.aCote ?? 0, devise)}</span></p>
            <p className="flex justify-between"><span className="text-encre-douce">Imprévus payés avec le solde</span><span className="font-semibold">{formaterMontant(fin2.aCote, devise)}</span></p>
            <p className="flex justify-between"><span className="text-encre-douce">{resteCote >= 0 ? 'Reste du non affecté' : 'Dépassement du non affecté'}</span>
              <span className={`font-semibold ${resteCote < 0 ? 'text-rouge' : resteCote > 0 ? 'text-vert' : ''}`}>{formaterMontant(resteCote, devise)}</span></p>
          </>) : null}
          {fin2.epargne > 0 && <p className="flex justify-between"><span className="text-encre-douce">🐷 Imprévus payés avec la sécurité ou l’épargne</span><span className="font-semibold">{formaterMontant(fin2.epargne, devise)}</span></p>}
          {periode.finReste !== undefined && (<>
            <p className="flex justify-between border-t border-trait pt-1.5"><span className="font-semibold">💰 Fin de quinzaine : reste à répartir</span><span className="font-semibold">{formaterMontant(periode.finReste, devise)}</span></p>
            <p className="flex justify-between"><span className="text-encre-douce">🏦 Épargné</span><span className="font-semibold text-vert">{formaterMontant(periode.finEpargne ?? 0, devise)}</span></p>
            <p className="flex justify-between"><span className="text-encre-douce">🛟 En sécurité</span><span className="font-semibold">{formaterMontant(periode.finSecurite ?? 0, devise)}</span></p>
          </>)}
        </div>
      </Groupe>

      <TitreSection>Dépenses par catégorie</TitreSection>
      {(fin2.aCote > 0 || fin2.epargne > 0) && (
        <p className="-mt-1 px-1 text-[13px] text-encre-pale">Toutes les dépenses : budget du jour ({formaterMontant(fin2.budget, devise)}), à côté ({formaterMontant(fin2.aCote, devise)}) et payées avec l’épargne ({formaterMontant(fin2.epargne, devise)}).</p>
      )}
      {lignes.length === 0 ? <p className="px-1 text-[15px] text-encre-douce">Aucune dépense.</p> : (
        <Groupe>
          {lignes.map((l) => {
            const c = l.categorieId ? cats.get(l.categorieId) : undefined
            const ecart = l.precedent !== undefined ? l.montant - l.precedent : undefined
            const deplie = ouverte === l.categorieId
            const ops = deplie ? ctx.operations.filter((o) => o.type === 'depense' && ctx.budget.has(o.compteId) && (o.categorieId ?? null) === l.categorieId && o.date >= periode.dateDebut && o.date <= fin)
              .sort((a, b) => b.date.localeCompare(a.date)) : []
            return (
              <div key={l.categorieId ?? 'aucune'}>
                <button type="button" onClick={() => setOuverte(deplie ? undefined : l.categorieId)} className="block w-full px-4 py-3 text-left active:bg-fond">
                  <span className="flex items-center justify-between gap-2 text-[15px]">
                    <span className="truncate text-encre">{c ? `${c.icone} ${c.nom}` : 'Sans catégorie'}</span>
                    <span className="shrink-0 font-semibold text-encre">{formaterMontant(l.montant, devise)} <span className="font-normal text-encre-pale">· {Math.round(l.part * 100)} %</span></span>
                  </span>
                  <span className="mt-1.5 block h-2 overflow-hidden rounded-full bg-fond">
                    <span className="block h-full rounded-full" style={{ width: `${(l.montant / max) * 100}%`, background: c?.couleur ?? '#98A0AE' }} />
                  </span>
                  {ecart !== undefined && (
                    <span className="mt-1 block text-[12px] text-encre-pale">
                      Période précédente : {formaterMontant(l.precedent!, devise)}
                      {ecart !== 0 && <span className={ecart > 0 ? 'text-rouge' : 'text-vert'}> ({formaterMontant(ecart, devise, { signe: true })}{l.precedent ? `, ${ecart > 0 ? '+' : '−'}${Math.round(Math.abs(ecart) / l.precedent * 100)} %` : ''})</span>}
                    </span>
                  )}
                </button>
                {deplie && (
                  <div className="divide-y divide-trait border-t border-trait bg-fond/50">
                    {ops.map((o) => <LigneOperation key={o.id} op={o} comptes={mapComptes} categories={cats} surClic={() => nav.ouvrir(<EditionOperation id={o.id} />)} />)}
                  </div>
                )}
              </div>
            )
          })}
        </Groupe>
      )}
      <p className="px-1 text-[13px] text-encre-pale">Touche une catégorie pour voir ses dépenses. En rouge : plus que la période précédente.</p>
    </Page>
  )
}

/** Historique des périodes (la plus récente en premier). */
export function HistoriquePeriodes() {
  const nav = useNav()
  const ctx = useContexteBudget()
  if (!ctx) return <Page titre="Historique"><div /></Page>
  const devise: Devise = ctx.comptes.find((c) => ctx.budget.has(c.id))?.devise ?? 'CAD'
  const liste = [...ctx.periodes].sort((a, b) => b.dateDebut.localeCompare(a.dateDebut))
  return (
    <Page titre="Historique des périodes">
      {liste.length === 0 ? <p className="text-encre-douce">Aucune période pour l’instant.</p> : (
        <Groupe>
          {liste.map((p) => {
            const b = bilanPeriode(p, ctx.operations, ctx.budget)
            const enCours = p.dateFin >= ctx.date
            return (
              <button key={p.id} type="button" onClick={() => nav.ouvrir(<PageBilan periodeId={p.id} />)} className="flex min-h-[58px] w-full items-center justify-between gap-3 px-4 py-2 text-left active:bg-fond">
                <span><span className="block text-[16px] text-encre">{court(p.dateDebut)} – {court(p.dateFin)}{enCours ? ' · en cours' : ''}</span>
                  <span className="block text-[13px] text-encre-pale">{formaterMontant(b.depense, devise)} dépensés sur {formaterMontant(b.enveloppe, devise)}</span></span>
                <span className="text-right">
                  <span className={`block font-semibold ${b.ecart >= 0 ? 'text-vert' : 'text-rouge'}`}>{formaterMontant(b.ecart, devise, { signe: true })}</span>
                  <span className="block text-[12px] text-encre-pale">{enCours ? 'reste' : b.ecart > 0 ? 'épargne' : b.ecart < 0 ? 'dépassement' : ''}</span>
                </span>
              </button>
            )
          })}
        </Groupe>
      )}
    </Page>
  )
}
