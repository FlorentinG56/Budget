import { useRef, useState } from 'react'
import { db, modifierReglages } from "../../db/db"
import { exporterDonnees, restaurerDonnees, resumerSauvegarde, validerContenu, type ContenuSauvegarde } from '../../db/sauvegarde'
import { Bouton, Groupe } from '../../components/formulaire'
import { TitreSection } from '../../components/ui'
import { operationsVersCsv } from '../../domain/csv'
import { aujourdhui, libelleCourt } from '../../domain/dates'
import { useReglages } from '../../hooks/donnees'
import { Page } from '../../nav/Navigation'
import { chiffrer, dechiffrer, lireEnveloppe, LONGUEUR_MIN_MOT_DE_PASSE, MotDePasseIncorrect, type FichierChiffre } from '../../security/sauvegarde'

/** Enregistre un fichier : menu Partager d'iOS (Fichiers, iCloud Drive…) si possible, sinon téléchargement. Vrai si enregistré. */
async function enregistrerFichier(nom: string, contenu: string, type: string): Promise<boolean> {
  const fichier = new File([contenu], nom, { type })
  if (navigator.canShare?.({ files: [fichier] })) {
    try {
      await navigator.share({ files: [fichier], title: nom })
      return true
    } catch (e) {
      if ((e as Error).name === 'AbortError') return false // annulé par l'utilisateur
    }
  }
  const url = URL.createObjectURL(fichier)
  const a = Object.assign(document.createElement('a'), { href: url, download: nom })
  document.body.append(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
  return true
}

const champ = 'min-h-[48px] w-full rounded-[12px] bg-white px-4 text-[16px] shadow-carte outline-none placeholder:text-encre-pale'

export function PageSauvegarde() {
  const reglages = useReglages()
  return (
    <Page titre="Sauvegarde">
      <p className="px-1 text-[15px] leading-snug text-encre-douce">
        Tes données ne sont que sur cet iPhone : <b className="text-encre">supprimer l’icône de l’app les efface</b>. Une sauvegarde chiffrée, enregistrée dans Fichiers ou iCloud Drive, permet de tout restaurer.
      </p>
      <Groupe>
        <div className="flex min-h-[50px] items-center justify-between px-4 py-2 text-[16px]">
          <span className="text-encre">Dernière sauvegarde</span>
          <span className={reglages?.derniereSauvegarde ? 'text-encre-douce' : 'font-semibold text-rouge'}>
            {reglages?.derniereSauvegarde ? libelleCourt(new Date(reglages.derniereSauvegarde).toISOString().slice(0, 10)) : 'Jamais'}
          </span>
        </div>
      </Groupe>
      <CreerSauvegarde />
      <Restaurer />
      <ExportCsv />
    </Page>
  )
}

function CreerSauvegarde() {
  const [mdp, setMdp] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [etat, setEtat] = useState<'' | 'en_cours' | 'ok' | 'annule'>('')
  const [erreur, setErreur] = useState('')
  const valide = mdp.length >= LONGUEUR_MIN_MOT_DE_PASSE && mdp === confirmation

  const creer = async () => {
    setErreur(''); setEtat('en_cours')
    try {
      const fichier = await chiffrer(JSON.stringify(await exporterDonnees()), mdp)
      const ok = await enregistrerFichier(`budget-sauvegarde-${aujourdhui()}.json`, JSON.stringify(fichier), 'application/json')
      if (ok) { await modifierReglages({ derniereSauvegarde: Date.now() }); setEtat('ok'); setMdp(''); setConfirmation('') }
      else setEtat('annule')
    } catch (e) {
      setErreur((e as Error).message); setEtat('')
    }
  }

  return (
    <>
      <TitreSection>Créer une sauvegarde</TitreSection>
      <div className="flex flex-col gap-2">
        <input type="password" autoComplete="new-password" value={mdp} onChange={(e) => { setMdp(e.target.value); setEtat('') }} placeholder={`Mot de passe (${LONGUEUR_MIN_MOT_DE_PASSE} caractères min.)`} aria-label="Mot de passe de la sauvegarde" className={champ} />
        <input type="password" autoComplete="new-password" value={confirmation} onChange={(e) => setConfirmation(e.target.value)} placeholder="Confirme le mot de passe" aria-label="Confirmation du mot de passe" className={champ} />
        {confirmation && mdp !== confirmation && <p className="px-1 text-[13px] text-rouge">Les deux mots de passe ne correspondent pas.</p>}
        <p className="px-1 text-[13px] leading-snug text-encre-pale">
          ⚠️ Note ce mot de passe en lieu sûr : sans lui, la sauvegarde est illisible, et personne ne peut la récupérer. Il est différent de ton code à 6 chiffres.
        </p>
        <Bouton disabled={!valide || etat === 'en_cours'} onClick={() => void creer()}>{etat === 'en_cours' ? 'Chiffrement…' : 'Créer et enregistrer'}</Bouton>
        {etat === 'ok' && <p className="px-1 text-[14px] font-medium text-vert">✓ Sauvegarde créée. Choisis « Enregistrer dans Fichiers » puis iCloud Drive si ce n’est pas déjà fait.</p>}
        {etat === 'annule' && <p className="px-1 text-[14px] text-encre-douce">Enregistrement annulé : la sauvegarde n’a pas été enregistrée.</p>}
        {erreur && <p className="px-1 text-[14px] text-rouge">{erreur}</p>}
      </div>
    </>
  )
}

function Restaurer() {
  const entree = useRef<HTMLInputElement>(null)
  const [fichier, setFichier] = useState<FichierChiffre | null>(null)
  const [mdp, setMdp] = useState('')
  const [contenu, setContenu] = useState<ContenuSauvegarde | null>(null)
  const [erreur, setErreur] = useState('')
  const [occupe, setOccupe] = useState(false)

  const choisir = async (f?: File) => {
    setErreur(''); setFichier(null); setContenu(null); setMdp('')
    if (!f) return
    try { setFichier(lireEnveloppe(await f.text())) } catch (e) { setErreur((e as Error).message) }
  }
  const ouvrir = async () => {
    if (!fichier) return
    setOccupe(true); setErreur('')
    try { setContenu(validerContenu(await dechiffrer(fichier, mdp))) }
    catch (e) { setErreur(e instanceof MotDePasseIncorrect ? 'Mot de passe incorrect.' : (e as Error).message) }
    setOccupe(false)
  }
  const restaurer = async () => {
    if (!contenu) return
    setOccupe(true)
    await restaurerDonnees(contenu)
    window.location.reload() // relance l'app avec les données restaurées (le code PIN reste celui de cet iPhone)
  }
  const r = contenu ? resumerSauvegarde(contenu) : undefined

  return (
    <>
      <TitreSection>Restaurer une sauvegarde</TitreSection>
      <div className="flex flex-col gap-2">
        <input ref={entree} type="file" accept=".json,application/json" className="hidden" aria-label="Fichier de sauvegarde" onChange={(e) => void choisir(e.target.files?.[0])} />
        <Bouton variante="secondaire" onClick={() => entree.current?.click()}>{fichier ? 'Choisir un autre fichier' : 'Choisir le fichier de sauvegarde'}</Bouton>
        {fichier && !contenu && (<>
          <p className="px-1 text-[14px] text-encre-douce">Sauvegarde du {libelleCourt(fichier.creeLe.slice(0, 10))}. Saisis son mot de passe :</p>
          <input type="password" autoComplete="current-password" value={mdp} onChange={(e) => setMdp(e.target.value)} placeholder="Mot de passe de la sauvegarde" aria-label="Mot de passe pour restaurer" className={champ} />
          <Bouton disabled={!mdp || occupe} onClick={() => void ouvrir()}>{occupe ? 'Déchiffrement…' : 'Ouvrir la sauvegarde'}</Bouton>
        </>)}
        {r && (
          <div className="rounded-carte border border-rouge/25 bg-rouge-pale p-4">
            <p className="text-[15px] text-encre">Sauvegarde du <b>{libelleCourt(r.exporteLe.slice(0, 10))}</b> : {r.comptes} comptes, {r.operations} opérations, {r.objectifs} objectifs d’épargne.</p>
            <p className="mt-1 text-[14px] font-semibold text-rouge">Toutes les données actuelles de cet iPhone seront remplacées.</p>
            <Bouton className="mt-3 !bg-rouge" disabled={occupe} onClick={() => void restaurer()}>Remplacer et restaurer</Bouton>
          </div>
        )}
        {erreur && <p className="px-1 text-[14px] text-rouge">{erreur}</p>}
      </div>
    </>
  )
}

function ExportCsv() {
  const [ok, setOk] = useState(false)
  return (
    <>
      <TitreSection>Export pour Excel</TitreSection>
      <Bouton variante="secondaire" onClick={async () => {
        const [ops, comptes, cats] = await Promise.all([db.operations.toArray(), db.comptes.toArray(), db.categories.toArray()])
        setOk(await enregistrerFichier(`budget-operations-${aujourdhui()}.csv`, operationsVersCsv(ops, comptes, cats), 'text/csv'))
      }}>Exporter les opérations (CSV)</Bouton>
      <p className="px-1 text-[13px] leading-snug text-encre-pale">
        {ok ? '✓ Fichier exporté. ' : ''}Toutes les opérations, lisibles dans Excel ou Numbers. Ce fichier n’est pas chiffré : ne le partage qu’avec prudence.
      </p>
    </>
  )
}

