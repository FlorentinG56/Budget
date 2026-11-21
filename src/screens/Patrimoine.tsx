import { useState } from 'react'
import { Ecran } from '../components/ui'
import { formaterMontant } from '../domain/argent'
import { totauxBiens, valeurNette } from '../domain/biens'
import { aujourdhui } from '../domain/dates'
import { dettes, totalDettes } from '../domain/dettes'
import { totalEpargne } from '../domain/epargne'
import { useBiens, useComptes, useOperations, useRecurrences, useReglages } from '../hooks/donnees'
import { SectionBiens } from './biens/Biens'
import { SectionDettes, SectionEpargne } from './Epargne'

type Section = 'epargne' | 'dettes' | 'biens'
const SECTIONS: [Section, string][] = [['epargne', 'Épargne'], ['dettes', 'Dettes'], ['biens', 'Biens']]

/** Onglet Patrimoine : valeur nette, puis trois sections (Épargne, Dettes, Biens). */
export function Patrimoine() {
  const [section, setSection] = useState<Section>(() => {
    try { return (sessionStorage.getItem('patrimoine') as Section) || 'epargne' } catch { return 'epargne' }
  })
  const choisir = (s: Section) => { setSection(s); try { sessionStorage.setItem('patrimoine', s) } catch { /* rien */ } }
  return (
    <Ecran titre="Patrimoine">
      <ValeurNette />
      <div className="flex rounded-[12px] bg-encre/5 p-1" role="radiogroup" aria-label="Section">
        {SECTIONS.map(([id, nom]) => (
          <button key={id} type="button" role="radio" aria-checked={section === id} onClick={() => choisir(id)}
            className={`min-h-[38px] flex-1 rounded-[9px] text-[15px] font-semibold ${section === id ? 'bg-white text-encre shadow-carte' : 'text-encre-douce'}`}>{nom}</button>
        ))}
      </div>
      {section === 'epargne' && <SectionEpargne />}
      {section === 'dettes' && <SectionDettes />}
      {section === 'biens' && <SectionBiens />}
    </Ecran>
  )
}

/** Par devise : valeur nette = épargne (comptes épargne) + valeur actuelle des biens − capital restant dû des dettes. */
function ValeurNette() {
  const comptes = useComptes()
  const operations = useOperations()
  const recurrences = useRecurrences()
  const biens = useBiens()
  const reglages = useReglages()
  if (!comptes || !operations || !recurrences || !biens || !reglages) return <div className="h-[118px] rounded-carte bg-white shadow-carte" />
  const date = aujourdhui()
  const epargne = totalEpargne(comptes, operations, date)
  const tb = totauxBiens(biens, date, reglages)
  const td = totalDettes(dettes(recurrences, operations, comptes, date))
  const nette = valeurNette(epargne, tb, td)
  const devises = [...nette.keys()]
  const ligne = (libelle: string, valeurs: [string, number][], signe: '' | '−' | '+') => valeurs.length > 0 && (
    <p className="flex justify-between gap-2 text-[14px] text-encre-douce"><span>{libelle}</span>
      <span className="text-right">{valeurs.map(([d, v]) => `${signe === '−' ? '−' : ''}${formaterMontant(v, d as 'CAD')}`).join(' + ')}</span></p>
  )
  return (
    <section className="rounded-carte bg-white p-4 shadow-carte" aria-label="Valeur nette">
      <p className="text-[14px] font-medium text-encre-douce">Valeur nette</p>
      <p className={`text-[30px] font-bold leading-tight tracking-tight ${[...nette.values()].some((v) => v < 0) ? 'text-encre' : 'text-vert'}`}>
        {devises.length === 0 ? formaterMontant(0, 'CAD') : devises.map((d) => formaterMontant(nette.get(d)!, d)).join(' + ')}
      </p>
      <div className="mt-1 space-y-0.5">
        {ligne('Épargne', [...epargne].filter(([, v]) => v !== 0), '+')}
        {ligne('Biens', [...tb].map(([d, t]) => [d, t.valeur]), '+')}
        {ligne('Dettes', [...td].filter(([, v]) => v !== 0), '−')}
      </div>
      <p className="mt-1.5 text-[12px] leading-snug text-encre-pale">Épargne + valeur actuelle des biens − capital restant dû, par devise (sans conversion).</p>
    </section>
  )
}
