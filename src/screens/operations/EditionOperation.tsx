import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useState } from 'react'
import { enregistrerOperation, supprimerOperation } from '../../db/actions'
import { db } from '../../db/db'
import { Bouton, Champ, Choix, Groupe, Saisie } from '../../components/formulaire'
import { analyserMontant, formaterMontant } from '../../domain/argent'
import { categoriesPrincipales, sousCategories } from '../../domain/categories'
import type { Operation } from '../../domain/types'
import { useBiens, useCategories, useComptes, useObjectifs, useReglages } from '../../hooks/donnees'
import { champsImprevu, choixImprevu, comptesEpargne, projetsEpargne, type ChoixImprevu } from '../../domain/epargne'
import { Page, useNav } from '../../nav/Navigation'

const TITRES: Record<Operation['type'], string> = {
  depense: 'Dépense', revenu: 'Revenu', virement: 'Virement', remboursement_carte: 'Remboursement carte',
  ajustement: 'Ajustement', prelevement_fixe: 'Prélèvement',
}

const versTexte = (c: number) => (Math.abs(c) / 100).toFixed(2).replace('.', ',')

export function EditionOperation({ id }: { id: string }) {
  const { retour } = useNav()
  const op = useLiveQuery(async () => (await db.operations.get(id)) ?? null, [id])
  const comptes = useComptes(true)
  const categories = useCategories()

  const [montant, setMontant] = useState('')
  const [date, setDate] = useState('')
  const [compteId, setCompteId] = useState('')
  const [categorieId, setCategorieId] = useState('')
  const [sousCategorieId, setSousCategorieId] = useState('')
  const [note, setNote] = useState('')
  const [choix, setChoix] = useState<ChoixImprevu>('') // '' : comptée dans le budget du jour ; sinon imprévu payé comment
  const objectifs = useObjectifs()
  const reglages = useReglages()
  const [confirmerSuppression, setConfirmer] = useState(false)
  const [bienId, setBienId] = useState('')
  const biens = useBiens()

  useEffect(() => {
    if (!op) return
    setMontant(versTexte(op.montant)); setDate(op.date); setCompteId(op.compteId)
    setCategorieId(op.categorieId ?? ''); setSousCategorieId(op.sousCategorieId ?? ''); setNote(op.note ?? ''); setChoix(choixImprevu(op, reglages?.objectifSecuriteId)); setBienId(op.bienId ?? '')
  }, [op?.id, !!reglages]) // eslint-disable-line react-hooks/exhaustive-deps

  if (op === undefined || !comptes || !categories || !reglages) return <Page titre="Opération"><div /></Page>
  if (op === null) return <Page titre="Opération"><p className="text-encre-douce">Cette opération n’existe plus.</p></Page>

  const modifiable = op.type === 'depense' || op.type === 'revenu' || op.type === 'prelevement_fixe'
  const avecCategorie = op.type === 'depense' || op.type === 'prelevement_fixe'
  const valeur = analyserMontant(montant)
  const compte = comptes.find((c) => c.id === compteId)
  // Une dépense peut être sur un compte ou sur une carte ; un revenu, sur un compte seulement.
  const comptesPossibles = comptes.filter((c) => (!c.archive || c.id === op.compteId) && (avecCategorie || c.type !== 'carte_credit'))
  // imprévu payé avec l'épargne : compte épargne de la même devise (celui déjà utilisé s'il existe encore)
  const compteEpargne = comptes.find((c) => c.id === op.epargneCompteId) ?? (compte ? comptesEpargne(comptes).find((c) => c.devise === compte.devise) : undefined)

  const enregistrer = async () => {
    if (modifiable && !valeur) return
    const nouveauMontant = modifiable ? valeur! : op.montant
    await enregistrerOperation({
      ...op,
      montant: nouveauMontant,
      // mensualité de crédit modifiée : la part capital suit la différence
      partCapital: op.partCapital === undefined ? undefined : Math.max(0, op.partCapital + nouveauMontant - op.montant),
      date: date || op.date,
      compteId: modifiable ? compteId : op.compteId,
      categorieId: avecCategorie ? categorieId || undefined : op.categorieId,
      sousCategorieId: avecCategorie ? sousCategorieId || undefined : op.sousCategorieId,
      note: note.trim() || undefined,
      ...(op.type === 'depense' ? champsImprevu(choix, reglages.objectifSecuriteId, compteEpargne?.id) : {}),
      bienId: avecCategorie ? bienId || undefined : op.bienId,
    })
    retour()
  }

  return (
    <Page titre={TITRES[op.type]} action={
      <button type="button" onClick={() => void enregistrer()} disabled={modifiable && !valeur} className="min-h-[44px] px-1 text-[17px] font-semibold text-bleu disabled:opacity-40">
        Enregistrer
      </button>
    }>
      <Groupe>
        {modifiable ? (
          <Champ libelle="Montant" aide={valeur === null ? 'Montant invalide' : undefined}>
            <Saisie inputMode="decimal" value={montant} onChange={(e) => setMontant(e.target.value)} />
          </Champ>
        ) : (
          <Champ libelle="Montant"><span className="text-[17px] text-encre-douce">{compte && formaterMontant(op.montant, compte.devise, { signe: op.type === 'ajustement' })}</span></Champ>
        )}
        <Champ libelle="Date"><Saisie type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Champ>
        {modifiable ? (
          <Champ libelle={avecCategorie ? 'Compte / carte' : 'Compte'}>
            <Choix value={compteId} onChange={(e) => setCompteId(e.target.value)}>
              {comptesPossibles.map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}
            </Choix>
          </Champ>
        ) : (
          <Champ libelle="Compte"><span className="truncate text-[17px] text-encre-douce">{compte?.nom}</span></Champ>
        )}
      </Groupe>

      {op.type === 'prelevement_fixe' && (
        <p className="px-1 text-[13px] leading-snug text-encre-pale">
          Prélèvement automatique. Si la banque l’a décalé, change la date ; s’il n’a pas eu lieu, supprime-le : il ne sera pas recréé.
        </p>
      )}

      {avecCategorie && (
        <Groupe>
          <Champ libelle="Catégorie">
            <Choix value={categorieId} onChange={(e) => { setCategorieId(e.target.value); setSousCategorieId('') }}>
              <option value="">Aucune</option>
              {categoriesPrincipales(categories).concat(categories.filter((c) => c.id === op.categorieId && c.archivee))
                .map((c) => <option key={c.id} value={c.id}>{c.icone} {c.nom}</option>)}
            </Choix>
          </Champ>
          {categorieId && (
            <Champ libelle="Sous-catégorie">
              <Choix value={sousCategorieId} onChange={(e) => setSousCategorieId(e.target.value)}>
                <option value="">Aucune</option>
                {sousCategories(categories, categorieId).map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}
              </Choix>
            </Champ>
          )}
        </Groupe>
      )}

      {op.type === 'depense' && (() => {
        const c = comptes.find((x) => x.id === compteId)
        const principal = c?.type === 'carte_credit' ? c.compteRemboursementId : compteId
        const securite = (objectifs ?? []).find((o) => o.id === reglages.objectifSecuriteId && o.compteId === principal)
        const projets = compteEpargne ? projetsEpargne(objectifs ?? [], comptes).filter((o) => o.compteId === compteEpargne.id) : []
        const ancien = choix.startsWith('objectif:') ? (objectifs ?? []).find((o) => `objectif:${o.id}` === choix) : undefined
        return (
          <Groupe>
            <Champ libelle="Budget du jour" aide={choix ? 'Imprévu : hors budget du jour, toujours dans sa catégorie' : undefined}>
              <Choix value={choix} onChange={(e) => setChoix(e.target.value as ChoixImprevu)} aria-label="Payé comment">
                <option value="">Comptée</option>
                <option value="solde">Imprévu · {c?.type === 'carte_credit' ? 'carte de crédit' : 'solde du compte'}</option>
                {securite && <option value="securite">Imprévu · sécurité</option>}
                {compteEpargne && <option value="epargne">Imprévu · épargne</option>}
                {projets.map((o) => <option key={o.id} value={`projet:${o.id}`}>Imprévu · épargne, projet {o.nom}</option>)}
                {ancien && <option value={choix}>Ancien objectif {ancien.nom}</option>}
              </Choix>
            </Champ>
          </Groupe>
        )
      })()}
      {op.type === 'depense' && (choix === 'epargne' || choix.startsWith('projet:')) && compteEpargne && (
        <p className="px-1 text-[13px] leading-snug text-encre-pale">Un virement du même montant de {compteEpargne.nom} vers ton compte accompagne cette dépense : fais-le aussi à ta banque.</p>
      )}

      {avecCategorie && (biens ?? []).some((b) => !b.sortie || b.id === bienId) && (
        <Groupe>
          <Champ libelle="Objet" aide="Réparation ou entretien d’un bien (facultatif)">
            <Choix value={bienId} onChange={(e) => setBienId(e.target.value)} aria-label="Objet">
              <option value="">Aucun</option>
              {(biens ?? []).filter((b) => !b.sortie || b.id === bienId).sort((a, b) => a.nom.localeCompare(b.nom, 'fr')).map((b) => <option key={b.id} value={b.id}>{b.nom}</option>)}
            </Choix>
          </Champ>
        </Groupe>
      )}

      <Groupe>
        <Champ libelle={op.type === 'revenu' || op.type === 'prelevement_fixe' ? 'Libellé' : 'Note'}>
          <Saisie value={note} onChange={(e) => setNote(e.target.value)} placeholder="Facultatif" />
        </Champ>
      </Groupe>

      {!confirmerSuppression ? (
        <Bouton variante="danger" onClick={() => setConfirmer(true)}>{op.type === 'prelevement_fixe' ? 'Annuler ce prélèvement' : 'Supprimer l’opération'}</Bouton>
      ) : (
        <div className="flex gap-2">
          <Bouton variante="secondaire" onClick={() => setConfirmer(false)}>Garder</Bouton>
          <Bouton variante="danger" className="!bg-rouge !text-white" onClick={() => { void supprimerOperation(op.id); retour() }}>Supprimer</Bouton>
        </div>
      )}
    </Page>
  )
}
