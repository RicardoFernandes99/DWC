export const STANDARD = {
  stage: { width: 1920, height: 1080 },
  scale: 2,
  fps: 30,
  transition: 0.5,
  minWidth: 1920,
  takeAspect: 1.6,
  loudness: { target: -20, tolerance: 1.5, truePeak: -2 },
  dropout: { noise: -50, seconds: 0.8 },
  jump: { db: 10 },
  freeze: { seconds: 6 },
  black: { seconds: 0.5 },
  caption: { maxLines: 2, maxChars: 120, warnChars: 90, maxCps: 20, warnCps: 15, minCoverage: 0.5 },
  chapter: { maxSeconds: 75, warnCount: 10 },
  title: { maxChars: 48 },
  label: { maxChars: 28 },
  callout: { maxChars: 40 },
  reading: { cps: 15, lead: 1.2 },
  cards: { title: [4, 8], chapter: [3, 3.5], recap: [5, 14], end: [4, 4] },
  video: { warnMinutes: 6 },
}

export function readingSeconds(text) {
  return STANDARD.reading.lead + String(text ?? '').length / STANDARD.reading.cps
}

export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v))

const issue = (level) => (rule, where, message) => ({ level, rule, where, message })
export const error = issue('error')
export const warn = issue('warn')
