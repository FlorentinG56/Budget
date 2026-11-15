import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useState } from 'react'
import { enregistrerOperation, supprimerOperation } from '../../db/actions'
import { db } from '../../db/db'
import { Bouton, Champ, Choix, Groupe, Saisie } from '../../components/formulaire'
import { analyserMontant, formaterMontant } from '../../domain/argent'
import { categoriesPrincipales, sousCategories } from '../../domain/categories'
import type { Operation } from '../../domain/types'
import { useCategories, useComptes } from '../../hooks/donnees'
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
  const [confirmerSuppression, setConfirmer] = useState(false)

  useEffect(() => {
    if (!op) return
    setMontant(versTexte(op.montant)); setDate(op.date); setCompteId(op.compteId)
    setCategorieId(op.categorieId ?? ''); setSousCategorieId(op.sousCategorieId ?? ''); setNote(op.note ?? '')
  }, [op?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  if (op === undefined || !comptes || !categories) return <Page titre="Opération"><div /></Page>
  if (op === null) return <Page titre="Opération"><p className="text-encre-douce">Cette opération n’existe plus.</p></Page>

  const modifiable = op.type === 'depense' || op.type === 'revenu'
  const valeur = analyserMontant(montant)
  const compte = comptes.find((c) => c.id === compteId)
  // Une dépense peut être sur un compte ou sur une carte ; un revenu, sur un compte seulement.
  const comptesPossibles = comptes.filter((c) => (!c.archive || c.id === op.compteId) && (op.type === 'depense' || c.type !== 'carte_credit'))

  const enregistrer = async () => {
    if (modifiable && !valeur) return
    await enregistrerOperation({
      ...op,
      montant: modifiable ? valeur! : op.montant,
      date: date || op.date,
      compteId: modifiable ? compteId : op.compteId,
      categorieId: op.type === 'depense' ? categorieId || undefined : op.categorieId,
      sousCategorieId: op.type === 'depense' ? sousCategorieId || undefined : op.sousCategorieId,
      note: note.trim() || undefined,
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
          <Champ libelle={op.type === 'depense' ? 'Compte / carte' : 'Compte'}>
            <Choix value={compteId} onChange={(e) => setCompteId(e.target.value)}>
              {comptesPossibles.map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}
            </Choix>
          </Champ>
        ) : (
          <Champ libelle="Compte"><span className="truncate text-[17px] text-encre-douce">{compte?.nom}</span></Champ>
        )}
      </Groupe>

      {op.type === 'depense' && (
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

      <Groupe>
        <Champ libelle={op.type === 'revenu' ? 'Libellé' : 'Note'}>
          <Saisie value={note} onChange={(e) => setNote(e.target.value)} placeholder="Facultatif" />
        </Champ>
      </Groupe>

      {!confirmerSuppression ? (
        <Bouton variante="danger" onClick={() => setConfirmer(true)}>Supprimer l’opération</Bouton>
      ) : (
        <div className="flex gap-2">
          <Bouton variante="secondaire" onClick={() => setConfirmer(false)}>Garder</Bouton>
          <Bouton variante="danger" className="!bg-rouge !text-white" onClick={() => { void supprimerOperation(op.id); retour() }}>Supprimer</Bouton>
        </div>
      )}
    </Page>
  )
}
