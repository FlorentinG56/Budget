import { IconePartager } from './Icones'

export function estInstallee(): boolean {
  return window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true
}

/** Affiché tant que l'app est ouverte dans un onglet Safari et pas depuis l'écran d'accueil. */
export function BandeauInstallation() {
  if (estInstallee()) return null
  return (
    <section className="rounded-carte border border-bleu/20 bg-bleu-pale p-4">
      <h3 className="text-[16px] font-semibold text-bleu-fonce">Installe l’app sur ton iPhone</h3>
      <ol className="mt-2 space-y-1 text-[15px] leading-snug text-encre">
        <li>1. Touche <IconePartager taille={17} className="-mt-1 inline text-bleu" /> <b>Partager</b> en bas de Safari.</li>
        <li>2. Choisis <b>Sur l’écran d’accueil</b>, puis <b>Ajouter</b>.</li>
        <li>3. Ouvre <b>Budget</b> depuis l’icône.</li>
      </ol>
      <p className="mt-2 text-[13px] leading-snug text-encre-douce">
        Important : l’app installée et cet onglet Safari ne partagent pas leurs données. Saisis tout dans l’app installée.
      </p>
    </section>
  )
}
