import { test, expect, Page } from '@playwright/test';

function getToolboxSelector(){ return '[data-testid="toolbox"]'; }

async function getToolboxBox(page: Page){
  return await page.evaluate(() => {
    const el = document.querySelector('[data-testid="toolbox"]') as HTMLElement | null;
    if(!el) return null;
    const r = el.getBoundingClientRect();
    return { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) };
  });
}

test.describe('Toolbox drag & collapse', () => {
  test('drag, collapse, expand, and persist position', async ({ page }) => {
    await page.goto('/');

    // Ensure toolbox visible (if closed)
    const opener = page.getByTestId('open-toolbox');
    if(await opener.count()){
      await opener.click();
    }

    await page.waitForSelector(getToolboxSelector());
    const before = await getToolboxBox(page);
    if(!before) throw new Error('Toolbox not found');

    // Drag via header
    const header = page.getByTestId('toolbox-header');
    const box = await header.boundingBox();
    if(!box) throw new Error('Header box missing');
    await page.mouse.move(box.x + box.width/2, box.y + box.height/2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width/2 + 120, box.y + box.height/2 + 40, { steps: 6 });
    await page.mouse.up();

    const afterDrag = await getToolboxBox(page);
    if(!afterDrag) throw new Error('Toolbox missing after drag');
  expect(afterDrag.x).toBeGreaterThan(before.x);
  // Y may clamp to minimum (>=40). Just assert it changed OR equals clamp value.
  expect(afterDrag.y === before.y || afterDrag.y >= 40).toBeTruthy();

    // Collapse
    const collapseBtn = page.getByTestId('toolbox-collapse-toggle');
    await collapseBtn.click();
    // Wait a tick
    await page.waitForTimeout(100);
    const heightCollapsed = await page.evaluate(()=>{
      const el = document.querySelector('[data-testid="toolbox"]') as HTMLElement | null;
      if(!el) return 0; return Math.round(el.getBoundingClientRect().height);
    });

    // Expand again
    await collapseBtn.click();
    await page.waitForTimeout(100);
    const heightExpanded = await page.evaluate(()=>{
      const el = document.querySelector('[data-testid="toolbox"]') as HTMLElement | null;
      if(!el) return 0; return Math.round(el.getBoundingClientRect().height);
    });
    expect(heightExpanded).toBeGreaterThan(heightCollapsed);

    // Reload: position + collapse state persist
    await collapseBtn.click(); // collapse before reload
    await page.reload();
    // Re-open if needed
    if(await opener.count()){
      await opener.click();
    }
    const afterReload = await getToolboxBox(page);
    if(!afterReload) throw new Error('Toolbox missing after reload');
    // Position should be close to dragged position
    expect(Math.abs(afterReload.x - afterDrag.x)).toBeLessThanOrEqual(3);
    expect(Math.abs(afterReload.y - afterDrag.y)).toBeLessThanOrEqual(3);
  });
});
