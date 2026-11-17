import { format } from 'date-fns'
import { fr } from 'date-fns/locale/fr'
import { BandeauEcheances } from '../components/BandeauEcheances'
import { BandeauInstallation } from '../components/BandeauInstallation'
import { BandeauPaies } from '../components/BandeauPaies'
import { IconeChevron } from '../components/Icones'
import { LigneOperation } from '../components/LigneOperation'
import { Carte, Ecran, TitreSection } from '../components/ui'
import { CarteBudget } from '../budget/CarteBudget'
import { RembourserCarte } from '../budget/RembourserCarte'
import { useState } from 'react'
import { formaterMontant } from '../domain/argent'
import { aujourdhui } from '../domain/dates'
import { trierRecentes } from '../domain/operations'
import { montantDuCarte, soldeCompte } from '../domain/soldes'
import { indexer, useCategories, useComptes, useOperations, useRecurrences, useReglages } from '../hooks/donnees'
import { useNav } from '../nav/Navigation'
import { EditionOperation } from './operations/EditionOperation'
import { ListeOperations } from './operations/ListeOperations'
import { EditionCompte, ListeComptes, texteSolde } from './reglages/Comptes'

export function Accueil() {
  const nav = useNav()
  const [remboursement, setRemboursement] = useState(false)
  const comptes = useComptes()
  const categories = useCategories()
  const operations = useOperations()
  const reglages = useReglages()
  const recurrences = useRecurrences()
  const date = aujourdhui()
  const titreDate = format(new Date(), 'EEEE d MMMM', { locale: fr })

  if (!comptes || !categories || !operations || !reglages || !recurrences) return <Ecran titre="Accueil"><div /></Ecran>

  const principal = comptes?.find((c) => c.type === 'cheque' && c.inclusBudgetJournalier)
  const carte = comptes?.find((c) => c.type === 'carte_credit' && c.compteRemboursementId === principal?.id)
  const autres = (comptes ?? []).filter((c) => c.id !== principal?.id && c.id !== carte?.id)
  const ops = operations ?? []
  const dernieres = trierRecentes(ops.filter((o) => o.type === 'depense' && o.date <= date)).slice(0, 5)
  const mapComptes = indexer(comptes)
  const mapCats = indexer(categories)

  const solde = principal ? soldeCompte(principal, ops, date) : 0
  const du = carte ? montantDuCarte(carte, ops, date) : 0

  return (
    <Ecran titre="Accueil" action={<span className="inline-block pb-1.5 text-[15px] text-encre-douce first-letter:uppercase">{titreDate}</span>}>
      <BandeauInstallation />
      <BandeauPaies recurrences={recurrences} comptes={mapComptes} />
      <BandeauEcheances comptes={mapComptes} surOuvrir={(op) => nav.ouvrir(<EditionOperation id={op.id} />)} />

      {reglages && !reglages.soldesDepartSaisis && (
        <button type="button" onClick={() => nav.ouvrir(<ListeComptes />)}
          className="flex items-center gap-3 rounded-carte border border-bleu/20 bg-bleu-pale p-4 text-left active:opacity-80">
          <span className="text-[26px]" aria-hidden="true">🏁</span>
          <span className="flex-1">
            <span className="block text-[16px] font-semibold text-bleu-fonce">Indique le solde de tes comptes</span>
            <span className="block text-[14px] leading-snug text-encre-douce">Une seule fois : l’app calcule ensuite tout à partir de là.</span>
          </span>
          <IconeChevron taille={20} className="text-bleu" />
        </button>
      )}

      <CarteBudget devise={principal?.devise ?? 'CAD'} />

      {principal && (
        <Carte>
          <button type="button" onClick={() => nav.ouvrir(<EditionCompte id={principal.id} />)} className="block w-full text-left">
            <p className="flex items-center gap-2 text-[14px] font-medium text-encre-douce">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: principal.couleur }} />{principal.nom}
            </p>
            <p className={`mt-0.5 text-[34px] font-bold leading-tight tracking-tight ${solde < 0 ? 'text-rouge' : 'text-encre'}`}>{formaterMontant(solde, principal.devise)}</p>
          </button>
          {carte && du !== 0 && (
            <div className="mt-3 space-y-1.5 border-t border-trait pt-3 text-[15px]">
              <p className="flex justify-between"><span className="text-encre-douce">Montant dû sur la carte</span><span className="font-semibold text-encre">{formaterMontant(du, carte.devise)}</span></p>
              <p className="flex justify-between"><span className="text-encre-douce">Solde après remboursement</span>
                <span className={`font-semibold ${solde - du < 0 ? 'text-rouge' : 'text-bleu'}`}>{formaterMontant(solde - du, principal.devise)}</span></p>
              {du > 0 && (
                <button type="button" onClick={() => setRemboursement(true)}
                  className="mt-1.5 min-h-[44px] w-full rounded-[12px] bg-bleu-pale text-[15px] font-semibold text-bleu active:opacity-70">
                  💳 Rembourser la carte
                </button>
              )}
            </div>
          )}
          {carte && <RembourserCarte ouverte={remboursement} surFermer={() => setRemboursement(false)} carte={carte} compte={principal} du={du} />}
        </Carte>
      )}


      <div className="flex items-baseline justify-between">
        <TitreSection>Dernières dépenses</TitreSection>
        {ops.length > 0 && (
          <button type="button" onClick={() => nav.ouvrir(<ListeOperations />)} className="min-h-[44px] px-1 pt-3 text-[15px] font-medium text-bleu">Tout voir</button>
        )}
      </div>
      {dernieres.length === 0 ? (
        <p className="rounded-carte bg-white p-5 text-center text-[15px] text-encre-douce shadow-carte">Touche <b className="text-bleu">+</b> pour saisir ta première dépense.</p>
      ) : (
        <div className="divide-y divide-trait overflow-hidden rounded-carte bg-white shadow-carte">
          {dernieres.map((op) => (
            <LigneOperation key={op.id} op={op} comptes={mapComptes} categories={mapCats} surClic={() => nav.ouvrir(<EditionOperation id={op.id} />)} />
          ))}
        </div>
      )}

      {autres.length > 0 && (
        <>
          <TitreSection>Autres comptes</TitreSection>
          <div className="grid grid-cols-2 gap-2.5">
            {autres.map((c) => (
              <button key={c.id} type="button" onClick={() => nav.ouvrir(<EditionCompte id={c.id} />)}
                className="rounded-carte bg-white p-3.5 text-left shadow-carte active:bg-fond">
                <span className="flex items-center gap-1.5 text-[13px] text-encre-douce">
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: c.couleur }} /><span className="truncate">{c.nom}</span>
                </span>
                <span className="mt-1 block text-[18px] font-semibold text-encre">{texteSolde(c, soldeCompte(c, ops, date))}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </Ecran>
  )
}
