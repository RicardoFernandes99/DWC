import { paceFinding } from './copy.mjs'
import { error, STANDARD, warn } from './standard.mjs'
import { LAYOUT } from './templates.mjs'

export function parseSteps(jsonl) {
  return String(jsonl)
    .split('\n')
    .filter((line) => line.trim())
    .map((line) => JSON.parse(line))
}

function displayUrl(url, host) {
  try {
    const u = new URL(url)
    const path = u.pathname.replace(/\/$/, '')
    return host === '' ? path || '/' : `${host ?? u.host}${path}`
  } catch {
    return undefined
  }
}

export function readTake(steps, { duration, host, width }) {
  const ok = steps.filter((s) => s.outcome === 'ok')
  const start = steps.find((s) => s.op === 'start')
  const captions = ok
    .filter((s) => s.op === 'caption' && s.text)
    .map((s) => {
      const at = (s.shown?.at ?? s.at) / 1000
      return { text: s.text, at, until: Math.min(duration, at + (s.shown?.ms ?? 2500) / 1000) }
    })
  for (let i = 0; i < captions.length - 1; i++) {
    captions[i].until = Math.min(captions[i].until, captions[i + 1].at)
  }
  const urls = []
  const push = (at, url) => {
    const shown = displayUrl(url, host)
    if (shown && urls.at(-1)?.url !== shown) {
      urls.push({ at: Math.max(0, Math.min(at, duration)), url: shown })
    }
  }
  if (start?.url) {
    push(0, start.page ?? start.url)
  }
  ok.forEach((s, i) => {
    if (s.op === 'start') {
      return
    }
    for (const nav of s.navigated ?? []) {
      push(nav.at / 1000, nav.url)
    }
    if (s.page) {
      const next = ok[i + 1]?.at ?? Number.POSITIVE_INFINITY
      push((s.end ?? Math.min(s.at + (s.ms ?? 0), next)) / 1000, s.page)
    }
  })
  urls.forEach((u, i) => {
    u.until = urls[i + 1]?.at ?? duration
  })
  const callouts = ok
    .filter((s) => s.op === 'callout' && s.text && s.pin && s.box)
    .map((s) => {
      const at = (s.shown?.at ?? s.at) / 1000
      const until = Math.min(duration, at + (s.shown?.ms ?? 2500) / 1000)
      return { text: s.text, at, until, box: s.box, pin: s.pin, view: start?.viewport }
    })
  return {
    captions,
    callouts,
    urls,
    mode: {
      captions: start?.captions ?? 'draw',
      viewport: start?.viewport,
      preview: Boolean(start?.preview),
      clock: start?.clock,
    },
    zooms: ok.filter((s) => s.op === 'zoom').length,
    errors: steps.filter((s) => s.outcome === 'error'),
    duration,
    width,
  }
}

export function captionCoverage(take, where) {
  let covered = 0
  let reach = 0
  for (const c of take.captions) {
    const from = Math.max(c.at, reach)
    const to = Math.min(c.until, take.duration)
    covered += Math.max(0, to - from)
    reach = Math.max(reach, to)
  }
  const share = take.duration > 0 ? covered / take.duration : 1
  return share < STANDARD.caption.minCoverage
    ? [
        warn(
          'caption-coverage',
          where,
          `captions are up for ${Math.round(share * 100)}% of the chapter; hold each as long as it takes to read, or add one, so the scene is not watched in silence`,
        ),
      ]
    : []
}

export function chapterLength(seconds, where) {
  return seconds > STANDARD.chapter.maxSeconds
    ? [
        warn(
          'chapter-length',
          where,
          `${Math.round(seconds)} s; a chapter past ${STANDARD.chapter.maxSeconds} s loses the viewer`,
        ),
      ]
    : []
}

export function joinTakes(parts, fps) {
  let offset = 0
  const captions = []
  const callouts = []
  const urls = []
  const cuts = []
  for (const part of parts) {
    const frames = Math.max(1, Math.round(part.duration * fps))
    const seconds = frames / fps
    const shift = (x) => ({ ...x, at: x.at + offset, until: Math.min(x.until, seconds) + offset })
    captions.push(...part.captions.map(shift))
    callouts.push(...part.callouts.map(shift))
    for (const u of part.urls) {
      const until = (u.until >= part.duration ? seconds : Math.min(u.until, seconds)) + offset
      if (urls.at(-1)?.url === u.url) {
        urls.at(-1).until = until
      } else {
        urls.push({ url: u.url, at: u.at + offset, until })
      }
    }
    cuts.push({ path: part.path, info: part.info, frames })
    offset += seconds
  }
  return { captions, callouts, urls, cuts, duration: offset }
}

export function withCopy(take, copy = {}) {
  const used = new Set()
  const swap = (text) => {
    if (Object.hasOwn(copy, text)) {
      used.add(text)
      return copy[text]
    }
    return text
  }
  return {
    take: {
      ...take,
      captions: take.captions.map((c) => ({ ...c, text: swap(c.text) })),
      callouts: take.callouts.map((c) => {
        const text = swap(c.text)
        return { ...c, text, edited: text !== c.text }
      }),
    },
    unused: Object.keys(copy).filter((key) => !used.has(key)),
  }
}

export function takeFindings(logged, where, copy) {
  const { take } = withCopy(logged, copy)
  if (take.mode.preview) {
    return [
      error(
        'preview-log',
        where,
        'its step log is from a DEMO_PREVIEW run, which does not belong to the video beside it (record-demo before 1.6.0 wrote a preview over the take); re-film it',
      ),
    ]
  }
  const out = []
  if (take.mode.clock === undefined) {
    out.push(
      error(
        'clock',
        where,
        'was filmed before record-demo anchored its step log to the video, so its words and addresses would land about 0.6 s early; re-film it',
      ),
    )
  } else if (take.mode.clock !== 'first-frame') {
    out.push(
      warn(
        'clock',
        where,
        "record-demo could not time the recording's first frame, so its words and addresses may land up to a second early",
      ),
    )
  }
  if (take.errors.length > 0) {
    out.push(error('partial-take', where, `a step failed (${take.errors[0].op}: ${take.errors[0].error}); re-film it`))
  }
  if (take.mode.captions !== 'log' && take.captions.length > 0) {
    out.push(
      error(
        'captions-in-page',
        where,
        'was filmed with captions drawn in the page, so they would show twice; re-film with DEMO_CAPTIONS=log',
      ),
    )
  }
  const [w, h] = take.mode.viewport ?? []
  if (w && h && Math.abs(w / h - STANDARD.takeAspect) > 0.01) {
    out.push(error('aspect', where, `was filmed at ${w}x${h}; the frame takes 16:10, as DEMO_VIEWPORT="1440 900 2"`))
  }
  const needed = LAYOUT.content.width * STANDARD.scale
  if (take.width && take.width < needed) {
    out.push(
      error(
        'resolution',
        where,
        `is ${take.width} px wide; the window needs ${needed}, so it would be upscaled and blur`,
      ),
    )
  }
  if (take.zooms > 0) {
    out.push(
      warn('zoom', where, `zooms ${take.zooms} time(s); a zoom hides the screen around it, so keep the full frame`),
    )
  }
  for (const [kind, list] of [
    ['caption', take.captions],
    ['callout', take.callouts],
  ]) {
    for (const c of list) {
      const pace = paceFinding(c.text, c.until - c.at, `${where}, ${kind} at ${c.at.toFixed(1)} s`)
      if (pace) {
        out.push(pace)
      }
    }
  }
  return out
}
