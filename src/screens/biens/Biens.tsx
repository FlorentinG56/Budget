import { useLiveQuery } from 'dexie-react-hooks'
import { Suspense, lazy, useEffect, useRef, useState } from 'react'
import { compresserPhoto } from '../../biens/photo'
import { ChampMontant, lireMontant, versTexteMontant } from '../../budget/ChampMontant'
import { Feuille } from '../../components/Feuille'
import { Bouton, Champ, Choix, Groupe, Interrupteur, Saisie } from '../../components/formulaire'
import { IconeChevron } from '../../components/Icones'
import { TitreSection } from '../../components/ui'
import { changerEtatBien, encaisserVente, enregistrerBien, enregistrerPhoto, ignorerVente, reactiverBien, sortirBien, supprimerBien, type NouveauBien } from '../../db/actions'
import { db, modifierReglages } from '../../db/db'
import { formaterMontant } from '../../domain/argent'
import {
  CATEGORIES_BIENS, ETATS_BIENS, MOTIFS_SORTIE, PLANCHER_DEFAUT, courbeValeurBiens, coutTotal, decotePct, infoCategorie, nomEtat, resultatVente, tauxDuBien,
  totauxBiens, totauxParCategorie, trierBiens, valeurBien, type TriBiens,
} from '../../domain/biens'
import { aujourdhui, libelleCourt } from '../../domain/dates'
import { dettes } from '../../domain/dettes'
import type { Bien, CategorieBien, Compte, Devise, EtatBien, MotifSortie, OrigineBien } from '../../domain/types'
import { useBiens, useComptes, useOperations, usePhoto, useRecurrences, useReglages } from '../../hooks/donnees'
import { Page, useNav } from '../../nav/Navigation'
import { EditionOperation } from '../operations/EditionOperation'

const ORIGINES: [OrigineBien, string][] = [['neuf', 'Acheté neuf'], ['occasion', 'Acheté d’occasion'], ['cadeau', 'Cadeau']]

export function libellePrix(origine: OrigineBien, cadeauNeuf?: boolean): string {
  if (origine === 'neuf') return 'Prix d’achat'
  if (origine === 'cadeau' && cadeauNeuf) return 'Prix neuf'
  return 'Prix estimé'
}

/** Miniature carrée d'un bien (photo, sinon l'icône de sa catégorie). */
export function Miniature({ bien, taille = 'h-12 w-12', texte = 'text-[24px]' }: { bien: Bien; taille?: string; texte?: string }) {
  const photo = usePhoto(bien.photoId)
  return photo
    ? <img src={photo} alt="" className={`${taille} shrink-0 rounded-[10px] object-cover`} />
    : <span className={`${taille} ${texte} flex shrink-0 items-center justify-center rounded-[10px] bg-fond`} aria-hidden="true">{infoCategorie(bien.categorie).icone}</span>
}

const CourbeBiens = lazy(() => import('./CourbeBiens'))

/** Section « Biens » de l'onglet Patrimoine : totaux, courbe, liste (grille de photos ou liste compacte), tri, filtre. */
export function SectionBiens() {
  const nav = useNav()
  const biens = useBiens()
  const reglages = useReglages()
  const [filtre, setFiltre] = useState<'' | CategorieBien>('')
  const [detail, setDetail] = useState(false)
  if (!biens || !reglages) return null
  const date = aujourdhui()
  const affichage = reglages.affichageBiens ?? 'grille'
  const tri: TriBiens = reglages.triBiens ?? 'valeur'
  const actifs = biens.filter((b) => !b.sortie)
  const visibles = trierBiens(actifs.filter((b) => !filtre || b.categorie === filtre), tri, date, reglages)
  const archives = biens.filter((b) => b.sortie).sort((a, b) => b.sortie!.date.localeCompare(a.sortie!.date))
  const totaux = totauxBiens(biens, date, reglages)
  const parCat = totauxParCategorie(biens, date, reglages)
  const categoriesPresentes = CATEGORIES_BIENS.filter((c) => actifs.some((b) => b.categorie === c.id))
  const somme = (k: 'achat' | 'valeur' | 'perte') => [...totaux].map(([d, t]) => formaterMontant(k === 'perte' ? -t[k] : t[k], d)).join(' + ')
  return (
    <>
      <button type="button" onClick={() => nav.ouvrir(<EditionBien />)} className="min-h-[46px] rounded-[12px] bg-white text-[16px] font-semibold text-bleu shadow-carte active:bg-fond">+ Ajouter un bien</button>
      {actifs.length === 0 ? (
        <p className="px-1 text-[15px] leading-snug text-encre-douce">Aucun bien pour l’instant. Ajoute ce que tu possèdes (téléphone, ordinateur, voiture…) pour suivre sa valeur.</p>
      ) : (<>
        <section className="rounded-carte bg-white p-4 shadow-carte" aria-label="Totaux des biens">
          <div className="space-y-1 text-[15px]">
            <p className="flex justify-between gap-2"><span className="text-encre-douce">Valeur actuelle</span><span className="text-right text-[18px] font-bold text-encre">{somme('valeur')}</span></p>
            <p className="flex justify-between gap-2"><span className="text-encre-douce">Coût d’achat</span><span className="text-right font-semibold">{somme('achat')}</span></p>
            <p className="flex justify-between gap-2"><span className="text-encre-douce">Perte de valeur</span><span className="text-right font-semibold">{somme('perte')}</span></p>
          </div>
          <button type="button" onClick={() => setDetail(!detail)} aria-expanded={detail} className="mt-2 min-h-[36px] text-[14px] font-semibold text-bleu">Détail par catégorie {detail ? '▴' : '▾'}</button>
          {detail && (
            <div className="space-y-1.5 border-t border-trait pt-2">
              {parCat.map((l) => (
                <div key={`${l.categorie}-${l.devise}`} className="text-[14px]">
                  <p className="flex justify-between"><span className="text-encre">{infoCategorie(l.categorie).icone} {infoCategorie(l.categorie).nom} ({l.totaux.nombre})</span><span className="font-semibold">{formaterMontant(l.totaux.valeur, l.devise)}</span></p>
                  <p className="flex justify-between text-[12px] text-encre-pale"><span>achat {formaterMontant(l.totaux.achat, l.devise)}</span><span>perte {formaterMontant(-l.totaux.perte, l.devise)}</span></p>
                </div>
              ))}
            </div>
          )}
        </section>
        <Suspense fallback={<div className="h-[210px] rounded-carte bg-white shadow-carte" />}>
          {[...totaux.keys()].map((d) => { const pts = courbeValeurBiens(biens, d, date, reglages); return pts.length > 1 ? <CourbeBiens key={d} points={pts} devise={d} /> : null })}
        </Suspense>

        <div className="flex items-center gap-2">
          <label className="relative flex min-h-[40px] flex-1 items-center gap-1 rounded-[10px] bg-white px-3 text-[14px] shadow-carte">
            <span className="text-encre-douce">Tri</span><span className="truncate font-medium text-encre">{TRIS.find((t) => t[0] === tri)![1]}</span>
            <select value={tri} onChange={(e) => void modifierReglages({ triBiens: e.target.value as TriBiens })} className="absolute inset-0 opacity-0" aria-label="Trier par">
              {TRIS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </label>
          <label className="relative flex min-h-[40px] flex-1 items-center gap-1 rounded-[10px] bg-white px-3 text-[14px] shadow-carte">
            <span className="truncate font-medium text-encre">{filtre ? `${infoCategorie(filtre).icone} ${infoCategorie(filtre).nom}` : 'Toutes'}</span>
            <select value={filtre} onChange={(e) => setFiltre(e.target.value as '' | CategorieBien)} className="absolute inset-0 opacity-0" aria-label="Filtrer par catégorie">
              <option value="">Toutes les catégories</option>
              {categoriesPresentes.map((c) => <option key={c.id} value={c.id}>{c.icone} {c.nom}</option>)}
            </select>
          </label>
          <button type="button" onClick={() => void modifierReglages({ affichageBiens: affichage === 'grille' ? 'liste' : 'grille' })}
            aria-label={affichage === 'grille' ? 'Afficher en liste' : 'Afficher en grille'} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] bg-white text-[18px] text-bleu shadow-carte">
            {affichage === 'grille' ? '☰' : '▦'}
          </button>
        </div>
        {visibles.length === 0 ? <p className="px-1 text-[15px] text-encre-douce">Aucun bien dans cette catégorie.</p>
          : affichage === 'grille' ? (
            <div className="grid grid-cols-2 gap-2.5" aria-label="Biens">{visibles.map((b) => <TuileBien key={b.id} bien={b} />)}</div>
          ) : (
            <Groupe>{visibles.map((b) => <LigneBien key={b.id} bien={b} />)}</Groupe>
          )}
      </>)}
      <Archives biens={archives} />
    </>
  )
}

const TRIS: [TriBiens, string][] = [['valeur', 'Valeur'], ['date', 'Date'], ['nom', 'Nom'], ['categorie', 'Catégorie']]

/** Tuile de la grille : photo, nom, valeur actuelle, décote. */
function TuileBien({ bien }: { bien: Bien }) {
  const nav = useNav()
  const reglages = useReglages()
  const valeur = valeurBien(bien, aujourdhui(), reglages)
  return (
    <button type="button" onClick={() => nav.ouvrir(<PageBien id={bien.id} />)} className="overflow-hidden rounded-carte bg-white text-left shadow-carte active:opacity-80">
      <Miniature bien={bien} taille="aspect-square w-full !rounded-none" texte="text-[44px]" />
      <span className="block px-3 pb-2.5 pt-2">
        <span className="block truncate text-[15px] font-medium text-encre">{bien.nom}</span>
        <span className="flex items-baseline justify-between gap-1">
          <span className="truncate text-[15px] font-bold text-encre">{formaterMontant(valeur, bien.devise)}</span>
          <span className="shrink-0 text-[12px] text-encre-pale">−{decotePct(bien.prixAchat, valeur)} %</span>
        </span>
      </span>
    </button>
  )
}

export function Archives({ biens }: { biens: Bien[] }) {
  if (biens.length === 0) return null
  return (<><TitreSection>Archivés</TitreSection><Groupe>{biens.map((b) => <LigneBien key={b.id} bien={b} />)}</Groupe></>)
}

export function LigneBien({ bien }: { bien: Bien }) {
  const nav = useNav()
  const reglages = useReglages()
  const date = aujourdhui()
  const valeur = valeurBien(bien, bien.sortie ? bien.sortie.date : date, reglages)
  return (
    <button type="button" onClick={() => nav.ouvrir(<PageBien id={bien.id} />)} className="flex w-full items-center gap-3 px-4 py-2.5 text-left active:bg-fond">
      <Miniature bien={bien} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[16px] font-medium text-encre">{bien.nom}</span>
        <span className="block truncate text-[13px] text-encre-pale">{bien.sortie ? `${MOTIFS_SORTIE.find((m) => m.id === bien.sortie!.motif)!.nom} le ${libelleCourt(bien.sortie.date)}` : infoCategorie(bien.categorie).nom}</span>
      </span>
      <span className="text-right">
        <span className="block text-[16px] font-bold text-encre">{bien.sortie ? (bien.sortie.prixVente !== undefined ? formaterMontant(bien.sortie.prixVente, bien.devise) : '—') : formaterMontant(valeur, bien.devise)}</span>
        {!bien.sortie && <span className="block text-[12px] text-encre-pale">−{decotePct(bien.prixAchat, valeur)} %</span>}
      </span>
      <IconeChevron taille={18} className="text-encre-pale" />
    </button>
  )
}

/** Photo en grand (touchée pour l'agrandir). */
function VuePhoto({ id, libelle }: { id?: string; libelle: string }) {
  const photo = usePhoto(id)
  const [grande, setGrande] = useState(false)
  if (!photo) return null
  return (
    <>
      <button type="button" onClick={() => setGrande(true)} aria-label={`Agrandir : ${libelle}`} className="block w-full overflow-hidden rounded-carte bg-white shadow-carte">
        <img src={photo} alt={libelle} className="max-h-[320px] w-full object-cover" />
      </button>
      <Feuille ouverte={grande} surFermer={() => setGrande(false)} titre={libelle}>
        <img src={photo} alt={libelle} className="w-full rounded-[12px]" />
      </Feuille>
    </>
  )
}

export function PageBien({ id }: { id: string }) {
  const nav = useNav()
  const bien = useLiveQuery(async () => (await db.biens.get(id)) ?? null, [id])
  const operations = useOperations()
  const recurrences = useRecurrences()
  const comptes = useComptes(true)
  const reglages = useReglages()
  const [etatOuvert, setEtatOuvert] = useState(false)
  const [sortieOuverte, setSortieOuverte] = useState(false)
  if (bien === undefined || !operations || !recurrences || !comptes || !reglages) return <Page titre="Bien"><div /></Page>
  if (bien === null) return <Page titre="Bien"><p className="text-encre-douce">Ce bien n’existe plus.</p></Page>
  const date = aujourdhui()
  const d: Devise = bien.devise
  const valeur = valeurBien(bien, date, reglages)
  const { taux, tauxAnnee1 } = tauxDuBien(bien, reglages)
  const reparations = operations.filter((o) => o.bienId === bien.id).sort((a, b) => b.date.localeCompare(a.date))
  const totalRep = reparations.reduce((s, o) => s + o.montant, 0)
  const credit = bien.creditId ? dettes(recurrences, operations, comptes, date).find((x) => x.recurrence.id === bien.creditId) : undefined
  const creditRec = bien.creditId ? recurrences.find((r) => r.id === bien.creditId) : undefined
  const ligne = (l: string, v: React.ReactNode) => <p className="flex justify-between gap-3 text-[15px]"><span className="text-encre-douce">{l}</span><span className="text-right font-semibold text-encre">{v}</span></p>
  const joursGarantie = bien.finGarantie && !bien.sortie ? Math.round((new Date(bien.finGarantie).getTime() - new Date(date).getTime()) / 86_400_000) : undefined

  return (
    <Page titre={bien.nom} action={
      <button type="button" onClick={() => nav.ouvrir(<EditionBien id={bien.id} />)} className="min-h-[44px] px-1 text-[17px] font-semibold text-bleu">Modifier</button>
    }>
      <VuePhoto id={bien.photoId} libelle={bien.nom} />
      <section className="rounded-carte bg-white p-4 shadow-carte">
        <p className="text-[14px] text-encre-douce">{infoCategorie(bien.categorie).icone} {infoCategorie(bien.categorie).nom}</p>
        {bien.sortie ? (
          <p className="text-[20px] font-bold text-encre">N’est plus à toi</p>
        ) : (<>
          <p className="text-[36px] font-bold leading-tight text-encre">{formaterMontant(valeur, d)}</p>
          <p className="text-[14px] text-encre-douce">
            Valeur actuelle {bien.valeurManuelle && date >= bien.valeurManuelle.date ? `(saisie le ${libelleCourt(bien.valeurManuelle.date)})` : 'estimée'} · décote {decotePct(bien.prixAchat, valeur)} %
          </p>
        </>)}
        <div className="mt-3 space-y-1 border-t border-trait pt-3">
          {ligne(libellePrix(bien.origine, bien.cadeauNeuf), formaterMontant(bien.prixAchat, d))}
          {ligne('Origine', bien.origine === 'cadeau' ? (bien.cadeauNeuf ? 'Cadeau (neuf)' : 'Cadeau (d’occasion)') : ORIGINES.find((o) => o[0] === bien.origine)![1])}
          {ligne('Depuis le', libelleCourt(bien.dateAcquisition))}
          {ligne('Décote', tauxAnnee1 !== undefined ? `${tauxAnnee1} % la 1re année, puis ${taux} %/an` : `${taux} %/an`)}
          {ligne('Plancher', `${bien.planchePct ?? PLANCHER_DEFAUT} % du prix`)}
        </div>
        {bien.valeurManuelle && (
          <button type="button" onClick={() => void enregistrerBien({ ...bien, valeurManuelle: undefined })} className="mt-2 min-h-[40px] w-full rounded-[10px] bg-fond text-[14px] font-semibold text-bleu">
            Revenir au calcul automatique
          </button>
        )}
      </section>

      {bien.sortie && <CarteSortie bien={bien} comptes={comptes} />}

      <TitreSection>État</TitreSection>
      <Groupe>
        <div className="flex min-h-[52px] items-center justify-between px-4 py-2">
          <span className="text-[16px] font-medium text-encre">{nomEtat(bien.etat)}</span>
          {!bien.sortie && <button type="button" onClick={() => setEtatOuvert(true)} className="min-h-[40px] px-1 text-[15px] font-semibold text-bleu">Changer</button>}
        </div>
        {[...bien.historiqueEtat].reverse().map((c, i) => (
          <div key={i} className="px-4 py-2 text-[14px]">
            <p className="text-encre">{nomEtat(c.ancien)} → <b>{nomEtat(c.nouveau)}</b>{c.note ? ` · ${c.note}` : ''}</p>
            <p className="text-[12px] text-encre-pale">{libelleCourt(c.date)}</p>
          </div>
        ))}
      </Groupe>

      <TitreSection>Réparations et entretien</TitreSection>
      <Groupe>
        {reparations.length === 0 ? (
          <p className="px-4 py-3 text-[14px] leading-snug text-encre-douce">Aucune. Pour en rattacher une, choisis cet objet dans le champ « Objet » d’une dépense.</p>
        ) : reparations.map((o) => (
          <button key={o.id} type="button" onClick={() => nav.ouvrir(<EditionOperation id={o.id} />)} className="flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left active:bg-fond">
            <span className="min-w-0"><span className="block truncate text-[15px] text-encre">{o.note || 'Dépense'}</span><span className="block text-[12px] text-encre-pale">{libelleCourt(o.date)}</span></span>
            <span className="text-[15px] font-semibold text-encre">{formaterMontant(o.montant, d)}</span>
          </button>
        ))}
        <div className="space-y-0.5 bg-fond/60 px-4 py-2.5">
          {ligne('Total des réparations', formaterMontant(totalRep, d))}
          {ligne('Coût total (achat + réparations)', formaterMontant(coutTotal(bien, totalRep), d))}
        </div>
      </Groupe>
      <p className="px-1 text-[12px] text-encre-pale">Les réparations n’augmentent pas la valeur estimée.</p>

      {creditRec && (<>
        <TitreSection>Crédit lié</TitreSection>
        <Groupe>
          <div className="space-y-1 px-4 py-3">
            {ligne(creditRec.libelle, credit?.capitalRestant !== undefined ? `${formaterMontant(credit.capitalRestant, d)} restant dû` : 'capital non renseigné')}
            {credit?.capitalRestant !== undefined && !bien.sortie && ligne('Valeur nette de l’objet', formaterMontant(valeur - credit.capitalRestant, d))}
          </div>
        </Groupe>
      </>)}

      {(bien.finGarantie || bien.numeroSerie || bien.lieu || bien.note || bien.factureId) && (<>
        <TitreSection>Informations</TitreSection>
        <Groupe>
          <div className="space-y-1 px-4 py-3">
            {bien.finGarantie && ligne('Fin de garantie', `${libelleCourt(bien.finGarantie)}${joursGarantie !== undefined && joursGarantie >= 0 && joursGarantie <= 30 ? ` · dans ${joursGarantie} j` : joursGarantie !== undefined && joursGarantie < 0 ? ' · terminée' : ''}`)}
            {bien.numeroSerie && ligne('Numéro de série', <span className="select-text font-mono text-[14px]">{bien.numeroSerie}</span>)}
            {bien.lieu && ligne('Lieu', bien.lieu)}
            {bien.note && <p className="pt-1 text-[14px] leading-snug text-encre">{bien.note}</p>}
          </div>
        </Groupe>
        {bien.factureId && <><p className="px-1 text-[13px] font-semibold text-encre-douce">Facture</p><VuePhoto id={bien.factureId} libelle={`Facture : ${bien.nom}`} /></>}
      </>)}

      {!bien.sortie && <Bouton variante="secondaire" onClick={() => setSortieOuverte(true)}>Ce bien n’est plus à moi</Bouton>}

      <FeuilleEtat ouverte={etatOuvert} surFermer={() => setEtatOuvert(false)} bien={bien} />
      <FeuilleSortie ouverte={sortieOuverte} surFermer={() => setSortieOuverte(false)} bien={bien} />
    </Page>
  )
}

/** Bien sorti : motif, date, résultat d'une vente, proposition d'ajouter le prix au solde (jamais automatique), réactivation. */
function CarteSortie({ bien, comptes }: { bien: Bien; comptes: Compte[] }) {
  const reglages = useReglages()
  const sortie = bien.sortie!
  const d = bien.devise
  const possibles = comptes.filter((c) => !c.archive && c.type !== 'carte_credit' && c.devise === d)
  const [compteId, setCompteId] = useState(possibles.find((c) => c.inclusBudgetJournalier)?.id ?? possibles[0]?.id ?? '')
  const r = resultatVente(bien, reglages)
  const signe = (v: number) => <span className={v > 0 ? 'text-vert' : v < 0 ? 'text-rouge' : ''}>{formaterMontant(v, d, { signe: true })}</span>
  const proposer = sortie.motif === 'vendu' && !!sortie.prixVente && !sortie.operationId && !sortie.venteIgnoree
  const compte = possibles.find((c) => c.id === compteId)
  return (
    <section className="rounded-carte bg-white p-4 shadow-carte" aria-label="Sortie du bien">
      <p className="text-[16px] font-semibold text-encre">{MOTIFS_SORTIE.find((m) => m.id === sortie.motif)!.nom} le {libelleCourt(sortie.date)}</p>
      {r && sortie.prixVente !== undefined && (
        <div className="mt-2 space-y-1 text-[15px]">
          <p className="flex justify-between"><span className="text-encre-douce">Prix de vente</span><span className="font-semibold">{formaterMontant(sortie.prixVente, d)}</span></p>
          <p className="flex justify-between"><span className="text-encre-douce">Par rapport à la valeur estimée ({formaterMontant(r.valeurEstimee, d)})</span><span className="font-semibold">{signe(r.parRapportEstimation)}</span></p>
          <p className="flex justify-between"><span className="text-encre-douce">Par rapport au prix d’achat</span><span className="font-semibold">{signe(r.parRapportAchat)}</span></p>
        </div>
      )}
      {sortie.operationId && <p className="mt-2 text-[13px] text-vert">✓ Ajouté au solde du compte (revenu « Vente »).</p>}
      {proposer && possibles.length > 0 && (
        <div className="mt-3 rounded-[12px] bg-fond p-3">
          <p className="text-[15px] text-encre">Ajouter {formaterMontant(sortie.prixVente!, d)} au solde de {compte?.nom} ?</p>
          {possibles.length > 1 && (
            <select value={compteId} onChange={(e) => setCompteId(e.target.value)} aria-label="Compte" className="mt-2 min-h-[42px] w-full rounded-[10px] bg-white px-3 text-[15px] shadow-carte">
              {possibles.map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}
            </select>
          )}
          <div className="mt-2 flex gap-2">
            <Bouton variante="secondaire" onClick={() => void ignorerVente(bien.id)}>Ignorer</Bouton>
            <Bouton disabled={!compteId} onClick={() => void encaisserVente(bien.id, compteId)}>Ajouter</Bouton>
          </div>
        </div>
      )}
      <button type="button" onClick={() => void reactiverBien(bien.id)} className="mt-3 min-h-[40px] w-full rounded-[10px] bg-fond text-[14px] font-semibold text-bleu">Réactiver le bien</button>
    </section>
  )
}

function FeuilleSortie({ ouverte, surFermer, bien }: { ouverte: boolean; surFermer: () => void; bien: Bien }) {
  const [motif, setMotif] = useState<MotifSortie | null>(null)
  const [date, setDate] = useState(aujourdhui())
  const [prix, setPrix] = useState('')
  useEffect(() => { if (ouverte) { setMotif(null); setDate(aujourdhui()); setPrix('') } }, [ouverte])
  const montant = lireMontant(prix)
  const valide = motif !== null && (motif !== 'vendu' || !!montant)
  return (
    <Feuille ouverte={ouverte} surFermer={surFermer} titre="Ce bien n’est plus à moi">
      <div className="flex flex-col gap-2" role="radiogroup" aria-label="Motif">
        {MOTIFS_SORTIE.map((m) => (
          <button key={m.id} type="button" role="radio" aria-checked={motif === m.id} onClick={() => setMotif(m.id)}
            className={`flex min-h-[44px] items-center gap-2.5 rounded-[12px] px-3 text-left text-[15px] ${motif === m.id ? 'bg-bleu-pale font-semibold text-bleu-fonce ring-2 ring-bleu' : 'bg-white text-encre shadow-carte'}`}>
            <span className={`h-5 w-5 shrink-0 rounded-full border-2 ${motif === m.id ? 'border-[6px] border-bleu' : 'border-encre-pale'}`} />{m.nom}
          </button>
        ))}
        {motif === 'vendu' && <ChampMontant valeur={prix} surChange={setPrix} devise={bien.devise} libelle="Prix de vente" />}
        <label className="flex min-h-[46px] items-center justify-between rounded-[12px] bg-white px-3 text-[16px] shadow-carte">
          <span className="text-encre-douce">Date</span>
          <input type="date" value={date} min={bien.dateAcquisition} onChange={(e) => e.target.value && setDate(e.target.value)} className="bg-transparent text-right text-encre outline-none" aria-label="Date de sortie" />
        </label>
        <Bouton disabled={!valide} onClick={async () => { await sortirBien(bien.id, { motif: motif!, date, prixVente: montant ?? undefined }); surFermer() }}>Valider</Bouton>
        <p className="px-1 text-[12px] text-encre-pale">Le bien passe dans « Archivés » : toujours consultable, et réactivable.</p>
      </div>
    </Feuille>
  )
}

function FeuilleEtat({ ouverte, surFermer, bien }: { ouverte: boolean; surFermer: () => void; bien: Bien }) {
  const [etat, setEtat] = useState<EtatBien>(bien.etat)
  const [note, setNote] = useState('')
  const [date, setDate] = useState(aujourdhui())
  useEffect(() => { if (ouverte) { setEtat(bien.etat); setNote(''); setDate(aujourdhui()) } }, [ouverte]) // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <Feuille ouverte={ouverte} surFermer={surFermer} titre="Changer l’état">
      <div className="flex flex-col gap-2" role="radiogroup" aria-label="État">
        {ETATS_BIENS.map((e) => (
          <button key={e.id} type="button" role="radio" aria-checked={etat === e.id} onClick={() => setEtat(e.id)}
            className={`flex min-h-[44px] items-center gap-2.5 rounded-[12px] px-3 text-left text-[15px] ${etat === e.id ? 'bg-bleu-pale font-semibold text-bleu-fonce ring-2 ring-bleu' : 'bg-white text-encre shadow-carte'}`}>
            <span className={`h-5 w-5 shrink-0 rounded-full border-2 ${etat === e.id ? 'border-[6px] border-bleu' : 'border-encre-pale'}`} />{e.nom}
          </button>
        ))}
        <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note (ex. écran rayé)" aria-label="Note"
          className="min-h-[46px] rounded-[12px] bg-white px-3 text-[16px] shadow-carte outline-none placeholder:text-encre-pale" />
        <label className="flex min-h-[46px] items-center justify-between rounded-[12px] bg-white px-3 text-[16px] shadow-carte">
          <span className="text-encre-douce">Date</span>
          <input type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} className="bg-transparent text-right text-encre outline-none" aria-label="Date du changement" />
        </label>
        <Bouton disabled={etat === bien.etat} onClick={async () => { await changerEtatBien(bien.id, etat, date, note.trim() || undefined); surFermer() }}>Enregistrer</Bouton>
      </div>
    </Feuille>
  )
}

/** Champ photo : prise de photo ou photothèque (champ fichier d'iOS), compressée sur l'iPhone. */
function ChampPhoto({ libelle, photoId, surChange }: { libelle: string; photoId?: string; surChange: (id: string | undefined) => void }) {
  const photo = usePhoto(photoId)
  const entree = useRef<HTMLInputElement>(null)
  const [enCours, setEnCours] = useState(false)
  const [erreur, setErreur] = useState('')
  return (
    <div className="flex min-h-[64px] items-center gap-3 px-4 py-2">
      {photo ? <img src={photo} alt="" className="h-12 w-12 rounded-[10px] object-cover" /> : <span className="flex h-12 w-12 items-center justify-center rounded-[10px] bg-fond text-[22px]" aria-hidden="true">📷</span>}
      <span className="min-w-0 flex-1">
        <span className="block text-[16px] text-encre">{libelle}</span>
        {erreur && <span className="block text-[12px] text-rouge">{erreur}</span>}
        {enCours && <span className="block text-[12px] text-encre-pale">Compression…</span>}
      </span>
      {photoId && <button type="button" onClick={() => surChange(undefined)} className="min-h-[40px] px-1 text-[15px] text-rouge">Retirer</button>}
      <button type="button" onClick={() => entree.current?.click()} className="min-h-[40px] px-1 text-[15px] font-semibold text-bleu">{photoId ? 'Changer' : 'Ajouter'}</button>
      <input ref={entree} type="file" accept="image/*" className="hidden" aria-label={libelle} onChange={async (e) => {
        const f = e.target.files?.[0]; e.target.value = ''
        if (!f) return
        setEnCours(true); setErreur('')
        try { const c = await compresserPhoto(f); surChange((await enregistrerPhoto(c.donnees, c.taille)).id) } catch { setErreur('Photo illisible') } finally { setEnCours(false) }
      }} />
    </div>
  )
}

export interface PreRemplissage { nom?: string; prixAchat?: number; dateAcquisition?: string; devise?: Devise }

export function EditionBien({ id, pre }: { id?: string; pre?: PreRemplissage }) {
  const nav = useNav()
  const existant = useLiveQuery(async () => (id ? (await db.biens.get(id)) ?? null : null), [id])
  const recurrences = useRecurrences()
  const reglages = useReglages()
  const [nom, setNom] = useState(pre?.nom ?? '')
  const [categorie, setCategorie] = useState<CategorieBien>('autres')
  const [origine, setOrigine] = useState<OrigineBien>('neuf')
  const [cadeauNeuf, setCadeauNeuf] = useState(true)
  const [date, setDate] = useState(pre?.dateAcquisition ?? aujourdhui())
  const [prix, setPrix] = useState(pre?.prixAchat ? versTexteMontant(pre.prixAchat) : '')
  const [devise, setDevise] = useState<Devise>(pre?.devise ?? 'CAD')
  const [etat, setEtat] = useState<EtatBien>('tres_bon')
  const [photoId, setPhotoId] = useState<string | undefined>()
  const [factureId, setFactureId] = useState<string | undefined>()
  const [note, setNote] = useState('')
  const [garantie, setGarantie] = useState('')
  const [serie, setSerie] = useState('')
  const [lieu, setLieu] = useState<'' | 'Canada' | 'France'>('')
  const [taux, setTaux] = useState('')
  const [taux1, setTaux1] = useState('')
  const [plancher, setPlancher] = useState('')
  const [manuelle, setManuelle] = useState(false)
  const [valeurM, setValeurM] = useState('')
  const [dateM, setDateM] = useState(aujourdhui())
  const [creditId, setCreditId] = useState('')
  const [confirmer, setConfirmer] = useState(false)
  useEffect(() => {
    if (!existant) return
    setNom(existant.nom); setCategorie(existant.categorie); setOrigine(existant.origine); setCadeauNeuf(existant.cadeauNeuf ?? true)
    setDate(existant.dateAcquisition); setPrix(versTexteMontant(existant.prixAchat)); setDevise(existant.devise); setEtat(existant.etat)
    setPhotoId(existant.photoId); setFactureId(existant.factureId); setNote(existant.note ?? ''); setGarantie(existant.finGarantie ?? '')
    setSerie(existant.numeroSerie ?? ''); setLieu(existant.lieu ?? ''); setTaux(existant.taux?.toString() ?? ''); setTaux1(existant.tauxAnnee1?.toString() ?? '')
    setPlancher(existant.planchePct?.toString() ?? ''); setManuelle(!!existant.valeurManuelle)
    setValeurM(existant.valeurManuelle ? versTexteMontant(existant.valeurManuelle.montant) : ''); setDateM(existant.valeurManuelle?.date ?? aujourdhui())
    setCreditId(existant.creditId ?? '')
  }, [existant?.id]) // eslint-disable-line react-hooks/exhaustive-deps
  if ((id && existant === undefined) || !recurrences || !reglages) return <Page titre="Bien"><div /></Page>

  const pourcent = (t: string) => (t.trim() === '' ? undefined : Number(t.replace(',', '.')))
  const pctValide = (t: string) => { const v = pourcent(t); return v === undefined || (Number.isFinite(v) && v >= 0 && v <= 100) }
  const valeurPrix = lireMontant(prix)
  const valeurManuelle = manuelle ? lireMontant(valeurM) : undefined
  const defaut = tauxDuBien({ categorie }, reglages)
  const credits = recurrences.filter((r) => r.type === 'credit')
  const valide = nom.trim() !== '' && !!valeurPrix && !!date && pctValide(taux) && pctValide(taux1) && pctValide(plancher) && (!manuelle || (valeurManuelle !== null && valeurManuelle !== undefined))

  const enregistrer = async () => {
    if (!valide) return
    const b: NouveauBien = {
      id: existant?.id, nom: nom.trim(), categorie, origine, ...(origine === 'cadeau' ? { cadeauNeuf } : {}), dateAcquisition: date, prixAchat: valeurPrix!, devise,
      etat: existant ? existant.etat : etat, historiqueEtat: existant?.historiqueEtat ?? [], photoId, factureId, note: note.trim() || undefined,
      finGarantie: garantie || undefined, numeroSerie: serie.trim() || undefined, lieu: lieu || undefined,
      taux: pourcent(taux), tauxAnnee1: categorie === 'vehicule' ? pourcent(taux1) : undefined, planchePct: pourcent(plancher),
      valeurManuelle: manuelle && valeurManuelle ? { montant: valeurManuelle, date: dateM } : undefined,
      creditId: creditId || undefined, sortie: existant?.sortie,
    }
    const enr = await enregistrerBien(b)
    if (existant) nav.retour()
    else { nav.retour(); nav.ouvrir(<PageBien id={enr.id} />) }
  }

  return (
    <Page titre={existant ? existant.nom : 'Nouveau bien'} action={
      <button type="button" disabled={!valide} onClick={() => void enregistrer()} className="min-h-[44px] px-1 text-[17px] font-semibold text-bleu disabled:opacity-40">Enregistrer</button>
    }>
      <Groupe>
        <Champ libelle="Nom"><Saisie value={nom} onChange={(e) => setNom(e.target.value)} placeholder="Ex. iPhone 15, Mac, frigo" /></Champ>
        <Champ libelle="Catégorie">
          <Choix value={categorie} onChange={(e) => setCategorie(e.target.value as CategorieBien)}>
            {CATEGORIES_BIENS.map((c) => <option key={c.id} value={c.id}>{c.icone} {c.nom}</option>)}
          </Choix>
        </Champ>
        <Champ libelle="Origine">
          <Choix value={origine} onChange={(e) => setOrigine(e.target.value as OrigineBien)}>
            {ORIGINES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </Choix>
        </Champ>
        {origine === 'cadeau' && (
          <div className="flex min-h-[50px] items-center justify-between gap-3 px-4 py-2">
            <span className="text-[17px] text-encre">Cadeau neuf</span>
            <Interrupteur actif={cadeauNeuf} surChange={setCadeauNeuf} libelle="Cadeau neuf" />
          </div>
        )}
        <Champ libelle="Date d’acquisition"><Saisie type="date" value={date} max={aujourdhui()} onChange={(e) => e.target.value && setDate(e.target.value)} /></Champ>
        <Champ libelle={libellePrix(origine, cadeauNeuf)} aide={valeurPrix === null ? 'Montant invalide' : origine === 'neuf' || (origine === 'cadeau' && cadeauNeuf) ? undefined : 'Vétusté comprise'}>
          <Saisie inputMode="decimal" value={prix} onChange={(e) => setPrix(e.target.value)} placeholder="0,00" />
        </Champ>
        <Champ libelle="Devise">
          <Choix value={devise} onChange={(e) => setDevise(e.target.value as Devise)}><option value="CAD">CAD ($)</option><option value="EUR">EUR (€)</option></Choix>
        </Champ>
        {!existant && (
          <Champ libelle="État">
            <Choix value={etat} onChange={(e) => setEtat(e.target.value as EtatBien)}>{ETATS_BIENS.map((e) => <option key={e.id} value={e.id}>{e.nom}</option>)}</Choix>
          </Champ>
        )}
        <ChampPhoto libelle="Photo" photoId={photoId} surChange={setPhotoId} />
        <Champ libelle="Note"><Saisie value={note} onChange={(e) => setNote(e.target.value)} placeholder="Facultatif" /></Champ>
      </Groupe>

      <TitreSection>Facultatif</TitreSection>
      <Groupe>
        <Champ libelle="Fin de garantie" aide="Alerte 30 jours avant"><Saisie type="date" value={garantie} onChange={(e) => setGarantie(e.target.value)} /></Champ>
        <Champ libelle="Numéro de série"><Saisie value={serie} onChange={(e) => setSerie(e.target.value)} placeholder="Facultatif" autoCapitalize="characters" /></Champ>
        <ChampPhoto libelle="Photo de la facture" photoId={factureId} surChange={setFactureId} />
        <Champ libelle="Lieu">
          <Choix value={lieu} onChange={(e) => setLieu(e.target.value as '' | 'Canada' | 'France')}><option value="">—</option><option value="Canada">Canada</option><option value="France">France</option></Choix>
        </Champ>
        <Champ libelle="Crédit lié">
          <Choix value={creditId} onChange={(e) => setCreditId(e.target.value)}>
            <option value="">Aucun</option>
            {credits.map((r) => <option key={r.id} value={r.id}>{r.libelle}</option>)}
          </Choix>
        </Champ>
      </Groupe>

      <TitreSection>Valeur</TitreSection>
      <Groupe>
        {categorie === 'vehicule' && (
          <Champ libelle="Décote 1re année (%)" aide={pctValide(taux1) ? `Défaut : ${defaut.tauxAnnee1} %` : 'Entre 0 et 100'}>
            <Saisie inputMode="decimal" value={taux1} onChange={(e) => setTaux1(e.target.value)} placeholder={`${defaut.tauxAnnee1}`} />
          </Champ>
        )}
        <Champ libelle={categorie === 'vehicule' ? 'Décote ensuite (%/an)' : 'Décote (%/an)'} aide={pctValide(taux) ? `Défaut de la catégorie : ${defaut.taux} %` : 'Entre 0 et 100'}>
          <Saisie inputMode="decimal" value={taux} onChange={(e) => setTaux(e.target.value)} placeholder={`${defaut.taux}`} />
        </Champ>
        <Champ libelle="Plancher (% du prix)" aide={pctValide(plancher) ? `Défaut : ${PLANCHER_DEFAUT} %` : 'Entre 0 et 100'}>
          <Saisie inputMode="decimal" value={plancher} onChange={(e) => setPlancher(e.target.value)} placeholder={`${PLANCHER_DEFAUT}`} />
        </Champ>
        <div className="flex min-h-[50px] items-center justify-between gap-3 px-4 py-2">
          <span className="text-[17px] text-encre">Valeur saisie à la main</span>
          <Interrupteur actif={manuelle} surChange={setManuelle} libelle="Valeur saisie à la main" />
        </div>
        {manuelle && (<>
          <div className="px-4 py-2"><ChampMontant valeur={valeurM} surChange={setValeurM} devise={devise} libelle="Valeur actuelle" /></div>
          <Champ libelle="À la date du"><Saisie type="date" value={dateM} onChange={(e) => e.target.value && setDateM(e.target.value)} /></Champ>
        </>)}
      </Groupe>
      <p className="px-1 text-[12px] leading-snug text-encre-pale">valeur = prix × (1 − décote)^années × état, jamais sous le plancher. Une valeur saisie à la main remplace ce calcul.</p>

      {existant && (!confirmer ? (
        <Bouton variante="danger" onClick={() => setConfirmer(true)}>Supprimer le bien</Bouton>
      ) : (
        <div className="flex gap-2">
          <Bouton variante="secondaire" onClick={() => setConfirmer(false)}>Garder</Bouton>
          <Bouton variante="danger" className="!bg-rouge !text-white" onClick={async () => { await supprimerBien(existant.id); nav.retour(); nav.retour() }}>Supprimer</Bouton>
        </div>
      ))}
    </Page>
  )
}
