# 012: Build producer product and profile management screens

- Macro: M03
- Status: Draft
- Depends on: 008, 010, 011
- PR: Not opened
- Branch / parent: Not assigned
- Blockers: None beyond dependencies

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

- [ ] Owner can create/edit/archive products and update permitted profile fields.
- [ ] Units, money and precision match the server contract; failures preserve form data.
- [ ] Image and stale-stock failures are visible without false success.
- [ ] Direct URLs do not bypass pending/suspension presentation; API still authorizes.
- [ ] Long text, keyboard use and all three responsive ranges work.

## Checks

Follow [lightweight verification](README.md#lightweight-verification).

Create/edit/archive a product, upload an image and check a server refusal. Briefly inspect form layout and keyboard use at the agreed ranges.

## Delivery notes

Not implemented. Record actual evidence and PR/stack metadata here.
