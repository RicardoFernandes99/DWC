# Motion and loading

Reserve image aspect ratios and async-content space. Skeletons resemble the final
layout. Keep cached content during refresh and indicate stale/error states.
Use tabular numerals for changing prices and countdowns.

Prefer short purposeful opacity/transform transitions with explicit properties
and reduced-motion alternatives. Avoid blanket `will-change` and dependencies for
simple CSS effects. User-triggered submissions get prompt feedback; delay only
cosmetic background spinners. Distinguish empty, loading and failed states.

Measure before virtualization or manual memoization; paginate first. Keep compiler
diagnostics on. Auction countdowns reflect server deadlines and never replace
server acceptance checks or state resynchronization after reconnect.
