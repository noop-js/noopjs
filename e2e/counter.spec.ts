import { test, expect } from '@playwright/test';

test.describe('Noop Counter SSR → Client Resumption', () => {
  test('serves SSR-rendered HTML with correct structure', async ({ page }) => {
    await page.goto('/');

    // The page should have the NoopJS state script
    const stateEl = page.locator('#__NOOP_STATE__');
    await expect(stateEl).toBeAttached();

    // State should contain the count signal
    const stateText = await stateEl.textContent();
    const state = JSON.parse(stateText!);
    expect(state.signals['c0.count']).toBe(0);

    // The HTML should have the rendered component
    await expect(page.locator('h1')).toHaveText('Noop Counter');

    // The count text should be rendered by SSR
    await expect(page.locator('p')).toContainText('Count:0');

    // The button should have the event handler attribute
    const button = page.locator('button');
    await expect(button).toHaveAttribute('data-noop-ev', '__h_0');

    // Atomic CSS classes should be present
    const btnClass = await button.getAttribute('class');
    expect(btnClass).toContain('_a');
  });

  test('client resumer re-attaches signal binding', async ({ page }) => {
    await page.goto('/');

    // Wait for the client JS to load and the resumer to initialize
    // The resumer reads __NOOP_STATE__ and re-attaches effects
    await page.waitForFunction(() => {
      const el = document.getElementById('__NOOP_STATE__');
      if (!el) return false;
      // Check that the resumer has processed the state
      // (the state script should still exist but the resumer has run)
      return true;
    });

    // Give the resumer time to process
    await page.waitForTimeout(500);

    // Click the button — the handler should work via delegation
    await page.click('button');

    // After clicking, the count should increment (signal-driven via resumer effect)
    // Note: the initial SSR text is "Count:0". After click, it becomes "Count:1"
    await expect(page.locator('p')).toContainText('Count:1');
  });

  test('handler fires via delegated event', async ({ page }) => {
    await page.goto('/');

    await page.waitForTimeout(500);

    // Click twice
    await page.click('button');
    await page.click('button');

    await expect(page.locator('p')).toContainText('Count:2');
  });

  test('atomic CSS classes are applied and survive after resume', async ({ page }) => {
    await page.goto('/');

    const button = page.locator('button');
    const classAttr = await button.getAttribute('class');
    expect(classAttr).toBeTruthy();
    expect(classAttr).toContain('_a'); // Atomic CSS classes start with _a

    // Click to verify interaction still works with styled element
    await page.click('button');
    await expect(page.locator('p')).toContainText('Count:1');

    // Class should still be present after state update
    const classAfter = await button.getAttribute('class');
    expect(classAfter).toBe(classAttr);
  });

  test('counter accepts multiple rapid clicks', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(500);

    const button = page.locator('button');
    await button.click({ clickCount: 5 });

    await expect(page.locator('p')).toContainText('Count:5');
  });
});
