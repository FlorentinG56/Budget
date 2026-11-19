import { useEffect } from 'react'
import { modifierReglages, lireReglages } from '../../db/db'
import { Groupe } from '../../components/formulaire'
import { IconeChevron } from '../../components/Icones'
import { TitreSection } from '../../components/ui'
import { ecart } from '../../domain/analyses'
import { formaterMontant } from '../../domain/argent'
import { moisAvecRevue, nomMois, revueDuMois, type Mois } from '../../domain/revue'
import type { Devise } from '../../domain/types'
import { useContexteBudget } from '../../hooks/budget'
import { indexer, useCategories, useObjectifs } from '../../hooks/donnees'
import { Page, useNav } from '../../nav/Navigation'

function Comparaison({ montant, reference, libelle, devise }: { montant: number; reference?: number; libelle: string; devise: Devise }) {
  if (reference === undefined) return null
  const e = ecart(montant, reference)
  return (
    <p className="flex justify-between text-[14px]">
      <span className="text-encre-douce">{libelle} : {formaterMontant(reference, devise)}</span>
      <span className={e.montant > 0 ? 'text-rouge-fonce' : e.montant < 0 ? 'text-vert-fonce' : 'text-encre-pale'}>
        {e.montant === 0 ? '=' : `${formaterMontant(e.montant, devise, { signe: true })}${e.pourcent !== undefined ? ` (${e.pourcent > 0 ? '+' : '−'}${Math.abs(e.pourcent)} %)` : ''}`}
      </span>
    </p>
  )
}

/** Revue d'un mois écoulé (comptes du budget du jour). L'ouvrir la marque comme vue (fin du bandeau). */
export function PageRevue({ mois }: { mois: Mois }) {
  const ctx = useContexteBudget()
  const objectifs = useObjectifs()
  const categories = useCategories()
  useEffect(() => {
    void lireReglages().then((r) => { if (!(r.revuesVues ?? []).includes(mois)) void modifierReglages({ revuesVues: [...(r.revuesVues ?? []), mois].slice(-24) }) })
  }, [mois])
  const titre = `Revue ${nomMois(mois, true)}`
  if (!ctx || !objectifs || !categories) return <Page titre={titre}><div /></Page>
  const devise: Devise = ctx.comptes.find((c) => ctx.budget.has(c.id))?.devise ?? 'CAD'
  const r = revueDuMois(mois, { comptes: ctx.comptes, budget: ctx.budget, operations: ctx.operations, objectifs, categories, periodes: ctx.periodes, aujourdhui: ctx.date })
  const cats = indexer(categories)
  const tuile = (libelle: string, valeur: string) => (
    <div className="rounded-[12px] bg-fond px-3 py-2.5"><p className="text-[12px] text-encre-douce">{libelle}</p><p className="text-[17px] font-bold text-encre">{valeur}</p></div>
  )
  return (
    <Page titre={titre.charAt(0).toUpperCase() + titre.slice(1)}>
      <section className="rounded-carte bg-white p-4 shadow-carte" aria-label="Total dépensé">
        <p className="text-[14px] text-encre-douce">Total dépensé</p>
        <p className="text-[34px] font-bold leading-tight text-encre">{formaterMontant(r.totalDepense, devise)}</p>
        <p className="text-[13px] text-encre-pale">Dépenses du quotidien {formaterMontant(r.resume.depensesQuotidien, devise)} · charges fixes {formaterMontant(r.resume.chargesFixes, devise)}</p>
        <div className="mt-2 space-y-0.5 border-t border-trait pt-2">
          <Comparaison montant={r.totalDepense} reference={r.precedent} libelle="Mois précédent" devise={devise} />
          <Comparaison montant={r.totalDepense} reference={r.moyenne3} libelle="Moyenne des 3 mois" devise={devise} />
        </div>
      </section>
      <div className="grid grid-cols-2 gap-2 rounded-carte bg-white p-3 shadow-carte">
        {tuile('Revenus', formaterMontant(r.resume.revenus, devise))}
        {tuile('Épargne mise de côté', formaterMontant(r.resume.epargne, devise))}
        <div className="col-span-2">{tuile('Jours dans le budget du jour', r.jours.total ? `${r.jours.respectes} sur ${r.jours.total}` : '—')}</div>
      </div>

      <TitreSection>Top 3 des catégories</TitreSection>
      {r.top.length === 0 ? <p className="px-1 text-[15px] text-encre-douce">Aucune dépense.</p> : (
        <Groupe>
          {r.top.map((l, i) => {
            const c = l.id ? cats.get(l.id) : undefined
            return (
              <div key={l.id ?? 'aucune'} className="px-4 py-2.5">
                <p className="flex justify-between text-[15px]"><span className="text-encre">{i + 1}. {c ? `${c.icone} ${c.nom}` : 'Sans catégorie'}</span>
                  <span className="font-semibold">{formaterMontant(l.montant, devise)} <span className="font-normal text-encre-pale">· {Math.round(l.part * 100)} %</span></span></p>
                <Comparaison montant={l.montant} reference={l.moyenne} libelle="Moyenne des 3 mois" devise={devise} />
              </div>
            )
          })}
        </Groupe>
      )}

      {r.budgets.length > 0 && (<>
        <TitreSection>Budgets par catégorie</TitreSection>
        <Groupe>
          {r.budgets.map((b) => (
            <p key={b.categorie.id} className="flex min-h-[46px] items-center justify-between px-4 py-2 text-[15px]">
              <span className="text-encre">{b.categorie.icone} {b.categorie.nom}</span>
              <span className={b.respecte ? 'font-semibold text-vert-fonce' : 'font-semibold text-rouge-fonce'}>
                {b.respecte ? `✓ ${formaterMontant(b.depense, devise)} / ${formaterMontant(b.budget, devise)}` : `✗ dépassé de ${formaterMontant(-b.reste, devise)}`}
              </span>
            </p>
          ))}
        </Groupe>
      </>)}
      <p className="px-1 text-[13px] text-encre-pale">Comptes du budget du jour. En rouge : plus que la référence, en vert : moins.</p>
    </Page>
  )
}

/** Historique des revues de fin de mois (onglet Analyses). */
export function ListeRevues() {
  const nav = useNav()
  const ctx = useContexteBudget()
  if (!ctx) return <Page titre="Revues de fin de mois"><div /></Page>
  const mois = moisAvecRevue(ctx.operations, ctx.budget, ctx.date)
  return (
    <Page titre="Revues de fin de mois">
      {mois.length === 0 ? <p className="text-encre-douce">La première revue sera prête le 1er du mois prochain.</p> : (
        <Groupe>
          {mois.map((m) => (
            <button key={m} type="button" onClick={() => nav.ouvrir(<PageRevue mois={m} />)} className="flex min-h-[52px] w-full items-center justify-between px-4 py-2 text-left active:bg-fond">
              <span className="text-[16px] capitalize text-encre">📊 {nomMois(m, true)}</span><IconeChevron taille={18} className="text-encre-pale" />
            </button>
          ))}
        </Groupe>
      )}
    </Page>
  )
}
