import { useEffect, useState, type ReactNode } from 'react'
import { estInstallee } from '../components/BandeauInstallation'
import { Feuille } from '../components/Feuille'
import { IconeChevron } from '../components/Icones'
import { Ecran, TitreSection } from '../components/ui'
import { ChoixCode, messageEchec } from '../lock/EcransVerrou'
import { PavePin } from '../lock/PavePin'
import { useVerrou } from '../lock/Verrou'
import { useNav } from '../nav/Navigation'
import { useReglages } from '../hooks/donnees'
import { modifierReglages } from '../db/db'
import { ListeOperations } from './operations/ListeOperations'
import { ListeCategories } from './reglages/Categories'
import { ListeComptes } from './reglages/Comptes'
import { PageSauvegarde } from './reglages/Sauvegarde'
import { activerFaceId, faceIdDisponible } from '../security/faceid'
import { ListeRecurrences } from './reglages/Recurrences'
import { PeriodeBudget } from './reglages/PeriodeBudget'
import { ListeVoyages } from './voyages/Voyages'
import { PageAbonnements } from './analyses/Abonnements'
import { CHOIX_DELAI_VERROUILLAGE } from '../security/verrouillage'
import { rechercherMiseAJour, type ResultatMiseAJour } from '../miseAJour'

function Groupe({ children }: { children: ReactNode }) {
  return <div className="divide-y divide-trait overflow-hidden rounded-carte bg-white shadow-carte">{children}</div>
}

function Ligne({ libelle, valeur, surClic, danger }: { libelle: string; valeur?: ReactNode; surClic?: () => void; danger?: boolean }) {
  const contenu = (
    <>
      <span className={`text-[17px] ${danger ? 'text-rouge' : 'text-encre'}`}>{libelle}</span>
      <span className="flex items-center gap-1.5 text-[15px] text-encre-douce">
        {valeur}
        {surClic && <IconeChevron taille={18} className="text-encre-pale" />}
      </span>
    </>
  )
  const cls = 'flex min-h-[50px] w-full items-center justify-between gap-3 px-4 py-2.5 text-left'
  return surClic ? <button type="button" onClick={surClic} className={`${cls} active:bg-fond`}>{contenu}</button> : <div className={cls}>{contenu}</div>
}

type Modal = null | 'delai' | 'code' | 'alerte' | 'rappel'

export function Reglages() {
  const { delaiMinutes, changerDelai, verrouiller } = useVerrou()
  const reglages = useReglages()
  const nav = useNav()
  const [modal, setModal] = useState<Modal>(null)
  const [persistant, setPersistant] = useState<boolean | null>(null)
  const [maj, setMaj] = useState<ResultatMiseAJour | 'recherche' | null>(null)
  const texteMaj = { recherche: 'Recherche…', a_jour: 'Déjà à jour ✓', installation: 'Installation…', indisponible: 'Indisponible ici', hors_connexion: 'Hors connexion' }

  useEffect(() => { void navigator.storage?.persisted?.().then(setPersistant) }, [])

  const libelleDelai = CHOIX_DELAI_VERROUILLAGE.find((c) => c.minutes === delaiMinutes)?.libelle ?? `${delaiMinutes} min`

  return (
    <Ecran titre="Réglages">
      <TitreSection>Données</TitreSection>
      <Groupe>
        <Ligne libelle="Comptes" surClic={() => nav.ouvrir(<ListeComptes />)} />
        <Ligne libelle="Catégories" surClic={() => nav.ouvrir(<ListeCategories />)} />
        <Ligne libelle="Toutes les opérations" surClic={() => nav.ouvrir(<ListeOperations />)} />
        <Ligne libelle="Charges fixes et crédits" surClic={() => nav.ouvrir(<ListeRecurrences genre="charges" />)} />
        <Ligne libelle="Revenus récurrents" surClic={() => nav.ouvrir(<ListeRecurrences genre="revenus" />)} />
        <Ligne libelle="Période du budget" surClic={() => nav.ouvrir(<PeriodeBudget />)} />
        <Ligne libelle="Abonnements" surClic={() => nav.ouvrir(<PageAbonnements />)} />
        <Ligne libelle="Voyages" surClic={() => nav.ouvrir(<ListeVoyages />)} />
      </Groupe>

      <TitreSection>Alertes</TitreSection>
      <Groupe>
        <Ligne libelle="Prévenir des charges" valeur={reglages ? (reglages.delaiAlerteJours === 0 ? 'Jamais' : `${reglages.delaiAlerteJours} jour${reglages.delaiAlerteJours > 1 ? 's' : ''} avant`) : '…'} surClic={() => setModal('alerte')} />
        <Ligne libelle="Rappel de sauvegarde" valeur={reglages ? (reglages.rappelSauvegardeJours === 0 ? 'Jamais' : `Tous les ${reglages.rappelSauvegardeJours} jours`) : '…'} surClic={() => setModal('rappel')} />
      </Groupe>
      <p className="px-1 text-[13px] leading-snug text-encre-pale">Les bandeaux s’affichent en haut de l’accueil : charges à venir, budget du jour dépassé, solde projeté négatif, fin d’un crédit. Touche × pour en masquer un jusqu’au lendemain.</p>

      <TitreSection>Sécurité</TitreSection>
      <Groupe>
        <Ligne libelle="Modifier le code" surClic={() => setModal('code')} />
        <Ligne libelle="Verrouillage auto" valeur={libelleDelai} surClic={() => setModal('delai')} />
        <LigneFaceId />
        <Ligne libelle="Verrouiller maintenant" surClic={verrouiller} danger />
      </Groupe>

      <TitreSection>Sauvegarde</TitreSection>
      <Groupe>
        <Ligne libelle="Sauvegarde, restauration, export CSV" surClic={() => nav.ouvrir(<PageSauvegarde />)} />
      </Groupe>

      <TitreSection>Cet appareil</TitreSection>
      <Groupe>
        <Ligne libelle="App installée" valeur={estInstallee() ? 'Oui' : 'Non (onglet Safari)'} />
        <Ligne libelle="Stockage protégé" valeur={persistant === null ? '…' : persistant ? 'Oui' : 'Non'} />
        <Ligne libelle="Version" valeur={__APP_VERSION__} />
        <Ligne libelle="Rechercher une mise à jour" valeur={maj ? texteMaj[maj] : undefined}
          surClic={async () => { setMaj('recherche'); setMaj(await rechercherMiseAJour()) }} />
      </Groupe>
      <p className="px-1 pb-2 text-[13px] leading-snug text-encre-pale">
        Toutes les données restent sur cet iPhone. Supprimer l’icône de l’app efface ses données : pense à faire des sauvegardes.
      </p>

      <Feuille ouverte={modal === 'delai'} surFermer={() => setModal(null)} titre="Verrouillage auto">
        <p className="mb-3 text-[15px] text-encre-douce">L’app se verrouille quand elle reste en arrière-plan plus longtemps que ce délai.</p>
        <Groupe>
          {CHOIX_DELAI_VERROUILLAGE.map((c) => (
            <Ligne key={c.minutes} libelle={c.libelle} valeur={c.minutes === delaiMinutes ? <span className="font-semibold text-bleu">✓</span> : null}
              surClic={() => { void changerDelai(c.minutes); setModal(null) }} />
          ))}
        </Groupe>
      </Feuille>

      <Feuille ouverte={modal === 'alerte'} surFermer={() => setModal(null)} titre="Prévenir des charges">
        <p className="mb-3 text-[15px] text-encre-douce">Un bandeau annonce chaque charge fixe ou mensualité qui arrive (ex. « Dans 2 jours : Loyer – 1 200 $ »).</p>
        <Groupe>
          {[0, 1, 2, 3, 5, 7].map((j) => (
            <Ligne key={j} libelle={j === 0 ? 'Jamais' : `${j} jour${j > 1 ? 's' : ''} avant`} valeur={reglages?.delaiAlerteJours === j ? <span className="font-semibold text-bleu">✓</span> : null}
              surClic={() => { void modifierReglages({ delaiAlerteJours: j }); setModal(null) }} />
          ))}
        </Groupe>
      </Feuille>
      <Feuille ouverte={modal === 'rappel'} surFermer={() => setModal(null)} titre="Rappel de sauvegarde">
        <p className="mb-3 text-[15px] text-encre-douce">Supprimer l’icône de l’app efface ses données : un bandeau te rappelle de faire une sauvegarde.</p>
        <Groupe>
          {[0, 7, 14, 30].map((j) => (
            <Ligne key={j} libelle={j === 0 ? 'Jamais' : `Tous les ${j} jours`} valeur={reglages?.rappelSauvegardeJours === j ? <span className="font-semibold text-bleu">✓</span> : null}
              surClic={() => { void modifierReglages({ rappelSauvegardeJours: j }); setModal(null) }} />
          ))}
        </Groupe>
      </Feuille>

      {modal === 'code' && <ModifierCode surFin={() => setModal(null)} />}
    </Ecran>
  )
}

function ModifierCode({ surFin }: { surFin: () => void }) {
  const { verifier, changerPin } = useVerrou()
  const [ancienOk, setAncienOk] = useState(false)
  const [fait, setFait] = useState(false)

  useEffect(() => {
    if (!fait) return
    const t = setTimeout(surFin, 1200)
    return () => clearTimeout(t)
  }, [fait, surFin])

  return (
    <div className="fixed inset-0 z-50 bg-fond">
      <button type="button" onClick={surFin} className="absolute right-4 top-[calc(env(safe-area-inset-top)+8px)] z-10 min-h-[44px] px-2 text-[17px] text-bleu">
        Annuler
      </button>
      {fait ? (
        <div className="flex h-full items-center justify-center text-[20px] font-semibold text-vert">Code modifié ✓</div>
      ) : !ancienOk ? (
        <PavePin titre="Code actuel" sousTitre="Saisis ton code actuel." surCode={async (pin) => {
          const r = await verifier(pin)
          if (r.ok) setAncienOk(true)
          return messageEchec(r)
        }} />
      ) : (
        <ChoixCode titreInitial="Nouveau code" surValide={async (pin) => { await changerPin(pin); setFait(true) }} />
      )}
    </div>
  )
}

function LigneFaceId() {
  const reglages = useReglages()
  const { rafraichirFaceId } = useVerrou()
  const [dispo, setDispo] = useState<boolean | null>(null)
  const [erreur, setErreur] = useState('')
  useEffect(() => { void faceIdDisponible().then(setDispo) }, [])
  const actif = !!reglages?.faceIdActive && !!reglages.faceIdIdentifiant
  const basculer = async () => {
    setErreur('')
    if (actif) { await modifierReglages({ faceIdActive: false }); await rafraichirFaceId(); return }
    try {
      const id = await activerFaceId()
      await modifierReglages({ faceIdActive: true, faceIdIdentifiant: id }); await rafraichirFaceId()
    } catch {
      setErreur('Face ID n’a pas pu être activé.')
    }
  }
  return (
    <div className="px-4 py-2">
      <div className="flex min-h-[34px] items-center justify-between gap-3">
        <span className="text-[17px] text-encre">Face ID</span>
        {dispo === false ? <span className="text-[15px] text-encre-pale">Indisponible ici</span> : (
          <button type="button" role="switch" aria-checked={actif} aria-label="Face ID" onClick={() => void basculer()} disabled={dispo === null}
            className={`relative h-[31px] w-[51px] shrink-0 rounded-full transition-colors ${actif ? 'bg-vert' : 'bg-trait'}`}>
            <span className={`absolute top-[2px] h-[27px] w-[27px] rounded-full bg-white shadow transition-transform ${actif ? 'translate-x-[22px]' : 'translate-x-[2px]'}`} />
          </button>
        )}
      </div>
      <p className="pb-1 text-[12px] leading-snug text-encre-pale">
        {dispo === false ? 'Face ID n’est disponible que dans l’app installée sur l’iPhone.' : 'Raccourci pour ouvrir l’app ; ton code à 6 chiffres reste toujours valable.'}
        {erreur && <span className="block text-rouge">{erreur}</span>}
      </p>
    </div>
  )
}
