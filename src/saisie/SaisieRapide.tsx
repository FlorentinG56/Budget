import { subDays } from 'date-fns'
import { useMemo, useState } from 'react'
import { ajouterAEnveloppe, confirmerEcheance, enregistrerOperation, supprimerOperation } from '../db/actions'
import { useBudget } from '../hooks/budget'
import { modifierReglages } from '../db/db'
import { analyserMontant, formaterMontant } from '../domain/argent'
import { sousCategories, trierParUsage } from '../domain/categories'
import { aujourdhui, libelleCourt, libelleJour, versISO } from '../domain/dates'
import { echeanceARattacher } from '../domain/recurrences'
import type { Categorie, Operation } from '../domain/types'
import { indexer, useCategories, useComptes, useObjectifs, useOperations, useRecurrences, useReglages } from '../hooks/donnees'
import { soldeObjectif } from '../domain/epargne'
import { PaveNumerique } from './PaveNumerique'

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
  // « Compte courant » → « Banque » (le nom complet reste dans la liste de choix)
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
        <div className="grid grid-cols-4 gap-1.5">
          {grille.map((c) => (
            <button key={c.id} type="button" onClick={() => void enregistrer(c)}
              className="flex h-[58px] flex-col items-center justify-center gap-0.5 rounded-[12px] px-1 active:scale-95"
              style={{ background: `${c.couleur}1F` }}>
              <span className="text-[22px] leading-none" aria-hidden="true">{c.icone}</span>
              <span className="line-clamp-2 text-center text-[11px] font-medium leading-[1.15] text-encre">{c.nom}</span>
            </button>
          ))}
        </div>
      ) : mode === 'virement' ? (
        <div className="flex flex-col gap-2 pt-1">
          <label className="relative flex min-h-[48px] items-center justify-between rounded-[12px] bg-white px-4 text-[16px] shadow-carte">
            <span className="text-encre-douce">Vers</span>
            <span className="flex items-center gap-1.5 font-medium text-encre">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: destination?.couleur }} />{destination?.nom ?? 'Aucun autre compte'}
            </span>
            <select value={destinationId} onChange={(e) => setDestinationChoisie(e.target.value)} className="absolute inset-0 opacity-0" aria-label="Compte de destination">
              {destinations.map((c) => <option key={c.id} value={c.id}>{c.nom} ({c.devise})</option>)}
            </select>
          </label>
          {deviseDiff && (
            <label className="flex min-h-[48px] items-center justify-between gap-3 rounded-[12px] bg-white px-4 text-[16px] shadow-carte">
              <span className="text-encre-douce">Montant reçu</span>
              <span className="flex items-center gap-1">
                <input inputMode="decimal" value={recu} onChange={(e) => setRecu(e.target.value)} placeholder="0,00" aria-label="Montant reçu"
                  className="w-28 bg-transparent text-right font-semibold text-encre outline-none placeholder:text-encre-pale" />
                <span className="text-encre-douce">{destination?.devise === 'EUR' ? '€' : '$'}</span>
              </span>
            </label>
          )}
          <button type="button" onClick={() => void enregistrer()}
            className="min-h-[52px] rounded-[14px] bg-bleu text-[17px] font-semibold text-white active:bg-bleu-fonce">
            Enregistrer le virement
          </button>
          {deviseDiff && <p className="px-1 text-center text-[12px] text-encre-pale">Pas de conversion : indique le montant arrivé sur le compte, tel que la banque l’affiche.</p>}
        </div>
      ) : (
        <div className="flex flex-col gap-2 pt-1">
          {echeance && (
            <button type="button" role="switch" aria-checked={rattacher} onClick={() => setRattacher(!rattacher)}
              className={`flex min-h-[48px] items-center gap-3 rounded-[12px] px-4 text-left text-[15px] shadow-carte ${rattacher ? 'bg-vert-pale text-encre' : 'bg-white text-encre-douce'}`}>
              <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 text-[13px] ${rattacher ? 'border-vert bg-vert text-white' : 'border-encre-pale'}`}>{rattacher ? '✓' : ''}</span>
              <span>C’est la paie « {echeance.recurrence.libelle} » prévue le {libelleCourt(echeance.date)}</span>
            </button>
          )}
          {!(echeance && rattacher) && (
            <input value={libelleRevenu} onChange={(e) => setLibelleRevenu(e.target.value)} placeholder="Libellé (ex. Facture client, Remboursement)"
              className="min-h-[48px] rounded-[12px] bg-white px-4 text-[16px] shadow-carte outline-none placeholder:text-encre-pale" />
          )}
          <button type="button" onClick={() => void enregistrer()}
            className="min-h-[52px] rounded-[14px] bg-vert text-[17px] font-semibold text-white active:opacity-80">
            Enregistrer le revenu
          </button>
        </div>
      )}
    </div>
  )
}

function Confirmation({ op, categories, devise, nomCompte, surFermer, surMaj }: {
  op: Operation; categories: Categorie[]; devise: 'CAD' | 'EUR'; nomCompte: string; surFermer: () => void; surMaj: (o: Operation) => void
}) {
  const [note, setNote] = useState(op.type === 'depense' ? op.note ?? '' : '')
  const { ctx, etat } = useBudget()
  const [ajoute, setAjoute] = useState(false)
  const objectifs = useObjectifs()
  // « Payé avec l'épargne » : objectifs du compte (ou du compte qui rembourse la carte)
  const compteOp = ctx?.comptes.find((c) => c.id === op.compteId)
  const compteEpargne = compteOp?.type === 'carte_credit' ? compteOp.compteRemboursementId : op.compteId
  const proposerACote = op.type === 'depense' && !!ctx?.budget.has(op.compteId) && etat.etat === 'actif' && op.date >= etat.bornes.debut && op.date <= etat.bornes.fin
  const objectifsPossibles = op.type === 'depense' ? (objectifs ?? []).filter((o) => !o.archive && o.compteId === compteEpargne) : []
  // revenu ponctuel (pas une paie prévue) ou virement reçu sur un compte du budget, pendant la période en cours
  const montantPourBudget = op.type === 'revenu' && !op.recurrenceId && ctx?.budget.has(op.compteId) ? op.montant
    : op.type === 'virement' && op.compteDestinationId && ctx?.budget.has(op.compteDestinationId) && !ctx.budget.has(op.compteId) ? op.montantRecu ?? op.montant
    : 0
  const proposerAjout = montantPourBudget > 0 && etat.etat === 'actif' && op.date >= etat.bornes.debut && op.date <= etat.bornes.fin
  const cats = indexer(categories)
  const cat = op.categorieId ? cats.get(op.categorieId) : undefined
  const sous = cat ? sousCategories(categories, cat.id) : []

  const maj = async (changements: Partial<Operation>) => surMaj(await enregistrerOperation({ ...op, ...changements }))
  const terminer = async () => {
    if (op.type === 'depense' && (note.trim() || undefined) !== op.note) await maj({ note: note.trim() || undefined })
    surFermer()
  }

  return (
    <div className="flex flex-col gap-3 pb-2">
      <div className="flex flex-col items-center pt-2 text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-vert-pale text-[28px] text-vert">✓</span>
        <p className="mt-2 text-[15px] text-encre-douce">Enregistré</p>
        <p className={`text-[32px] font-bold ${op.type === 'revenu' ? 'text-vert' : op.type === 'virement' ? 'text-bleu' : 'text-encre'}`}>
          {op.type === 'virement' ? formaterMontant(op.montant, devise) : formaterMontant(op.type === 'revenu' ? op.montant : -op.montant, devise, { signe: true })}
        </p>
        <p className="text-[15px] text-encre-douce">
          {op.type === 'virement' ? `Virement depuis ${nomCompte}` : <>{cat ? `${cat.icone} ${cat.nom} · ` : op.note ? `${op.note} · ` : ''}{nomCompte}</>} · {libelleJour(op.date).toLowerCase()}
        </p>
      </div>

      {sous.length > 0 && (
        <div>
          <p className="mb-1.5 px-1 text-[13px] font-semibold uppercase tracking-wide text-encre-pale">Préciser (facultatif)</p>
          <div className="flex flex-wrap gap-2">
            {sous.map((s) => {
              const actif = op.sousCategorieId === s.id
              return (
                <button key={s.id} type="button" onClick={() => void maj({ sousCategorieId: actif ? undefined : s.id })}
                  className={`min-h-[40px] rounded-full px-3.5 text-[15px] font-medium shadow-carte ${actif ? 'bg-bleu text-white' : 'bg-white text-encre'}`}>
                  {s.nom}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {proposerAjout && etat.etat === 'actif' && (
        <div className="rounded-[12px] bg-white p-3 shadow-carte">
          {ajoute ? (
            <p className="text-center text-[15px] font-medium text-vert">✓ Ajouté à l’enveloppe de la période</p>
          ) : (
            <>
              <p className="text-[15px] text-encre">L’ajouter à l’enveloppe du budget de la période ?</p>
              <button type="button" onClick={async () => { await ajouterAEnveloppe(etat.periode.id, op.id, montantPourBudget); setAjoute(true) }}
                className="mt-2 min-h-[44px] w-full rounded-[10px] bg-vert-pale text-[15px] font-semibold text-vert active:opacity-70">
                Oui, ajouter {formaterMontant(montantPourBudget, 'CAD')}
              </button>
            </>
          )}
        </div>
      )}

      {op.type === 'depense' && (proposerACote || objectifsPossibles.length > 0) && (
        <div>
          <p className="mb-1.5 px-1 text-[13px] font-semibold uppercase tracking-wide text-encre-pale">Hors budget du jour ?</p>
          <div className="flex flex-wrap gap-2">
            {proposerACote && etat.etat === 'actif' && (
              <button type="button" aria-pressed={!!op.horsBudget} onClick={() => void maj({ horsBudget: op.horsBudget ? undefined : true, objectifEpargneId: undefined })}
                className={`min-h-[40px] rounded-full px-3.5 text-[15px] font-medium shadow-carte ${op.horsBudget ? 'bg-bleu text-white' : 'bg-white text-encre'}`}>
                {op.horsBudget ? '✓ ' : '🛍️ '}À côté du budget <span className={op.horsBudget ? 'text-white/80' : 'text-encre-pale'}>(reste {formaterMontant(etat.resteACote ?? 0, devise)})</span>
              </button>
            )}
            {objectifsPossibles.map((o) => {
              const actif = op.objectifEpargneId === o.id
              return (
                <button key={o.id} type="button" onClick={() => void maj({ objectifEpargneId: actif ? undefined : o.id, horsBudget: undefined })} aria-pressed={actif}
                  className={`min-h-[40px] rounded-full px-3.5 text-[15px] font-medium shadow-carte ${actif ? 'bg-vert text-white' : 'bg-white text-encre'}`}>
                  {actif ? '✓ ' : '🐷 '}{o.nom} <span className={actif ? 'text-white/80' : 'text-encre-pale'}>({formaterMontant(soldeObjectif(o, ctx?.operations ?? []), devise)})</span>
                </button>
              )
            })}
          </div>
          {op.horsBudget && <p className="mt-1 px-1 text-[12px] text-encre-pale">Payée avec l’argent laissé à côté du budget : elle ne compte pas dans ton budget du jour, mais reste dans sa catégorie au bilan.</p>}
          {op.objectifEpargneId && <p className="mt-1 px-1 text-[12px] text-encre-pale">Retirée de l’épargne : elle ne compte pas dans ton budget du jour, mais reste dans sa catégorie au bilan.</p>}
        </div>
      )}

      {op.type === 'depense' && (
        <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note (facultatif)"
          className="min-h-[48px] rounded-[12px] bg-white px-4 text-[16px] shadow-carte outline-none placeholder:text-encre-pale" />
      )}

      <div className="flex gap-2 pt-1">
        <button type="button" onClick={() => { void supprimerOperation(op.id); surFermer() }}
          className="min-h-[50px] flex-1 rounded-[14px] bg-white text-[16px] font-semibold text-rouge shadow-carte active:bg-rouge-pale">
          Annuler la saisie
        </button>
        <button type="button" onClick={() => void terminer()}
          className="min-h-[50px] flex-1 rounded-[14px] bg-bleu text-[16px] font-semibold text-white active:bg-bleu-fonce">
          Terminé
        </button>
      </div>
    </div>
  )
}
