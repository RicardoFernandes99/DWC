/**
 * Tiny HTML tagged-template helper for the skill renderers — a zero-dependency,
 * zero-build stand-in for JSX. Interpolated values are escaped by default;
 * wrap already-built markup in raw() to interpolate it verbatim.
 *
 * Keep the tag literally named `html` — oxfmt formats the markup inside an
 * `html`-tagged template by tag name.
 *
 * USAGE
 *   import { html, raw } from '../../shared/html/index.mjs'
 *   const card = html`<article><h2>${title}</h2>${body}</article>`  // title escaped
 *   const withSvg = html`<figure>${raw(svgString)}</figure>`        // svg verbatim
 */

class Html {
  constructor(value) {
    this.value = value
  }
  toString() {
    return this.value
  }
}

const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }

function escapeText(value) {
  return String(value).replace(/[&<>"']/g, (ch) => ESCAPES[ch])
}

export function raw(value) {
  return new Html(String(value))
}

// null/undefined/booleans render as nothing; a numeric 0 is NOT dropped — use a ternary or `n > 0` for count guards.
function resolve(value) {
  if (value == null || value === false || value === true) {
    return ''
  }
  if (value instanceof Html) {
    return value.value
  }
  if (Array.isArray(value)) {
    return value.map(resolve).join('')
  }
  return escapeText(value)
}

export function html(strings, ...values) {
  let out = strings[0]
  for (let i = 0; i < values.length; i++) {
    out += resolve(values[i]) + strings[i + 1]
  }
  return new Html(out)
}
