import { useState } from 'react'
import { cloturerPeriode, validerPeriode } from '../db/actions'
import { Bouton } from '../components/formulaire'
import { IconeChevron } from '../components/Icones'
import { formaterMontant } from '../domain/argent'
import { affectationAutomatique, depensesParCategorie, joursDansPeriode, nonAffecte, type Bornes, type Previsions } from '../domain/budget'
import { aujourdhui, libelleCourt } from '../domain/dates'
import type { Devise } from '../domain/types'
import { useCategories } from '../hooks/donnees'
import { PageBilan } from './PageBilan'
import { useBudget, type EtatBudget } from '../hooks/budget'
import { useNav } from '../nav/Navigation'
import { ListeRecurrences } from '../screens/reglages/Recurrences'
import { ChampMontant, lireMontant, versTexteMontant } from './ChampMontant'
import { PagePeriode } from './PagePeriode'

const court = (d: string) => libelleCourt(d).replace(/ \d{4}$/, '')

function Barre({ valeur, couleur = 'bg-bleu' }: { valeur: number; couleur?: string }) {
  return (
    <div className="h-2 overflow-hidden rounded-full bg-bleu-pale">
      <div className={`h-full rounded-full ${couleur}`} style={{ width: `${Math.min(100, Math.max(0, valeur * 100))}%` }} />
    </div>
  )
}

export function CarteBudget({ devise }: { devise: Devise }) {
  const { etat } = useBudget()
  const nav = useNav()
  switch (etat.etat) {
    case 'chargement': return <div className="h-[180px] rounded-carte bg-white shadow-carte" />
    case 'sans_paie': return (
      <button type="button" onClick={() => nav.ouvrir(<ListeRecurrences genre="revenus" />)} className="flex items-center gap-3 rounded-carte bg-white p-4 text-left shadow-carte active:bg-fond">
        <span className="text-[26px]">📆</span>
        <span className="flex-1">
          <span className="block text-[17px] font-semibold text-encre">Budget du jour</span>
          <span className="block text-[14px] leading-snug text-encre-douce">Ajoute ton salaire dans Revenus récurrents : chaque période va d’une paie à la suivante.</span>
        </span>
        <IconeChevron taille={20} className="text-encre-pale" />
      </button>
    )
    case 'avant': return (
      <div className="rounded-carte bg-white p-4 shadow-carte">
        <p className="text-[17px] font-semibold text-encre">Budget du jour</p>
        <p className="text-[15px] text-encre-douce">La première période commencera à ta paie{etat.prochaine ? ` du ${court(etat.prochaine)}` : ''}.</p>
      </div>
    )
    case 'bilan': return <Bilan etat={etat} devise={devise} />
    case 'a_valider': return <Validation etat={etat} devise={devise} />
    case 'actif': {
      const { jour, enveloppe, bornes } = etat
      const negatif = jour.resteAujourdhui < 0
      return (
        <button type="button" onClick={() => nav.ouvrir(<PagePeriode />)} className="block w-full rounded-carte bg-white p-4 text-left shadow-carte active:bg-fond">
          <p className="flex items-center justify-between text-[14px] font-medium text-encre-douce">
            <span>Tu peux encore dépenser aujourd’hui</span><IconeChevron taille={18} className="text-encre-pale" />
          </p>
          <p className={`text-[44px] font-bold leading-tight tracking-tight ${negatif ? 'text-rouge' : 'text-bleu'}`}>{formaterMontant(jour.resteAujourdhui, devise)}</p>
          <p className="text-[14px] text-encre-douce">
            Budget du jour {formaterMontant(jour.budgetJour, devise)}{jour.depenseAujourdhui > 0 && <> · dépensé {formaterMontant(jour.depenseAujourdhui, devise)}</>}
          </p>
          {jour.budgetJoursSuivants !== undefined && <Projection jour={jour} devise={devise} />}
          <div className="mt-3 space-y-2.5">
            <div>
              <p className="mb-1 flex justify-between text-[13px] text-encre-douce">
                <span>Jour {jour.jourNumero} sur {jour.joursTotal} · {jour.joursRestants === 1 ? 'dernier jour' : `${jour.joursRestants} jours restants`}</span><span>jusqu’au {court(bornes.fin)}</span>
              </p>
              <Barre valeur={jour.jourNumero / jour.joursTotal} couleur="bg-encre-pale/60" />
            </div>
            <div>
              <p className="mb-1 flex justify-between text-[13px] text-encre-douce">
                <span>Dépensé {formaterMontant(jour.depensePeriode, devise)} sur {formaterMontant(enveloppe, devise)}</span>
                <span className={jour.restePeriode < 0 ? 'text-rouge' : ''}>reste {formaterMontant(jour.restePeriode, devise)}</span>
              </p>
              <Barre valeur={enveloppe > 0 ? jour.depensePeriode / enveloppe : 1} couleur={jour.restePeriode < 0 ? 'bg-rouge' : 'bg-bleu'} />
            </div>
          </div>
        </button>
      )
    }
  }
}

/** Budget par jour des jours suivants si l'on s'arrête là aujourd'hui (baisse à chaque dépense). */
export function Projection({ jour, devise }: { jour: { budgetJour: number; budgetJoursSuivants?: number; joursRestants: number }; devise: Devise }) {
  if (jour.budgetJoursSuivants === undefined) return null
  const ecart = jour.budgetJoursSuivants - jour.budgetJour
  const n = jour.joursRestants - 1
  // seule la flèche est colorée : vert si le montant monte, rouge s'il baisse, rien s'il ne bouge pas
  const fleche = ecart > 0 ? <span className="text-vert" aria-label="en hausse">↗</span> : ecart < 0 ? <span className="text-rouge" aria-label="en baisse">↘</span> : null
  return (
    <div className="mt-2 flex items-center justify-between gap-2 rounded-[10px] bg-fond px-3 py-2">
      <span className="text-[14px] leading-tight text-encre">
        <span className="block font-medium">{n > 1 ? `Les ${n} jours suivants` : 'Demain'}</span>
        <span className="block text-[12px] text-encre-pale">si tu t’arrêtes là aujourd’hui</span>
      </span>
      <span className="flex shrink-0 items-center gap-1.5 text-[18px] font-bold text-encre">
        {fleche}{formaterMontant(jour.budgetJoursSuivants, devise)}<span className="text-[13px] font-medium text-encre-douce">/jour</span>
      </span>
    </div>
  )
}

function LignesPrevisions({ previsions, devise }: { previsions: Previsions; devise: Devise }) {
  const [revenusOuverts, setRevenusOuverts] = useState(false)
  const [chargesOuvertes, setChargesOuvertes] = useState(true) // liste des charges visible d'emblée
  const detail = (d: Previsions['detailCharges'][number], i: number) => (
    <p key={i} className="flex justify-between pl-3 text-[13px] text-encre-pale">
      <span>{d.estime ? '' : '✓ '}{d.libelle} · {court(d.date)}{d.estime ? ' (prévu)' : ''}</span><span>{formaterMontant(d.montant, devise)}</span>
    </p>
  )
  return (
    <div className="text-[15px]">
      <button type="button" onClick={() => setRevenusOuverts(!revenusOuverts)} aria-expanded={revenusOuverts} className="flex w-full justify-between py-1 text-left">
        <span className="text-encre-douce">Revenus de la période {revenusOuverts ? '▴' : '▾'}</span><span className="font-semibold text-vert">{formaterMontant(previsions.revenus, devise, { signe: true })}</span>
      </button>
      {revenusOuverts && previsions.detailRevenus.map(detail)}
      <button type="button" onClick={() => setChargesOuvertes(!chargesOuvertes)} aria-expanded={chargesOuvertes} className="flex w-full justify-between py-1 text-left">
        <span className="text-encre-douce">Charges fixes {chargesOuvertes ? '▴' : '▾'}</span><span className="font-semibold text-encre">{formaterMontant(-previsions.charges, devise)}</span>
      </button>
      {chargesOuvertes && (previsions.detailCharges.length ? previsions.detailCharges.map(detail) : <p className="pl-3 text-[13px] text-encre-pale">Aucune charge fixe sur cette période.</p>)}
    </div>
  )
}

function Validation({ etat, devise }: { etat: Extract<EtatBudget, { etat: 'a_valider' }>; devise: Devise }) {
  const { bornes, previsions, proposition, premiere, depenseJusquIci } = etat
  const [texteEnveloppe, setTexteEnveloppe] = useState(versTexteMontant(proposition))
  const enveloppeSaisie = lireMontant(texteEnveloppe)
  const libre = nonAffecte(previsions, enveloppeSaisie ?? proposition)
  const [texteEpargne, setTexteEpargne] = useState<string | null>(null) // null : suit le non affecté
  const epargne = texteEpargne === null ? Math.max(0, libre) : lireMontant(texteEpargne) ?? NaN
  // 1re période (démarrage en cours de route) : on demande ce qu'il reste à dépenser
  const [reste, setReste] = useState(versTexteMontant(Math.max(0, proposition - depenseJusquIci)))
  const enveloppe = premiere ? (lireMontant(reste) ?? NaN) + depenseJusquIci : enveloppeSaisie ?? NaN

  const valider = () => validerPeriode({ debut: bornes.debut, fin: bornes.fin, enveloppe, epargne: premiere ? 0 : epargne, report: 0,
    demarrageLe: premiere ? aujourdhui() : undefined })

  return (
    <section className="rounded-carte bg-white p-4 shadow-carte">
      <p className="text-[13px] font-semibold uppercase tracking-wide text-bleu">{premiere ? 'Démarrage du budget' : 'Nouvelle période'}</p>
      <h3 className="text-[19px] font-bold text-encre">Du {court(bornes.debut)} au {court(bornes.fin)}</h3>

      {premiere ? (
        <>
          <p className="mt-2 text-[15px] leading-snug text-encre-douce">
            La période est déjà commencée. Combien te reste-t-il à dépenser d’ici le {court(bornes.fin)} (hors charges fixes) ?
          </p>
          <div className="mt-2"><ChampMontant valeur={reste} surChange={setReste} devise={devise} libelle="Reste à dépenser" grand /></div>
        </>
      ) : (
        <div className="mt-2 space-y-1">
          <div className="flex items-center justify-between gap-3">
            <span className="text-[16px] font-semibold text-encre">Budget de la période</span>
            <div className="w-40"><ChampMontant valeur={texteEnveloppe} surChange={setTexteEnveloppe} devise={devise} libelle="Budget de la période" /></div>
          </div>
          <p className="pb-1 text-[12px] leading-snug text-encre-pale">
            {formaterMontant(Math.round((enveloppeSaisie ?? 0) / joursDansPeriode(bornes)), devise)}/jour sur {joursDansPeriode(bornes)} jours. Modifiable pour cette période seulement (le montant habituel se règle dans Réglages).
          </p>
          <div className="rounded-[12px] bg-fond px-3 py-2">
            <LignesPrevisions previsions={previsions} devise={devise} />
            <p className="flex justify-between py-1 text-[15px]"><span className="text-encre-douce">Budget de la période</span><span className="font-semibold text-encre">{formaterMontant(-(enveloppeSaisie ?? 0), devise)}</span></p>
            <p className="flex justify-between border-t border-trait pt-1 text-[15px]">
              <span className="font-medium text-encre">Non affecté</span>
              <span className={`font-bold ${libre < 0 ? 'text-rouge' : 'text-encre'}`}>{formaterMontant(libre, devise)}</span>
            </p>
          </div>
          <p className="pt-1 text-[15px] font-medium text-encre">💰 Combien tu mets de côté (Sécurité) ?</p>
          <ChampMontant valeur={texteEpargne ?? versTexteMontant(Math.max(0, libre))} surChange={setTexteEpargne} devise={devise} libelle="Épargne mise de côté" />
          {libre < 0 && <p className="text-[12px] leading-snug text-rouge">Ta paie ne couvre pas les charges et le budget de cette période : le solde du compte baissera de {formaterMontant(-libre, devise)}.</p>}
          {previsions.detailRevenus.some((d) => d.estime) && (
            <p className="text-[12px] leading-snug text-encre-pale">Certains revenus sont estimés (montant habituel) : confirme ta paie pour un calcul exact.</p>
          )}
        </div>
      )}
      <Bouton className="mt-3" disabled={!Number.isFinite(enveloppe) || !Number.isFinite(epargne)} onClick={() => void valider()}>Valider le budget</Bouton>
    </section>
  )
}

function Bilan({ etat, devise }: { etat: Extract<EtatBudget, { etat: 'bilan' }>; devise: Devise }) {
  const nav = useNav()
  const { ctx } = useBudget()
  const categories = useCategories()
  const { periode, bilan } = etat
  const positif = bilan.ecart > 0
  const lignes = ctx ? depensesParCategorie(ctx.operations, ctx.budget, periode.dateDebut, periode.dateFin).filter((l) => l.montant > 0).slice(0, 3) : []
  const cats = new Map((categories ?? []).map((c) => [c.id, c]))
  return (
    <section className="rounded-carte bg-white p-4 shadow-carte">
      <p className="text-[13px] font-semibold uppercase tracking-wide text-bleu">Bilan de la période</p>
      <h3 className="text-[19px] font-bold text-encre">Du {court(periode.dateDebut)} au {court(periode.dateFin)}</h3>
      <div className="mt-2 space-y-1 text-[15px]">
        <p className="flex justify-between"><span className="text-encre-douce">Budget</span><span className="font-semibold">{formaterMontant(bilan.enveloppe, devise)}</span></p>
        <p className="flex justify-between"><span className="text-encre-douce">Dépensé</span><span className="font-semibold">{formaterMontant(bilan.depense, devise)}</span></p>
        <p className="flex justify-between border-t border-trait pt-1">
          <span className="font-semibold text-encre">{positif ? 'Reste → épargne' : bilan.ecart < 0 ? 'Dépassement' : 'Pile dans le budget'}</span>
          <span className={`text-[20px] font-bold ${positif ? 'text-vert' : bilan.ecart < 0 ? 'text-rouge' : 'text-encre'}`}>{formaterMontant(Math.abs(bilan.ecart), devise)}</span>
        </p>
      </div>
      {lignes.length > 0 && (
        <div className="mt-2 space-y-1">
          {lignes.map((l) => {
            const c = l.categorieId ? cats.get(l.categorieId) : undefined
            return (
              <p key={l.categorieId ?? 'aucune'} className="flex justify-between text-[14px]">
                <span className="text-encre-douce">{c ? `${c.icone} ${c.nom}` : 'Sans catégorie'}</span>
                <span className="text-encre">{formaterMontant(l.montant, devise)} · {Math.round(l.part * 100)} %</span>
              </p>
            )
          })}
        </div>
      )}
      <div className="mt-3 flex gap-2">
        <Bouton variante="secondaire" onClick={() => nav.ouvrir(<PageBilan periodeId={periode.id} />)}>Bilan complet</Bouton>
        <Bouton onClick={() => void cloturerPeriode(periode.id, affectationAutomatique(bilan.ecart), bilan.ecart)}>Continuer</Bouton>
      </div>
      {positif && <p className="mt-2 text-[12px] leading-snug text-encre-pale">Le reste sera rangé dans ton objectif « Sécurité » à l’étape 7 (épargne virtuelle). Le bilan reste consultable dans l’historique.</p>}
    </section>
  )
}

export type { Bornes }
