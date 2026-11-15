import { useEffect, useState, type ReactNode } from 'react'
import { estInstallee } from '../components/BandeauInstallation'
import { Feuille } from '../components/Feuille'
import { IconeChevron } from '../components/Icones'
import { Ecran, TitreSection } from '../components/ui'
import { ChoixCode, messageEchec } from '../lock/EcransVerrou'
import { PavePin } from '../lock/PavePin'
import { useVerrou } from '../lock/Verrou'
import { useNav } from '../nav/Navigation'
import { ListeOperations } from './operations/ListeOperations'
import { ListeCategories } from './reglages/Categories'
import { ListeComptes } from './reglages/Comptes'
import { ListeRecurrences } from './reglages/Recurrences'
import { CHOIX_DELAI_VERROUILLAGE } from '../security/verrouillage'
import { rechercherMiseAJour, type ResultatMiseAJour } from '../miseAJour'

function Groupe({ children }: { children: ReactNode }) {
  return <div className="divide-y divide-trait overflow-hidden rounded-carte bg-white shadow-carte">{children}</div>
}

function Ligne({ libelle, valeur, surClic, etape, danger }: { libelle: string; valeur?: ReactNode; surClic?: () => void; etape?: number; danger?: boolean }) {
  const contenu = (
    <>
      <span className={`text-[17px] ${danger ? 'text-rouge' : etape ? 'text-encre-pale' : 'text-encre'}`}>{libelle}</span>
      <span className="flex items-center gap-1.5 text-[15px] text-encre-douce">
        {etape ? <span className="rounded-full bg-fond px-2 py-0.5 text-[12px] font-semibold text-encre-pale">Étape {etape}</span> : valeur}
        {surClic && <IconeChevron taille={18} className="text-encre-pale" />}
      </span>
    </>
  )
  const cls = 'flex min-h-[50px] w-full items-center justify-between gap-3 px-4 py-2.5 text-left'
  return surClic ? <button type="button" onClick={surClic} className={`${cls} active:bg-fond`}>{contenu}</button> : <div className={cls}>{contenu}</div>
}

type Modal = null | 'delai' | 'code'

export function Reglages() {
  const { delaiMinutes, changerDelai, verrouiller } = useVerrou()
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
        <Ligne libelle="Période du budget" etape={5} />
      </Groupe>

      <TitreSection>Sécurité</TitreSection>
      <Groupe>
        <Ligne libelle="Modifier le code" surClic={() => setModal('code')} />
        <Ligne libelle="Verrouillage auto" valeur={libelleDelai} surClic={() => setModal('delai')} />
        <Ligne libelle="Face ID" etape={10} />
        <Ligne libelle="Verrouiller maintenant" surClic={verrouiller} danger />
      </Groupe>

      <TitreSection>Sauvegarde</TitreSection>
      <Groupe>
        <Ligne libelle="Sauvegarde chiffrée" etape={10} />
        <Ligne libelle="Export CSV" etape={10} />
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
        Toutes les données restent sur cet iPhone. Supprimer l’icône de l’app efface ses données : pense à faire des sauvegardes (étape 10).
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
