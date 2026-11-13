import { expect, test, type Page } from '@playwright/test';

// One family's first evening with the app, end to end. Each browser signs
// up its own account so the two projects never share state.

const PASSWORD = 'correct horse battery';

function collectProblems(page: Page): string[] {
  const problems: string[] = [];
  // A CSP violation or a React error shows up here before it shows up anywhere else.
  page.on('console', (msg) => {
    // The browser logs every non-2xx response; the duplicate check's 409 is expected.
    if (msg.type() === 'error' && !msg.text().includes('status of 409')) problems.push(msg.text());
  });
  page.on('pageerror', (err) => problems.push(err.message));
  return problems;
}

async function shot(page: Page, name: string) {
  await page.screenshot({ path: test.info().outputPath(`${name}.png`), fullPage: true });
}

async function noSideScroll(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow, 'page scrolls sideways').toBeLessThanOrEqual(0);
}

test('sign up, set up a household, record a first evening', async ({ page, browserName }) => {
  // One long journey of about thirty saves; WebKit on Windows runs it in roughly 35 seconds.
  test.setTimeout(90_000);
  const problems = collectProblems(page);
  const username = `parent_${browserName}`;

  await page.goto('/');
  await expect(page).toHaveURL(/\/signin$/);
  await shot(page, '01-signin');

  await page.getByRole('link', { name: 'Create an account' }).click();
  // Sign-in has fields with the same labels; wait until they are gone.
  await expect(page.getByRole('heading', { name: 'Create your account' })).toBeVisible();
  await page.getByLabel('Username').fill(username);
  await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
  await page.getByLabel('6-digit PIN').fill('274916');
  await page.getByLabel('PIN again').fill('274916');
  await shot(page, '02-signup');
  await page.getByRole('button', { name: 'Create account' }).click();

  await expect(page.getByRole('heading', { name: `Welcome, ${username}` })).toBeVisible();
  await page.getByLabel('Household name').fill('The Nest');
  await page.getByRole('button', { name: 'Create' }).click();

  await expect(page.getByText('Add your baby to start')).toBeVisible();
  await page.getByRole('link', { name: 'Add a baby' }).click();
  await page.getByLabel('Name').fill('Juniper');
  await page.getByLabel('Birth date').fill('2026-03-10');
  await page.getByRole('button', { name: 'Add baby' }).click();

  await expect(page.getByRole('heading', { name: 'Juniper', level: 1 })).toBeVisible();
  await noSideScroll(page);
  await shot(page, '03-home-empty');

  // A library first, from the floating button.
  await page.getByRole('button', { name: 'Add something for Juniper' }).click();
  await page.getByRole('button', { name: /First/ }).first().click();
  await page.getByRole('button', { name: 'Rolled over' }).click();
  await shot(page, '04-add-first');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByText('Rolled over saved for Juniper.')).toBeVisible();

  // The same first again is caught as a duplicate.
  await page.getByRole('button', { name: 'Add something for Juniper' }).click();
  await page.getByRole('button', { name: /First/ }).first().click();
  await page.getByLabel('What happened?').fill('rolled over');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByText('is already saved')).toBeVisible();
  await page.getByRole('button', { name: 'Close' }).click();

  // A food with a reaction and an allergy flag.
  await page.getByRole('button', { name: 'Add something for Juniper' }).click();
  await page.getByRole('button', { name: /Food/ }).first().click();
  await page.getByLabel('Food', { exact: true }).fill('Banana');
  await page.getByRole('button', { name: 'Loved it' }).click();
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByText('Banana saved for Juniper.')).toBeVisible();

  await page.getByRole('button', { name: 'Add something for Juniper' }).click();
  await page.getByRole('button', { name: /Food/ }).first().click();
  await page.getByLabel('Food', { exact: true }).fill('Peanut butter');
  await page.getByRole('button', { name: 'Not a fan' }).click();
  await page.getByLabel(/Possible allergic reaction/).check();
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByText('Peanut butter saved for Juniper.')).toBeVisible();

  // Words.
  for (const word of ['Dada', 'Ball', 'Dog']) {
    await page.getByRole('button', { name: 'Add something for Juniper' }).click();
    await page.getByRole('button', { name: /Word/ }).first().click();
    await page.getByLabel('Word', { exact: true }).fill(word);
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(page.getByText(`${word} saved for Juniper.`)).toBeVisible();
  }

  // Measurements: the growth chart needs a few points.
  for (const [date, lb, oz, length] of [
    ['2026-03-10', '7', '6', '19.5'],
    ['2026-05-12', '11', '2', '22.5'],
    ['2026-07-14', '13', '9', '24.5'],
    ['2026-09-15', '15', '4', '26'],
  ]) {
    await page.getByRole('button', { name: 'Add something for Juniper' }).click();
    await page.getByRole('button', { name: /Measurement/ }).first().click();
    await page.getByLabel('Date').fill(date);
    await page.getByLabel('Pounds').fill(lb);
    await page.getByLabel('Ounces').fill(oz);
    await page.getByLabel('Length').fill(length);
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(page.getByText('Measurement saved for Juniper.')).toBeVisible();
  }

  await page.reload();
  await expect(page.getByText('latest weight')).toBeVisible();
  await noSideScroll(page);
  await shot(page, '05-home-classic');

  // Growth: the sex question comes first, with the reason.
  await page.getByRole('link', { name: 'Growth' }).click();
  await expect(page.getByText('Want percentile curves?')).toBeVisible();
  await page.getByRole('button', { name: "Girl's chart" }).click();
  await expect(page.getByText(/percentile/).first()).toBeVisible();
  await expect(page.getByText(/Tracking steadily|Moving up|Now around|One weight/)).toBeVisible();
  await noSideScroll(page);
  await shot(page, '06-growth');

  await page.getByRole('link', { name: 'Timeline' }).click();
  await expect(page.getByText('Peanut butter')).toBeVisible();
  await expect(page.getByText('Possible allergy').first()).toBeVisible();
  await shot(page, '07-timeline');

  // Switch to Nursery Shelf.
  await page.getByRole('link', { name: 'More' }).click();
  await page.getByRole('radio', { name: /Nursery Shelf/ }).click();
  await shot(page, '08-more');
  await page.getByRole('link', { name: 'Home' }).click();
  await expect(page.getByRole('button', { name: 'Data' }).first()).toBeVisible();
  await noSideScroll(page);
  await shot(page, '09-home-nursery');

  // The Data toggle flips one card to the plain view.
  await page.getByRole('button', { name: 'Data' }).first().click();
  await expect(page.getByRole('button', { name: 'Picture' }).first()).toBeVisible();

  // Edit an entry and see its history.
  await page.getByRole('link', { name: 'Timeline' }).click();
  await page.getByRole('link', { name: /Dada/ }).click();
  await page.getByRole('button', { name: 'Edit' }).click();
  await page.getByLabel('Word', { exact: true }).fill('Dada!');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByText('Edit history')).toBeVisible();
  await shot(page, '10-entry');

  // An invite code is shown once.
  await page.goto('/more/household');
  await page.getByRole('button', { name: 'Create invite code' }).click();
  await page.getByLabel('Your password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Create', exact: true }).click();
  await expect(page.getByText('This is the only time the code is shown.')).toBeVisible();
  await shot(page, '11-invite');
  await page.getByRole('button', { name: 'Done' }).click();

  // Dark mode follows the device, and nothing scrolls sideways at the narrowest phone width.
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Juniper', level: 1 })).toBeVisible();
  await shot(page, '12-home-dark');
  await page.goto('/growth');
  await expect(page.getByText('Weight over time')).toBeVisible();
  await shot(page, '13-growth-dark');
  await page.emulateMedia({ colorScheme: 'light' });
  await page.setViewportSize({ width: 320, height: 640 });
  for (const path of ['/', '/timeline', '/growth', '/more', '/more/household']) {
    await page.goto(path);
    await page.waitForLoadState('networkidle');
    await noSideScroll(page);
  }
  // Solids were logged above, so "Has Juniper tried solid food yet?" must not be asked.
  await page.goto('/');
  await expect(page.getByText('tried solid food')).toHaveCount(0);

  // Sign out, and the app is closed again.
  await page.getByRole('link', { name: 'More' }).click();
  await page.getByRole('button', { name: 'Sign out' }).click();
  await expect(page).toHaveURL(/\/signin$/);
  await page.goto('/timeline');
  await expect(page).toHaveURL(/\/signin$/);

  expect(problems).toEqual([]);
});

test('every page sends a nonce-based CSP and no third-party requests', async ({ page }) => {
  const origins = new Set<string>();
  page.on('request', (req) => origins.add(new URL(req.url()).origin));
  const res = await page.goto('/signin');
  const csp = res!.headers()['content-security-policy'];
  expect(csp).toMatch(/script-src 'self' 'nonce-[^']+' 'strict-dynamic'/);
  expect(csp).toContain("frame-ancestors 'none'");
  expect([...origins]).toEqual([new URL(page.url()).origin]);
});
