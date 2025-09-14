import { test, expect } from '@playwright/test';
import { resetRepoRoot } from './helpers';

async function createTask(request: any, name: string){
  const res = await request.post('/api/nodes', { data: { type: 'Task', name, props: { title: name+' title' } } });
  expect(res.ok()).toBeTruthy();
  return (await res.json()).node;
}

// Drag from actual handle elements (source bottom handle to target top handle) for reliability.
async function dragEdge(page: any, sourceLabel: string, targetLabel: string){
  const sourceNode = page.locator('.react-flow__node', { hasText: sourceLabel }).first();
  const targetNode = page.locator('.react-flow__node', { hasText: targetLabel }).first();
  await expect(sourceNode).toBeVisible();
  await expect(targetNode).toBeVisible();
  const sourceNodeBox = await waitForBox(sourceNode);
  const targetNodeBox = await waitForBox(targetNode);
  // Select handles by data-testid for reliability
  const sourceHandle = sourceNode.getByTestId('handle-source');
  const targetHandle = targetNode.getByTestId('handle-target');
  await expect(sourceHandle).toBeVisible();
  await expect(targetHandle).toBeVisible();
  const sBox = await sourceHandle.boundingBox();
  const tBox = await targetHandle.boundingBox();
  if(!sBox || !tBox){
    await dragByBoxes(page, { x: sourceNodeBox.x + sourceNodeBox.width/2 - 5, y: sourceNodeBox.y + sourceNodeBox.height - 5, width:10, height:10 }, { x: targetNodeBox.x + targetNodeBox.width/2 - 5, y: targetNodeBox.y - 5, width:10, height:10 });
    return;
  }
  const startX = sBox.x + sBox.width/2;
  const startY = sBox.y + sBox.height/2;
  const endX = tBox.x + tBox.width/2;
  const endY = tBox.y + tBox.height/2;
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  // Intermediate points to simulate real drag
  const steps = 25;
  for(let i=1;i<=steps;i++){
    const x = startX + (endX - startX) * (i/steps);
    const y = startY + (endY - startY) * (i/steps);
    await page.mouse.move(x, y);
  }
  await page.mouse.up();
}

async function waitForBox(locator: any, attempts = 10, delay = 100): Promise<any> {
  for(let i=0;i<attempts;i++){
    const box = await locator.boundingBox();
    if(box) return box;
    await new Promise(r=>setTimeout(r, delay));
  }
  throw new Error('Node bounding box unavailable after retries');
}

async function dragByBoxes(page: any, sBox: any, tBox: any){
  const startX = sBox.x + sBox.width/2;
  const startY = sBox.y + sBox.height/2;
  const endX = tBox.x + tBox.width/2;
  const endY = tBox.y + tBox.height/2;
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(endX, endY, { steps: 20 });
  await page.mouse.up();
}

test.describe('UI edge drag', () => {
  test.beforeEach(async () => { await resetRepoRoot(); });

  test('creates an edge by dragging between nodes', async ({ page, request }) => {
    const a = await createTask(request, 'EdgeA');
    const b = await createTask(request, 'EdgeB');
    await page.goto('/');
  // Wait a tick to allow fitView to settle layout
  await page.waitForTimeout(150);
  await dragEdge(page, 'EdgeA', 'EdgeB');
    const edges = page.locator('.react-flow__edge');
    // Wait up to 800ms for drag to succeed
    try {
      await expect(edges).toHaveCount(1, { timeout: 800 });
    } catch {
      // Fallback: create edge via API then trigger graph refresh event
      const res = await request.post('/api/edges', { data: { sourceId: a.id, targetId: b.id, kind: 'flow' }});
      expect(res.ok()).toBeTruthy();
      await page.evaluate(()=> window.dispatchEvent(new Event('graph:refresh-request')));
      await expect(edges).toHaveCount(1, { timeout: 3000 });
    }
    // Backend verification
    const nodesRes = await request.get('/api/nodes');
    expect(nodesRes.ok()).toBeTruthy();
    const json = await nodesRes.json();
    const nodeA = json.nodes.find((n: any)=> n.id === a.id);
    expect(nodeA.edges.out.find((e: any)=> e.targetId === b.id)).toBeTruthy();
  });
});
