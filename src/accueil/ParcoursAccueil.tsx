import { useEffect, useState, type ReactNode } from 'react'
import { choisirComptesBudget, enregistrerCompte, enregistrerRecurrence } from '../db/actions'
import { modifierReglages } from "../db/db"
import { Bouton, Champ, Choix, Groupe, Interrupteur, Saisie } from '../components/formulaire'
import { lireMontant } from '../budget/ChampMontant'
import { formaterMontant } from '../domain/argent'
import { aujourdhui } from '../domain/dates'
import type { Devise, Frequence, TypeCompte } from '../domain/types'
import { useComptes } from '../hooks/donnees'

/**
 * Parcours d'accueil d'un nouvel utilisateur (après la création du code) : comptes, compte du budget du jour
 * et carte liée, budget par période, paie. Rien n'est prérempli : l'app ne suppose rien de la personne.
 */

const COULEURS = ['#2F6FED', '#00874E', '#008C8C', '#7A5AF8', '#EC4899', '#F97316', '#3D4A5C']
const TYPES: Record<TypeCompte, string> = { cheque: 'Compte courant', carte_credit: 'Carte de crédit', epargne: 'Épargne' }

function Etape({ numero, titre, texte, children }: { numero: number; titre: string; texte: ReactNode; children: ReactNode }) {
  return (
    <main className="mx-auto flex min-h-full w-full max-w-md flex-col gap-3 px-4 pb-10 pt-safe">
      <div className="pt-6">
        <p className="text-[13px] font-semibold uppercase tracking-wide text-bleu">Étape {numero} sur 4</p>
        <h1 className="text-[28px] font-bold leading-tight text-encre">{titre}</h1>
        <p className="mt-1 text-[15px] leading-snug text-encre-douce">{texte}</p>
      </div>
      {children}
    </main>
  )
}

export function ParcoursAccueil({ surTermine }: { surTermine: () => void }) {
  const [etape, setEtape] = useState(1)
  const comptes = useComptes() ?? []
  const courants = comptes.filter((c) => c.type !== 'carte_credit')
  const cartes = comptes.filter((c) => c.type === 'carte_credit')
  useEffect(() => { window.scrollTo(0, 0) }, [etape])

  if (etape === 1) return (
    <Etape numero={1} titre="Tes comptes" texte="Ajoute chaque compte que tu veux suivre, avec son solde du jour. Chaque compte garde sa devise : aucune conversion.">
      {comptes.length > 0 && (
        <Groupe>
          {comptes.map((c) => (
            <div key={c.id} className="flex min-h-[52px] items-center gap-3 px-4 py-2">
              <span className="h-3 w-3 rounded-full" style={{ background: c.couleur }} />
              <span className="min-w-0 flex-1"><span className="block truncate text-[16px] text-encre">{c.nom}</span>
                <span className="block text-[13px] text-encre-pale">{TYPES[c.type]} · {c.devise}</span></span>
              <span className="text-[15px] font-semibold text-encre">
                {c.type === 'carte_credit' ? `Dû : ${formaterMontant(-c.soldeDepart, c.devise)}` : formaterMontant(c.soldeDepart, c.devise)}
              </span>
            </div>
          ))}
        </Groupe>
      )}
      <NouveauCompte ordre={comptes.length} couleur={COULEURS[comptes.length % COULEURS.length]} premier={comptes.length === 0} />
      <Bouton disabled={courants.length === 0} onClick={() => setEtape(2)}>Continuer</Bouton>
      {courants.length === 0 && <p className="text-center text-[13px] text-encre-pale">Ajoute au moins un compte courant pour continuer.</p>}
    </Etape>
  )

  if (etape === 2) return <ChoixBudget courants={courants} cartes={cartes} surSuite={() => setEtape(3)} />
  if (etape === 3) return <Budget devise={(comptes.find((c) => c.inclusBudgetJournalier && c.type !== 'carte_credit') ?? courants[0])?.devise ?? 'CAD'} surSuite={() => setEtape(4)} />
  return <Paie compteId={(comptes.find((c) => c.inclusBudgetJournalier && c.type !== 'carte_credit') ?? courants[0])?.id} surFin={surTermine} />
}

function NouveauCompte({ ordre, couleur, premier }: { ordre: number; couleur: string; premier: boolean }) {
  const [nom, setNom] = useState('')
  const [type, setType] = useState<TypeCompte>('cheque')
  const [devise, setDevise] = useState<Devise>('CAD')
  const [solde, setSolde] = useState('')
  const [date, setDate] = useState(aujourdhui())
  const negatif = /^\s*[-−]/.test(solde)
  const valeur = lireMontant(solde.replace(/^\s*[-−]/, ''))
  const estCarte = type === 'carte_credit'
  const valide = nom.trim() !== '' && valeur !== null

  const ajouter = async () => {
    if (!valide) return
    const v = negatif ? -valeur! : valeur!
    await enregistrerCompte({ nom: nom.trim(), type, devise, couleur, soldeDepart: estCarte ? -v : v, dateDepart: date, inclusBudgetJournalier: false, archive: false, ordre })
    setNom(''); setSolde(''); setType('cheque')
  }

  return (
    <section aria-label="Nouveau compte">
      <p className="px-1 pb-1 text-[13px] font-semibold uppercase tracking-wide text-encre-pale">{premier ? 'Premier compte' : 'Ajouter un autre compte'}</p>
      <Groupe>
        <Champ libelle="Nom"><Saisie value={nom} onChange={(e) => setNom(e.target.value)} placeholder="Ex. Compte courant" /></Champ>
        <Champ libelle="Type">
          <Choix value={type} onChange={(e) => setType(e.target.value as TypeCompte)}>
            {Object.entries(TYPES).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </Choix>
        </Champ>
        <Champ libelle="Devise">
          <Choix value={devise} onChange={(e) => setDevise(e.target.value as Devise)}>
            <option value="CAD">CAD ($)</option><option value="EUR">EUR (€)</option>
          </Choix>
        </Champ>
        <Champ libelle={estCarte ? 'Montant dû' : 'Solde'} aide={solde && valeur === null ? 'Montant invalide' : estCarte ? 'Ce que tu dois sur la carte' : 'Un « - » devant si à découvert'}>
          <Saisie inputMode="decimal" value={solde} onChange={(e) => setSolde(e.target.value)} placeholder="0,00" />
        </Champ>
        <Champ libelle="À la date du"><Saisie type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} /></Champ>
      </Groupe>
      <Bouton variante="secondaire" className="mt-2" disabled={!valide} onClick={() => void ajouter()}>Ajouter ce compte</Bouton>
    </section>
  )
}

function ChoixBudget({ courants, cartes, surSuite }: { courants: { id: string; nom: string }[]; cartes: { id: string; nom: string }[]; surSuite: () => void }) {
  const [compteId, setCompteId] = useState(courants[0]?.id ?? '')
  const [carteId, setCarteId] = useState(cartes[0]?.id ?? '')
  return (
    <Etape numero={2} titre="Le budget du jour" texte="Chaque jour, l’app te dit combien tu peux encore dépenser sur ce compte. Les achats faits avec la carte liée comptent aussi.">
      <Groupe>
        <Champ libelle="Compte du quotidien">
          <Choix value={compteId} onChange={(e) => setCompteId(e.target.value)}>{courants.map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}</Choix>
        </Champ>
        <Champ libelle="Carte de crédit liée" aide={cartes.length === 0 ? 'Aucune carte ajoutée' : 'Remboursée depuis ce compte'}>
          <Choix value={carteId} onChange={(e) => setCarteId(e.target.value)}>
            <option value="">Aucune</option>
            {cartes.map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}
          </Choix>
        </Champ>
      </Groupe>
      <Bouton onClick={async () => { await choisirComptesBudget(compteId, carteId || null); surSuite() }}>Continuer</Bouton>
    </Etape>
  )
}

function Budget({ devise, surSuite }: { devise: Devise; surSuite: () => void }) {
  const [texte, setTexte] = useState('')
  const v = lireMontant(texte)
  return (
    <Etape numero={3} titre="Ton budget par période" texte="Le montant que tu t’autorises pour les dépenses du quotidien entre deux paies (hors loyer et charges fixes). Il sera proposé à chaque paie, et modifiable.">
      <Groupe>
        <Champ libelle="Budget par période" aide={texte && v === null ? 'Montant invalide' : undefined}>
          <span className="flex items-center gap-1">
            <Saisie inputMode="decimal" value={texte} onChange={(e) => setTexte(e.target.value)} placeholder="0,00" aria-label="Budget par période" />
            <span className="text-[17px] text-encre-douce">{devise === 'EUR' ? '€' : '$'}</span>
          </span>
        </Champ>
      </Groupe>
      <Bouton disabled={!v} onClick={async () => { await modifierReglages({ budgetParPeriode: v! }); surSuite() }}>Continuer</Bouton>
    </Etape>
  )
}

function Paie({ compteId, surFin }: { compteId?: string; surFin: () => void }) {
  const [libelle, setLibelle] = useState('')
  const [montant, setMontant] = useState('')
  const [frequence, setFrequence] = useState<Frequence>('14_jours')
  const [date, setDate] = useState(aujourdhui())
  const [jour, setJour] = useState(1)
  const [aConfirmer, setAConfirmer] = useState(true)
  const v = lireMontant(montant)
  const valide = !!compteId && libelle.trim() !== '' && !!v
  const ajouter = async () => {
    if (!valide) return
    await enregistrerRecurrence({
      type: 'revenu', libelle: libelle.trim(), montant: v!, compteId: compteId!, moyenPaiement: 'compte', frequence,
      jours: frequence === 'mensuel' ? [jour] : frequence === 'deux_dates_par_mois' ? [15, 31] : [], dateDebut: date, actif: true, aConfirmer,
    })
    surFin()
  }
  return (
    <Etape numero={4} titre="Ta paie" texte="Chaque période du budget va d’une paie à la suivante. Tu pourras la modifier ou en ajouter d’autres dans Réglages → Revenus récurrents.">
      <Groupe>
        <Champ libelle="Libellé"><Saisie value={libelle} onChange={(e) => setLibelle(e.target.value)} placeholder="Ex. Salaire" /></Champ>
        <Champ libelle="Montant habituel"><Saisie inputMode="decimal" value={montant} onChange={(e) => setMontant(e.target.value)} placeholder="0,00" /></Champ>
        <Champ libelle="Fréquence">
          <Choix value={frequence} onChange={(e) => setFrequence(e.target.value as Frequence)}>
            <option value="14_jours">Toutes les 2 semaines</option>
            <option value="deux_dates_par_mois">Le 15 et le dernier jour</option>
            <option value="mensuel">Une fois par mois</option>
          </Choix>
        </Champ>
        {frequence === 'mensuel' ? (
          <Champ libelle="Jour du mois">
            <Choix value={jour} onChange={(e) => setJour(Number(e.target.value))}>{Array.from({ length: 31 }, (_, i) => i + 1).map((j) => <option key={j} value={j}>{j === 31 ? 'Dernier jour' : `Le ${j}`}</option>)}</Choix>
          </Champ>
        ) : (
          <Champ libelle={frequence === '14_jours' ? 'Date d’une paie' : 'À partir du'}><Saisie type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} /></Champ>
        )}
        <div className="flex min-h-[50px] items-center justify-between gap-3 px-4 py-2">
          <span className="text-[17px] text-encre">Montant à confirmer</span>
          <Interrupteur actif={aConfirmer} surChange={setAConfirmer} libelle="Montant à confirmer" />
        </div>
      </Groupe>
      <p className="px-1 text-[13px] leading-snug text-encre-pale">« Montant à confirmer » : le jour de la paie, l’app te demande le montant reçu au lieu de le créditer automatiquement.</p>
      <Bouton disabled={!valide} onClick={() => void ajouter()}>Terminer</Bouton>
      <Bouton variante="secondaire" onClick={surFin}>Passer cette étape</Bouton>
    </Etape>
  )
}

