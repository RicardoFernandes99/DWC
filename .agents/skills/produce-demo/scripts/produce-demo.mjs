#!/usr/bin/env node
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { once } from 'node:events'
import {
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  readdirSync,
  readFileSync,
  readSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { basename, dirname, extname, relative, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { parseArgs } from 'node:util'
import { setTimeout as sleep } from 'node:timers/promises'

import { brandAssets, googleFontsUrl, mergeBrand, validateBrand } from './lib/brand.mjs'
import { lintText, paceFinding } from './lib/copy.mjs'
import { assembleArgs, cardArgs, duration, loudnessArgs, parseLoudnorm, probe, run, sceneArgs } from './lib/ffmpeg.mjs'
import { BAR, compose, interleave, reverbArgs } from './lib/music.mjs'
import { bottomOf, findPlaywright, frames, layer, openRenderer, still } from './lib/render.mjs'
import { checkVideo, parseEbur128, parseLevels, parseRanges, reportMarkdown, topBoxes, verdict } from './lib/review.mjs'
import { error as lintError, STANDARD, warn } from './lib/standard.mjs'
import { copyOf, validate, withDefaults } from './lib/storyboard.mjs'
import { chatLog, serveStudio, studioDir, versionStore } from './lib/studio-server.mjs'
import { findingTarget, studioPage } from './lib/studio.mjs'
import {
  captionCoverage,
  chapterLength,
  joinTakes,
  parseSteps,
  readTake,
  takeFindings,
  withCopy,
} from './lib/takes.mjs'
import * as T from './lib/templates.mjs'
import { cardSeconds, chapterList, plan, stamp } from './lib/timeline.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const VERSION = readFileSync(resolve(here, '../SKILL.md'), 'utf8').match(/version:\s*["']?([\d.]+)/)?.[1] ?? '0'
const PROJECT_FILE = '.agents/produce-demo.mjs'
const RECORD_DEMO_FILE = '.agents/record-demo.mjs'
const BUILD_STAMP = '.produce-demo'
const REVIEW_STAMP = '.produce-demo-review'
const env = (name, fallback) => process.env[name] ?? fallback

function fail(msg) {
  console.error(`produce-demo: ${msg}`)
  process.exit(1)
}

const say = (msg) => console.log(`produce-demo: ${msg}`)

const shown = (path) => {
  const rel = relative(process.cwd(), path)
  return rel.startsWith('..') ? path : rel
}

function projectRoot() {
  try {
    return execFileSync('git', ['rev-parse', '--show-toplevel'], { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim()
  } catch {
    return process.cwd()
  }
}

async function importIfPresent(file) {
  return existsSync(file) ? import(pathToFileURL(file).href) : {}
}

async function context() {
  const root = projectRoot()
  const explicit = env('PRODUCE_DEMO_PROJECT')
  const file = explicit ? resolve(explicit) : resolve(root, PROJECT_FILE)
  if (explicit && !existsSync(file)) {
    fail(`PRODUCE_DEMO_PROJECT points at a file that does not exist: ${file}`)
  }
  const project = await importIfPresent(file).catch((error) => fail(`could not load ${file}: ${error.message}`))
  const recordDemo = await importIfPresent(resolve(root, RECORD_DEMO_FILE)).catch(() => ({}))
  const brand = mergeBrand(project.brand)
  const playwrightDirs = [
    project.playwright && resolve(root, project.playwright),
    recordDemo.playwright && resolve(root, recordDemo.playwright),
    root,
    here,
  ]
  return { root, file, hasProject: existsSync(file), brand, playwrightDirs }
}

function chromiumOf(ctx) {
  const found = findPlaywright(ctx.playwrightDirs)
  return (
    found.mod?.chromium ??
    fail(
      `playwright is not installed in ${ctx.playwrightDirs.filter(Boolean).join(', ')} — name the package that has it in ${PROJECT_FILE}, and run "npx playwright install chromium" there`,
    )
  )
}

function claimDir(dir, stampFile, owner) {
  if (existsSync(dir)) {
    if (!existsSync(resolve(dir, stampFile))) {
      fail(`${dir} exists and was not made by produce-demo — move it, or use another output name`)
    }
    rmSync(dir, { recursive: true, force: true })
  }
  mkdirSync(dir, { recursive: true })
  writeFileSync(
    resolve(dir, stampFile),
    `produce-demo artifacts for ${owner}. The next run of that name deletes this directory.\n`,
  )
}

const takeDir = (take) => `${take.replace(/\.(webm|mp4)$/, '')}.record-demo`

function print(findings) {
  for (const f of findings) {
    const mark = f.level === 'error' ? 'ERROR' : 'warn '
    console.log(`  ${mark}  ${f.where}: ${f.message}  [${f.rule}]`)
  }
}

function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'))
  } catch (error) {
    return fail(`could not read ${path}: ${error.message}`)
  }
}

async function readOneTake(file, base, host) {
  const path = resolve(base, file)
  const steps = resolve(takeDir(path), 'steps.jsonl')
  if (!existsSync(path) || !existsSync(steps)) {
    return { missing: `${shown(path)} and its ${shown(steps)} must both exist; film it with /record-demo` }
  }
  const info = await probe(path)
  const log = parseSteps(readFileSync(steps, 'utf8'))
  const width = info.streams.find((s) => s.codec_type === 'video')?.width
  return { path, info, ...readTake(log, { duration: duration(info), host, width }) }
}

async function readChapterTake(chapter, base, host) {
  const parts = []
  for (const file of [chapter.take].flat()) {
    parts.push(await readOneTake(file, base, host))
  }
  const missing = parts.find((p) => p.missing)
  return missing ?? { parts, ...joinTakes(parts, STANDARD.fps) }
}

async function lint(storyboardPath, ctx) {
  const file = resolve(storyboardPath)
  const raw = readJson(file)
  const findings = validate(raw)
  if (findings.some((f) => f.level === 'error')) {
    return { findings }
  }
  const sb = withDefaults(raw, ctx.brand)
  const opts = { audience: sb.audience, terms: ctx.brand.terms }
  for (const item of copyOf(sb)) {
    findings.push(...lintText(item.text, { ...opts, kind: item.kind, where: item.where }))
  }
  for (const [where, text, card] of [
    ['intro', sb.intro, 'title'],
    ['recap caption', sb.recap?.caption, 'recap'],
  ]) {
    const pace = text && paceFinding(text, cardSeconds(card, sb) - T.CAPTION_DELAY[card] - STANDARD.transition, where)
    if (pace) {
      findings.push(pace)
    }
  }
  const takes = []
  const reads = []
  for (const [i, chapter] of sb.chapters.entries()) {
    const read = await readChapterTake(chapter, dirname(file), sb.host)
    reads.push(read)
    takes.push(read.missing ? read : withCopy(read, chapter.copy).take)
    findings.push(...chapterFindings(read, chapter, { where: `chapter ${i + 1}`, opts }))
  }
  return { sb, takes, reads, findings, file }
}

function chapterFindings(read, chapter, { where, opts }) {
  if (read.missing) {
    return [lintError('take', `${where} take`, read.missing)]
  }
  const { take, unused } = withCopy(read, chapter.copy)
  const findings = read.parts.flatMap((part, j) =>
    takeFindings(part, read.parts.length > 1 ? `${where} take ${j + 1}` : `${where} take`, chapter.copy),
  )
  findings.push(...chapterLength(take.duration, where))
  findings.push(...captionCoverage(take, where))
  for (const key of unused) {
    findings.push(warn('copy-unused', `${where} copy`, `"${key}" matches no caption or callout in the take`))
  }
  for (const [kind, list] of [
    ['caption', take.captions],
    ['callout', take.callouts],
  ]) {
    list.forEach((c, j) => findings.push(...lintText(c.text, { ...opts, kind, where: `${where} ${kind} ${j + 1}` })))
  }
  return findings
}

async function lintCommand(storyboardPath) {
  const ctx = await context()
  const { findings } = await lint(storyboardPath, ctx)
  const errors = findings.filter((f) => f.level === 'error').length
  print(findings)
  say(`${errors} error(s), ${findings.length - errors} warning(s)`)
  process.exit(errors > 0 ? 1 : 0)
}

const toFile = (path, data) => {
  writeFileSync(path, data)
  return path
}

async function fitsRecap(page, sb, look) {
  const limit = sb.recap.caption ? T.LAYOUT.captionTop - 12 : STANDARD.stage.height - 24
  const bottom = Math.ceil(await bottomOf(page, T.recapCard(sb, look), 'table'))
  if (bottom > limit) {
    fail(
      `recap: the table runs to ${bottom} px and the card ends at ${limit}; cut rows or shorten cells so each sits on one line`,
    )
  }
}

function fitsCaptionBar(lines, text, where) {
  if (lines > STANDARD.caption.maxLines) {
    fail(`${where}: "${text}" sets on ${lines} lines; the caption bar holds ${STANDARD.caption.maxLines}`)
  }
}

function matrixOf(info) {
  const stream = info.streams.find((s) => s.codec_type === 'video')
  return stream?.color_space && stream.color_space !== 'unknown' ? 'auto' : 'bt709'
}

async function renderScene(job, seg, common) {
  const { page, sb, look, scale, work, takes } = job
  const take = takes[seg.index]
  say(`compositing chapter ${seg.index + 1} (${seg.seconds.toFixed(1)} s)`)
  const framePng = await still(page, T.sceneFrame(sb, seg.index, look), { transparent: true })
  const frame = toFile(resolve(work, `frame-${seg.index}.png`), framePng)
  const layers = []
  for (const [j, u] of take.urls.entries()) {
    const l = await layer(page, T.urlLayer(u.url, look), { scale, pad: 0 })
    const file = toFile(resolve(work, `url-${seg.index}-${j}.png`), l.png)
    layers.push({ file, x: l.x, y: l.y, from: u.at, until: u.until })
  }
  for (const [j, c] of take.captions.entries()) {
    const l = await layer(page, T.captionLayer(c.text, look), { scale })
    const file = toFile(resolve(work, `cap-${seg.index}-${j}.png`), l.png)
    layers.push({ file, x: l.x, y: l.y, from: c.at, until: c.until, fade: true })
  }
  for (const [j, c] of take.callouts.entries()) {
    const [vw, vh] = c.view ?? [STANDARD.stage.width, STANDARD.stage.height]
    const k = (T.LAYOUT.content.width * scale) / vw
    const takePage = await job.pageAt({ width: vw, height: vh }, k)
    const l = await layer(takePage, T.calloutLayer(c, [vw, vh], look), { scale: k })
    const file = toFile(resolve(work, `pin-${seg.index}-${j}.png`), l.png)
    const x = T.LAYOUT.content.x * scale + l.x
    const y = T.LAYOUT.content.y * scale + l.y
    layers.push({ file, x: Math.round(x), y: Math.round(y), from: c.at, until: c.until, fade: true })
  }
  const cuts = take.cuts.map((c) => ({ path: c.path, frames: c.frames, matrix: matrixOf(c.info) }))
  const canvas = look.brand.colors.canvas
  await run('ffmpeg', sceneArgs({ ...common, cuts, scale, canvas, frame, layers }))
}

async function renderCard(job, seg, common) {
  const { page, sb, look, dir } = job
  say(`rendering the ${seg.kind} card${seg.kind === 'chapter' ? ` ${seg.index + 1}` : ''}`)
  const markup = {
    title: () => T.titleCard(sb, look),
    chapter: () => T.chapterCard(sb, seg.index, look),
    recap: () => T.recapCard(sb, look),
    end: () => T.endCard(sb, look),
  }[seg.kind]()
  if (seg.kind === 'title') {
    toFile(resolve(dir, 'poster.png'), await still(page, markup))
  }
  await run('ffmpeg', cardArgs({ ...common, animated: T.ANIMATION_SECONDS }), {
    input: async (stdin) => {
      stdin.on('error', () => {})
      for await (const png of frames(page, markup, { fps: common.fps })) {
        if (!stdin.write(png)) {
          await once(stdin, 'drain')
        }
      }
    },
  })
}

async function musicFor(spec, { timeline, work, root }) {
  if (!spec) {
    return undefined
  }
  if (!spec.generate) {
    const file = resolve(root, spec.file)
    return { music: file, seconds: duration(await probe(file)) }
  }
  say('generating the music bed')
  const seconds = timeline.total
  const title = timeline.segments[0]
  const end = timeline.segments.at(-1)
  const groove = [Math.ceil(title.end / BAR) * BAR, end.start]
  const { left, right, ir } = compose({ seconds, groove })
  const irFile = toFile(resolve(work, 'music-ir.f32'), interleave(ir[0], ir[1]))
  const out = resolve(work, 'music.wav')
  await run('ffmpeg', reverbArgs({ ir: irFile, seconds, out }), {
    input: async (stdin) => {
      stdin.on('error', () => {})
      const pcm = interleave(left, right)
      for (let i = 0; i < pcm.length; i += 1 << 20) {
        if (!stdin.write(pcm.subarray(i, i + (1 << 20)))) {
          await once(stdin, 'drain')
        }
      }
    },
  })
  return { music: out, seconds, generated: true }
}

async function measureMusic(music, total) {
  if (!music) {
    return undefined
  }
  const pass = await run('ffmpeg', loudnessArgs({ ...music, total }))
  return parseLoudnorm(pass.err)
}

async function buildCommand(storyboardPath, flags) {
  const ctx = await context()
  const brandErrors = validateBrand(ctx.brand, ctx.root)
  if (brandErrors.length > 0) {
    fail(`the brand in ${ctx.file} is not usable:\n  ${brandErrors.join('\n  ')}`)
  }
  const { sb, takes, findings, file } = await lint(storyboardPath, ctx)
  print(findings)
  if (findings.some((f) => f.level === 'error')) {
    fail('fix the errors above first; a build never ships a lint error')
  }

  const draft = Boolean(flags.draft)
  const scale = draft ? 1 : STANDARD.scale
  const fps = STANDARD.fps
  const out = resolve(flags.out ?? `${file.replace(/\.storyboard\.json$|\.json$/, '')}.mp4`)
  const dir = `${out.replace(/\.mp4$/, '')}.produce-demo`
  const work = resolve(dir, 'work')
  const timeline = plan(sb, takes)
  const look = { brand: ctx.brand, assets: brandAssets(ctx.brand, ctx.root) }
  const renderer = await openRenderer(chromiumOf(ctx), scale)
  const segments = []
  try {
    const job = { page: renderer.page, pageAt: renderer.pageAt, sb, look, scale, work, dir, takes }
    const captions = [
      ['intro', sb.intro],
      ['recap', sb.recap?.caption],
      ...takes.flatMap((take, i) => take.captions.map((c) => [`chapter ${i + 1}`, c.text])),
    ].filter(([, text]) => text)
    for (const [where, text] of captions) {
      const { lines } = await layer(job.page, T.captionLayer(text, look), { scale })
      fitsCaptionBar(lines, text, where)
    }
    if (sb.recap) {
      await fitsRecap(job.page, sb, look)
    }
    claimDir(dir, BUILD_STAMP, out)
    mkdirSync(work, { recursive: true })
    const bar = await layer(job.page, T.progressLayer(look), { scale, pad: 0 })
    const progress = toFile(resolve(work, 'progress.png'), bar.png)
    for (const [i, seg] of timeline.segments.entries()) {
      const target = resolve(work, `seg-${String(i).padStart(3, '0')}.mp4`)
      const common = {
        seconds: seg.seconds,
        fps,
        progress,
        start: seg.start,
        total: timeline.total,
        out: target,
        draft,
      }
      await (seg.kind === 'scene' ? renderScene(job, seg, common) : renderCard(job, seg, common))
      segments.push(target)
    }
  } finally {
    await renderer.close()
  }

  const music = await musicFor(ctx.brand.music, { timeline, work, root: ctx.root })
  const measured = await measureMusic(music, timeline.total)
  const hash = createHash('sha256').update(readFileSync(file)).digest('hex').slice(0, 12)
  say(`assembling ${stamp(timeline.total)} of video`)
  await run(
    'ffmpeg',
    assembleArgs({
      segments,
      timeline,
      music,
      measured,
      out,
      draft,
      metadata: {
        title: sb.title,
        comment: `produce-demo/${VERSION} brand=${ctx.brand.name} storyboard=${hash}${draft ? ' draft' : ''}`,
      },
    }),
  )

  const chapters = chapterList(timeline, sb)
  const video = encodeURI(relative(dir, out))
  writeFileSync(
    resolve(dir, 'chapters.md'),
    [
      `[![${sb.title}](poster.png)](${video})`,
      '',
      ...chapters.map((c) => `- [${stamp(c.at)}](${video}#t=${Math.floor(c.at)}) ${c.label}`),
      '',
    ].join('\n'),
  )
  writeFileSync(
    resolve(dir, 'build.json'),
    `${JSON.stringify({ version: VERSION, storyboard: relative(dirname(out), file), hash, draft, total: timeline.total, segments: timeline.segments }, null, 2)}\n`,
  )
  if (!flags.keep) {
    rmSync(work, { recursive: true, force: true })
  }
  console.log(out)
  say(`chapters and poster in ${shown(dir)}/ — now review it: produce-demo.mjs review ${shown(out)}`)
  if (!music) {
    say(`no music bed: ${relative(ctx.root, ctx.file)} names none`)
  }
}

const viewOf = (callout) => callout.view ?? [STANDARD.stage.width, STANDARD.stage.height]

async function studioState(storyboardPath, ctx) {
  const media = []
  const only = (findings) => ({ state: { segments: [], findings }, media })
  try {
    JSON.parse(readFileSync(resolve(storyboardPath), 'utf8'))
  } catch (error) {
    return only([{ ...lintError('json', 'storyboard', `is not valid JSON: ${error.message}`), target: null }])
  }
  const { sb, takes, reads, findings } = await lint(storyboardPath, ctx)
  if (!sb || takes.some((t) => t.missing)) {
    return only(findings.map((f) => Object.assign(f, { target: null })))
  }
  const look = { brand: ctx.brand, assets: brandAssets(ctx.brand, ctx.root) }
  const timeline = plan(sb, takes)
  const src = (path) => `/media/${media.push(path) - 1}`
  const cards = { title: T.titleCard, recap: T.recapCard, end: T.endCard }
  const segments = timeline.segments.map((seg) => {
    const chapter = sb.chapters[seg.index]
    const base = { kind: seg.kind, index: seg.index, start: seg.start, end: seg.end, seconds: seg.seconds }
    if (seg.kind === 'chapter') {
      return { ...base, name: `${chapter.label} card`, markup: T.chapterCard(sb, seg.index, look) }
    }
    if (seg.kind !== 'scene') {
      return { ...base, name: seg.kind === 'title' ? sb.title : `${seg.kind} card`, markup: cards[seg.kind](sb, look) }
    }
    const take = takes[seg.index]
    return {
      ...base,
      name: chapter.title,
      logged: [...new Set([...reads[seg.index].captions, ...reads[seg.index].callouts].map((c) => c.text))],
      frame: T.sceneFrame(sb, seg.index, look),
      cuts: take.cuts.map((c) => ({ src: src(c.path), seconds: c.frames / STANDARD.fps })),
      layers: [
        ...take.urls.map((u) => ({ markup: T.urlLayer(u.url, look), from: u.at, until: u.until })),
        ...take.captions.map((c) => ({ markup: T.captionLayer(c.text, look), from: c.at, until: c.until, fade: true })),
        ...take.callouts.map((c) => ({
          markup: T.calloutLayer(c, viewOf(c), look),
          from: c.at,
          until: c.until,
          fade: true,
          view: viewOf(c),
        })),
      ],
    }
  })
  return {
    state: {
      title: sb.title,
      total: timeline.total,
      canvas: ctx.brand.colors.canvas,
      segments,
      findings: findings.map((f) => Object.assign(f, { target: findingTarget(f.where, segments) })),
    },
    media,
  }
}

async function studioCommand(storyboardPath, flags) {
  const file = resolve(storyboardPath)
  if (!existsSync(file)) {
    fail(`${storyboardPath} does not exist`)
  }
  const ctx = await context()
  await serveStudio({
    file,
    port: Number(flags.port ?? 4800),
    page: studioPage({ brand: ctx.brand, assets: brandAssets(ctx.brand, ctx.root) }),
    say,
    takeLog: (path) => resolve(takeDir(path), 'steps.jsonl'),
    load: () =>
      studioState(file, ctx).catch((error) => ({
        state: { segments: [], findings: [{ ...lintError('studio', 'storyboard', error.message), target: null }] },
        media: [],
      })),
  })
}

async function inboxCommand(storyboardPath, flags) {
  const file = resolve(storyboardPath)
  const chat = chatLog(studioDir(file))
  let pending = chat.pending()
  while (flags.wait && pending.length === 0) {
    await sleep(1000)
    pending = chat.pending()
  }
  if (pending.length === 0) {
    say('no requests are waiting')
    return
  }
  for (const request of pending) {
    console.log(
      [
        `Request ${request.id} from the studio for ${shown(file)}:`,
        request.context,
        '',
        `Their request: ${request.text}`,
        '',
        `Change only ${shown(file)}, then answer with:`,
        `  node ${shown(fileURLToPath(import.meta.url))} reply ${shown(file)} --to ${request.id} "<what you changed, or why you did not>"`,
        '',
      ].join('\n'),
    )
  }
}

function replyCommand(storyboardPath, flags, words) {
  const file = resolve(storyboardPath)
  const dir = studioDir(file)
  const chat = chatLog(dir)
  const request = chat.pending().find((r) => r.id === flags.to) ?? fail(`no request ${flags.to} is waiting for a reply`)
  const text = words.join(' ').trim() || fail('say what changed, or why nothing did')
  const versions = versionStore(dir)
  const changed = !versions.has(request.version) || versions.read(request.version) !== readFileSync(file, 'utf8')
  if (!changed) {
    versions.drop(request.version)
  }
  chat.append({ role: 'assistant', to: request.id, text, changed })
  say(`answered ${request.id}${changed ? '' : '; the storyboard did not change, so its version was dropped'}`)
}

function boxesOf(file) {
  const fd = openSync(file, 'r')
  try {
    return topBoxes((offset, length) => {
      const buf = Buffer.alloc(length)
      readSync(fd, buf, 0, length, offset)
      return buf
    }, statSync(file).size)
  } finally {
    closeSync(fd)
  }
}

function autoEvery(seconds) {
  if (seconds <= 120) {
    return 2
  }
  return seconds <= 300 ? 3 : 4
}

async function reviewCommand(videoPath, flags) {
  const video = resolve(videoPath)
  if (!existsSync(video)) {
    fail(`${videoPath} does not exist`)
  }
  const ctx = await context()
  const info = await probe(video)
  const total = Number(info.format.duration)
  const every = Number(flags.every ?? autoEvery(total))
  if (!(every > 0)) {
    fail(`--every takes a number of seconds above 0 (got ${flags.every})`)
  }
  const stem = extname(video) ? video.slice(0, -extname(video).length) : video
  const dir = `${stem}.review`
  claimDir(dir, REVIEW_STAMP, video)
  const buildFile = `${stem}.produce-demo/build.json`
  const build = existsSync(buildFile) ? JSON.parse(readFileSync(buildFile, 'utf8')) : undefined

  say('measuring sound and picture')
  const hasAudio = info.streams.some((s) => s.codec_type === 'audio')
  let loudness = {}
  let silences = []
  let levels = []
  if (hasAudio) {
    const a = await run('ffmpeg', [
      '-hide_banner',
      '-nostats',
      '-i',
      video,
      '-vn',
      '-af',
      `ebur128=peak=true:framelog=verbose,silencedetect=n=${STANDARD.dropout.noise}dB:d=${STANDARD.dropout.seconds}`,
      '-f',
      'null',
      '-',
    ])
    loudness = parseEbur128(a.err)
    silences = parseRanges(a.err, 'silence_start', 'silence_end')
    const l = await run('ffmpeg', [
      '-hide_banner',
      '-nostats',
      '-i',
      video,
      '-vn',
      '-af',
      'aresample=48000,asetnsamples=n=48000,astats=metadata=1:reset=1,ametadata=print:key=lavfi.astats.Overall.RMS_level:file=-',
      '-f',
      'null',
      '-',
    ])
    levels = parseLevels(l.out)
  }
  const v = await run('ffmpeg', [
    '-hide_banner',
    '-nostats',
    '-i',
    video,
    '-an',
    '-vf',
    `scale=480:-2,blackdetect=d=${STANDARD.black.seconds}:pix_th=0.10,freezedetect=n=0.003:d=${STANDARD.freeze.seconds},metadata=print:file=-`,
    '-f',
    'null',
    '-',
  ])
  const black = parseRanges(v.err, 'black_start', 'black_end')
  const freezes = parseRanges(v.out, 'lavfi.freezedetect.freeze_start', 'lavfi.freezedetect.freeze_end')
  const findings = checkVideo({ info, boxes: boxesOf(video), loudness, silences, levels, black, freezes, build })

  say(`pulling a frame every ${every} s`)
  const framesDir = resolve(dir, 'frames')
  mkdirSync(framesDir, { recursive: true })
  await run('ffmpeg', [
    '-hide_banner',
    '-loglevel',
    'error',
    '-i',
    video,
    '-vf',
    // round=up takes the first frame at or after each mark; the default takes the one nearest the
    // half-way point, which labels every still up to half an interval early.
    `fps=1/${every}:round=up,scale=960:-2`,
    '-q:v',
    '3',
    resolve(framesDir, 'f-%04d.jpg'),
  ])
  const stills = readdirSync(framesDir)
    .filter((f) => f.endsWith('.jpg'))
    .toSorted()
    .map((f, i) => ({ file: resolve(framesDir, f), at: i * every }))
  const sheets = []
  const renderer = await openRenderer(chromiumOf(ctx), 1)
  try {
    mkdirSync(resolve(dir, 'sheets'), { recursive: true })
    for (let i = 0; i < stills.length; i += 6) {
      const group = stills.slice(i, i + 6)
      const sheet = resolve(dir, 'sheets', `sheet-${String(i / 6 + 1).padStart(2, '0')}.png`)
      await renderer.page.setContent(
        T.contactSheet(
          group.map((s) => ({
            src: `data:image/jpeg;base64,${readFileSync(s.file).toString('base64')}`,
            label: stamp(s.at),
          })),
          `${basename(video)} — ${stamp(group[0].at)} to ${stamp(group.at(-1).at)}`,
        ),
      )
      await renderer.page.screenshot({ path: sheet, fullPage: true })
      sheets.push({ file: relative(dir, sheet), from: group[0].at, to: group.at(-1).at })
    }
  } finally {
    await renderer.close()
  }
  rmSync(framesDir, { recursive: true, force: true })

  writeFileSync(
    resolve(dir, 'report.json'),
    `${JSON.stringify({ video: basename(video), findings, sheets, every }, null, 2)}\n`,
  )
  writeFileSync(resolve(dir, 'report.md'), reportMarkdown({ name: basename(video), findings, sheets, every }))
  for (const f of findings.filter((x) => x.level !== 'pass')) {
    console.log(
      `  ${f.level.toUpperCase().padEnd(4)}  ${f.at === undefined ? '' : `${stamp(f.at)} `}${f.message}  [${f.id}]`,
    )
  }
  const result = verdict(findings)
  say(`${result.fails} failing, ${result.warns} to look at; ${sheets.length} sheet(s) to read in ${shown(dir)}/`)
  process.exit(result.ok ? 0 : 1)
}

async function doctorCommand() {
  const ctx = await context()
  const lines = []
  const check = (ok, what, fix) => {
    lines.push(`  ${ok ? 'ok  ' : 'MISS'}  ${what}${ok || !fix ? '' : `\n          ${fix}`}`)
    return ok
  }
  let ffmpeg = ''
  try {
    ffmpeg = execFileSync('ffmpeg', ['-hide_banner', '-filters'], { stdio: ['ignore', 'pipe', 'ignore'] }).toString()
    ffmpeg += execFileSync('ffmpeg', ['-hide_banner', '-encoders'], { stdio: ['ignore', 'pipe', 'ignore'] }).toString()
  } catch {
    // reported by the checks below
  }
  check(Boolean(ffmpeg), 'ffmpeg on PATH', 'brew install ffmpeg (or your platform package)')
  check(/\blibx264\b/.test(ffmpeg), 'ffmpeg encodes H.264 (libx264)', 'install a full ffmpeg build')
  const filters = [
    'xfade',
    'overlay',
    'tpad',
    'fade',
    'loudnorm',
    'ebur128',
    'silencedetect',
    'blackdetect',
    'freezedetect',
    'astats',
    'afade',
    'afir',
    'amix',
    'asplit',
    'acrossfade',
    'silenceremove',
    'areverse',
    'concat',
    'setparams',
    'settb',
    'asetnsamples',
    'ametadata',
  ]
  const missing = filters.filter((f) => !new RegExp(`\\s${f}\\s`).test(ffmpeg))
  check(missing.length === 0, `ffmpeg filters (${filters.join(', ')})`, `missing: ${missing.join(', ')}`)
  let probeOk = true
  try {
    execFileSync('ffprobe', ['-version'], { stdio: 'ignore' })
  } catch {
    probeOk = false
  }
  check(probeOk, 'ffprobe on PATH', 'it ships with ffmpeg')
  const found = findPlaywright(ctx.playwrightDirs)
  if (
    check(
      Boolean(found.mod),
      `Playwright${found.dir ? ` (from ${relative(ctx.root, found.dir) || '.'})` : ''}`,
      `name the package that has it in ${PROJECT_FILE}`,
    )
  ) {
    try {
      const browser = await found.mod.chromium.launch({ headless: true })
      await browser.close()
      check(true, 'headless Chromium launches')
    } catch (error) {
      check(false, 'headless Chromium launches', `npx playwright install chromium   (${error.message.split('\n')[0]})`)
    }
  }
  const optional = (ok, what, fix) => {
    lines.push(`  ${ok ? 'ok  ' : 'note'}  ${what}${ok ? '' : `\n          ${fix}`}`)
  }
  optional(
    ctx.hasProject,
    `brand file ${relative(ctx.root, ctx.file)}`,
    "without it the video takes the skill's own look and no logo; see references/brand.md",
  )
  const brandErrors = validateBrand(ctx.brand, ctx.root)
  check(brandErrors.length === 0, 'brand values and files', brandErrors.join('\n          '))
  const fontsUrl = googleFontsUrl(ctx.brand)
  if (fontsUrl) {
    const reached = await fetch(fontsUrl, { signal: AbortSignal.timeout(5000) })
      .then((r) => r.ok)
      .catch(() => false)
    optional(
      reached,
      'Google Fonts reachable for the brand fonts',
      'offline, the cards fall back to the system font; name font files in the brand file to build offline',
    )
  }
  optional(
    Boolean(ctx.brand.music),
    `music bed${ctx.brand.music?.generate ? ' (generated)' : ''}`,
    'set brand.music to { generate: true }, or name a licensed track, to score the video',
  )
  console.log(lines.join('\n'))
  process.exit(lines.some((l) => l.includes('MISS')) ? 1 : 0)
}

const USAGE = `usage: produce-demo.mjs <command>
  doctor                                  check ffmpeg, Playwright and the brand file
  lint <storyboard.json>                  check the storyboard, its takes and every caption
  build <storyboard.json> [--out x.mp4] [--draft] [--keep]
                                          cut the takes into the finished video
  review <video> [--every <seconds>]      measure any demo video and lay out its frames for review
  studio <storyboard.json> [--port 4800]  preview the storyboard in a browser while you edit it
  inbox <storyboard.json> [--wait]        print the studio's chat requests, waiting for one with --wait
  reply <storyboard.json> --to <id> <text>
                                          answer a chat request in the studio`

async function main() {
  const { positionals, values } = parseArgs({
    allowPositionals: true,
    options: {
      out: { type: 'string' },
      draft: { type: 'boolean' },
      keep: { type: 'boolean' },
      every: { type: 'string' },
      port: { type: 'string' },
      wait: { type: 'boolean' },
      to: { type: 'string' },
    },
  })
  const [command, target, ...rest] = positionals
  switch (command) {
    case 'doctor': {
      return doctorCommand()
    }
    case 'lint': {
      return target ? lintCommand(target) : fail(USAGE)
    }
    case 'build': {
      return target ? buildCommand(target, values) : fail(USAGE)
    }
    case 'review': {
      return target ? reviewCommand(target, values) : fail(USAGE)
    }
    case 'studio': {
      return target ? studioCommand(target, values) : fail(USAGE)
    }
    case 'inbox': {
      return target ? inboxCommand(target, values) : fail(USAGE)
    }
    case 'reply': {
      return target && values.to ? replyCommand(target, values, rest) : fail(USAGE)
    }
    default: {
      return fail(USAGE)
    }
  }
}

await main().catch((error) => fail(error.message))
