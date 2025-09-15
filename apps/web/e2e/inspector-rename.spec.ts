import { test, expect } from '@playwright/test';
import { resetRepoRoot } from './helpers';

async function createTask(request: any, name: string){
  const res = await request.post('/api/nodes', { data: { type: 'Task', name, props: { title: name+' Title' } } });
  expect(res.ok()).toBeTruthy();
  return (await res.json()).node as { id: string; name: string };
}

test.beforeEach(async ()=> { await resetRepoRoot(); });

test('renaming node updates canvas label without refresh', async ({ page, request }) => {
  const node = await createTask(request, 'OrigName');
  await page.goto('/');
  // Wait for at least one node to appear
  await page.waitForFunction(()=> document.querySelectorAll('.react-flow__node').length > 0, undefined, { timeout: 5000 });
  // Programmatically select our node
  await page.evaluate((id)=> (window as any).__selectNode(id), node.id);
  // Ensure inspector shows original name
  const nameInput = page.getByTestId('inspector-name');
  await expect(nameInput).toHaveValue('OrigName');
  await expect(nameInput).toBeVisible();
  // Change name
  await nameInput.fill('NewName');
  // Save
  const saveBtn = page.getByRole('button', { name: 'Save' });
  await expect(saveBtn).toBeEnabled();
  await saveBtn.click();
  await expect(saveBtn).toBeDisabled({ timeout: 3000 });
  // Canvas label should update without navigation / reload
  const nodeLabel = page.locator('.react-flow__node', { hasText: 'NewName' }).first();
  await expect(nodeLabel).toBeVisible();
  // Ensure old label no longer present
  await expect(page.locator('.react-flow__node', { hasText: 'OrigName' })).toHaveCount(0);
});
