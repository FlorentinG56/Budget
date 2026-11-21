import { useState } from 'react'
import { Feuille } from '../../components/Feuille'
import { Bouton, Champ, Groupe, Saisie } from '../../components/formulaire'
import { TitreSection } from '../../components/ui'
import { lireMontant, versTexteMontant } from '../../budget/ChampMontant'
import { modifierReglages } from '../../db/db'
import { IconeChevron } from '../../components/Icones'
import { modifierTauxCategorie } from '../../db/actions'
import { CATEGORIES_BIENS, SEUIL_BIENS_DEFAUT, tauxDuBien, type InfoCategorieBien } from '../../domain/biens'
import { useReglages } from '../../hooks/donnees'
import { Page } from '../../nav/Navigation'

/** Réglages → Catégories de biens : décote par an de chaque catégorie (estimations modifiables). */
export function CategoriesBiens() {
  const reglages = useReglages()
  const [ouverte, setOuverte] = useState<InfoCategorieBien | null>(null)
  if (!reglages) return <Page titre="Catégories de biens"><div /></Page>
  return (
    <Page titre="Catégories de biens">
      <p className="px-1 text-[14px] leading-snug text-encre-douce">Décote par an appliquée à la valeur restante. Ce sont des estimations : modifie-les si besoin. Chaque bien peut aussi avoir sa propre décote.</p>
      <Groupe>
        {CATEGORIES_BIENS.map((c) => {
          const t = tauxDuBien({ categorie: c.id }, reglages)
          const modifie = !!reglages.tauxBiens?.[c.id]
          return (
            <button key={c.id} type="button" onClick={() => setOuverte(c)} className="flex min-h-[54px] w-full items-center gap-3 px-4 py-2 text-left active:bg-fond">
              <span className="text-[22px]" aria-hidden="true">{c.icone}</span>
              <span className="min-w-0 flex-1 text-[16px] text-encre">{c.nom}</span>
              <span className={`text-right text-[15px] ${modifie ? 'font-semibold text-bleu' : 'text-encre-douce'}`}>
                {t.tauxAnnee1 !== undefined ? `${t.tauxAnnee1} % puis ${t.taux} %` : `${t.taux} %`}
              </span>
              <IconeChevron taille={16} className="text-encre-pale" />
            </button>
          )
        })}
      </Groupe>
      <SeuilBiens />
      <FeuilleTaux categorie={ouverte} surFermer={() => setOuverte(null)} />
    </Page>
  )
}

/** Seuil de « L'ajouter à tes biens ? » après une dépense (Shopping, Transport, Activité pro, Loisirs). */
function SeuilBiens() {
  const reglages = useReglages()
  const [texte, setTexte] = useState<string | null>(null)
  if (!reglages) return null
  const actuel = reglages.seuilBiens ?? SEUIL_BIENS_DEFAUT
  const valeur = texte === null ? versTexteMontant(actuel) : texte
  const montant = lireMontant(valeur)
  return (
    <>
      <TitreSection>Après une dépense</TitreSection>
      <Groupe>
        <Champ libelle="Proposer à partir de" aide={montant === null ? 'Montant invalide' : 'Shopping, Transport, Activité pro, Loisirs'}>
          <Saisie inputMode="decimal" value={valeur} onChange={(e) => setTexte(e.target.value)} aria-label="Seuil pour proposer d’ajouter aux biens"
            onBlur={() => { if (montant && montant !== actuel) void modifierReglages({ seuilBiens: montant }); setTexte(null) }} />
        </Champ>
      </Groupe>
      <p className="px-1 text-[12px] leading-snug text-encre-pale">« L’ajouter à tes biens ? » est proposé après une dépense d’au moins ce montant dans ces catégories (pas pour l’essence, le stationnement, les transports ni les réparations).</p>
    </>
  )
}

function FeuilleTaux({ categorie, surFermer }: { categorie: InfoCategorieBien | null; surFermer: () => void }) {
  const reglages = useReglages()
  const actuel = categorie && reglages ? tauxDuBien({ categorie: categorie.id }, reglages) : undefined
  const [taux, setTaux] = useState('')
  const [taux1, setTaux1] = useState('')
  const [pour, setPour] = useState<string | null>(null)
  if (categorie && pour !== categorie.id && actuel) { setPour(categorie.id); setTaux(String(actuel.taux)); setTaux1(String(actuel.tauxAnnee1 ?? '')) }
  const lire = (t: string) => { const v = Number(t.replace(',', '.')); return t.trim() !== '' && Number.isFinite(v) && v >= 0 && v <= 100 ? v : null }
  const vehicule = categorie?.id === 'vehicule'
  const valide = lire(taux) !== null && (!vehicule || lire(taux1) !== null)
  const champ = (libelle: string, v: string, set: (s: string) => void) => (
    <label className="flex min-h-[46px] items-center justify-between rounded-[12px] bg-white px-3 text-[16px] shadow-carte">
      <span className="text-encre-douce">{libelle}</span>
      <span className="flex items-center gap-1"><input inputMode="decimal" value={v} onChange={(e) => set(e.target.value)} aria-label={libelle} className="w-16 bg-transparent text-right text-encre outline-none" /> %</span>
    </label>
  )
  return (
    <Feuille ouverte={!!categorie} surFermer={() => { setPour(null); surFermer() }} titre={categorie?.nom ?? ''}>
      {categorie && (
        <div className="flex flex-col gap-2">
          {vehicule && champ('1re année', taux1, setTaux1)}
          {champ(vehicule ? 'Années suivantes' : 'Décote par an', taux, setTaux)}
          <p className="px-1 text-[12px] text-encre-pale">Par défaut : {categorie.tauxAnnee1 !== undefined ? `${categorie.tauxAnnee1} % puis ${categorie.taux} %` : `${categorie.taux} %`}</p>
          <Bouton disabled={!valide} onClick={async () => {
            await modifierTauxCategorie(categorie.id, { taux: lire(taux)!, ...(vehicule ? { tauxAnnee1: lire(taux1)! } : {}) }); setPour(null); surFermer()
          }}>Enregistrer</Bouton>
          {reglages?.tauxBiens?.[categorie.id] && (
            <Bouton variante="secondaire" onClick={async () => { await modifierTauxCategorie(categorie.id, null); setPour(null); surFermer() }}>Revenir au défaut</Bouton>
          )}
        </div>
      )}
    </Feuille>
  )
}
