import { subDays } from 'date-fns'
import { useMemo, useState } from 'react'
import { enregistrerOperation, supprimerOperation } from '../db/actions'
import { modifierReglages } from '../db/db'
import { analyserMontant, formaterMontant } from '../domain/argent'
import { sousCategories, trierParUsage } from '../domain/categories'
import { aujourdhui, libelleJour, versISO } from '../domain/dates'
import type { Categorie, Operation } from '../domain/types'
import { indexer, useCategories, useComptes, useOperations, useReglages } from '../hooks/donnees'
import { PaveNumerique } from './PaveNumerique'

type Mode = 'depense' | 'revenu'

/** Saisie rapide : montant, catégorie, c'est enregistré. Le reste est facultatif. */
export function SaisieRapide({ surFermer }: { surFermer: () => void }) {
  const comptes = useComptes()
  const categories = useCategories()
  const operations = useOperations()
  const reglages = useReglages()

  const [mode, setMode] = useState<Mode>('depense')
  const [valeur, setValeur] = useState('')
  const [date, setDate] = useState(aujourdhui())
  const [compteChoisi, setCompteChoisi] = useState<string | null>(null)
  const [moyenChoisi, setMoyenChoisi] = useState<'debit' | 'carte' | null>(null)
  const [libelleRevenu, setLibelleRevenu] = useState('')
  const [secoue, setSecoue] = useState(false)
  const [enregistree, setEnregistree] = useState<Operation | null>(null)

  const comptesSaisie = (comptes ?? []).filter((c) => c.type !== 'carte_credit')
  const compteId = compteChoisi ?? comptesSaisie.find((c) => c.inclusBudgetJournalier)?.id ?? comptesSaisie[0]?.id
  const compte = comptesSaisie.find((c) => c.id === compteId)
  const carte = (comptes ?? []).find((c) => c.type === 'carte_credit' && c.compteRemboursementId === compteId)
  const moyen = carte && mode === 'depense' ? (moyenChoisi ?? reglages?.dernierMoyenPaiement ?? 'debit') : 'debit'
  const devise = compte?.devise ?? 'CAD'

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

  const enregistrer = async (categorie?: Categorie) => {
    if (!montant || !compteId) return refuser()
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
        {(['depense', 'revenu'] as Mode[]).map((m) => (
          <button key={m} type="button" role="tab" aria-selected={mode === m} onClick={() => setMode(m)}
            className={`min-h-[32px] rounded-[8px] px-5 text-[14px] font-semibold ${mode === m ? 'bg-white text-encre shadow-sm' : 'text-encre-douce'}`}>
            {m === 'depense' ? 'Dépense' : 'Revenu'}
          </button>
        ))}
      </div>

      <div className={`text-center text-[40px] font-bold leading-none tracking-tight ${secoue ? 'animate-secousse' : ''} ${
        valeur ? (mode === 'revenu' ? 'text-vert' : 'text-encre') : 'text-encre-pale'}`} aria-live="polite">
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
          <span className="max-w-[110px] truncate">{nomCourt}</span>
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
      ) : (
        <div className="flex flex-col gap-2 pt-1">
          <input value={libelleRevenu} onChange={(e) => setLibelleRevenu(e.target.value)} placeholder="Libellé (ex. Facture client, Remboursement)"
            className="min-h-[48px] rounded-[12px] bg-white px-4 text-[16px] shadow-carte outline-none placeholder:text-encre-pale" />
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
        <p className={`text-[32px] font-bold ${op.type === 'revenu' ? 'text-vert' : 'text-encre'}`}>
          {formaterMontant(op.type === 'revenu' ? op.montant : -op.montant, devise, { signe: true })}
        </p>
        <p className="text-[15px] text-encre-douce">
          {cat ? `${cat.icone} ${cat.nom} · ` : op.note ? `${op.note} · ` : ''}{nomCompte} · {libelleJour(op.date).toLowerCase()}
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
