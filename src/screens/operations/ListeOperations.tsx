import { endOfMonth, startOfMonth, subMonths } from 'date-fns'
import { useMemo, useState } from 'react'
import { LigneOperation } from '../../components/LigneOperation'
import { formaterMontant } from '../../domain/argent'
import { categoriesPrincipales } from '../../domain/categories'
import { libelleJour, versISO } from '../../domain/dates'
import { filtrerOperations, grouperParJour, type FiltreOperations } from '../../domain/operations'
import { indexer, useCategories, useComptes, useOperations } from '../../hooks/donnees'
import { Page, useNav } from '../../nav/Navigation'
import { EditionOperation } from './EditionOperation'

type Periode = 'mois' | 'mois_precedent' | '3_mois' | 'tout'

function bornes(p: Periode): Pick<FiltreOperations, 'du' | 'au'> {
  const maintenant = new Date()
  switch (p) {
    case 'mois': return { du: versISO(startOfMonth(maintenant)), au: versISO(endOfMonth(maintenant)) }
    case 'mois_precedent': { const m = subMonths(maintenant, 1); return { du: versISO(startOfMonth(m)), au: versISO(endOfMonth(m)) } }
    case '3_mois': return { du: versISO(startOfMonth(subMonths(maintenant, 2))) }
    case 'tout': return {}
  }
}

function Filtre({ valeur, surChange, options, actif, libelle }: {
  valeur: string; surChange: (v: string) => void; options: { valeur: string; libelle: string }[]; actif: boolean; libelle: string
}) {
  const courant = options.find((o) => o.valeur === valeur)?.libelle ?? ''
  return (
    <label className={`relative flex min-h-[36px] shrink-0 items-center rounded-full px-3.5 text-[14px] font-medium shadow-carte ${actif ? 'bg-bleu text-white' : 'bg-white text-encre'}`}>
      <select value={valeur} onChange={(e) => surChange(e.target.value)} className="absolute inset-0 opacity-0" aria-label={libelle}>
        {options.map((o) => <option key={o.valeur} value={o.valeur}>{o.libelle}</option>)}
      </select>
      <span className="pointer-events-none max-w-[170px] truncate">{courant}</span>
      <span className="pointer-events-none ml-1 text-[10px] opacity-70" aria-hidden="true">▼</span>
    </label>
  )
}

export function ListeOperations({ compteInitial }: { compteInitial?: string }) {
  const nav = useNav()
  const comptes = useComptes(true)
  const categories = useCategories()
  const operations = useOperations()
  const [compteId, setCompteId] = useState(compteInitial ?? '')
  const [categorieId, setCategorieId] = useState('')
  const [periode, setPeriode] = useState<Periode>('mois')

  const mapComptes = indexer(comptes)
  const mapCats = indexer(categories)
  const groupes = useMemo(
    () => grouperParJour(filtrerOperations(operations ?? [], { compteId: compteId || undefined, categorieId: categorieId || undefined, ...bornes(periode) })),
    [operations, compteId, categorieId, periode],
  )
  const compteFiltre = compteId ? mapComptes.get(compteId) : undefined

  return (
    <Page titre="Opérations">
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
        <Filtre libelle="Période" valeur={periode} surChange={(v) => setPeriode(v as Periode)} actif={periode !== 'tout'} options={[
          { valeur: 'mois', libelle: 'Ce mois' },
          { valeur: 'mois_precedent', libelle: 'Mois dernier' },
          { valeur: '3_mois', libelle: '3 derniers mois' },
          { valeur: 'tout', libelle: 'Toute la période' },
        ]} />
        <Filtre libelle="Compte" valeur={compteId} surChange={setCompteId} actif={!!compteId}
          options={[{ valeur: '', libelle: 'Tous les comptes' }, ...(comptes ?? []).map((c) => ({ valeur: c.id, libelle: c.nom }))]} />
        <Filtre libelle="Catégorie" valeur={categorieId} surChange={setCategorieId} actif={!!categorieId}
          options={[{ valeur: '', libelle: 'Toutes catégories' }, ...categoriesPrincipales(categories ?? []).map((c) => ({ valeur: c.id, libelle: `${c.icone} ${c.nom}` }))]} />
      </div>

      {operations && groupes.length === 0 && (
        <p className="rounded-carte bg-white p-6 text-center text-[15px] text-encre-douce shadow-carte">Aucune opération pour ces filtres.</p>
      )}

      {groupes.map((g) => {
        // total du jour seulement si toutes les opérations sont dans la même devise
        const devises = new Set(g.operations.map((o) => mapComptes.get(o.compteId)?.devise))
        const depenses = g.operations.filter((o) => o.type === 'depense').reduce((s, o) => s + o.montant, 0)
        const devise = devises.size === 1 ? [...devises][0] : undefined
        return (
          <section key={g.date}>
            <div className="flex items-baseline justify-between px-1 pb-1.5 pt-2">
              <h2 className="text-[13px] font-semibold uppercase tracking-wide text-encre-pale">{libelleJour(g.date)}</h2>
              {devise && depenses > 0 && <span className="text-[13px] text-encre-pale">{formaterMontant(-depenses, devise)}</span>}
            </div>
            <div className="divide-y divide-trait overflow-hidden rounded-carte bg-white shadow-carte">
              {g.operations.map((op) => (
                <LigneOperation key={op.id} op={op} comptes={mapComptes} categories={mapCats} masquerCompte={!!compteFiltre}
                  surClic={() => nav.ouvrir(<EditionOperation id={op.id} />)} />
              ))}
            </div>
          </section>
        )
      })}
    </Page>
  )
}
