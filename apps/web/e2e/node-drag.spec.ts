import { test, expect, Page } from '@playwright/test';

async function createTaskNode(page: Page){
  const res = await page.request.post('/api/nodes', { data: { type: 'Task', name: 'DragMe', props: { title: 'Drag Me' } }});
  expect(res.ok()).toBeTruthy();
  const json = await res.json();
  return json.node.id as string;
}

async function fetchNodePosition(page: Page, id: string){
  const res = await page.request.get(`/api/nodes/${id}`);
  expect(res.ok()).toBeTruthy();
  const json = await res.json();
  return json.node.position as { x: number; y: number };
}

test.describe('Node drag persistence', () => {
  test('drags a node and persists position after reload', async ({ page }) => {
    const nodeId = await createTaskNode(page);

    // Get initial position from backend (defaults set in repo)
    const initialPos = await fetchNodePosition(page, nodeId);

    await page.goto('/');
    // Locate node by label text
    const locator = page.locator('.react-flow__node', { hasText: 'DragMe' }).first();
    await expect(locator).toBeVisible();
    const box = await locator.boundingBox();
    if(!box) throw new Error('No bounding box');

    const startX = box.x + box.width / 2;
    const startY = box.y + box.height / 2;
    const deltaX = 140; // pick a value large enough to be obvious
    const deltaY = 95;

    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(startX + deltaX, startY + deltaY, { steps: 10 });
    await page.mouse.up();

    // Wait briefly for POST
    await page.waitForTimeout(200);

    const movedPos = await fetchNodePosition(page, nodeId);
    // Assert position changed meaningfully from initial
    expect(Math.abs(movedPos.x - initialPos.x)).toBeGreaterThan(40);
    expect(Math.abs(movedPos.y - initialPos.y)).toBeGreaterThan(30);

    // Reload UI and re-fetch to ensure persistence (even if fitView changes screen coords)
    await page.reload();
    const afterReloadPos = await fetchNodePosition(page, nodeId);
    expect(afterReloadPos.x).toBe(movedPos.x);
    expect(afterReloadPos.y).toBe(movedPos.y);
  });
});
