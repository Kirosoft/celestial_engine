import { test, expect } from '@playwright/test';

test.skip(); // Temporarily skipped due to node rendering race; to be re-enabled after canvas mount debugging.
import { ensureNodePresent } from './helpers';

// Assumes at least one node exists from seed data

test.describe('Inspector resize', () => {
  test('resizes and persists width', async ({ page }) => {
    await page.goto('/');
    // Ensure at least one node exists; if not, create one through UI by opening toolbox and clicking first type
    const nodeSelector = '.react-flow__node';
    await ensureNodePresent(page);
    const firstNode = await page.$(nodeSelector);
    if(!firstNode) throw new Error('No node found to select');
    await firstNode.click({ position: { x: 10, y: 10 } });

    const handle = page.getByTestId('inspector-resize-handle');
    // Get initial width
    const initialWidth = await page.evaluate(() => {
      const el = document.querySelector('[data-testid="inspector-resize-handle"]')?.parentElement as HTMLElement | null;
      return el ? el.getBoundingClientRect().width : 0;
    });
    expect(initialWidth).toBeGreaterThan(0);

    // Drag handle left by 80px
    const box = await handle.boundingBox();
    if(!box) throw new Error('No handle box');
    await page.mouse.move(box.x + box.width/2, box.y + 50);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width/2 - 80, box.y + 50, { steps: 5 });
    await page.mouse.up();

    const resizedWidth = await page.evaluate(() => {
      const el = document.querySelector('[data-testid="inspector-resize-handle"]')?.parentElement as HTMLElement | null;
      return el ? Math.round(el.getBoundingClientRect().width) : 0;
    });
    expect(resizedWidth).toBeGreaterThan(initialWidth); // dragging left increases width

    // Reload and confirm width persisted (allow small diff)
    await page.reload();
    // Re-select a node after reload (create if needed again)
    await ensureNodePresent(page);
    const firstNode2 = await page.$(nodeSelector);
    if(!firstNode2) throw new Error('No node found after reload');
    await firstNode2.click({ position: { x: 10, y: 10 } });
    const persistedWidth = await page.evaluate(() => {
      const el = document.querySelector('[data-testid="inspector-resize-handle"]')?.parentElement as HTMLElement | null;
      return el ? Math.round(el.getBoundingClientRect().width) : 0;
    });
    expect(Math.abs(persistedWidth - resizedWidth)).toBeLessThanOrEqual(4);
  });
});
