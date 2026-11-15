import { createContext, useContext } from 'react'
import { formaterMontant } from '../domain/argent'
import { libelleCourt } from '../domain/dates'
import type { Compte, Operation } from '../domain/types'
import { IconeFermer } from './Icones'

/** Opérations automatiques créées depuis la dernière visite (prélèvements et revenus récurrents). */
export const EcheancesCtx = createContext<{ recentes: Operation[]; effacer: () => void }>({ recentes: [], effacer: () => {} })
export const useEcheancesRecentes = () => useContext(EcheancesCtx)

export function BandeauEcheances({ comptes, surOuvrir }: { comptes: Map<string, Compte>; surOuvrir: (op: Operation) => void }) {
  const { recentes, effacer } = useEcheancesRecentes()
  if (recentes.length === 0) return null
  const prelevements = recentes.filter((o) => o.type !== 'revenu')
  const revenus = recentes.filter((o) => o.type === 'revenu')

  const bloc = (titre: string, ops: Operation[], couleur: string) => ops.length > 0 && (
    <div>
      <p className={`text-[14px] font-semibold ${couleur}`}>{titre}</p>
      <ul className="mt-1">
        {[...ops].sort((a, b) => a.date.localeCompare(b.date)).map((o) => {
          const c = comptes.get(o.compteId)
          return (
            <li key={o.id}>
              <button type="button" onClick={() => surOuvrir(o)} className="flex min-h-[36px] w-full items-center justify-between gap-2 text-left text-[15px] active:opacity-60">
                <span className="min-w-0 truncate text-encre">{o.note}<span className="text-encre-pale"> · {libelleCourt(o.date)}{c?.type === 'carte_credit' ? ' · carte' : ''}</span></span>
                <span className="shrink-0 font-semibold text-encre">{c && formaterMontant(o.type === 'revenu' ? o.montant : -o.montant, c.devise, { signe: o.type === 'revenu' })}</span>
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )

  return (
    <section className="relative rounded-carte bg-white p-4 pr-12 shadow-carte" aria-label="Depuis ta dernière visite">
      <button type="button" onClick={effacer} aria-label="Masquer" className="absolute right-1.5 top-1.5 flex h-11 w-11 items-center justify-center rounded-full text-encre-pale active:bg-fond">
        <IconeFermer taille={18} />
      </button>
      <div className="space-y-2.5">
        {bloc('Prélevé depuis ta dernière visite', prelevements, 'text-rouge')}
        {bloc('Crédité depuis ta dernière visite', revenus, 'text-vert')}
      </div>
      <p className="mt-2 text-[12px] text-encre-pale">Touche une ligne pour la modifier ou l’annuler si la banque a décalé la date.</p>
    </section>
  )
}
