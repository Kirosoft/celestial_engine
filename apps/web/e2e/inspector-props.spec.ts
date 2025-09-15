import { test, expect } from '@playwright/test';
import { resetRepoRoot, waitForStableVisible, clickWithRetries } from './helpers';

async function createTask(request: any, name: string){
  const res = await request.post('/api/nodes', { data: { type: 'Task', name, props: { title: name+' Title', description: 'Desc' } } });
  expect(res.ok()).toBeTruthy();
  return (await res.json()).node;
}

test.describe('Inspector props', () => {
  test.beforeEach(async () => { await resetRepoRoot(); });

  test('shows and edits node props', async ({ page, request }) => {
    const node = await createTask(request, 'TaskA');
    await page.goto('/');
    // Click node to select (React Flow selection via click)
    // Wait until exactly one node is rendered (our newly created TaskA)
    await expect(page.locator('.react-flow__node')).toHaveCount(1);
    const nodeEl = page.locator('.react-flow__node', { hasText: 'TaskA' }).first();
    await expect(nodeEl).toBeVisible();
      // Use injected test hook to select node programmatically (avoids flaky DOM clicks)
      await page.evaluate((id) => (window as any).__selectNode(id), node.id);
  const nameInput = page.getByTestId('inspector-name');
  await expect(nameInput).toHaveValue('TaskA');
  // Expect a prop label from schema such as title (use role=generic label locator)
  const titleLabel = page.getByTestId('prop-title').locator('label');
  await expect(titleLabel.first()).toHaveText(/title/i);
  const titleWrapper = page.getByTestId('prop-title');
  await expect(titleWrapper).toBeVisible();
  const titleInput = page.getByTestId('prop-title-field');
  await expect(titleInput).toHaveValue('TaskA Title');
    // Edit title prop
    await titleInput.fill('TaskA Title Updated');
    // Save
  const saveBtn = page.getByRole('button', { name: 'Save' });
  await expect(saveBtn).toBeEnabled();
    await saveBtn.click();
    // Wait for dirty state to clear
    await expect(saveBtn).toBeDisabled({ timeout: 3000 });
  });
});
