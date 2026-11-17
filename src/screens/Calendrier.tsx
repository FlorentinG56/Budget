import { addMonths, format, parseISO, startOfMonth } from 'date-fns'
import { fr } from 'date-fns/locale/fr'
import { useMemo, useState } from 'react'
import { LigneOperation } from '../components/LigneOperation'
import { IconeChevron } from '../components/Icones'
import { Ecran } from '../components/ui'
import { formaterMontant } from '../domain/argent'
import { budgetDuJourA, depensesBudget, enveloppeEffective } from '../domain/budget'
import { libelleJour } from '../domain/dates'
import { evenementsPrevus, grilleMois, montantCompact, premierJourNegatif, type JourProjete } from '../domain/projection'
import { soldeCompte } from '../domain/soldes'
import type { Compte, DateISO, Devise, Operation } from '../domain/types'
import { useContexteBudget } from '../hooks/budget'
import { calculerProjection } from '../hooks/projection'
import { indexer, useCategories } from '../hooks/donnees'
import { useNav } from '../nav/Navigation'
import { EditionOperation } from './operations/EditionOperation'

interface Vue { id: string; libelle: string; comptes: Set<string>; devise: Devise; budget: boolean }
const JOURS_SEMAINE = ['L', 'M', 'M', 'J', 'V', 'S', 'D']

export function Calendrier() {
  const nav = useNav()
  const ctx = useContexteBudget()
  const categories = useCategories()
  const [vueId, setVueId] = useState('budget')
  const [decalage, setDecalage] = useState(0) // mois par rapport au mois courant
  const [selection, setSelection] = useState<DateISO | null>(null)

  const vues = useMemo<Vue[]>(() => {
    if (!ctx) return []
    const budgetComptes = ctx.comptes.filter((c) => ctx.budget.has(c.id))
    const principal = budgetComptes.find((c) => c.type !== 'carte_credit') ?? budgetComptes[0]
    const liste: Vue[] = principal ? [{ id: 'budget', libelle: principal.nom.split(' – ')[0], comptes: ctx.budget, devise: principal.devise, budget: true }] : []
    for (const c of ctx.comptes) {
      if (ctx.budget.has(c.id) || c.type === 'carte_credit') continue
      liste.push({ id: c.id, libelle: c.nom, comptes: new Set([c.id]), devise: c.devise, budget: false })
    }
    return liste
  }, [ctx])

  const vue = vues.find((v) => v.id === vueId) ?? vues[0]
  const aujourdhui = ctx?.date ?? ''

  // Projection sur 12 mois (une seule fois par changement de données ou de compte)
  const projection = useMemo(
    () => (ctx && vue ? calculerProjection(ctx, vue.comptes, vue.budget, 372) : new Map<DateISO, JourProjete>()),
    [ctx, vue],
  )

  if (!ctx || !vue || !categories) return <Ecran titre="Calendrier"><div /></Ecran>

  const comptesVue = ctx.comptes.filter((c) => vue.comptes.has(c.id))
  const mapComptes = indexer(ctx.comptes)
  const mapCats = indexer(categories)
  const mois = addMonths(startOfMonth(parseISO(aujourdhui)), decalage)
  const debutHistorique = comptesVue.reduce((m, c) => (c.dateDepart < m ? c.dateDepart : m), aujourdhui)
  const decalageMin = (parseISO(debutHistorique).getFullYear() - parseISO(aujourdhui).getFullYear()) * 12 + parseISO(debutHistorique).getMonth() - parseISO(aujourdhui).getMonth()
  const negatif = premierJourNegatif(projection)
  const jourChoisi = selection ?? aujourdhui

  // jours passés : dépensé et budget du jour de la période qui contenait ce jour
  const infosPasse = (d: DateISO) => {
    const depense = vue.budget
      ? depensesBudget(ctx.operations, vue.comptes, d, d)
      : ctx.operations.filter((o) => o.type === 'depense' && o.date === d && vue.comptes.has(o.compteId)).reduce((s, o) => s + o.montant, 0)
    let budget: number | undefined
    if (vue.budget) {
      const p = ctx.periodes.find((x) => x.dateDebut <= d && d <= x.dateFin && (!x.demarrageLe || d >= x.demarrageLe))
      if (p) budget = budgetDuJourA(enveloppeEffective(p, ctx.operations), ctx.operations, vue.comptes, { debut: p.dateDebut, fin: p.dateFin }, d)
    }
    const solde = comptesVue.reduce((s, c) => s + soldeCompte(c, ctx.operations, d), 0)
    return { depense, budget, solde }
  }

  return (
    <Ecran titre="Calendrier">
      {vues.length > 1 && (
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
          {vues.map((v) => (
            <button key={v.id} type="button" onClick={() => { setVueId(v.id); setSelection(null) }}
              className={`min-h-[36px] shrink-0 rounded-full px-3.5 text-[14px] font-medium shadow-carte ${v.id === vue.id ? 'bg-bleu text-white' : 'bg-white text-encre'}`}>
              {v.libelle}
            </button>
          ))}
        </div>
      )}

      {negatif && (
        <button type="button" onClick={() => { setSelection(negatif); setDecalage(monthDiff(aujourdhui, negatif)) }}
          className="rounded-carte bg-rouge-pale px-4 py-3 text-left text-[15px] font-medium text-rouge active:opacity-80">
          ⚠️ Solde projeté négatif le {libelleJour(negatif, aujourdhui).toLowerCase()}
        </button>
      )}

      <section className="rounded-carte bg-white p-3 shadow-carte">
        <div className="mb-2 flex items-center justify-between">
          <button type="button" aria-label="Mois précédent" disabled={decalage <= decalageMin} onClick={() => setDecalage(decalage - 1)}
            className="flex h-11 w-11 items-center justify-center rounded-full text-bleu active:bg-fond disabled:opacity-25">
            <IconeChevron taille={22} className="rotate-180" />
          </button>
          <h2 className="text-[17px] font-semibold capitalize text-encre">{format(mois, 'MMMM yyyy', { locale: fr })}</h2>
          <button type="button" aria-label="Mois suivant" disabled={decalage >= 12} onClick={() => setDecalage(decalage + 1)}
            className="flex h-11 w-11 items-center justify-center rounded-full text-bleu active:bg-fond disabled:opacity-25">
            <IconeChevron taille={22} />
          </button>
        </div>
        <div className="grid grid-cols-7 text-center text-[12px] font-semibold text-encre-pale">
          {JOURS_SEMAINE.map((j, i) => <span key={i} className="pb-1">{j}</span>)}
        </div>
        <div className="grid grid-cols-7 gap-0.5">
          {grilleMois(mois.getFullYear(), mois.getMonth()).flat().map((d, i) => {
            if (!d) return <span key={i} />
            const passe = d < aujourdhui
            const futur = d > aujourdhui
            const proj = projection.get(d)
            const evs = futur ? { r: (proj?.revenus ?? 0) > 0, c: (proj?.charges ?? 0) > 0 } : pointsReels(ctx.operations, vue.comptes, d)
            const info = passe ? infosPasse(d) : undefined
            const rouge = !passe && proj && proj.solde < 0
            const choisi = d === jourChoisi
            return (
              <button key={d} type="button" onClick={() => setSelection(d)} aria-label={libelleJour(d, aujourdhui)} aria-pressed={choisi}
                className={`flex h-[58px] flex-col items-center rounded-[10px] pt-1 transition ${choisi ? 'bg-bleu-pale ring-2 ring-bleu' : rouge ? 'bg-rouge-pale' : 'active:bg-fond'}`}>
                <span className={`flex h-6 w-6 items-center justify-center rounded-full text-[14px] ${d === aujourdhui ? 'bg-bleu font-bold text-white' : passe ? 'text-encre-douce' : 'text-encre'}`}>
                  {Number(d.slice(8))}
                </span>
                <span className="flex h-2 items-center gap-0.5">
                  {evs.c && <span className="h-1.5 w-1.5 rounded-full bg-rouge" />}
                  {evs.r && <span className="h-1.5 w-1.5 rounded-full bg-vert" />}
                </span>
                <span className={`text-[10.5px] font-medium leading-tight ${
                  info ? (info.budget === undefined ? 'text-encre-douce' : info.depense <= info.budget ? 'text-vert' : 'text-rouge')
                  : rouge ? 'text-rouge' : 'text-encre-pale'}`}>
                  {info ? (info.depense > 0 || info.budget !== undefined ? montantCompact(info.depense) : '') : proj ? montantCompact(proj.solde) : ''}
                </span>
              </button>
            )
          })}
        </div>
        <p className="mt-2 flex flex-wrap gap-x-3 gap-y-1 px-1 text-[11.5px] text-encre-pale">
          <span><span className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-rouge align-middle" />charge</span>
          <span><span className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-vert align-middle" />revenu</span>
          <span>passé : dépensé{vue.budget ? ' (vert = budget respecté)' : ''}</span>
          <span>à venir : solde projeté</span>
        </p>
      </section>

      <DetailJour date={jourChoisi} aujourdhui={aujourdhui} vue={vue} projection={projection.get(jourChoisi)}
        infoPasse={jourChoisi < aujourdhui ? infosPasse(jourChoisi) : undefined}
        operations={ctx.operations.filter((o) => o.date === jourChoisi && (vue.comptes.has(o.compteId) || (!!o.compteDestinationId && vue.comptes.has(o.compteDestinationId))))}
        prevus={jourChoisi > aujourdhui ? evenementsPrevus(ctx.recurrences, jourChoisi, jourChoisi, ctx.operations).filter((e) => vue.comptes.has(e.compteId)) : []}
        comptes={mapComptes} surOuvrir={(op) => nav.ouvrir(<EditionOperation id={op.id} />)} categories={mapCats} />
    </Ecran>
  )
}

function monthDiff(a: DateISO, b: DateISO) {
  const x = parseISO(a), y = parseISO(b)
  return (y.getFullYear() - x.getFullYear()) * 12 + y.getMonth() - x.getMonth()
}

/** Points d'un jour passé ou d'aujourd'hui : prélèvements et revenus réellement passés. */
function pointsReels(ops: Operation[], comptes: Set<string>, d: DateISO) {
  let r = false, c = false
  for (const o of ops) {
    if (o.date !== d || !o.recurrenceId || !comptes.has(o.compteId)) continue
    if (o.type === 'revenu') r = true
    if (o.type === 'prelevement_fixe') c = true
  }
  return { r, c }
}

function DetailJour({ date, aujourdhui, vue, projection, infoPasse, operations, prevus, comptes, categories, surOuvrir }: {
  date: DateISO; aujourdhui: DateISO; vue: Vue; projection?: JourProjete
  infoPasse?: { depense: number; budget?: number; solde: number }
  operations: Operation[]; prevus: ReturnType<typeof evenementsPrevus>
  comptes: Map<string, Compte>; categories: Parameters<typeof LigneOperation>[0]['categories']; surOuvrir: (op: Operation) => void
}) {
  const passe = date < aujourdhui
  const solde = passe ? infoPasse?.solde : projection?.solde
  return (
    <section className="overflow-hidden rounded-carte bg-white shadow-carte">
      <div className="flex items-end justify-between gap-3 px-4 pb-2 pt-3">
        <div>
          <h3 className="text-[17px] font-semibold text-encre">{libelleJour(date, aujourdhui)}</h3>
          <p className="text-[13px] text-encre-pale">{passe ? 'Solde en fin de journée' : 'Solde projeté en fin de journée'}</p>
        </div>
        {solde !== undefined && <p className={`text-[22px] font-bold ${solde < 0 ? 'text-rouge' : 'text-encre'}`}>{formaterMontant(solde, vue.devise)}</p>}
      </div>
      {passe && infoPasse?.budget !== undefined && (
        <p className="px-4 pb-2 text-[14px] text-encre-douce">
          Dépensé {formaterMontant(infoPasse.depense, vue.devise)} pour un budget du jour de {formaterMontant(infoPasse.budget, vue.devise)}
          <span className={infoPasse.depense <= infoPasse.budget ? 'text-vert' : 'text-rouge'}>{infoPasse.depense <= infoPasse.budget ? ' ✓' : ' ✗'}</span>
        </p>
      )}
      <div className="divide-y divide-trait border-t border-trait">
        {operations.map((op) => <LigneOperation key={op.id} op={op} comptes={comptes} categories={categories} surClic={() => surOuvrir(op)} />)}
        {prevus.map((e) => (
          <div key={e.recurrenceId + e.date} className="flex min-h-[54px] items-center gap-3 px-4 py-2">
            <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[18px] ${e.sens === 'revenu' ? 'bg-vert-pale' : 'bg-rouge-pale'}`}>{e.sens === 'revenu' ? '💰' : '📅'}</span>
            <span className="min-w-0 flex-1"><span className="block truncate text-[16px] font-medium text-encre">{e.libelle}</span>
              <span className="block text-[13px] text-encre-pale">Prévu{comptes.get(e.compteId)?.type === 'carte_credit' ? ' · carte' : ''}</span></span>
            <span className={`text-[16px] font-semibold ${e.sens === 'revenu' ? 'text-vert' : 'text-encre'}`}>{formaterMontant(e.sens === 'revenu' ? e.montant : -e.montant, vue.devise, { signe: e.sens === 'revenu' })}</span>
          </div>
        ))}
        {!passe && projection && projection.depenseEstimee > 0 && (
          <div className="flex min-h-[48px] items-center justify-between px-4 py-2 text-[15px]">
            <span className="text-encre-douce">{date === aujourdhui ? 'Reste du budget du jour (supposé dépensé)' : 'Dépenses du quotidien estimées'}</span>
            <span className="font-semibold text-encre-douce">{formaterMontant(-projection.depenseEstimee, vue.devise)}</span>
          </div>
        )}
        {operations.length === 0 && prevus.length === 0 && !(projection && projection.depenseEstimee > 0) && (
          <p className="px-4 py-4 text-center text-[14px] text-encre-pale">Rien ce jour-là.</p>
        )}
      </div>
    </section>
  )
}
