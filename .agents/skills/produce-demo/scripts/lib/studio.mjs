import { FADE } from './ffmpeg.mjs'
import { STANDARD } from './standard.mjs'
import { ANIMATION_SECONDS, LAYOUT } from './templates.mjs'

export function segmentAt(segments, t) {
  let i = 0
  while (i + 1 < segments.length && segments[i + 1].start <= t) {
    i++
  }
  return i
}

export function findingTarget(where, segments) {
  const find = (kind, index) => {
    const i = segments.findIndex((s) => s.kind === kind && (index === undefined || s.index === index))
    return i === -1 ? null : i
  }
  const chapter = /^chapter (\d+)( (label|title|summary)\b)?/.exec(where)
  if (chapter) {
    return find(chapter[2] ? 'chapter' : 'scene', Number(chapter[1]) - 1)
  }
  if (/^(title|eyebrow|subtitle|intro|chip)\b/.test(where)) {
    return find('title')
  }
  if (where.startsWith('recap')) {
    return find('recap')
  }
  return where.startsWith('end') ? find('end') : null
}

// The browser functions and client run in the browser: the studio page stringifies them, so they may use only
// their arguments and DOM globals.
function browserEl(tag, props = {}, ...children) {
  const node = Object.assign(document.createElement(tag), props)
  node.append(...children.filter((c) => c !== null && c !== undefined))
  return node
}

async function browserPost(path, data) {
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.headers.get('content-type')?.startsWith('application/json')) {
    return res
  }
  const reply = await res.json()
  return { status: res.status, ...reply }
}

function browserRenderStatus(r) {
  const cut = r.draft ? 'draft' : 'final cut'
  if (r.running) {
    return `Rendering the ${cut}…`
  }
  if (r.ok === null) {
    return r.video ? 'Showing the last render.' : 'Not rendered yet.'
  }
  return r.ok ? `The ${cut} passed review.` : 'The render or its review failed; read the log and findings.'
}

function client({ segmentIndex, el, post, renderStatus }, { stage, content, fade, settle, icons }) {
  const $ = document.querySelector.bind(document)
  const icon = (name) => {
    const span = el('span', { className: 'icon' })
    span.innerHTML = icons[name]
    return span
  }
  const setPlay = () => {
    $('#play').replaceChildren(icon(ui.playing ? 'pause' : 'play'))
    $('#play').setAttribute('aria-label', ui.playing ? 'Pause' : 'Play')
  }
  const ui = { mode: 'scene', sel: 0, t: settle, playing: false, last: 0, tab: 'chat', view: 'scenes' }
  let state = { segments: [], findings: [], versions: [] }
  let built = new Map()

  const frame = (markup, style = '') => {
    const f = document.createElement('iframe')
    f.srcdoc = markup
    f.setAttribute('style', `position:absolute;left:0;top:0;width:${stage.width}px;height:${stage.height}px;${style}`)
    return f
  }

  function buildStage(seg) {
    const root = el('div', { className: 'stage' })
    root.style.width = `${stage.width}px`
    root.style.height = `${stage.height}px`
    root.style.background = state.canvas
    if (seg.kind !== 'scene') {
      const f = frame(seg.markup)
      let anims = []
      let pending = 0
      const seek = (t) => {
        pending = t
        for (const a of anims) {
          a.currentTime = t * 1000
        }
      }
      f.addEventListener('load', () => {
        anims = f.contentDocument.getAnimations()
        for (const a of anims) {
          a.pause()
        }
        seek(pending)
      })
      root.append(f)
      return { root, seek, pause() {} }
    }
    const video = el('video', { muted: true, preload: 'auto' })
    Object.assign(video.style, {
      position: 'absolute',
      left: `${content.x}px`,
      top: `${content.y}px`,
      width: `${content.width}px`,
      height: `${content.height}px`,
      objectFit: 'fill',
    })
    root.append(video, frame(seg.frame))
    const layers = seg.layers.map((l) => {
      const [vw, vh] = l.view ?? [stage.width, stage.height]
      const f = frame(
        l.markup,
        l.view
          ? `width:${vw}px;height:${vh}px;left:${content.x}px;top:${content.y}px;transform-origin:0 0;transform:scale(${content.width / vw})`
          : '',
      )
      f.addEventListener('load', () => f.contentWindow.place?.())
      f.style.opacity = '0'
      f.style.transition = l.fade ? `opacity ${fade}s linear` : 'none'
      root.append(f)
      return { ...l, f }
    })
    let cut = -1
    const locate = (t) => {
      let i = 0
      let local = t
      while (i + 1 < seg.cuts.length && local >= seg.cuts[i].seconds) {
        local -= seg.cuts[i].seconds
        i++
      }
      return { i, local: Math.min(local, seg.cuts[i].seconds) }
    }
    const seek = (t, playing = false) => {
      const at = locate(t)
      if (at.i !== cut) {
        cut = at.i
        video.src = seg.cuts[at.i].src
      }
      if (!playing || Math.abs(video.currentTime - at.local) > 0.3) {
        video.currentTime = at.local
      }
      if (playing && video.paused) {
        video.play().catch(() => {})
      }
      for (const l of layers) {
        l.f.style.opacity = t >= l.from && t < l.until ? '1' : '0'
      }
    }
    return { root, seek, pause: () => video.pause() }
  }

  const current = () => (ui.mode === 'scene' ? ui.sel : segmentIndex(state.segments, ui.t))
  const range = () =>
    ui.mode === 'scene' ? [state.segments[ui.sel].start, state.segments[ui.sel].end] : [0, state.total]

  function stageFor(i) {
    if (!built.has(i)) {
      built.set(i, buildStage(state.segments[i]))
    }
    return built.get(i)
  }

  function fit(node, box) {
    node.style.transform = `scale(${box.clientWidth / stage.width})`
  }

  const finding = (f) =>
    el(
      'li',
      { className: `finding ${f.level}` },
      el('span', { className: 'dot' }),
      el(
        'div',
        {},
        el('b', { textContent: f.where }),
        el('p', { textContent: f.message }),
        el('code', { textContent: f.rule }),
      ),
    )

  function get(path) {
    return path.reduce((node, key) => node?.[key], state.doc)
  }

  function field(label, path, { long = false, placeholder = '' } = {}) {
    const input = el(long ? 'textarea' : 'input', { value: get(path) ?? '', placeholder, rows: 2 })
    const note = el('small', { className: 'note' })
    input.addEventListener('change', async () => {
      const res = await post('/edit', { set: [path, input.value.trim()] })
      note.textContent = res.error ?? ''
      input.classList.toggle('bad', Boolean(res.error))
    })
    return el('label', { className: 'field' }, el('span', { className: 'label', textContent: label }), input, note)
  }

  function mover(index) {
    const count = state.doc.chapters.length
    const move = async (to) => {
      const res = await post('/edit', { move: [index, to] })
      if (res.error) {
        alert(res.error)
        return
      }
      ui.sel = state.segments.findIndex((s) => s.kind === 'chapter' && s.index === to)
    }
    return el(
      'div',
      { className: 'row' },
      el(
        'button',
        { className: 'btn', disabled: index === 0, onclick: () => move(index - 1) },
        icon('left'),
        'Move earlier',
      ),
      el(
        'button',
        { className: 'btn', disabled: index === count - 1, onclick: () => move(index + 1) },
        'Move later',
        icon('right'),
      ),
    )
  }

  function editor(seg) {
    if (!state.doc) {
      return [el('p', { textContent: 'The storyboard is not valid JSON; fix it in your editor.' })]
    }
    const i = seg.index
    switch (seg.kind) {
      case 'title': {
        return [
          field('Title', ['title']),
          field('Eyebrow', ['eyebrow']),
          field('Subtitle', ['subtitle']),
          field('Intro caption', ['intro'], { long: true }),
        ]
      }
      case 'chapter': {
        return [
          field('Label', ['chapters', i, 'label']),
          field('Title', ['chapters', i, 'title']),
          field('Summary', ['chapters', i, 'summary'], { long: true }),
          mover(i),
        ]
      }
      case 'scene': {
        return [
          field('Title', ['chapters', i, 'title']),
          el('h3', { textContent: 'Captions and callouts' }),
          el('p', {
            className: 'help',
            textContent:
              'The take logged these words. Type replacements to show instead; when they show needs a new take.',
          }),
          ...seg.logged.map((text) => field(text, ['chapters', i, 'copy', text], { long: true, placeholder: text })),
          mover(i),
        ]
      }
      case 'recap': {
        return [field('Title', ['recap', 'title']), field('Caption', ['recap', 'caption'], { long: true })]
      }
      default: {
        return [
          field('Title', ['end', 'title'], { placeholder: state.doc.title }),
          field('Link', ['end', 'link']),
          field('Note', ['end', 'note']),
        ]
      }
    }
  }

  function sidebar(i) {
    const seg = state.segments[i]
    $('#seg-name').textContent = seg.name
    $('#seg-seconds').textContent = `${seg.seconds.toFixed(2)}s`
    const mine = state.findings.filter((f) => f.target === i)
    const whole = state.findings.filter((f) => f.target === null)
    $('[data-tab=findings]').replaceChildren(
      'Findings',
      el('span', { className: 'count', textContent: String(mine.length + whole.length) }),
    )
    $('#chat').hidden = ui.tab !== 'chat'
    $('#tab').hidden = ui.tab === 'chat'
    if (ui.tab === 'chat') {
      $('#ask textarea').placeholder =
        `What should change on ${seg.name}? e.g. "Make the title say what changed" or "Cut this caption to one idea."`
    } else if (ui.tab === 'edit') {
      $('#tab').replaceChildren(...editor(seg))
    } else {
      $('#tab').replaceChildren(
        el('h3', { textContent: 'On this segment' }),
        mine.length > 0
          ? el('ul', {}, ...mine.map(finding))
          : el('p', { className: 'help', textContent: 'Lint has nothing to say about it.' }),
        el('h3', { textContent: 'On the whole storyboard' }),
        whole.length > 0
          ? el('ul', {}, ...whole.map(finding))
          : el('p', { className: 'help', textContent: 'Nothing.' }),
      )
    }
    $('#tab').dataset.seg = String(i)
  }

  function show() {
    if (state.segments.length === 0) {
      $('#where').replaceChildren(el('b', { textContent: 'Nothing to preview until lint passes' }))
      $('#view').replaceChildren(el('ul', { className: 'blocking' }, ...state.findings.map(finding)))
      return
    }
    const i = current()
    const seg = state.segments[i]
    const view = $('#view')
    const s = stageFor(i)
    if (view.firstChild !== s.root) {
      for (const other of built.values()) {
        other.pause()
      }
      view.replaceChildren(s.root)
    }
    fit(s.root, view)
    s.seek(Math.max(0, ui.t - seg.start), ui.playing)
    const [lo, hi] = range()
    const scrub = $('#scrub')
    scrub.min = String(lo)
    scrub.max = String(hi)
    scrub.value = String(ui.t)
    scrub.style.setProperty('--p', `${hi > lo ? ((ui.t - lo) / (hi - lo)) * 100 : 0}%`)
    $('#time').replaceChildren(
      el('b', { textContent: (ui.t - lo).toFixed(2) }),
      el('span', { textContent: ` / ${(hi - lo).toFixed(2)}s` }),
    )
    $('#where').replaceChildren(
      el('b', { textContent: `Segment ${i + 1} of ${state.segments.length}` }),
      el('span', { textContent: ` · ${seg.name}` }),
    )
    for (const [j, tile] of [...document.querySelectorAll('.tile')].entries()) {
      tile.classList.toggle('on', j === i)
    }
    if ($('#tab').dataset.seg !== String(i)) {
      sidebar(i)
    }
  }

  function tick(now) {
    if (ui.playing) {
      const [lo, hi] = range()
      ui.t += (now - ui.last) / 1000
      if (ui.t >= hi) {
        ui.t = ui.mode === 'scene' ? lo : hi
        ui.playing = ui.mode === 'scene'
        setPlay()
      }
      show()
    }
    ui.last = now
    requestAnimationFrame(tick)
  }

  function strip() {
    $('#strip').replaceChildren(
      ...state.segments.map((seg, i) => {
        const box = el('div', { className: 'thumb' })
        const s = buildStage(seg)
        box.append(s.root)
        const issues = state.findings.filter((f) => f.target === i)
        const tile = el(
          'button',
          {
            className: 'tile',
            onclick: () => {
              ui.sel = i
              ui.t = seg.start + (seg.kind === 'scene' ? 0 : Math.min(settle, seg.seconds / 2))
              show()
            },
          },
          box,
          el('span', { className: 'num', textContent: String(i + 1) }),
          el(
            'span',
            { className: 'caption' },
            el('b', { textContent: seg.name }),
            el('span', { textContent: `${seg.seconds.toFixed(2)}s` }),
          ),
          issues.length > 0
            ? el('span', {
                className: `badge ${issues.some((f) => f.level === 'error') ? 'error' : 'warn'}`,
                textContent: String(issues.length),
              })
            : null,
        )
        requestAnimationFrame(() => {
          fit(s.root, box)
          s.seek(seg.kind === 'scene' ? Math.min(1, seg.seconds / 2) : seg.seconds)
        })
        return tile
      }),
    )
  }

  function chat() {
    const answered = new Set(state.chat.filter((e) => e.role === 'assistant').map((e) => e.to))
    const log = $('#log')
    log.replaceChildren(
      ...state.chat.flatMap((e) => {
        if (e.role === 'user') {
          return [
            el('div', { className: 'bubble user', textContent: e.text }),
            answered.has(e.id)
              ? null
              : el('p', { className: 'waiting' }, el('span', { className: 'pulse' }), 'Waiting for Claude Code…'),
          ].filter(Boolean)
        }
        return [
          el(
            'div',
            { className: 'bubble' },
            e.text,
            el('small', {}, icon(e.changed ? 'check' : 'minus'), e.changed ? 'Storyboard changed' : 'No change'),
          ),
        ]
      }),
    )
    if (state.chat.length === 0) {
      log.append(
        el('p', {
          className: 'hint',
          textContent:
            'Messages go to the Claude Code session watching this studio with "produce-demo.mjs inbox --wait". It edits the storyboard, the preview reloads, and Undo takes the change back.',
        }),
      )
    }
    log.scrollTop = log.scrollHeight
  }

  function versions() {
    $('#undo').disabled = !state.versions.some((v) => !v.replaced)
    $('#versions summary').replaceChildren(
      icon('history'),
      'Versions',
      el('span', { className: 'count', textContent: String(state.versions.length) }),
    )
    $('#versions ol').replaceChildren(
      ...state.versions.map((v) =>
        el(
          'li',
          {},
          el(
            'div',
            {},
            el('b', { textContent: v.label }),
            el('span', { textContent: new Date(v.at).toLocaleTimeString() }),
          ),
          el('button', {
            className: 'btn sm',
            textContent: 'Restore',
            onclick: async () => {
              await post('/restore', { id: v.id })
              $('#versions').open = false
            },
          }),
        ),
      ),
    )
  }

  function renderPanel() {
    const r = state.render
    $('#render-draft').disabled = r.running
    $('#render-final').disabled = r.running
    $('#render-status').textContent = renderStatus(r)
    const video = $('#render-video')
    if (r.video && video.dataset.src !== r.video) {
      video.dataset.src = r.video
      video.src = r.video
    }
    video.hidden = !r.video || r.running
    $('#render-findings').replaceChildren(
      ...(r.findings ?? [])
        .filter((f) => f.level !== 'pass')
        .map((f) =>
          finding({ level: f.level === 'fail' ? 'error' : 'warn', where: f.id, message: f.message, rule: f.level }),
        ),
    )
    $('#render-log').textContent = r.log.join('\n')
  }

  async function startRender(draft) {
    state.render = { ...state.render, running: true, draft, log: [], findings: null, ok: null }
    renderPanel()
    const res = await post('/render', { draft })
    if (res.error) {
      alert(res.error)
      return
    }
    const reader = res.body.pipeThrough(new TextDecoderStream()).getReader()
    let rest = ''
    for (;;) {
      const { value, done } = await reader.read()
      if (done) {
        break
      }
      rest += value
      const parts = rest.split('\n')
      rest = parts.pop()
      for (const part of parts.filter(Boolean)) {
        const event = JSON.parse(part)
        if (event.type === 'log') {
          state.render.log.push(event.line)
          $('#render-log').textContent = state.render.log.join('\n')
          $('#render-log').scrollTop = $('#render-log').scrollHeight
        }
      }
    }
    await load()
  }

  async function load() {
    const res = await fetch('/state')
    state = await res.json()
    built = new Map()
    $('#title').textContent = state.title ?? 'Storyboard'
    const errors = state.findings.filter((f) => f.level === 'error').length
    const warnings = state.findings.length - errors
    $('#summary').replaceChildren(
      state.total ? el('span', { className: 'chip', textContent: `${state.total.toFixed(1)}s` }) : '',
      el('span', { className: 'chip', textContent: `${state.segments.length} segments` }),
      errors > 0
        ? el('span', { className: 'chip error', textContent: `${errors} error${errors === 1 ? '' : 's'}` })
        : '',
      warnings > 0
        ? el('span', { className: 'chip warn', textContent: `${warnings} warning${warnings === 1 ? '' : 's'}` })
        : '',
    )
    ui.sel = Math.min(ui.sel, Math.max(0, state.segments.length - 1))
    ui.t = Math.min(ui.t, state.total ?? 0)
    if (!$('#tab').contains(document.activeElement)) {
      $('#tab').dataset.seg = ''
    }
    versions()
    chat()
    renderPanel()
    strip()
    show()
  }

  $('#play').addEventListener('click', () => {
    ui.playing = !ui.playing
    setPlay()
    if (!ui.playing) {
      for (const s of built.values()) {
        s.pause()
      }
    }
    show()
  })
  $('#scrub').addEventListener('input', (e) => {
    ui.t = Number(e.target.value)
    show()
  })
  for (const button of document.querySelectorAll('[data-mode]')) {
    button.addEventListener('click', () => {
      ui.mode = button.dataset.mode
      if (ui.mode === 'scene') {
        ui.sel = segmentIndex(state.segments, ui.t)
      }
      for (const b of document.querySelectorAll('[data-mode]')) {
        b.classList.toggle('on', b === button)
      }
      show()
    })
  }
  for (const button of document.querySelectorAll('[data-tab]')) {
    button.addEventListener('click', () => {
      ui.tab = button.dataset.tab
      for (const b of document.querySelectorAll('[data-tab]')) {
        b.classList.toggle('on', b === button)
      }
      $('#tab').dataset.seg = ''
      show()
    })
  }
  for (const button of document.querySelectorAll('[data-view]')) {
    button.addEventListener('click', () => {
      ui.view = button.dataset.view
      for (const b of document.querySelectorAll('[data-view]')) {
        b.classList.toggle('on', b === button)
      }
      $('#scenes').hidden = ui.view !== 'scenes'
      $('#render').hidden = ui.view !== 'render'
      show()
    })
  }
  $('#undo').addEventListener('click', async () => {
    const res = await post('/undo', {})
    if (res.error) {
      alert(res.error)
    }
  })
  async function send() {
    const text = $('#ask textarea').value.trim()
    if (!text || state.segments.length === 0) {
      return
    }
    const i = current()
    const res = await post('/chat', { message: text, segment: i, at: ui.t - state.segments[i].start })
    if (res.error) {
      alert(res.error)
      return
    }
    $('#ask textarea').value = ''
    await refreshChat()
  }
  async function refreshChat() {
    const res = await fetch('/chat')
    Object.assign(state, await res.json())
    chat()
    versions()
  }
  $('#ask').addEventListener('submit', (e) => {
    e.preventDefault()
    send()
  })
  $('#ask textarea').addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      send()
    }
  })
  $('#clear').addEventListener('click', async () => {
    await post('/chat/clear', {})
    await refreshChat()
  })
  $('#render-draft').addEventListener('click', () => startRender(true))
  $('#render-final').addEventListener('click', () => startRender(false))
  document.addEventListener('keydown', (e) => {
    if (e.code === 'Space' && e.target === document.body) {
      e.preventDefault()
      $('#play').click()
    }
  })
  addEventListener('resize', show)
  new EventSource('/events').addEventListener('message', (e) => (e.data === 'chat' ? refreshChat() : load()))
  setPlay()
  load()
  requestAnimationFrame(tick)
}

const svg = (paths) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`

const ICONS = {
  play: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 4.5v15a1 1 0 0 0 1.5.86l12.5-7.5a1 1 0 0 0 0-1.72L8.5 3.64A1 1 0 0 0 7 4.5Z"/></svg>',
  pause:
    '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>',
  undo: svg('<path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>'),
  history: svg(
    '<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l4 2"/>',
  ),
  trash: svg(
    '<path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
  ),
  send: svg('<path d="m5 12 7-7 7 7"/><path d="M12 19V5"/>'),
  film: svg(
    '<rect x="2" y="2" width="20" height="20" rx="2.18"/><path d="M7 2v20M17 2v20M2 12h20M2 7h5M2 17h5M17 17h5M17 7h5"/>',
  ),
  check: svg('<path d="M20 6 9 17l-5-5"/>'),
  minus: svg('<path d="M5 12h14"/>'),
  left: svg('<path d="m15 18-6-6 6-6"/>'),
  right: svg('<path d="m9 18 6-6-6-6"/>'),
}

function fontFaces({ assets }) {
  return [assets.sans, assets.mono]
    .filter((font) => font.src)
    .map((font) => `@font-face { font-family: '${font.family}'; src: url(${font.src}); font-weight: 100 900; }`)
    .join('\n')
}

export function studioPage(look) {
  const { brand, assets } = look
  const t = brand.studio
  const config = { stage: STANDARD.stage, content: LAYOUT.content, fade: FADE, settle: ANIMATION_SECONDS, icons: ICONS }
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>Studio | ${brand.name}</title>
${assets.favicon ? `<link rel="icon" href="${assets.favicon}" />` : ''}
${assets.fontsUrl ? `<link rel="stylesheet" href="${assets.fontsUrl}" />` : ''}
<style>
  ${fontFaces(look)}
  :root {
    color-scheme: light;
    --foreground: ${t.foreground};
    --muted: ${t.muted};
    --surface: ${t.surface};
    --subtle: ${t.subtle};
    --border: ${t.border};
    --border-strong: ${t.borderStrong};
    --primary: ${t.primary};
    --primary-hover: ${t.primaryHover};
    --secondary: ${t.secondary};
    --error: #dc2a30;
    --warn: #a85800;
    --radius: 10px;
    --shade: color-mix(in oklab, var(--foreground) 100%, black 40%);
    --shadow-xs: 0 1px 2px color-mix(in oklab, var(--shade) 4%, transparent), 0 1px 2px -1px color-mix(in oklab, var(--shade) 4%, transparent);
    --shadow-sm: 0 1px 4px color-mix(in oklab, var(--shade) 6%, transparent), 0 1px 3px -1px color-mix(in oklab, var(--shade) 6%, transparent);
    --shadow-lg: 0 10px 16px -4px color-mix(in oklab, var(--shade) 8%, transparent), 0 4px 8px -3px color-mix(in oklab, var(--shade) 8%, transparent);
    --shadow-frame: 0 0 32px 2px color-mix(in oklab, var(--shade) 8%, transparent);
    --shadow-button: 0 1px 1px color-mix(in oklab, var(--shade) 10%, transparent), 0 2px 3px color-mix(in oklab, var(--shade) 8%, transparent), inset 0 -3px 2px color-mix(in oklab, var(--shade) 10%, transparent), inset 0 2px 0.5px rgb(255 255 255 / 20%), inset 0 0 0 1px color-mix(in oklab, var(--shade) 20%, transparent);
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font: 14px/20px '${assets.sans.family}', system-ui, -apple-system, sans-serif; color: var(--foreground); background: var(--surface); height: 100vh; display: grid; grid-template-rows: 56px 1fr; -webkit-font-smoothing: antialiased; }
  button, input, textarea { font: inherit; color: inherit; }
  [hidden] { display: none !important; }
  .icon { display: inline-flex; width: 16px; height: 16px; flex: none; }
  .icon svg { width: 100%; height: 100%; }

  header { display: flex; align-items: center; gap: 14px; padding: 0 20px; background: white; border-bottom: 1px solid var(--border); }
  .logo { display: flex; height: 20px; color: var(--foreground); }
  .logo svg { height: 100%; width: auto; }
  .divider { width: 1px; height: 20px; background: var(--border-strong); }
  header h1 { font-size: 14px; font-weight: 600; }
  #summary { display: flex; gap: 6px; }
  .chip { display: inline-flex; align-items: center; gap: 4px; height: 22px; padding: 0 8px; border-radius: 6px; background: var(--subtle); color: var(--muted); font-size: 12px; font-weight: 500; }
  .chip.error { background: #ffe1df; color: #951e1f; }
  .chip.warn { background: #fff1d6; color: #7a3d00; }
  header .tabs { margin-left: auto; }

  .tabs { display: inline-flex; gap: 4px; padding: 4px; border-radius: var(--radius); background: var(--subtle); height: 36px; }
  .tabs button { display: inline-flex; align-items: center; gap: 6px; padding: 0 10px; border: 1px solid transparent; border-radius: 8px; background: transparent; color: var(--muted); font-weight: 500; cursor: pointer; transition: background-color 100ms ease-out, color 100ms ease-out; }
  .tabs button:hover { background: white; }
  .tabs button.on { background: white; color: var(--foreground); box-shadow: var(--shadow-sm); }
  .count { min-width: 18px; height: 18px; padding: 0 5px; border-radius: 9px; background: var(--border); color: var(--muted); font-size: 11px; line-height: 18px; text-align: center; font-variant-numeric: tabular-nums; }

  .btn { display: inline-flex; align-items: center; justify-content: center; gap: 6px; height: 32px; padding: 0 12px; border-radius: 8px; border: 1px solid var(--border-strong); background: white; font-weight: 500; white-space: nowrap; box-shadow: var(--shadow-xs); cursor: pointer; transition: background-color 100ms ease-out; }
  .btn:hover { background: var(--subtle); }
  .btn:active { background: var(--border); }
  .btn:disabled { color: color-mix(in oklab, var(--muted) 60%, white); box-shadow: none; border-color: var(--border); background: white; cursor: default; }
  .btn.ghost { border-color: transparent; box-shadow: none; background: transparent; }
  .btn.ghost:hover { background: var(--subtle); }
  .btn.primary { background: var(--primary); color: white; border-color: transparent; box-shadow: var(--shadow-button); }
  .btn.primary:hover { background: var(--primary-hover); }
  .btn.primary:disabled { background: color-mix(in oklab, var(--primary) 45%, white); color: rgb(255 255 255 / 80%); box-shadow: none; }
  .btn.sm { height: 28px; padding: 0 10px; font-size: 12px; }
  :focus-visible { outline: none; box-shadow: 0 0 0 3px var(--border-strong); }

  #scenes { display: grid; grid-template-rows: 1fr auto; min-height: 0; }
  main { display: grid; grid-template-columns: minmax(0, 1fr) 384px; min-height: 0; }
  .preview { padding: 20px 24px; min-width: 0; min-height: 0; container-type: size; display: grid; place-content: center; }
  .player { width: min(100cqw, (100cqh - 84px) * 16 / 9); display: grid; gap: 12px; }
  #where { color: var(--muted); font-size: 13px; }
  #where b { color: var(--foreground); font-weight: 600; }
  #view { position: relative; aspect-ratio: 16 / 9; overflow: hidden; border-radius: var(--radius); background: white; box-shadow: var(--shadow-frame); outline: 1px solid var(--border); }
  .thumb { position: relative; aspect-ratio: 16 / 9; overflow: hidden; border-radius: 8px; background: white; outline: 1px solid var(--border); }
  .stage { position: absolute; left: 0; top: 0; transform-origin: 0 0; }
  .stage iframe { border: 0; pointer-events: none; background: transparent; }
  .blocking { padding: 16px; }

  .transport { display: flex; gap: 16px; align-items: center; }
  #play { width: 40px; height: 40px; border-radius: 50%; border: 0; background: var(--secondary); color: white; display: grid; place-items: center; cursor: pointer; box-shadow: var(--shadow-button); flex: none; }
  #play .icon { width: 16px; height: 16px; }
  #play:hover { background: color-mix(in oklab, var(--secondary) 80%, white); }
  #time { font-variant-numeric: tabular-nums; color: var(--muted); min-width: 104px; }
  #time b { color: var(--foreground); font-weight: 600; }
  #scrub { flex: 1; appearance: none; height: 20px; background: transparent; cursor: pointer; --p: 0%; }
  #scrub::-webkit-slider-runnable-track { height: 4px; border-radius: 2px; background: linear-gradient(to right, var(--secondary) var(--p), var(--border) var(--p)); }
  #scrub::-moz-range-track { height: 4px; border-radius: 2px; background: linear-gradient(to right, var(--secondary) var(--p), var(--border) var(--p)); }
  #scrub::-webkit-slider-thumb { appearance: none; width: 4px; height: 20px; margin-top: -8px; border-radius: 2px; background: var(--primary); box-shadow: 0 0 0 2px white; }
  #scrub::-moz-range-thumb { width: 4px; height: 20px; border: 0; border-radius: 2px; background: var(--primary); }

  aside { background: white; border-left: 1px solid var(--border); display: flex; flex-direction: column; min-height: 0; }
  .side-head { display: flex; justify-content: space-between; align-items: baseline; gap: 12px; padding: 16px 20px 0; }
  .side-head b { font-size: 16px; line-height: 24px; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .side-head span { color: var(--muted); font-variant-numeric: tabular-nums; }
  .side-tools { position: relative; display: flex; gap: 8px; padding: 12px 20px; border-bottom: 1px solid var(--border); align-items: center; }
  .side-tools #clear { margin-left: auto; }
  summary { list-style: none; }
  summary::-webkit-details-marker { display: none; }
  details ol { position: absolute; z-index: 3; top: calc(100% - 4px); left: 20px; right: 20px; max-height: 360px; overflow: auto; background: white; border: 1px solid var(--border); border-radius: var(--radius); padding: 4px; list-style: none; box-shadow: var(--shadow-lg); }
  details li { display: flex; gap: 10px; justify-content: space-between; align-items: center; padding: 8px; border-radius: 6px; }
  details li:hover { background: var(--surface); }
  details li div { display: grid; min-width: 0; }
  details li b { font-weight: 500; font-size: 13px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  details li span { color: var(--muted); font-size: 12px; font-variant-numeric: tabular-nums; }
  details ol:empty::before { content: 'No versions yet: each change keeps the one before it.'; display: block; padding: 8px; color: var(--muted); font-size: 13px; }
  .side-tabs { padding: 12px 20px 0; }
  .side-tabs .tabs { width: 100%; }
  .side-tabs .tabs button { flex: 1; justify-content: center; }

  #tab { padding: 16px 20px 20px; overflow: auto; display: grid; gap: 16px; align-content: start; }
  #tab h3 { font-size: 13px; font-weight: 600; }
  .help { color: var(--muted); font-size: 13px; }
  .field { display: grid; gap: 6px; }
  .label { font-size: 13px; font-weight: 500; }
  .field input, .field textarea, #ask textarea { width: 100%; border: 1px solid var(--border-strong); border-radius: 8px; background: white; padding: 8px 12px; box-shadow: var(--shadow-xs); outline: none; resize: vertical; transition: border-color 80ms ease-out, box-shadow 80ms ease-out; }
  .field input { height: 36px; padding: 0 12px; }
  .field input::placeholder, .field textarea::placeholder, #ask textarea::placeholder { color: var(--muted); }
  .field input:hover, .field textarea:hover, #ask textarea:hover { background: var(--surface); }
  .field input:focus-visible, .field textarea:focus-visible, #ask textarea:focus-visible { background: white; box-shadow: 0 0 0 3px var(--border-strong); }
  .field .bad { border-color: var(--error); }
  .note { color: var(--error); font-size: 12px; }
  .note:empty { display: none; }
  .row { display: flex; gap: 8px; }
  ul { list-style: none; display: grid; gap: 8px; }
  .finding { display: flex; gap: 10px; padding: 10px 12px; border-radius: 8px; border: 1px solid var(--border); background: var(--surface); }
  .finding .dot { width: 8px; height: 8px; margin-top: 6px; border-radius: 50%; background: var(--muted); flex: none; }
  .finding.error .dot { background: var(--error); }
  .finding.warn .dot { background: #f59e0b; }
  .finding b { font-weight: 600; font-size: 13px; }
  .finding p { font-size: 13px; }
  .finding code { font: 11px/16px '${assets.mono.family}', ui-monospace, monospace; color: var(--muted); }

  #chat { display: grid; grid-template-rows: 1fr auto; min-height: 0; flex: 1; }
  #log { overflow: auto; padding: 16px 20px; display: flex; flex-direction: column; gap: 12px; }
  .bubble { padding: 10px 14px; border-radius: 12px; background: var(--subtle); white-space: pre-wrap; display: grid; gap: 6px; max-width: 92%; }
  .bubble.user { background: var(--secondary); color: white; align-self: flex-end; border-bottom-right-radius: 4px; }
  .bubble:not(.user) { border-bottom-left-radius: 4px; }
  .bubble small { display: inline-flex; align-items: center; gap: 4px; color: var(--muted); font-size: 12px; }
  .bubble small .icon { width: 14px; height: 14px; }
  .waiting { display: inline-flex; align-items: center; gap: 8px; color: var(--muted); font-size: 13px; align-self: flex-start; }
  .pulse { width: 8px; height: 8px; border-radius: 50%; background: var(--primary); animation: pulse 1.2s ease-in-out infinite; }
  @keyframes pulse { 50% { opacity: 0.25; } }
  .hint { margin: auto 0; padding: 16px; border: 1px dashed var(--border-strong); border-radius: var(--radius); color: var(--muted); font-size: 13px; text-align: center; }
  #ask { padding: 12px 20px 16px; border-top: 1px solid var(--border); display: grid; gap: 8px; }
  #ask textarea { min-height: 76px; }
  #ask div { display: flex; justify-content: space-between; align-items: center; color: var(--muted); font-size: 12px; }
  kbd { font: 500 11px/18px inherit; padding: 0 5px; border-radius: 4px; border: 1px solid var(--border-strong); background: var(--surface); box-shadow: 0 1px 0 var(--border-strong); }

  #strip { display: flex; gap: 12px; overflow-x: auto; padding: 14px 24px 16px; background: white; border-top: 1px solid var(--border); }
  .tile { position: relative; flex: none; width: 216px; overflow: hidden; grid-template-columns: minmax(0, 1fr); grid-template-rows: auto 20px; padding: 6px; border-radius: 12px; border: 1px solid transparent; background: transparent; text-align: left; display: grid; gap: 8px; cursor: pointer; transition: background-color 100ms ease-out; }
  .tile:hover { background: var(--surface); }
  .tile.on { border-color: var(--primary); box-shadow: 0 0 0 1px var(--primary); background: white; }
  .tile .num { position: absolute; top: 12px; left: 12px; min-width: 20px; height: 20px; padding: 0 6px; border-radius: 6px; background: var(--secondary); color: white; font-size: 11px; font-weight: 600; line-height: 20px; text-align: center; }
  .tile .caption { min-width: 0; display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 0 2px; font-size: 12px; line-height: 20px; }
  .tile .caption b { min-width: 0; font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .tile .caption span { flex: none; color: var(--muted); font-variant-numeric: tabular-nums; }
  .badge { position: absolute; top: 12px; right: 12px; min-width: 20px; height: 20px; padding: 0 6px; border-radius: 10px; color: white; font-size: 11px; font-weight: 600; line-height: 20px; text-align: center; }
  .badge.error { background: var(--error); }
  .badge.warn { background: #f59e0b; }

  #render { padding: 24px; display: grid; grid-template-columns: minmax(0, 1fr) 384px; gap: 24px; min-height: 0; }
  .panel { background: white; border: 1px solid var(--border); border-radius: var(--radius); box-shadow: var(--shadow-xs); padding: 16px; display: flex; flex-direction: column; gap: 14px; min-height: 0; }
  .panel h2 { font-size: 14px; font-weight: 600; }
  #render .row { align-items: center; }
  #render-status { color: var(--muted); font-size: 13px; }
  #render-video { width: 100%; border-radius: 8px; background: var(--secondary); }
  #render-log { flex: 1; overflow: auto; background: var(--surface); border: 1px solid var(--border); border-radius: 8px; padding: 12px; font: 12px/18px '${assets.mono.family}', ui-monospace, monospace; white-space: pre-wrap; color: var(--muted); }
</style>
</head>
<body>
<header>
  ${assets.logo ? `<div class="logo">${assets.logo}</div><span class="divider"></span>` : ''}
  <h1 id="title">Storyboard</h1>
  <div id="summary"></div>
  <nav class="tabs"><button data-view="scenes" class="on">Scenes</button><button data-view="render">Render</button></nav>
</header>
<div id="scenes">
  <main>
    <section class="preview">
      <div class="player">
        <div id="where"></div>
        <div id="view"></div>
        <div class="transport">
          <nav class="tabs"><button data-mode="scene" class="on">This segment</button><button data-mode="video">Whole video</button></nav>
          <button id="play"></button>
          <span id="time"></span>
          <input id="scrub" type="range" step="0.01" aria-label="Time" />
        </div>
      </div>
    </section>
    <aside>
      <div class="side-head"><b id="seg-name"></b><span id="seg-seconds"></span></div>
      <div class="side-tools">
        <button id="undo" class="btn"><span class="icon">${ICONS.undo}</span>Undo</button>
        <details id="versions"><summary class="btn"></summary><ol></ol></details>
        <button id="clear" class="btn ghost"><span class="icon">${ICONS.trash}</span>Clear chat</button>
      </div>
      <div class="side-tabs"><nav class="tabs"><button data-tab="chat" class="on">Chat</button><button data-tab="edit">Edit</button><button data-tab="findings">Findings</button></nav></div>
      <div id="chat">
        <div id="log"></div>
        <form id="ask"><textarea rows="3"></textarea><div><span><kbd>⌘</kbd> <kbd>↵</kbd> to send</span><button class="btn primary"><span class="icon">${ICONS.send}</span>Send</button></div></form>
      </div>
      <div id="tab" hidden></div>
    </aside>
  </main>
  <nav id="strip"></nav>
</div>
<section id="render" hidden>
  <div class="panel">
    <div class="row">
      <button id="render-draft" class="btn primary"><span class="icon">${ICONS.film}</span>Render draft</button>
      <button id="render-final" class="btn">Render final cut</button>
      <span id="render-status"></span>
    </div>
    <video id="render-video" controls hidden></video>
    <h2>Review</h2>
    <ul id="render-findings"></ul>
  </div>
  <div class="panel"><h2>Log</h2><pre id="render-log"></pre></div>
</section>
<script>(${client})({ segmentIndex: ${segmentAt}, el: ${browserEl}, post: ${browserPost}, renderStatus: ${browserRenderStatus} }, ${JSON.stringify(config)})</script>
</body>
</html>
`
}
