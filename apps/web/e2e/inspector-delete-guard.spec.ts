import { test, expect } from '@playwright/test';
import { resetRepoRoot } from './helpers';

async function createTask(request: any, name: string){
  const res = await request.post('/api/nodes', { data: { type: 'Task', name, props: { title: name+' Title', description: 'Desc' } } });
  expect(res.ok()).toBeTruthy();
  return (await res.json()).node as { id: string; name: string };
}

test.beforeEach(async ()=> { await resetRepoRoot(); });

test('Delete key in prop input does not delete node', async ({ page, request }) => {
  const node = await createTask(request, 'Guarded');
  await page.goto('/');
  // Wait for at least one node to render before attempting selection
  await page.waitForFunction(()=> document.querySelectorAll('.react-flow__node').length > 0, undefined, { timeout: 5000 });
  // Wait for test hook
  const hookAvailable = await page.waitForFunction(()=> typeof (window as any).__selectNode === 'function', undefined, { timeout: 3000 }).catch(()=> null);
  if(hookAvailable){
    await page.evaluate((id)=> (window as any).__selectNode(id), node.id);
  } else {
    // Fallback: click node element by text label
    const nodeEl = page.locator('.react-flow__node', { hasText: 'Guarded' }).first();
    await nodeEl.click();
  }
  // Wait for prop input
  const titleWrapper = page.getByTestId('prop-title');
  await expect(titleWrapper).toBeVisible();
  const titleInput = page.getByTestId('prop-title-field');
  await expect(titleInput).toHaveValue('Guarded Title');
  // Focus and press Delete
  await titleInput.click();
  await page.keyboard.press('Delete');
  // Node should still exist on canvas
  const canvasNode = page.locator('.react-flow__node', { hasText: 'Guarded' }).first();
  await expect(canvasNode).toBeVisible();
  // Change value to ensure input still interactive
  await titleInput.fill('Guarded Title X');
  await expect(titleInput).toHaveValue('Guarded Title X');
});
