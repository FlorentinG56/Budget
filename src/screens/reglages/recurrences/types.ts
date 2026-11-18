export type Genre = 'charges' | 'revenus'

export const versTexte = (c: number) => (c / 100).toFixed(2).replace('.', ',')
