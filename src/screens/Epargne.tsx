import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useState } from 'react'
import { ajouterMouvement, enregistrerObjectif, supprimerMouvement } from '../db/actions'
import { db } from '../db/db'
import { Feuille } from '../components/Feuille'
import { Bouton, Champ, Choix, Groupe, Interrupteur, Saisie } from '../components/formulaire'
import { IconeChevron } from '../components/Icones'
import { Ecran, TitreSection } from '../components/ui'
import { ChampMontant, lireMontant, versTexteMontant } from '../budget/ChampMontant'
import { formaterMontant } from '../domain/argent'
import { aujourdhui, libelleCourt } from '../domain/dates'
import { historiqueObjectif, parMoisPourAtteindre, progressionObjectif, soldeObjectif, totalParDevise } from '../domain/epargne'
import { soldeCompte } from '../domain/soldes'
import type { Compte, ObjectifEpargne } from '../domain/types'
import { indexer, useComptes, useObjectifs, useOperations, useReglages } from '../hooks/donnees'
import { Page, useNav } from '../nav/Navigation'
import { EditionOperation } from './operations/EditionOperation'

function Barre({ valeur }: { valeur: number }) {
  return (
    <div className="h-2 overflow-hidden rounded-full bg-vert-pale">
      <div className="h-full rounded-full bg-vert" style={{ width: `${Math.min(100, valeur * 100)}%` }} />
    </div>
  )
}

export function Epargne() {
  const nav = useNav()
  const objectifs = useObjectifs()
  const comptes = useComptes()
  const operations = useOperations()
  const reglages = useReglages()
  if (!objectifs || !comptes || !operations || !reglages) return <Ecran titre="Épargne"><div /></Ecran>

  const mapComptes = indexer(comptes)
  const actifs = objectifs.filter((o) => !o.archive && mapComptes.has(o.compteId))
    .sort((a, b) => (a.id === reglages.objectifSecuriteId ? -1 : b.id === reglages.objectifSecuriteId ? 1 : a.nom.localeCompare(b.nom)))
  const archives = objectifs.filter((o) => o.archive)
  const totaux = totalParDevise(objectifs, operations, comptes)
  const ca = comptes.find((c) => c.id === 'eur' && !c.archive)
  const proposerFrance = ca && !objectifs.some((o) => o.compteId === ca.id)

  const ligne = (o: ObjectifEpargne) => {
    const compte = mapComptes.get(o.compteId)!
    const solde = soldeObjectif(o, operations)
    const prog = progressionObjectif(solde, o.montantCible)
    return (
      <button key={o.id} type="button" onClick={() => nav.ouvrir(<PageObjectif id={o.id} />)} className="block w-full px-4 py-3 text-left active:bg-fond">
        <span className="flex items-center gap-3">
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[16px] font-medium text-encre">{o.id === reglages.objectifSecuriteId ? '🛟 ' : '🐷 '}{o.nom}</span>
            <span className="block truncate text-[13px] text-encre-pale">{compte.nom}{o.dateCible ? ` · pour le ${libelleCourt(o.dateCible)}` : ''}</span>
          </span>
          <span className="text-right">
            <span className={`block text-[17px] font-bold ${solde < 0 ? 'text-rouge' : 'text-encre'}`}>{formaterMontant(solde, compte.devise)}</span>
            {o.montantCible ? <span className="block text-[12px] text-encre-pale">sur {formaterMontant(o.montantCible, compte.devise)}</span> : null}
          </span>
          <IconeChevron taille={18} className="text-encre-pale" />
        </span>
        {prog !== undefined && <span className="mt-2 block"><Barre valeur={prog} /></span>}
      </button>
    )
  }

  return (
    <Ecran titre="Épargne" action={
      <button type="button" onClick={() => nav.ouvrir(<EditionObjectif />)} className="min-h-[44px] pb-1 text-[17px] font-semibold text-bleu">Ajouter</button>
    }>
      <section className="rounded-carte bg-white p-4 shadow-carte">
        <p className="text-[14px] font-medium text-encre-douce">Total de l’épargne</p>
        <p className="text-[30px] font-bold leading-tight tracking-tight text-vert">
          {totaux.size === 0 ? formaterMontant(0, 'CAD') : [...totaux].map(([d, t]) => formaterMontant(t, d)).join(' + ')}
        </p>
        <p className="mt-1 text-[13px] leading-snug text-encre-pale">L’épargne est virtuelle : elle réserve une partie du solde de chaque compte, l’argent ne bouge pas.</p>
      </section>

      {proposerFrance && <ProposerEpargneFrance compte={ca!} />}

      {actifs.length > 0 && <Groupe>{actifs.map(ligne)}</Groupe>}

      <SoldesDisponibles comptes={comptes} objectifs={objectifs} />

      {archives.length > 0 && (<><TitreSection>Archivés</TitreSection><Groupe>{archives.filter((o) => mapComptes.has(o.compteId)).map(ligne)}</Groupe></>)}
    </Ecran>
  )
}

/** Sur chaque compte qui a de l'épargne : solde, dont épargne réservée, disponible réel. */
function SoldesDisponibles({ comptes, objectifs }: { comptes: Compte[]; objectifs: ObjectifEpargne[] }) {
  const operations = useOperations() ?? []
  const date = aujourdhui()
  const lignes = comptes
    .map((c) => ({ c, solde: soldeCompte(c, operations, date), reserve: objectifs.filter((o) => o.compteId === c.id && !o.archive).reduce((s, o) => s + soldeObjectif(o, operations), 0) }))
    .filter((l) => l.reserve !== 0)
  if (lignes.length === 0) return null
  return (
    <>
      <TitreSection>Disponible réel par compte</TitreSection>
      <Groupe>
        {lignes.map(({ c, solde, reserve }) => (
          <div key={c.id} className="space-y-0.5 px-4 py-3 text-[15px]">
            <p className="font-medium text-encre">{c.nom}</p>
            <p className="flex justify-between text-encre-douce"><span>Solde</span><span>{formaterMontant(solde, c.devise)}</span></p>
            <p className="flex justify-between text-encre-douce"><span>dont épargne réservée</span><span>{formaterMontant(-reserve, c.devise)}</span></p>
            <p className="flex justify-between font-semibold"><span>Disponible réel</span>
              <span className={solde - reserve < 0 ? 'text-rouge' : 'text-encre'}>{formaterMontant(solde - reserve, c.devise)}</span></p>
          </div>
        ))}
      </Groupe>
    </>
  )
}

function ProposerEpargneFrance({ compte }: { compte: Compte }) {
  const [texte, setTexte] = useState('')
  const montant = lireMontant(texte)
  return (
    <section className="rounded-carte border border-bleu/20 bg-bleu-pale p-4">
      <p className="text-[16px] font-semibold text-bleu-fonce">💰 Ton épargne sur le Compte en euros</p>
      <p className="mt-1 text-[14px] leading-snug text-encre-douce">Combien de ton solde Compte en euros est de l’épargne ? Elle sera enregistrée dans un objectif « Épargne ».</p>
      <div className="mt-2 flex gap-2">
        <div className="flex-1"><ChampMontant valeur={texte} surChange={setTexte} devise={compte.devise} libelle="Épargne déjà présente" /></div>
        <Bouton className="!w-auto" disabled={montant === null} onClick={async () => {
          const o = await enregistrerObjectif({ nom: 'Épargne', compteId: compte.id })
          if (montant) await ajouterMouvement(o.id, { date: aujourdhui(), montant, sens: 'mise_de_cote', note: 'Épargne déjà présente' })
        }}>Créer</Bouton>
      </div>
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
          </div>
        ) : null}
        <div className="mt-3 flex gap-2">
          <Bouton onClick={() => setMouvement('mise_de_cote')}>Mettre de côté</Bouton>
          <Bouton variante="secondaire" onClick={() => setMouvement('reprise')}>Reprendre</Bouton>
        </div>
      </section>
      {securite && (
        <p className="px-1 text-[13px] leading-snug text-encre-pale">
          Reçoit automatiquement ce que tu mets de côté à la paie et le reste de chaque période. Pour un imprévu, saisis la dépense puis choisis « Payé avec l’épargne » : elle est retirée d’ici sans toucher ton budget du jour.
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

function Mouvement({ sens, surFermer, objectif, compte, solde }: { sens: null | 'mise_de_cote' | 'reprise'; surFermer: () => void; objectif: ObjectifEpargne; compte: Compte; solde: number }) {
  const [texte, setTexte] = useState('')
  const [note, setNote] = useState('')
  const [date, setDate] = useState(aujourdhui())
  useEffect(() => { if (sens) { setTexte(''); setNote(''); setDate(aujourdhui()) } }, [sens])
  const montant = lireMontant(texte)
  return (
    <Feuille ouverte={sens !== null} surFermer={surFermer} titre={sens === 'reprise' ? 'Reprendre' : 'Mettre de côté'}>
      <p className="mb-3 text-[15px] leading-snug text-encre-douce">
        {sens === 'reprise'
          ? `L’argent redevient disponible sur ${compte.nom}. Disponible dans « ${objectif.nom} » : ${formaterMontant(solde, compte.devise)}.`
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
        {sens === 'reprise' && montant !== null && montant > solde && <p className="px-1 text-[13px] text-rouge">C’est plus que l’épargne disponible dans cet objectif.</p>}
        <Bouton disabled={!montant} onClick={async () => {
          if (!montant || !sens) return
          await ajouterMouvement(objectif.id, { date, montant, sens, note: note.trim() || undefined })
          surFermer()
        }}>{sens === 'reprise' ? 'Reprendre' : 'Mettre de côté'}</Bouton>
      </div>
    </Feuille>
  )
}

export function EditionObjectif({ id }: { id?: string }) {
  const nav = useNav()
  const existant = useLiveQuery(async () => (id ? (await db.objectifs.get(id)) ?? null : null), [id])
  const comptes = useComptes()
  const operations = useOperations()
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
  if ((id && existant === undefined) || !comptes || !operations) return <Page titre="Objectif"><div /></Page>

  const possibles = comptes.filter((c) => c.type !== 'carte_credit')
  const compte = compteId || possibles[0]?.id || ''
  const aDeLHistorique = !!existant && (existant.mouvements.length > 0 || operations.some((o) => o.objectifEpargneId === existant.id))
  const valeurCible = cible.trim() ? lireMontant(cible) : undefined
  const valide = nom.trim() !== '' && !!compte && valeurCible !== null && (!avecDate || dateCible !== '')

  return (
    <Page titre={existant ? existant.nom : 'Nouvel objectif'} action={
      <button type="button" disabled={!valide} onClick={async () => {
        await enregistrerObjectif({ id: existant?.id, nom: nom.trim(), compteId: compte, montantCible: valeurCible ?? undefined, dateCible: avecDate ? dateCible : undefined })
        nav.retour()
      }} className="min-h-[44px] px-1 text-[17px] font-semibold text-bleu disabled:opacity-40">Enregistrer</button>
    }>
      <Groupe>
        <Champ libelle="Nom"><Saisie value={nom} onChange={(e) => setNom(e.target.value)} placeholder="Ex. Voyage au Japon" /></Champ>
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
      {existant && (
        <Bouton variante={existant.archive ? 'secondaire' : 'danger'} onClick={async () => { await db.objectifs.update(existant.id, { archive: !existant.archive }); nav.retour() }}>
          {existant.archive ? 'Réactiver l’objectif' : 'Archiver l’objectif'}
        </Bouton>
      )}
      {existant && !existant.archive && <p className="px-1 text-[13px] text-encre-pale">Un objectif archivé ne réserve plus d’argent ; son historique est conservé.</p>}
    </Page>
  )
}
