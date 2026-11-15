import { IconeEffacer } from '../components/Icones'

const TOUCHES = ['1', '2', '3', '4', '5', '6', '7', '8', '9', ',', '0', '⌫'] as const

/** Ajoute une touche à la saisie en respectant le format « 12345,67 » (2 décimales, 7 chiffres avant). */
export function appliquerTouche(valeur: string, touche: string): string {
  if (touche === '⌫') return valeur.slice(0, -1)
  if (touche === ',') return valeur.includes(',') ? valeur : (valeur || '0') + ','
  const [entier, dec] = valeur.split(',')
  if (dec !== undefined) return dec.length >= 2 ? valeur : valeur + touche
  if (entier === '0') return touche
  return entier.length >= 7 ? valeur : valeur + touche
}

export function PaveNumerique({ valeur, surChange }: { valeur: string; surChange: (v: string) => void }) {
  return (
    <div className="grid grid-cols-3 gap-1.5">
      {TOUCHES.map((t) => (
        <button key={t} type="button" onClick={() => surChange(appliquerTouche(valeur, t))} aria-label={t === '⌫' ? 'Effacer' : t === ',' ? 'Virgule' : t}
          className="flex h-[42px] items-center justify-center rounded-[12px] bg-white text-[24px] text-encre shadow-carte active:bg-bleu-pale">
          {t === '⌫' ? <IconeEffacer taille={24} className="text-encre-douce" /> : t}
        </button>
      ))}
    </div>
  )
}
