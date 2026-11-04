import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { chromium, type Page } from 'playwright';

const output = 'demos/ticket-032-review';
const web = process.env.WEB ?? 'http://localhost:5174';
const fixture = JSON.parse(await readFile(`${output}/fixture.json`, 'utf8'));
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const pageErrors: string[] = [];
const screenshots: string[] = [];
const thanks = 'Thanks — we’ve received your report.';

async function open(email?: string) {
  const context = await browser.newContext({
    timezoneId: 'Europe/London',
    reducedMotion: 'reduce',
    viewport: { width: 1440, height: 1000 },
  });
  if (email) {
    const login = await context.request.post(`${web}/api/auth/login`, {
      data: { email, password: fixture.password },
    });
    assert.equal(login.status(), 200, `login ${email}`);
  }
  const page = await context.newPage();
  page.on('pageerror', (error) => pageErrors.push(error.message));
  page.on('dialog', (dialog) => {
    pageErrors.push(`dialog: ${dialog.message()}`);
    void dialog.dismiss();
  });
  return { context, page };
}

async function capture(page: Page, name: string) {
  for (const width of [390, 900, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.waitForTimeout(150);
    assert(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      `${name} overflows at ${width}`,
    );
    const path = `${output}/${name}-${width}.png`;
    await page.screenshot({ path, fullPage: true });
    screenshots.push(path);
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
}

const star = (page: Page, value: number) =>
  page
    .locator('fieldset label')
    .nth(value - 1)
    .click();

const checkedValue = (page: Page) =>
  page.evaluate(
    () =>
      (document.querySelector('input[type=radio]:checked') as HTMLInputElement)
        .value,
  );

try {
  // Guest: producer page with reviews.
  const guest = await open();
  const g = guest.page;
  await g.goto(`${web}/farm/${fixture.producerId}`);
  await g.getByRole('heading', { name: 'Reviews', exact: true }).waitFor();
  await g.getByText('Sweet apples, great service.').waitFor();
  const summary = await g.locator('a[href="#reviews"]').innerText();
  assert.match(summary, /\d\.\d\s*·\s*12 reviews/, summary);
  assert.equal(await g.locator('#reviews li').count(), 10);
  assert.equal(await g.getByText('hidden review must never').count(), 0);
  await g.getByText('<b>html</b> should stay as plain text').waitFor();
  assert.equal(await g.locator('#reviews li b, #reviews li script').count(), 0);
  await g
    .getByRole('img', { name: /out of 5 stars/ })
    .first()
    .waitFor();
  await g.getByRole('link', { name: 'Sign in to report' }).first().waitFor();
  await capture(g, 'producer-reviews');

  // Page 2 by keyboard.
  await g
    .getByRole('navigation', { name: 'Review pages' })
    .getByRole('button', { name: 'Next' })
    .focus();
  await g.keyboard.press('Enter');
  await g.getByText('Page 2 of 2').waitFor();
  assert.equal(await g.locator('#reviews li').count(), 2);
  await capture(g, 'producer-reviews-page-2');
  await g
    .getByRole('navigation', { name: 'Review pages' })
    .getByRole('button', { name: 'Previous' })
    .focus();
  await g.keyboard.press('Space');
  await g.getByText('Page 1 of 2').waitFor();

  // Signed-out report path goes to login with a return.
  await g.getByRole('link', { name: 'Sign in to report' }).first().click();
  await g.waitForURL(/\/login\?.*returnTo=/);
  await capture(g, 'report-signed-out-login');

  // Empty producer.
  await g.goto(`${web}/farm/${fixture.emptyProducerId}`);
  await g.getByText('No reviews yet', { exact: true }).first().waitFor();
  await g.getByText('No reviews yet. Buyers can review').waitFor();
  await capture(g, 'producer-no-reviews');

  // Review fetch failure with Retry.
  await g.route('**/api/producers/*/reviews*', (route) =>
    route.fulfill({ status: 500, body: '{}', contentType: 'application/json' }),
  );
  await g.goto(`${web}/farm/${fixture.producerId}`);
  await g.getByText('Reviews could not be loaded.').waitFor();
  await capture(g, 'producer-reviews-error');
  await g.unroute('**/api/producers/*/reviews*');
  await g.getByRole('button', { name: 'Retry' }).click();
  await g.getByText('Sweet apples, great service.').waitFor();
  await guest.context.close();

  // Signed-in reporter.
  const rep = await open(fixture.emails.reporter);
  const r = rep.page;
  await r.goto(`${web}/farm/${fixture.producerId}`);
  await r.getByText('Sweet apples, great service.').waitFor();
  const first = r.locator('#reviews li').first();
  await first.getByText('Report this review').click();
  await first.getByRole('radio', { name: 'Spam' }).waitFor();
  assert(
    await first.getByRole('button', { name: 'Send report' }).isDisabled(),
    'report disabled without category',
  );
  await first.getByRole('radio', { name: 'Off topic' }).check();
  await first.getByLabel(/Note/).fill('Looks unrelated to the farm.');
  await capture(r, 'report-form-open');
  await r.route('**/api/reviews/*/reports', (route) =>
    route.fulfill({ status: 500, body: '{}', contentType: 'application/json' }),
  );
  await first.getByRole('button', { name: 'Send report' }).click();
  await first.getByText('The report could not be sent').waitFor();
  assert.equal(
    await first.getByLabel(/Note/).inputValue(),
    'Looks unrelated to the farm.',
  );
  assert(await first.getByRole('radio', { name: 'Off topic' }).isChecked());
  await capture(r, 'report-error');
  await r.unroute('**/api/reviews/*/reports');
  await first.getByRole('button', { name: 'Try again' }).click();
  await first.getByText(thanks).waitFor();
  await capture(r, 'report-success');

  // Reload and repeat: idempotent success.
  await r.reload();
  const again = r.locator('#reviews li').first();
  await again.getByText('Report this review').click();
  await again.getByRole('radio', { name: 'Spam' }).check();
  await again.getByRole('button', { name: 'Send report' }).click();
  await again.getByText(thanks).waitFor();

  // 404 on report: message and list refetch.
  await r.reload();
  const gone = r.locator('#reviews li').nth(1);
  await gone.getByText('Report this review').click();
  await gone.getByRole('radio', { name: 'Spam' }).check();
  await r.route('**/api/reviews/*/reports', (route) =>
    route.fulfill({
      status: 404,
      body: JSON.stringify({
        statusCode: 404,
        code: 'review_not_found',
        message: 'x',
      }),
      contentType: 'application/json',
    }),
  );
  await gone.getByRole('button', { name: 'Send report' }).click();
  await r.getByText('This review is no longer available.').waitFor();
  await r.unroute('**/api/reviews/*/reports');
  await rep.context.close();

  // Buyer order flows.
  const buyer = await open(fixture.emails.buyer);
  const b = buyer.page;
  const orderUrl = (id: string) => `${web}/orders/${id}`;

  await b.goto(orderUrl(fixture.pendingOrderId));
  await b.getByRole('heading', { name: /Order #/ }).waitFor();
  await b.waitForTimeout(500);
  assert.equal(await b.getByText('Review this producer').count(), 0);
  await capture(b, 'order-pending-no-review');

  await b.goto(orderUrl(fixture.deliveredOrderId));
  await b.getByRole('heading', { name: 'Review this producer' }).waitFor();
  const send = b.getByRole('button', { name: 'Send review' });
  assert(await send.isDisabled(), 'submit disabled until rated');
  await capture(b, 'order-review-form-empty');

  // Keyboard: Shift+Tab from the comment lands in the star group; arrows change the rating.
  await b.getByLabel(/Comment/).focus();
  await b.keyboard.press('Shift+Tab');
  const type = await b.evaluate(
    () => (document.activeElement as HTMLInputElement).type,
  );
  assert.equal(type, 'radio', 'Tab reaches the star group');
  await b.keyboard.press('ArrowRight');
  await b.keyboard.press('ArrowRight');
  const value = await checkedValue(b);
  await b.keyboard.press('ArrowLeft');
  assert.notEqual(await checkedValue(b), value, 'arrows change selection');
  await star(b, 4);
  await b.getByText('4 of 5 · Very good').waitFor();
  await b
    .getByLabel(/Comment/)
    .fill('Lovely apples and friendly handover. <i>Plain</i> text only.');
  await capture(b, 'order-review-form-rated');
  await send.click();
  await b.getByRole('heading', { name: 'Your review' }).waitFor();
  await b
    .getByText('Thanks — your review is now on the producer’s page.')
    .waitFor();
  await capture(b, 'order-review-submitted');
  await b.reload();
  await b.getByRole('heading', { name: 'Your review' }).waitFor();

  // Producer page reflects it (now 13 reviews).
  await b.goto(`${web}/farm/${fixture.producerId}`);
  await b.getByText('Lovely apples and friendly handover.').waitFor();
  assert.match(await b.locator('a[href="#reviews"]').innerText(), /13 reviews/);

  // Duplicate: stale second tab.
  const stale = await buyer.context.newPage();
  stale.on('pageerror', (e) => pageErrors.push(e.message));
  await stale.goto(orderUrl(fixture.extraDeliveredOrderId));
  await stale.getByRole('heading', { name: 'Review this producer' }).waitFor();
  await star(stale, 2);
  await b.goto(orderUrl(fixture.extraDeliveredOrderId));
  await star(b, 5);
  await b.getByRole('button', { name: 'Send review' }).click();
  await b.getByRole('heading', { name: 'Your review' }).waitFor();
  await stale.getByRole('button', { name: 'Send review' }).click();
  await stale.getByText("You've already reviewed this order.").waitFor();
  await stale.getByRole('heading', { name: 'Your review' }).waitFor();
  assert.equal(await stale.getByText('Thanks — your review').count(), 0);
  await capture(stale, 'order-review-duplicate');
  await stale.close();

  // Collected order: form, API error keeps data, then success.
  await b.goto(orderUrl(fixture.collectedOrderId));
  await b.getByRole('heading', { name: 'Review this producer' }).waitFor();
  await star(b, 5);
  await b.keyboard.press('ArrowLeft');
  assert.equal(await checkedValue(b), '4');
  await b.getByLabel(/Comment/).fill('Collected on Saturday, all good.');
  await capture(b, 'order-review-collected-form');
  await b.route('**/api/reviews', (route) =>
    route.request().method() === 'POST'
      ? route.fulfill({
          status: 500,
          body: '{}',
          contentType: 'application/json',
        })
      : route.fallback(),
  );
  await b.getByRole('button', { name: 'Send review' }).click();
  await b.getByText('Your review could not be sent.').waitFor();
  assert.equal(
    await b.getByLabel(/Comment/).inputValue(),
    'Collected on Saturday, all good.',
  );
  assert(await b.getByRole('radio', { name: '4 stars' }).isChecked());
  await capture(b, 'order-review-api-error');
  await b.unroute('**/api/reviews');
  await b.getByRole('button', { name: 'Try again' }).click();
  await b.getByRole('heading', { name: 'Your review' }).waitFor();
  await capture(b, 'order-review-collected-submitted');
  await buyer.context.close();

  assert.deepEqual(pageErrors, [], `page errors: ${pageErrors.join('; ')}`);
  console.log(`ok - ${screenshots.length} screenshots`);
  for (const path of screenshots) console.log(path);
} finally {
  await browser.close();
}
