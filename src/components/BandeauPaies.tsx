import { useState } from 'react'
import { confirmerEcheance } from '../db/actions'
import { analyserMontant } from '../domain/argent'
import { aujourdhui, libelleJour } from '../domain/dates'
import { echeancesEnAttente, type EcheanceEnAttente } from '../domain/recurrences'
import type { Compte, Recurrence } from '../domain/types'

const versTexte = (c: number) => (c / 100).toFixed(2).replace('.', ',')

/** « Paie prévue aujourd'hui : montant reçu ? » — une ligne par échéance à confirmer. */
export function BandeauPaies({ recurrences, comptes }: { recurrences: Recurrence[]; comptes: Map<string, Compte> }) {
  const enAttente = echeancesEnAttente(recurrences, aujourdhui())
  if (enAttente.length === 0) return null
  return (
    <section className="space-y-2.5 rounded-carte border border-vert/25 bg-vert-pale p-4" aria-label="Montants à confirmer">
      {enAttente.map((e) => <LignePaie key={`${e.recurrence.id}-${e.date}`} echeance={e} compte={comptes.get(e.recurrence.compteId)} />)}
    </section>
  )
}

function LignePaie({ echeance, compte }: { echeance: EcheanceEnAttente; compte?: Compte }) {
  const { recurrence: r, date } = echeance
  const [texte, setTexte] = useState(versTexte(r.montant))
  const [ignorer, setIgnorer] = useState(false)
  const montant = analyserMontant(texte)
  const quand = libelleJour(date).toLowerCase()
  return (
    <div>
      <p className="text-[15px] font-semibold text-encre">
        💰 {r.libelle} prévu{quand === 'aujourd’hui' ? ' aujourd’hui' : ` ${quand === 'hier' ? 'hier' : `le ${quand}`}`} — montant reçu ?
      </p>
      <div className="mt-2 flex items-center gap-2">
        <label className="flex min-h-[48px] flex-1 items-center rounded-[12px] bg-white px-3 shadow-carte">
          <input inputMode="decimal" value={texte} onChange={(e) => setTexte(e.target.value)} onFocus={(e) => e.target.select()} aria-label={`Montant reçu pour ${r.libelle}`}
            className="w-full min-w-0 bg-transparent text-[20px] font-semibold text-encre outline-none" />
          <span className="text-[18px] text-encre-douce">{compte?.devise === 'EUR' ? '€' : '$'}</span>
        </label>
        <button type="button" disabled={!montant} onClick={() => montant && void confirmerEcheance(r.id, date, montant)}
          className="min-h-[48px] rounded-[12px] bg-vert px-4 text-[16px] font-semibold text-white active:opacity-80 disabled:opacity-40">
          Valider
        </button>
      </div>
      {!ignorer ? (
        <button type="button" onClick={() => setIgnorer(true)} className="mt-1 min-h-[36px] text-[13px] text-encre-douce underline-offset-2 active:underline">
          Pas reçu ?
        </button>
      ) : (
        <p className="mt-1.5 flex flex-wrap items-center gap-x-3 text-[13px] text-encre-douce">
          Ignorer cette échéance (rien ne sera crédité) ?
          <button type="button" onClick={() => void confirmerEcheance(r.id, date, null)} className="min-h-[36px] font-semibold text-rouge">Ignorer</button>
          <button type="button" onClick={() => setIgnorer(false)} className="min-h-[36px] font-semibold text-bleu">Non</button>
        </p>
      )}
    </div>
  )
}
