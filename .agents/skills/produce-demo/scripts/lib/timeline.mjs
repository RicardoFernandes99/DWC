import { clamp, readingSeconds, STANDARD } from './standard.mjs'

const words = (...parts) => parts.filter(Boolean).join(' ')

export function cardSeconds(kind, sb, chapter) {
  const [lo, hi] = STANDARD.cards[kind]
  switch (kind) {
    case 'title': {
      return clamp(
        Math.max(readingSeconds(words(sb.title, sb.subtitle)), sb.intro ? readingSeconds(sb.intro) + 1 : 0),
        lo,
        hi,
      )
    }
    case 'chapter': {
      return clamp(readingSeconds(words(chapter.label, chapter.title)), lo, hi)
    }
    case 'recap': {
      const cells = sb.recap.rows.flat().join(' ')
      return clamp(
        Math.max(1 + readingSeconds(cells) * 0.6, sb.recap.caption ? readingSeconds(sb.recap.caption) + 1 : 0),
        lo,
        hi,
      )
    }
    default: {
      return lo
    }
  }
}

export function plan(sb, takes) {
  const segments = [{ kind: 'title', seconds: cardSeconds('title', sb) }]
  sb.chapters.forEach((chapter, i) => {
    segments.push({ kind: 'chapter', index: i, seconds: cardSeconds('chapter', sb, chapter) })
    segments.push({ kind: 'scene', index: i, seconds: takes[i].duration })
  })
  if (sb.recap) {
    segments.push({ kind: 'recap', seconds: cardSeconds('recap', sb) })
  }
  segments.push({ kind: 'end', seconds: cardSeconds('end', sb) })
  return place(segments)
}

export function place(segments, transition = STANDARD.transition) {
  let cursor = 0
  const placed = segments.map((s, i) => {
    const start = i === 0 ? 0 : cursor - transition
    cursor = start + s.seconds
    return { ...s, start, end: cursor }
  })
  return { segments: placed, total: cursor, transition }
}

export const stamp = (seconds) => {
  const s = Math.max(0, Math.floor(seconds))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

export function chapterList(timeline, sb) {
  return timeline.segments
    .filter((s) => s.kind === 'chapter')
    .map((s) => ({ at: s.start, label: `${String(s.index + 1).padStart(2, '0')} · ${sb.chapters[s.index].title}` }))
}
