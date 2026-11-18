import type { EcheanceEnAttente } from '../domain/recurrences'
import { libelleCourt } from '../domain/dates'
import type { Categorie, Compte } from '../domain/types'

/** Dépense : la grille des catégories (les plus utilisées d'abord) ; toucher une catégorie enregistre. */
export function GrilleCategories({ grille, enregistrer }: { grille: Categorie[]; enregistrer: (c: Categorie) => void }) {
  return (
    <div className="grid grid-cols-4 gap-1.5">
      {grille.map((c) => (
        <button key={c.id} type="button" onClick={() => enregistrer(c)}
          className="flex h-[58px] flex-col items-center justify-center gap-0.5 rounded-[12px] px-1 active:scale-95"
          style={{ background: `${c.couleur}1F` }}>
          <span className="text-[22px] leading-none" aria-hidden="true">{c.icone}</span>
          <span className="line-clamp-2 text-center text-[11px] font-medium leading-[1.15] text-encre">{c.nom}</span>
        </button>
      ))}
    </div>
  )
}

/** Virement : compte de destination, montant reçu si la devise diffère. */
export function FormulaireVirement({ destination, destinationId, destinations, setDestinationChoisie, deviseDiff, recu, setRecu, enregistrer }: {
  destination?: Compte; destinationId?: string; destinations: Compte[]; setDestinationChoisie: (id: string) => void
  deviseDiff: boolean; recu: string; setRecu: (v: string) => void; enregistrer: () => void
}) {
  return (
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
      <button type="button" onClick={() => enregistrer()}
        className="min-h-[52px] rounded-[14px] bg-bleu text-[17px] font-semibold text-white active:bg-bleu-fonce">
        Enregistrer le virement
      </button>
      {deviseDiff && <p className="px-1 text-center text-[12px] text-encre-pale">Pas de conversion : indique le montant arrivé sur le compte, tel que la banque l’affiche.</p>}
    </div>
  )
}

/** Revenu : libellé, ou rattachement à une paie prévue proche de la date. */
export function FormulaireRevenu({ echeance, rattacher, setRattacher, libelleRevenu, setLibelleRevenu, enregistrer }: {
  echeance?: EcheanceEnAttente; rattacher: boolean; setRattacher: (v: boolean) => void
  libelleRevenu: string; setLibelleRevenu: (v: string) => void; enregistrer: () => void
}) {
  return (
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
      <button type="button" onClick={() => enregistrer()}
        className="min-h-[52px] rounded-[14px] bg-vert text-[17px] font-semibold text-white active:opacity-80">
        Enregistrer le revenu
      </button>
    </div>
  )
}
