import { format, parseISO } from 'date-fns'
import { fr } from 'date-fns/locale/fr'
import type { DateISO } from './types'

export function versISO(d: Date): DateISO {
  return format(d, 'yyyy-MM-dd')
}

export function aujourdhui(): DateISO {
  return versISO(new Date())
}

/** « Aujourd'hui », « Hier », sinon « mardi 11 novembre » (avec l'année si ce n'est pas l'année en cours). */
export function libelleJour(date: DateISO, reference: DateISO = aujourdhui()): string {
  if (date === reference) return 'Aujourd’hui'
  const ref = parseISO(reference)
  const hier = versISO(new Date(ref.getFullYear(), ref.getMonth(), ref.getDate() - 1))
  if (date === hier) return 'Hier'
  const d = parseISO(date)
  const texte = format(d, d.getFullYear() === ref.getFullYear() ? 'EEEE d MMMM' : 'EEEE d MMMM yyyy', { locale: fr })
  return texte.charAt(0).toUpperCase() + texte.slice(1)
}

export function libelleCourt(date: DateISO): string {
  return format(parseISO(date), 'd MMM yyyy', { locale: fr })
}
