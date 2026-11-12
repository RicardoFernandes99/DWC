# Frontend skills and visual review

Read this for tickets that create or change frontend screens. Select skills by
the actual work and read the relevant instructions before using them. Resolve
names from the session's available-skills catalog, preferring the repository
version when one exists. Every skill in the table ships under
`.agents/skills/` (`taste-skill` provides `design-taste-frontend`), so Codex and
Claude Code sessions both find them; pass the relevant `SKILL.md` paths to the
builder. From `vercel-react-best-practices`, apply only client-side rules: DWC is
a Vite SPA, so its Next.js, server and RSC rules do not apply. Keep the selection and design intent in chat and the
builder handoff; do not create additional plan or design files for a build ticket.

## Skill selection

| Skill                          | When to use it                                                                                                           | What to take from it                                                                                                                                                                                                 |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `web-feature`                  | Every DWC React feature or behavior change                                                                               | Existing routes, typed API calls, Query/Form patterns, compiler rules and proportionate checks.                                                                                                                      |
| `design-engineering`           | React components, forms and responsive layouts                                                                           | Composition, state ownership, semantic controls, labels/errors, keyboard access and loading/recovery behavior.                                                                                                       |
| `interface-design`             | Product screens such as producer tools, lists, details, dashboards and settings                                          | Task-first hierarchy, usable density, content/action alignment, deliberate use of space and consistency with neighboring screens.                                                                                    |
| `frontend-design`              | New visual compositions, public-facing pages or substantial visual changes; targeted composition review during UI polish | Art direction, typography, proportions and coherent visual identity. Adapt these to Orchard's established system.                                                                                                    |
| `design-taste-frontend`        | Designing or reviewing a screen's visual composition                                                                     | Select its app-screen or page guidance correctly. Inspect real content, hierarchy, spacing, wrapping, empty space and breakpoint behavior. Follow the applicable inspection workflow and disclose unavailable tools. |
| `impeccable`                   | UX refinement, visual quality, accessibility, responsive adaptation or state hardening                                   | Choose the matching playbook, such as polish, adapt or harden. Use audit for technical findings and critique for a requested broader design assessment, following each command's workflow when selected.             |
| `emil-design-eng`              | Refining interaction details and component polish                                                                        | Clear state feedback, optical alignment, focus/hover/pressed behavior, interruption and when an interaction should stay immediate.                                                                                   |
| `animate`                      | Adding or changing purposeful motion                                                                                     | Timing, easing, continuity, cleanup and reduced motion. Add motion only when it helps an implemented interaction.                                                                                                    |
| `vercel-react-best-practices`  | Writing or reviewing React code                                                                                          | Applicable performance and data-flow guidance. DWC's React Compiler rules govern manual memoization.                                                                                                                 |
| `web-design-guidelines`        | A requested compliance/accessibility review, or relevant technical review concerns                                       | Fetch its current primary-source guidelines and check applicable semantics, focus, forms, navigation and responsive behavior.                                                                                        |
| `record-demo` / `produce-demo` | Capturing browser evidence / assembling a requested video                                                                | Real implemented behavior, repeatable fixture states, local artifacts under `demos/` and useful captions.                                                                                                            |
| `unslop`                       | UI copy and delivery notes                                                                                               | Plain, precise language without invented claims or implementation details that do not help the user.                                                                                                                 |

Use `interface-design` as the primary composition guide for product tools and
`frontend-design` for page/art-direction work. A mixed ticket can use each on its
matching screens. For an established screen, take targeted guidance from the
other skills where it helps; loading every overlapping playbook is unnecessary.
For a visual polish request, consider the composition, Impeccable and Emil
guidance explicitly rather than defaulting to functional checks alone.

State selected skills and their contribution briefly. Distinguish a skill that
was read from a procedure that was actually completed. If an expected skill or
tool is unavailable, name the limitation and the permitted fallback; do not claim
its check passed. API-only tickets do not need this frontend workflow.

## Project constraints

User decisions, `apps/web/AGENTS.md`, `docs/ui-guidelines.md` and Orchard's existing
tokens/components constrain generic skill suggestions. Preserve the approved
palette, Fraunces heading role, shared controls and three responsive ranges.
Resolve conflicting skill advice in favor of those project constraints and state
any material choice. Do not introduce a font, dependency, global restyle, animation
or replacement primitive merely to demonstrate skill usage. Existing user
authorization covers routine implementation and polish within the ticket.

## Visual review

Keep this inside the existing builder/frontier loop, with its same correction
limit. It is not another mandatory review team or separate delivery stage.

1. Name the user's task, the main action and the intended reading order. For
   existing UI, capture the relevant current screens before editing and preserve
   those images. Previously captured screenshots are usable when their exact
   implementation/state is known and identified.
2. Exercise the real implementation at representative widths below 768px,
   768–1279px and 1280px upward. Check affected screens and meaningful states:
   initial/refresh loading, empty/populated, validation/conflict/error,
   offline/reconnect, permission restrictions and confirmation/success as relevant.
3. Judge the rendered result as a composition. Check hierarchy, alignment,
   typography, grouping, readable measure, content/action placement, unused space,
   wrapping and consistent edges. A layout can avoid overflow and still waste
   space or strand an action. Test long content and intermediate widths where
   the layout changes, without manufacturing new product requirements.
4. Check keyboard/focus, labels and nearby errors, contrast, touch targets, zoom,
   disabled/pending feedback and reduced motion where applicable. Use the selected
   skills' relevant tools and actual browser interactions. Preserve entered data
   and cached content during refresh/recovery; server decisions remain authoritative.
5. Give the builder bounded, observable findings and inspect the correction.
   Reuse valid functional checks and rerun those affected by the change. Do not
   redesign a satisfactory screen to manufacture a before/after difference.
6. Capture after images with matching viewport, route/state, content and framing
   where possible. Label unavoidable fixture/data differences. Save under
   `demos/ticket-NNN-review/`, keeping before and after distinct and preserving
   unrelated artifacts. Use actual UI screenshots, never mockups as evidence.

Before approval, report which screens/states and skills were actually checked,
what changed, what was retained and any concrete tool/runtime limits. Embed
useful before/after screenshots inline with absolute local paths and short
viewport/state captions so the user can compare them in the chat. A compact
Before / After / Why table works well for individual findings. Keep code/check
results separate from the visual judgment; neither substitutes for the other.
