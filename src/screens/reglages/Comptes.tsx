import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useMemo, useState } from 'react'
import { ajusterSolde, enregistrerCompte, marquerSoldesSaisis } from '../../db/actions'
import { db } from '../../db/db'
import { Feuille } from '../../components/Feuille'
import { Bouton, Champ, ChoixCouleur, Choix, Groupe, Interrupteur, Saisie } from '../../components/formulaire'
import { IconeChevron } from '../../components/Icones'
import { TitreSection } from '../../components/ui'
import { analyserMontant, formaterMontant } from '../../domain/argent'
import { aujourdhui, libelleCourt } from '../../domain/dates'
import { montantAjustement, soldeCompte } from '../../domain/soldes'
import type { Compte, Devise, TypeCompte } from '../../domain/types'
import { useComptes, useOperations } from '../../hooks/donnees'
import { Page, useNav } from '../../nav/Navigation'
import { ListeOperations } from '../operations/ListeOperations'
import { RembourserCarte } from '../../budget/RembourserCarte'

const LIBELLE_TYPE: Record<TypeCompte, string> = { cheque: 'Compte courant', carte_credit: 'Carte de crédit', epargne: 'Épargne' }

/** Affichage du solde : pour une carte, le montant dû (positif). */
export function texteSolde(c: Compte, solde: number) {
  return c.type === 'carte_credit' ? `Dû : ${formaterMontant(-solde, c.devise)}` : formaterMontant(solde, c.devise)
}

/** « -12,5 » → -1250 ; null si invalide. */
function lireMontantSigne(t: string): number | null {
  const negatif = t.trim().startsWith('-') || t.trim().startsWith('−')
  const v = analyserMontant(t.trim().replace(/^[-−]/, ''))
  return v === null ? null : negatif ? -v : v
}
const versTexte = (c: number) => (c < 0 ? '-' : '') + (Math.abs(c) / 100).toFixed(2).replace('.', ',')

export function ListeComptes() {
  const nav = useNav()
  const comptes = useComptes(true)
  const operations = useOperations()
  const date = aujourdhui()
  if (!comptes || !operations) return <Page titre="Comptes"><div /></Page>

  const ligne = (c: Compte) => (
    <button key={c.id} type="button" onClick={() => nav.ouvrir(<EditionCompte id={c.id} />)}
      className="flex min-h-[60px] w-full items-center gap-3 px-4 py-2 text-left active:bg-fond">
      <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: c.couleur }} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[16px] font-medium text-encre">{c.nom}</span>
        <span className="block text-[13px] text-encre-pale">{LIBELLE_TYPE[c.type]} · {c.devise}</span>
      </span>
      <span className="text-[15px] font-semibold text-encre">{texteSolde(c, soldeCompte(c, operations, date))}</span>
      <IconeChevron taille={18} className="text-encre-pale" />
    </button>
  )
  const actifs = comptes.filter((c) => !c.archive)
  const archives = comptes.filter((c) => c.archive)

  return (
    <Page titre="Comptes" action={
      <button type="button" onClick={() => nav.ouvrir(<EditionCompte />)} className="min-h-[44px] px-1 text-[17px] font-semibold text-bleu">Ajouter</button>
    }>
      <Groupe>{actifs.map(ligne)}</Groupe>
      <p className="px-1 text-[13px] leading-snug text-encre-pale">Touche un compte pour renseigner son solde de départ, le modifier ou ajuster son solde.</p>
      {archives.length > 0 && (<><TitreSection>Archivés</TitreSection><Groupe>{archives.map(ligne)}</Groupe></>)}
    </Page>
  )
}

export function EditionCompte({ id }: { id?: string }) {
  const nav = useNav()
  const existant = useLiveQuery(async () => (id ? (await db.comptes.get(id)) ?? null : null), [id])
  const comptes = useComptes()
  const operations = useOperations()

  const [nom, setNom] = useState('')
  const [type, setType] = useState<TypeCompte>('cheque')
  const [devise, setDevise] = useState<Devise>('CAD')
  const [couleur, setCouleur] = useState('#2F6FED')
  const [solde, setSolde] = useState('0,00')
  const [dateDepart, setDateDepart] = useState(aujourdhui())
  const [inclus, setInclus] = useState(false)
  const [remboursement, setRemboursement] = useState('')
  const [ajustement, setAjustement] = useState(false)
  const [rembOuvert, setRembOuvert] = useState(false)

  useEffect(() => {
    if (!existant) return
    setNom(existant.nom); setType(existant.type); setDevise(existant.devise); setCouleur(existant.couleur)
    setSolde(versTexte(existant.type === 'carte_credit' ? -existant.soldeDepart : existant.soldeDepart))
    setDateDepart(existant.dateDepart); setInclus(existant.inclusBudgetJournalier); setRemboursement(existant.compteRemboursementId ?? '')
  }, [existant?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  if (id && existant === undefined) return <Page titre="Compte"><div /></Page>

  const estCarte = type === 'carte_credit'
  const valeurSolde = lireMontantSigne(solde)
  const valide = nom.trim() !== '' && valeurSolde !== null
  const soldeActuel = existant && operations ? soldeCompte(existant, operations, aujourdhui()) : null

  const enregistrer = async () => {
    if (!valide) return
    await enregistrerCompte({
      ...(existant ?? { archive: false }),
      id: existant?.id, ordre: existant?.ordre,
      nom: nom.trim(), type, devise, couleur, dateDepart,
      soldeDepart: estCarte ? -valeurSolde! : valeurSolde!,
      inclusBudgetJournalier: inclus,
      compteRemboursementId: estCarte ? remboursement || undefined : undefined,
    })
    await marquerSoldesSaisis()
    nav.retour()
  }

  return (
    <Page titre={existant ? existant.nom : 'Nouveau compte'} retourLibelle="Comptes" action={
      <button type="button" onClick={() => void enregistrer()} disabled={!valide} className="min-h-[44px] px-1 text-[17px] font-semibold text-bleu disabled:opacity-40">Enregistrer</button>
    }>
      {existant && soldeActuel !== null && (
        <div className="rounded-carte bg-white p-4 shadow-carte">
          <p className="text-[14px] text-encre-douce">{estCarte ? 'Montant dû aujourd’hui' : 'Solde aujourd’hui'}</p>
          <p className="text-[30px] font-bold text-encre">{formaterMontant(estCarte ? -soldeActuel : soldeActuel, existant.devise)}</p>
          <div className="mt-3 flex gap-2">
            <Bouton variante="secondaire" className="!min-h-[44px] !text-[15px]" onClick={() => setAjustement(true)}>Ajuster le solde</Bouton>
            <Bouton variante="secondaire" className="!min-h-[44px] !text-[15px]" onClick={() => nav.ouvrir(<ListeOperations compteInitial={existant.id} />)}>Opérations</Bouton>
          </div>
          {estCarte && existant.compteRemboursementId && (
            <Bouton className="mt-2 !min-h-[44px] !text-[15px]" onClick={() => setRembOuvert(true)}>💳 Rembourser la carte</Bouton>
          )}
        </div>
      )}

      <Groupe>
        <Champ libelle="Nom"><Saisie value={nom} onChange={(e) => setNom(e.target.value)} placeholder="Ex. Banque" /></Champ>
        <Champ libelle="Type">
          {existant ? <span className="text-[17px] text-encre-douce">{LIBELLE_TYPE[type]}</span> : (
            <Choix value={type} onChange={(e) => setType(e.target.value as TypeCompte)}>
              {Object.entries(LIBELLE_TYPE).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </Choix>
          )}
        </Champ>
        <Champ libelle="Devise">
          {existant ? <span className="text-[17px] text-encre-douce">{devise}</span> : (
            <Choix value={devise} onChange={(e) => setDevise(e.target.value as Devise)}>
              <option value="CAD">CAD ($)</option><option value="EUR">EUR (€)</option>
            </Choix>
          )}
        </Champ>
      </Groupe>

      <TitreSection>Point de départ</TitreSection>
      <Groupe>
        <Champ libelle={estCarte ? 'Montant dû' : 'Solde'} aide={valeurSolde === null ? 'Montant invalide' : estCarte ? 'Ce que tu dois sur la carte à cette date' : 'Mets un « - » devant si le compte est à découvert'}>
          <Saisie inputMode="decimal" value={solde} onChange={(e) => setSolde(e.target.value)} onFocus={(e) => e.target.select()} />
        </Champ>
        <Champ libelle="À la date du"><Saisie type="date" value={dateDepart} onChange={(e) => e.target.value && setDateDepart(e.target.value)} /></Champ>
      </Groupe>
      <p className="px-1 text-[13px] leading-snug text-encre-pale">
        Le solde est ensuite calculé à partir de ce point de départ et des opérations saisies. Les opérations antérieures à cette date sont ignorées.
      </p>

      <TitreSection>Options</TitreSection>
      <Groupe>
        <div className="flex min-h-[50px] items-center justify-between gap-3 px-4 py-2">
          <span className="text-[17px] text-encre">Compte dans le budget du jour</span>
          <Interrupteur actif={inclus} surChange={setInclus} libelle="Compte dans le budget du jour" />
        </div>
        {estCarte && (
          <Champ libelle="Remboursée depuis">
            <Choix value={remboursement} onChange={(e) => setRemboursement(e.target.value)}>
              <option value="">Aucun</option>
              {(comptes ?? []).filter((c) => c.type !== 'carte_credit' && c.devise === devise).map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}
            </Choix>
          </Champ>
        )}
      </Groupe>

      <TitreSection>Couleur</TitreSection>
      <Groupe><ChoixCouleur valeur={couleur} surChange={setCouleur} /></Groupe>

      {existant && (
        <Bouton variante={existant.archive ? 'secondaire' : 'danger'} onClick={async () => { await db.comptes.update(existant.id, { archive: !existant.archive }); nav.retour() }}>
          {existant.archive ? 'Réactiver le compte' : 'Archiver le compte'}
        </Bouton>
      )}
      {existant && !existant.archive && (
        <p className="px-1 text-[13px] text-encre-pale">Un compte archivé n’apparaît plus dans la saisie ; son historique est conservé.</p>
      )}

      {existant && estCarte && soldeActuel !== null && (
        <RembourserCarte ouverte={rembOuvert} surFermer={() => setRembOuvert(false)} carte={existant}
          compte={comptes?.find((c) => c.id === existant.compteRemboursementId)} du={-soldeActuel} />
      )}
      {existant && soldeActuel !== null && (
        <AjusterSolde ouverte={ajustement} surFermer={() => setAjustement(false)} compte={existant} soldeActuel={soldeActuel} />
      )}
    </Page>
  )
}

function AjusterSolde({ ouverte, surFermer, compte, soldeActuel }: { ouverte: boolean; surFermer: () => void; compte: Compte; soldeActuel: number }) {
  const estCarte = compte.type === 'carte_credit'
  const affiche = estCarte ? -soldeActuel : soldeActuel
  const [texte, setTexte] = useState('')
  useEffect(() => { if (ouverte) setTexte(versTexte(affiche)) }, [ouverte]) // eslint-disable-line react-hooks/exhaustive-deps
  const saisi = lireMontantSigne(texte)
  const reel = saisi === null ? null : estCarte ? -saisi : saisi
  const ecart = useMemo(() => (reel === null ? null : montantAjustement(soldeActuel, reel)), [reel, soldeActuel])

  return (
    <Feuille ouverte={ouverte} surFermer={surFermer} titre="Ajuster le solde">
      <p className="mb-3 text-[15px] leading-snug text-encre-douce">
        Indique {estCarte ? 'le montant dû affiché par la banque' : 'le solde affiché par la banque'} aujourd’hui ({libelleCourt(aujourdhui())}).
        L’écart est enregistré comme une opération « Ajustement », exclue des analyses.
      </p>
      <Groupe>
        <Champ libelle={estCarte ? 'Dû réel' : 'Solde réel'}>
          <Saisie inputMode="decimal" value={texte} onChange={(e) => setTexte(e.target.value)} onFocus={(e) => e.target.select()} />
        </Champ>
      </Groupe>
      <p className="my-3 text-center text-[15px] text-encre-douce">
        {ecart === null ? 'Montant invalide' : ecart === 0 ? 'Aucun écart : rien à ajuster.' : <>Écart : <b className="text-encre">{formaterMontant(ecart, compte.devise, { signe: true })}</b></>}
      </p>
      <Bouton disabled={!ecart} onClick={async () => { if (reel !== null) { await ajusterSolde(compte.id, reel); surFermer() } }}>Enregistrer l’ajustement</Bouton>
    </Feuille>
  )
}
