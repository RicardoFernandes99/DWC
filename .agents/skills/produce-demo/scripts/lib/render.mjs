import { createRequire } from 'node:module'
import { resolve } from 'node:path'

import { STANDARD } from './standard.mjs'
import { ANIMATION_SECONDS } from './templates.mjs'

export function findPlaywright(dirs) {
  for (const dir of dirs.filter(Boolean)) {
    try {
      return { dir, mod: createRequire(resolve(dir, 'package.json'))('playwright') }
    } catch (error) {
      if (error.code !== 'MODULE_NOT_FOUND') {
        throw error
      }
    }
  }
  return {}
}

export async function openRenderer(chromium, scale) {
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage({
    viewport: { width: STANDARD.stage.width, height: STANDARD.stage.height },
    deviceScaleFactor: scale,
  })
  const pages = new Map()
  const pageAt = async (viewport, deviceScaleFactor) => {
    const key = `${viewport.width}x${viewport.height}@${deviceScaleFactor}`
    if (!pages.has(key)) {
      pages.set(key, await browser.newPage({ viewport, deviceScaleFactor }))
    }
    return pages.get(key)
  }
  return { page, pageAt, close: () => browser.close() }
}

async function load(page, markup) {
  await page.setContent(markup, { waitUntil: 'load' })
  await page.evaluate(() => document.fonts.ready)
}

export async function still(page, markup, { transparent = false } = {}) {
  await load(page, markup)
  await page.evaluate(() => {
    for (const a of document.getAnimations()) {
      a.finish()
    }
  })
  return page.screenshot({ type: 'png', omitBackground: transparent })
}

export async function bottomOf(page, markup, selector) {
  await load(page, markup)
  return page.evaluate((sel) => {
    for (const a of document.getAnimations()) {
      a.finish()
    }
    return document.querySelector(sel).getBoundingClientRect().bottom
  }, selector)
}

export async function layer(page, markup, { scale, pad = 40 }) {
  await load(page, markup)
  await page.evaluate(() => window.place?.())
  const box = await page.evaluate((p) => {
    const r = document.getElementById('layer').getBoundingClientRect()
    const style = getComputedStyle(document.getElementById('layer'))
    const lines = Math.round(
      (r.height - Number.parseFloat(style.paddingTop) - Number.parseFloat(style.paddingBottom)) /
        Number.parseFloat(style.lineHeight),
    )
    return {
      x: Math.max(0, Math.floor(r.left - p)),
      y: Math.max(0, Math.floor(r.top - p)),
      right: Math.min(innerWidth, Math.ceil(r.right + p)),
      bottom: Math.min(innerHeight, Math.ceil(r.bottom + p)),
      lines,
    }
  }, pad)
  const clip = { x: box.x, y: box.y, width: box.right - box.x, height: box.bottom - box.y }
  const png = await page.screenshot({ type: 'png', omitBackground: true, clip })
  return { png, x: box.x * scale, y: box.y * scale, lines: Number.isFinite(box.lines) ? box.lines : 1 }
}

export async function* frames(page, markup, { fps, seconds = ANIMATION_SECONDS }) {
  await load(page, markup)
  await page.evaluate(() => {
    for (const a of document.getAnimations()) {
      a.pause()
    }
  })
  const count = Math.round(seconds * fps)
  for (let i = 0; i < count; i++) {
    await page.evaluate(
      (t) => {
        for (const a of document.getAnimations()) {
          a.currentTime = t
        }
      },
      (i * 1000) / fps,
    )
    yield await page.screenshot({ type: 'png' })
  }
}
