import type { Categorie, Compte, DateISO } from '../domain/types'

/** Comptes de départ (cahier des charges, « Comptes bancaires »). Soldes à 0 : l'utilisateur les renseigne. */
export function comptesInitiaux(date: DateISO): Compte[] {
  const base = { soldeDepart: 0, dateDepart: date, archive: false }
  return [
    { ...base, id: 'chq', nom: 'Compte courant', type: 'cheque', devise: 'CAD', couleur: '#00874E', inclusBudgetJournalier: true, ordre: 0 },
    { ...base, id: 'carte', nom: 'Carte de crédit', type: 'carte_credit', devise: 'CAD', couleur: '#2E9C6A', compteRemboursementId: 'chq', inclusBudgetJournalier: true, ordre: 1 },
    { ...base, id: 'eur', nom: 'Compte en euros', type: 'cheque', devise: 'EUR', couleur: '#008C8C', inclusBudgetJournalier: false, ordre: 2 },
    { ...base, id: 'voyage', nom: 'Compte voyage', type: 'cheque', devise: 'EUR', couleur: '#3D4A5C', inclusBudgetJournalier: false, ordre: 3 },
    { ...base, id: 'activite', nom: 'Compte secondaire', type: 'cheque', devise: 'EUR', couleur: '#7A5AF8', inclusBudgetJournalier: false, ordre: 4 },
  ]
}

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

/** Catégories validées, avec identifiants stables (ex. « alimentation », « alimentation/epicerie »). */
export function categoriesInitiales(): Categorie[] {
  const liste: Categorie[] = []
  CATEGORIES.forEach(([nom, icone, couleur, sous], i) => {
    const id = identifiant(nom)
    liste.push({ id, nom, icone, couleur, ordre: i, archivee: false })
    sous.forEach((s, j) => liste.push({ id: `${id}/${identifiant(s)}`, nom: s, icone: '', couleur, parentId: id, ordre: j, archivee: false }))
  })
  return liste
}
