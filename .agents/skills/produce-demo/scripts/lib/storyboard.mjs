import { error, STANDARD, warn } from './standard.mjs'

const TOP = [
  'title',
  'eyebrow',
  'subtitle',
  'chips',
  'audience',
  'product',
  'host',
  'intro',
  'chapters',
  'recap',
  'end',
]
const CHAPTER = ['label', 'title', 'summary', 'take', 'copy']
const RECAP = ['eyebrow', 'title', 'columns', 'rows', 'caption']
const END = ['title', 'link', 'note']

const isText = (v) => typeof v === 'string' && v.trim() !== ''

function unknownKeys(object, allowed, where) {
  return Object.keys(object ?? {})
    .filter((key) => !allowed.includes(key))
    .map((key) => warn('unknown-field', where, `"${key}" is not a storyboard field and is ignored`))
}

function required(object, keys, where) {
  return keys.filter((key) => !isText(object?.[key])).map((key) => error('missing-field', where, `needs "${key}"`))
}

export function validate(sb) {
  if (typeof sb !== 'object' || sb === null || Array.isArray(sb)) {
    return [error('shape', 'storyboard', 'must be a JSON object')]
  }
  const out = [...unknownKeys(sb, TOP, 'storyboard'), ...required(sb, ['title'], 'storyboard')]
  if (sb.audience !== undefined && !['internal', 'client'].includes(sb.audience)) {
    out.push(error('audience', 'storyboard', 'audience is "internal" or "client"'))
  }
  if (sb.host !== undefined && (typeof sb.host !== 'string' || /[\s/]/.test(sb.host))) {
    out.push(error('host', 'storyboard', 'host is a hostname such as app.example.com, or "" for the path alone'))
  }
  if (sb.chips !== undefined && !(Array.isArray(sb.chips) && sb.chips.every(isText) && sb.chips.length <= 4)) {
    out.push(error('chips', 'storyboard', 'chips is a list of up to four short strings'))
  }
  if (!Array.isArray(sb.chapters) || sb.chapters.length === 0) {
    out.push(error('chapters', 'storyboard', 'needs at least one chapter'))
    return out
  }
  if (sb.chapters.length > STANDARD.chapter.warnCount) {
    out.push(
      warn(
        'chapters',
        'storyboard',
        `${sb.chapters.length} chapters; past ${STANDARD.chapter.warnCount} split the video`,
      ),
    )
  }
  const titles = new Map()
  sb.chapters.forEach((chapter, i) => {
    const where = `chapter ${i + 1}`
    out.push(...unknownKeys(chapter, CHAPTER, where), ...required(chapter, ['label', 'title'], where))
    const take = chapter?.take
    if (!(isText(take) || (Array.isArray(take) && take.length > 0 && take.every(isText)))) {
      out.push(error('missing-field', where, 'needs "take": a take, or a list of takes played in order'))
    }
    const copy = chapter?.copy
    if (
      copy !== undefined &&
      (typeof copy !== 'object' || copy === null || Array.isArray(copy) || !Object.values(copy).every(isText))
    ) {
      out.push(error('copy', where, 'copy maps text a take logged to the words to show instead'))
    }
    if (isText(chapter?.title)) {
      const key = chapter.title.trim().toLowerCase()
      if (titles.has(key)) {
        out.push(error('duplicate-title', where, `has the same title as chapter ${titles.get(key)}`))
      }
      titles.set(key, i + 1)
    }
  })
  for (const key of ['recap', 'end']) {
    if (sb[key] !== undefined && (typeof sb[key] !== 'object' || sb[key] === null || Array.isArray(sb[key]))) {
      out.push(error(key, key, `${key} is an object, or left out`))
    }
  }
  if (sb.recap && typeof sb.recap === 'object' && !Array.isArray(sb.recap)) {
    out.push(...unknownKeys(sb.recap, RECAP, 'recap'), ...required(sb.recap, ['title'], 'recap'))
    const columns = sb.recap.columns ?? ['Screen', 'Before', 'Now']
    const rows = sb.recap.rows
    if (!Array.isArray(columns) || columns.length !== 3 || !columns.every(isText)) {
      out.push(error('recap', 'recap', 'columns is three headings: the screen, before, now'))
    }
    if (!Array.isArray(rows) || rows.length === 0 || !rows.every((r) => Array.isArray(r) && r.length === 3)) {
      out.push(error('recap', 'recap', 'rows is a list of [screen, before, now] triples'))
    }
  }
  if (sb.end !== undefined) {
    out.push(...unknownKeys(sb.end, END, 'end'))
  }
  return out
}

export function withDefaults(sb, brand) {
  return {
    audience: 'internal',
    product: brand.product,
    host: brand.host,
    chips: [],
    ...sb,
    recap: sb.recap && { eyebrow: 'At a glance', columns: ['Screen', 'Before', 'Now'], ...sb.recap },
    end: { title: sb.title, ...sb.end },
  }
}

export function copyOf(sb) {
  const items = []
  const add = (text, kind, where) => {
    if (isText(text)) {
      items.push({ text, kind, where })
    }
  }
  add(sb.title, 'title', 'title')
  add(sb.eyebrow, 'eyebrow', 'eyebrow')
  add(sb.subtitle, 'body', 'subtitle')
  ;(sb.chips ?? []).forEach((chip, i) => add(chip, 'label', `chip ${i + 1}`))
  add(sb.intro, 'caption', 'intro')
  ;(sb.chapters ?? []).forEach((chapter, i) => {
    add(chapter.label, 'label', `chapter ${i + 1} label`)
    add(chapter.title, 'title', `chapter ${i + 1} title`)
    add(chapter.summary, 'body', `chapter ${i + 1} summary`)
  })
  if (sb.recap) {
    add(sb.recap.title, 'title', 'recap title')
    add(sb.recap.caption, 'caption', 'recap caption')
    ;(sb.recap.rows ?? []).forEach((row, i) =>
      (row ?? []).forEach((cell, j) => add(cell, 'body', `recap row ${i + 1}.${j + 1}`)),
    )
  }
  if (sb.end) {
    add(sb.end.title, 'title', 'end title')
    add(sb.end.link, 'link', 'end link')
    add(sb.end.note, 'body', 'end note')
  }
  return items
}
