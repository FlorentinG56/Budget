import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useState } from 'react'
import { enregistrerVoyage, supprimerVoyage } from '../../db/actions'
import { db } from '../../db/db'
import { Bouton, Champ, Choix, Groupe, Saisie } from '../../components/formulaire'
import { IconeChevron } from '../../components/Icones'
import { LigneOperation } from '../../components/LigneOperation'
import { TitreSection } from '../../components/ui'
import { analyserMontant, formaterMontant } from '../../domain/argent'
import { joursDansPeriode } from '../../domain/budget'
import { aujourdhui, libelleCourt } from '../../domain/dates'
import type { Compte, Devise, Voyage } from '../../domain/types'
import { bilanVoyage, compteParDefaut, depensesVoyage, jourDeVoyage, statutVoyage } from '../../domain/voyage'
import { indexer, useCategories, useComptes, useOperations, useVoyages } from '../../hooks/donnees'
import { Page, useNav } from '../../nav/Navigation'
import { EditionOperation } from '../operations/EditionOperation'

const court = (d: string) => libelleCourt(d).replace(/ \d{4}$/, '')
const STATUT = { a_venir: 'à venir', en_cours: 'en cours', termine: 'terminé' }

function Barre({ valeur, rouge }: { valeur: number; rouge?: boolean }) {
  return (
    <div className="h-2 overflow-hidden rounded-full bg-bleu-pale">
      <div className={`h-full rounded-full ${rouge ? 'bg-rouge' : 'bg-bleu'}`} style={{ width: `${Math.min(100, Math.max(0, valeur * 100))}%` }} />
    </div>
  )
}

/** Carte de l'accueil : pendant le voyage (budget du jour du voyage), ou juste après (lien vers le bilan). */
export function CarteVoyage({ voyage, compte }: { voyage: Voyage; compte: Compte }) {
  const nav = useNav()
  const operations = useOperations() ?? []
  const date = aujourdhui()
  if (statutVoyage(voyage, date) === 'termine') {
    const b = bilanVoyage(voyage, operations)
    return (
      <button type="button" onClick={() => nav.ouvrir(<PageVoyage id={voyage.id} />)} className="flex items-center gap-3 rounded-carte bg-white p-4 text-left shadow-carte active:bg-fond">
        <span className="text-[26px]" aria-hidden="true">✈️</span>
        <span className="flex-1">
          <span className="block text-[16px] font-semibold text-encre">Voyage « {voyage.nom} » terminé</span>
          <span className="block text-[14px] text-encre-douce">Dépensé {formaterMontant(b.depense, compte.devise)} sur {formaterMontant(b.budget, compte.devise)} · voir le bilan</span>
        </span>
        <IconeChevron taille={20} className="text-encre-pale" />
      </button>
    )
  }
  const j = jourDeVoyage(voyage, operations, date)
  return (
    <button type="button" onClick={() => nav.ouvrir(<PageVoyage id={voyage.id} />)} className="block w-full rounded-carte bg-white p-4 text-left shadow-carte active:bg-fond">
      <p className="flex items-center justify-between text-[14px] font-medium text-encre-douce">
        <span>✈️ {voyage.nom} · jour {j.jourNumero} sur {j.joursTotal}</span><IconeChevron taille={18} className="text-encre-pale" />
      </p>
      <p className={`text-[34px] font-bold leading-tight ${j.resteAujourdhui < 0 ? 'text-rouge' : 'text-bleu'}`}>{formaterMontant(j.resteAujourdhui, compte.devise)}</p>
      <p className="text-[14px] text-encre-douce">à dépenser aujourd’hui · budget du jour {formaterMontant(j.budgetJour, compte.devise)}</p>
      <div className="mt-2">
        <p className="mb-1 flex justify-between text-[13px] text-encre-douce">
          <span>Dépensé {formaterMontant(j.depensePeriode, compte.devise)} sur {formaterMontant(voyage.budget, compte.devise)}</span>
          <span className={j.restePeriode < 0 ? 'text-rouge' : ''}>reste {formaterMontant(j.restePeriode, compte.devise)}</span>
        </p>
        <Barre valeur={voyage.budget ? j.depensePeriode / voyage.budget : 1} rouge={j.restePeriode < 0} />
      </div>
    </button>
  )
}

export function ListeVoyages() {
  const nav = useNav()
  const voyages = useVoyages()
  const comptes = useComptes(true)
  const operations = useOperations()
  if (!voyages || !comptes || !operations) return <Page titre="Voyages"><div /></Page>
  const mapComptes = indexer(comptes)
  const date = aujourdhui()
  const liste = [...voyages].sort((a, b) => b.debut.localeCompare(a.debut))
  return (
    <Page titre="Voyages" action={
      <button type="button" onClick={() => nav.ouvrir(<EditionVoyage />)} className="min-h-[44px] px-1 text-[17px] font-semibold text-bleu">Ajouter</button>
    }>
      <p className="px-1 text-[15px] leading-snug text-encre-douce">
        Un budget total pour un voyage, sur le compte que tu utilises sur place. Pendant le voyage, l’accueil affiche ce que tu peux dépenser chaque jour. Ton budget du jour habituel ne change pas.
      </p>
      {liste.length === 0 ? <p className="rounded-carte bg-white p-5 text-center text-[15px] text-encre-douce shadow-carte">Aucun voyage pour l’instant.</p> : (
        <Groupe>
          {liste.map((v) => {
            const c = mapComptes.get(v.compteId)
            const b = bilanVoyage(v, operations)
            const statut = statutVoyage(v, date)
            return (
              <button key={v.id} type="button" onClick={() => nav.ouvrir(<PageVoyage id={v.id} />)} className="block w-full px-4 py-3 text-left active:bg-fond">
                <span className="flex items-center gap-3">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[16px] font-medium text-encre">✈️ {v.nom}</span>
                    <span className="block truncate text-[13px] text-encre-pale">{court(v.debut)} – {court(v.fin)} · {STATUT[statut]} · {c?.nom}</span>
                  </span>
                  <span className="text-right">
                    <span className="block text-[16px] font-semibold text-encre">{c && formaterMontant(b.depense, c.devise)}</span>
                    <span className="block text-[12px] text-encre-pale">sur {c && formaterMontant(v.budget, c.devise)}</span>
                  </span>
                  <IconeChevron taille={18} className="text-encre-pale" />
                </span>
              </button>
            )
          })}
        </Groupe>
      )}
    </Page>
  )
}

/** Détail d'un voyage : en cours (budget du jour du voyage) ou bilan (budget, dépensé, écart, catégories). */
export function PageVoyage({ id }: { id: string }) {
  const nav = useNav()
  const voyage = useLiveQuery(async () => (await db.voyages.get(id)) ?? null, [id])
  const comptes = useComptes(true)
  const operations = useOperations()
  const categories = useCategories()
  if (!voyage || !comptes || !operations || !categories) return <Page titre="Voyage"><div /></Page>
  const compte = comptes.find((c) => c.id === voyage.compteId)
  if (!compte) return <Page titre={voyage.nom}><p className="text-encre-douce">Compte introuvable.</p></Page>
  const devise: Devise = compte.devise
  const date = aujourdhui()
  const statut = statutVoyage(voyage, date)
  const b = bilanVoyage(voyage, operations)
  const cats = indexer(categories)
  const max = Math.max(1, ...b.categories.map((l) => l.montant))
  const ops = depensesVoyage(voyage, operations).sort((x, y) => y.date.localeCompare(x.date) || y.creeLe - x.creeLe)
  return (
    <Page titre={`✈️ ${voyage.nom}`} action={
      <button type="button" onClick={() => nav.ouvrir(<EditionVoyage id={voyage.id} />)} className="min-h-[44px] px-1 text-[17px] font-semibold text-bleu">Modifier</button>
    }>
      <p className="px-1 text-[15px] text-encre-douce">{court(voyage.debut)} – {court(voyage.fin)} · {b.jours} jours · {compte.nom} · {STATUT[statut]}</p>
      <section className="rounded-carte bg-white p-4 shadow-carte" aria-label={statut === 'termine' ? 'Bilan du voyage' : 'Budget du voyage'}>
        <p className="text-[13px] font-semibold uppercase tracking-wide text-bleu">{statut === 'termine' ? 'Bilan' : 'Budget'}</p>
        <div className="mt-1 space-y-1 text-[15px]">
          <p className="flex justify-between"><span className="text-encre-douce">Budget</span><span className="font-semibold">{formaterMontant(b.budget, devise)}</span></p>
          <p className="flex justify-between"><span className="text-encre-douce">Dépensé</span><span className="font-semibold">{formaterMontant(b.depense, devise)}</span></p>
          <p className="flex justify-between border-t border-trait pt-1">
            <span className="font-semibold">{b.ecart >= 0 ? (statut === 'termine' ? 'Sous le budget' : 'Reste') : 'Dépassement'}</span>
            <span className={`text-[18px] font-bold ${b.ecart >= 0 ? 'text-vert-fonce' : 'text-rouge-fonce'}`}>{formaterMontant(Math.abs(b.ecart), devise)}</span>
          </p>
          <p className="flex justify-between"><span className="text-encre-douce">Moyenne par jour</span><span>{formaterMontant(b.parJour, devise)} <span className="text-encre-pale">(prévu {formaterMontant(Math.round(b.budget / b.jours), devise)})</span></span></p>
        </div>
        {statut === 'en_cours' && (() => {
          const j = jourDeVoyage(voyage, operations, date)
          return <p className="mt-2 rounded-[10px] bg-bleu-pale px-3 py-2 text-[14px] text-bleu-fonce">Aujourd’hui : <b>{formaterMontant(j.resteAujourdhui, devise)}</b> à dépenser (budget du jour {formaterMontant(j.budgetJour, devise)}, {j.joursRestants} jour{j.joursRestants > 1 ? 's' : ''} restant{j.joursRestants > 1 ? 's' : ''})</p>
        })()}
      </section>

      <TitreSection>Par catégorie</TitreSection>
      {b.categories.length === 0 ? <p className="px-1 text-[15px] text-encre-douce">Aucune dépense sur {compte.nom} pendant ces dates.</p> : (
        <Groupe>
          {b.categories.map((l) => {
            const c = l.categorieId ? cats.get(l.categorieId) : undefined
            return (
              <div key={l.categorieId ?? 'aucune'} className="px-4 py-2.5">
                <p className="flex justify-between text-[15px]"><span className="text-encre">{c ? `${c.icone} ${c.nom}` : 'Sans catégorie'}</span>
                  <span className="font-semibold">{formaterMontant(l.montant, devise)} <span className="font-normal text-encre-pale">· {Math.round(l.part * 100)} %</span></span></p>
                <span className="mt-1.5 block h-2 rounded-full bg-fond"><span className="block h-full rounded-[4px] bg-bleu" style={{ width: `${(l.montant / max) * 100}%` }} /></span>
              </div>
            )
          })}
        </Groupe>
      )}
      {ops.length > 0 && (<>
        <TitreSection>Dépenses</TitreSection>
        <div className="divide-y divide-trait overflow-hidden rounded-carte bg-white shadow-carte">
          {ops.map((o) => <LigneOperation key={o.id} op={o} comptes={indexer(comptes)} categories={cats} masquerCompte surClic={() => nav.ouvrir(<EditionOperation id={o.id} />)} />)}
        </div>
      </>)}
      <p className="px-1 text-[13px] leading-snug text-encre-pale">Toutes les dépenses saisies sur {compte.nom} entre ces dates sont rattachées au voyage, avec leurs catégories habituelles.</p>
    </Page>
  )
}

export function EditionVoyage({ id }: { id?: string }) {
  const nav = useNav()
  const existant = useLiveQuery(async () => (id ? (await db.voyages.get(id)) ?? null : null), [id])
  const comptes = useComptes()
  const voyages = useVoyages()
  const [nom, setNom] = useState('')
  const [compteId, setCompteId] = useState('')
  const [debut, setDebut] = useState(aujourdhui())
  const [fin, setFin] = useState('')
  const [budget, setBudget] = useState('')
  const [confirmer, setConfirmer] = useState(false)
  useEffect(() => {
    if (!existant) return
    setNom(existant.nom); setCompteId(existant.compteId); setDebut(existant.debut); setFin(existant.fin); setBudget((existant.budget / 100).toFixed(2).replace('.', ','))
  }, [existant?.id]) // eslint-disable-line react-hooks/exhaustive-deps
  if ((id && existant === undefined) || !comptes || !voyages) return <Page titre="Voyage"><div /></Page>
  const possibles = comptes.filter((c) => c.type !== 'carte_credit')
  const compte = compteId || compteParDefaut(voyages, comptes) || ''
  const devise = comptes.find((c) => c.id === compte)?.devise ?? 'CAD'
  const valeur = analyserMontant(budget)
  const valide = nom.trim() !== '' && !!compte && !!valeur && fin !== '' && fin >= debut
  const jours = fin && fin >= debut ? joursDansPeriode({ debut, fin }) : 0
  return (
    <Page titre={existant ? existant.nom : 'Nouveau voyage'} action={
      <button type="button" disabled={!valide} onClick={async () => { await enregistrerVoyage({ id: existant?.id, nom: nom.trim(), compteId: compte, debut, fin, budget: valeur! }); nav.retour() }}
        className="min-h-[44px] px-1 text-[17px] font-semibold text-bleu disabled:opacity-40">Enregistrer</button>
    }>
      <Groupe>
        <Champ libelle="Nom"><Saisie value={nom} onChange={(e) => setNom(e.target.value)} placeholder="Ex. Japon" /></Champ>
        <Champ libelle="Compte utilisé" aide="Ses dépenses pendant le voyage y sont rattachées">
          <Choix value={compte} onChange={(e) => setCompteId(e.target.value)}>{possibles.map((c) => <option key={c.id} value={c.id}>{c.nom} ({c.devise})</option>)}</Choix>
        </Champ>
        <Champ libelle="Du"><Saisie type="date" value={debut} onChange={(e) => e.target.value && setDebut(e.target.value)} /></Champ>
        <Champ libelle="Au" aide={fin && fin < debut ? 'Avant la date de début' : undefined}><Saisie type="date" value={fin} min={debut} onChange={(e) => setFin(e.target.value)} /></Champ>
        <Champ libelle="Budget total" aide={jours && valeur ? `${formaterMontant(Math.round(valeur / jours), devise)}/jour sur ${jours} jours` : undefined}>
          <span className="flex items-center gap-1">
            <Saisie inputMode="decimal" value={budget} onChange={(e) => setBudget(e.target.value)} placeholder="0,00" aria-label="Budget total du voyage" />
            <span className="text-[17px] text-encre-douce">{devise === 'EUR' ? '€' : '$'}</span>
          </span>
        </Champ>
      </Groupe>
      {existant && (!confirmer ? <Bouton variante="danger" onClick={() => setConfirmer(true)}>Supprimer le voyage</Bouton> : (
        <>
          <p className="px-1 text-[14px] text-encre-douce">Les dépenses restent sur le compte ; seul le suivi du voyage est supprimé.</p>
          <div className="flex gap-2">
            <Bouton variante="secondaire" onClick={() => setConfirmer(false)}>Garder</Bouton>
            <Bouton variante="danger" className="!bg-rouge !text-white" onClick={async () => { await supprimerVoyage(existant.id); nav.retour(); nav.retour() }}>Supprimer</Bouton>
          </div>
        </>
      ))}
    </Page>
  )
}
