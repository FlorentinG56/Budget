import { parseISO } from 'date-fns'
import { useState } from 'react'
import { Groupe } from '../../../components/formulaire'
import { IconeChevron } from '../../../components/Icones'
import { formaterMontant } from '../../../domain/argent'
import { aujourdhui, libelleCourt } from '../../../domain/dates'
import { libelleFrequence } from '../../../domain/recurrences'
import { LIBELLES_TRI, prelevesCeMois, prochaineCharge, prochaineDate, resteAPreleverCeMois, totalMensuel, trier, type Tri } from '../../../domain/charges'
import type { Devise, Recurrence, TypeRecurrence } from '../../../domain/types'
import { indexer, useCategories, useComptes, useOperations, useRecurrences } from '../../../hooks/donnees'
import { Page, useNav } from '../../../nav/Navigation'
import { EditionRecurrence } from './EditionRecurrence'
import { Filtre, lireTri } from './Filtres'
import { InfosCredit } from './InfosCredit'
import type { Genre } from './types'

/** Charges fixes et crédits (ou revenus récurrents) : par compte, triés, filtrés, avec totaux. */
export function ListeRecurrences({ genre }: { genre: Genre }) {
  const nav = useNav()
  const recurrences = useRecurrences()
  const comptes = useComptes(true)
  const operations = useOperations()
  const categories = useCategories()
  const [tri, setTri] = useState<Tri>(() => lireTri(genre))
  const [compteFiltre, setCompteFiltre] = useState('')
  const [etat, setEtat] = useState<'toutes' | 'actives' | 'pause'>('toutes')
  const [paiement, setPaiement] = useState<'' | 'compte' | 'carte'>('')
  const [categorie, setCategorie] = useState('')
  if (!recurrences || !comptes || !operations || !categories) return <Page titre="…"><div /></Page>

  const changerTri = (t: Tri) => { setTri(t); try { localStorage.setItem(`tri-${genre}`, t) } catch { /* ignoré */ } }
  const mapComptes = indexer(comptes)
  const mapCats = indexer(categories)
  const types: TypeRecurrence[] = genre === 'charges' ? ['charge_fixe', 'credit'] : ['revenu']
  const date = aujourdhui()
  const toutes = recurrences.filter((r) => types.includes(r.type) && mapComptes.has(r.compteId))
  const liste = toutes.filter((r) =>
    (!compteFiltre || r.compteId === compteFiltre) &&
    (etat === 'toutes' || (etat === 'actives' ? r.actif : !r.actif)) &&
    (!paiement || r.moyenPaiement === paiement) &&
    (!categorie || r.categorieId === categorie))
  const prochaine = prochaineCharge(liste, date)
  const titre = genre === 'charges' ? 'Charges fixes et crédits' : 'Revenus récurrents'
  const comptesAvec = comptes.filter((c) => toutes.some((r) => r.compteId === c.id))
  const categoriesUtilisees = categories.filter((c) => !c.parentId && toutes.some((r) => r.categorieId === c.id))
  const sections: [TypeRecurrence, string][] = genre === 'charges' ? [['charge_fixe', 'Charges fixes'], ['credit', 'Crédits']] : [['revenu', 'Revenus']]

  const ligne = (r: Recurrence) => {
    const compte = mapComptes.get(r.compteId)
    const p = prochaineDate(r, date)
    const cat = r.categorieId ? mapCats.get(r.categorieId) : undefined
    return (
      <button key={r.id} type="button" onClick={() => nav.ouvrir(<EditionRecurrence id={r.id} genre={genre} />)}
        className={`block w-full px-4 py-3 text-left active:bg-fond ${r.actif ? '' : 'opacity-50'}`}>
        <span className="flex items-center gap-3">
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[16px] font-medium text-encre">{cat ? `${cat.icone} ` : ''}{r.libelle}</span>
            <span className="block truncate text-[13px] text-encre-pale">
              {libelleFrequence(r)}{r.type !== 'revenu' && r.moyenPaiement === 'carte' ? ' · carte' : ''}{r.aConfirmer ? ' · à confirmer' : ''}
              {!r.actif ? ' · en pause' : p ? ` · prochain : ${libelleCourt(p)}` : ' · terminé'}
            </span>
          </span>
          <span className={`text-[16px] font-semibold ${r.type === 'revenu' ? 'text-vert' : 'text-encre'}`}>
            {compte && formaterMontant(r.type === 'revenu' ? r.montant : -r.montant, compte.devise, { signe: r.type === 'revenu' })}
          </span>
          <IconeChevron taille={18} className="text-encre-pale" />
        </span>
        {r.type === 'credit' && compte && <InfosCredit rec={r} operations={operations} devise={compte.devise} />}
      </button>
    )
  }
  const signe = genre === 'charges' ? -1 : 1

  // total général par devise (actives, après filtres)
  const totaux = new Map<Devise, number>()
  for (const c of comptes) {
    const t = totalMensuel(liste.filter((r) => r.compteId === c.id))
    if (t) totaux.set(c.devise, (totaux.get(c.devise) ?? 0) + t)
  }

  return (
    <Page titre={titre} action={
      <button type="button" onClick={() => nav.ouvrir(<EditionRecurrence genre={genre} />)} className="min-h-[44px] px-1 text-[17px] font-semibold text-bleu">Ajouter</button>
    }>
      {toutes.length === 0 ? (
        <p className="rounded-carte bg-white p-5 text-center text-[15px] leading-snug text-encre-douce shadow-carte">
          {genre === 'charges'
            ? 'Ajoute ton loyer, tes assurances, abonnements et crédits : ils seront prélevés automatiquement à leur date.'
            : 'Ajoute ton salaire et ton remboursement kilométrique : ils seront crédités automatiquement à leur date.'}
        </p>
      ) : (<>
        {prochaine && (
          <div className="flex items-center justify-between gap-3 rounded-carte bg-bleu-pale px-4 py-3 text-[15px]">
            <span className="min-w-0 text-bleu-fonce">📅 {genre === 'charges' ? 'Prochaine' : 'Prochain'} : <b>{prochaine.recurrence.libelle}</b> · {joursAvant(prochaine.date, date)}</span>
            <span className="shrink-0 font-semibold text-bleu-fonce">{formaterMontant(prochaine.recurrence.montant, mapComptes.get(prochaine.recurrence.compteId)!.devise)}</span>
          </div>
        )}

        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
          <Filtre libelle="Trier par" valeur={tri} surChange={(v) => changerTri(v as Tri)} actif={false}
            options={(Object.keys(LIBELLES_TRI) as Tri[]).map((t) => ({ valeur: t, libelle: `↕ ${LIBELLES_TRI[t]}` }))} />
          {comptesAvec.length > 1 && (
            <Filtre libelle="Compte" valeur={compteFiltre} surChange={setCompteFiltre} actif={!!compteFiltre}
              options={[{ valeur: '', libelle: 'Tous les comptes' }, ...comptesAvec.map((c) => ({ valeur: c.id, libelle: c.nom.split(' – ')[0] }))]} />
          )}
          <Filtre libelle="État" valeur={etat} surChange={(v) => setEtat(v as typeof etat)} actif={etat !== 'toutes'}
            options={[{ valeur: 'toutes', libelle: 'Actives et en pause' }, { valeur: 'actives', libelle: 'Actives' }, { valeur: 'pause', libelle: 'En pause' }]} />
          {genre === 'charges' && (
            <Filtre libelle="Paiement" valeur={paiement} surChange={(v) => setPaiement(v as typeof paiement)} actif={!!paiement}
              options={[{ valeur: '', libelle: 'Tous paiements' }, { valeur: 'compte', libelle: 'Prélevées sur le compte' }, { valeur: 'carte', libelle: 'Payées par carte' }]} />
          )}
          {categoriesUtilisees.length > 0 && (
            <Filtre libelle="Catégorie" valeur={categorie} surChange={setCategorie} actif={!!categorie}
              options={[{ valeur: '', libelle: 'Toutes catégories' }, ...categoriesUtilisees.map((c) => ({ valeur: c.id, libelle: `${c.icone} ${c.nom}` }))]} />
          )}
        </div>

        {liste.length === 0 && <p className="rounded-carte bg-white p-5 text-center text-[15px] text-encre-douce shadow-carte">Aucune {genre === 'charges' ? 'charge' : 'récurrence'} pour ces filtres.</p>}

        {comptes.map((c) => {
          const duCompte = liste.filter((r) => r.compteId === c.id)
          if (duCompte.length === 0) return null
          const total = totalMensuel(duCompte)
          return (
            <section key={c.id} className="flex flex-col gap-2" aria-label={c.nom}>
              <h2 className="flex items-center gap-2 px-1 pt-3 text-[17px] font-bold text-encre">
                <span className="h-3 w-3 rounded-full" style={{ background: c.couleur }} />{c.nom}
              </h2>
              {sections.map(([type, nomSection]) => {
                const l = trier(duCompte.filter((r) => r.type === type), tri, date, mapCats)
                if (l.length === 0) return null
                return (
                  <div key={type}>
                    {sections.length > 1 && <p className="px-1 pb-1 text-[13px] font-semibold uppercase tracking-wide text-encre-pale">{nomSection}</p>}
                    <Groupe>
                      {l.map(ligne)}
                      <div className="flex min-h-[44px] items-center justify-between bg-fond/60 px-4 py-2 text-[15px]">
                        <span className="font-semibold text-encre">Total {nomSection.toLowerCase()} / mois</span>
                        <span className="font-bold text-encre">{formaterMontant(signe * totalMensuel(l), c.devise, { signe: genre === 'revenus' })}</span>
                      </div>
                    </Groupe>
                  </div>
                )
              })}
              <div className="space-y-1 rounded-carte bg-white px-4 py-3 text-[15px] shadow-carte">
                <p className="flex justify-between"><span className="font-semibold text-encre">Total {c.nom.split(' – ')[0]} / mois</span>
                  <span className="font-bold text-encre">{formaterMontant(signe * total, c.devise, { signe: genre === 'revenus' })}</span></p>
                <p className="flex justify-between text-encre-douce"><span>{genre === 'charges' ? 'Déjà prélevé ce mois' : 'Déjà reçu ce mois'}</span>
                  <span>{formaterMontant(prelevesCeMois(duCompte, operations, date), c.devise)}</span></p>
                <p className="flex justify-between text-encre-douce"><span>{genre === 'charges' ? 'Reste à prélever ce mois' : 'Reste à recevoir ce mois'}</span>
                  <span>{formaterMontant(resteAPreleverCeMois(duCompte, operations, date), c.devise)}</span></p>
              </div>
            </section>
          )
        })}

        {totaux.size > 0 && (
          <div className="mt-2 rounded-carte bg-encre px-4 py-3 text-white shadow-carte">
            <p className="text-[13px] opacity-80">{genre === 'charges' ? 'Total des charges fixes et crédits' : 'Total des revenus récurrents'} / mois</p>
            <p className="text-[22px] font-bold">{[...totaux].map(([d, t]) => formaterMontant(t, d)).join(' + ')}</p>
            {liste.some((r) => r.frequence === '14_jours') && <p className="text-[12px] opacity-70">Versements aux 2 semaines lissés sur l’année.</p>}
          </div>
        )}
      </>)}
    </Page>
  )
}

function joursAvant(d: string, date: string) {
  const n = Math.round((parseISO(d).getTime() - parseISO(date).getTime()) / 86_400_000)
  return n === 0 ? 'aujourd’hui' : n === 1 ? 'demain' : `dans ${n} jours (${libelleCourt(d).replace(/ \d{4}$/, '')})`
}
