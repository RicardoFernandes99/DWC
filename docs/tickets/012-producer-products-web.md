# 012: Build producer product and profile management screens

- Macro: M03
- Status: In progress
- Depends on: 008, 010, 011
- PR: Not opened
- Branch / parent: `codex/age-012-producer-products-web` / `codex/age-011-product-images-api` at `2debf8a199b24423bbf131bb6073f434e3f6756d`
- Blockers: None. Local services and required browser checks passed.

## Outcome

Approved producers manage profile, products, stock, images and low-stock settings
through responsive forms.

## Read first

[Product decisions](../product-decisions.md), [web guidance](../../apps/web/AGENTS.md),
the status screen from 008 and the API contracts from 010/011.

## Scope and contract

- Add producer product list, create/edit forms and profile form using established
  Router/Query/Form and existing UI primitives. Include published/archive controls,
  price/unit/stock, seasons/method/category and low-stock threshold.
- Upload real images with owner preview and bounded progress/error feedback.
  Refresh expiring image access instead of persisting signed URLs locally.
- Pending/rejected states show approval messaging rather than creation forms.
  Suspended users see the banner, no new-product creation, and preserve navigation
  to existing orders. Do not invent extra editing permissions beyond API contracts.
- Stale-edit 409s explain that data changed and offer a reload without silently
  overwriting stock or losing unsaved text. Archive asks for deliberate confirmation.
- Do not add public catalogue, admin controls or auction forms in this ticket.

## Acceptance criteria

- [x] Owner can create/edit/archive products and update permitted profile fields.
- [x] Units, money and precision match the server contract; failures preserve form data.
- [x] Image and stale-stock failures are visible without false success.
- [x] Direct URLs do not bypass pending/suspension presentation; API still authorizes.
- [x] Long text, keyboard use and all three responsive ranges work.

## Checks

Follow [lightweight verification](README.md#lightweight-verification).

Create/edit/archive a product, upload an image and check a server refusal. Briefly inspect form layout and keyboard use at the agreed ranges.

## Delivery notes

- Implemented on `codex/age-012-producer-products-web`, stacked on `codex/age-011-product-images-api` at `2debf8a199b24423bbf131bb6073f434e3f6756d`. Builder: `gpt-6-luna` (medium); two formal review correction rounds completed, plus the user-requested global Orchard design alignment. No model adaptation. A hung desktop-browser launch was interrupted; verification then used installed Chrome outside the network sandbox. Usage and cost measurements were unavailable.
- Updated shared theme tokens and the visual specimen to the approved Orchard board palette: Forest `#24563D`, Cream `#F7F5EE`, Sage `#DDE8D8`, Orange `#D98145`, and Ink `#253329`. Durable reference: `apps/web/public/design/orchard-reference.png`, viewable at `/ui-design`. Fraunces headings and system body/control typography are retained, and destructive states remain red.
- Integrated `/ui-design` into the router and added a home-screen link. Applied the editorial heading face globally and changed the 2-column mobile product cards to stack title/badge with compact padding to prevent narrow vertical word wrapping. Removed the duplicate non-approved producer guard panel; onboarding remains the status presentation and management queries remain gated.
- Palette update checks passed: web typecheck, web build with React Compiler verification, root lint, and scoped Prettier on `apps/web/src/index.css`, `apps/web/src/design-system/specimen.tsx`, `docs/ui-guidelines.md`, and this ticket. The Vite build reported its existing bundle-size advisory (510.25 kB main chunk).
- Added approved-producer product listing, pagination, create/edit/archive, profile editing, image upload and expiring-preview refresh, integer quantity and exact-cent validation, explicit stale-revision reload, and status-gated pending/rejected/suspended views. Product and profile forms retain entered text after request failures. Suspended accounts do not call the approved-only product/profile endpoints.
- Static checks passed with Node 24.22.2 and cached pnpm 11.25.0: `pnpm --filter @dwc/web typecheck`, `pnpm --filter @dwc/web build` (including React Compiler verification), `pnpm lint`, `pnpm --filter @dwc/api build`, `node apps/api/dist/export-web-contract.js --check`, `pnpm --filter @dwc/web exec openapi-typescript openapi.json -o src/lib/api-schema.ts --check`, and scoped Prettier check for the five changed files.
- Frontier verdict: APPROVED after reviewing the implementation and real browser evidence on 2026-11-02. Docker recovered after preserving and recreating only its transient socket directories; `pnpm infra:up` passed and the API readiness endpoint returned 200. No volumes, databases or images were reset.
- Real Chrome/API checks passed with isolated test accounts: create a EUR 4.10 product, upload a real image, trigger an image-upload 409 after creation and recover without duplicating the product, edit/archive, reject stale stock with 409, reload current stock while retaining descriptive text, and save the profile twice. Pending/rejected/suspended direct creation URLs show status messaging without editors; authenticated product requests return 403. Keyboard focus and long text were checked.
- Product list/editor layouts passed at 375, 900 and 1440 px with screenshots inspected and no horizontal overflow. Home, login, registration, `/ui-design` and the specimen passed at those widths with Forest tokens and Fraunces headings verified. Local screenshots are under `demos/ticket-012-review/`; the temporary verification scripts and generated media are excluded from the commit. These focused checks do not prove every concurrency interleaving.
