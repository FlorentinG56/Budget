import { montantSigne } from './soldes'
import type { Categorie, Centimes, Compte, Operation, TypeOperation } from './types'

/** Export CSV des opérations, pour Excel en français : séparateur « ; », virgule décimale, UTF-8 avec BOM. */

const TYPES: Record<TypeOperation, string> = {
  depense: 'Dépense', revenu: 'Revenu', virement: 'Virement', remboursement_carte: 'Remboursement carte',
  ajustement: 'Ajustement', prelevement_fixe: 'Prélèvement',
}

const cellule = (v: string) => (/[;"\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v)
const nombre = (c: Centimes) => (c / 100).toFixed(2).replace('.', ',')

export function operationsVersCsv(operations: Operation[], comptes: Compte[], categories: Categorie[]): string {
  const c = new Map(comptes.map((x) => [x.id, x]))
  const cat = new Map(categories.map((x) => [x.id, x]))
  const entetes = ['Date', 'Type', 'Compte', 'Devise', 'Montant', 'Catégorie', 'Sous-catégorie', 'Note', 'Compte destination', 'Montant reçu', 'Budget du jour']
  const lignes = [...operations].sort((a, b) => a.date.localeCompare(b.date) || a.creeLe - b.creeLe).map((op) => {
    const compte = c.get(op.compteId)
    const dest = op.compteDestinationId ? c.get(op.compteDestinationId) : undefined
    const budget = op.type !== 'depense' ? '' : op.objectifEpargneId ? 'Payée avec l’épargne' : op.horsBudget ? 'À côté du budget' : 'Comptée'
    return [
      op.date, TYPES[op.type], compte?.nom ?? '', compte?.devise ?? '', nombre(montantSigne(op)),
      op.categorieId ? cat.get(op.categorieId)?.nom ?? '' : '', op.sousCategorieId ? cat.get(op.sousCategorieId)?.nom ?? '' : '',
      op.note ?? '', dest?.nom ?? '', op.montantRecu !== undefined ? nombre(op.montantRecu) : '', budget,
    ].map(cellule).join(';')
  })
  return '﻿' + [entetes.join(';'), ...lignes].join('\r\n') + '\r\n'
}
