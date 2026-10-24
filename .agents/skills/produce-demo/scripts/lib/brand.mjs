import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const DEFAULT = {
  name: 'Product',
  product: '',
  org: '',
  logo: '',
  fonts: { sans: { google: 'Geist' }, mono: { google: 'Geist Mono' } },
  colors: {
    ink: '#0a0a0a',
    muted: '#686868',
    accent: '#171717',
    accentSoft: '#be3200',
    accentFaint: '#d4d4d4',
    line: '#c8c8c8',
    canvas: '#fbfbfb',
    glow: '#fed8ce',
    caption: '#171717',
    end: ['#262626', '#0a0a0a'],
    endGlow: '#8e321a',
  },
  studio: {
    foreground: '#262626',
    muted: '#737373',
    surface: '#fafafa',
    subtle: '#f5f5f5',
    border: '#e5e5e5',
    borderStrong: '#d4d4d4',
    primary: '#171717',
    primaryHover: '#404040',
    secondary: '#262626',
  },
  terms: [],
  music: { generate: true },
}

const HEX = /^#[\da-f]{6}$/i

export function validateBrand(brand, root) {
  const errors = []
  for (const group of ['colors', 'studio']) {
    for (const [key, value] of Object.entries(brand[group])) {
      const values = Array.isArray(value) ? value : [value]
      if (!values.every((v) => HEX.test(v))) {
        errors.push(`${group}.${key} must be a #rrggbb hex value (got ${JSON.stringify(value)})`)
      }
    }
  }
  if (!Array.isArray(brand.colors.end) || brand.colors.end.length !== 2) {
    errors.push("colors.end is the end card's gradient: two #rrggbb values")
  }
  for (const key of ['sans', 'mono']) {
    const font = brand.fonts[key]
    if (font && typeof font !== 'string' && !String(font.google ?? '').trim()) {
      errors.push(`fonts.${key} is a font file, or { google: 'Family' } for a Google Fonts family`)
    }
  }
  const files = {
    logo: brand.logo,
    favicon: brand.favicon,
    'fonts.sans': typeof brand.fonts.sans === 'string' ? brand.fonts.sans : '',
    'fonts.mono': typeof brand.fonts.mono === 'string' ? brand.fonts.mono : '',
    'music.file': brand.music?.file,
  }
  for (const [key, file] of Object.entries(files)) {
    if (file && !existsSync(resolve(root, file))) {
      errors.push(`${key} names ${file}, which does not exist`)
    }
  }
  if (brand.music?.generate && brand.music.file) {
    errors.push('music is either generated or a file, not both')
  } else if (brand.music && !brand.music.generate && !String(brand.music.licence ?? '').trim()) {
    errors.push('music needs a licence: say where the track comes from and that it may be used')
  }
  return errors
}

export function mergeBrand(project = {}) {
  return {
    ...DEFAULT,
    ...project,
    fonts: { ...DEFAULT.fonts, ...project.fonts },
    colors: { ...DEFAULT.colors, ...project.colors },
    studio: { ...DEFAULT.studio, ...project.studio },
    terms: project.terms ?? [],
  }
}

const FONT_TYPES = { woff2: 'font/woff2', woff: 'font/woff', ttf: 'font/ttf', otf: 'font/otf' }
const ICON_TYPES = { svg: 'image/svg+xml', png: 'image/png', ico: 'image/x-icon' }

function fontUrl(file) {
  const type = FONT_TYPES[file.split('.').at(-1).toLowerCase()] ?? 'font/woff2'
  return `data:${type};base64,${readFileSync(file).toString('base64')}`
}

function fontFace(font, fallback, root) {
  if (typeof font === 'string') {
    return { family: fallback, src: fontUrl(resolve(root, font)) }
  }
  return { family: font?.google ?? '', src: '' }
}

export function googleFontsUrl(brand) {
  const families = [brand.fonts.sans, brand.fonts.mono]
    .map((font) => font?.google)
    .filter(Boolean)
    .map((family) => `family=${family.trim().replaceAll(' ', '+')}:wght@100..900`)
  return families.length > 0 ? `https://fonts.googleapis.com/css2?${families.join('&')}&display=block` : ''
}

export function brandAssets(brand, root) {
  return {
    logo: brand.logo ? readFileSync(resolve(root, brand.logo), 'utf8').replace(/<\?xml[^>]*>\s*/, '') : '',
    favicon: brand.favicon
      ? `data:${ICON_TYPES[brand.favicon.split('.').at(-1).toLowerCase()] ?? 'image/png'};base64,${readFileSync(resolve(root, brand.favicon)).toString('base64')}`
      : '',
    sans: fontFace(brand.fonts.sans, 'Brand Sans', root),
    mono: fontFace(brand.fonts.mono, 'Brand Mono', root),
    fontsUrl: googleFontsUrl(brand),
  }
}
