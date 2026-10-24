#!/usr/bin/env bash
# Checks what a take depends on before one is filmed, since each of these otherwise fails late: a
# missing libx264 at `finish`, an oversized viewport at `start`. Every check reports the conclusion
# a take will reach rather than the inputs it read, and every miss prints the command that fixes it.
set -uo pipefail

SKILL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DRIVER="$SKILL_DIR/scripts/driver.mjs"
FATAL=0

is_uint() { [[ "${1:-}" =~ ^[0-9]+$ ]]; }

ok() { printf '  ok    %s\n' "$1"; }
warn() {
  printf '  warn  %s\n' "$1"
  printf '        fix: %s\n' "$2"
}
fail() {
  printf '  fail  %s\n' "$1"
  printf '        fix: %s\n' "$2"
  FATAL=1
}

if ! command -v node >/dev/null 2>&1; then
  fail "node not found" "install Node >= 18"
  printf '\n  nothing else can be checked without node.\n'
  exit 1
fi

NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]' 2>/dev/null || echo 0)"
if [ "$NODE_MAJOR" -ge 18 ]; then
  ok "node $(node --version)"
else
  fail "node $(node --version) is older than 18" "install Node >= 18"
fi

# One probe, so doctor and driver cannot disagree about which Playwright a take would use. Only the
# sentinel line is read: importing the project file runs the project's code, and a print in it is
# ordinary rather than a fault.
PROBE_RAW="$(node "$DRIVER" probe 2>&1)"
PROBE="$(printf '%s\n' "$PROBE_RAW" | sed -n 's/^__record_demo_probe__//p' | tail -n1)"
probe() { printf '%s' "$PROBE" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const r=JSON.parse(s||"{}");const v=process.argv[1].split(".").reduce((o,k)=>o?.[k],r);console.log(v===undefined?"":Array.isArray(v)?v.join(", "):v)})' "$1" 2>/dev/null; }

if [ -z "$PROBE" ]; then
  fail "the driver could not describe the project" "$(printf '%s' "$PROBE_RAW" | head -n3)"
else
  PW="$(probe playwright)"
  PW_ERR="$(probe playwrightError)"
  if [ -n "$PW" ]; then
    ok "playwright resolves from $PW"
  elif [ -n "$PW_ERR" ]; then
    fail "playwright is installed but will not load: $PW_ERR" "reinstall playwright where the driver looks: $(probe searched)"
  else
    fail "playwright is not installed in $(probe searched)" \
      "add playwright to the project, or name the package that has it in .agents/record-demo.mjs"
  fi

  CHROMIUM="$(probe chromium)"
  if [ "$(probe chromiumInstalled)" = "true" ]; then
    ok "playwright chromium installed ($CHROMIUM)"
  elif [ -n "$PW" ]; then
    fail "playwright chromium is not downloaded${CHROMIUM:+ ($CHROMIUM)}" \
      "cd $PW && npx playwright install chromium"
  fi

  PROJECT_ERR="$(probe projectError)"
  if [ -n "$PROJECT_ERR" ]; then
    fail "the project file will not load: $PROJECT_ERR" "fix $(probe projectFile)"
  elif [ "$(probe hasProject)" = "true" ]; then
    if [ "$(probe login)" = "true" ]; then
      ok "project file $(probe projectFile) (signs in with its login hook)"
    else
      ok "project file $(probe projectFile) (no login hook; takes run unauthenticated)"
    fi
  elif [ "$(probe explicit)" = "true" ]; then
    # A typo'd DEMO_PROJECT is exactly the miss this script exists to catch; `start` dies on it.
    fail "DEMO_PROJECT points at a file that does not exist: $(probe projectFile)" \
      "correct DEMO_PROJECT, or unset it to use the repository's own .agents/record-demo.mjs"
  else
    ok "no project file; takes run unauthenticated (add .agents/record-demo.mjs to sign in)"
  fi
fi

# Only an ffmpeg on PATH counts; Playwright's bundled one can do neither job. Captured, not piped:
# under pipefail a closing `grep -q` would SIGPIPE it.
if command -v ffmpeg >/dev/null 2>&1; then
  ENCODERS="$(ffmpeg -hide_banner -encoders 2>/dev/null)"
  if [[ "$ENCODERS" == *libx264* ]]; then
    ok "ffmpeg $(ffmpeg -version 2>/dev/null | head -n1 | awk '{print $3}') with libx264 — webm gets a duration header, and \`finish --mp4\` works"
  else
    warn "ffmpeg has no libx264, so \`finish --mp4\` will refuse (the webm is still written, with a duration header)" \
      "install an ffmpeg built with libx264: brew install ffmpeg (macOS), apt install ffmpeg (Debian/Ubuntu)"
  fi
else
  warn "no ffmpeg on PATH: the webm will have no duration header and cannot be scrubbed, and \`finish --mp4\` will refuse" \
    "brew install ffmpeg (macOS), or apt install ffmpeg (Debian/Ubuntu)"
fi

VIEWPORT="${DEMO_VIEWPORT:-1440 900 2}"
read -r VW VH VSCALE _ <<<"$VIEWPORT"
VSCALE="${VSCALE:-2}"
if ! is_uint "${VW:-}" || ! is_uint "${VH:-}" || { [ "$VSCALE" != "1" ] && [ "$VSCALE" != "2" ]; }; then
  # The driver refuses the same shapes at `start`; catching them here is the whole point.
  fail "DEMO_VIEWPORT is \"$VIEWPORT\", not \"width height [scale]\" with scale 1 or 2" \
    "e.g. DEMO_VIEWPORT=\"1440 900 2\", or unset it for that default"
else
  # The window needs the viewport plus browser chrome plus Chrome's ~52px tab-sharing infobar.
  NEED_H=$((VH + 140))
  SIZE="${VW}x${VH} at ${VSCALE}x → $((VW * VSCALE))x$((VH * VSCALE)) video"
  if [ "$(uname -s)" = "Linux" ] && [ -z "${DISPLAY:-}" ] && [ -z "${WAYLAND_DISPLAY:-}" ]; then
    if command -v xvfb-run >/dev/null 2>&1; then
      warn "no display; tab capture needs a headed window ($SIZE, needs ${VW}x${NEED_H} of screen)" \
        "wrap the demo script: xvfb-run -s \"-screen 0 1920x1200x24\" ./my-demo.sh"
    else
      fail "no display, and no xvfb-run to make one; tab capture needs a headed window" \
        "apt install xvfb, then run the demo under xvfb-run -s \"-screen 0 1920x1200x24\""
    fi
  else
    # Measured where a display can be asked; elsewhere the requirement is stated, not verified.
    SCREEN=""
    command -v xdpyinfo >/dev/null 2>&1 &&
      SCREEN="$(xdpyinfo 2>/dev/null | awk '/dimensions:/ {print $2; exit}')"
    [ -z "$SCREEN" ] && command -v xrandr >/dev/null 2>&1 &&
      SCREEN="$(xrandr 2>/dev/null | awk '/current/ {print $8 "x" substr($10, 1, length($10) - 1); exit}')"
    is_uint "${SCREEN%x*}" && is_uint "${SCREEN#*x}" || SCREEN=""
    if [ -n "$SCREEN" ]; then
      SW="${SCREEN%x*}"; SH="${SCREEN#*x}"
      if [ "$SW" -ge "$VW" ] && [ "$SH" -ge "$NEED_H" ]; then
        ok "a ${SIZE} window fits the ${SCREEN} screen"
      else
        fail "the ${SCREEN} screen is too small for $SIZE, which needs ${VW}x${NEED_H}" \
          "lower DEMO_VIEWPORT, or use a larger display: xvfb-run -s \"-screen 0 1920x1200x24\""
      fi
    else
      ok "a headed window can open ($SIZE); unverified here, but it needs ${VW}x${NEED_H} of screen"
    fi
  fi
fi

URL="${DEMO_WEB_URL:-http://localhost:5173}"
HOST="${URL#http://}"
HOST="${HOST%%[/?#]*}"
SECURE=""
case "$URL" in
  https://*) SECURE="target $URL is a secure context" ;;
  # Quoted: unquoted, `[::1]` is a character class matching one `:` or `1`, so it would pass
  # http://192.168.1.9 as localhost.
  'http://[::1]' | 'http://[::1]':* | 'http://[::1]'/*) SECURE="target $URL is a secure context (localhost)" ;;
  http://*)
    case "${HOST%:*}" in
      localhost | *.localhost | 127.0.0.1) SECURE="target $URL is a secure context (localhost)" ;;
    esac
    ;;
esac
if [ -n "$SECURE" ]; then
  ok "$SECURE"
else
  fail "target $URL is not a secure context, so the recorder page has no mediaDevices and cannot film it" \
    "serve the target over https, or reach it on localhost rather than a LAN address"
fi

STATE_FILE="${DEMO_STATE:-${TMPDIR:-/tmp}/record-demo-$(id -u).state}"
SOCK="${STATE_FILE%.state}.sock"
SOCK_MAX=107; [ "$(uname -s)" = "Darwin" ] && SOCK_MAX=103
if [ "${#SOCK}" -gt "$SOCK_MAX" ]; then
  fail "the daemon socket path is ${#SOCK} characters; this platform allows $SOCK_MAX" \
    "set DEMO_STATE to a shorter path, e.g. DEMO_STATE=/tmp/rd.state"
elif [ -S "$SOCK" ] && [ -f "$STATE_FILE" ]; then
  warn "a take is already in flight; the next \`start\` will close it out and keep its partial" \
    "$SKILL_DIR/scripts/record-demo.sh finish, or … abort, to close it out now"
elif [ -e "$STATE_FILE" ] && [ ! -O "$STATE_FILE" ]; then
  fail "$STATE_FILE is not owned by this user, and every command refuses it" \
    "set DEMO_STATE to a path you own"
else
  ok "socket path $SOCK is usable"
fi

if [ "$FATAL" -ne 0 ]; then
  printf '\n  fatal checks failed above; fix them before filming.\n'
  exit 1
fi

printf '\n  every fatal check passed.\n'
exit 0
