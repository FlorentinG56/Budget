import { useMemo, useState } from 'react'
import { calculerAlertes, type Alerte } from '../domain/alertes'
import { useBudget } from '../hooks/budget'
import { useBiens, useCategories, useReglages } from '../hooks/donnees'
import { suiviBudgets } from '../domain/budgetsCategories'
import { revueAAnnoncer } from '../domain/revue'
import { garantiesBientotFinies } from '../domain/biens'
import { PageBien } from '../screens/biens/Biens'
import { PageRevue } from '../screens/analyses/Revue'
import { calculerProjection } from '../hooks/projection'
import { useNav } from '../nav/Navigation'
import { PagePeriode } from '../budget/PagePeriode'
import { ListeRecurrences } from '../screens/reglages/Recurrences'
import { IconeFermer } from './Icones'
import { FormulaireSauvegarde, PageSauvegarde } from '../screens/reglages/Sauvegarde'
import { Feuille } from './Feuille'

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
  const categories = useCategories()
  const biens = useBiens()
  const [masquees, setMasquees] = useState(lireMasquees)
  const [sauvegarde, setSauvegarde] = useState(0) // > 0 : feuille « Sauvegarder maintenant » ouverte (recréée à chaque ouverture)

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
      budgetsCategories: categories ? suiviBudgets(categories, ctx.operations, ctx.budget, ctx.date) : undefined,
      revue: revueAAnnoncer(ctx.date, ctx.operations, ctx.budget, reglages.revuesVues ?? []),
      garanties: biens ? garantiesBientotFinies(biens, ctx.date).map((b) => ({ id: b.id, nom: b.nom, finGarantie: b.finGarantie! })) : undefined,
    })
  }, [ctx, etat, reglages, categories, biens])

  const visibles = alertes.filter((a) => masquees[a.id] !== ctx?.date)
  const feuille = (
    <Feuille ouverte={sauvegarde > 0} surFermer={() => setSauvegarde(0)} titre="Sauvegarder maintenant">
      <p className="mb-3 text-[15px] leading-snug text-encre-douce">
        Choisis un mot de passe, puis « Enregistrer dans Fichiers » et iCloud Drive dans le menu Partager. Le mot de passe n’est jamais mémorisé.
      </p>
      {sauvegarde > 0 && <FormulaireSauvegarde key={sauvegarde} surReussite={() => setTimeout(() => setSauvegarde(0), 1500)} />}
    </Feuille>
  )
  if (visibles.length === 0) return feuille

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
    else if (a.cible === 'analyses') nav.changerOnglet('analyses')
    else if (a.cible === 'revue' && a.mois) nav.ouvrir(<PageRevue mois={a.mois} />)
    else if (a.cible === 'bien' && a.bienId) nav.ouvrir(<PageBien id={a.bienId} />)
  }

  return (
    <section className="flex flex-col gap-2" aria-label="Alertes">
      {visibles.map((a) => (
        <div key={a.id} className={`rounded-[14px] border py-1 pl-3.5 pr-1 ${STYLES[a.niveau]}`}>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => ouvrir(a)} className="flex min-h-[44px] min-w-0 flex-1 items-center gap-2.5 text-left text-[15px] font-medium active:opacity-70">
              <span aria-hidden="true">{a.icone}</span><span>{a.texte}</span>
            </button>
            <button type="button" onClick={() => masquer(a)} aria-label="Masquer jusqu’à demain" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full opacity-60 active:bg-black/5">
              <IconeFermer taille={16} />
            </button>
          </div>
          {a.cible === 'sauvegarde' && (
            <button type="button" onClick={() => setSauvegarde((n) => n + 1)}
              className="mb-2 mr-2.5 mt-0.5 min-h-[44px] w-[calc(100%-10px)] rounded-[12px] bg-white text-[15px] font-semibold active:opacity-70">
              💾 Sauvegarder maintenant
            </button>
          )}
        </div>
      ))}
      {feuille}
    </section>
  )
}
