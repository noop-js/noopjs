import { test, expect } from '@playwright/test';

test.describe('Noop Blog SSR + Client Navigation', () => {
  test('homepage serves SSR HTML with post list', async ({ page }) => {
    await page.goto('/');

    const stateEl = page.locator('#__NOOP_STATE__');
    await expect(stateEl).toBeAttached();

    await expect(page.locator('h1')).toHaveText('Noop Blog');
    await expect(page.locator('text=Hello, Noop!')).toBeVisible();
    await expect(page.locator('text=Signals Explained')).toBeVisible();
  });

  test('about page renders via SSR', async ({ page }) => {
    await page.goto('/about');

    await expect(page.locator('h1')).toHaveText('About This Blog');
    await expect(page.locator('text=zero-runtime framework')).toBeVisible();
  });

  test('blog post page renders post content', async ({ page }) => {
    await page.goto('/blog/hello-noop');

    await expect(page.locator('h1')).toHaveText('Hello, Noop!');
    await expect(page.locator('text=2026-01-15')).toBeVisible();
  });

  test('navigation fetches full HTML and client extracts root content', async ({ page }) => {
    await page.goto('/');

    const response = await page.evaluate(async () => {
      const res = await fetch('/about');
      const html = await res.text();
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      return doc.getElementById('root')?.innerHTML ?? '';
    });

    expect(response).toContain('About This Blog');
  });

  test('Tailwind utility classes are applied on blog pages', async ({ page }) => {
    await page.goto('/');

    const nav = page.locator('nav');
    const classAttr = await nav.getAttribute('class');
    expect(classAttr).toBeTruthy();
    // The nav uses token.spacing.6 for gap — resolves to Tailwind 'gap-6'
    expect(classAttr).toContain('gap-6');
  });

  test('NoopCSS atomic classes coexist with Tailwind classes', async ({ page }) => {
    await page.goto('/');

    // Links use exported styles (NoopCSS) with fontFamily/color — produce atomic classes
    const homeLink = page.locator('a[href="/"]').first();
    const linkClass = await homeLink.getAttribute('class');
    expect(linkClass).toBeTruthy();
    expect(linkClass).toContain('_a');
  });

  test('client-side navigation between pages', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Click the About link — should do client-side nav
    await page.click('a[href="/about"]');
    await page.waitForTimeout(500);

    // Should show About page content
    await expect(page.locator('h1')).toHaveText('About This Blog');

    // URL should have changed without full page load
    expect(page.url()).toContain('/about');
  });

  test('browser back/forward navigation', async ({ page }) => {
    // Start at home
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Navigate to about (client-side)
    await page.click('a[href="/about"]');
    await page.waitForTimeout(300);
    await expect(page.locator('h1')).toHaveText('About This Blog');

    // Navigate to blog post (client-side)
    await page.click('a[href="/blog/hello-noop"]');
    await page.waitForTimeout(300);
    await expect(page.locator('h1')).toHaveText('Hello, Noop!');

    // Go back to about
    await page.goBack();
    await page.waitForTimeout(300);
    await expect(page.locator('h1')).toHaveText('About This Blog');

    // Go back to home
    await page.goBack();
    await page.waitForTimeout(300);
    await expect(page.locator('h1')).toHaveText('Noop Blog');

    // Go forward to about again
    await page.goForward();
    await page.waitForTimeout(300);
    await expect(page.locator('h1')).toHaveText('About This Blog');
  });

  test('navigation updates history state', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Navigate to about
    await page.click('a[href="/about"]');
    await page.waitForTimeout(300);

    // History should have 2 entries
    const historyLen = await page.evaluate(() => window.history.length);
    expect(historyLen).toBeGreaterThanOrEqual(2);
  });

  test('404 returns not found', async ({ page }) => {
    const response = await page.goto('/nonexistent');
    expect(response!.status()).toBe(404);
  });

  test('client navigation after multiple page hops still works', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Home → About → Blog Post → Home
    await page.click('a[href="/about"]');
    await page.waitForTimeout(300);
    await expect(page.locator('h1')).toHaveText('About This Blog');

    await page.click('a[href="/blog/hello-noop"]');
    await page.waitForTimeout(300);
    await expect(page.locator('h1')).toHaveText('Hello, Noop!');

    await page.click('a[href="/"]');
    await page.waitForTimeout(300);
    await expect(page.locator('h1')).toHaveText('Noop Blog');
  });

  test('popstate triggers navigation', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Navigate client-side to about
    await page.click('a[href="/about"]');
    await page.waitForTimeout(300);
    await expect(page.locator('h1')).toHaveText('About This Blog');

    // Use popstate by going back
    await page.evaluate(() => window.history.back());
    await page.waitForTimeout(500);

    // Should be back at home
    await expect(page.locator('h1')).toHaveText('Noop Blog');
  });
});

test.describe('Noop Blog client: none', () => {
  test('about page has zero <script> tags', async ({ page }) => {
    await page.goto('/about');

    // client: none means no state script, no bootstrap, no module script
    const scripts = page.locator('script');
    await expect(scripts).toHaveCount(0);
  });
});

test.describe('Noop Blog Multi-Signal Form (resume)', () => {
  test('form page serves SSR HTML with signal state', async ({ page }) => {
    await page.goto('/form');

    const stateEl = page.locator('#__NOOP_STATE__');
    await expect(stateEl).toBeAttached();

    const state = JSON.parse(await stateEl.textContent()!);
    expect(state.signals).toBeDefined();
    const signalKeys = Object.keys(state.signals);
    expect(signalKeys.length).toBeGreaterThanOrEqual(5);

    await expect(page.locator('h1')).toHaveText('Feedback Form');

    // Static parts of text bindings should be SSR-rendered
    await expect(page.locator('text=Name:').first()).toBeVisible();
    await expect(page.locator('text=Email:').first()).toBeVisible();
    await expect(page.locator('text=Rating:').first()).toBeVisible();
    await expect(page.locator('text=Message:').first()).toBeVisible();
  });

  test('typing in fields updates signal-driven text display', async ({ page }) => {
    await page.goto('/form');
    await page.waitForTimeout(500);

    const nameInput = page.locator('input').first();
    await nameInput.fill('Alice');

    await expect(page.locator('p').first()).toContainText('Name:');
    await expect(page.locator('p').first()).toContainText('Alice');
  });

  test('multiple fields update independently', async ({ page }) => {
    await page.goto('/form');
    await page.waitForTimeout(500);

    const inputs = page.locator('input');
    await inputs.nth(0).fill('Bob');
    await inputs.nth(1).fill('bob@test.com');
    await inputs.nth(2).fill('8');

    const select = page.locator('select');
    await select.selectOption('feature');

    const textarea = page.locator('textarea');
    await textarea.fill('Great framework!');

    await expect(page.locator('text=Name:').first()).toContainText('Bob');
    await expect(page.locator('text=Email:').first()).toContainText('bob@test.com');
    await expect(page.locator('text=Rating:').first()).toContainText('8');
    await expect(page.locator('text=Message:').first()).toContainText('Great framework!');
  });
});

test.describe('Noop Blog Performance', () => {
  test('full page fetch is fast', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const start = Date.now();
    const response = await page.evaluate(async () => {
      const res = await fetch('/about');
      return res.text();
    });
    const elapsed = Date.now() - start;

    expect(response).toContain('About This Blog');
    expect(elapsed).toBeLessThan(2000); // generous threshold
  });
});
