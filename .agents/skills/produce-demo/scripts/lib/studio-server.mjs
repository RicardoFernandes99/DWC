import { spawn } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import {
  appendFileSync,
  createReadStream,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  statSync,
  unwatchFile,
  watchFile,
  writeFileSync,
} from 'node:fs'
import { createServer } from 'node:http'
import { basename, dirname, resolve } from 'node:path'
import { createInterface } from 'node:readline'
import { fileURLToPath } from 'node:url'

import { validate } from './storyboard.mjs'

const SCRIPT = resolve(dirname(fileURLToPath(import.meta.url)), '../produce-demo.mjs')
const STAMP = '.produce-demo-studio'

export function byteRange(header, size) {
  const m = /^bytes=(\d*)-(\d*)$/.exec(header ?? '')
  if (!m || (m[1] === '' && m[2] === '')) {
    return undefined
  }
  const start = m[1] === '' ? Math.max(0, size - Number(m[2])) : Number(m[1])
  const end = m[1] === '' || m[2] === '' ? size - 1 : Math.min(Number(m[2]), size - 1)
  return start <= end ? { start, end } : null
}

export function setAt(doc, path, value) {
  const next = structuredClone(doc)
  let node = next
  for (const key of path.slice(0, -1)) {
    node[key] ??= {}
    node = node[key]
  }
  if (value === '' || value === null || value === undefined) {
    delete node[path.at(-1)]
  } else {
    node[path.at(-1)] = value
  }
  return next
}

export function moveChapter(doc, from, to) {
  const next = structuredClone(doc)
  const chapters = next.chapters ?? []
  if (!chapters[from] || to < 0 || to >= chapters.length) {
    throw new Error(`there is no chapter ${to + 1} to move chapter ${from + 1} to`)
  }
  chapters.splice(to, 0, chapters.splice(from, 1)[0])
  return next
}

export const studioDir = (file) => `${file.replace(/\.storyboard\.json$|\.json$/, '')}.studio`

export function versionStore(dir) {
  if (existsSync(dir) && !existsSync(resolve(dir, STAMP))) {
    throw new Error(`${dir} exists and was not made by produce-demo — move it, or rename the storyboard`)
  }
  mkdirSync(dir, { recursive: true })
  writeFileSync(resolve(dir, STAMP), 'produce-demo studio versions of the storyboard beside this directory.\n')
  const index = resolve(dir, 'versions.json')
  const list = () => (existsSync(index) ? JSON.parse(readFileSync(index, 'utf8')) : [])
  const save = (versions) => writeFileSync(index, `${JSON.stringify(versions, null, 2)}\n`)
  return {
    list,
    push(text, label, extra = {}) {
      const versions = list()
      const id = (versions.at(-1)?.id ?? 0) + 1
      writeFileSync(resolve(dir, `${id}.json`), text)
      versions.push({ id, at: new Date().toISOString(), label, ...extra })
      save(versions)
      return id
    },
    undoable: () => list().findLast((v) => !v.replaced),
    has: (id) => existsSync(resolve(dir, `${id}.json`)),
    read: (id) => readFileSync(resolve(dir, `${id}.json`), 'utf8'),
    drop(id) {
      save(list().filter((v) => v.id !== id))
      rmSync(resolve(dir, `${id}.json`), { force: true })
    },
  }
}

export function chatLog(dir) {
  const path = resolve(dir, 'chat.jsonl')
  const all = () =>
    existsSync(path)
      ? readFileSync(path, 'utf8')
          .split('\n')
          .filter(Boolean)
          .map((line) => JSON.parse(line))
      : []
  const current = () => {
    const entries = all()
    return entries.slice(entries.findLastIndex((e) => e.role === 'clear') + 1)
  }
  return {
    path,
    current,
    pending() {
      const entries = current()
      const answered = new Set(entries.filter((e) => e.role === 'assistant').map((e) => e.to))
      return entries.filter((e) => e.role === 'user' && !answered.has(e.id))
    },
    append(entry) {
      const full = { id: randomUUID().slice(0, 8), at: new Date().toISOString(), ...entry }
      appendFileSync(path, `${JSON.stringify(full)}\n`)
      return full
    },
  }
}

export function requestContext({ state, segment, at }) {
  const seg = state.segments[segment]
  const parts = []
  if (seg) {
    const what = {
      title: 'the title card',
      chapter: `the card of chapter ${seg.index + 1}`,
      scene: `the scene of chapter ${seg.index + 1}`,
      recap: 'the recap card',
      end: 'the end card',
    }[seg.kind]
    parts.push(
      `They are looking at segment ${segment + 1} of ${state.segments.length}, ${what} ("${seg.name}"), ${at.toFixed(1)} s into it.`,
    )
    if (seg.logged?.length > 0) {
      parts.push(`Words this chapter's takes logged: ${seg.logged.map((t) => JSON.stringify(t)).join(', ')}.`)
    }
    const here = state.findings.filter((f) => f.target === segment)
    parts.push(
      here.length > 0
        ? `Lint findings on it:\n${here.map((f) => `- ${f.level} ${f.where}: ${f.message} [${f.rule}]`).join('\n')}`
        : 'Lint has no findings on it.',
    )
  }
  const whole = state.findings.filter((f) => f.target === null)
  if (whole.length > 0) {
    parts.push(
      `Findings on the whole storyboard:\n${whole.map((f) => `- ${f.level} ${f.where}: ${f.message}`).join('\n')}`,
    )
  }
  return parts.join('\n')
}

export function reviewFindings(report, since) {
  return existsSync(report) && statSync(report).mtimeMs >= since
    ? JSON.parse(readFileSync(report, 'utf8')).findings
    : null
}

export const reviewPassed = (findings, draft) =>
  Array.isArray(findings) && findings.every((f) => f.level !== 'fail' || (draft && f.id === 'draft'))

function lines(child, onLine) {
  for (const stream of [child.stdout, child.stderr]) {
    createInterface({ input: stream }).on('line', onLine)
  }
  return new Promise((done) => {
    child.on('error', (error) => {
      onLine(error.message)
      done(1)
    })
    child.on('close', (code) => done(code ?? 1))
  })
}

function sendFile(req, res, { path, type }) {
  const { size } = statSync(path)
  const range = byteRange(req.headers.range, size)
  if (range === null) {
    res.writeHead(416, { 'content-range': `bytes */${size}` }).end()
  } else if (range) {
    res.writeHead(206, {
      'content-type': type,
      'accept-ranges': 'bytes',
      'content-range': `bytes ${range.start}-${range.end}/${size}`,
      'content-length': range.end - range.start + 1,
    })
    createReadStream(path, range).pipe(res)
  } else {
    res.writeHead(200, { 'content-type': type, 'accept-ranges': 'bytes', 'content-length': size })
    createReadStream(path).pipe(res)
  }
}

function json(res, data, status = 200) {
  res.writeHead(status, { 'content-type': 'application/json' }).end(JSON.stringify(data))
}

async function body(req) {
  let text = ''
  for await (const chunk of req) {
    text += chunk
    if (text.length > 1_000_000) {
      throw new Error('request too large')
    }
  }
  return JSON.parse(text || '{}')
}

export async function serveStudio({ file, port, page, load, takeLog, say }) {
  const stem = file.replace(/\.storyboard\.json$|\.json$/, '')
  const versions = versionStore(studioDir(file))
  const chat = chatLog(studioDir(file))
  const output = `${stem}.mp4`
  const clients = new Set()
  const watched = new Set()
  const render = { running: false, draft: true, log: [], findings: null, ok: null }
  let current = await load()

  const notify = (what = 'change') => {
    for (const res of clients) {
      res.write(`data: ${what}\n\n`)
    }
  }
  const watch = (path) => {
    if (!watched.has(path)) {
      watched.add(path)
      watchFile(path, { interval: 500 }, refresh)
    }
  }
  async function refresh() {
    current = await load()
    for (const path of current.media) {
      watch(takeLog(path))
    }
    notify()
  }
  watch(file)
  for (const path of current.media) {
    watch(takeLog(path))
  }
  watchFile(chat.path, { interval: 500 }, () => notify('chat'))
  watched.add(chat.path)

  const readDoc = () => readFileSync(file, 'utf8')
  let written = readDoc()
  const put = (text) => {
    writeFileSync(file, text)
    written = text
  }
  const parsedDoc = () => {
    try {
      return JSON.parse(readDoc())
    } catch {
      return null
    }
  }
  function write(next, label) {
    const errors = validate(next).filter((f) => f.level === 'error')
    if (errors.length > 0) {
      throw new Error(errors.map((f) => `${f.where}: ${f.message}`).join('; '))
    }
    versions.push(readDoc(), label)
    put(`${JSON.stringify(next, null, 2)}\n`)
  }

  const routes = {
    'GET /': (req, res) => res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }).end(page),
    'GET /state': (req, res) =>
      json(res, {
        ...current.state,
        doc: parsedDoc(),
        versions: versions.list().toReversed(),
        chat: chat.current(),
        render: {
          ...render,
          video: existsSync(output) && !render.running ? `/output?v=${statSync(output).mtimeMs}` : null,
        },
      }),
    'GET /events': (req, res) => {
      res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-store' })
      clients.add(res)
      req.on('close', () => clients.delete(res))
    },
    'GET /chat': (req, res) => json(res, { chat: chat.current(), versions: versions.list().toReversed() }),
    'POST /chat': async (req, res) => {
      const { message, segment, at } = await body(req)
      if (!message?.trim()) {
        return json(res, { error: 'say what should change' }, 400)
      }
      const version = versions.push(readDoc(), `Before: ${message.trim().slice(0, 60)}`)
      const context = requestContext({ state: current.state, segment, at: Number(at) || 0 })
      return json(res, chat.append({ role: 'user', text: message.trim(), context, version }))
    },
    'POST /chat/clear': (req, res) => json(res, chat.append({ role: 'clear' })),
    'GET /output': (req, res) =>
      existsSync(output) ? sendFile(req, res, { path: output, type: 'video/mp4' }) : res.writeHead(404).end(),
    'POST /edit': async (req, res) => {
      const { set, move } = await body(req)
      const doc = JSON.parse(readDoc())
      if (move) {
        write(moveChapter(doc, move[0], move[1]), `Before moving chapter ${move[0] + 1} to ${move[1] + 1}`)
      } else {
        write(setAt(doc, set[0], set[1]), `Before editing ${set[0].join('.')}`)
      }
      json(res, { ok: true })
    },
    'POST /undo': (req, res) => {
      const last = versions.undoable()
      if (!last) {
        return json(res, { error: 'nothing to undo' }, 409)
      }
      const now = readDoc()
      if (now !== written) {
        versions.push(now, 'Replaced by Undo', { replaced: true })
      }
      put(versions.read(last.id))
      versions.drop(last.id)
      return json(res, { ok: true })
    },
    'POST /restore': async (req, res) => {
      const { id } = await body(req)
      const text = versions.read(Number(id))
      versions.push(readDoc(), `Before restoring version ${id}`)
      put(text)
      json(res, { ok: true })
    },
    'POST /render': async (req, res) => {
      const { draft = true } = await body(req)
      if (render.running) {
        return json(res, { error: 'a render is already running' }, 409)
      }
      Object.assign(render, { running: true, draft, log: [], findings: null, ok: null })
      res.writeHead(200, { 'content-type': 'application/x-ndjson' })
      const send = (event) => res.write(`${JSON.stringify(event)}\n`)
      const log = (line) => {
        render.log.push(line)
        send({ type: 'log', line })
      }
      const node = (args) => lines(spawn(process.execPath, [SCRIPT, ...args], { cwd: process.cwd() }), log)
      const started = Date.now()
      try {
        const built = await node(['build', file, '--out', output, ...(draft ? ['--draft'] : [])])
        if (built === 0) {
          const code = await node(['review', output])
          render.findings = reviewFindings(`${stem}.review/report.json`, started)
          if (!render.findings) {
            log(`produce-demo studio: review stopped (exit ${code}) before it wrote a report`)
          }
        }
        render.ok = reviewPassed(render.findings, draft)
      } catch (error) {
        log(`produce-demo studio: ${error.message}`)
        render.ok = false
      } finally {
        render.running = false
        send({ type: 'done', ok: render.ok })
        notify()
        res.end()
      }
    },
  }

  const allowed = new Set([`127.0.0.1:${port}`, `localhost:${port}`])
  const server = createServer(async (req, res) => {
    const url = new URL(req.url, 'http://studio')
    // Any web page can send requests to 127.0.0.1; one on another site cannot set Host or Origin, nor post JSON without a preflight.
    const origin = req.headers.origin ? new URL(req.headers.origin).host : undefined
    if (
      !allowed.has(req.headers.host) ||
      (req.method === 'POST' &&
        (req.headers['content-type'] !== 'application/json' || (origin && !allowed.has(origin))))
    ) {
      return res.writeHead(403).end()
    }
    const media = /^\/media\/(\d+)$/.exec(url.pathname)
    if (req.method === 'GET' && media && current.media[Number(media[1])]) {
      const path = current.media[Number(media[1])]
      return sendFile(req, res, { path, type: path.endsWith('.webm') ? 'video/webm' : 'video/mp4' })
    }
    const route = routes[`${req.method} ${url.pathname}`]
    if (!route) {
      return res.writeHead(404).end()
    }
    try {
      return await route(req, res)
    } catch (error) {
      return res.headersSent ? res.end() : json(res, { error: error.message }, 400)
    }
  })
  server.listen(port, '127.0.0.1', () => {
    say(`studio for ${basename(file)} at http://127.0.0.1:${port}/ — it reloads when the storyboard or a take changes`)
  })
  process.on('SIGINT', () => {
    for (const path of watched) {
      unwatchFile(path)
    }
    server.close()
    process.exit(0)
  })
}
