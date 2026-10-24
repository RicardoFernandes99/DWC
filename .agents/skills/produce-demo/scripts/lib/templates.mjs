import { html, raw } from '../../../shared/html/index.mjs'
import { STANDARD } from './standard.mjs'

const { width: W, height: H } = STANDARD.stage

// The take plays at exactly 14/15: any other width between 92% and 94% downscales unevenly.
export const LAYOUT = {
  window: { x: 288, y: 96, width: 1344, chrome: 32, radius: 16 },
  content: { x: 288, y: 128, width: 1344, height: 840 },
  captionTop: 968,
  progress: 3,
}

export const ANIMATION_SECONDS = 1.6

export const CAPTION_DELAY = { title: 0.85, recap: 0.9 }

const css = String.raw

function holeMask() {
  const { x, y, width, height } = LAYOUT.content
  const r = LAYOUT.window.radius
  const right = x + width
  const bottom = y + height
  const d =
    `M0 0H${W}V${H}H0Z` +
    `M${x} ${y}H${right}V${bottom - r}A${r} ${r} 0 0 1 ${right - r} ${bottom}H${x + r}A${r} ${r} 0 0 1 ${x} ${bottom - r}Z`
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><path fill-rule="evenodd" d="${d}"/></svg>`
  return `url("data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}")`
}

function styles(brand, assets) {
  const c = brand.colors
  return css`
    ${assets.sans.src ? `@font-face { font-family: '${assets.sans.family}'; src: url(${assets.sans.src}); font-weight: 100 900; }` : ''}
    ${assets.mono.src ? `@font-face { font-family: '${assets.mono.family}'; src: url(${assets.mono.src}); font-weight: 100 900; }` : ''}
    :root {
      --ink: ${c.ink};
      --muted: ${c.muted};
      --accent: ${c.accent};
      --accent-soft: ${c.accentSoft};
      --accent-faint: ${c.accentFaint};
      --line: ${c.line};
      --canvas: ${c.canvas};
      --glow: ${c.glow};
      --caption: ${c.caption};
      --end-a: ${c.end[0]};
      --end-b: ${c.end[1]};
      --end-glow: ${c.endGlow};
      --sans: '${assets.sans.family}', system-ui, -apple-system, 'Segoe UI', sans-serif;
      --mono: '${assets.mono.family}', ui-monospace, 'SF Mono', monospace;
    }
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    html,
    body {
      width: ${W}px;
      height: ${H}px;
      overflow: hidden;
      background: transparent;
    }
    body {
      font-family: var(--sans);
      color: var(--ink);
      -webkit-font-smoothing: antialiased;
    }
    .bg {
      position: absolute;
      inset: 0;
      background:
        radial-gradient(1460px 900px at 0% 0%, var(--glow), transparent 62%),
        radial-gradient(1330px 850px at 100% 100%, color-mix(in srgb, var(--line) 55%, var(--glow)), transparent 60%),
        var(--canvas);
    }
    .bg.masked {
      -webkit-mask: ${holeMask()} 0 0 / 100% 100% no-repeat;
    }
    .bg.end {
      background:
        radial-gradient(1200px 800px at 15% 10%, var(--end-glow), transparent 60%),
        linear-gradient(150deg, var(--end-a), var(--end-b));
    }
    .center {
      position: absolute;
      inset: 0 0 ${H - LAYOUT.captionTop}px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      text-align: center;
      padding: 0 220px;
    }
    .rise {
      animation: rise 0.6s cubic-bezier(0.2, 0.7, 0.2, 1) both;
      animation-delay: var(--d, 0s);
    }
    @keyframes rise {
      from {
        opacity: 0;
        transform: translateY(14px);
      }
      to {
        opacity: 1;
        transform: none;
      }
    }
    .logo svg {
      display: block;
      height: 100%;
      width: auto;
    }
    .on-dark svg {
      filter: brightness(0) invert(1);
    }
    .eyebrow {
      font-size: 14px;
      font-weight: 600;
      letter-spacing: 0.18em;
      text-transform: uppercase;
      color: var(--accent);
    }
    .display {
      font-weight: 600;
      letter-spacing: -0.025em;
      line-height: 1.08;
      text-wrap: balance;
    }
    .lede {
      font-size: 24px;
      line-height: 1.5;
      color: var(--muted);
      text-wrap: balance;
      max-width: 1040px;
    }
    .chips {
      display: flex;
      gap: 12px;
      list-style: none;
      justify-content: center;
    }
    .chips li {
      font-size: 17px;
      font-weight: 500;
      padding: 8px 18px;
      border-radius: 999px;
      border: 1px solid var(--line);
      background: white;
      color: var(--accent);
    }
    .chips li:last-child {
      background: var(--accent);
      border-color: var(--accent);
      color: white;
    }
    .number {
      font-size: 160px;
      font-weight: 400;
      line-height: 1;
      letter-spacing: -0.02em;
      color: transparent;
      -webkit-text-stroke: 1.5px var(--accent-faint);
      font-variant-numeric: tabular-nums;
    }
    .rule {
      display: block;
      width: 76px;
      height: 3px;
      border-radius: 2px;
      background: var(--accent-soft);
    }
    .caption-row {
      position: absolute;
      top: ${LAYOUT.captionTop}px;
      bottom: ${LAYOUT.progress}px;
      left: 0;
      right: 0;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .caption {
      max-width: 1200px;
      padding: 13px 28px;
      border-radius: 12px;
      background: var(--caption);
      color: white;
      font-size: 21px;
      font-weight: 500;
      line-height: 1.45;
      text-align: center;
      text-wrap: balance;
      box-shadow: 0 10px 30px color-mix(in srgb, var(--caption) 28%, transparent);
    }
    .scene-head {
      position: absolute;
      left: ${LAYOUT.window.x}px;
      right: ${W - LAYOUT.window.x - LAYOUT.window.width}px;
      top: 0;
      height: ${LAYOUT.window.y}px;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .eyebrow + .scene-title {
      margin-top: 8px;
    }
    .scene-title {
      font-size: 36px;
      font-weight: 600;
      letter-spacing: -0.02em;
      line-height: 1.15;
    }
    .brandmark {
      display: flex;
      align-items: center;
      gap: 12px;
      font-size: 16px;
      color: var(--muted);
    }
    .brandmark .logo {
      height: 26px;
    }
    .brandmark .divider {
      width: 1px;
      height: 18px;
      background: var(--line);
    }
    .window {
      position: absolute;
      left: ${LAYOUT.window.x}px;
      top: ${LAYOUT.window.y}px;
      width: ${LAYOUT.window.width}px;
      height: ${LAYOUT.content.y + LAYOUT.content.height - LAYOUT.window.y}px;
      border-radius: ${LAYOUT.window.radius}px;
      box-shadow:
        0 30px 60px -20px rgba(0, 0, 0, 0.22),
        0 0 0 1px rgba(0, 0, 0, 0.06);
    }
    .rail {
      position: absolute;
      top: ${LAYOUT.content.y}px;
      right: ${W - LAYOUT.window.x + 28}px;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 18px;
    }
    .rail-number {
      font-size: 40px;
      font-weight: 600;
      line-height: 1;
      color: transparent;
      -webkit-text-stroke: 1.5px var(--accent-soft);
      font-variant-numeric: tabular-nums;
    }
    .rail .eyebrow {
      writing-mode: vertical-rl;
      transform: rotate(180deg);
      letter-spacing: 0.24em;
    }
    .chrome {
      height: ${LAYOUT.window.chrome}px;
      border-radius: ${LAYOUT.window.radius}px ${LAYOUT.window.radius}px 0 0;
      background: color-mix(in srgb, var(--canvas) 70%, white);
      border-bottom: 1px solid color-mix(in srgb, var(--line) 60%, transparent);
      display: flex;
      align-items: center;
      gap: 7px;
      padding-left: 16px;
    }
    .chrome i {
      width: 10px;
      height: 10px;
      border-radius: 50%;
      background: color-mix(in srgb, var(--line) 80%, var(--muted));
    }
    .url-row {
      position: absolute;
      top: ${LAYOUT.window.y}px;
      height: ${LAYOUT.window.chrome}px;
      left: 0;
      right: 0;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .url {
      font-family: var(--mono);
      font-size: 13px;
      color: var(--muted);
      background: white;
      border: 1px solid color-mix(in srgb, var(--line) 70%, transparent);
      border-radius: 999px;
      padding: 5px 16px;
    }
    .progress {
      position: absolute;
      left: 0;
      bottom: 0;
      width: ${W}px;
      height: ${LAYOUT.progress}px;
      background: linear-gradient(90deg, var(--accent), var(--accent-soft));
    }
    .recap {
      position: absolute;
      inset: 140px ${LAYOUT.window.x}px 150px;
    }
    table {
      width: 100%;
      border-collapse: separate;
      border-spacing: 0 10px;
      font-size: 18px;
    }
    th {
      text-align: left;
      font-size: 13px;
      font-weight: 600;
      letter-spacing: 0.16em;
      text-transform: uppercase;
      color: var(--accent);
      padding: 0 22px 2px;
    }
    td {
      background: white;
      padding: 16px 22px;
      border-block: 1px solid color-mix(in srgb, var(--line) 60%, transparent);
    }
    td:first-child {
      border-left: 1px solid color-mix(in srgb, var(--line) 60%, transparent);
      border-radius: 10px 0 0 10px;
      font-weight: 600;
      width: 22%;
    }
    td:last-child {
      border-right: 1px solid color-mix(in srgb, var(--line) 60%, transparent);
      border-radius: 0 10px 10px 0;
      font-weight: 600;
      color: var(--accent);
    }
    td.before {
      color: var(--muted);
      width: 34%;
    }
    td.arrow {
      color: var(--accent-faint);
      width: 48px;
      padding: 0;
      text-align: center;
    }
    .end-title {
      color: white;
      font-size: 68px;
    }
    .link {
      font-family: var(--mono);
      font-size: 19px;
      color: color-mix(in srgb, var(--line) 85%, white);
    }
    .pin-pill {
      position: absolute;
      display: flex;
      align-items: center;
      gap: 9px;
      padding: 8px 16px 8px 12px;
      border-radius: 999px;
      background: white;
      color: var(--ink);
      box-shadow:
        inset 0 0 0 1.5px var(--line),
        0 8px 24px rgba(0, 0, 0, 0.16);
      font: 600 15px/20px var(--sans);
      letter-spacing: 0.01em;
      white-space: nowrap;
    }
    .pin-dot {
      flex: none;
      width: 9px;
      height: 9px;
      border-radius: 50%;
      background: var(--accent-soft);
    }
    .pin-line {
      position: absolute;
      background: var(--accent-soft);
    }
    .pin-anchor {
      position: absolute;
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: var(--accent-soft);
      box-shadow: 0 0 0 2px white;
    }
    #layer {
      position: absolute;
    }
    .note {
      font-size: 14px;
      font-weight: 600;
      letter-spacing: 0.18em;
      text-transform: uppercase;
      color: rgba(255, 255, 255, 0.7);
    }
  `
}

function page({ brand, assets }, body) {
  return String(html`<!doctype html>
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        ${assets.fontsUrl ? html`<link rel="stylesheet" href="${assets.fontsUrl}" />` : null}
        <style>
          ${raw(styles(brand, assets))}
        </style>
      </head>
      <body>
        ${body}
      </body>
    </html>`)
}

const logo = (assets, height, dark = false) =>
  assets.logo
    ? html`<div class="logo${dark ? ' on-dark' : ''}" style="height:${height}px">${raw(assets.logo)}</div>`
    : null

const at = (d) => `--d:${d}s`

const captionBar = (text, delay) =>
  text
    ? html`<div class="caption-row">
        <p class="caption rise" style="${at(delay)}">${text}</p>
      </div>`
    : null

export function titleCard(sb, look) {
  const { assets } = look
  return page(
    look,
    html`<div class="bg"></div>
      <main class="center" style="gap:0">
        <div class="rise" style="${at(0)};margin-bottom:40px">${logo(assets, 42)}</div>
        ${sb.eyebrow ? html`<p class="eyebrow rise" style="${at(0.12)}">${sb.eyebrow}</p>` : null}
        <h1 class="display rise" style="${at(0.2)};font-size:78px;margin-top:22px">${sb.title}</h1>
        ${sb.subtitle ? html`<p class="lede rise" style="${at(0.34)};margin-top:22px">${sb.subtitle}</p>` : null}
        ${
          sb.chips.length > 0
            ? html`<ul class="chips rise" style="${at(0.46)};margin-top:36px">
                ${sb.chips.map((chip) => html`<li>${chip}</li>`)}
              </ul>`
            : null
        }
      </main>
      ${captionBar(sb.intro, CAPTION_DELAY.title)}`,
  )
}

export function chapterCard(sb, index, look) {
  const chapter = sb.chapters[index]
  return page(
    look,
    html`<div class="bg"></div>
      <main class="center">
        <div class="number rise" style="${at(0)}">${String(index + 1).padStart(2, '0')}</div>
        <p class="eyebrow rise" style="${at(0.12)};margin-top:26px">${chapter.label}</p>
        <h1 class="display rise" style="${at(0.2)};font-size:64px;margin-top:18px">${chapter.title}</h1>
        ${chapter.summary ? html`<p class="lede rise" style="${at(0.34)};margin-top:22px">${chapter.summary}</p>` : null}
        <span class="rule rise" style="${at(0.46)};margin-top:36px"></span>
      </main>`,
  )
}

export function sceneFrame(sb, index, look) {
  const { assets } = look
  const chapter = sb.chapters[index]
  return page(
    look,
    html`<div class="bg masked"></div>
      <header class="scene-head">
        <h1 class="scene-title">${chapter.title}</h1>
        <div class="brandmark">
          ${logo(assets, 26)}
          ${sb.product ? html`${assets.logo ? html`<span class="divider"></span>` : null}<span>${sb.product}</span>` : null}
        </div>
      </header>
      <div class="rail">
        <span class="rail-number">${String(index + 1).padStart(2, '0')}</span>
        <span class="eyebrow">${chapter.label}</span>
      </div>
      <div class="window">
        <div class="chrome"><i></i><i></i><i></i></div>
      </div>`,
  )
}

export function urlLayer(url, look) {
  return page(look, html`<div class="url-row"><span class="url" id="layer">${url}</span></div>`)
}

export function captionLayer(text, look) {
  return page(
    look,
    html`<div class="caption-row">
      <p class="caption" id="layer">${text}</p>
    </div>`,
  )
}

export function calloutLayer(callout, [width, height], look) {
  const data = JSON.stringify({ box: callout.box, pin: callout.pin, edited: callout.edited, view: [width, height] })
  return page(
    look,
    html`<div class="pin-line"></div>
      <div class="pin-anchor"></div>
      <div class="pin-pill"><span class="pin-dot"></span><span>${callout.text}</span></div>
      <div id="layer"></div>
      <script type="application/json" id="pin">
        ${raw(data.replaceAll('<', String.raw`\u003c`))}
      </script>
      <script>
        ${raw(PLACE_PIN)}
      </script>`,
  )
}

const PLACE_PIN = String.raw`window.place = () => {
  const { box: b, pin: p, edited, view: [vw, vh] } = JSON.parse(document.getElementById('pin').textContent)
  const pill = document.querySelector('.pin-pill')
  const w = pill.offsetWidth
  const h = pill.offsetHeight
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v))
  const vertical = p.side === 'below' || p.side === 'above'
  let { x, y } = p
  // The take measured its pill in the filmed page's font, so one the brand's font resizes is placed again.
  if (edited || Math.abs(w - p.width) > 0.5 || Math.abs(h - p.height) > 0.5) {
    x = vertical ? b.x + b.width / 2 - w / 2 : p.side === 'right' ? b.x + b.width + p.stalk : b.x - p.stalk - w
    y = vertical ? (p.side === 'below' ? b.y + b.height + p.stalk : b.y - p.stalk - h) : b.y + b.height / 2 - h / 2
    x = clamp(x, 12, vw - w - 12)
    y = clamp(y, 12, vh - h - 12)
  }
  pill.style.left = x + 'px'
  pill.style.top = y + 'px'
  const line = document.querySelector('.pin-line')
  const anchor = document.querySelector('.pin-anchor')
  let ax, ay
  if (vertical) {
    ax = clamp(b.x + b.width / 2, Math.max(x + h / 2, b.x), Math.min(x + w - h / 2, b.x + b.width))
    ay = p.side === 'below' ? b.y + b.height : b.y
    Object.assign(line.style, { left: ax - 1 + 'px', top: (p.side === 'below' ? ay : y + h) + 'px', width: '2px', height: p.stalk + 'px' })
  } else {
    ay = y + h / 2
    ax = p.side === 'right' ? b.x + b.width : b.x
    Object.assign(line.style, { left: (p.side === 'right' ? ax : x + w) + 'px', top: ay - 1 + 'px', width: p.stalk + 'px', height: '2px' })
  }
  Object.assign(anchor.style, { left: ax - 4 + 'px', top: ay - 4 + 'px' })
  const r = [pill, line, anchor].map((e) => e.getBoundingClientRect())
  const left = Math.min(...r.map((q) => q.left))
  const top = Math.min(...r.map((q) => q.top))
  Object.assign(document.getElementById('layer').style, {
    left: left + 'px',
    top: top + 'px',
    width: Math.max(...r.map((q) => q.right)) - left + 'px',
    height: Math.max(...r.map((q) => q.bottom)) - top + 'px',
  })
}`

export function progressLayer(look) {
  return page(look, html`<div class="progress" id="layer"></div>`)
}

export function recapCard(sb, look) {
  const { recap } = sb
  const { assets } = look
  const step = Math.min(0.08, 0.7 / recap.rows.length)
  return page(
    look,
    html`<div class="bg"></div>
      <header class="scene-head">
        <div>
          <p class="eyebrow rise" style="${at(0)}">${recap.eyebrow}</p>
          <h1 class="scene-title rise" style="${at(0.1)}">${recap.title}</h1>
        </div>
        <div class="brandmark rise" style="${at(0)}">
          ${logo(assets, 26)}
          ${sb.product ? html`${assets.logo ? html`<span class="divider"></span>` : null}<span>${sb.product}</span>` : null}
        </div>
      </header>
      <main class="recap">
        <table>
          <thead class="rise" style="${at(0.2)}">
            <tr>
              <th>${recap.columns[0]}</th>
              <th>${recap.columns[1]}</th>
              <th></th>
              <th>${recap.columns[2]}</th>
            </tr>
          </thead>
          <tbody>
            ${recap.rows.map(
              ([screen, before, now], i) =>
                html`<tr class="rise" style="${at(0.3 + i * step)}">
                  <td>${screen}</td>
                  <td class="before">${before}</td>
                  <td class="arrow">→</td>
                  <td>${now}</td>
                </tr>`,
            )}
          </tbody>
        </table>
      </main>
      ${captionBar(recap.caption, CAPTION_DELAY.recap)}`,
  )
}

export function endCard(sb, look) {
  const { assets } = look
  const note = [sb.end.note, look.brand.org].filter(Boolean).join(' · ')
  return page(
    look,
    html`<div class="bg end"></div>
      <main class="center" style="inset:0">
        <div class="rise" style="${at(0)};margin-bottom:40px">${logo(assets, 46, true)}</div>
        <h1 class="display end-title rise" style="${at(0.15)}">${sb.end.title}</h1>
        ${sb.end.link ? html`<p class="link rise" style="${at(0.3)};margin-top:24px">${sb.end.link}</p>` : null}
        ${note ? html`<p class="note rise" style="${at(0.42)};margin-top:40px">${note}</p>` : null}
      </main>`,
  )
}

export function contactSheet(frames, title) {
  return String(html`<!doctype html>
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <style>
          body {
            margin: 0;
            padding: 16px;
            background: #1b1b1f;
            color: #fff;
            font:
              600 14px/1.3 system-ui,
              sans-serif;
            width: 1972px;
          }
          h1 {
            font-size: 15px;
            margin: 0 0 12px;
            color: #c9c9d1;
          }
          .grid {
            display: grid;
            grid-template-columns: repeat(2, 960px);
            gap: 12px;
          }
          figure {
            margin: 0;
          }
          img {
            display: block;
            width: 960px;
          }
          figcaption {
            padding: 2px 0 6px;
            color: #ffe066;
            font-size: 20px;
          }
        </style>
      </head>
      <body>
        <h1>${title}</h1>
        <div class="grid">
          ${frames.map(
            (f) =>
              html`<figure>
                <figcaption>${f.label}</figcaption>
                <img src="${f.src}" alt="" />
              </figure>`,
          )}
        </div>
      </body>
    </html>`)
}
