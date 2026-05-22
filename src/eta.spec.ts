import { calcEta } from './eta'

describe('calcEta', () => {
  it('returns 0 when progress is 0', () => {
    expect(calcEta(0, 60_000)).toBe(0)
  })

  it('estimates remaining time correctly', () => {
    // 50% done in 60s → ~60s remaining
    expect(calcEta(50, 60_000)).toBeCloseTo(60, 0)
  })

  it('returns 0 when progress is 100', () => {
    expect(calcEta(100, 5_000)).toBe(0)
  })

  it('handles progress >0 <100', () => {
    const eta = calcEta(25, 30_000)
    expect(eta).toBeGreaterThan(0)
    expect(eta).toBe(90) // 25% in 30s → 75% remaining = 90s
  })
})
