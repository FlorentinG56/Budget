import { format, parseISO } from 'date-fns'
import { fr } from 'date-fns/locale/fr'
import { useMemo, useState } from 'react'
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { LigneOperation } from '../components/LigneOperation'
import { IconeChevron } from '../components/Icones'
import { Ecran, TitreSection } from '../components/ui'
import { fenetre, parCategorie, resumeFenetre, soldesJournaliers, type Granularite, type LigneAnalyse, type PointSolde } from '../domain/analyses'
import { formaterMontant } from '../domain/argent'
import { montantCompact } from '../domain/projection'
import type { Categorie, Devise } from '../domain/types'
import { useContexteBudget } from '../hooks/budget'
import { indexer, useCategories, useObjectifs } from '../hooks/donnees'
import { calculerProjection } from '../hooks/projection'
import { useNav } from '../nav/Navigation'
import { EditionOperation } from './operations/EditionOperation'

const BLEU = '#2F6FED'
interface Vue { id: string; libelle: string; comptes: Set<string>; devise: Devise; budget: boolean }

export function Analyses() {
  const nav = useNav()
  const ctx = useContexteBudget()
  const categories = useCategories()
  const objectifs = useObjectifs()
  const [vueId, setVueId] = useState('budget')
  const [granularite, setGranularite] = useState<Granularite>('paie')
  const [decalage, setDecalage] = useState(0)
  const [chargesFixes, setChargesFixes] = useState(false)
  const [ouverte, setOuverte] = useState<string | null | undefined>(undefined)

  const vues = useMemo<Vue[]>(() => {
    if (!ctx) return []
    const budgetComptes = ctx.comptes.filter((c) => ctx.budget.has(c.id))
    const principal = budgetComptes.find((c) => c.type !== 'carte_credit') ?? budgetComptes[0]
    const l: Vue[] = principal ? [{ id: 'budget', libelle: principal.nom.split(' – ')[0], comptes: ctx.budget, devise: principal.devise, budget: true }] : []
    for (const c of ctx.comptes) if (!ctx.budget.has(c.id) && c.type !== 'carte_credit') l.push({ id: c.id, libelle: c.nom, comptes: new Set([c.id]), devise: c.devise, budget: false })
    return l
  }, [ctx])
  const vue = vues.find((v) => v.id === vueId) ?? vues[0]
  const g: Granularite = granularite === 'paie' && !ctx?.paie ? 'mois' : granularite

  const donnees = useMemo(() => {
    if (!ctx || !vue || !objectifs) return undefined
    const f = fenetre(g, ctx.date, decalage, ctx.paie)
    if (!f) return undefined
    const precedente = fenetre(g, ctx.date, decalage - 1, ctx.paie)
    const comptesVue = ctx.comptes.filter((c) => vue.comptes.has(c.id))
    const points: PointSolde[] = soldesJournaliers(comptesVue, ctx.operations, f, ctx.date)
    // projection en pointillé jusqu'à la fin de la fenêtre (fenêtre en cours)
    if (f.fin > ctx.date && points.length) {
      const proj = calculerProjection(ctx, vue.comptes, vue.budget, Math.ceil((parseISO(f.fin).getTime() - parseISO(ctx.date).getTime()) / 86_400_000) + 1)
      const dernier = points[points.length - 1]
      dernier.projete = proj.get(ctx.date)?.solde ?? dernier.reel // raccord avec la courbe réelle (fin de journée projetée)
      for (const j of proj.values()) if (j.date > ctx.date && j.date <= f.fin) points.push({ date: j.date, projete: j.solde })
    }
    return {
      f, precedente, points,
      resume: resumeFenetre(comptesVue, ctx.operations, objectifs, f, ctx.date),
      lignes: parCategorie(ctx.operations, vue.comptes, f, precedente, { chargesFixes }),
    }
  }, [ctx, vue, objectifs, g, decalage, chargesFixes])

  if (!ctx || !vue || !categories) return <Ecran titre="Analyses"><div /></Ecran>
  const cats = indexer(categories)

  return (
    <Ecran titre="Analyses">
      {vues.length > 1 && (
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
          {vues.map((v) => (
            <button key={v.id} type="button" onClick={() => { setVueId(v.id); setOuverte(undefined) }}
              className={`min-h-[36px] shrink-0 rounded-full px-3.5 text-[14px] font-medium shadow-carte ${v.id === vue.id ? 'bg-bleu text-white' : 'bg-white text-encre'}`}>{v.libelle}</button>
          ))}
        </div>
      )}

      <div className="flex rounded-[10px] bg-trait/70 p-0.5" role="tablist" aria-label="Période d’analyse">
        {([['semaine', 'Semaine'], ['paie', 'Période de paie'], ['mois', 'Mois']] as const).filter(([k]) => k !== 'paie' || ctx.paie).map(([k, l]) => (
          <button key={k} type="button" role="tab" aria-selected={g === k} onClick={() => { setGranularite(k); setDecalage(0); setOuverte(undefined) }}
            className={`min-h-[34px] flex-1 rounded-[8px] text-[14px] font-semibold ${g === k ? 'bg-white text-encre shadow-sm' : 'text-encre-douce'}`}>{l}</button>
        ))}
      </div>

      <div className="flex items-center justify-between">
        <button type="button" aria-label="Période précédente" disabled={!fenetre(g, ctx.date, decalage - 1, ctx.paie)} onClick={() => { setDecalage(decalage - 1); setOuverte(undefined) }}
          className="flex h-11 w-11 items-center justify-center rounded-full text-bleu active:bg-white disabled:opacity-25"><IconeChevron taille={22} className="rotate-180" /></button>
        <p className="text-center text-[16px] font-semibold text-encre">{donnees?.f.libelle ?? '—'}{decalage === 0 && <span className="block text-[12px] font-normal text-encre-pale">en cours</span>}</p>
        <button type="button" aria-label="Période suivante" disabled={decalage >= 0} onClick={() => { setDecalage(decalage + 1); setOuverte(undefined) }}
          className="flex h-11 w-11 items-center justify-center rounded-full text-bleu active:bg-white disabled:opacity-25"><IconeChevron taille={22} /></button>
      </div>

      {!donnees ? <p className="rounded-carte bg-white p-5 text-center text-encre-douce shadow-carte">Pas de données pour cette période.</p> : (<>
        <Resume resume={donnees.resume} devise={vue.devise} enCours={donnees.f.fin >= ctx.date} />
        <CourbeSolde points={donnees.points} devise={vue.devise} />

        <div className="flex items-end justify-between">
          <TitreSection>Dépenses par catégorie</TitreSection>
          <button type="button" role="switch" aria-checked={chargesFixes} onClick={() => setChargesFixes(!chargesFixes)}
            className={`mb-0.5 min-h-[34px] rounded-full px-3 text-[13px] font-medium shadow-carte ${chargesFixes ? 'bg-bleu text-white' : 'bg-white text-encre-douce'}`}>
            {chargesFixes ? '✓ ' : '+ '}Charges fixes
          </button>
        </div>
        <Categories lignes={donnees.lignes} cats={cats} devise={vue.devise} ouverte={ouverte} surOuvrir={setOuverte}
          detail={(id) => ({
            sous: parCategorie(ctx.operations, vue.comptes, donnees.f, donnees.precedente, { chargesFixes, categorie: id ?? undefined }),
            ops: ctx.operations.filter((o) => vue.comptes.has(o.compteId) && o.date >= donnees.f.debut && o.date <= donnees.f.fin
              && (o.type === 'depense' || (chargesFixes && o.type === 'prelevement_fixe')) && (o.categorieId ?? null) === id).sort((a, b) => b.date.localeCompare(a.date)),
          })}
          comptes={indexer(ctx.comptes)} surOperation={(id) => nav.ouvrir(<EditionOperation id={id} />)} />
        <p className="px-1 text-[13px] leading-snug text-encre-pale">
          Comparaison avec {g === 'semaine' ? 'la semaine' : g === 'mois' ? 'le mois' : 'la période'} précédent{g === 'semaine' || g === 'paie' ? 'e' : ''} : en rouge si tu as dépensé plus.
          Exclus : virements, remboursements de carte, ajustements de solde.
        </p>
      </>)}
    </Ecran>
  )
}

function Resume({ resume, devise, enCours }: { resume: ReturnType<typeof resumeFenetre>; devise: Devise; enCours: boolean }) {
  const tuile = (libelle: string, montant: number, signe: '+' | '−' | '', fort = false) => (
    <div className="rounded-[12px] bg-fond px-3 py-2.5">
      <p className="text-[12px] text-encre-douce">{libelle}</p>
      <p className={`text-[17px] font-bold ${fort ? 'text-bleu' : 'text-encre'}`}>{signe}{formaterMontant(montant, devise).replace(/^−/, '')}</p>
    </div>
  )
  return (
    <section className="rounded-carte bg-white p-3 shadow-carte" aria-label="Résumé de la période">
      <div className="grid grid-cols-2 gap-2">
        {tuile('Revenus', resume.revenus, '+')}
        {tuile('Charges fixes', resume.chargesFixes, '−')}
        {tuile('Dépenses du quotidien', resume.depensesQuotidien, '−')}
        {tuile('Épargne mise de côté', resume.epargne, resume.epargne < 0 ? '−' : '')}
        <div className="col-span-2">{tuile(enCours ? 'Solde aujourd’hui' : 'Solde de fin', resume.soldeFin, resume.soldeFin < 0 ? '−' : '', true)}</div>
      </div>
    </section>
  )
}

function CourbeSolde({ points, devise }: { points: PointSolde[]; devise: Devise }) {
  if (points.length === 0) return null
  const valeurs = points.flatMap((p) => [p.reel, p.projete]).filter((v): v is number => v !== undefined)
  const negatif = Math.min(...valeurs) < 0
  const avecProjection = points.some((p) => p.projete !== undefined)
  return (
    <section className="rounded-carte bg-white px-2 pb-2 pt-3 shadow-carte" aria-label="Évolution du solde">
      <p className="px-2 text-[15px] font-semibold text-encre">Évolution du solde</p>
      {avecProjection && <p className="px-2 text-[12px] text-encre-pale">Trait plein : réel · pointillé : projeté</p>}
      <div className="h-[210px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={points} margin={{ top: 12, right: 12, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} stroke="#E3E7ED" />
            <XAxis dataKey="date" tickFormatter={(d) => String(Number(String(d).slice(8)))} tick={{ fontSize: 11, fill: '#98A0AE' }} tickLine={false} axisLine={{ stroke: '#E3E7ED' }} minTickGap={18} />
            <YAxis tickFormatter={(v) => montantCompact(v)} tick={{ fontSize: 11, fill: '#98A0AE' }} tickLine={false} axisLine={false} width={40} />
            {negatif && <ReferenceLine y={0} stroke="#E0524D" strokeDasharray="3 3" />}
            <Tooltip cursor={{ stroke: '#98A0AE', strokeWidth: 1 }} content={({ active, payload, label }) => {
              if (!active || !payload?.length) return null
              const p = payload[0].payload as PointSolde
              const v = p.reel ?? p.projete
              return (
                <div className="rounded-[10px] bg-white px-3 py-2 text-[13px] shadow-carte ring-1 ring-trait">
                  <p className="text-encre-douce">{format(parseISO(String(label)), 'EEEE d MMMM', { locale: fr })}</p>
                  <p className="font-semibold text-encre">{v !== undefined && formaterMontant(v, devise)}{p.reel === undefined && <span className="font-normal text-encre-pale"> (projeté)</span>}</p>
                </div>
              )
            }} />
            <Line type="linear" dataKey="reel" stroke={BLEU} strokeWidth={2} dot={false} activeDot={{ r: 5, stroke: '#fff', strokeWidth: 2 }} connectNulls={false} isAnimationActive={false} />
            <Line type="linear" dataKey="projete" stroke={BLEU} strokeWidth={2} strokeDasharray="5 4" dot={false} activeDot={{ r: 5, stroke: '#fff', strokeWidth: 2 }} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </section>
  )
}

function Comparaison({ montant, precedent, devise }: { montant: number; precedent: number; devise: Devise }) {
  const ecart = montant - precedent
  if (ecart === 0) return <span className="text-encre-pale">= période précédente</span>
  return (
    <span className={ecart > 0 ? 'text-rouge' : 'text-vert'}>
      {formaterMontant(ecart, devise, { signe: true })}{precedent ? ` (${ecart > 0 ? '+' : '−'}${Math.round((Math.abs(ecart) / precedent) * 100)} %)` : ''}
      <span className="text-encre-pale"> vs {formaterMontant(precedent, devise)}</span>
    </span>
  )
}

function Barres({ lignes, nom, devise, surClic, ouverte }: { lignes: LigneAnalyse[]; nom: (id: string | null) => string; devise: Devise; surClic?: (id: string | null) => void; ouverte?: string | null }) {
  const max = Math.max(1, ...lignes.map((l) => l.montant))
  return (
    <>
      {lignes.map((l) => (
        <button key={l.id ?? 'aucune'} type="button" disabled={!surClic} onClick={() => surClic?.(l.id)} aria-expanded={surClic ? ouverte === l.id : undefined}
          className="block w-full px-4 py-2.5 text-left active:bg-fond disabled:active:bg-transparent">
          <span className="flex items-baseline justify-between gap-2 text-[15px]">
            <span className="truncate text-encre">{nom(l.id)}</span>
            <span className="shrink-0 font-semibold text-encre">{formaterMontant(l.montant, devise)} <span className="font-normal text-encre-pale">· {Math.round(l.part * 100)} %</span></span>
          </span>
          <span className="mt-1.5 block h-2 rounded-full bg-fond">
            <span className="block h-full rounded-[4px]" style={{ width: `${Math.max(l.montant > 0 ? 1.5 : 0, (l.montant / max) * 100)}%`, background: BLEU }} />
          </span>
          <span className="mt-1 block text-[12px]"><Comparaison montant={l.montant} precedent={l.precedent} devise={devise} /></span>
        </button>
      ))}
    </>
  )
}

function Categories({ lignes, cats, devise, ouverte, surOuvrir, detail, comptes, surOperation }: {
  lignes: LigneAnalyse[]; cats: Map<string, Categorie>; devise: Devise; ouverte: string | null | undefined; surOuvrir: (id: string | null | undefined) => void
  detail: (id: string | null) => { sous: LigneAnalyse[]; ops: import('../domain/types').Operation[] }
  comptes: Map<string, import('../domain/types').Compte>; surOperation: (id: string) => void
}) {
  if (lignes.length === 0) return <p className="rounded-carte bg-white p-5 text-center text-[15px] text-encre-douce shadow-carte">Aucune dépense sur cette période.</p>
  const nom = (id: string | null) => { const c = id ? cats.get(id) : undefined; return c ? `${c.icone} ${c.nom}` : 'Sans catégorie' }
  return (
    <div className="divide-y divide-trait overflow-hidden rounded-carte bg-white shadow-carte">
      {lignes.map((l) => (
        <div key={l.id ?? 'aucune'}>
          <Barres lignes={[l]} nom={nom} devise={devise} ouverte={ouverte} surClic={(id) => surOuvrir(ouverte === id ? undefined : id)} />
          {ouverte === l.id && (() => {
            const d = detail(l.id)
            return (
              <div className="border-t border-trait bg-fond/60">
                {d.sous.some((s) => s.id !== null) && (
                  <div className="py-1"><Barres lignes={d.sous} devise={devise} nom={(id) => (id ? cats.get(id)?.nom ?? '—' : 'Sans sous-catégorie')} /></div>
                )}
                <div className="divide-y divide-trait border-t border-trait bg-white">
                  {d.ops.map((o) => <LigneOperation key={o.id} op={o} comptes={comptes} categories={cats} surClic={() => surOperation(o.id)} />)}
                </div>
              </div>
            )
          })()}
        </div>
      ))}
    </div>
  )
}
