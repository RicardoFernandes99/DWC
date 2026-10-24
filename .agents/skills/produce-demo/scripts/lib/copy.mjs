import { error, STANDARD, warn } from './standard.mjs'

const AVOID = [
  'powerful',
  'seamless',
  'seamlessly',
  'effortless',
  'effortlessly',
  'simply',
  'easily',
  'robust',
  'intuitive',
  'revolutionary',
  'game-changing',
  'cutting-edge',
  'leverage',
  'unlock',
  'supercharge',
  'delightful',
  'magical',
  'blazing',
]

const INTERNAL = [
  [/§\s?\d/, 'a spec section number'],
  [/\bspecs?\b/i, 'the word "spec"'],
  [/\b[A-Z][A-Z0-9]{1,9}-\d+\b/, 'a ticket key'],
  [/\b\d+\s?px\b/i, 'a pixel size'],
  [/\bPR\s?#?\d+\b/i, 'a pull request number'],
  [/\blocalhost\b|\b127\.0\.0\.1\b/i, 'a local address'],
  [/\b(?:TODO|FIXME|TBD|WIP)\b/, 'a work-in-progress marker'],
]

const CLIENT_ONLY = [
  [/\b[\w-]+\.(?:pages\.dev|vercel\.app|netlify\.app)\b|\bgithub\.com\b/i, 'a preview or repository address'],
]

const JOINERS = /,\s+(?:and|but|while|which|so)\s|;\s|\s(?:while|whereas)\s/g

function stripTerms(text, terms) {
  let out = text
  for (const term of terms) {
    out = out.split(term).join(' ')
  }
  return out
}

export function isTitleCase(text, terms = []) {
  const words = stripTerms(text, terms)
    .split(/\s+/)
    .slice(1)
    .filter((w) => /^[A-Za-z][a-z]{3,}/.test(w))
  const capitalised = words.filter((w) => /^[A-Z][a-z]/.test(w))
  return words.length >= 2 && capitalised.length / words.length > 0.5
}

function ideaCount(text) {
  const sentences = String(text)
    .split(/(?<=[.!?])\s+(?=[A-Z])/)
    .filter((s) => s.trim())
  const joins = String(text).match(JOINERS)?.length ?? 0
  return sentences.length + joins
}

export function lintText(text, { kind, where, audience = 'internal', terms = [] }) {
  const out = []
  const value = String(text ?? '').trim()
  if (!value) {
    return out
  }
  for (const word of AVOID) {
    if (new RegExp(`\\b${word}\\b`, 'i').test(value)) {
      out.push(warn('promotional', where, `"${word}" sells instead of showing; say what happens`))
    }
  }
  for (const [pattern, what] of audience === 'client' ? [...INTERNAL, ...CLIENT_ONLY] : INTERNAL) {
    if (pattern.test(stripTerms(value, terms))) {
      out.push(error('internal-reference', where, `contains ${what}, which means nothing to the viewer`))
    }
  }
  if (kind === 'eyebrow' && value.length > STANDARD.title.maxChars) {
    out.push(
      warn('length', where, `${value.length} characters; an eyebrow fits on one line under ${STANDARD.title.maxChars}`),
    )
  }
  if (kind === 'title' || kind === 'label' || kind === 'callout') {
    const max = STANDARD[kind].maxChars
    if (value.length > max) {
      out.push(warn('length', where, `${value.length} characters; a ${kind} reads at a glance under ${max}`))
    }
    if (isTitleCase(value, terms)) {
      out.push(warn('sentence-case', where, 'reads as Title Case; headings are sentence case'))
    }
    if (/[.!]$/.test(value)) {
      out.push(warn('punctuation', where, 'a heading takes no closing punctuation'))
    }
  }
  if (kind === 'caption') {
    const { maxChars, warnChars } = STANDARD.caption
    if (value.length > maxChars) {
      out.push(error('caption-length', where, `${value.length} characters; the caption bar holds ${maxChars}`))
    } else if (value.length > warnChars) {
      out.push(warn('caption-length', where, `${value.length} characters; under ${warnChars} keeps it to one line`))
    }
    if (ideaCount(value) > 1) {
      out.push(warn('one-idea', where, 'carries more than one idea; split it or cut it to the half that matters'))
    }
  }
  return out
}

export function paceFinding(text, seconds, where) {
  const { maxCps, warnCps } = STANDARD.caption
  const cps = Math.round((String(text).length / Math.max(seconds, 0.001)) * 10) / 10
  if (cps > maxCps) {
    return error('caption-pace', where, `${cps.toFixed(1)} characters a second; hold it longer (≤ ${maxCps})`)
  }
  if (cps > warnCps) {
    return warn('caption-pace', where, `${cps.toFixed(1)} characters a second; comfortable reading is ≤ ${warnCps}`)
  }
  return undefined
}
