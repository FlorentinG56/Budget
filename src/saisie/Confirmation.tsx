import { useState } from 'react'
import { ajouterAEnveloppe, enregistrerOperation, supprimerOperation } from '../db/actions'
import { formaterMontant } from '../domain/argent'
import { sousCategories } from '../domain/categories'
import { libelleJour } from '../domain/dates'
import { champsImprevu, choixImprevu, comptesEpargne, projetsEpargne, soldeObjectif, type ChoixImprevu } from '../domain/epargne'
import type { Categorie, Operation } from '../domain/types'
import { useBudget } from '../hooks/budget'
import { indexer, useBiens, useObjectifs, useReglages } from '../hooks/donnees'

/** Écran « Enregistré » : sous-catégorie, note, imprévu (payé avec le solde, la sécurité ou l'épargne), ajout à l'enveloppe, annulation. */
export function Confirmation({ op, categories, devise, nomCompte, surFermer, surMaj }: {
  op: Operation; categories: Categorie[]; devise: 'CAD' | 'EUR'; nomCompte: string; surFermer: () => void; surMaj: (o: Operation) => void
}) {
  const [note, setNote] = useState(op.type === 'depense' ? op.note ?? '' : '')
  const { ctx, etat } = useBudget()
  const [ajoute, setAjoute] = useState(false)
  const objectifs = useObjectifs()
  const reglages = useReglages()
  const biens = useBiens()
  // « Imprévu, payé comment ? » : solde (ou carte), sécurité, épargne (et un projet)
  const compteOp = ctx?.comptes.find((c) => c.id === op.compteId)
  const comptePrincipal = compteOp?.type === 'carte_credit' ? compteOp.compteRemboursementId : op.compteId
  const securite = (objectifs ?? []).find((o) => o.id === reglages?.objectifSecuriteId && o.compteId === comptePrincipal && !o.archive)
  const compteEpargne = ctx && compteOp ? comptesEpargne(ctx.comptes).find((c) => c.devise === compteOp.devise) : undefined
  const projets = compteEpargne ? projetsEpargne(objectifs ?? [], ctx?.comptes ?? []).filter((o) => o.compteId === compteEpargne.id) : []
  const proposerImprevu = op.type === 'depense' && !!ctx?.budget.has(op.compteId)
  const choix = choixImprevu(op, reglages?.objectifSecuriteId)
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

      {proposerImprevu && (
        <div>
          <p className="mb-1.5 px-1 text-[13px] font-semibold uppercase tracking-wide text-encre-pale">Imprévu ? Payé comment</p>
          <div className="flex flex-wrap gap-2">
            {([
              ['solde', compteOp?.type === 'carte_credit' ? '💳 Carte de crédit' : '🏦 Solde du compte', ''],
              ...(securite ? [['securite', '🛟 Sécurité', formaterMontant(soldeObjectif(securite, ctx?.operations ?? []), devise)]] : []),
              ...(compteEpargne ? [['epargne', '🐷 Épargne', '']] : []),
            ] as [ChoixImprevu, string, string][]).map(([v, l, detail]) => {
              const actif = v === 'epargne' ? choix === 'epargne' || choix.startsWith('projet:') : choix === v
              return (
                <button key={v} type="button" aria-pressed={actif} onClick={() => void maj(champsImprevu(actif ? '' : v, reglages?.objectifSecuriteId, compteEpargne?.id))}
                  className={`min-h-[40px] rounded-full px-3.5 text-[15px] font-medium shadow-carte ${actif ? 'bg-bleu text-white' : 'bg-white text-encre'}`}>
                  {actif ? '✓ ' : ''}{l}{detail && <span className={actif ? 'text-white/80' : 'text-encre-pale'}> ({detail})</span>}
                </button>
              )
            })}
          </div>
          {(choix === 'epargne' || choix.startsWith('projet:')) && projets.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2" aria-label="Projet">
              {projets.map((o) => {
                const actif = choix === `projet:${o.id}`
                return (
                  <button key={o.id} type="button" aria-pressed={actif} onClick={() => void maj(champsImprevu(actif ? 'epargne' : `projet:${o.id}`, reglages?.objectifSecuriteId, compteEpargne?.id))}
                    className={`min-h-[36px] rounded-full px-3 text-[14px] font-medium shadow-carte ${actif ? 'bg-vert text-white' : 'bg-white text-encre'}`}>
                    {actif ? '✓ ' : '🎯 '}{o.nom}
                  </button>
                )
              })}
            </div>
          )}
          {choix !== '' && <p className="mt-1 px-1 text-[12px] leading-snug text-encre-pale">Hors budget du jour, toujours dans sa catégorie au bilan.
            {choix === 'securite' && ' Retirée de ta sécurité.'}
            {(choix === 'epargne' || choix.startsWith('projet:')) && compteEpargne && <> Un virement de {formaterMontant(op.montant, devise)} de {compteEpargne.nom} vers ton compte est enregistré : <b className="text-encre">fais-le aussi à ta banque</b>.</>}
          </p>}
        </div>
      )}

      {op.type === 'depense' && (biens ?? []).some((b) => !b.sortie) && (
        <label className="relative flex min-h-[46px] items-center justify-between gap-2 rounded-[12px] bg-white px-4 text-[15px] shadow-carte">
          <span className="text-encre-douce">🔧 Objet (réparation, entretien)</span>
          <span className="max-w-[45%] truncate font-medium text-encre">{(biens ?? []).find((b) => b.id === op.bienId)?.nom ?? 'Aucun'}</span>
          <select value={op.bienId ?? ''} onChange={(e) => void maj({ bienId: e.target.value || undefined })} className="absolute inset-0 opacity-0" aria-label="Objet">
            <option value="">Aucun</option>
            {(biens ?? []).filter((b) => !b.sortie).sort((a, b) => a.nom.localeCompare(b.nom, 'fr')).map((b) => <option key={b.id} value={b.id}>{b.nom}</option>)}
          </select>
        </label>
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
