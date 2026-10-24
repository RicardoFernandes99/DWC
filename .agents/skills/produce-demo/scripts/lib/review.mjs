import { STANDARD } from './standard.mjs'
import { stamp } from './timeline.mjs'

const num = (s) => Number.parseFloat(s)

export function parseEbur128(stderr) {
  const summary = stderr.slice(stderr.lastIndexOf('Summary:'))
  const pick = (re) => {
    const m = summary.match(re)
    return m ? num(m[1]) : undefined
  }
  return {
    I: pick(/I:\s+(-?[\d.]+) LUFS/),
    LRA: pick(/LRA:\s+(-?[\d.]+) LU/),
    peak: /Peak:\s+-inf/.test(summary) ? Number.NEGATIVE_INFINITY : pick(/Peak:\s+(-?[\d.]+) dBFS/),
  }
}

export function parseRanges(stderr, startKey, endKey) {
  const starts = [...stderr.matchAll(new RegExp(`${startKey}[:=]\\s*(-?[\\d.]+)`, 'g'))].map((m) => num(m[1]))
  const ends = [...stderr.matchAll(new RegExp(`${endKey}[:=]\\s*(-?[\\d.]+)`, 'g'))].map((m) => num(m[1]))
  return starts.map((start, i) => ({ start, end: ends[i] ?? Number.POSITIVE_INFINITY }))
}

export function parseLevels(text) {
  return [...text.matchAll(/RMS_level=(-?[\d.]+|-inf)/g)].map((m) => (m[1] === '-inf' ? -120 : num(m[1])))
}

export function topBoxes(read, size) {
  const boxes = []
  let offset = 0
  while (offset + 8 <= size && boxes.length < 64) {
    const head = read(offset, 16)
    let length = head.readUInt32BE(0)
    const type = head.toString('latin1', 4, 8)
    if (length === 1) {
      length = Number(head.readBigUInt64BE(8))
    } else if (length === 0) {
      length = size - offset
    }
    boxes.push(type)
    if (length < 8) {
      break
    }
    offset += length
  }
  return boxes
}

const make = (level) => (id, message, at) => ({ level, id, message, ...(at === undefined ? {} : { at }) })
const pass = make('pass')
const fail = make('fail')
const warn = make('warn')
const note = make('info')

const outside = (range, spans) => !spans.some((s) => range.start >= s.start - 0.25 && range.end <= s.end + 0.25)

export function checkVideo({ info, boxes, loudness, silences, levels, black, freezes, build }) {
  const out = []
  const video = info.streams.find((s) => s.codec_type === 'video')
  const audio = info.streams.find((s) => s.codec_type === 'audio')
  const total = Number(info.format.duration)
  const comment = info.format.tags?.comment ?? ''

  out.push(
    build || comment.startsWith('produce-demo')
      ? pass('provenance', 'Built by /produce-demo, so the cards, frame and captions are on brand by construction')
      : warn(
          'provenance',
          'Not built by /produce-demo: nothing about its brand is guaranteed, so the visual review carries all of it',
        ),
  )

  if (/\bdraft\b/.test(comment)) {
    out.push(fail('draft', 'A --draft build, made for checking pacing; rebuild without --draft before sharing it'))
  }
  out.push(
    video?.codec_name === 'h264' && video?.pix_fmt === 'yuv420p'
      ? pass('codec', 'H.264, 4:2:0 — plays everywhere')
      : fail('codec', `${video?.codec_name} ${video?.pix_fmt}; deliver H.264 yuv420p`),
  )

  const { width, height } = video ?? {}
  out.push(
    width >= STANDARD.minWidth
      ? pass('resolution', `${width}x${height}`)
      : fail('resolution', `${width}x${height}; below ${STANDARD.minWidth} wide the product's UI text is unreadable`),
  )
  const aspect = width / height
  if (Math.abs(aspect - 1.6) > 0.01 && Math.abs(aspect - 16 / 9) > 0.01) {
    out.push(warn('aspect', `${aspect.toFixed(3)}:1; the standard frame is 16:9 or 16:10`))
  }

  const [n, d] = String(video?.avg_frame_rate ?? '0/1')
    .split('/')
    .map(Number)
  const fps = d ? n / d : 0
  out.push(
    fps >= 24 && fps <= 60
      ? pass('frame-rate', `${fps.toFixed(2)} fps`)
      : fail('frame-rate', `${fps.toFixed(2)} fps; deliver 24–60`),
  )

  const tags = [video?.color_space, video?.color_primaries, video?.color_transfer]
  out.push(
    tags.every((t) => t === 'bt709')
      ? pass('colour-tags', 'Tagged BT.709, so players show the colours as rendered')
      : warn(
          'colour-tags',
          `Colour tagged ${tags.map((t) => t ?? 'unknown').join('/')}; untagged, players guess and colours shift`,
        ),
  )

  const moov = boxes.indexOf('moov')
  const mdat = boxes.indexOf('mdat')
  if (moov !== -1 && mdat !== -1) {
    out.push(
      moov < mdat
        ? pass('faststart', 'Index before media: starts playing before it has downloaded')
        : fail(
            'faststart',
            'Index after media: a browser downloads the whole file before playing; remux with -movflags +faststart',
          ),
    )
  }

  if (total > STANDARD.video.warnMinutes * 60) {
    out.push(warn('length', `${stamp(total)} long; past ${STANDARD.video.warnMinutes} minutes, split it`))
  }

  // ebur128 floors an all-silent track at -70 LUFS; a silent track is the same choice as none.
  if (!audio || loudness.peak === Number.NEGATIVE_INFINITY || loudness.I <= -70) {
    out.push(note('audio', 'No sound. Silence is a choice, not a defect; a music bed is optional'))
  } else {
    const L = STANDARD.loudness
    out.push(
      Math.abs(loudness.I - L.target) <= L.tolerance
        ? pass('loudness', `${loudness.I} LUFS integrated`)
        : fail('loudness', `${loudness.I} LUFS integrated; the standard is ${L.target} ± ${L.tolerance}`),
    )
    out.push(
      loudness.peak <= L.truePeak
        ? pass('true-peak', `${loudness.peak} dBTP`)
        : fail('true-peak', `${loudness.peak} dBTP; above ${L.truePeak} it clips on some speakers`),
    )
    const tail = total - 3.5
    for (const s of silences.filter((r) => r.start > 1 && r.start < tail)) {
      out.push(fail('dropout', `The audio drops out for ${(Math.min(s.end, total) - s.start).toFixed(1)} s`, s.start))
    }
    for (let i = 3; i < levels.length - 4; i++) {
      const [a, b] = [levels[i - 1], levels[i]]
      if (a > STANDARD.dropout.noise && b > STANDARD.dropout.noise && Math.abs(b - a) >= STANDARD.jump.db) {
        out.push(warn('level-jump', `The audio level jumps ${(b - a).toFixed(1)} dB in a second`, i))
      }
    }
  }

  for (const r of black.filter((b) => b.end - b.start >= STANDARD.black.seconds)) {
    out.push(fail('black', `${(r.end - r.start).toFixed(1)} s of black frames`, r.start))
  }

  const cards = (build?.segments ?? []).filter((s) => s.kind !== 'scene')
  for (const r of freezes.filter((f) => Math.min(f.end, total) - f.start >= STANDARD.freeze.seconds)) {
    if (outside(r, cards)) {
      out.push(warn('freeze', `Nothing moves for ${(Math.min(r.end, total) - r.start).toFixed(1)} s`, r.start))
    }
  }

  if (build) {
    out.push(
      build.segments.at(-1)?.kind === 'end'
        ? pass('ending', 'Ends on the end card')
        : fail('ending', 'Does not end on the end card'),
    )
  }
  return out
}

export function verdict(findings) {
  const fails = findings.filter((f) => f.level === 'fail').length
  const warns = findings.filter((f) => f.level === 'warn').length
  return { fails, warns, ok: fails === 0 }
}

const ICON = { pass: 'PASS', fail: 'FAIL', warn: 'WARN', info: 'INFO' }

export function reportMarkdown({ name, findings, sheets, every }) {
  const v = verdict(findings)
  const rows = findings.map(
    (f) =>
      `| ${ICON[f.level]} | \`${f.id}\` | ${f.at === undefined ? '' : stamp(f.at)} | ${f.message.replaceAll('|', String.raw`\|`)} |`,
  )
  return [
    `# Review: ${name}`,
    '',
    `**Automatic checks: ${v.ok ? 'pass' : 'FAIL'}** — ${v.fails} failing, ${v.warns} to look at. The visual review below is not done until every sheet has been read.`,
    '',
    '| Result | Check | At | Detail |',
    '| --- | --- | --- | --- |',
    ...rows,
    '',
    `## Contact sheets (a frame every ${every} s)`,
    '',
    ...sheets.map((s) => `- \`${s.file}\` — ${stamp(s.from)} to ${stamp(s.to)}`),
    '',
    '## Visual review',
    '',
    'Read every sheet against `references/review-rubric.md` and record each finding as `m:ss — what — rubric item`, or "none" under a heading that has none.',
    '',
    '### Brand',
    '',
    '### Occlusion',
    '',
    '### Continuity',
    '',
    '### Legibility',
    '',
    '### Copy',
    '',
    '### Pacing',
    '',
    '### For a human (cannot be judged from frames)',
    '',
    '- How the music sits under the pictures, and whether it suits the audience.',
    '- Whether the story is the right one for the people it is going to.',
    '',
  ].join('\n')
}
