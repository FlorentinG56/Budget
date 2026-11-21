import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useState } from 'react'
import { ajouterMouvement, convertirObjectif, enregistrerObjectif, supprimerMouvement } from '../db/actions'
import { db } from '../db/db'
import { Feuille } from '../components/Feuille'
import { Bouton, Champ, Choix, Groupe, Interrupteur, Saisie } from '../components/formulaire'
import { IconeChevron } from '../components/Icones'
import { TitreSection } from '../components/ui'
import { ChampMontant, lireMontant, versTexteMontant } from '../budget/ChampMontant'
import { formaterMontant } from '../domain/argent'
import { aujourdhui, libelleCourt } from '../domain/dates'
import { comptesEpargne, deplacerObjectif, epargneNonRepartie, historiqueObjectif, objectifsAConvertir, ordonnerObjectifs, parMoisPourAtteindre, progressionObjectif, projetsEpargne, rythmeObjectif, soldeObjectif, totalEpargne, type Rythme } from '../domain/epargne'
import { dettes, totalDettes } from '../domain/dettes'
import { useRecurrences } from '../hooks/donnees'
import { ListeRecurrences } from './reglages/Recurrences'
import type { Devise } from '../domain/types'
import { format, parseISO } from 'date-fns'
import { fr } from 'date-fns/locale/fr'
import { soldeCompte } from '../domain/soldes'
import type { Compte, ObjectifEpargne } from '../domain/types'
import { indexer, useComptes, useObjectifs, useOperations, useReglages } from '../hooks/donnees'
import { Page, useNav } from '../nav/Navigation'
import { EditionOperation } from './operations/EditionOperation'
import { ListeComptes } from './reglages/Comptes'
import { PageSauvegarde } from './reglages/Sauvegarde'

function Barre({ valeur }: { valeur: number }) {
  return (
    <div className="h-2 overflow-hidden rounded-full bg-vert-pale">
      <div className="h-full rounded-full bg-vert" style={{ width: `${Math.min(100, valeur * 100)}%` }} />
    </div>
  )
}

/** Section « Épargne » de l'onglet Patrimoine : total réel des comptes épargne et projets. */
export function SectionEpargne() {
  const nav = useNav()
  const objectifs = useObjectifs()
  const comptes = useComptes()
  const operations = useOperations()
  const reglages = useReglages()
  const [organiser, setOrganiser] = useState(false)
  if (!objectifs || !comptes || !operations || !reglages) return null

  const date = aujourdhui()
  const mapComptes = indexer(comptes)
  const epargnes = comptesEpargne(comptes)
  const projets = ordonnerObjectifs(projetsEpargne(objectifs, comptes))
  const deplacer = async (id: string, sens: -1 | 1) => {
    const ordre = deplacerObjectif(projets, id, sens)
    await db.transaction('rw', db.objectifs, async () => { for (const [k, v] of ordre) await db.objectifs.update(k, { ordre: v }) })
  }
  // projets terminés (et anciens objectifs archivés) ; la sécurité n'est plus ici (elle est sur l'accueil)
  const termines = objectifs.filter((o) => o.archive && o.id !== reglages.objectifSecuriteId && mapComptes.has(o.compteId))
  const totaux = totalEpargne(comptes, operations, date)
  const nonReparti = epargneNonRepartie(comptes, objectifs, operations, date)

  const ligne = (o: ObjectifEpargne, i: number, liste: ObjectifEpargne[]) => {
    const compte = mapComptes.get(o.compteId)!
    const solde = soldeObjectif(o, operations)
    const prog = progressionObjectif(solde, o.montantCible)
    const rythme = rythmeObjectif(o, solde, date)
    if (organiser && !o.archive) return (
      <div key={o.id} className="flex min-h-[56px] items-center gap-2 px-4 py-2">
        <span className="min-w-0 flex-1 truncate text-[16px] font-medium text-encre">🎯 {o.nom}</span>
        <button type="button" aria-label={`Monter ${o.nom}`} disabled={i === 0} onClick={() => void deplacer(o.id, -1)}
          className="flex h-11 w-11 items-center justify-center rounded-full bg-fond text-[18px] text-bleu active:bg-bleu-pale disabled:opacity-30">↑</button>
        <button type="button" aria-label={`Descendre ${o.nom}`} disabled={i === liste.length - 1} onClick={() => void deplacer(o.id, 1)}
          className="flex h-11 w-11 items-center justify-center rounded-full bg-fond text-[18px] text-bleu active:bg-bleu-pale disabled:opacity-30">↓</button>
      </div>
    )
    return (
      <button key={o.id} type="button" onClick={() => nav.ouvrir(<PageObjectif id={o.id} />)} className="block w-full px-4 py-3 text-left active:bg-fond">
        <span className="flex items-center gap-3">
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[16px] font-medium text-encre">{o.archive ? '✅ ' : '🎯 '}{o.nom}</span>
            <span className="block truncate text-[13px] text-encre-pale">{compte.nom}{o.dateCible && !o.archive ? ` · pour le ${libelleCourt(o.dateCible)}` : ''}</span>
          </span>
          <span className="text-right">
            <span className={`block text-[17px] font-bold ${solde < 0 ? 'text-rouge' : 'text-encre'}`}>{formaterMontant(solde, compte.devise)}</span>
            {o.montantCible ? <span className="block text-[12px] text-encre-pale">sur {formaterMontant(o.montantCible, compte.devise)}</span> : null}
          </span>
          <IconeChevron taille={18} className="text-encre-pale" />
        </span>
        {prog !== undefined && <span className="mt-2 block"><Barre valeur={prog} /></span>}
        {!o.archive && <TexteRythme rythme={rythme} devise={compte.devise} />}
      </button>
    )
  }

  return (
    <>
      <ConversionEpargne />

      {epargnes.length === 0 ? (
        <button type="button" onClick={() => nav.ouvrir(<ListeComptes />)} className="flex items-center gap-3 rounded-carte border border-bleu/20 bg-bleu-pale p-4 text-left active:opacity-80">
          <span className="text-[26px]" aria-hidden="true">🏦</span>
          <span className="flex-1">
            <span className="block text-[16px] font-semibold text-bleu-fonce">Crée ton compte épargne pour commencer</span>
            <span className="block text-[14px] leading-snug text-encre-douce">Réglages → Comptes → Ajouter, type « Épargne », avec son solde réel. Tu pourras ensuite épargner à chaque fin de quinzaine et créer des projets.</span>
          </span>
          <IconeChevron taille={20} className="text-bleu" />
        </button>
      ) : (<>
        <section className="rounded-carte bg-white p-4 shadow-carte">
          <p className="text-[14px] font-medium text-encre-douce">Total épargné</p>
          <p className="text-[30px] font-bold leading-tight tracking-tight text-vert">
            {totaux.size === 0 ? formaterMontant(0, 'CAD') : [...totaux].map(([d, t]) => formaterMontant(t, d)).join(' + ')}
          </p>
          <div className="mt-1 space-y-0.5 text-[14px]">
            {epargnes.map((c) => (
              <p key={c.id} className="flex justify-between text-encre-douce"><span className="truncate">{c.nom}</span><span>{formaterMontant(soldeCompte(c, operations, date), c.devise)}</span></p>
            ))}
            {projets.length > 0 && [...nonReparti].map(([d, t]) => (
              <p key={d} className="flex justify-between border-t border-trait pt-1 font-medium text-encre"><span>Pas encore dans un projet</span>
                <span className={t < 0 ? 'text-rouge' : ''}>{formaterMontant(t, d)}</span></p>
            ))}
          </div>
          <p className="mt-1.5 text-[12px] leading-snug text-encre-pale">C’est le solde réel de ton compte épargne. Les projets répartissent ce total, virtuellement : ils ne changent aucun compte.</p>
        </section>

        <div className="flex items-end justify-between">
          <TitreSection>Projets</TitreSection>
          {projets.length > 1 && (
            <button type="button" onClick={() => setOrganiser(!organiser)} className="min-h-[40px] px-1 text-[15px] font-semibold text-bleu">{organiser ? 'Terminé' : 'Organiser'}</button>
          )}
        </div>
        {projets.length > 0 ? <Groupe>{projets.map((o, i) => ligne(o, i, projets))}</Groupe> : (
          <p className="px-1 text-[15px] leading-snug text-encre-douce">Aucun projet pour l’instant.</p>
        )}
        <button type="button" onClick={() => nav.ouvrir(<EditionObjectif />)} className="min-h-[46px] rounded-[12px] bg-white text-[16px] font-semibold text-bleu shadow-carte active:bg-fond">+ Nouveau projet</button>
      </>)}

      {termines.length > 0 && (<><TitreSection>Projets terminés</TitreSection><Groupe>{termines.map((o, i) => ligne(o, i, termines))}</Groupe></>)}
    </>
  )
}

/**
 * Conversion, une seule fois, des anciens objectifs (qui réservaient une partie du compte courant) :
 * pour chacun, « Ajouter à la sécurité » ou « Archiver ». Sauvegarde proposée avant ; rien n'est fait sans validation.
 */
export function ConversionEpargne() {
  const nav = useNav()
  const objectifs = useObjectifs()
  const comptes = useComptes()
  const operations = useOperations()
  const reglages = useReglages()
  const [choix, setChoix] = useState<Record<string, 'securite' | 'archiver'>>({})
  const [enCours, setEnCours] = useState(false)
  if (!objectifs || !comptes || !operations || !reglages) return null
  const liste = objectifsAConvertir(objectifs, comptes, reglages.objectifSecuriteId)
  if (liste.length === 0) return null
  const securite = objectifs.find((o) => o.id === reglages.objectifSecuriteId)
  const mapComptes = indexer(comptes)
  const complet = liste.every((o) => choix[o.id])
  return (
    <section className="rounded-carte border border-bleu/20 bg-bleu-pale p-4" aria-label="Mise à jour de l’épargne">
      <p className="text-[16px] font-semibold text-bleu-fonce">🔄 Mise à jour de l’épargne</p>
      <p className="mt-1 text-[14px] leading-snug text-encre-douce">
        La sécurité est maintenant sur l’accueil, et l’épargne correspond à ton vrai compte épargne. Que faire de tes anciens objectifs ?
      </p>
      <button type="button" onClick={() => nav.ouvrir(<PageSauvegarde />)} className="mt-2 min-h-[44px] w-full rounded-[12px] bg-white text-[15px] font-semibold text-bleu shadow-carte active:bg-fond">
        💾 D’abord, faire une sauvegarde
      </button>
      <p className="mt-1 text-center text-[12px] text-encre-pale">
        Dernière sauvegarde : {reglages.derniereSauvegarde ? libelleCourt(new Date(reglages.derniereSauvegarde).toISOString().slice(0, 10)) : 'jamais'}
      </p>
      <div className="mt-2 space-y-2">
        {liste.map((o) => {
          const compte = mapComptes.get(o.compteId)
          const solde = soldeObjectif(o, operations)
          const versSecurite = !!securite && securite.compteId === o.compteId
          return (
            <div key={o.id} className="rounded-[12px] bg-white p-3 shadow-carte">
              <p className="flex justify-between text-[15px]"><span className="font-medium text-encre">{o.nom}</span>
                <span className="font-semibold">{compte ? formaterMontant(solde, compte.devise) : ''}</span></p>
              <p className="text-[12px] text-encre-pale">{compte?.nom}</p>
              <div className="mt-2 flex gap-2" role="radiogroup" aria-label={`Que faire de ${o.nom}`}>
                {versSecurite && (
                  <button type="button" role="radio" aria-checked={choix[o.id] === 'securite'} onClick={() => setChoix({ ...choix, [o.id]: 'securite' })}
                    className={`min-h-[40px] flex-1 rounded-[10px] text-[14px] font-semibold ${choix[o.id] === 'securite' ? 'bg-bleu text-white' : 'bg-fond text-encre'}`}>Ajouter à la sécurité</button>
                )}
                <button type="button" role="radio" aria-checked={choix[o.id] === 'archiver'} onClick={() => setChoix({ ...choix, [o.id]: 'archiver' })}
                  className={`min-h-[40px] flex-1 rounded-[10px] text-[14px] font-semibold ${choix[o.id] === 'archiver' ? 'bg-bleu text-white' : 'bg-fond text-encre'}`}>Archiver</button>
              </div>
            </div>
          )
        })}
      </div>
      <Bouton className="mt-3" disabled={!complet || enCours} onClick={async () => {
        setEnCours(true)
        try { for (const o of liste) await convertirObjectif(o.id, choix[o.id]) } finally { setEnCours(false) }
      }}>Valider</Bouton>
      <p className="mt-1 text-[12px] leading-snug text-encre-pale">Un objectif archivé garde son historique (onglet Épargne, « Projets terminés »).</p>
    </section>
  )
}

export function PageObjectif({ id }: { id: string }) {
  const nav = useNav()
  const objectif = useLiveQuery(async () => (await db.objectifs.get(id)) ?? null, [id])
  const comptes = useComptes(true)
  const operations = useOperations()
  const reglages = useReglages()
  const [mouvement, setMouvement] = useState<null | 'mise_de_cote' | 'reprise'>(null)
  if (!objectif || !comptes || !operations || !reglages) return <Page titre="Objectif"><div /></Page>
  const compte = comptes.find((c) => c.id === objectif.compteId)
  if (!compte) return <Page titre={objectif.nom}><p className="text-encre-douce">Compte introuvable.</p></Page>
  const solde = soldeObjectif(objectif, operations)
  const prog = progressionObjectif(solde, objectif.montantCible)
  const parMois = parMoisPourAtteindre(solde, objectif.montantCible, objectif.dateCible, aujourdhui())
  const historique = historiqueObjectif(objectif, operations)
  const securite = objectif.id === reglages.objectifSecuriteId

  return (
    <Page titre={objectif.nom} action={
      <button type="button" onClick={() => nav.ouvrir(<EditionObjectif id={objectif.id} />)} className="min-h-[44px] px-1 text-[17px] font-semibold text-bleu">Modifier</button>
    }>
      <section className="rounded-carte bg-white p-4 shadow-carte">
        <p className="text-[14px] text-encre-douce">{compte.nom}</p>
        <p className={`text-[36px] font-bold leading-tight ${solde < 0 ? 'text-rouge' : 'text-vert'}`}>{formaterMontant(solde, compte.devise)}</p>
        {objectif.montantCible ? (
          <div className="mt-2 space-y-1">
            <Barre valeur={prog ?? 0} />
            <p className="flex justify-between text-[13px] text-encre-douce">
              <span>{Math.round((prog ?? 0) * 100)} % de {formaterMontant(objectif.montantCible, compte.devise)}</span>
              {objectif.dateCible && <span>pour le {libelleCourt(objectif.dateCible)}</span>}
            </p>
            {parMois && <p className="text-[13px] text-encre-douce">Il faut mettre de côté {formaterMontant(parMois, compte.devise)} par mois pour y arriver.</p>}
            <TexteRythme rythme={rythmeObjectif(objectif, solde, aujourdhui())} devise={compte.devise} />
          </div>
        ) : null}
        <div className="mt-3 flex gap-2">
          <Bouton disabled={objectif.archive} onClick={() => setMouvement('mise_de_cote')}>{securite ? 'Ajouter' : 'Mettre de côté'}</Bouton>
          <Bouton variante="secondaire" disabled={objectif.archive} onClick={() => setMouvement('reprise')}>{securite ? 'Retirer' : 'Reprendre'}</Bouton>
        </div>
      </section>
      {!securite && (
        <p className="px-1 text-[13px] leading-snug text-encre-pale">Projet virtuel : il répartit le total de ton compte épargne, aucun compte ne bouge quand tu y mets ou reprends de l’argent.</p>
      )}
      {securite && (
        <p className="px-1 text-[13px] leading-snug text-encre-pale">
          Argent laissé sur {compte.nom} pour les imprévus. Il augmente à chaque fin de quinzaine (ce que tu n’épargnes pas) ou quand tu l’ajoutes à la main. Pour un imprévu, saisis la dépense puis choisis « Payé avec la sécurité » : elle est retirée d’ici sans toucher ton budget du jour.
        </p>
      )}

      <TitreSection>Historique</TitreSection>
      {historique.length === 0 ? <p className="px-1 text-[15px] text-encre-douce">Aucun mouvement.</p> : (
        <Groupe>
          {historique.map((l) => (
            <div key={(l.mouvementId ?? l.operationId)!} className="flex min-h-[52px] items-center justify-between gap-3 px-4 py-2">
              <button type="button" disabled={!l.operationId} onClick={() => l.operationId && nav.ouvrir(<EditionOperation id={l.operationId} />)} className="min-w-0 flex-1 text-left">
                <span className="block truncate text-[15px] text-encre">{l.libelle}</span>
                <span className="block text-[12px] text-encre-pale">{libelleCourt(l.date)}{l.operationId ? ' · dépense' : ''}</span>
              </button>
              <span className={`shrink-0 text-[15px] font-semibold ${l.montant >= 0 ? 'text-vert' : 'text-encre'}`}>{formaterMontant(l.montant, compte.devise, { signe: true })}</span>
              {l.mouvementId && !objectif.mouvements.find((m) => m.id === l.mouvementId)?.source && (
                <button type="button" aria-label="Supprimer ce mouvement" onClick={() => void supprimerMouvement(objectif.id, l.mouvementId!)} className="h-9 w-9 shrink-0 rounded-full text-[18px] text-encre-pale active:bg-fond">×</button>
              )}
            </div>
          ))}
        </Groupe>
      )}

      <Mouvement sens={mouvement} surFermer={() => setMouvement(null)} objectif={objectif} compte={compte} solde={solde} />
    </Page>
  )
}

export function Mouvement({ sens, surFermer, objectif, compte, solde }: { sens: null | 'mise_de_cote' | 'reprise'; surFermer: () => void; objectif: ObjectifEpargne; compte: Compte; solde: number }) {
  const [texte, setTexte] = useState('')
  const [note, setNote] = useState('')
  const [date, setDate] = useState(aujourdhui())
  useEffect(() => { if (sens) { setTexte(''); setNote(''); setDate(aujourdhui()) } }, [sens])
  const montant = lireMontant(texte)
  return (
    <Feuille ouverte={sens !== null} surFermer={surFermer} titre={`${objectif.nom} : ${sens === 'reprise' ? 'retirer' : 'ajouter'}`}>
      <p className="mb-3 text-[15px] leading-snug text-encre-douce">
        {sens === 'reprise'
          ? `L’argent redevient disponible sur ${compte.nom}. Disponible dans « ${objectif.nom} » : ${formaterMontant(solde, compte.devise)}.`
          : compte.type === 'epargne' ? `Attribue une partie de ton épargne à « ${objectif.nom} ». C’est virtuel : aucun compte ne bouge.`
          : `Réserve une partie du solde de ${compte.nom}. L’argent reste sur le compte.`}
      </p>
      <div className="flex flex-col gap-2">
        <ChampMontant valeur={texte} surChange={setTexte} devise={compte.devise} libelle="Montant" grand />
        <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note (facultatif)"
          className="min-h-[46px] rounded-[12px] bg-white px-3 text-[16px] shadow-carte outline-none placeholder:text-encre-pale" />
        <label className="flex min-h-[46px] items-center justify-between rounded-[12px] bg-white px-3 text-[16px] shadow-carte">
          <span className="text-encre-douce">Date</span>
          <input type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} className="bg-transparent text-right text-encre outline-none" />
        </label>
        {sens === 'reprise' && montant !== null && montant > solde && <p className="px-1 text-[13px] text-rouge">C’est plus que le montant de « {objectif.nom} ».</p>}
        <Bouton disabled={!montant} onClick={async () => {
          if (!montant || !sens) return
          await ajouterMouvement(objectif.id, { date, montant, sens, note: note.trim() || undefined })
          surFermer()
        }}>{sens === 'reprise' ? 'Retirer' : 'Ajouter'}</Bouton>
      </div>
    </Feuille>
  )
}

export function EditionObjectif({ id }: { id?: string }) {
  const nav = useNav()
  const existant = useLiveQuery(async () => (id ? (await db.objectifs.get(id)) ?? null : null), [id])
  const comptes = useComptes()
  const operations = useOperations()
  const reglages = useReglages()
  const [nom, setNom] = useState('')
  const [compteId, setCompteId] = useState('')
  const [cible, setCible] = useState('')
  const [avecDate, setAvecDate] = useState(false)
  const [dateCible, setDateCible] = useState('')
  useEffect(() => {
    if (!existant) return
    setNom(existant.nom); setCompteId(existant.compteId); setCible(existant.montantCible ? versTexteMontant(existant.montantCible) : '')
    setAvecDate(!!existant.dateCible); setDateCible(existant.dateCible ?? '')
  }, [existant?.id]) // eslint-disable-line react-hooks/exhaustive-deps
  if ((id && existant === undefined) || !comptes || !operations || !reglages) return <Page titre="Projet"><div /></Page>

  const estSecurite = !!existant && existant.id === reglages.objectifSecuriteId
  // un projet vit sur un compte épargne (un ancien objectif garde son compte)
  const possibles = comptes.filter((c) => c.type === 'epargne' || c.id === existant?.compteId)
  const compte = compteId || possibles[0]?.id || ''
  const aDeLHistorique = estSecurite || !!existant && (existant.mouvements.length > 0 || operations.some((o) => o.objectifEpargneId === existant.id))
  const valeurCible = cible.trim() ? lireMontant(cible) : undefined
  const valide = nom.trim() !== '' && !!compte && valeurCible !== null && (!avecDate || dateCible !== '')

  return (
    <Page titre={existant ? existant.nom : 'Nouveau projet'} action={
      <button type="button" disabled={!valide} onClick={async () => {
        await enregistrerObjectif({ id: existant?.id, nom: nom.trim(), compteId: compte, montantCible: valeurCible ?? undefined, dateCible: avecDate ? dateCible : undefined })
        nav.retour()
      }} className="min-h-[44px] px-1 text-[17px] font-semibold text-bleu disabled:opacity-40">Enregistrer</button>
    }>
      <Groupe>
        <Champ libelle="Nom"><Saisie value={nom} onChange={(e) => setNom(e.target.value)} placeholder="Ex. PS5, voyage au Japon" /></Champ>
        <Champ libelle="Compte" aide={aDeLHistorique ? 'Non modifiable : l’objectif a déjà des mouvements' : 'La devise suit le compte'}>
          {aDeLHistorique ? <span className="text-[17px] text-encre-douce">{comptes.find((c) => c.id === compte)?.nom}</span> : (
            <Choix value={compte} onChange={(e) => setCompteId(e.target.value)}>
              {possibles.map((c) => <option key={c.id} value={c.id}>{c.nom} ({c.devise})</option>)}
            </Choix>
          )}
        </Champ>
        <Champ libelle="Montant cible" aide={valeurCible === null ? 'Montant invalide' : 'Facultatif'}>
          <Saisie inputMode="decimal" value={cible} onChange={(e) => setCible(e.target.value)} placeholder="Facultatif" />
        </Champ>
        <div className="flex min-h-[50px] items-center justify-between gap-3 px-4 py-2">
          <span className="text-[17px] text-encre">Date cible</span>
          <Interrupteur actif={avecDate} surChange={setAvecDate} libelle="Date cible" />
        </div>
        {avecDate && <Champ libelle="Pour le"><Saisie type="date" value={dateCible} min={aujourdhui()} onChange={(e) => setDateCible(e.target.value)} /></Champ>}
      </Groupe>
      {existant && !estSecurite && (
        <Bouton variante={existant.archive ? 'secondaire' : 'danger'} onClick={async () => { await db.objectifs.update(existant.id, { archive: !existant.archive }); nav.retour() }}>
          {existant.archive ? 'Réactiver le projet' : 'Archiver (projet terminé)'}
        </Bouton>
      )}
      {existant && !existant.archive && !estSecurite && <p className="px-1 text-[13px] text-encre-pale">Un projet archivé reste visible dans « Projets terminés » avec son historique ; il ne compte plus dans la répartition de ton épargne.</p>}
    </Page>
  )
}

const moisAnnee = (d: string) => format(parseISO(d), 'MMMM yyyy', { locale: fr })

/** « À ce rythme, atteint en juin 2027 » (rien pour un objectif sans cible). */
function TexteRythme({ rythme, devise }: { rythme: Rythme; devise: Devise }) {
  if (rythme.etat === 'sans_cible') return null
  return (
    <span className="mt-1.5 block text-[13px] text-encre-douce">
      {rythme.etat === 'atteint' ? '🎉 Objectif atteint'
        : rythme.etat === 'sans_rythme' ? 'Pas encore de rythme (aucune mise de côté ces 3 derniers mois)'
        : <>À ce rythme ({formaterMontant(rythme.parMois, devise)}/mois), atteint en <b className="text-encre">{moisAnnee(rythme.atteintLe)}</b></>}
    </span>
  )
}

/** Crédits en cours : capital restant dû, progression, dernière mensualité, mensualités restantes ; total par devise. */
export function SectionDettes() {
  const nav = useNav()
  const recurrences = useRecurrences()
  const operations = useOperations()
  const comptes = useComptes(true)
  if (!recurrences || !operations || !comptes) return null
  const liste = dettes(recurrences, operations, comptes, aujourdhui())
  if (liste.length === 0) return <p className="px-1 text-[15px] leading-snug text-encre-douce">Aucun crédit en cours. Les crédits se créent dans Réglages → Charges fixes et crédits.</p>
  const totaux = totalDettes(liste)
  const noms = indexer(comptes)
  return (
    <>
      <Groupe>
        {liste.map((d) => (
          <button key={d.recurrence.id} type="button" onClick={() => nav.ouvrir(<ListeRecurrences genre="charges" />)} className="block w-full px-4 py-3 text-left active:bg-fond">
            <span className="flex items-center gap-3">
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[16px] font-medium text-encre">🏦 {d.recurrence.libelle}</span>
                <span className="block truncate text-[13px] text-encre-pale">{noms.get(d.recurrence.compteId)?.nom}</span>
              </span>
              <span className="text-right">
                <span className="block text-[17px] font-bold text-encre">{d.capitalRestant !== undefined ? formaterMontant(d.capitalRestant, d.devise) : '—'}</span>
                <span className="block text-[12px] text-encre-pale">{d.capitalRestant !== undefined ? 'restant dû' : 'capital non renseigné'}</span>
              </span>
              <IconeChevron taille={18} className="text-encre-pale" />
            </span>
            {d.progression !== undefined && (
              <span className="mt-2 block"><Barre valeur={d.progression} /></span>
            )}
            <span className="mt-1.5 flex justify-between gap-2 text-[13px] text-encre-douce">
              <span>{d.derniereMensualite ? `Dernière mensualité : ${moisAnnee(d.derniereMensualite)}` : 'Sans date de fin'}</span>
              <span>{d.mensualitesRestantes !== undefined ? `${d.mensualitesRestantes} mensualité${d.mensualitesRestantes > 1 ? 's' : ''}` : ''}</span>
            </span>
          </button>
        ))}
        {totaux.size > 0 && (
          <div className="flex min-h-[46px] items-center justify-between bg-fond/60 px-4 py-2 text-[15px]">
            <span className="font-semibold text-encre">Total restant dû</span>
            <span className="font-bold text-encre">{[...totaux].map(([dv, t]) => formaterMontant(t, dv)).join(' + ')}</span>
          </div>
        )}
      </Groupe>
      {liste.some((d) => d.progression === undefined) && (
        <p className="px-1 text-[13px] leading-snug text-encre-pale">Pour la barre de progression, renseigne le capital restant dû et le montant emprunté dans la fiche du crédit.</p>
      )}
    </>
  )
}
