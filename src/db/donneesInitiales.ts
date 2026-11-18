import type { Categorie } from '../domain/types'

const CATEGORIES: [string, string, string, string[]][] = [
  ['Alimentation', '🛒', '#F59E0B', ['Épicerie', 'Restaurant', 'Café/boulangerie', 'Fast-food/livraison']],
  ['Transport', '🚗', '#3B82F6', ['Essence', 'Entretien/réparations', 'Stationnement', 'Transport en commun', 'Taxi/Uber']],
  ['Logement', '🏠', '#8B5CF6', ['Loyer', 'Électricité', 'Internet/téléphone', 'Assurance habitation', 'Maison/entretien']],
  ['Santé et bien-être', '💊', '#10B981', ['Pharmacie', 'Médecin/dentiste', 'Sport/gym', 'Soins perso']],
  ['Loisirs', '🎉', '#EC4899', ['Sorties/bars', 'Cinéma/spectacles', 'Activités', 'Hobbies']],
  ['Shopping', '🛍️', '#F97316', ['Vêtements', 'Électronique', 'Déco/maison']],
  ['Abonnements', '📺', '#6366F1', ['Streaming', 'Applis/logiciels', 'Autres']],
  ['Crédits et frais', '🏦', '#64748B', ['Remboursement prêts', 'Frais bancaires', 'Intérêts carte']],
  ['Voyages', '✈️', '#06B6D4', ['Billets', 'Hébergement', 'Dépenses sur place']],
  ['Activité pro', '💼', '#0EA5E9', ['Matériel', 'Logiciels', 'Déplacements']],
  ['Cadeaux et dons', '🎁', '#EF4444', ['Cadeaux', 'Dons']],
  ['Divers', '📦', '#94A3B8', ['Imprévus', 'Autres']],
]

function identifiant(nom: string): string {
  return nom.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

/** Catégories proposées à un nouvel utilisateur (modifiables ensuite), avec identifiants stables (ex. « alimentation », « alimentation/epicerie »). Aucun compte n'est créé d'office : le parcours d'accueil s'en charge. */
export function categoriesInitiales(): Categorie[] {
  const liste: Categorie[] = []
  CATEGORIES.forEach(([nom, icone, couleur, sous], i) => {
    const id = identifiant(nom)
    liste.push({ id, nom, icone, couleur, ordre: i, archivee: false })
    sous.forEach((s, j) => liste.push({ id: `${id}/${identifiant(s)}`, nom: s, icone: '', couleur, parentId: id, ordre: j, archivee: false }))
  })
  return liste
}
