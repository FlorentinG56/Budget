import { formaterMontant } from '../domain/argent'
import { montantSigne } from '../domain/soldes'
import type { Categorie, Compte, Operation, TypeOperation } from '../domain/types'

const LIBELLES_TYPE: Record<TypeOperation, { libelle: string; icone: string }> = {
  depense: { libelle: 'Dépense', icone: '💸' },
  revenu: { libelle: 'Revenu', icone: '💰' },
  virement: { libelle: 'Virement', icone: '🔁' },
  remboursement_carte: { libelle: 'Remboursement carte', icone: '💳' },
  ajustement: { libelle: 'Ajustement', icone: '⚖️' },
  prelevement_fixe: { libelle: 'Prélèvement', icone: '📅' },
}

export function descriptionOperation(op: Operation, categories: Map<string, Categorie>) {
  const cat = op.categorieId ? categories.get(op.categorieId) : undefined
  const sous = op.sousCategorieId ? categories.get(op.sousCategorieId) : undefined
  const type = LIBELLES_TYPE[op.type]
  return {
    titre: sous?.nom ?? cat?.nom ?? (op.type === 'revenu' && op.note ? op.note : type.libelle),
    icone: cat?.icone || type.icone,
    couleur: cat?.couleur ?? '#98A0AE',
  }
}

export function LigneOperation({ op, comptes, categories, surClic, masquerCompte }: {
  op: Operation
  comptes: Map<string, Compte>
  categories: Map<string, Categorie>
  surClic?: () => void
  masquerCompte?: boolean
}) {
  const compte = comptes.get(op.compteId)
  const { titre, icone, couleur } = descriptionOperation(op, categories)
  const montant = montantSigne(op)
  const sousTitre = [masquerCompte ? null : compte?.nom, op.type === 'revenu' && titre === op.note ? null : op.note].filter(Boolean).join(' · ')
  return (
    <button type="button" onClick={surClic} className="flex min-h-[58px] w-full items-center gap-3 px-4 py-2 text-left active:bg-fond">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[20px]" style={{ background: `${couleur}22` }} aria-hidden="true">
        {icone}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[16px] font-medium text-encre">{titre}</span>
        {sousTitre && <span className="block truncate text-[13px] text-encre-pale">{sousTitre}</span>}
      </span>
      <span className={`shrink-0 text-[16px] font-semibold ${op.type === 'revenu' ? 'text-vert' : op.type === 'ajustement' ? 'text-encre-douce' : 'text-encre'}`}>
        {compte ? formaterMontant(montant, compte.devise, { signe: true }) : ''}
      </span>
    </button>
  )
}
