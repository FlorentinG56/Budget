import { analyserMontant } from '../../domain/argent'
import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useState } from 'react'
import { enregistrerCategorie } from '../../db/actions'
import { db } from '../../db/db'
import { Bouton, Champ, ChoixCouleur, Groupe, Saisie } from '../../components/formulaire'
import { IconeChevron } from '../../components/Icones'
import { TitreSection } from '../../components/ui'
import type { Categorie } from '../../domain/types'
import { useCategories } from '../../hooks/donnees'
import { Page, useNav } from '../../nav/Navigation'

const ICONES = ['🛒', '🍽️', '☕', '🍔', '🚗', '⛽', '🚌', '🏠', '💡', '📱', '💊', '🏋️', '🎉', '🎬', '🎨', '🛍️', '👕', '💻', '📺', '🏦', '✈️', '🏨', '💼', '🎁', '❤️', '📦', '🐶', '👶', '📚', '✂️', '🍷', '🎮']

export function ListeCategories() {
  const nav = useNav()
  const categories = useCategories()
  if (!categories) return <Page titre="Catégories"><div /></Page>
  const principales = categories.filter((c) => !c.parentId)
  const ligne = (c: Categorie) => {
    const nb = categories.filter((s) => s.parentId === c.id && !s.archivee).length
    return (
      <button key={c.id} type="button" onClick={() => nav.ouvrir(<EditionCategorie id={c.id} />)}
        className="flex min-h-[54px] w-full items-center gap-3 px-4 py-2 text-left active:bg-fond">
        <span className="flex h-9 w-9 items-center justify-center rounded-full text-[19px]" style={{ background: `${c.couleur}22` }}>{c.icone}</span>
        <span className="min-w-0 flex-1 truncate text-[16px] text-encre">{c.nom}</span>
        <span className="text-right text-[13px] text-encre-pale">{c.budgetMensuel ? <span className="block font-semibold text-encre-douce">{(c.budgetMensuel / 100).toLocaleString('fr-FR')} /mois</span> : null}{nb > 0 ? `${nb} sous-cat.` : ''}</span>
        <IconeChevron taille={18} className="text-encre-pale" />
      </button>
    )
  }
  const archivees = principales.filter((c) => c.archivee)
  return (
    <Page titre="Catégories" action={
      <button type="button" onClick={() => nav.ouvrir(<EditionCategorie />)} className="min-h-[44px] px-1 text-[17px] font-semibold text-bleu">Ajouter</button>
    }>
      <Groupe>{principales.filter((c) => !c.archivee).map(ligne)}</Groupe>
      <p className="px-1 text-[13px] leading-snug text-encre-pale">Dans la saisie rapide, les catégories les plus utilisées passent automatiquement en premier.</p>
      {archivees.length > 0 && (<><TitreSection>Archivées</TitreSection><Groupe>{archivees.map(ligne)}</Groupe></>)}
    </Page>
  )
}

export function EditionCategorie({ id }: { id?: string }) {
  const nav = useNav()
  const existante = useLiveQuery(async () => (id ? (await db.categories.get(id)) ?? null : null), [id])
  const categories = useCategories()
  const [nom, setNom] = useState('')
  const [icone, setIcone] = useState('📦')
  const [couleur, setCouleur] = useState('#2F6FED')
  const [nouvelleSous, setNouvelleSous] = useState('')
  const [budget, setBudget] = useState('')

  useEffect(() => {
    if (!existante) return
    setNom(existante.nom); setIcone(existante.icone); setCouleur(existante.couleur)
    setBudget(existante.budgetMensuel ? (existante.budgetMensuel / 100).toFixed(2).replace('.', ',') : '')
  }, [existante?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  if (id && existante === undefined) return <Page titre="Catégorie"><div /></Page>
  const valeurBudget = budget.trim() ? analyserMontant(budget) : 0
  const sous = (categories ?? []).filter((c) => c.parentId === id).sort((a, b) => a.ordre - b.ordre)

  const enregistrer = async () => {
    if (!nom.trim() || valeurBudget === null) return
    await enregistrerCategorie({ ...(existante ?? { archivee: false }), id: existante?.id, ordre: existante?.ordre, nom: nom.trim(), icone, couleur,
      budgetMensuel: valeurBudget || undefined })
    // les sous-catégories suivent la couleur de leur catégorie
    if (existante) await db.categories.where('parentId').equals(existante.id).modify({ couleur })
    nav.retour()
  }

  const ajouterSous = async () => {
    if (!nouvelleSous.trim() || !existante) return
    await enregistrerCategorie({ nom: nouvelleSous.trim(), icone: '', couleur, parentId: existante.id, archivee: false })
    setNouvelleSous('')
  }

  return (
    <Page titre={existante ? existante.nom : 'Nouvelle catégorie'} retourLibelle="Catégories" action={
      <button type="button" onClick={() => void enregistrer()} disabled={!nom.trim()} className="min-h-[44px] px-1 text-[17px] font-semibold text-bleu disabled:opacity-40">Enregistrer</button>
    }>
      <div className="flex justify-center py-1">
        <span className="flex h-20 w-20 items-center justify-center rounded-full text-[40px]" style={{ background: `${couleur}22` }}>{icone}</span>
      </div>
      <Groupe>
        <Champ libelle="Nom"><Saisie value={nom} onChange={(e) => setNom(e.target.value)} placeholder="Ex. Animaux" /></Champ>
        <Champ libelle="Icône" aide="Ou tape n’importe quel emoji">
          <Saisie value={icone} onChange={(e) => setIcone([...e.target.value].slice(-2).join('') || '📦')} className="!w-16" />
        </Champ>
      </Groupe>
      <Groupe>
        <div className="grid grid-cols-8 gap-1 p-3">
          {ICONES.map((i) => (
            <button key={i} type="button" onClick={() => setIcone(i)} className={`flex h-10 items-center justify-center rounded-[10px] text-[22px] ${icone === i ? 'bg-bleu-pale ring-2 ring-bleu' : 'active:bg-fond'}`}>{i}</button>
          ))}
        </div>
      </Groupe>

      <TitreSection>Couleur</TitreSection>
      <Groupe><ChoixCouleur valeur={couleur} surChange={setCouleur} /></Groupe>

      <TitreSection>Budget mensuel</TitreSection>
      <Groupe>
        <Champ libelle="Budget du mois" aide={valeurBudget === null ? 'Montant invalide' : 'Facultatif · alerte à 80 % et à 100 %'}>
          <Saisie inputMode="decimal" value={budget} onChange={(e) => setBudget(e.target.value)} placeholder="Aucun" aria-label="Budget mensuel de la catégorie" />
        </Champ>
      </Groupe>
      <p className="-mt-1 px-1 text-[13px] leading-snug text-encre-pale">Toutes les dépenses de la catégorie (et de ses sous-catégories) sur le compte du budget du jour et sa carte comptent, y compris celles « à côté du budget » ou payées avec l’épargne. Les charges fixes ne comptent pas.</p>

      {existante && (
        <>
          <TitreSection>Sous-catégories</TitreSection>
          <Groupe>
            {sous.map((s) => <LigneSous key={s.id} sous={s} />)}
            <div className="flex min-h-[50px] items-center gap-2 px-4 py-1.5">
              <input value={nouvelleSous} onChange={(e) => setNouvelleSous(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && void ajouterSous()}
                placeholder="Nouvelle sous-catégorie" className="min-w-0 flex-1 bg-transparent text-[17px] outline-none placeholder:text-encre-pale" />
              <button type="button" onClick={() => void ajouterSous()} disabled={!nouvelleSous.trim()} className="min-h-[44px] px-2 text-[16px] font-semibold text-bleu disabled:opacity-40">Ajouter</button>
            </div>
          </Groupe>
          <Bouton variante={existante.archivee ? 'secondaire' : 'danger'} onClick={async () => { await db.categories.update(existante.id, { archivee: !existante.archivee }); nav.retour() }}>
            {existante.archivee ? 'Réactiver la catégorie' : 'Archiver la catégorie'}
          </Bouton>
          <p className="px-1 text-[13px] text-encre-pale">Une catégorie archivée disparaît de la saisie ; les opérations passées la gardent.</p>
        </>
      )}
    </Page>
  )
}

function LigneSous({ sous }: { sous: Categorie }) {
  const [nom, setNom] = useState(sous.nom)
  useEffect(() => setNom(sous.nom), [sous.nom])
  const renommer = () => { if (nom.trim() && nom.trim() !== sous.nom) void db.categories.update(sous.id, { nom: nom.trim() }); else setNom(sous.nom) }
  return (
    <div className="flex min-h-[50px] items-center gap-2 px-4 py-1">
      <input value={nom} onChange={(e) => setNom(e.target.value)} onBlur={renommer} onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
        aria-label="Nom de la sous-catégorie"
        className={`min-w-0 flex-1 bg-transparent text-[17px] outline-none ${sous.archivee ? 'text-encre-pale line-through' : 'text-encre'}`} />
      <button type="button" onClick={() => void db.categories.update(sous.id, { archivee: !sous.archivee })}
        className={`min-h-[44px] px-2 text-[14px] font-medium ${sous.archivee ? 'text-bleu' : 'text-encre-pale'}`}>
        {sous.archivee ? 'Réactiver' : 'Archiver'}
      </button>
    </div>
  )
}
