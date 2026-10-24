import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import { html, raw } from './index.mjs'

describe('html tagged template', () => {
  it('escapes interpolated text by default, including quotes', () => {
    assert.equal(
      html`<p>${`<img src="x" onerror='y'> & more`}</p>`.toString(),
      '<p>&lt;img src=&quot;x&quot; onerror=&#39;y&#39;&gt; &amp; more</p>',
    )
  })

  it('escapes a value interpolated into an attribute', () => {
    assert.equal(
      html`<a href="${'a" onmouseover="alert(1)'}">x</a>`.toString(),
      '<a href="a&quot; onmouseover=&quot;alert(1)">x</a>',
    )
  })

  it('interpolates a raw() value verbatim', () => {
    assert.equal(
      html`<figure>${raw('<svg><path d="M0 0"/></svg>')}</figure>`.toString(),
      '<figure><svg><path d="M0 0"/></svg></figure>',
    )
  })

  it('does not double-escape a nested html result', () => {
    const inner = html`<b>${'a & b'}</b>`
    assert.equal(html`<p>${inner}</p>`.toString(), '<p><b>a &amp; b</b></p>')
  })

  it('flattens an array, resolving each element (escaped text, raw, nested, 0; drops null/false)', () => {
    const parts = ['a & b', raw('<i>c</i>'), html`<u>${'d'}</u>`, 0, null, false]
    assert.equal(html`${parts}`.toString(), 'a &amp; b<i>c</i><u>d</u>0')
  })

  it('renders null, undefined, false, and true as nothing', () => {
    assert.equal(html`<p>${null}${undefined}${false}${true}</p>`.toString(), '<p></p>')
  })

  it('preserves a numeric 0 (it is NOT dropped like booleans)', () => {
    assert.equal(html`<span>${0}</span>`.toString(), '<span>0</span>')
  })

  it('renders other numbers as their string form', () => {
    assert.equal(html`<span>${42}</span>`.toString(), '<span>42</span>')
  })
})

describe('raw', () => {
  it('coerces a non-string value to a string, kept verbatim', () => {
    assert.equal(html`<x>${raw(0)}</x>`.toString(), '<x>0</x>')
  })
})
