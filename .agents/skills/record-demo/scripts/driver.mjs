// Daemon behind record-demo.sh (ADR 115).
import { execFileSync } from 'node:child_process'
import {
  appendFileSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs'
import { createRequire } from 'node:module'
import { createServer, connect } from 'node:net'
import { basename, dirname, relative, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const PROJECT_FILE = '.agents/record-demo.mjs'

const CAPTURE_TITLE = '__record_demo_capture__'
// Marks a take directory as this skill's, so the next take of the same name may clear it.
const TAKE_STAMP = '.record-demo'
const RECORDER_PATH = '/__record-demo__'

// Playwright's own default, explicit because setDefaultTimeout would drag navigation down to
// DEMO_WAIT_MS with it, and a cold dev server can fairly be slower than that.
const NAV_TIMEOUT_MS = 30_000
const SAVE_TIMEOUT_MS = 120_000
const CAPTION_LEAD_MS = 450

const env = (name, fallback) => process.env[name] ?? fallback

function projectRoot() {
  try {
    return execFileSync('git', ['rev-parse', '--show-toplevel'], {
      stdio: ['ignore', 'pipe', 'ignore'],
    })
      .toString()
      .trim()
  } catch {
    return process.cwd()
  }
}

async function loadProject(root) {
  const explicit = env('DEMO_PROJECT')
  const file = explicit ?? resolve(root, PROJECT_FILE)
  if (!existsSync(file)) {
    if (explicit) {
      fail(`DEMO_PROJECT points at a file that does not exist: ${file}`)
    }
    return {}
  }
  const project = await import(pathToFileURL(file).href).catch((error) =>
    fail(`could not load ${file}: ${error.message}`),
  )
  if (project.login !== undefined && typeof project.login !== 'function') {
    fail(`${file} exports login, which must be an async function (page, { root, url })`)
  }
  if (project.overlay !== undefined && (typeof project.overlay !== 'object' || project.overlay === null)) {
    fail(`${file} exports overlay, which must be an object of theme values`)
  }
  return { ...project, file }
}

// Split from loadPlaywright so `probe` can report a miss instead of exiting on one, from the same
// search order.
function findPlaywright(root, project) {
  const dirs = [project.playwright && resolve(root, project.playwright), root, here].filter(Boolean)
  for (const dir of dirs) {
    try {
      return { dir, mod: createRequire(resolve(dir, 'package.json'))('playwright'), dirs }
    } catch (error) {
      if (error.code !== 'MODULE_NOT_FOUND') {
        throw error
      }
    }
  }
  return { dirs }
}

function loadPlaywright(root, project) {
  const found = findPlaywright(root, project)
  return (
    found.mod ??
    fail(
      `playwright is not installed in ${found.dirs.join(', ')} — add it to the project (and run "npx playwright install chromium"), or name the package that has it in ${PROJECT_FILE}`,
    )
  )
}
const uint = (name, fallback, min = 0) => {
  const v = Number(env(name, fallback))
  if (!Number.isInteger(v) || v < min) {
    fail(`${name} must be a whole number >= ${min} (got ${env(name)})`)
  }
  return v
}

function fail(msg) {
  console.error(`record-demo: ${msg}`)
  process.exit(1)
}

async function send(path, json, timeoutMs) {
  const reply = await new Promise((res, rej) => {
    const c = connect(path)
    let buf = ''
    // A daemon wedged mid-command never answers, so a caller that cannot wait forever says so.
    const timer = timeoutMs
      ? setTimeout(() => {
          c.destroy()
          rej(new Error(`no reply within ${timeoutMs}ms`))
        }, timeoutMs)
      : undefined
    c.on('connect', () => c.write(`${json}\n`))
    c.on('data', (d) => {
      buf += d
    })
    c.on('end', () => {
      clearTimeout(timer)
      res(buf)
    })
    c.on('error', (e) => {
      clearTimeout(timer)
      rej(new Error(`no recording in progress (${e.code ?? e.message})`))
    })
  }).catch((error) => fail(error.message))
  const r = JSON.parse(reply)
  if (!r.ok) {
    fail(r.error)
  }
  if (r.out !== undefined) {
    console.log(r.out)
  }
}

function answers(path) {
  return new Promise((res) => {
    const c = connect(path)
    c.on('connect', () => {
      c.destroy()
      res(true)
    })
    c.on('error', () => res(false))
  })
}

async function serve(path) {
  const root = projectRoot()
  const project = await loadProject(root)
  const cfg = {
    root,
    project,
    chromium: loadPlaywright(root, project).chromium,
    webUrl: env('DEMO_WEB_URL', 'http://localhost:5173'),
    viewport: env('DEMO_VIEWPORT', '1440 900 2').trim().split(/\s+/).map(Number),
    fps: uint('DEMO_FPS', 30, 1),
    typeDelay: uint('DEMO_TYPE_DELAY', 40),
    waitMs: uint('DEMO_WAIT_MS', 10_000, 1),
    preview: env('DEMO_PREVIEW', '0') === '1',
    httpAuth: env('DEMO_HTTP_AUTH', ''),
    stills: env('DEMO_STILLS', '1') !== '0',
    now: env('DEMO_NOW', ''),
    motionBlur: env('DEMO_MOTION_BLUR', '1') !== '0',
    captions: env('DEMO_CAPTIONS', 'draw'),
    overlay: overlaySource(project.overlay),
  }
  if (!['draw', 'log'].includes(cfg.captions)) {
    fail(`DEMO_CAPTIONS must be draw or log (got ${cfg.captions})`)
  }
  const [width, height, scale = 2] = cfg.viewport
  if (![width, height].every((n) => Number.isFinite(n) && n > 0) || ![1, 2].includes(scale)) {
    fail(`DEMO_VIEWPORT must be "width height [scale]" with scale 1 or 2 (got ${env('DEMO_VIEWPORT')})`)
  }
  if (cfg.httpAuth && !cfg.httpAuth.includes(':')) {
    fail('DEMO_HTTP_AUTH must be user:password')
  }
  if (cfg.now && Number.isNaN(Date.parse(cfg.now))) {
    fail(`DEMO_NOW must be a date (got ${cfg.now})`)
  }

  const session = new Session(cfg, { width, height, scale })
  if (existsSync(path)) {
    if (await answers(path)) {
      fail(
        `another take's daemon is still answering on ${path}, so this one would strand it; finish or abort that take, or give this one its own DEMO_STATE`,
      )
    }
    unlinkSync(path)
  }
  const server = createServer((socket) => {
    let buf = ''
    // A client hanging up mid-command must not kill the daemon.
    socket.on('error', () => {})
    socket.on('data', async (d) => {
      buf += d
      if (!buf.includes('\n')) {
        return
      }
      let cmd = null
      try {
        cmd = JSON.parse(buf)
      } catch (error) {
        buf = ''
        socket.end(JSON.stringify({ ok: false, error: `malformed command: ${error.message}` }))
        return
      }
      const reply = await session
        .run(cmd)
        .then((out) => ({ ok: true, out }))
        .catch((error) => ({ ok: false, error: error.message }))
      socket.end(JSON.stringify(reply))
      if (cmd.op === 'finish' || cmd.op === 'abort' || !reply.ok) {
        await session.close()
        server.close()
        process.exit(reply.ok ? 0 : 1)
      }
    })
  })
  server.on('error', (error) => {
    fail(
      error.code === 'EINVAL'
        ? `cannot listen on ${path} — the path is too long for a Unix socket; set DEMO_STATE to a shorter path`
        : `cannot listen on ${path}: ${error.message}`,
    )
  })
  server.listen(path)
  const bye = async () => {
    await session.failsafe().catch(() => {})
    await session.close()
    process.exit(1)
  }
  process.on('SIGTERM', bye)
  process.on('SIGINT', bye)
}

class Session {
  constructor(cfg, size) {
    this.cfg = cfg
    this.size = size
    this.steps = 0
    this.minimized = false
    this.kick = Promise.resolve()
    this.cutMs = 0
    // The active push-in, so `drag` can unwind it and put it back. Undefined at 1x.
    this.zoomed = undefined
  }

  // On the context, not per call: a bare Playwright call inherits the 30s default, so an action
  // blocked by an overlay filmed half a minute of a still page before the take stopped.
  applyTimeouts() {
    this.ctx.setDefaultTimeout(this.cfg.waitMs)
    this.ctx.setDefaultNavigationTimeout(NAV_TIMEOUT_MS)
  }

  contextOptions(extra) {
    if (!this.cfg.httpAuth) {
      return extra
    }
    const i = this.cfg.httpAuth.indexOf(':')
    return {
      ...extra,
      httpCredentials: {
        username: this.cfg.httpAuth.slice(0, i),
        password: this.cfg.httpAuth.slice(i + 1),
      },
    }
  }

  async run(cmd) {
    const began = Date.now()
    this.box = undefined
    this.shown = undefined
    this.pin = undefined
    this.navigated = []
    if (cmd.op === 'start') {
      cmd.url ??= this.cfg.webUrl
    }
    const step = { n: this.steps, at: this.t0 ? Math.round(this.videoTime(began)) : 0, op: cmd.op }
    if (cmd.op === 'start') {
      step.viewport = [this.size.width, this.size.height, this.size.scale]
      step.captions = this.cfg.captions
      step.preview = this.cfg.preview
    }
    if (cmd.selector) {
      step.selector = cmd.selector
    }
    if (cmd.text) {
      step.text = cmd.text
    }
    if (cmd.to) {
      step.to = cmd.to
    }
    if (cmd.url) {
      step.url = cmd.url
    }
    if (cmd.op === 'tweak') {
      step.tweak = { [cmd.field]: cmd.value }
    }
    try {
      const out = await this.exec(cmd)
      if (cmd.op === 'start') {
        step.clock = this.clock
      }
      step.box = this.box
      step.shown = this.shown
      step.pin = this.pin
      step.page = this.page && !this.page.isClosed() ? this.page.url() : undefined
      step.end = this.t0 ? Math.round(this.videoTime(Date.now())) : 0
      if (this.navigated.length > 0) {
        step.navigated = this.navigated
      }
      step.ms = Date.now() - began
      step.outcome = 'ok'
      this.log(step)
      if (cmd.op !== 'finish' && cmd.op !== 'abort') {
        await this.still(`${String(this.steps).padStart(2, '0')}-${cmd.op}.png`, this.cfg.stills)
      }
      this.steps += 1
      return out
    } catch (error) {
      step.ms = Date.now() - began
      step.outcome = 'error'
      step.error = error.message
      this.log(step)
      await this.failsafe().catch(() => {})
      throw error
    }
  }

  videoTime(now) {
    return now - this.t0 - this.cutMs - (this.cutAt ? now - this.cutAt : 0)
  }

  async zoom(selector, k = 2) {
    const factor = Number(k)
    if (!(factor > 1)) {
      throw new Error(`zoom factor must be greater than 1 (got ${k})`)
    }
    await this.ensureOverlay()
    const centre = selector
      ? await this.target(selector).then((t) => ({ x: t.x, y: t.y }))
      : await this.page.evaluate(() => ({ x: window.innerWidth / 2, y: window.innerHeight / 2 }))
    await this.applyZoom(factor, centre, 600, 900)
  }

  // Both halves apart, so `drag` can replay a framing without re-resolving a selector whose element
  // may have moved.
  // oxlint-disable-next-line eslint/max-params -- mirrors the overlay zoom it forwards to, plus the settle
  async applyZoom(k, centre, ms, settle) {
    await this.ensureOverlay()
    await this.page.evaluate(
      ([f, c, d, b]) => window.__demo.zoom(f, c, d, b),
      [k, centre, this.cfg.preview ? 0 : ms, this.cfg.motionBlur],
    )
    this.zoomed = { k, centre }
    await this.pause(settle)
  }

  // `this.zoomed` is intent; the transform lives on a `body` any navigation replaces, and a click
  // that follows a link leaves the state set with nothing under it. The page decides.
  async activeZoom() {
    if (!this.zoomed) {
      return undefined
    }
    const applied = await this.page.evaluate(() => Boolean(document.body.style.transform)).catch(() => false)
    if (!applied) {
      this.zoomed = undefined
    }
    return this.zoomed
  }

  async releaseZoom(ms, settle) {
    await this.ensureOverlay()
    await this.page.evaluate(([d, b]) => window.__demo.unzoom(d, b), [this.cfg.preview ? 0 : ms, this.cfg.motionBlur])
    this.zoomed = undefined
    await this.pause(settle)
  }

  async cut() {
    if (this.cfg.preview || this.cutAt) {
      return
    }
    // The pointer leaves the shot rather than freezing in it, and comes back wherever the unfilmed
    // commands left it.
    await this.fadeCursor(false)
    await this.recorder.evaluate(() => window.__pause())
    this.cutAt = Date.now()
  }

  async resume() {
    if (this.cfg.preview || !this.cutAt) {
      return
    }
    await this.resumeRecorder()
    await this.fadeCursor(true)
  }

  // Filming again without bringing the pointer back: what saving a take that ends in a cut needs.
  async resumeRecorder() {
    await this.recorder.evaluate(() => window.__resume())
    this.cutMs += Date.now() - this.cutAt
    this.cutAt = undefined
  }

  // Fades the pointer out or in and waits it out. A page with no overlay yet (mid-navigation, a
  // document that failed to load) has no pointer to fade, and that is not worth failing a take for.
  async fadeCursor(visible, ms = 180) {
    const d = this.cfg.preview ? 0 : ms
    const changed = await this.page
      .evaluate(([v, t]) => window.__demo?.fade(v, t) ?? false, [visible, d])
      .catch(() => false)
    if (changed && d) {
      await this.page.waitForTimeout(d + 20)
    }
  }

  log(step) {
    if (this.out) {
      appendFileSync(this.artifact('steps.jsonl'), `${JSON.stringify(step)}\n`)
    }
  }

  async still(name, enabled = true) {
    if (!enabled || !this.page || this.page.isClosed()) {
      return
    }
    mkdirSync(this.artifact('steps'), { recursive: true })
    await this.capture(resolve(this.artifact('steps'), name))
  }

  // A minimized window never paints for page.screenshot, so stills come off the capture track.
  async capture(path) {
    if (!this.recorder) {
      await this.page.screenshot({ path }).catch(() => {})
      return
    }
    const dataUrl = await this.recorder.evaluate(() => window.__frame()).catch(() => null)
    if (dataUrl) {
      writeFileSync(path, Buffer.from(dataUrl.slice(dataUrl.indexOf(',') + 1), 'base64'))
    }
  }

  async failsafe() {
    if (!this.out) {
      return
    }
    if (this.page && !this.page.isClosed()) {
      await this.capture(this.artifact('failure.png'))
    }
    if (this.recorder) {
      await this.saveRecording(this.artifact('partial.webm')).catch(() => {})
    }
  }

  // Everything but the video goes in `<name>.record-demo/`. Never beside it: `<name>.md` next to
  // `<name>.webm` is as likely to be the repo's DESIGN.md as a snippet from the last take.
  artifact(name) {
    return resolve(this.dir, name)
  }

  async exec(cmd) {
    switch (cmd.op) {
      case 'start': {
        return this.start(cmd.out, cmd.url, cmd.ready)
      }
      case 'goto': {
        await this.goto(cmd.url, cmd.ready)
        return
      }
      case 'move': {
        await this.moveTo(cmd.selector, cmd.ms)
        return
      }
      case 'click': {
        await this.click(cmd.selector, cmd.settle)
        return
      }
      case 'drag': {
        await this.drag(cmd.selector, cmd.to, cmd.settle)
        return
      }
      case 'type': {
        await this.type(cmd.selector, cmd.text, cmd.settle)
        return
      }
      case 'press': {
        await this.page.keyboard.press(cmd.key)
        await this.pause(cmd.settle ?? 400)
        return
      }
      case 'highlight': {
        await this.highlight(cmd.selector, cmd.ms)
        return
      }
      case 'caption': {
        await this.ensureOverlay()
        if (this.cfg.captions === 'log') {
          this.shown = { at: Math.round(this.videoTime(Date.now())), ms: this.cfg.preview ? 400 : (cmd.ms ?? 2500) }
          await this.pause(CAPTION_LEAD_MS)
          return
        }
        await this.effect(cmd.ms ?? 2500, (ms) =>
          this.page.evaluate(([text, d]) => window.__demo.caption(text, d), [cmd.text, ms]),
        )
        return
      }
      case 'callout': {
        const t = await this.target(cmd.selector)
        if (this.cfg.captions === 'log') {
          this.pin = await this.page.evaluate(([b, text]) => window.__demo.place(b, text), [t.box, cmd.text])
          await this.effect(cmd.ms ?? 2500, () => undefined)
          return
        }
        await this.effect(cmd.ms ?? 2500, (ms) =>
          this.page.evaluate(([b, text, d]) => window.__demo.callout(b, text, d), [t.box, cmd.text, ms]),
        )
        return
      }
      case 'pause': {
        await this.pause(cmd.ms)
        return
      }
      case 'zoom': {
        await this.zoom(cmd.selector, cmd.k)
        return
      }
      case 'unzoom': {
        await this.releaseZoom(600, 900)
        return
      }
      case 'cut': {
        await this.cut()
        return
      }
      case 'resume': {
        await this.resume()
        return
      }
      case 'tweak': {
        await this.tweak(cmd.field, cmd.value)
        return
      }
      case 'eval': {
        return this.page.evaluate(async (code) => {
          // oxlint-disable-next-line eslint/no-eval -- runs in the captured page, not this process
          const r = await (0, eval)(code)
          return r === undefined ? '' : String(r)
        }, cmd.code)
      }
      case 'finish': {
        return this.finish()
      }
      case 'abort': {
        await this.failsafe()
        return this.recorder ? this.artifact('partial.webm') : ''
      }
      default: {
        throw new Error(`unknown command ${cmd.op}`)
      }
    }
  }

  pause(ms) {
    return this.page.waitForTimeout(this.cfg.preview ? Math.min(ms, 50) : ms)
  }

  async effect(ms, show) {
    const shown = this.cfg.preview ? 400 : ms
    this.shown = { at: this.t0 ? Math.round(this.videoTime(Date.now())) : 0, ms: shown }
    await show(shown)
    if (this.poster) {
      await this.page.waitForTimeout(this.cfg.preview ? 280 : shown + 300)
      return
    }
    await this.page.waitForTimeout(this.cfg.preview ? 100 : shown / 2)
    this.poster = true
    await this.capture(this.artifact('poster.png'))
    await this.page.waitForTimeout(this.cfg.preview ? 180 : shown / 2 + 300)
  }

  async start(out, url, ready) {
    const { width, height, scale } = this.size
    // Before this.out is set: until then a failure neither logs nor saves into the directory.
    this.dir = this.cfg.preview ? claimPreviewDir(takeDir(out), out) : claimTakeDir(takeDir(out), out)
    this.out = out
    this.poster = false
    if (this.cfg.preview) {
      return this.startPreview(url, ready)
    }
    // Tab capture only composites a headed window; the flag lets getDisplayMedia pick the tab without a picker.
    this.browser = await this.cfg.chromium
      .launch({
        headless: false,
        args: [
          `--auto-select-tab-capture-source-by-title=${CAPTURE_TITLE}`,
          `--force-device-scale-factor=${scale}`,
          `--window-size=${width},${height + 200}`,
          '--hide-scrollbars',
        ],
      })
      .catch((error) => {
        throw new Error(
          `could not launch Chromium — run "npx playwright install chromium" where Playwright is installed\n${error.message}`,
        )
      })
    // viewport:null — emulation would lay the page out at a size other than the captured window.
    this.ctx = await this.browser.newContext(
      // bypassCSP: a page's img-src can refuse the data: URL cursor.
      this.contextOptions({ viewport: null, acceptDownloads: true, bypassCSP: true }),
    )
    this.applyTimeouts()
    await this.ctx.addInitScript(this.initScript())
    await this.ctx.route(`**${RECORDER_PATH}`, (route) =>
      route.fulfill({
        contentType: 'text/html',
        body: '<title>recorder</title><body style="background:#111"></body>',
      }),
    )
    this.page = await this.ctx.newPage()
    this.logNavigations()
    await this.watchNavigations()
    await this.freezeClock()
    await this.open(url, ready)
    // Only now that the take is underway: a start that fails to launch leaves the last video alone.
    rmSync(out, { force: true })
    await this.fitWindow()

    // about:blank is not a secure context and has no mediaDevices.
    this.recorder = await this.ctx.newPage()
    await this.recorder.goto(new URL(RECORDER_PATH, this.page.url()).href)
    await this.recorder.evaluate(
      ([fps, w, h]) => {
        window.__start = async () => {
          if (!navigator.mediaDevices) {
            throw new Error(`${location.origin} is not a secure context — tab capture needs https or localhost`)
          }
          const stream = await navigator.mediaDevices.getDisplayMedia({
            video: {
              frameRate: { ideal: fps, max: fps },
              width: { ideal: w },
              height: { ideal: h },
            },
            audio: false,
            selfBrowserSurface: 'exclude',
          })
          const track = stream.getVideoTracks()[0]
          window.__frame = async () => {
            const frame = await new ImageCapture(track).grabFrame()
            const canvas = document.createElement('canvas')
            canvas.width = frame.width
            canvas.height = frame.height
            canvas.getContext('2d').drawImage(frame, 0, 0)
            return canvas.toDataURL('image/png')
          }
          const chunks = []
          const mr = new MediaRecorder(stream, {
            mimeType: 'video/webm;codecs=vp9',
            videoBitsPerSecond: 20_000_000,
          })
          mr.ondataavailable = (e) => {
            if (e.data.size) {
              chunks.push(e.data)
              window.__lastChunkAt = performance.now()
            }
          }
          // performance.now, not Date.now: DEMO_NOW fixes Date for the whole context.
          mr.onstart = () => {
            window.__startedAt = performance.now()
          }
          // onstart fires well after the first frame, which logged every step about 0.6 s early.
          try {
            const clone = track.clone()
            const reader = new MediaStreamTrackProcessor({ track: clone }).readable.getReader()
            reader
              .read()
              .then(({ value, done }) => {
                value?.close()
                window.__videoZeroAt = done ? null : performance.now()
                reader.cancel()
                clone.stop()
              })
              .catch(() => {
                window.__videoZeroAt = null
              })
          } catch {
            window.__videoZeroAt = null
          }
          window.__captureState = () => ({
            track: track.readyState,
            muted: track.muted,
            recorder: mr.state,
          })
          window.__pause = () => mr.pause()
          window.__resume = () => mr.resume()
          window.__stop = () =>
            new Promise((res) => {
              mr.onstop = () => {
                track.stop()
                const a = document.createElement('a')
                a.href = URL.createObjectURL(new Blob(chunks, { type: 'video/webm' }))
                a.download = 'capture.webm'
                a.click()
                res(true)
              }
              mr.stop()
            })
          mr.start(500)
          return track.getSettings()
        }
        document.body.addEventListener('click', () => {
          window.__started = window.__start()
        })
      },
      [this.cfg.fps, width * scale, height * scale],
    )

    const title = await this.page.title()
    await this.page.evaluate((t) => {
      document.title = t
    }, CAPTURE_TITLE)
    // getDisplayMedia needs transient activation, which only a real click gives.
    await this.recorder.click('body')
    const settings = await this.recorder.evaluate(() =>
      Promise.race([
        window.__started,
        new Promise((_, rej) =>
          setTimeout(() => rej(new Error('getDisplayMedia did not resolve — a picker is probably showing')), 8000),
        ),
      ]),
    )
    await this.page.evaluate((t) => {
      document.title = t
    }, title)
    await this.page.bringToFront()
    // Chrome's tab-sharing infobar takes ~52px off the content area once capture starts.
    await this.fitWindow()
    await this.ensureOverlay()
    // macOS ignores --start-minimized, so minimize via CDP; a captured tab keeps compositing while minimized.
    await this.minimizeWindow()
    // MediaRecorder fires onstart asynchronously, so read the stamp only once it exists; read early
    // it is undefined, the clock becomes NaN, and every step logs at 0, the chapters with it. On a
    // timer, not Playwright's default requestAnimationFrame: the recorder is a background tab by now,
    // and only Playwright's launch flags keep a background tab getting animation frames.
    await this.recorder
      .waitForFunction(() => window.__startedAt !== undefined, null, {
        polling: 50,
        timeout: this.cfg.waitMs,
      })
      .catch((error) => {
        throw new Error(
          error.name === 'TimeoutError'
            ? `the recorder never reported starting within ${this.cfg.waitMs}ms`
            : `the recorder failed while starting: ${error.message}`,
        )
      })
    await this.recorder
      .waitForFunction(() => window.__videoZeroAt !== undefined, null, { polling: 20, timeout: 3000 })
      .catch(() => {})
    const [startedAt, videoZeroAt, now] = await this.recorder.evaluate(() => [
      window.__startedAt,
      window.__videoZeroAt,
      performance.now(),
    ])
    this.t0 = Date.now() - (now - (videoZeroAt ?? startedAt))
    this.clock = videoZeroAt ? 'first-frame' : 'recorder-start'
    return `recording ${settings.width}x${settings.height}@${settings.frameRate}fps -> ${out}`
  }

  async startPreview(url, ready) {
    const { width, height, scale } = this.size
    this.browser = await this.cfg.chromium.launch({ headless: true, args: ['--hide-scrollbars'] })
    this.ctx = await this.browser.newContext(
      this.contextOptions({
        viewport: { width, height },
        deviceScaleFactor: scale,
        bypassCSP: true,
      }),
    )
    this.applyTimeouts()
    await this.ctx.addInitScript(this.initScript())
    this.page = await this.ctx.newPage()
    this.logNavigations()
    await this.freezeClock()
    await this.open(url, ready)
    this.t0 = Date.now()
    return `previewing ${width}x${height} -> ${this.artifact('steps')}/`
  }

  async open(url, ready) {
    const { login } = this.cfg.project
    if (!login) {
      await this.goto(url, ready)
      return
    }
    await this.page.goto(url)
    await login(this.page, { root: this.cfg.root, url })
    await this.goto(url, ready)
  }

  // The moment the address changes, in video time: Playwright reports same-document navigations
  // (pushState) here too, which CDP's Page.frameNavigated does not.
  logNavigations() {
    this.page.on('framenavigated', (frame) => {
      if (frame === this.page.mainFrame() && this.t0 && this.navigated) {
        this.navigated.push({ at: Math.round(this.videoTime(Date.now())), url: frame.url() })
      }
    })
  }

  // Chrome stops delivering capture frames for a minimized tab once a cross-document navigation
  // commits; only restoring the window for a paint restarts them (Page.setWebLifecycleState,
  // Page.startScreencast and Target.activateTarget did not).
  async watchNavigations() {
    this.cdp = await this.ctx.newCDPSession(this.page)
    await this.cdp.send('Page.enable')
    this.cdp.on('Page.frameNavigated', ({ frame }) => {
      if (!frame.parentId && this.minimized) {
        this.kick = this.kick.then(() => this.kickCapture()).catch(() => {})
      }
    })
  }

  // Whether the restore lands on the new document is timing; check the recorder and retry.
  async kickCapture() {
    // A paused recorder receives nothing, so during a cut one blink is all that can be done.
    const attempts = this.cutAt ? 1 : 4
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      const since = await this.recorder.evaluate(() => performance.now())
      await this.setWindowState('normal')
      await this.page
        .evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))
        .catch(() => this.page.waitForTimeout(100))
      await this.setWindowState('minimized')
      if (this.cutAt || (await this.capturing(since))) {
        break
      }
    }
  }

  async window() {
    const { windowId, bounds } = await this.cdp.send('Browser.getWindowForTarget')
    return { windowId, bounds }
  }

  async setWindowState(windowState) {
    const { windowId } = await this.window()
    await this.cdp.send('Browser.setWindowBounds', { windowId, bounds: { windowState } })
  }

  async capturing(since, budget = 1500) {
    const deadline = Date.now() + budget
    while (Date.now() < deadline) {
      if ((await this.recorder.evaluate(() => window.__lastChunkAt ?? 0)) > since) {
        return true
      }
      await this.page.waitForTimeout(100)
    }
    return false
  }

  // setFixedTime, not clock.install(): install fakes the timers too and stalls toasts and transitions.
  async freezeClock() {
    if (this.cfg.now) {
      await this.page.clock.setFixedTime(new Date(this.cfg.now))
    }
  }

  async minimizeWindow() {
    await this.setWindowState('minimized')
    this.minimized = true
  }

  async fitWindow() {
    const { width, height } = this.size
    const { windowId, bounds } = await this.window()
    const [iw, ih] = await this.page.evaluate(() => [window.innerWidth, window.innerHeight])
    await this.cdp.send('Browser.setWindowBounds', {
      windowId,
      bounds: { width: bounds.width + (width - iw), height: bounds.height + (height - ih) },
    })
    await this.pause(300)
    const got = await this.page.evaluate(() => [window.innerWidth, window.innerHeight])
    if (got[0] !== width || got[1] !== height) {
      throw new Error(
        `window content area is ${got.join('x')}, wanted ${width}x${height} — is the screen large enough?`,
      )
    }
  }

  async tweak(label, value) {
    const panel = this.page.locator('.px-tweaks').first()
    const fab = panel.locator('button[aria-label="Toggle tweaks panel"]')
    await fab.waitFor({ state: 'visible', timeout: this.cfg.waitMs }).catch(() => {
      throw new Error('no tweaks panel on this page — only pages that render a Pixelmatters <TweaksPanel> have one')
    })
    if ((await fab.getAttribute('aria-pressed')) !== 'true') {
      await this.click(fab, 500, 'tweaks panel button')
    }
    const dialog = panel.locator('[role="dialog"]')
    await dialog.waitFor({ state: 'visible', timeout: this.cfg.waitMs })
    const row = dialog
      .locator('.px-tweaks-row')
      .filter({ has: this.page.locator('.px-tweaks-label, .px-tweaks-action', { hasText: label }) })
      .first()
    if ((await row.count()) === 0) {
      throw new Error(`no tweak labelled "${label}" in this panel`)
    }
    const select = row.locator('select')
    const toggle = row.locator('input[role="switch"]')
    const segment = row.locator('.px-tweaks-segment', { hasText: String(value) })
    const action = row.locator('.px-tweaks-action')
    if (await select.count()) {
      const option = select.locator('option', { hasText: String(value) }).first()
      if ((await option.count()) === 0) {
        throw new Error(`"${label}" has no option labelled "${value}"`)
      }
      // A native <select> opens an OS popup the tab capture cannot see.
      await this.click(select, 400, `"${label}" control`)
      await select.selectOption(await option.getAttribute('value'), { timeout: this.cfg.waitMs })
    } else if (await toggle.count()) {
      if (!['true', 'false'].includes(value)) {
        throw new Error(`"${label}" is a switch — pass true or false`)
      }
      if ((await toggle.isChecked()) !== (value === 'true')) {
        await this.click(row.locator('.px-tweaks-switch'), 400, `"${label}" switch`)
      }
    } else if (await segment.count()) {
      await this.click(segment.first(), 400, `"${label}" option "${value}"`)
    } else if (await action.count()) {
      await this.click(action, 400, `"${label}" action`)
    } else {
      throw new Error(`"${label}" has no option labelled "${value}"`)
    }
    await this.pause(700)
    await this.click(panel.locator('button[aria-label="Close tweaks panel"]'), 500, 'close tweaks panel')
  }

  // A page that polls never reaches networkidle.
  async goto(url, ready) {
    // The transform lives on the old document's body, so the new page is at 1x whatever was set.
    this.zoomed = undefined
    // Out with the old page, in with the new one; the hidden state follows the navigation, so the
    // new document mounts the pointer invisible rather than popping it in at the old spot.
    await this.fadeCursor(false)
    await this.seedCursor(url)
    await this.page.goto(url)
    await this.page.waitForLoadState('networkidle', { timeout: this.cfg.waitMs }).catch(() => {})
    await this.kick
    if (ready) {
      await this.page.waitForSelector(ready, { timeout: this.cfg.waitMs }).catch(() => {
        throw new Error(`readiness selector never appeared: ${ready}`)
      })
      await this.pause(600)
    } else {
      await this.pause(3000)
    }
    await this.ensureOverlay()
    // sessionStorage, where the overlay keeps the cursor position, is per origin.
    if (this.pointer) {
      await this.page.mouse.move(this.pointer.x, this.pointer.y)
    }
    // Inside a cut the pointer stays hidden until `resume` brings it back on camera.
    if (!this.cutAt) {
      await this.fadeCursor(true)
    }
  }

  // sessionStorage carries the pointer across a navigation only within one origin. For a `goto` to
  // another, hand the new document the position and the hidden state through an init script, so it
  // mounts where the pointer was and invisible, as a same-origin page does. Init scripts only add up,
  // so each seed names its origins and the overlay ignores it anywhere that has state of its own.
  async seedCursor(url) {
    const current = new URL(this.page.url())
    const target = new URL(url, current)
    if (target.origin === current.origin) {
      return
    }
    const at = await this.page.evaluate(() => window.__demo?.position()).catch(() => undefined)
    if (!at) {
      return
    }
    await this.page.addInitScript(
      (seed) => {
        window.__demoSeed = seed
      },
      { origins: seedOrigins(target), state: { x: at.x, y: at.y, hidden: true } },
    )
  }

  initScript() {
    return `if (location.pathname !== ${JSON.stringify(RECORDER_PATH)}) {\n${this.cfg.overlay}\n}`
  }

  async ensureOverlay() {
    if ((await this.page.evaluate('typeof window.__demo')) === 'object') {
      return
    }
    await this.page.evaluate(this.cfg.overlay)
    if ((await this.page.evaluate('typeof window.__demo')) !== 'object') {
      throw new Error('overlay failed to inject')
    }
  }

  async target(selector, name = selector) {
    const loc = typeof selector === 'string' ? this.page.locator(selector).first() : selector
    await loc.waitFor({ state: 'visible', timeout: this.cfg.waitMs }).catch(async () => {
      throw new Error(
        (await loc.count()) === 0
          ? `no element matched selector: ${name}`
          : `element matched but is not visible: ${name}`,
      )
    })
    await this.ensureOverlay()
    const before = await this.page.evaluate(() => [scrollX, scrollY])
    await loc.scrollIntoViewIfNeeded()
    const after = await this.page.evaluate(() => [scrollX, scrollY])
    // Only a page that actually scrolled needs a beat; a target already in view is clicked at once.
    if (before[0] !== after[0] || before[1] !== after[1]) {
      await this.pause(300)
    }
    // document.querySelector rejects Playwright engines such as :has-text(), so the rect comes from the locator.
    const box = await loc.boundingBox()
    if (!box) {
      throw new Error(`element matched but is not visible: ${name}`)
    }
    this.box = box
    return {
      loc,
      box,
      x: Math.round(box.x + box.width / 2),
      y: Math.round(box.y + box.height / 2),
    }
  }

  async moveTo(selector, ms, name = selector) {
    const t = await this.target(selector, name)
    await this.glide(t.x, t.y, ms)
    return t
  }

  // The pacing follows agent-browser's `--human` mode (vercel-labs/agent-browser, actions.rs
  // move_mouse_interpolated): a duration that grows with distance, one shallow perpendicular arc with
  // a seeded amplitude, and an exact endpoint. The easing does not: a hand throws the pointer and then
  // homes in, so a move covers two thirds of the way in its first quarter and spends its last third
  // settling (easeOutQuart, as measured frame by frame in a motion-designed product film). A drag keeps
  // smoothstep, because a held button that lurches off its mark reads as a slip.
  //
  // The clock, not a step count, ends the glide. `mouse.move` resolves only once the renderer has
  // handled the event, and a throttled renderer (tab capture at DPR 2 in a GPU-less container) takes
  // about 45 ms per event, so a fixed 16 ms step count stretched a 500 ms glide past a second. Each
  // step instead places the pointer where it should be when the event lands, and the last step is
  // left for the endpoint: a slow renderer gets fewer, coarser steps, and the move overruns by at most
  // the endpoint's own acknowledgement.
  // oxlint-disable-next-line eslint/max-params -- a point, a duration and an easing, as page.mouse.move takes them
  async glide(x, y, ms, ease = easeOutQuart) {
    // Before the position round trip, so that too comes out of the move's budget.
    const began = Date.now()
    const from = await this.page.evaluate(() => window.__demo.position())
    const dx = x - from.x
    const dy = y - from.y
    const distance = Math.hypot(dx, dy)
    if (distance === 0 && !ms) {
      return
    }
    const total = this.cfg.preview ? 50 : (ms ?? moveDuration(distance))
    const bend = distance > 0 ? arcBend(distance, this.steps, from, { x, y }) : 0
    const [px, py] = distance > 0 ? [-dy / distance, dx / distance] : [0, 0]
    const at = (e) => {
      // On the eased progress, so the arc's widest point is where the pointer is halfway there.
      const curve = 4 * e * (1 - e) * bend
      return { x: from.x + dx * e + px * curve, y: from.y + dy * e + py * curve }
    }
    const end = began + total
    // How long the last event took to be acknowledged; it grows the look-ahead on a slow renderer.
    let lag = 0
    // The last sampled time: a fast ack after a slow one shortens the look-ahead, and without this
    // floor the pointer would step back along the path (a held drag would visibly snap back).
    let sampled = began
    for (;;) {
      const stepBegan = Date.now()
      const ahead = Math.max(lag, GLIDE_STEP)
      if (stepBegan + ahead >= end) {
        break
      }
      sampled = Math.max(sampled, stepBegan + ahead)
      this.pointer = at(ease((sampled - began) / total))
      await this.page.mouse.move(this.pointer.x, this.pointer.y)
      lag = Date.now() - stepBegan
      const wait = stepBegan + GLIDE_STEP - Date.now()
      if (wait > 0) {
        await this.page.waitForTimeout(wait)
      }
    }
    this.pointer = { x, y }
    await this.page.mouse.move(x, y)
    const rest = end - Date.now()
    if (rest > 0) {
      await this.page.waitForTimeout(rest)
    }
  }

  // No pause between arrival and press: the settling tail of the glide is the beat. The overlay draws the
  // ripple and the pressed cursor from the real mousedown, so they are in the same frame as the click.
  async click(selector, settle = 380, name = selector) {
    const t = await this.moveTo(selector, undefined, name)
    await t.loc.click()
    await this.pause(settle)
  }

  // Press on `from`, hold a beat, glide to `to` with the button down, release. `to` is a selector, or
  // `@dx,dy` for an offset in CSS px from the press point (a slider thumb, a canvas, a resize handle).
  //
  // A zoom is unwound first and restored after: `clientX` ignores the transform, so at k× the element
  // tracks k times the cursor's travel and visibly runs away from it. See references/troubleshooting.md.
  async drag(from, to, settle = 380) {
    const framing = await this.activeZoom()
    if (framing) {
      await this.releaseZoom(300, 350)
    }
    const source = await this.moveTo(from)
    const offset = /^@(-?\d+),(-?\d+)$/.exec(to)
    let dest = null
    if (offset) {
      dest = { x: source.x + Number(offset[1]), y: source.y + Number(offset[2]) }
      this.box = {
        ...source.box,
        x: source.box.x + Number(offset[1]),
        y: source.box.y + Number(offset[2]),
      }
    } else {
      dest = await this.target(to)
    }
    await this.page.mouse.down()
    await this.pause(100)
    const distance = Math.hypot(dest.x - source.x, dest.y - source.y)
    await this.glide(dest.x, dest.y, Math.max(300, Math.round(distance / DRAG_SPEED)), smoothstep)
    await this.page.mouse.up()
    await this.pause(settle)
    if (framing) {
      await this.applyZoom(framing.k, framing.centre, 300, 350)
    }
  }

  async type(selector, text, settle = 400) {
    const t = await this.moveTo(selector)
    await t.loc.click()
    // number, email and date inputs throw on setSelectionRange; End is the fallback.
    const collapsed = await t.loc.evaluate((el) => {
      const field = el.matches('input, textarea, select') || el.isContentEditable ? el : (document.activeElement ?? el)
      // A select has no caret, and End would change which option is chosen.
      if (field.tagName === 'SELECT') {
        return true
      }
      if (field.isContentEditable) {
        const range = document.createRange()
        range.selectNodeContents(field)
        range.collapse(false)
        const selection = getSelection()
        selection.removeAllRanges()
        selection.addRange(range)
        return true
      }
      if (typeof field.selectionStart === 'number') {
        field.setSelectionRange(field.value.length, field.value.length)
        return true
      }
      return false
    })
    if (!collapsed) {
      await t.loc.press('End')
    }
    await this.pause(250)
    if (this.cfg.preview) {
      await t.loc.pressSequentially(text)
    } else {
      // The keystrokes go to the keyboard one at a time, each after its own gap; a fixed `delay`
      // reads as a machine however slow it is. The keyboard types into whatever has focus, and an
      // app can move it in the beat after the click (a panel that autofocuses, a toast), so focus
      // goes back to the target first, as pressSequentially did, unless it is already inside it.
      await t.loc.evaluate((el) => {
        if (!el.contains(document.activeElement)) {
          el.focus()
        }
      })
      const gaps = keystrokeGaps(text, this.cfg.typeDelay, this.steps)
      for (const [i, ch] of [...text].entries()) {
        await this.page.keyboard.type(ch)
        if (gaps[i]) {
          await this.page.waitForTimeout(gaps[i])
        }
      }
    }
    await this.pause(settle)
  }

  async highlight(selector, ms = 1800) {
    const t = await this.target(selector)
    await this.effect(ms, (d) => this.page.evaluate(([b, x]) => window.__demo.highlight(b, x), [t.box, d]))
    if (!this.cfg.preview) {
      await this.pause(300)
    }
  }

  async finish() {
    if (!this.cfg.preview) {
      await this.assertCapturing()
      // The take ends on the page, not on a parked pointer. Inside a cut the fade is not filmed and
      // the pointer is usually hidden already, so only a filmed ending holds the empty frame.
      await this.fadeCursor(false, 240)
      if (!this.cutAt) {
        await this.page.waitForTimeout(200)
      }
      if (!this.poster && !this.cfg.stills) {
        await this.capture(this.artifact('poster.png'))
      }
      await this.saveRecording(this.out)
    }
    this.snippet()
    return this.cfg.preview ? `${this.artifact('steps')}/` : this.out
  }

  snippet() {
    const steps = readFileSync(this.artifact('steps.jsonl'), 'utf8')
      .split('\n')
      .filter(Boolean)
      .map((line) => JSON.parse(line))
      .filter((step) => step.outcome === 'ok')
    const name = basename(this.out, '.webm')
    const video = encodeURI(relative(dirname(this.artifact('embed.md')), this.out))
    const lines = [`[![${name}](poster.png)](${video})`, '']
    const opening = steps[0] && resolve(this.artifact('steps'), `00-${steps[0].op}.png`)
    if (!existsSync(this.artifact('poster.png')) && opening && existsSync(opening)) {
      copyFileSync(opening, this.artifact('poster.png'))
    }
    for (const step of steps) {
      const label = chapterLabel(step)
      if (label) {
        const secs = Math.max(0, Math.floor(step.at / 1000))
        const stamp = `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`
        lines.push(`- [${stamp}](${video}#t=${secs}) ${label}`)
      }
    }
    writeFileSync(this.artifact('embed.md'), `${lines.join('\n')}\n`)
  }

  // Chrome still emits ~1 frame/s for a static tab, so a gap of seconds is a stall.
  async assertCapturing() {
    const now = Date.now()
    const lastChunkAt = await this.recorder.evaluate(() => window.__lastChunkAt ?? null)
    const sinceChunk =
      lastChunkAt === null ? Infinity : (await this.recorder.evaluate(() => performance.now())) - lastChunkAt
    const gap = sinceChunk - (this.cutAt ? now - this.cutAt : 0)
    if (gap > 5000) {
      const state = await this.recorder.evaluate(() => window.__captureState())
      throw new Error(
        `capture stalled: no video for the last ${Math.round(gap / 1000)} s of the take (${JSON.stringify(state)})`,
      )
    }
  }

  async saveRecording(path) {
    await this.kick
    // MediaRecorder.stop() on a paused recorder drops everything since the last resume. Not
    // `resume`, which would fade the pointer back in as the last thing on film.
    if (this.cutAt) {
      await this.resumeRecorder()
    }
    await new Promise((r) => setTimeout(r, 150))
    // Not DEMO_WAIT_MS: this wait covers the MediaRecorder flush and Blob assembly of the whole
    // take, and timing out here discards the recording rather than one action.
    const pending = this.recorder.waitForEvent('download', { timeout: SAVE_TIMEOUT_MS })
    await this.recorder.evaluate(() => window.__stop())
    const download = await pending
    await download.saveAs(path)
  }

  async close() {
    await this.browser?.close().catch(() => {})
  }
}

function takeDir(out) {
  return `${out.replace(/\.webm$/, '')}.record-demo`
}

// Clears the last take's directory, but only one carrying the stamp: a directory of that name the
// skill did not make is someone's work, and the take refuses to start rather than delete it.
function claimTakeDir(dir, out) {
  if (existsSync(dir)) {
    if (!existsSync(resolve(dir, TAKE_STAMP))) {
      throw new Error(`${dir} exists and was not made by record-demo — move it, or record under another name`)
    }
    rmSync(dir, { recursive: true, force: true })
  }
  mkdirSync(dir, { recursive: true })
  writeFileSync(
    resolve(dir, TAKE_STAMP),
    `record-demo artifacts for ${out}. The next take of that name deletes this directory.\n`,
  )
  return dir
}

function claimPreviewDir(dir, out) {
  if (existsSync(dir) && !existsSync(resolve(dir, TAKE_STAMP))) {
    throw new Error(`${dir} exists and was not made by record-demo — move it, or record under another name`)
  }
  if (!existsSync(dir)) {
    claimTakeDir(dir, out)
  }
  return claimTakeDir(resolve(dir, 'preview'), out)
}

// The origins a `goto` to `target` may land on: the one asked for, and the ones the common redirects
// lead to from it, http to https and a bare host to www or back. A redirect anywhere else (a sign-in
// host) lands unseeded. The list stays this short on purpose: a seed marks the pointer hidden, and an
// origin it wrongly covered would mount it hidden on a later visit that nothing fades back in.
function seedOrigins(target) {
  const { protocol, hostname, port } = target
  const named = /^[a-z]/i.test(hostname) && hostname.includes('.')
  const hosts = [hostname]
  if (named) {
    hosts.push(hostname.startsWith('www.') ? hostname.slice(4) : `www.${hostname}`)
  }
  const schemes = protocol === 'http:' && !port ? ['http:', 'https:'] : [protocol]
  const origins = schemes.flatMap((scheme) => hosts.map((host) => `${scheme}//${host}${port ? `:${port}` : ''}`))
  return [target.origin, ...origins.filter((o) => o !== target.origin)]
}

// Pixels per millisecond a drag travels at most; a 500 px drag takes just over a second.
const DRAG_SPEED = 0.45

// The interval between glide steps on a renderer that keeps up: one 60 Hz frame.
const GLIDE_STEP = 16

const smoothstep = (t) => t * t * (3 - 2 * t)
const easeOutQuart = (t) => 1 - (1 - t) ** 4

// agent-browser uses 80 ms + 0.35 ms/px; the recording it made ran nearer 300 ms + 0.35 ms/px once
// browser latency was in, and that is the pacing that reads well, so the intercept keeps it.
const moveDuration = (distance) => Math.round(Math.min(750, Math.max(300, 300 + 0.35 * distance)))

// A shallow arc, at most 5% of the distance and never more than 24 px, whose side and size come from
// the step number and endpoints, so a take is reproducible and no two moves in it bend the same way.
// oxlint-disable-next-line eslint/max-params -- mirrors agent-browser's signature
function arcBend(distance, step, from, to) {
  let h = 2_166_136_261
  for (const v of [step, Math.round(from.x), Math.round(from.y), Math.round(to.x), Math.round(to.y)]) {
    h = Math.imul(h ^ v, 16_777_619) >>> 0
  }
  const unit = h / 4_294_967_296
  return (unit * 2 - 1) * Math.min(distance * 0.05, 24)
}

// The gap after each character of `text`, for a typist whose average keystroke is about `mean` ms.
// Each gap is log-normal around the mean (a hand is rarely faster than half its pace and often
// slower), a word boundary adds a beat, punctuation a longer one, and about one gap in twenty-five is
// a hesitation. Seeded from the step number and the text, like `arcBend`, so a take is reproducible.
// The last character has no gap: the settle after it is the beat.
function keystrokeGaps(text, mean, step) {
  let h = 2_166_136_261 ^ step
  for (const ch of text) {
    h = Math.imul(h ^ ch.codePointAt(0), 16_777_619) >>> 0
  }
  const rand = () => {
    h = (Math.imul(h, 1_664_525) + 1_013_904_223) >>> 0
    return (h + 0.5) / 4_294_967_296
  }
  const chars = [...text]
  return chars.map((ch, i) => {
    if (i === chars.length - 1 || mean === 0) {
      return 0
    }
    // Box–Muller; the -σ²/2 keeps the mean of the jitter at 1.
    const normal = Math.sqrt(-2 * Math.log(rand())) * Math.cos(2 * Math.PI * rand())
    let gap = mean * Math.exp(0.45 * normal - 0.1)
    const next = chars[i + 1]
    if (ch === ' ' || next === ' ') {
      gap += mean * (0.4 + rand() * 0.6)
    }
    if (/[.,;:!?]/.test(ch)) {
      gap += mean * (2 + rand() * 3)
    }
    if (rand() < 0.04) {
      gap += mean * (3 + rand() * 4)
    }
    return Math.round(Math.min(mean * 10, Math.max(mean * 0.45, gap)))
  })
}

function overlaySource(theme = {}) {
  const png = (file) =>
    `data:image/png;base64,${readFileSync(resolve(here, `../assets/cursors/${file}.png`)).toString('base64')}`
  const glyphs = Object.fromEntries(
    ['arrow', 'hand', 'ibeam'].map((name) => [name, { x1: png(name), x2: png(`${name}@2x`) }]),
  )
  const overlay = readFileSync(resolve(here, '../assets/overlay.js'), 'utf8')
  return `window.__demoGlyphs = ${JSON.stringify(glyphs)};\nwindow.__demoTheme = ${JSON.stringify(theme)};\n${overlay}`
}

function chapterLabel(step) {
  switch (step.op) {
    case 'start':
    case 'goto': {
      return step.url ? new URL(step.url).pathname : undefined
    }
    case 'caption':
    case 'callout': {
      return step.text
    }
    case 'tweak': {
      return Object.entries(step.tweak)
        .map(([field, value]) => `${field}: ${value}`)
        .join(', ')
    }
    default: {
      return undefined
    }
  }
}

// The driver's own answers to which Playwright, which Chromium, which project file, as JSON for
// doctor.sh — which owns the checks, while resolution stays here. Sentinel-prefixed on its own line
// because importing the project file runs the project's code, and a `console.log` in it is ordinary.
const PROBE_MARK = '__record_demo_probe__'

async function probe() {
  const root = projectRoot()
  const explicit = env('DEMO_PROJECT')
  const report = {
    root,
    projectFile: explicit ?? resolve(root, PROJECT_FILE),
    explicit: Boolean(explicit),
  }
  report.hasProject = existsSync(report.projectFile)
  // Not loadProject: its failures are process.exit, which would leave doctor with nothing to report.
  let project = {}
  if (report.hasProject) {
    project = await import(pathToFileURL(report.projectFile).href).catch((error) => {
      report.projectError = error.message
      return {}
    })
  }
  report.login = typeof project.login === 'function'
  try {
    const found = findPlaywright(root, project)
    report.searched = found.dirs
    if (found.mod) {
      report.playwright = found.dir
      report.chromium = found.mod.chromium.executablePath()
      report.chromiumInstalled = existsSync(report.chromium)
    }
  } catch (error) {
    // findPlaywright rethrows anything that is not a missing module: a broken install, not a miss.
    report.playwrightError = error.message
  }
  console.log(PROBE_MARK + JSON.stringify(report))
}

const [mode, sock, arg, timeoutMs] = process.argv.slice(2)
if (mode === 'send') {
  await send(sock, arg, timeoutMs && Number(timeoutMs))
} else if (mode === 'serve') {
  await serve(sock)
} else if (mode === 'probe') {
  await probe()
} else if (mode === 'alive') {
  process.exit((await answers(sock)) ? 0 : 1)
} else {
  fail('usage: driver.mjs serve <socket> | send <socket> <json> [timeout-ms] | alive <socket> | probe')
}
