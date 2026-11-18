import { useState } from 'react'
import { ajouterAEnveloppe, enregistrerOperation, supprimerOperation } from '../db/actions'
import { formaterMontant } from '../domain/argent'
import { sousCategories } from '../domain/categories'
import { libelleJour } from '../domain/dates'
import { soldeObjectif } from '../domain/epargne'
import type { Categorie, Operation } from '../domain/types'
import { useBudget } from '../hooks/budget'
import { indexer, useObjectifs } from '../hooks/donnees'

/** Écran « Enregistré » : sous-catégorie, note, hors budget du jour (à côté / épargne), ajout à l'enveloppe, annulation. */
export function Confirmation({ op, categories, devise, nomCompte, surFermer, surMaj }: {
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
