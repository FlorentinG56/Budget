/** Enregistre un fichier : menu Partager d'iOS (Fichiers, iCloud Drive…) si possible, sinon téléchargement. Vrai si enregistré. */
export async function enregistrerFichier(nom: string, contenu: string | Blob, type: string): Promise<boolean> {
  const fichier = new File([contenu], nom, { type })
  if (navigator.canShare?.({ files: [fichier] })) {
    try {
      await navigator.share({ files: [fichier], title: nom })
      return true
    } catch (e) {
      if ((e as Error).name === 'AbortError') return false // annulé par l'utilisateur
    }
  }
  const url = URL.createObjectURL(fichier)
  const a = Object.assign(document.createElement('a'), { href: url, download: nom })
  document.body.append(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
  return true
}
