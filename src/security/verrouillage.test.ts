import { describe, expect, it } from 'vitest'
import { doitVerrouiller } from './verrouillage'

describe('doitVerrouiller', () => {
  const t0 = 1_000_000
  it('ne verrouille pas si l’app n’a pas été masquée', () => {
    expect(doitVerrouiller(null, t0, 2)).toBe(false)
  })
  it('verrouille après le délai', () => {
    expect(doitVerrouiller(t0, t0 + 119_000, 2)).toBe(false)
    expect(doitVerrouiller(t0, t0 + 120_000, 2)).toBe(true)
  })
  it('verrouille tout de suite avec un délai de 0', () => {
    expect(doitVerrouiller(t0, t0, 0)).toBe(true)
  })
})
