import { format, parseISO } from 'date-fns'
import { fr } from 'date-fns/locale/fr'
import { formaterMontant } from '../domain/argent'
import { inventaire, textePdf } from '../domain/biens'
import type { Bien, PhotoBien, Reglages } from '../domain/types'

/**
 * Inventaire pour l'assurance (PDF), généré sur l'iPhone, sans serveur : photo, nom, catégorie, date d'acquisition,
 * prix d'achat, valeur actuelle, numéro de série, état, photo de la facture ; totaux par devise ; date en en-tête.
 */
export async function genererInventairePdf(biens: Bien[], photos: PhotoBien[], date: string, reglages?: Pick<Reglages, 'tauxBiens'>): Promise<Blob> {
  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const t = (s: string) => textePdf(s)
  const photo = new Map(photos.map((p) => [p.id, p.donnees]))
  const { lignes, totaux } = inventaire(biens, date, reglages)
  const M = 15, L = 210 - 2 * M, BAS = 282
  const jour = format(parseISO(date), 'd MMMM yyyy', { locale: fr })
  let y = M

  const entete = () => {
    doc.setFont('helvetica', 'bold'); doc.setFontSize(18); doc.setTextColor(20, 27, 45)
    doc.text(t('Inventaire des biens'), M, y + 6)
    doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(100, 108, 122)
    doc.text(t(`Établi le ${jour} · ${lignes.length} bien${lignes.length > 1 ? 's' : ''}`), M, y + 12)
    y += 18
    doc.setDrawColor(220, 224, 230); doc.line(M, y, M + L, y); y += 5
  }
  entete()

  for (const l of lignes) {
    const b = l.bien
    const p = b.photoId ? photo.get(b.photoId) : undefined
    const f = b.factureId ? photo.get(b.factureId) : undefined
    const infos: [string, string][] = [
      ['Catégorie', l.categorie],
      ['Acquis le', format(parseISO(b.dateAcquisition), 'd MMMM yyyy', { locale: fr })],
      [b.origine === 'neuf' ? "Prix d'achat" : b.origine === 'cadeau' && b.cadeauNeuf ? 'Prix neuf (cadeau)' : 'Prix estimé', formaterMontant(b.prixAchat, b.devise)],
      ['Valeur actuelle', formaterMontant(l.valeur, b.devise)],
      ['État', l.etat],
      ...(b.numeroSerie ? [['N° de série', b.numeroSerie] as [string, string]] : []),
    ]
    const hauteur = Math.max(p || f ? 40 : 0, 8 + infos.length * 5.2) + 6
    if (y + hauteur > BAS) { doc.addPage(); y = M }
    const xTexte = p ? M + 44 : M
    if (p) await image(doc, p, M, y, 40, 40)
    doc.setFont('helvetica', 'bold'); doc.setFontSize(13); doc.setTextColor(20, 27, 45)
    doc.text(t(b.nom), xTexte, y + 5, { maxWidth: L - (xTexte - M) - (f ? 30 : 0) })
    doc.setFontSize(10)
    infos.forEach(([k, v], i) => {
      const yy = y + 11 + i * 5.2
      doc.setFont('helvetica', 'normal'); doc.setTextColor(100, 108, 122); doc.text(t(k), xTexte, yy)
      doc.setTextColor(20, 27, 45); doc.text(t(v), xTexte + 32, yy)
    })
    if (f) {
      await image(doc, f, M + L - 26, y, 26, 34)
      doc.setFontSize(8); doc.setTextColor(100, 108, 122); doc.text('Facture', M + L - 13, y + 38, { align: 'center' })
    }
    y += hauteur
    doc.setDrawColor(230, 233, 238); doc.line(M, y - 3, M + L, y - 3)
  }

  // totaux par devise
  if (y + 12 + totaux.size * 12 > BAS) { doc.addPage(); y = M }
  y += 3
  doc.setFont('helvetica', 'bold'); doc.setFontSize(13); doc.setTextColor(20, 27, 45); doc.text('Totaux', M, y + 4); y += 10
  doc.setFontSize(10)
  for (const [d, tt] of totaux) {
    doc.setFont('helvetica', 'normal'); doc.setTextColor(100, 108, 122)
    doc.text(t(`${d === 'CAD' ? 'Dollars canadiens' : 'Euros'} · ${tt.nombre} bien${tt.nombre > 1 ? 's' : ''}`), M, y)
    doc.setTextColor(20, 27, 45)
    doc.text(t(`Prix d'achat total : ${formaterMontant(tt.achat, d)}`), M, y + 5.5)
    doc.setFont('helvetica', 'bold'); doc.text(t(`Valeur actuelle totale : ${formaterMontant(tt.valeur, d)}`), M + 90, y + 5.5)
    y += 13
  }
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(140, 146, 158)
  doc.text(t("Valeurs actuelles estimées selon la décote annuelle et l'état de chaque bien."), M, Math.min(y + 2, 290))

  const n = doc.getNumberOfPages()
  for (let i = 1; i <= n; i++) {
    doc.setPage(i); doc.setFontSize(8); doc.setTextColor(140, 146, 158)
    doc.text(t(`Inventaire du ${jour} · page ${i} / ${n}`), 210 - M, 292, { align: 'right' })
  }
  return doc.output('blob')
}

/** Ajoute une photo en gardant ses proportions dans le cadre donné. */
async function image(doc: import('jspdf').jsPDF, donnees: string, x: number, y: number, l: number, h: number) {
  const dims = await new Promise<{ w: number; h: number }>((ok) => {
    const img = new Image(); img.onload = () => ok({ w: img.naturalWidth || 1, h: img.naturalHeight || 1 }); img.onerror = () => ok({ w: 1, h: 1 }); img.src = donnees
  })
  const r = Math.min(l / dims.w, h / dims.h)
  const w = dims.w * r, hh = dims.h * r
  try { doc.addImage(donnees, 'JPEG', x + (l - w) / 2, y + (h - hh) / 2, w, hh) } catch { /* photo illisible : ignorée */ }
}
