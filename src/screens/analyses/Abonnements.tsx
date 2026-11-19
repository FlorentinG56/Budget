import { Groupe } from '../../components/formulaire'
import { IconeChevron } from '../../components/Icones'
import { TitreSection } from '../../components/ui'
import { abonnements, categorieAbonnements, doublons, totauxAbonnements } from '../../domain/abonnements'
import { formaterMontant } from '../../domain/argent'
import { libelleFrequence } from '../../domain/recurrences'
import { indexer, useCategories, useComptes, useRecurrences } from '../../hooks/donnees'
import { Page, useNav } from '../../nav/Navigation'
import { EditionRecurrence, ListeRecurrences } from '../reglages/Recurrences'

/** Abonnements : coût mensuel et annuel de chacun, totaux par devise, alerte douce sur les doublons. */
export function PageAbonnements() {
  const nav = useNav()
  const recurrences = useRecurrences()
  const comptes = useComptes(true)
  const categories = useCategories()
  if (!recurrences || !comptes || !categories) return <Page titre="Abonnements"><div /></Page>
  const cat = categorieAbonnements(categories)
  const lignes = abonnements(recurrences, comptes, cat?.id)
  const totaux = totauxAbonnements(lignes)
  const alertes = doublons(lignes, categories)
  const sous = indexer(categories)
  const noms = indexer(comptes)
  return (
    <Page titre="Abonnements">
      {lignes.length === 0 ? (
        <>
          <p className="rounded-carte bg-white p-5 text-center text-[15px] leading-snug text-encre-douce shadow-carte">
            Aucun abonnement : ajoute tes abonnements comme charges fixes de la catégorie « {cat?.nom ?? 'Abonnements'} ».
          </p>
          <button type="button" onClick={() => nav.ouvrir(<ListeRecurrences genre="charges" />)} className="min-h-[50px] rounded-[14px] bg-white text-[16px] font-semibold text-bleu shadow-carte active:bg-bleu-pale">
            Charges fixes et crédits
          </button>
        </>
      ) : (<>
        {alertes.map((a) => (
          <p key={a.sousCategorie.id + a.devise} className="rounded-carte border border-bleu/20 bg-bleu-pale px-4 py-3 text-[15px] leading-snug text-bleu-fonce">
            💡 {a.nombre} abonnements {a.sousCategorie.nom} : <b>{formaterMontant(a.mensuel, a.devise)}/mois</b>. Tous encore utiles ?
          </p>
        ))}
        <section className="rounded-carte bg-encre px-4 py-3 text-white shadow-carte" aria-label="Total des abonnements">
          <p className="text-[13px] opacity-80">Total des abonnements actifs</p>
          {[...totaux].map(([d, t]) => (
            <p key={d} className="flex items-baseline justify-between gap-3">
              <span className="text-[22px] font-bold">{formaterMontant(t.mensuel, d)}<span className="text-[14px] font-medium opacity-80">/mois</span></span>
              <span className="text-[15px] opacity-90">{formaterMontant(t.annuel, d)}/an</span>
            </p>
          ))}
        </section>
        <TitreSection>{lignes.length} abonnement{lignes.length > 1 ? 's' : ''}</TitreSection>
        <Groupe>
          {lignes.map((l) => (
            <button key={l.recurrence.id} type="button" onClick={() => nav.ouvrir(<EditionRecurrence id={l.recurrence.id} genre="charges" />)}
              className={`flex w-full items-center gap-3 px-4 py-3 text-left active:bg-fond ${l.recurrence.actif ? '' : 'opacity-50'}`}>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[16px] font-medium text-encre">{l.recurrence.libelle}</span>
                <span className="block truncate text-[13px] text-encre-pale">
                  {[l.recurrence.sousCategorieId ? sous.get(l.recurrence.sousCategorieId)?.nom : null, libelleFrequence(l.recurrence), noms.get(l.recurrence.compteId)?.nom.split(' – ')[0], l.recurrence.actif ? null : 'en pause'].filter(Boolean).join(' · ')}
                </span>
              </span>
              <span className="text-right">
                <span className="block text-[16px] font-semibold text-encre">{formaterMontant(l.mensuel, l.devise)}<span className="text-[12px] font-normal text-encre-pale">/mois</span></span>
                <span className="block text-[12px] text-encre-pale">{formaterMontant(l.annuel, l.devise)}/an</span>
              </span>
              <IconeChevron taille={18} className="text-encre-pale" />
            </button>
          ))}
        </Groupe>
        <p className="px-1 text-[13px] leading-snug text-encre-pale">Charges fixes de la catégorie « {cat?.nom} ». Les abonnements en pause ne comptent pas dans les totaux.</p>
      </>)}
    </Page>
  )
}
