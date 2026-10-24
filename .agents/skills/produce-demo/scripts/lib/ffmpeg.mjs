import { spawn } from 'node:child_process'

import { STANDARD } from './standard.mjs'
import { LAYOUT } from './templates.mjs'

const BT709 = ['-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv']
// The -color_* output options are lost on a -filter_complex encode, so the frames carry the tags.
const TAG_BT709 = 'setparams=color_primaries=bt709:color_trc=bt709:colorspace=bt709:range=tv'
const TO_YUV = `scale=out_color_matrix=bt709:out_range=tv,format=yuv420p,${TAG_BT709}`
export const FADE = 0.25

export function run(bin, args, { input } = {}) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(bin, args, { stdio: [input ? 'pipe' : 'ignore', 'pipe', 'pipe'] })
    let out = ''
    let err = ''
    child.stdout.on('data', (d) => {
      out += d
    })
    child.stderr.on('data', (d) => {
      err = (err + d).slice(-20_000)
    })
    child.on('error', reject)
    child.on('close', (code) =>
      code === 0
        ? resolvePromise({ out, err })
        : reject(new Error(`${bin} exited ${code}\n${err.split('\n').slice(-25).join('\n')}`)),
    )
    if (input) {
      input(child.stdin).then(
        () => child.stdin.end(),
        (error) => {
          child.kill()
          reject(error)
        },
      )
    }
  })
}

export async function probe(file) {
  const { out } = await run('ffprobe', ['-v', 'error', '-show_streams', '-show_format', '-of', 'json', file])
  return JSON.parse(out)
}

export function duration(info) {
  const video = info.streams.find((s) => s.codec_type === 'video')
  return Number(info.format?.duration ?? video?.duration)
}

const encode = (draft) => [
  '-c:v',
  'libx264',
  '-preset',
  'veryfast',
  '-crf',
  draft ? '18' : '12',
  '-pix_fmt',
  'yuv420p',
  ...BT709,
]

const loop = (file, fps, seconds) => ['-loop', '1', '-framerate', String(fps), '-t', seconds.toFixed(3), '-i', file]

const progressX = (start, total) => `x='-w+w*min(1\\,(t+${start.toFixed(3)})/${total.toFixed(3)})':y=H-h`

export function cardArgs({ seconds, fps, progress, start, total, out, draft, animated }) {
  return [
    '-y',
    '-f',
    'image2pipe',
    '-c:v',
    'png',
    '-framerate',
    String(fps),
    '-i',
    '-',
    ...loop(progress, fps, seconds),
    '-filter_complex',
    `[0:v]format=gbrp,tpad=stop_mode=clone:stop_duration=${Math.max(0, seconds - animated).toFixed(3)}[c];` +
      `[c][1:v]overlay=${progressX(start, total)}:format=gbrp,${TO_YUV}[out]`,
    '-map',
    '[out]',
    '-t',
    seconds.toFixed(3),
    '-r',
    String(fps),
    ...encode(draft),
    out,
  ]
}

export function sceneArgs({ cuts, seconds, fps, scale, canvas, frame, progress, layers, start, total, out, draft }) {
  const { x, y, width, height } = LAYOUT.content
  const size = `${STANDARD.stage.width * scale}x${STANDARD.stage.height * scale}`
  const args = [
    '-y',
    '-f',
    'lavfi',
    '-i',
    `color=c=0x${canvas.slice(1)}:s=${size}:r=${fps}:d=${seconds.toFixed(3)}`,
    ...cuts.flatMap((c) => ['-i', c.path]),
    ...loop(frame, fps, seconds),
    ...loop(progress, fps, seconds),
  ]
  const frameInput = 1 + cuts.length
  const graph = [
    '[0:v]format=gbrp[base]',
    ...cuts.map(
      (c, i) =>
        `[${1 + i}:v]fps=${fps},tpad=stop_mode=clone:stop=${fps},trim=end_frame=${c.frames},setpts=PTS-STARTPTS,` +
        `scale=${width * scale}:${height * scale}:flags=lanczos:in_color_matrix=${c.matrix},format=gbrp[t${i}]`,
    ),
    `${cuts.map((_, i) => `[t${i}]`).join('')}concat=n=${cuts.length}:v=1:a=0[take]`,
    `[base][take]overlay=x=${x * scale}:y=${y * scale}:eof_action=repeat:format=gbrp[v0]`,
    `[v0][${frameInput}:v]overlay=0:0:format=gbrp[v1]`,
  ]
  let last = 'v1'
  layers.forEach((l, i) => {
    const input = frameInput + 2 + i
    args.push(...loop(l.file, fps, seconds))
    const from = Math.max(0, l.from)
    const until = Math.min(seconds, l.until)
    if (l.fade) {
      graph.push(
        `[${input}:v]format=rgba,fade=t=in:st=${from.toFixed(3)}:d=${FADE}:alpha=1,` +
          `fade=t=out:st=${Math.max(from, until - FADE).toFixed(3)}:d=${FADE}:alpha=1[l${i}]`,
        `[${last}][l${i}]overlay=x=${l.x}:y=${l.y}:format=gbrp[v${i + 2}]`,
      )
    } else {
      graph.push(
        `[${last}][${input}:v]overlay=x=${l.x}:y=${l.y}:enable='between(t\\,${from.toFixed(3)}\\,${until.toFixed(3)})':format=gbrp[v${i + 2}]`,
      )
    }
    last = `v${i + 2}`
  })
  graph.push(`[${last}][${frameInput + 1}:v]overlay=${progressX(start, total)}:format=gbrp,${TO_YUV}[out]`)
  return [
    ...args,
    '-filter_complex',
    graph.join(';'),
    '-map',
    '[out]',
    '-t',
    seconds.toFixed(3),
    '-r',
    String(fps),
    ...encode(draft),
    out,
  ]
}

const musicFades = (total) => `afade=t=in:d=1.5,afade=t=out:st=${Math.max(0, total - 3).toFixed(3)}:d=3`

const TRIM_SILENCE = 'silenceremove=start_periods=1:start_threshold=-50dB'

export function musicBed({ music, seconds, total, first, generated = false }) {
  if (generated) {
    return { inputs: ['-i', music], graph: [`[${first}:a]atrim=0:${total.toFixed(3)},asetpts=PTS-STARTPTS[bed]`] }
  }
  const fade = Math.min(2, seconds / 4)
  const copies = seconds >= total ? 1 : Math.ceil(total / (seconds - fade)) + 1
  const inputs = Array.from({ length: copies }, () => ['-i', music]).flat()
  const graph = Array.from(
    { length: copies },
    (_, k) => `[${first + k}:a]${TRIM_SILENCE},areverse,${TRIM_SILENCE},areverse[m${k}]`,
  )
  let last = 'm0'
  for (let k = 1; k < copies; k++) {
    graph.push(`[${last}][m${k}]acrossfade=d=${fade.toFixed(3)}:c1=tri:c2=tri[c${k}]`)
    last = `c${k}`
  }
  graph.push(`[${last}]atrim=0:${total.toFixed(3)},asetpts=PTS-STARTPTS,${musicFades(total)}[bed]`)
  return { inputs, graph }
}

export function loudnessArgs({ music, seconds, total, generated }) {
  const bed = musicBed({ music, seconds, total, first: 0, generated })
  const L = STANDARD.loudness
  return [
    '-hide_banner',
    ...bed.inputs,
    '-filter_complex',
    [...bed.graph, `[bed]loudnorm=I=${L.target}:TP=${L.truePeak}:LRA=7:print_format=json[out]`].join(';'),
    '-map',
    '[out]',
    '-f',
    'null',
    '-',
  ]
}

export function parseLoudnorm(stderr) {
  const json = stderr.slice(stderr.lastIndexOf('{'), stderr.lastIndexOf('}') + 1)
  const m = JSON.parse(json)
  return { I: m.input_i, TP: m.input_tp, LRA: m.input_lra, thresh: m.input_thresh, offset: m.target_offset }
}

export function assembleArgs({ segments, timeline, music, measured, out, draft, metadata }) {
  const { transition, total } = timeline
  const args = ['-y', ...segments.flatMap((file) => ['-i', file])]
  const graph = segments.map((_, i) => `[${i}:v]settb=AVTB,setpts=PTS-STARTPTS[s${i}]`)
  let last = 's0'
  for (let i = 1; i < segments.length; i++) {
    graph.push(
      `[${last}][s${i}]xfade=transition=fade:duration=${transition}:offset=${timeline.segments[i].start.toFixed(3)}[x${i}]`,
    )
    last = `x${i}`
  }
  graph.push(`[${last}]format=yuv420p,${TAG_BT709}[vout]`)
  const maps = ['-map', '[vout]']
  if (music) {
    const bed = musicBed({ ...music, total, first: segments.length })
    args.push(...bed.inputs)
    graph.push(...bed.graph)
    const L = STANDARD.loudness
    graph.push(
      `[bed]loudnorm=I=${L.target}:TP=${L.truePeak}:LRA=7:measured_I=${measured.I}:measured_TP=${measured.TP}:` +
        `measured_LRA=${measured.LRA}:measured_thresh=${measured.thresh}:offset=${measured.offset}:linear=true,` +
        'aresample=48000[aout]',
    )
    maps.push('-map', '[aout]', '-c:a', 'aac', '-b:a', '192k')
  } else {
    maps.push('-an')
  }
  return [
    ...args,
    '-filter_complex',
    graph.join(';'),
    ...maps,
    '-t',
    total.toFixed(3),
    '-c:v',
    'libx264',
    '-preset',
    draft ? 'veryfast' : 'medium',
    '-crf',
    draft ? '22' : '18',
    '-profile:v',
    'high',
    '-pix_fmt',
    'yuv420p',
    ...BT709,
    '-movflags',
    '+faststart',
    ...Object.entries(metadata).flatMap(([k, v]) => ['-metadata', `${k}=${v}`]),
    out,
  ]
}
