export function calcEta(progressPercent: number, elapsedMs: number): number {
  if (progressPercent <= 0 || progressPercent >= 100) return 0
  const elapsedSec = elapsedMs / 1000
  return Math.round((elapsedSec / progressPercent) * (100 - progressPercent))
}
