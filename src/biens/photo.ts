import { dimensionsReduites, tailleDataUrl } from '../domain/biens'

const CIBLE = 300 * 1024 // environ 300 Ko

/**
 * Compresse une photo sur l'iPhone (jamais envoyée ailleurs) : 1 600 px de côté au plus, JPEG d'environ 300 Ko.
 */
export async function compresserPhoto(fichier: File): Promise<{ donnees: string; taille: number }> {
  const image = await chargerImage(fichier)
  const { largeur, hauteur } = dimensionsReduites(image.width, image.height)
  const canvas = document.createElement('canvas')
  canvas.width = largeur; canvas.height = hauteur
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Photo illisible')
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, largeur, hauteur)
  ctx.drawImage(image, 0, 0, largeur, hauteur)
  let qualite = 0.85
  let donnees = canvas.toDataURL('image/jpeg', qualite)
  while (tailleDataUrl(donnees) > CIBLE && qualite > 0.35) {
    qualite -= 0.1
    donnees = canvas.toDataURL('image/jpeg', qualite)
  }
  if ('close' in image) image.close()
  return { donnees, taille: tailleDataUrl(donnees) }
}

async function chargerImage(fichier: File): Promise<ImageBitmap | HTMLImageElement> {
  try {
    return await createImageBitmap(fichier, { imageOrientation: 'from-image' })
  } catch {
    const url = URL.createObjectURL(fichier)
    try {
      return await new Promise<HTMLImageElement>((ok, ko) => {
        const img = new Image()
        img.onload = () => ok(img); img.onerror = () => ko(new Error('Photo illisible')); img.src = url
      })
    } finally { setTimeout(() => URL.revokeObjectURL(url), 1000) }
  }
}
