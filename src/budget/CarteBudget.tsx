import { useState } from 'react'
import { cloturerPeriode, validerPeriode } from '../db/actions'
import { Bouton } from '../components/formulaire'
import { IconeChevron } from '../components/Icones'
import { formaterMontant } from '../domain/argent'
import { enveloppeProposee, type Bornes, type Previsions } from '../domain/budget'
import { aujourdhui, libelleCourt } from '../domain/dates'
import type { Devise, Periode } from '../domain/types'
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
                <span>Jour {jour.jourNumero} sur {jour.joursTotal}</span><span>jusqu’au {court(bornes.fin)}</span>
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
  const [ouvert, setOuvert] = useState(false)
  return (
    <div className="text-[15px]">
      <button type="button" onClick={() => setOuvert(!ouvert)} className="flex w-full justify-between py-1 text-left">
        <span className="text-encre-douce">Revenus de la période {ouvert ? '▴' : '▾'}</span><span className="font-semibold text-vert">{formaterMontant(previsions.revenus, devise, { signe: true })}</span>
      </button>
      {ouvert && previsions.detailRevenus.map((d, i) => (
        <p key={i} className="flex justify-between pl-3 text-[13px] text-encre-pale"><span>{d.libelle} · {court(d.date)}{d.estime ? ' (prévu)' : ''}</span><span>{formaterMontant(d.montant, devise)}</span></p>
      ))}
      <button type="button" onClick={() => setOuvert(!ouvert)} className="flex w-full justify-between py-1 text-left">
        <span className="text-encre-douce">Charges fixes {ouvert ? '▴' : '▾'}</span><span className="font-semibold text-encre">{formaterMontant(-previsions.charges, devise)}</span>
      </button>
      {ouvert && previsions.detailCharges.map((d, i) => (
        <p key={i} className="flex justify-between pl-3 text-[13px] text-encre-pale"><span>{d.libelle} · {court(d.date)}{d.estime ? ' (prévu)' : ''}</span><span>{formaterMontant(d.montant, devise)}</span></p>
      ))}
    </div>
  )
}

function Validation({ etat, devise }: { etat: Extract<EtatBudget, { etat: 'a_valider' }>; devise: Devise }) {
  const { bornes, previsions, report, premiere, depenseJusquIci } = etat
  const [epargne, setEpargne] = useState('0,00')
  const valeurEpargne = lireMontant(epargne) ?? 0
  const calculee = enveloppeProposee(previsions, valeurEpargne, report)
  const [modifiee, setModifiee] = useState<string | null>(null)
  // 1re période (démarrage en cours de route) : on demande ce qu'il reste à dépenser
  const [reste, setReste] = useState(versTexteMontant(Math.max(0, calculee - depenseJusquIci)))
  const enveloppe = premiere ? (lireMontant(reste) ?? NaN) + depenseJusquIci : modifiee !== null ? lireMontant(modifiee, true) ?? NaN : calculee

  const valider = () => validerPeriode({ debut: bornes.debut, fin: bornes.fin, enveloppe, epargne: premiere ? 0 : valeurEpargne, report: premiere ? 0 : report,
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
          <p className="mt-1.5 text-[13px] leading-snug text-encre-pale">
            Proposition : revenus {formaterMontant(previsions.revenus, devise)} − charges {formaterMontant(previsions.charges, devise)}
            {depenseJusquIci > 0 && <> − déjà dépensé {formaterMontant(depenseJusquIci, devise)}</>}. Dès la prochaine paie, l’enveloppe sera calculée pour toi.
          </p>
        </>
      ) : (
        <div className="mt-2 space-y-1">
          <LignesPrevisions previsions={previsions} devise={devise} />
          {report !== 0 && (
            <p className="flex justify-between py-1 text-[15px]">
              <span className="text-encre-douce">{report > 0 ? 'Report de la période précédente' : 'Dépassement précédent'}</span>
              <span className={`font-semibold ${report > 0 ? 'text-vert' : 'text-rouge'}`}>{formaterMontant(report, devise, { signe: true })}</span>
            </p>
          )}
          <div className="flex items-center justify-between gap-3 py-1">
            <span className="text-[15px] font-medium text-encre">💰 Paie reçue : combien tu mets de côté ?</span>
          </div>
          <ChampMontant valeur={epargne} surChange={(v) => { setEpargne(v); setModifiee(null) }} devise={devise} libelle="Épargne mise de côté" />
          <div className="mt-2 flex items-center justify-between border-t border-trait pt-2">
            <span className="text-[16px] font-semibold text-encre">Enveloppe</span>
            {modifiee === null ? (
              <button type="button" onClick={() => setModifiee(versTexteMontant(calculee))} className="text-right">
                <span className="block text-[22px] font-bold text-bleu">{formaterMontant(calculee, devise)}</span>
                <span className="block text-[12px] text-encre-pale">toucher pour modifier</span>
              </button>
            ) : (
              <div className="w-40"><ChampMontant valeur={modifiee} surChange={setModifiee} devise={devise} libelle="Enveloppe" /></div>
            )}
          </div>
          {previsions.detailRevenus.some((d) => d.estime) && (
            <p className="text-[12px] leading-snug text-encre-pale">Certains revenus sont estimés (montant habituel) : confirme ta paie pour un calcul exact.</p>
          )}
        </div>
      )}
      <Bouton className="mt-3" disabled={!Number.isFinite(enveloppe)} onClick={() => void valider()}>Valider l’enveloppe</Bouton>
    </section>
  )
}

function Bilan({ etat, devise }: { etat: Extract<EtatBudget, { etat: 'bilan' }>; devise: Devise }) {
  const { periode, bilan } = etat
  const choisir = (a: Periode['affectationFin']) => cloturerPeriode(periode.id, a!, bilan.ecart)
  const positif = bilan.ecart >= 0
  return (
    <section className="rounded-carte bg-white p-4 shadow-carte">
      <p className="text-[13px] font-semibold uppercase tracking-wide text-bleu">Bilan de la période</p>
      <h3 className="text-[19px] font-bold text-encre">Du {court(periode.dateDebut)} au {court(periode.dateFin)}</h3>
      <div className="mt-2 space-y-1 text-[15px]">
        <p className="flex justify-between"><span className="text-encre-douce">Enveloppe</span><span className="font-semibold">{formaterMontant(bilan.enveloppe, devise)}</span></p>
        <p className="flex justify-between"><span className="text-encre-douce">Dépensé</span><span className="font-semibold">{formaterMontant(bilan.depense, devise)}</span></p>
        <p className="flex justify-between border-t border-trait pt-1"><span className="font-semibold text-encre">{positif ? 'Il te reste' : 'Dépassement'}</span>
          <span className={`text-[20px] font-bold ${positif ? 'text-vert' : 'text-rouge'}`}>{formaterMontant(Math.abs(bilan.ecart), devise)}</span></p>
      </div>
      <div className="mt-3 flex flex-col gap-2">
        {bilan.ecart > 0 && (<>
          <Bouton onClick={() => void choisir('epargne')}>Mettre de côté (épargne)</Bouton>
          <Bouton variante="secondaire" onClick={() => void choisir('report')}>Reporter sur la période suivante</Bouton>
        </>)}
        {bilan.ecart < 0 && (<>
          <Bouton onClick={() => void choisir('deficit_reporte')}>Retirer de la prochaine enveloppe</Bouton>
          <Bouton variante="secondaire" onClick={() => void choisir('aucune')}>Ne pas reporter</Bouton>
        </>)}
        {bilan.ecart === 0 && <Bouton onClick={() => void choisir('aucune')}>Pile dans le budget, continuer</Bouton>}
      </div>
      {bilan.ecart > 0 && <p className="mt-2 text-[12px] leading-snug text-encre-pale">L’épargne sera rangée dans ton objectif « Sécurité » dès l’étape 7 (épargne virtuelle).</p>}
    </section>
  )
}

export type { Bornes }
