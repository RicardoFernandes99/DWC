#!/usr/bin/env bash
# CLI for /record-demo; each command is one message to the driver daemon (ADR 115).
set -uo pipefail

SKILL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DRIVER="$SKILL_DIR/scripts/driver.mjs"
STATE_FILE="${DEMO_STATE:-${TMPDIR:-/tmp}/record-demo-$(id -u).state}"
SOCK="${STATE_FILE%.state}.sock"

die() { echo "record-demo: $*" >&2; exit 1; }
warn() { echo "record-demo: $*" >&2; }
is_uint() { [[ "$1" =~ ^[0-9]+$ ]]; }

# In a shared /tmp another user can create the path first; refuse a file we do not own.
assert_state_owned() {
  [ ! -e "$STATE_FILE" ] || [ -O "$STATE_FILE" ] ||
    die "$STATE_FILE is not owned by this user — refusing to use it"
}

# jq is not a prerequisite.
json() {
  node -e 'const [op, ...kv] = process.argv.slice(1); const o = { op }; for (const p of kv) { const i = p.indexOf("="); const k = p.slice(0, i), v = p.slice(i + 1); if (v !== "") o[k] = ["ms", "settle", "k"].includes(k) ? Number(v) : v } console.log(JSON.stringify(o))' "$@"
}

send() {
  node "$DRIVER" send "$SOCK" "$(json "$@")"
}

# Playwright's bundled ffmpeg has neither libx264 nor the vp9_superframe filter the webm muxer needs.
resolve_ffmpeg() {
  command -v ffmpeg
}

# No pipe: under pipefail a closing grep -q would SIGPIPE ffmpeg.
has_h264() {
  local encoders
  encoders="$("$1" -hide_banner -encoders 2>/dev/null)" || return 1
  [[ "$encoders" == *libx264* ]]
}

assert_ms() {
  [ -z "$1" ] || is_uint "$1" ||
    die "$2 must be a whole number of milliseconds, got: $1"
}

# A stale PID may belong to another process now; captured, not piped, for the same SIGPIPE reason.
daemon_alive() {
  local cmdline=""
  [ -n "${PID:-}" ] && cmdline="$(ps -p "$PID" -o args= 2>/dev/null)"
  case "$cmdline" in
    *driver.mjs*) return 0 ;;
  esac
  return 1
}

stop_daemon() {
  daemon_alive && kill "$PID" 2>/dev/null
  rm -f "$SOCK" "$STATE_FILE"
}

# Close out an in-flight take rather than killing it: a bare SIGTERM flushes a partial nobody waits
# for. The flushed file is then moved out of `<name>.record-demo/`, because the new take's own
# `start` clears that directory and the two takes usually share an output name.
reclaim_previous() {
  local partial="" kept=""
  daemon_alive || { rm -f "$STATE_FILE"; return; }
  # The driver bounds its own wait, so a wedged daemon cannot hang the take replacing it.
  [ -S "$SOCK" ] && partial="$(node "$DRIVER" send "$SOCK" '{"op":"abort"}' 20000 2>/dev/null)"
  # No reply means nothing has told it to stop yet, so signal before waiting.
  if [ -z "$partial" ] && daemon_alive; then
    kill "$PID" 2>/dev/null
  fi
  local i=0
  while daemon_alive && [ $i -lt 100 ]; do sleep 0.1; i=$((i + 1)); done
  stop_daemon
  if [ -n "$partial" ] && [ -s "$partial" ]; then
    kept="${partial%.record-demo/partial.webm}.reclaimed-$(date +%Y%m%d-%H%M%S).webm"
    [ ! -e "$kept" ] && mv "$partial" "$kept" 2>/dev/null || kept=""
  fi
  warn "stopped a take that was still recording${kept:+ — its partial is $kept}"
}

# A `start` the daemon rejected makes it exit on its own; one that never reached it leaves it
# listening, so the wait is bounded.
reap_failed_start() {
  local i=0
  while kill -0 "$PID" 2>/dev/null && [ $i -lt 100 ]; do sleep 0.1; i=$((i + 1)); done
  kill "$PID" 2>/dev/null
  wait "$PID" 2>/dev/null
  rm -f "$SOCK"
}

cmd_start() {
  local out="${1:?usage: start <output.webm> [url] [ready-selector]}" url="${2:-}" ready="${3:-}"
  # `finish` strips this suffix; without it `--mp4` produces `name.mp4.mp4`.
  [[ "$out" == *.webm ]] || die "output must end in .webm (got $out)"
  assert_state_owned
  command -v node >/dev/null 2>&1 || die "node not found"

  if [ -f "$STATE_FILE" ]; then
    # shellcheck disable=SC1090
    . "$STATE_FILE"
    reclaim_previous
    unset PID
  fi

  local dir
  mkdir -p "$(dirname "$out")" || die "cannot create output directory for $out"
  dir="$(cd "$(dirname "$out")" && pwd)" || die "cannot resolve output directory for $out"
  # Daemon and finish run in other shells; only an absolute path names the same file.
  out="$dir/$(basename "$out")"

  # Any take of ours was reclaimed above, so a socket left at the path is stale, and the wait below
  # would take it for the new daemon's and send `start` before anything listens.
  if [ -S "$SOCK" ] && node "$DRIVER" alive "$SOCK"; then
    die "another take's daemon is still answering on $SOCK, so this one would strand it; finish or abort that take, or give this one its own DEMO_STATE"
  fi
  rm -f "$SOCK"
  node "$DRIVER" serve "$SOCK" &
  PID=$!
  local i=0
  until [ -S "$SOCK" ]; do
    kill -0 "$PID" 2>/dev/null || die "driver exited before it was ready"
    [ $i -ge 100 ] && { stop_daemon; die "driver did not come up within 10s"; }
    sleep 0.1; i=$((i + 1))
  done

  local msg
  msg="$(send start "out=$out" "url=$url" "ready=$ready")" || { reap_failed_start; exit 1; }
  local dir="${out%.webm}.record-demo"
  [ "${DEMO_PREVIEW:-0}" = "1" ] && dir="$dir/preview"
  printf 'OUT=%q\nPID=%q\nDIR=%q\n' "$out" "$PID" "$dir" > "$STATE_FILE.tmp" && mv -f "$STATE_FILE.tmp" "$STATE_FILE" ||
    { stop_daemon; die "cannot write state to $STATE_FILE"; }
  echo "$msg"
}

await_daemon() {
  local i=0
  while [ -n "${PID:-}" ] && kill -0 "$PID" 2>/dev/null && [ $i -lt 50 ]; do sleep 0.1; i=$((i + 1)); done
  rm -f "$SOCK" "$STATE_FILE"
}

# Trap target: never fails.
cmd_abort() {
  [ -f "$STATE_FILE" ] || return 0
  [ -O "$STATE_FILE" ] || { warn "$STATE_FILE is not owned by this user — nothing to abort"; return 0; }
  # shellcheck disable=SC1090
  . "$STATE_FILE"
  send abort >/dev/null 2>&1 || true
  stop_daemon
  [ -n "${OUT:-}" ] || return 0
  local dir="${DIR:-${OUT%.webm}.record-demo}"
  local partial="$dir/partial.webm" failure="$dir/failure.png"
  [ -s "$partial" ] && warn "partial recording saved to $partial"
  [ -s "$failure" ] && warn "failure still saved to $failure"
  return 0
}

cmd_finish() {
  [ -f "$STATE_FILE" ] || die "no recording in progress"
  assert_state_owned
  # shellcheck disable=SC1090
  . "$STATE_FILE"
  local raw
  raw="$(send finish)" || { stop_daemon; die "finish failed — ${OUT:-the recording} may be incomplete"; }
  await_daemon
  local dir="${DIR:-${OUT%.webm}.record-demo}"
  [ -n "${OUT:-}" ] && [ -f "$dir/embed.md" ] &&
    warn "embed snippet: $dir/embed.md (links to the local recording)"
  if [ "${DEMO_PREVIEW:-0}" = "1" ]; then
    echo "$raw"; return 0
  fi
  [ -s "$raw" ] || die "no video written to $raw"

  local ff
  ff="$(resolve_ffmpeg)" || {
    warn "no ffmpeg found — the WebM has no duration header and cannot be scrubbed until remuxed."
    echo "$raw"; return 0
  }

  if [ "${1:-}" = "--mp4" ]; then
    if has_h264 "$ff"; then
      local mp4="${raw%.webm}.mp4"
      # getDisplayMedia frames are variable-rate; without CFR QuickTime, Safari and Chrome stop ~2s in.
      # libx264 defaults to limited range, which lifts blacks and washes near-white borders.
      "$ff" -loglevel error -y -fflags +genpts -i "$raw" \
        -vf "fps=${DEMO_FPS:-30},scale=out_range=pc" \
        -c:v libx264 -preset slow -crf "${DEMO_CRF:-18}" -pix_fmt yuv420p \
        -color_range pc -movflags +faststart "$mp4" || die "mp4 transcode failed"
      echo "$mp4"
      return 0
    fi
    warn "$ff has no libx264 — keeping WebM. Install a full ffmpeg for MP4."
  fi

  # MediaRecorder writes no duration or cues; a stream copy rewrites the headers.
  local fixed="${raw%.webm}.remux.webm"
  if "$ff" -loglevel error -y -i "$raw" -c copy "$fixed" && [ -s "$fixed" ]; then
    mv "$fixed" "$raw"
  else
    rm -f "$fixed"
    warn "could not remux $raw — players may not show its duration."
  fi
  echo "$raw"
}

case "${1:-}" in
  start)     shift; cmd_start "$@" ;;
  goto)      shift; send goto "url=${1:?usage: goto <url> [ready-selector]}" "ready=${2:-}" ;;
  move)      shift; assert_ms "${2:-}" "move duration"; send move "selector=${1:?usage: move <selector>}" "ms=${2:-}" ;;
  click)     shift; assert_ms "${2:-}" "click settle"; send click "selector=${1:?usage: click <selector>}" "settle=${2:-}" ;;
  drag)      shift; assert_ms "${3:-}" "drag settle"; send drag "selector=${1:?usage: drag <from-selector> <to-selector|@dx,dy>}" "to=${2:?usage: drag <from-selector> <to-selector|@dx,dy>}" "settle=${3:-}" ;;
  type)      shift; assert_ms "${3:-}" "type settle"; send type "selector=${1:?usage: type <selector> <text>}" "text=${2:?usage: type <selector> <text>}" "settle=${3:-}" ;;
  highlight) shift; assert_ms "${2:-}" "highlight duration"; send highlight "selector=${1:?usage: highlight <selector> [ms]}" "ms=${2:-}" ;;
  press)     shift; assert_ms "${2:-}" "press settle"; send press "key=${1:?usage: press <key>}" "settle=${2:-}" ;;
  caption)   shift; assert_ms "${2:-}" "caption duration"; send caption "text=${1:?usage: caption <text> [ms]}" "ms=${2:-}" ;;
  callout)   shift; assert_ms "${3:-}" "callout duration"; send callout "selector=${1:?usage: callout <selector> <text> [ms]}" "text=${2:?usage: callout <selector> <text> [ms]}" "ms=${3:-}" ;;
  tweak)     shift; send tweak "field=${1:?usage: tweak <field-label> <option-label|true|false>}" "value=${2:?usage: tweak <field-label> <option-label|true|false>}" ;;
  pause)     shift; is_uint "${1:-}" || die "pause takes whole milliseconds"; send pause "ms=$1" ;;
  zoom)      shift; [ -z "${2:-}" ] || [[ "$2" =~ ^[0-9]+(\.[0-9]+)?$ ]] || die "zoom factor must be a number, got: $2"; send zoom "selector=${1:-}" "k=${2:-}" ;;
  unzoom)    send unzoom ;;
  cut)       send cut ;;
  resume)    send resume ;;
  eval)      shift; send eval "code=${1:?usage: eval <js>}" ;;
  finish)    shift; cmd_finish "$@" ;;
  abort)     cmd_abort ;;
  *) die "usage: record-demo.sh <start|goto|move|click|drag|type|press|highlight|caption|callout|tweak|zoom|unzoom|pause|cut|resume|eval|finish|abort> [args]" ;;
esac
