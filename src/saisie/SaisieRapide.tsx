import { subDays } from 'date-fns'
import { useMemo, useState } from 'react'
import { confirmerEcheance, enregistrerOperation } from '../db/actions'
import { modifierReglages } from '../db/db'
import { analyserMontant } from '../domain/argent'
import { trierParUsage } from '../domain/categories'
import { aujourdhui, libelleJour, versISO } from '../domain/dates'
import { echeanceARattacher } from '../domain/recurrences'
import type { Categorie, Operation } from '../domain/types'
import { useCategories, useComptes, useOperations, useRecurrences, useReglages } from '../hooks/donnees'
import { PaveNumerique } from './PaveNumerique'
import { Confirmation } from './Confirmation'
import { FormulaireRevenu, FormulaireVirement, GrilleCategories } from './modes'

type Mode = 'depense' | 'revenu' | 'virement'

/** Saisie rapide : montant, catégorie, c'est enregistré. Le reste est facultatif. */
export function SaisieRapide({ surFermer }: { surFermer: () => void }) {
  const comptes = useComptes()
  const categories = useCategories()
  const operations = useOperations()
  const reglages = useReglages()
  const recurrences = useRecurrences()
  const [rattacher, setRattacher] = useState(true)

  const [mode, setMode] = useState<Mode>('depense')
  const [valeur, setValeur] = useState('')
  const [date, setDate] = useState(aujourdhui())
  const [compteChoisi, setCompteChoisi] = useState<string | null>(null)
  const [moyenChoisi, setMoyenChoisi] = useState<'debit' | 'carte' | null>(null)
  const [libelleRevenu, setLibelleRevenu] = useState('')
  const [destinationChoisie, setDestinationChoisie] = useState<string | null>(null)
  const [recu, setRecu] = useState('')
  const [secoue, setSecoue] = useState(false)
  const [enregistree, setEnregistree] = useState<Operation | null>(null)

  const comptesSaisie = (comptes ?? []).filter((c) => c.type !== 'carte_credit')
  const compteId = compteChoisi ?? comptesSaisie.find((c) => c.inclusBudgetJournalier)?.id ?? comptesSaisie[0]?.id
  const compte = comptesSaisie.find((c) => c.id === compteId)
  const carte = (comptes ?? []).find((c) => c.type === 'carte_credit' && c.compteRemboursementId === compteId)
  const moyen = carte && mode === 'depense' ? (moyenChoisi ?? reglages?.dernierMoyenPaiement ?? 'debit') : 'debit'
  const devise = compte?.devise ?? 'CAD'
  const destinations = comptesSaisie.filter((c) => c.id !== compteId)
  const destinationId = destinationChoisie && destinationChoisie !== compteId ? destinationChoisie : destinations[0]?.id
  const destination = destinations.find((c) => c.id === destinationId)
  const deviseDiff = !!destination && destination.devise !== devise

  const grille = useMemo(
    () => trierParUsage(categories ?? [], operations ?? [], versISO(subDays(new Date(), 90))),
    [categories, operations],
  )

  if (!comptes || !categories || !reglages) return <div className="h-[560px]" />

  if (enregistree) {
    return <Confirmation op={enregistree} categories={categories} surFermer={surFermer} surMaj={setEnregistree} devise={devise}
      nomCompte={(comptes.find((c) => c.id === enregistree.compteId) ?? compte)?.nom ?? ''} />
  }

  const montant = analyserMontant(valeur)
  const refuser = () => { setSecoue(true); navigator.vibrate?.(60); setTimeout(() => setSecoue(false), 420) }

  const montantRecu = deviseDiff ? analyserMontant(recu) : montant
  // Paie « à confirmer » proche de cette date sur ce compte : on propose de la rattacher (pas de double compte)
  const echeance = mode === 'revenu' && compteId ? echeanceARattacher(recurrences ?? [], compteId, date) : undefined

  const enregistrer = async (categorie?: Categorie) => {
    if (!montant || !compteId) return refuser()
    if (mode === 'virement') {
      if (!destinationId || !montantRecu) return refuser()
      setEnregistree(await enregistrerOperation({
        date, montant, type: 'virement', compteId, compteDestinationId: destinationId,
        montantRecu: deviseDiff ? montantRecu : undefined, note: libelleRevenu.trim() || undefined,
      }))
      return
    }
    if (mode === 'revenu' && echeance && rattacher) {
      const op = await confirmerEcheance(echeance.recurrence.id, echeance.date, montant, date)
      if (op) setEnregistree(op)
      return
    }
    const op = await enregistrerOperation({
      date, montant, type: mode,
      compteId: mode === 'depense' && moyen === 'carte' && carte ? carte.id : compteId,
      categorieId: categorie?.id,
      note: mode === 'revenu' ? libelleRevenu.trim() || undefined : undefined,
    })
    if (mode === 'depense' && carte && moyen !== reglages.dernierMoyenPaiement) void modifierReglages({ dernierMoyenPaiement: moyen })
    setEnregistree(op)
  }

  const puce = 'relative flex min-h-[34px] shrink-0 items-center gap-1 rounded-full bg-white px-2.5 text-[14px] font-medium text-encre shadow-carte'
  // « Banque – compte chèque » → « Banque » (le nom complet reste dans la liste de choix)
  const nomCourt = (compte?.nom ?? '').split(' – ')[0]

  return (
    <div className="flex flex-col gap-2">
      <div className="mx-auto flex rounded-[10px] bg-trait/70 p-0.5" role="tablist">
        {(['depense', 'revenu', 'virement'] as Mode[]).map((m) => (
          <button key={m} type="button" role="tab" aria-selected={mode === m} onClick={() => setMode(m)}
            className={`min-h-[32px] rounded-[8px] px-4 text-[14px] font-semibold ${mode === m ? 'bg-white text-encre shadow-sm' : 'text-encre-douce'}`}>
            {m === 'depense' ? 'Dépense' : m === 'revenu' ? 'Revenu' : 'Virement'}
          </button>
        ))}
      </div>

      <div className={`text-center text-[40px] font-bold leading-none tracking-tight ${secoue ? 'animate-secousse' : ''} ${
        valeur ? (mode === 'revenu' ? 'text-vert' : mode === 'virement' ? 'text-bleu' : 'text-encre') : 'text-encre-pale'}`} aria-live="polite">
        {valeur || '0'}<span className="ml-1 text-[30px] font-semibold">{devise === 'CAD' ? '$' : '€'}</span>
      </div>

      <div className="flex flex-wrap justify-center gap-1.5">
        <label className={puce}>
          📅 {libelleJour(date).replace('Aujourd’hui', 'Auj.')}
          <input type="date" value={date} max={versISO(new Date(new Date().getFullYear() + 1, 11, 31))} onChange={(e) => e.target.value && setDate(e.target.value)}
            className="absolute inset-0 opacity-0" aria-label="Date" />
        </label>
        <label className={puce}>
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: compte?.couleur }} />
          <span className="max-w-[110px] truncate">{mode === 'virement' ? `De : ${nomCourt}` : nomCourt}</span>
          <select value={compteId} onChange={(e) => { setCompteChoisi(e.target.value); setMoyenChoisi(null) }} className="absolute inset-0 opacity-0" aria-label="Compte">
            {comptesSaisie.map((c) => <option key={c.id} value={c.id}>{c.nom} ({c.devise})</option>)}
          </select>
        </label>
        {carte && mode === 'depense' && (
          <div className="flex rounded-full bg-white p-0.5 shadow-carte" role="radiogroup" aria-label="Moyen de paiement">
            {(['debit', 'carte'] as const).map((m) => (
              <button key={m} type="button" role="radio" aria-checked={moyen === m} onClick={() => setMoyenChoisi(m)}
                className={`min-h-[30px] rounded-full px-2.5 text-[14px] font-medium ${moyen === m ? 'bg-bleu text-white' : 'text-encre-douce'}`}>
                {m === 'debit' ? 'Débit' : 'Carte'}
              </button>
            ))}
          </div>
        )}
      </div>

      <PaveNumerique valeur={valeur} surChange={setValeur} />

      {mode === 'depense' ? (
        <GrilleCategories grille={grille} enregistrer={(c) => void enregistrer(c)} />
      ) : mode === 'virement' ? (
        <FormulaireVirement destination={destination} destinationId={destinationId} destinations={destinations} setDestinationChoisie={setDestinationChoisie}
          deviseDiff={deviseDiff} recu={recu} setRecu={setRecu} enregistrer={() => void enregistrer()} />
      ) : (
        <FormulaireRevenu echeance={echeance} rattacher={rattacher} setRattacher={setRattacher}
          libelleRevenu={libelleRevenu} setLibelleRevenu={setLibelleRevenu} enregistrer={() => void enregistrer()} />
      )}
    </div>
  )
}
