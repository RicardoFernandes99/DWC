export const SAMPLE_RATE = 44_100
const BPM = 100
const BEAT = 60 / BPM
export const BAR = 4 * BEAT
const TAU = 2 * Math.PI

const PROGRESSION = [
  [[62, 66, 69, 73], 38],
  [[61, 64, 69, 71], 37],
  [[59, 62, 66, 69], 35],
  [[59, 62, 66, 67], 31],
]
const ARPEGGIO = [0, 2, 1, 3, 2, 1, 3, 2]

const hz = (midi) => 440 * 2 ** ((midi - 69) / 12)

function random(seed) {
  let a = seed >>> 0
  const uniform = () => {
    a = (a + 1_831_565_813) >>> 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t)
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296
  }
  const normal = () => Math.sqrt(-2 * Math.log(1 - uniform())) * Math.cos(TAU * uniform())
  return { uniform, normal }
}

// A sine added by recurrence rather than a Math.sin per sample: the pad alone is hundreds of
// millions of samples on a five-minute video.
function addSine(out, { f, phase, amp }) {
  const w = (TAU * f) / SAMPLE_RATE
  const k = 2 * Math.cos(w)
  let y1 = Math.sin(phase - w)
  let y2 = Math.sin(phase - 2 * w)
  for (let i = 0; i < out.length; i++) {
    const y = k * y1 - y2
    out[i] += amp * y
    y2 = y1
    y1 = y
  }
}

function ep(f, seconds) {
  const out = new Float64Array(Math.round(seconds * SAMPLE_RATE))
  for (let i = 0; i < out.length; i++) {
    const t = i / SAMPLE_RATE
    const mod = Math.sin(TAU * f * 2 * t) * 1.2 * Math.exp(-6 * t)
    const tone = Math.sin(TAU * f * t + mod) + 0.25 * Math.sin(TAU * f * 3 * t) * Math.exp(-9 * t)
    out[i] = tone * (1 - Math.exp(-400 * t)) * Math.exp(-2.6 * t)
  }
  return out
}

function pad(notes, seconds, rng) {
  const out = new Float64Array(Math.round(seconds * SAMPLE_RATE))
  for (const m of notes) {
    for (const detune of [-0.08, 0.08]) {
      for (const [harmonic, amp] of [
        [1, 1],
        [2, 0.35],
        [3, 0.12],
      ]) {
        addSine(out, {
          f: hz(m - 12) * (1 + detune * 0.01) * harmonic,
          phase: rng.uniform() * 6.28,
          amp: amp / notes.length,
        })
      }
    }
  }
  for (let i = 0; i < out.length; i++) {
    const t = i / SAMPLE_RATE
    out[i] *= Math.min(1, t / 0.8) * Math.max(0, Math.min(1, (seconds - t) / 1.2))
  }
  return out
}

function bass(f, seconds) {
  const out = new Float64Array(Math.round(seconds * SAMPLE_RATE))
  for (let i = 0; i < out.length; i++) {
    const t = i / SAMPLE_RATE
    out[i] = (Math.sin(TAU * f * t) + 0.15 * Math.sin(TAU * f * 2 * t)) * (1 - Math.exp(-200 * t)) * Math.exp(-1.8 * t)
  }
  return out
}

function shaker(rng) {
  const out = new Float64Array(Math.round(0.09 * SAMPLE_RATE))
  let last = 0
  for (let i = 0; i < out.length; i++) {
    const x = rng.normal()
    out[i] = (x - last) * Math.exp((-45 * i) / SAMPLE_RATE)
    last = x
  }
  return out
}

function add(out, { at, signal, gain }) {
  const start = Math.round(at * SAMPLE_RATE)
  const end = Math.min(out.length, start + signal.length)
  for (let i = start; i < end; i++) {
    out[i] += signal[i - start] * gain
  }
}

export function compose({ seconds, groove = [4 * BAR, seconds - 3 * BAR], seed = 7 }) {
  const rng = random(seed)
  const length = Math.round(seconds * SAMPLE_RATE)
  const left = new Float64Array(length)
  const right = new Float64Array(length)
  const bars = Math.ceil(seconds / BAR) + 1
  for (let b = 0; b < bars; b++) {
    const t0 = b * BAR
    const [notes, root] = PROGRESSION[b % 4]
    const voiced = pad(notes, BAR + 1.2, rng)
    add(left, { at: t0, signal: voiced, gain: 0.1 })
    add(right, { at: t0, signal: voiced, gain: 0.1 })
    ARPEGGIO.forEach((index, k) => {
      const tone = ep(hz(notes[index] + (k === 7 && b % 2 ? 12 : 0)), 1.4)
      const pan = 0.5 + 0.3 * (k % 2 ? 1 : -1)
      const gain = 0.11 * (k % 2 === 0 ? 1 : 0.8)
      add(left, { at: t0 + (k * BEAT) / 2, signal: tone, gain: gain * (1 - pan) * 2 })
      add(right, { at: t0 + (k * BEAT) / 2, signal: tone, gain: gain * pan * 2 })
    })
    if (t0 >= groove[0] && t0 + BAR <= groove[1]) {
      for (const beat of [0, 2.5]) {
        const low = bass(hz(root), 1.6)
        add(left, { at: t0 + beat * BEAT, signal: low, gain: 0.22 })
        add(right, { at: t0 + beat * BEAT, signal: low, gain: 0.22 })
      }
      for (let k = 0; k < 8; k++) {
        const gain = k % 2 ? 0.035 : 0.018
        add(left, { at: t0 + (k * BEAT) / 2 + 0.01, signal: shaker(rng), gain: gain * 0.8 })
        add(right, { at: t0 + (k * BEAT) / 2, signal: shaker(rng), gain })
      }
    }
  }
  const irLength = Math.round(2.2 * SAMPLE_RATE)
  const ir = [0, 1].map(() => {
    const channel = new Float64Array(irLength)
    let energy = 0
    for (let i = Math.round(0.02 * SAMPLE_RATE); i < irLength; i++) {
      channel[i] = rng.normal() * Math.exp((-3 * i) / SAMPLE_RATE)
      energy += channel[i] ** 2
    }
    return channel.map((v) => v / Math.sqrt(energy))
  })
  return { left, right, ir }
}

export function interleave(left, right) {
  const out = new Float32Array(left.length * 2)
  for (let i = 0; i < left.length; i++) {
    out[2 * i] = left[i]
    out[2 * i + 1] = right[i]
  }
  return Buffer.from(out.buffer)
}

export function reverbArgs({ ir, seconds, out }) {
  const raw = ['-f', 'f32le', '-ar', String(SAMPLE_RATE), '-ac', '2']
  return [
    '-y',
    ...raw,
    '-i',
    '-',
    ...raw,
    '-i',
    ir,
    '-filter_complex',
    '[0:a]asplit[dry][send];[send][1:a]afir=irnorm=-1:irgain=1[wet];' +
      '[dry][wet]amix=inputs=2:weights=1 0.35:normalize=0,' +
      `afade=t=in:d=2,afade=t=out:st=${Math.max(0, seconds - 4).toFixed(3)}:d=4[out]`,
    '-map',
    '[out]',
    '-c:a',
    'pcm_f32le',
    out,
  ]
}
