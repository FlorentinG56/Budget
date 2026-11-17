import { useMemo, useState } from 'react'
import { calculerAlertes, type Alerte } from '../domain/alertes'
import { useBudget } from '../hooks/budget'
import { useReglages } from '../hooks/donnees'
import { calculerProjection } from '../hooks/projection'
import { useNav } from '../nav/Navigation'
import { PagePeriode } from '../budget/PagePeriode'
import { ListeRecurrences } from '../screens/reglages/Recurrences'
import { IconeFermer } from './Icones'
import { PageSauvegarde } from '../screens/reglages/Sauvegarde'

const CLE = 'alertes-masquees' // { [idAlerte]: date du jour où elle a été masquée }
const STYLES = {
  danger: 'border-rouge/25 bg-rouge-pale text-rouge',
  attention: 'border-[#F59E0B]/30 bg-[#FEF6E7] text-[#92400E]',
  info: 'border-bleu/20 bg-bleu-pale text-bleu-fonce',
}

function lireMasquees(): Record<string, string> {
  try { return JSON.parse(localStorage.getItem(CLE) ?? '{}') } catch { return {} }
}

/** Bandeaux d'alerte en haut de l'accueil ; chacun peut être masqué jusqu'au lendemain. */
export function BandeauAlertes() {
  const nav = useNav()
  const { ctx, etat } = useBudget()
  const reglages = useReglages()
  const [masquees, setMasquees] = useState(lireMasquees)

  const alertes = useMemo(() => {
    if (!ctx || !reglages) return []
    const devise = ctx.comptes.find((c) => ctx.budget.has(c.id))?.devise ?? 'CAD'
    return calculerAlertes({
      aujourdhui: ctx.date, delaiJours: reglages.delaiAlerteJours, recurrences: ctx.recurrences, operations: ctx.operations, comptes: ctx.comptes,
      resteAujourdhui: etat.etat === 'actif' ? etat.jour.resteAujourdhui : undefined, devise,
      projection: ctx.budget.size ? calculerProjection(ctx, ctx.budget, true, 62) : undefined,
      derniereSauvegarde: reglages.derniereSauvegarde, rappelSauvegardeJours: reglages.rappelSauvegardeJours,
      sauvegardeDisponible: true,
      maintenant: Date.now(),
    })
  }, [ctx, etat, reglages])

  const visibles = alertes.filter((a) => masquees[a.id] !== ctx?.date)
  if (visibles.length === 0) return null

  const masquer = (a: Alerte) => {
    const m = { ...lireMasquees(), [a.id]: ctx!.date }
    for (const [k, v] of Object.entries(m)) if (v !== ctx!.date) delete m[k] // on ne garde que le jour en cours
    try { localStorage.setItem(CLE, JSON.stringify(m)) } catch { /* stockage indisponible : masqué jusqu'à la fermeture */ }
    setMasquees(m)
  }
  const ouvrir = (a: Alerte) => {
    if (a.cible === 'calendrier') nav.changerOnglet('calendrier')
    else if (a.cible === 'charges') nav.ouvrir(<ListeRecurrences genre="charges" />)
    else if (a.cible === 'periode' && etat.etat === 'actif') nav.ouvrir(<PagePeriode />)
    else if (a.cible === 'sauvegarde') nav.ouvrir(<PageSauvegarde />)
  }

  return (
    <section className="flex flex-col gap-2" aria-label="Alertes">
      {visibles.map((a) => (
        <div key={a.id} className={`flex items-center gap-2 rounded-[14px] border py-1 pl-3.5 pr-1 ${STYLES[a.niveau]}`}>
          <button type="button" onClick={() => ouvrir(a)} className="flex min-h-[44px] min-w-0 flex-1 items-center gap-2.5 text-left text-[15px] font-medium active:opacity-70">
            <span aria-hidden="true">{a.icone}</span><span>{a.texte}</span>
          </button>
          <button type="button" onClick={() => masquer(a)} aria-label="Masquer jusqu’à demain" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full opacity-60 active:bg-black/5">
            <IconeFermer taille={16} />
          </button>
        </div>
      ))}
    </section>
  )
}
