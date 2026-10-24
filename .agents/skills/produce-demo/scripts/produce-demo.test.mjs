import { mkdtempSync, utimesSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, it } from 'node:test'
import { runInNewContext, Script } from 'node:vm'
import assert from 'node:assert/strict'

import { brandAssets, googleFontsUrl, mergeBrand, validateBrand } from './lib/brand.mjs'
import { isTitleCase, lintText, paceFinding } from './lib/copy.mjs'
import { assembleArgs, musicBed, sceneArgs } from './lib/ffmpeg.mjs'
import { BAR, compose, SAMPLE_RATE } from './lib/music.mjs'
import { checkVideo, parseEbur128, parseRanges, topBoxes } from './lib/review.mjs'
import { copyOf, validate, withDefaults } from './lib/storyboard.mjs'
import {
  byteRange,
  chatLog,
  moveChapter,
  reviewFindings,
  reviewPassed,
  setAt,
  versionStore,
} from './lib/studio-server.mjs'
import { findingTarget, segmentAt, studioPage } from './lib/studio.mjs'
import { captionCoverage, joinTakes, readTake, takeFindings, withCopy } from './lib/takes.mjs'
import { calloutLayer } from './lib/templates.mjs'
import { cardSeconds, place, plan } from './lib/timeline.mjs'

const rules = (findings) => findings.map((f) => `${f.level}:${f.rule}`)

const stream = (width, height) => ({
  codec_type: 'video',
  codec_name: 'h264',
  pix_fmt: 'yuv420p',
  width,
  height,
  avg_frame_rate: '30/1',
  color_space: 'bt709',
  color_primaries: 'bt709',
  color_transfer: 'bt709',
})
const audio = { codec_type: 'audio' }

function part(path, duration, url) {
  return {
    path,
    duration,
    captions: [{ text: path, at: 1, until: 2 }],
    callouts: [{ text: path, at: 2, until: duration + 5 }],
    urls: [{ at: 0, url, until: duration }],
  }
}

const round = (v) => Number(v.toFixed(3))

function peak(signal, from, to) {
  let max = 0
  for (let i = Math.round(from * SAMPLE_RATE); i < Math.round(to * SAMPLE_RATE); i++) {
    max = Math.max(max, Math.abs(signal[i]))
  }
  return max
}

function box(type, size) {
  const b = Buffer.alloc(size)
  b.writeUInt32BE(size, 0)
  b.write(type, 4, 'latin1')
  return b
}

const STORYBOARD = {
  title: 'Agent management',
  chapters: [
    { label: 'Agents list', title: 'Teams replace regions', take: 'a.webm' },
    { label: 'New agent', title: 'Every agent starts with its teams', take: 'b.webm' },
  ],
  recap: { title: 'Before and now', rows: [['Agents list', 'Region column', 'Agency teams']] },
}

const STEPS = [
  {
    n: 0,
    at: 0,
    op: 'start',
    url: 'http://localhost:5175/admin/agents',
    page: 'http://localhost:5175/admin/agents?empty=false',
    viewport: [1440, 900, 2],
    captions: 'log',
    clock: 'first-frame',
    ms: 9000,
    outcome: 'ok',
  },
  {
    n: 1,
    at: 800,
    op: 'caption',
    text: 'The list shows each agent.',
    shown: { at: 802, ms: 3000 },
    page: 'http://localhost:5175/admin/agents',
    ms: 3300,
    outcome: 'ok',
  },
  { n: 2, at: 4200, op: 'click', page: 'http://localhost:5175/admin/agents/new', ms: 900, outcome: 'ok' },
  {
    n: 3,
    at: 5200,
    op: 'caption',
    text: 'The wizard opens.',
    shown: { at: 5201, ms: 2500 },
    page: 'http://localhost:5175/admin/agents/new',
    ms: 2800,
    outcome: 'ok',
  },
]

describe('brand', () => {
  it('refuses an end gradient that is not two colours', () => {
    assert.match(validateBrand(mergeBrand({ colors: { end: '#000000' } }), '.').join(','), /colors\.end/)
    assert.match(validateBrand(mergeBrand({ colors: { end: ['#000000'] } }), '.').join(','), /colors\.end/)
  })

  it('gives a project without a brand file a complete look, with Geist from Google Fonts and a generated bed', () => {
    const brand = mergeBrand()
    assert.deepEqual(validateBrand(brand, '.'), [])
    assert.deepEqual(brand.music, { generate: true })
    assert.equal(
      googleFontsUrl(brand),
      'https://fonts.googleapis.com/css2?family=Geist:wght@100..900&family=Geist+Mono:wght@100..900&display=block',
    )
  })

  it('lets a brand file override any part and keep the rest, turn the music off, or name its own font', () => {
    const brand = mergeBrand({ colors: { accent: '#3e2aa6' }, fonts: { sans: 'missing.woff2' }, music: null })
    assert.equal(brand.colors.accent, '#3e2aa6')
    assert.equal(brand.colors.canvas, mergeBrand().colors.canvas)
    assert.equal(brand.music, null)
    assert.equal(
      googleFontsUrl(brand),
      'https://fonts.googleapis.com/css2?family=Geist+Mono:wght@100..900&display=block',
    )
    assert.deepEqual(validateBrand(brand, '.'), ['fonts.sans names missing.woff2, which does not exist'])
    assert.match(validateBrand(mergeBrand({ fonts: { mono: {} } }), '.')[0], /^fonts\.mono is a font file/)
  })
})

describe('copy', () => {
  it('rejects the internal references that leaked into the v1-to-v2 captions', () => {
    const where = 'caption'
    assert.deepEqual(rules(lintText('Party and next chaser (spec §6.3 and §6.6).', { kind: 'caption', where })), [
      'error:internal-reference',
      'error:internal-reference',
    ])
    assert.deepEqual(rules(lintText('It still fits a 1366 px screen.', { kind: 'body', where })), [
      'error:internal-reference',
    ])
    assert.deepEqual(rules(lintText('Fixed in AGE-1871.', { kind: 'body', where })), ['error:internal-reference'])
  })

  it('leaves a brand term that looks like a ticket key alone, and still catches the ticket key', () => {
    const terms = ['ISO-20022']
    assert.deepEqual(lintText('Export the list as an ISO-20022 file.', { kind: 'caption', where: 'c', terms }), [])
    assert.deepEqual(rules(lintText('Export the list as an ISO-20022 file.', { kind: 'caption', where: 'c' })), [
      'error:internal-reference',
    ])
    assert.deepEqual(rules(lintText('ISO-20022 export, fixed in AGE-123.', { kind: 'body', where: 'c', terms })), [
      'error:internal-reference',
    ])
  })

  it('treats preview addresses as internal only for a client audience', () => {
    const link = 'pr-1871.px-agensight-ui-design.pages.dev'
    assert.deepEqual(lintText(link, { kind: 'link', where: 'end', audience: 'internal' }), [])
    assert.deepEqual(rules(lintText(link, { kind: 'link', where: 'end', audience: 'client' })), [
      'error:internal-reference',
    ])
  })

  it('flags promotional words and captions that carry two ideas', () => {
    assert.deepEqual(rules(lintText('A seamless way to add teams.', { kind: 'caption', where: 'c' })), [
      'warn:promotional',
    ])
    const two = 'Each team takes a legal entity, and a location that also sets its SLA timezone.'
    assert.ok(rules(lintText(two, { kind: 'caption', where: 'c' })).includes('warn:one-idea'))
  })

  it('reads Title Case but not sentence case with brand terms', () => {
    assert.equal(isTitleCase('Teams Replace Regions Everywhere'), true)
    assert.equal(isTitleCase('Admins cover teams, WorkOS handles sign-on', ['WorkOS']), false)
    assert.equal(isTitleCase('Every agent starts from the Global Registry', ['Global Registry']), false)
  })

  it('holds callouts to a short, sentence-case label', () => {
    assert.deepEqual(lintText('First team, then a count', { kind: 'callout', where: 'c' }), [])
    assert.deepEqual(rules(lintText('Every Admin Covers Named Agency Teams Here', { kind: 'callout', where: 'c' })), [
      'warn:length',
      'warn:sentence-case',
    ])
  })

  it('paces captions against reading speed', () => {
    assert.equal(paceFinding('x'.repeat(30), 3, 'c'), undefined)
    assert.equal(paceFinding('x'.repeat(51), 3, 'c').level, 'warn')
    assert.equal(paceFinding('x'.repeat(90), 3, 'c').level, 'error')
  })
})

describe('storyboard', () => {
  it('accepts a complete storyboard', () => {
    assert.deepEqual(validate(STORYBOARD), [])
  })

  it('names what is missing, duplicated or misspelled', () => {
    const broken = {
      title: 'X',
      chapter: [],
      chapters: [
        { label: 'A', title: 'Same', take: 'a.webm' },
        { label: 'B', title: 'same', take: '' },
      ],
    }
    assert.deepEqual(rules(validate(broken)), ['warn:unknown-field', 'error:missing-field', 'error:duplicate-title'])
  })

  it('takes a per-video host over the brand, and refuses one that is not a hostname', () => {
    assert.equal(withDefaults(STORYBOARD, { host: 'app.example.com' }).host, 'app.example.com')
    assert.equal(withDefaults({ ...STORYBOARD, host: '' }, { host: 'app.example.com' }).host, '')
    assert.deepEqual(rules(validate({ ...STORYBOARD, host: 'https://app.example.com/' })), ['error:host'])
  })

  it('takes a copy map of strings per chapter, and nothing else', () => {
    const chapter = (copy) => ({ ...STORYBOARD, chapters: [{ ...STORYBOARD.chapters[0], copy }] })
    assert.deepEqual(validate(chapter({ 'Old words': 'New words' })), [])
    assert.deepEqual(rules(validate(chapter({ 'Old words': '' }))), ['error:copy'])
    assert.deepEqual(rules(validate(chapter(['Old words']))), ['error:copy'])
  })

  it('reports a recap or end that is not an object instead of crashing', () => {
    assert.deepEqual(rules(validate({ ...STORYBOARD, recap: null, end: [] })), ['error:recap', 'error:end'])
  })

  it('collects every string a viewer reads, with its copy kind', () => {
    const items = copyOf(withDefaults(STORYBOARD, { product: 'Admin Console' }))
    assert.deepEqual(
      items.map((i) => i.kind),
      ['title', 'label', 'title', 'label', 'title', 'title', 'body', 'body', 'body', 'title'],
    )
  })
})

describe('takes', () => {
  it('warns on a chapter whose captions are up for less than half of it', () => {
    assert.deepEqual(captionCoverage(readTake(STEPS, { duration: 9 }), 'c'), [])
    assert.deepEqual(rules(captionCoverage(readTake(STEPS, { duration: 30 }), 'c')), ['warn:caption-coverage'])
  })

  it('reads captions and the address bar off the step log', () => {
    const take = readTake(STEPS, { duration: 9, host: 'app.agensight.com' })
    assert.deepEqual(take.captions, [
      { text: 'The list shows each agent.', at: 0.802, until: 3.802 },
      { text: 'The wizard opens.', at: 5.201, until: 7.701 },
    ])
    assert.deepEqual(take.urls, [
      { at: 0, url: 'app.agensight.com/admin/agents', until: 5.1 },
      { at: 5.1, url: 'app.agensight.com/admin/agents/new', until: 9 },
    ])
    assert.deepEqual(takeFindings(take, 'take'), [])
  })

  it('refuses a take whose captions are burned in, or whose log came from a preview', () => {
    const drawn = STEPS.map((s) => (s.op === 'start' ? { ...s, captions: 'draw' } : s))
    assert.deepEqual(rules(takeFindings(readTake(drawn, { duration: 9 }), 't')), ['error:captions-in-page'])
    const preview = STEPS.map((s) => (s.op === 'start' ? { ...s, preview: true } : s))
    assert.deepEqual(rules(takeFindings(readTake(preview, { duration: 9 }), 't')), ['error:preview-log'])
  })

  it('switches the address bar where filming resumes after a cut, not after the cut-out wall time', () => {
    const steps = [
      STEPS[0],
      { n: 1, at: 2900, op: 'cut', ms: 200, outcome: 'ok', page: 'http://localhost:5175/admin/agents' },
      {
        n: 2,
        at: 2900,
        end: 2900,
        op: 'goto',
        ms: 3400,
        outcome: 'ok',
        page: 'http://localhost:5175/admin/agents/new',
      },
      { n: 3, at: 2900, op: 'resume', ms: 200, outcome: 'ok', page: 'http://localhost:5175/admin/agents/new' },
    ]
    assert.deepEqual(
      readTake(steps, { duration: 5.9, host: 'h' }).urls.map((u) => [u.at, u.url]),
      [
        [0, 'h/admin/agents'],
        [2.9, 'h/admin/agents/new'],
      ],
    )
    const old = steps.map(({ end: _end, ...s }) => s)
    assert.equal(readTake(old, { duration: 5.9, host: 'h' }).urls[1].at, 2.9)
  })

  it('shows the brand host, the filmed host when none is set, or the path alone for an empty one', () => {
    const at = (host) => readTake(STEPS, { duration: 9, host }).urls.map((u) => u.url)
    assert.deepEqual(at('docs.example.com'), ['docs.example.com/admin/agents', 'docs.example.com/admin/agents/new'])
    assert.deepEqual(at(undefined), ['localhost:5175/admin/agents', 'localhost:5175/admin/agents/new'])
    assert.deepEqual(at(''), ['/admin/agents', '/admin/agents/new'])
  })

  it('switches the address bar when the page navigated, not when the step finished settling', () => {
    const steps = [
      STEPS[0],
      {
        n: 1,
        at: 4200,
        end: 5600,
        op: 'click',
        navigated: [{ at: 4500, url: 'http://localhost:5175/admin/agents/new' }],
        page: 'http://localhost:5175/admin/agents/new',
        ms: 1400,
        outcome: 'ok',
      },
    ]
    assert.deepEqual(
      readTake(steps, { duration: 9, host: 'h' }).urls.map((u) => [u.at, u.url]),
      [
        [0, 'h/admin/agents'],
        [4.5, 'h/admin/agents/new'],
      ],
    )
  })

  it('reads only callouts logged with a placement, and swaps corrected copy into them', () => {
    const pin = { side: 'below', stalk: 26, x: 300, y: 500, width: 220, height: 36 }
    const target = { x: 350, y: 430, width: 200, height: 40 }
    const steps = [
      STEPS[0],
      {
        n: 1,
        at: 1000,
        op: 'callout',
        text: 'Drawn in the page',
        box: target,
        shown: { at: 1100, ms: 2500 },
        ms: 2800,
        outcome: 'ok',
      },
      {
        n: 2,
        at: 4000,
        op: 'callout',
        text: 'First team, then count',
        box: target,
        pin,
        shown: { at: 4100, ms: 2600 },
        ms: 2900,
        outcome: 'ok',
      },
    ]
    const read = readTake(steps, { duration: 9 })
    assert.deepEqual(
      read.callouts.map((c) => [c.text, c.at, Number(c.until.toFixed(3))]),
      [['First team, then count', 4.1, 6.7]],
    )
    const { take, unused } = withCopy(read, { 'First team, then count': 'First team, then a count', Gone: 'x' })
    assert.equal(take.callouts[0].text, 'First team, then a count')
    assert.equal(take.callouts[0].edited, true)
    assert.deepEqual(unused, ['Gone'])
  })

  it('plays the takes in order, moving each one by its length in whole frames', () => {
    const joined = joinTakes([part('a.webm', 9.01, 'h/a'), part('b.webm', 4.02, 'h/a'), part('c.webm', 3, 'h/c')], 30)
    assert.deepEqual(
      joined.cuts.map((c) => [c.path, c.frames]),
      [
        ['a.webm', 270],
        ['b.webm', 121],
        ['c.webm', 90],
      ],
    )
    assert.equal(round(joined.duration), 16.033)
    assert.deepEqual(
      joined.captions.map((c) => round(c.at)),
      [1, 10, 14.033],
    )
    assert.deepEqual(
      joined.callouts.map((c) => round(c.until)),
      [9, 13.033, 16.033],
    )
    assert.deepEqual(
      joined.urls.map((u) => [round(u.at), u.url, round(u.until)]),
      [
        [0, 'h/a', 13.033],
        [13.033, 'h/c', 16.033],
      ],
    )
  })

  it('refuses a take too narrow for the window it plays in', () => {
    assert.deepEqual(rules(takeFindings(readTake(STEPS, { duration: 9, width: 1440 }), 't')), ['error:resolution'])
    assert.deepEqual(takeFindings(readTake(STEPS, { duration: 9, width: 2880 }), 't'), [])
  })

  it('measures caption pace on the corrected copy, not the words the take logged', () => {
    const long = 'The list shows each agent with its teams, its admin and its open deals.'
    const take = readTake(
      STEPS.map((s) => (s.n === 1 ? { ...s, text: long } : s)),
      { duration: 9, width: 2880 },
    )
    assert.deepEqual(rules(takeFindings(take, 't')), ['error:caption-pace'])
    assert.deepEqual(takeFindings(take, 't', { [long]: 'The list shows each agent.' }), [])
  })

  it('refuses a take logged before the clock was anchored to the video, and warns on the fallback', () => {
    const withClock = (clock) => STEPS.map((x) => (x.op === 'start' ? { ...x, clock } : x))
    assert.deepEqual(rules(takeFindings(readTake(withClock(undefined), { duration: 9 }), 't')), ['error:clock'])
    assert.deepEqual(rules(takeFindings(readTake(withClock('recorder-start'), { duration: 9 }), 't')), ['warn:clock'])
  })

  it('warns on a zoom and errors on a frame that is not 16:10', () => {
    const steps = [
      { ...STEPS[0], viewport: [1920, 1080, 1] },
      { n: 1, at: 100, op: 'zoom', ms: 600, outcome: 'ok' },
    ]
    assert.deepEqual(rules(takeFindings(readTake(steps, { duration: 9 }), 't')), ['error:aspect', 'warn:zoom'])
  })
})

describe('timeline', () => {
  it('holds a chapter card about three seconds, however long its summary', () => {
    const chapter = { label: 'Plan page', title: 'A plan you can answer', summary: 'x'.repeat(200) }
    const seconds = cardSeconds('chapter', {}, chapter)
    assert.ok(seconds >= 3 && seconds <= 3.5, String(seconds))
  })

  it('overlaps each segment with the last by the transition', () => {
    const t = place([{ seconds: 4 }, { seconds: 3 }, { seconds: 10 }], 0.5)
    assert.deepEqual(
      t.segments.map((s) => [s.start, s.end]),
      [
        [0, 4],
        [3.5, 6.5],
        [6, 16],
      ],
    )
    assert.equal(t.total, 16)
  })

  it('cuts title, chapter cards, scenes, recap and end in that order', () => {
    const t = plan(withDefaults(STORYBOARD, {}), [{ duration: 20 }, { duration: 15 }])
    assert.deepEqual(
      t.segments.map((s) => s.kind),
      ['title', 'chapter', 'scene', 'chapter', 'scene', 'recap', 'end'],
    )
  })

  it('starts every crossfade where its segment starts', () => {
    const timeline = place([{ seconds: 4 }, { seconds: 3 }, { seconds: 10 }], 0.5)
    const args = assembleArgs({ segments: ['a', 'b', 'c'], timeline, out: 'o.mp4', metadata: {} })
    const graph = args[args.indexOf('-filter_complex') + 1]
    assert.match(graph, /xfade=transition=fade:duration=0.5:offset=3.500\[x1\]/)
    assert.match(graph, /xfade=transition=fade:duration=0.5:offset=6.000\[x2\]/)
    assert.ok(args.includes('-an'))
  })
})

describe('music bed', () => {
  it('crossfades enough trimmed copies of a short track to cover the video', () => {
    const bed = musicBed({ music: 'm.m4a', seconds: 30, total: 70, first: 5 })
    assert.equal(bed.inputs.filter((a) => a === 'm.m4a').length, 4)
    assert.equal(bed.graph.filter((g) => g.includes('acrossfade=d=2.000')).length, 3)
    assert.match(bed.graph[0], /^\[5:a\]silenceremove.*areverse,silenceremove.*areverse\[m0\]$/)
    assert.match(bed.graph.at(-1), /^\[c3\]atrim=0:70\.000,.*\[bed\]$/)
  })

  it('passes a generated bed through untouched, since it is cut to the video already', () => {
    const bed = musicBed({ music: 'g.wav', seconds: 70, total: 70, first: 3, generated: true })
    assert.deepEqual(bed.inputs, ['-i', 'g.wav'])
    assert.deepEqual(bed.graph, ['[3:a]atrim=0:70.000,asetpts=PTS-STARTPTS[bed]'])
  })

  it('plays a track longer than the video once', () => {
    const bed = musicBed({ music: 'm.m4a', seconds: 300, total: 70, first: 0 })
    assert.equal(bed.inputs.length, 2)
    assert.ok(!bed.graph.some((g) => g.includes('acrossfade')))
  })
})

describe('generated music', () => {
  it('renders the same audio for the same length and groove, at exactly that length', () => {
    const a = compose({ seconds: 6, groove: [2 * BAR, 6] })
    const b = compose({ seconds: 6, groove: [2 * BAR, 6] })
    assert.equal(a.left.length, 6 * SAMPLE_RATE)
    assert.deepEqual(a.left, b.left)
    assert.deepEqual(a.ir[1], b.ir[1])
  })

  it('keeps the bass and shaker inside the groove window', () => {
    const quiet = compose({ seconds: 6, groove: [0, 0] })
    const groove = compose({ seconds: 6, groove: [BAR, 2 * BAR] })
    const diff = quiet.left.map((v, i) => v - groove.left[i])
    assert.equal(peak(diff, 0, BAR), 0)
    assert.ok(peak(diff, BAR, 2 * BAR) > 0.05)
  })
})

const px = (v) => Number.parseFloat(v ?? 0)

function placePin(callout, pillSize) {
  const brand = mergeBrand()
  const markup = calloutLayer(callout, [1440, 900], { brand, assets: brandAssets(brand, '.') })
  const json = markup.match(/<script type="application\/json" id="pin">([\s\S]*?)<\/script>/)[1]
  const code = markup.match(/<script>([\s\S]*?)<\/script>/)[1]
  const el = (w = 0, h = 0) => {
    const e = { offsetWidth: w, offsetHeight: h, style: {} }
    e.getBoundingClientRect = () => {
      const left = px(e.style.left)
      const top = px(e.style.top)
      return { left, top, right: left + (px(e.style.width) || w), bottom: top + (px(e.style.height) || h) }
    }
    return e
  }
  const els = { '.pin-pill': el(...pillSize), '.pin-line': el(), '.pin-anchor': el(8, 8) }
  const document = {
    querySelector: (q) => els[q],
    getElementById: (id) => (id === 'pin' ? { textContent: json } : el()),
  }
  const window = {}
  runInNewContext(code, { window, document })
  window.place()
  return { pill: els['.pin-pill'].style, line: els['.pin-line'].style }
}

describe('pinned callouts', () => {
  const target = { x: 600, y: 300, width: 100, height: 40 }
  const pin = { side: 'left', stalk: 26, x: 600 - 26 - 220, y: 303, width: 220, height: 34 }

  it("keeps the take's placement when the pill draws at the size the take measured", () => {
    const { pill } = placePin({ text: 'Teams', box: target, pin, edited: false }, [220, 34])
    assert.equal(px(pill.left), 354)
  })

  it('puts a pill the brand font draws at another size back on its side, so the stalk meets it', () => {
    const { pill, line } = placePin({ text: 'Teams', box: target, pin, edited: false }, [200, 34])
    assert.equal(px(pill.left), 600 - 26 - 200)
    assert.equal(px(line.left), px(pill.left) + 200)
    assert.equal(px(line.left) + px(line.width), target.x)
  })
})

describe('scene composition', () => {
  it('fades captions, switches addresses, and converts to BT.709 once at the end', () => {
    const args = sceneArgs({
      cuts: [
        { path: 'a.webm', frames: 150, matrix: 'auto' },
        { path: 'b.webm', frames: 151, matrix: 'bt709' },
      ],
      seconds: 10.033,
      fps: 30,
      scale: 2,
      canvas: '#F7F6FD',
      frame: 'frame.png',
      progress: 'p.png',
      layers: [
        { file: 'u.png', x: 1, y: 2, from: 0, until: 5 },
        { file: 'c.png', x: 3, y: 4, from: 1, until: 4, fade: true },
      ],
      start: 6,
      total: 60,
      out: 's.mp4',
    })
    const graph = args[args.indexOf('-filter_complex') + 1]
    assert.match(graph, /enable='between\(t\\,0\.000\\,5\.000\)'/)
    assert.match(graph, /fade=t=in:st=1\.000:d=0\.25:alpha=1,fade=t=out:st=3\.750/)
    assert.equal(graph.match(/out_color_matrix=bt709/g).length, 1)
    assert.match(graph, /\[1:v\]fps=30,tpad=stop_mode=clone:stop=30,trim=end_frame=150,.*in_color_matrix=auto/)
    assert.match(graph, /\[2:v\]fps=30,tpad=stop_mode=clone:stop=30,trim=end_frame=151,.*in_color_matrix=bt709/)
    assert.match(graph, /\[t0\]\[t1\]concat=n=2:v=1:a=0\[take\]/)
    assert.match(graph, /\[v0\]\[3:v\]overlay=0:0/)
    assert.match(graph, /\[v1\]\[5:v\]overlay=x=1:y=2:enable/)
    assert.match(graph, /\[6:v\]format=rgba,fade/)
    assert.match(graph, /\[4:v\]overlay=x='-w/)
    assert.match(graph, /setparams=color_primaries=bt709:color_trc=bt709:colorspace=bt709:range=tv\[out\]$/)
  })
})

describe('review', () => {
  it('fails the faults found in the off-brand video', () => {
    const findings = checkVideo({
      info: { streams: [stream(1280, 720), audio], format: { duration: '93.1', tags: {} } },
      boxes: ['ftyp', 'moov', 'mdat'],
      loudness: { I: -16, LRA: 2.3, peak: -1.2 },
      silences: [{ start: 76.4, end: 79 }],
      levels: [],
      black: [],
      freezes: [{ start: 84, end: 93.1 }],
    })
    const failed = findings.filter((f) => f.level === 'fail').map((f) => f.id)
    assert.deepEqual(failed, ['resolution', 'loudness', 'true-peak', 'dropout'])
    assert.ok(findings.some((f) => f.id === 'provenance' && f.level === 'warn'))
  })

  it('passes a video at the standard, and does not count held cards as frozen', () => {
    const findings = checkVideo({
      info: {
        streams: [stream(3840, 2160), audio],
        format: { duration: '60', tags: { comment: 'produce-demo/1.0.0' } },
      },
      boxes: ['ftyp', 'moov', 'mdat'],
      loudness: { I: -19.9, LRA: 1.1, peak: -7.3 },
      silences: [],
      levels: [],
      black: [],
      freezes: [{ start: 50, end: 57 }],
      build: {
        segments: [
          { kind: 'scene', start: 0, end: 50 },
          { kind: 'end', start: 50, end: 60 },
        ],
      },
    })
    assert.deepEqual(
      findings.filter((f) => f.level !== 'pass'),
      [],
    )
  })

  it('treats a silent audio track as no music, and warns on untagged colour', () => {
    const findings = checkVideo({
      info: {
        streams: [{ ...stream(2880, 1800), color_primaries: undefined, color_transfer: 'unknown' }, audio],
        format: { duration: '12', tags: { comment: 'produce-demo/1.0.0' } },
      },
      boxes: ['ftyp', 'moov', 'mdat'],
      loudness: parseEbur128('Summary:\n    I:         -70.0 LUFS\n    LRA:         0.0 LU\n    Peak:       -inf dBFS'),
      silences: [{ start: 0, end: 12 }],
      levels: [],
      black: [],
      freezes: [],
    })
    assert.deepEqual(
      findings.filter((f) => f.level !== 'pass').map((f) => `${f.level}:${f.id}`),
      ['warn:colour-tags', 'info:audio'],
    )
  })

  it('reads the ebur128 summary, paired ranges and the box order', () => {
    const stderr =
      'Summary:\n  Integrated loudness:\n    I:         -19.9 LUFS\n  Loudness range:\n    LRA:         1.1 LU\n  True peak:\n    Peak:       -7.3 dBFS'
    assert.deepEqual(parseEbur128(stderr), { I: -19.9, LRA: 1.1, peak: -7.3 })
    assert.deepEqual(
      parseRanges('silence_start: 1.5\nsilence_end: 3 | d\nsilence_start: 8', 'silence_start', 'silence_end'),
      [
        { start: 1.5, end: 3 },
        { start: 8, end: Number.POSITIVE_INFINITY },
      ],
    )
    const file = Buffer.concat([box('ftyp', 24), box('mdat', 100), box('moov', 40)])
    assert.deepEqual(
      topBoxes((offset, length) => file.subarray(offset, offset + length), file.length),
      ['ftyp', 'mdat', 'moov'],
    )
  })
})

const emptyTake = (duration) => ({ duration, captions: [], callouts: [], urls: [] })

describe('studio', () => {
  const { segments } = plan(withDefaults(STORYBOARD, mergeBrand()), [emptyTake(9), emptyTake(8)])

  it('finds the segment playing at a time, taking the later one once a crossfade starts', () => {
    assert.equal(segmentAt(segments, 0), 0)
    assert.equal(segmentAt(segments, segments[1].start - 0.01), 0)
    assert.equal(segmentAt(segments, segments[1].start), 1)
    assert.equal(segmentAt(segments, 999), segments.length - 1)
  })

  it('puts each lint finding on the card or scene it is about', () => {
    const kind = (where) => {
      const i = findingTarget(where, segments)
      return i === null ? null : `${segments[i].kind}${segments[i].index ?? ''}`
    }
    assert.equal(kind('intro'), 'title')
    assert.equal(kind('chip 2'), 'title')
    assert.equal(kind('chapter 2 title'), 'chapter1')
    assert.equal(kind('chapter 2 take'), 'scene1')
    assert.equal(kind('chapter 1 caption 3'), 'scene0')
    assert.equal(kind('recap row 1.2'), 'recap')
    assert.equal(kind('end link'), 'end')
    assert.equal(kind('storyboard'), null)
  })

  it('serves the byte ranges a video element seeks with, and refuses one past the end', () => {
    assert.equal(byteRange(undefined, 100), undefined)
    assert.deepEqual(byteRange('bytes=0-', 100), { start: 0, end: 99 })
    assert.deepEqual(byteRange('bytes=10-19', 100), { start: 10, end: 19 })
    assert.deepEqual(byteRange('bytes=-30', 100), { start: 70, end: 99 })
    assert.deepEqual(byteRange('bytes=90-500', 100), { start: 90, end: 99 })
    assert.equal(byteRange('bytes=100-', 100), null)
  })

  it('edits one field, creating a copy map and removing a field left empty, without touching the original', () => {
    const copied = setAt(STORYBOARD, ['chapters', 0, 'copy', 'Old words'], 'New words')
    assert.deepEqual(copied.chapters[0].copy, { 'Old words': 'New words' })
    assert.equal(STORYBOARD.chapters[0].copy, undefined)
    assert.equal(Object.hasOwn(setAt(copied, ['chapters', 0, 'copy', 'Old words'], ''), 'Old words'), false)
    assert.equal(Object.hasOwn(setAt(STORYBOARD, ['recap', 'title'], '  '.trim()).recap, 'title'), false)
  })

  it('moves a chapter and refuses a move past either end', () => {
    assert.deepEqual(
      moveChapter(STORYBOARD, 1, 0).chapters.map((c) => c.take),
      ['b.webm', 'a.webm'],
    )
    assert.throws(() => moveChapter(STORYBOARD, 1, 2), /no chapter 3/)
    assert.throws(() => moveChapter(STORYBOARD, 0, -1))
  })

  it('keeps a chat request waiting until it is answered, and drops waiting requests on a clear', () => {
    const chat = chatLog(mkdtempSync(join(tmpdir(), 'studio-')))
    const first = chat.append({ role: 'user', text: 'Shorter title' })
    const second = chat.append({ role: 'user', text: 'Cut the intro' })
    chat.append({ role: 'assistant', to: first.id, text: 'Done' })
    assert.deepEqual(
      chat.pending().map((r) => r.text),
      ['Cut the intro'],
    )
    chat.append({ role: 'clear' })
    assert.deepEqual(chat.pending(), [])
    assert.deepEqual(chat.current(), [])
    assert.notEqual(first.id, second.id)
  })

  it('trusts only a review report written during the render, and passes a draft on its draft finding alone', () => {
    const report = join(mkdtempSync(join(tmpdir(), 'review-')), 'report.json')
    assert.equal(reviewFindings(report, 0), null)
    writeFileSync(report, JSON.stringify({ findings: [{ level: 'fail', id: 'draft' }] }))
    utimesSync(report, new Date(1000), new Date(1000))
    assert.equal(reviewFindings(report, 2000), null)
    const findings = reviewFindings(report, 0)
    assert.equal(reviewPassed(findings, true), true)
    assert.equal(reviewPassed(findings, false), false)
    assert.equal(reviewPassed(null, true), false)
  })

  it('keeps the text Undo replaces without letting the next Undo step back onto it', () => {
    const versions = versionStore(join(mkdtempSync(join(tmpdir(), 'studio-')), 'demo.studio'))
    const first = versions.push('{"v":1}', 'Before editing title')
    versions.push('{"v":2}', 'Replaced by Undo', { replaced: true })
    assert.equal(versions.undoable().id, first)
    assert.equal(versions.list().length, 2)
  })

  it('ships a page whose script parses', () => {
    const script = studioPage({ brand: mergeBrand(), assets: brandAssets(mergeBrand(), '.') }).match(
      /<script>([\s\S]*)<\/script>/,
    )[1]
    assert.doesNotThrow(() => new Script(script))
  })
})
