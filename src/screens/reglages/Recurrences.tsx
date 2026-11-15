import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useState } from 'react'
import { enregistrerRecurrence, supprimerRecurrence } from '../../db/actions'
import { db } from '../../db/db'
import { Bouton, Champ, Choix, Groupe, Interrupteur, Saisie } from '../../components/formulaire'
import { IconeChevron } from '../../components/Icones'
import { TitreSection } from '../../components/ui'
import { analyserMontant, formaterMontant } from '../../domain/argent'
import { categoriesPrincipales, sousCategories } from '../../domain/categories'
import { aujourdhui, libelleCourt } from '../../domain/dates'
import {
  JOUR_FIN_DE_MOIS, capitalRestant, lendemain, equivalentMensuel, libelleFrequence, mensualitesRestantes, prochainesEcheances, progressionCredit,
} from '../../domain/recurrences'
import type { Devise, Frequence, Operation, Recurrence, TypeRecurrence } from '../../domain/types'
import { indexer, useCategories, useComptes, useOperations, useRecurrences } from '../../hooks/donnees'
import { Page, useNav } from '../../nav/Navigation'

export type Genre = 'charges' | 'revenus'

const versTexte = (c: number) => (c / 100).toFixed(2).replace('.', ',')

function BarreProgression({ valeur }: { valeur: number }) {
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-trait" role="progressbar" aria-valuenow={Math.round(valeur * 100)} aria-valuemin={0} aria-valuemax={100}>
      <div className="h-full rounded-full bg-vert" style={{ width: `${valeur * 100}%` }} />
    </div>
  )
}

export function InfosCredit({ rec, operations, devise }: { rec: Recurrence; operations: Operation[]; devise: Devise }) {
  const restant = capitalRestant(rec, operations)
  const nb = mensualitesRestantes(rec, restant, aujourdhui())
  const prog = progressionCredit(rec.capitalInitial, restant)
  return (
    <div className="mt-2 space-y-1.5">
      {prog !== undefined && <BarreProgression valeur={prog} />}
      <p className="flex justify-between text-[13px] text-encre-douce">
        <span>{restant !== undefined ? `Reste ${formaterMontant(restant, devise)}` : 'Capital non renseigné'}</span>
        <span>{nb !== undefined ? `${nb} mensualité${nb > 1 ? 's' : ''} restante${nb > 1 ? 's' : ''}` : ''}</span>
      </p>
    </div>
  )
}

export function ListeRecurrences({ genre }: { genre: Genre }) {
  const nav = useNav()
  const recurrences = useRecurrences()
  const comptes = useComptes(true)
  const operations = useOperations()
  if (!recurrences || !comptes || !operations) return <Page titre="…"><div /></Page>

  const mapComptes = indexer(comptes)
  const types: TypeRecurrence[] = genre === 'charges' ? ['charge_fixe', 'credit'] : ['revenu']
  const liste = recurrences.filter((r) => types.includes(r.type))
  const date = aujourdhui()

  // totaux mensuels par devise (actives seulement)
  const totaux = new Map<Devise, number>()
  for (const r of liste) {
    if (!r.actif) continue
    const d = mapComptes.get(r.compteId)?.devise
    if (d) totaux.set(d, (totaux.get(d) ?? 0) + equivalentMensuel(r))
  }

  const ligne = (r: Recurrence) => {
    const compte = mapComptes.get(r.compteId)
    const prochaine = r.actif ? prochainesEcheances(r, lendemain(r.derniereEcheanceGeneree ?? date), 1)[0] : undefined
    return (
      <button key={r.id} type="button" onClick={() => nav.ouvrir(<EditionRecurrence id={r.id} genre={genre} />)}
        className={`block w-full px-4 py-3 text-left active:bg-fond ${r.actif ? '' : 'opacity-50'}`}>
        <span className="flex items-center gap-3">
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[16px] font-medium text-encre">{r.libelle}</span>
            <span className="block truncate text-[13px] text-encre-pale">
              {libelleFrequence(r)} · {r.moyenPaiement === 'carte' && r.type !== 'revenu' ? 'carte' : compte?.nom.split(' – ')[0]}
              {!r.actif ? ' · en pause' : prochaine ? ` · prochain : ${libelleCourt(prochaine)}` : ' · terminé'}
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

  const charges = liste.filter((r) => r.type === 'charge_fixe')
  const credits = liste.filter((r) => r.type === 'credit')
  const titre = genre === 'charges' ? 'Charges fixes et crédits' : 'Revenus récurrents'

  return (
    <Page titre={titre} action={
      <button type="button" onClick={() => nav.ouvrir(<EditionRecurrence genre={genre} />)} className="min-h-[44px] px-1 text-[17px] font-semibold text-bleu">Ajouter</button>
    }>
      {liste.length === 0 && (
        <p className="rounded-carte bg-white p-5 text-center text-[15px] leading-snug text-encre-douce shadow-carte">
          {genre === 'charges'
            ? 'Ajoute ton loyer, tes assurances, abonnements et crédits : ils seront prélevés automatiquement à leur date.'
            : 'Ajoute ton salaire et ton remboursement kilométrique : ils seront crédités automatiquement à leur date.'}
        </p>
      )}
      {genre === 'charges' ? (
        <>
          {charges.length > 0 && <><TitreSection>Charges fixes</TitreSection><Groupe>{charges.map(ligne)}</Groupe></>}
          {credits.length > 0 && <><TitreSection>Crédits</TitreSection><Groupe>{credits.map(ligne)}</Groupe></>}
        </>
      ) : liste.length > 0 && <Groupe>{liste.map(ligne)}</Groupe>}
      {totaux.size > 0 && (
        <p className="px-1 text-[14px] text-encre-douce">
          Total par mois : {[...totaux].map(([d, t]) => formaterMontant(t, d)).join(' + ')}
          {liste.some((r) => r.frequence === '14_jours') && <span className="text-encre-pale"> (paies aux 2 semaines lissées sur l’année)</span>}
        </p>
      )}
    </Page>
  )
}

const JOURS = Array.from({ length: 31 }, (_, i) => i + 1)
const libelleJour = (j: number) => (j === JOUR_FIN_DE_MOIS ? 'Dernier jour du mois' : `Le ${j === 1 ? '1er' : j}`)

export function EditionRecurrence({ id, genre }: { id?: string; genre: Genre }) {
  const nav = useNav()
  const existante = useLiveQuery(async () => (id ? (await db.recurrences.get(id)) ?? null : null), [id])
  const comptes = useComptes()
  const categories = useCategories()
  const operations = useOperations()

  const [type, setType] = useState<TypeRecurrence>(genre === 'revenus' ? 'revenu' : 'charge_fixe')
  const [libelle, setLibelle] = useState('')
  const [montant, setMontant] = useState('')
  const [compteId, setCompteId] = useState('')
  const [moyen, setMoyen] = useState<'compte' | 'carte'>('compte')
  const [frequence, setFrequence] = useState<Frequence>(genre === 'revenus' ? '14_jours' : 'mensuel')
  const [jour1, setJour1] = useState(1)
  const [jour2, setJour2] = useState(JOUR_FIN_DE_MOIS)
  const [dateDebut, setDateDebut] = useState(aujourdhui())
  const [avecFin, setAvecFin] = useState(false)
  const [dateFin, setDateFin] = useState('')
  const [categorieId, setCategorieId] = useState('')
  const [sousCategorieId, setSousCategorieId] = useState('')
  const [actif, setActif] = useState(true)
  const [capital, setCapital] = useState('')
  const [emprunte, setEmprunte] = useState('')
  const [taux, setTaux] = useState('')
  const [confirmer, setConfirmer] = useState(false)

  useEffect(() => {
    if (!existante) return
    setType(existante.type); setLibelle(existante.libelle); setMontant(versTexte(existante.montant)); setCompteId(existante.compteId)
    setMoyen(existante.moyenPaiement); setFrequence(existante.frequence); setJour1(existante.jours[0] ?? 1); setJour2(existante.jours[1] ?? JOUR_FIN_DE_MOIS)
    setDateDebut(existante.dateDebut); setAvecFin(!!existante.dateFin); setDateFin(existante.dateFin ?? '')
    setCategorieId(existante.categorieId ?? ''); setSousCategorieId(existante.sousCategorieId ?? ''); setActif(existante.actif)
    setTaux(existante.tauxAnnuel !== undefined ? String(existante.tauxAnnuel).replace('.', ',') : '')
    setEmprunte(existante.capitalInitial !== undefined ? versTexte(existante.capitalInitial) : '')
  }, [existante?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // Le capital affiché est le capital restant aujourd'hui (référence moins mensualités prélevées).
  useEffect(() => {
    if (!existante || !operations) return
    const r = capitalRestant(existante, operations)
    setCapital(r !== undefined ? versTexte(r) : '')
  }, [existante?.id, operations === undefined]) // eslint-disable-line react-hooks/exhaustive-deps

  if ((id && existante === undefined) || !comptes || !categories || !operations) return <Page titre="…"><div /></Page>

  const comptesPossibles = comptes.filter((c) => c.type !== 'carte_credit')
  const compteEffectif = compteId || comptesPossibles.find((c) => c.inclusBudgetJournalier)?.id || comptesPossibles[0]?.id || ''
  const compte = comptes.find((c) => c.id === compteEffectif)
  const carte = comptes.find((c) => c.type === 'carte_credit' && c.compteRemboursementId === compteEffectif)
  const estCredit = type === 'credit'
  const estRevenu = type === 'revenu'

  const valeur = analyserMontant(montant)
  const valeurCapital = capital.trim() ? analyserMontant(capital) : undefined
  const valeurEmprunte = emprunte.trim() ? analyserMontant(emprunte) : undefined
  const valeurTaux = taux.trim() ? Number(taux.replace(',', '.')) : undefined
  const tauxValide = valeurTaux === undefined || (Number.isFinite(valeurTaux) && valeurTaux >= 0 && valeurTaux < 50)
  const jours = frequence === 'mensuel' ? [jour1] : frequence === 'deux_dates_par_mois' ? [Math.min(jour1, jour2), Math.max(jour1, jour2)] : []
  const finRequise = estCredit
  const valide = libelle.trim() !== '' && !!valeur && !!compteEffectif && valeurCapital !== null && valeurEmprunte !== null && tauxValide
    && (!(avecFin || finRequise) || (dateFin !== '' && dateFin >= dateDebut))
    && (frequence !== 'deux_dates_par_mois' || jour1 !== jour2)

  const brouillon: Recurrence = {
    id: existante?.id ?? 'brouillon', type, libelle: libelle.trim(), montant: valeur ?? 0, compteId: compteEffectif,
    moyenPaiement: !estRevenu && moyen === 'carte' && carte ? 'carte' : 'compte', carteId: !estRevenu && moyen === 'carte' && carte ? carte.id : undefined,
    categorieId: estRevenu ? undefined : categorieId || undefined, sousCategorieId: estRevenu ? undefined : sousCategorieId || undefined,
    frequence, jours, dateDebut, dateFin: avecFin || finRequise ? dateFin || undefined : undefined, actif,
    capitalRestantDu: estCredit ? valeurCapital ?? undefined : undefined,
    capitalInitial: estCredit ? valeurEmprunte ?? existante?.capitalInitial : undefined,
    capitalReferenceDate: existante?.capitalReferenceDate,
    tauxAnnuel: estCredit ? valeurTaux : undefined,
    derniereEcheanceGeneree: existante?.derniereEcheanceGeneree,
  }
  const apercu = valide ? prochainesEcheances(brouillon, lendemain(aujourdhui()), 3) : []

  const enregistrer = async () => {
    if (!valide) return
    // capital inchangé à l'écran → on garde la référence existante (sinon il deviendrait la nouvelle référence)
    const capitalAffiche = existante ? capitalRestant(existante, operations) : undefined
    const aSauver = { ...brouillon, id: existante?.id }
    if (existante && estCredit && valeurCapital === capitalAffiche) aSauver.capitalRestantDu = existante.capitalRestantDu
    await enregistrerRecurrence(aSauver)
    nav.retour()
  }

  return (
    <Page titre={existante ? existante.libelle : estRevenu ? 'Nouveau revenu' : 'Nouvelle charge'} retourLibelle="Retour" action={
      <button type="button" onClick={() => void enregistrer()} disabled={!valide} className="min-h-[44px] px-1 text-[17px] font-semibold text-bleu disabled:opacity-40">Enregistrer</button>
    }>
      {genre === 'charges' && !existante && (
        <div className="flex rounded-[10px] bg-trait/70 p-0.5">
          {(['charge_fixe', 'credit'] as const).map((t) => (
            <button key={t} type="button" onClick={() => { setType(t); setFrequence('mensuel') }}
              className={`min-h-[36px] flex-1 rounded-[8px] text-[15px] font-semibold ${type === t ? 'bg-white text-encre shadow-sm' : 'text-encre-douce'}`}>
              {t === 'charge_fixe' ? 'Charge fixe' : 'Crédit'}
            </button>
          ))}
        </div>
      )}

      <Groupe>
        <Champ libelle="Libellé"><Saisie value={libelle} onChange={(e) => setLibelle(e.target.value)} placeholder={estRevenu ? 'Ex. Salaire' : estCredit ? 'Ex. Crédit auto' : 'Ex. Loyer'} /></Champ>
        <Champ libelle={estCredit ? 'Mensualité' : 'Montant'} aide={montant && !valeur ? 'Montant invalide' : undefined}>
          <span className="flex items-center gap-1">
            <Saisie inputMode="decimal" value={montant} onChange={(e) => setMontant(e.target.value)} placeholder="0,00" />
            <span className="text-[17px] text-encre-douce">{compte?.devise === 'EUR' ? '€' : '$'}</span>
          </span>
        </Champ>
        <Champ libelle="Compte">
          <Choix value={compteEffectif} onChange={(e) => { setCompteId(e.target.value); setMoyen('compte') }}>
            {comptesPossibles.map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}
          </Choix>
        </Champ>
        {!estRevenu && carte && (
          <Champ libelle="Paiement">
            <Choix value={moyen} onChange={(e) => setMoyen(e.target.value as 'compte' | 'carte')}>
              <option value="compte">Prélevé sur le compte</option>
              <option value="carte">Payé par carte de crédit</option>
            </Choix>
          </Champ>
        )}
      </Groupe>

      <TitreSection>Quand</TitreSection>
      <Groupe>
        {estRevenu && (
          <Champ libelle="Fréquence">
            <Choix value={frequence} onChange={(e) => setFrequence(e.target.value as Frequence)}>
              <option value="14_jours">Toutes les 2 semaines</option>
              <option value="deux_dates_par_mois">Deux dates par mois</option>
              <option value="mensuel">Une fois par mois</option>
            </Choix>
          </Champ>
        )}
        {frequence === '14_jours' ? (
          <Champ libelle="Date d’un versement" aide="Les suivants : tous les 14 jours">
            <Saisie type="date" value={dateDebut} onChange={(e) => e.target.value && setDateDebut(e.target.value)} />
          </Champ>
        ) : (
          <>
            <Champ libelle={frequence === 'deux_dates_par_mois' ? '1re date' : 'Jour du mois'}>
              <Choix value={jour1} onChange={(e) => setJour1(Number(e.target.value))}>{JOURS.map((j) => <option key={j} value={j}>{libelleJour(j)}</option>)}</Choix>
            </Champ>
            {frequence === 'deux_dates_par_mois' && (
              <Champ libelle="2e date">
                <Choix value={jour2} onChange={(e) => setJour2(Number(e.target.value))}>{JOURS.map((j) => <option key={j} value={j}>{libelleJour(j)}</option>)}</Choix>
              </Champ>
            )}
            <Champ libelle="À partir du"><Saisie type="date" value={dateDebut} onChange={(e) => e.target.value && setDateDebut(e.target.value)} /></Champ>
          </>
        )}
        {!finRequise && (
          <div className="flex min-h-[50px] items-center justify-between gap-3 px-4 py-2">
            <span className="text-[17px] text-encre">Date de fin</span>
            <Interrupteur actif={avecFin} surChange={setAvecFin} libelle="Date de fin" />
          </div>
        )}
        {(avecFin || finRequise) && (
          <Champ libelle={estCredit ? 'Dernière mensualité' : 'Jusqu’au'} aide={dateFin && dateFin < dateDebut ? 'Avant la date de début' : undefined}>
            <Saisie type="date" value={dateFin} min={dateDebut} onChange={(e) => setDateFin(e.target.value)} />
          </Champ>
        )}
      </Groupe>
      {frequence === 'mensuel' && jour1 > 28 && (
        <p className="px-1 text-[13px] text-encre-pale">Les mois plus courts, l’échéance tombe le dernier jour du mois.</p>
      )}

      {estCredit && (
        <>
          <TitreSection>Crédit</TitreSection>
          <Groupe>
            <Champ libelle="Capital restant dû" aide={valeurCapital === null ? 'Montant invalide' : 'Aujourd’hui ; modifiable à tout moment'}>
              <Saisie inputMode="decimal" value={capital} onChange={(e) => setCapital(e.target.value)} placeholder="Facultatif" />
            </Champ>
            <Champ libelle="Montant emprunté" aide={valeurEmprunte === null ? 'Montant invalide' : 'Pour la barre de progression'}>
              <Saisie inputMode="decimal" value={emprunte} onChange={(e) => setEmprunte(e.target.value)} placeholder="Facultatif" />
            </Champ>
            <Champ libelle="Taux annuel" aide={!tauxValide ? 'Taux invalide' : 'Facultatif'}>
              <span className="flex items-center gap-1">
                <Saisie inputMode="decimal" value={taux} onChange={(e) => setTaux(e.target.value)} placeholder="Ex. 6,9" />
                <span className="text-[17px] text-encre-douce">%</span>
              </span>
            </Champ>
          </Groupe>
          <p className="px-1 text-[13px] leading-snug text-encre-pale">
            À chaque mensualité, le capital baisse de la mensualité moins les intérêts du mois si le taux est connu, sinon de la mensualité entière.
          </p>
          {existante && compte && <div className="rounded-carte bg-white px-4 py-3 shadow-carte"><InfosCredit rec={existante} operations={operations} devise={compte.devise} /></div>}
        </>
      )}

      {!estRevenu && (
        <>
          <TitreSection>Catégorie</TitreSection>
          <Groupe>
            <Champ libelle="Catégorie">
              <Choix value={categorieId} onChange={(e) => { setCategorieId(e.target.value); setSousCategorieId('') }}>
                <option value="">Aucune</option>
                {categoriesPrincipales(categories).map((c) => <option key={c.id} value={c.id}>{c.icone} {c.nom}</option>)}
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
        </>
      )}

      <Groupe>
        <div className="flex min-h-[50px] items-center justify-between gap-3 px-4 py-2">
          <span className="text-[17px] text-encre">{actif ? 'Active' : 'En pause'}</span>
          <Interrupteur actif={actif} surChange={setActif} libelle="Active" />
        </div>
      </Groupe>

      {apercu.length > 0 && actif && (
        <div className="rounded-carte bg-bleu-pale px-4 py-3 text-[14px] leading-snug text-bleu-fonce">
          <b>Prochaines échéances :</b> {apercu.map(libelleCourt).join(', ')}
          {!existante && <span className="block pt-1 text-encre-douce">Les échéances jusqu’à aujourd’hui inclus ne sont pas ajoutées : ton solde actuel les inclut déjà.</span>}
        </div>
      )}

      {existante && (!confirmer ? (
        <Bouton variante="danger" onClick={() => setConfirmer(true)}>Supprimer</Bouton>
      ) : (
        <>
          <p className="px-1 text-[14px] text-encre-douce">Les opérations déjà prélevées sont conservées. Pour arrêter temporairement, mets plutôt en pause.</p>
          <div className="flex gap-2">
            <Bouton variante="secondaire" onClick={() => setConfirmer(false)}>Garder</Bouton>
            <Bouton variante="danger" className="!bg-rouge !text-white" onClick={async () => { await supprimerRecurrence(existante.id); nav.retour() }}>Supprimer</Bouton>
          </div>
        </>
      ))}
    </Page>
  )
}
