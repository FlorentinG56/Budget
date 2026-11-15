import type { SVGProps } from 'react'

type P = SVGProps<SVGSVGElement> & { taille?: number }

function Base({ taille = 24, children, ...p }: P) {
  return (
    <svg width={taille} height={taille} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9}
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...p}>
      {children}
    </svg>
  )
}

export const IconeAccueil = (p: P) => (
  <Base {...p}><path d="M3.5 10.5 12 4l8.5 6.5" /><path d="M5.5 9v10a1 1 0 0 0 1 1H10v-5.5h4V20h3.5a1 1 0 0 0 1-1V9" /></Base>
)
export const IconeCalendrier = (p: P) => (
  <Base {...p}><rect x="3.5" y="5" width="17" height="15.5" rx="3" /><path d="M3.5 10h17M8 3v4M16 3v4" /></Base>
)
export const IconeAnalyses = (p: P) => (
  <Base {...p}><path d="M5 20V12M12 20V5M19 20v-9" /></Base>
)
export const IconeEpargne = (p: P) => (
  <Base {...p}><path d="M5 11a7 6 0 0 1 12.6-3.5H20v4l-1.6 1A6.5 6.5 0 0 1 15 17v3h-3v-2h-2v2H7v-3.4A6 6 0 0 1 5 11Z" /><circle cx="15.5" cy="10.5" r=".6" fill="currentColor" /><path d="M10 6.5h3" /></Base>
)
export const IconeReglages = (p: P) => (
  <Base {...p}><circle cx="12" cy="12" r="3" /><path d="M12 2.8v2.4M12 18.8v2.4M4.9 4.9l1.7 1.7M17.4 17.4l1.7 1.7M2.8 12h2.4M18.8 12h2.4M4.9 19.1l1.7-1.7M17.4 6.6l1.7-1.7" /></Base>
)
export const IconePlus = (p: P) => (
  <Base strokeWidth={2.4} {...p}><path d="M12 5v14M5 12h14" /></Base>
)
export const IconeEffacer = (p: P) => (
  <Base {...p}><path d="M9 5h10a1.5 1.5 0 0 1 1.5 1.5v11A1.5 1.5 0 0 1 19 19H9l-6-7 6-7Z" /><path d="m12 9.5 5 5M17 9.5l-5 5" /></Base>
)
export const IconeCadenas = (p: P) => (
  <Base {...p}><rect x="5" y="10.5" width="14" height="10" rx="2.5" /><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" /></Base>
)
export const IconeChevron = (p: P) => (
  <Base {...p}><path d="m9 6 6 6-6 6" /></Base>
)
export const IconePartager = (p: P) => (
  <Base {...p}><path d="M12 3v12M8 7l4-4 4 4" /><path d="M7 11H6a1.5 1.5 0 0 0-1.5 1.5v6A1.5 1.5 0 0 0 6 20h12a1.5 1.5 0 0 0 1.5-1.5v-6A1.5 1.5 0 0 0 18 11h-1" /></Base>
)
export const IconeFermer = (p: P) => (
  <Base {...p}><path d="M6 6l12 12M18 6 6 18" /></Base>
)
