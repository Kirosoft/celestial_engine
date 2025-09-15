import { test, expect } from '@playwright/test';
import { resetRepoRoot, waitForStableVisible } from './helpers';

async function createGroup(request: any, name: string){
  const res = await request.post('/api/groups', { data: { name, inputs:['in'], outputs:['out'] } });
  const json = await res.json();
  return json.group;
}
async function createTaskInGroup(request: any, groupId: string, name: string){
  const res = await request.post(`/api/groups/${groupId}/nodes`, { data: { type: 'Task', name, props: { title: name+ ' Title' } } });
  if(res.status() !== 201){
    const body = await res.text();
    throw new Error('createTaskInGroup failed status='+res.status()+ ' body='+body);
  }
  return (await res.json()).node;
}

// Helper to enter a group via UI by clicking its Expand button
async function enterGroupUI(page: any, idOrName: string){
  // Fire a manual refresh in case initial load race prevents immediate rendering
  await page.evaluate(()=>{ window.dispatchEvent(new Event('graph:refresh-request')); });
  // Wait for at least one node to appear to ensure React Flow mounted
  try {
    await page.waitForSelector('.react-flow__node', { timeout: 5000 });
  } catch {/* ignore */}
  // Retry loop: wait for either id or name appearing on a node, then click its Expand button
  const deadline = Date.now() + 8000;
  let clicked = false;
  while(Date.now() < deadline && !clicked){
    const btn = page.locator(`.react-flow__node:has-text("${idOrName}") button:has-text("Expand")`).first();
    if(await btn.count()){
      try { await btn.click(); clicked = true; break; } catch { /* retry */ }
    }
    // Fallback: enumerate all Expand buttons and inspect their parent node text content
    const allExpand = page.locator('.react-flow__node button:has-text("Expand")');
    const count = await allExpand.count();
    for(let i=0;i<count && !clicked;i++){
      const b = allExpand.nth(i);
      try {
        const parentText = await b.locator('..').innerText();
        if(parentText.includes(idOrName)){
          try { await b.click(); clicked = true; break; } catch { /* retry */ }
        }
      } catch {/* ignore */}
    }
    await page.waitForTimeout(250);
  }
  if(!clicked) throw new Error('Expand button not found for group '+idOrName);
  await page.waitForTimeout(260);
}

// Drag helper connecting bottom handle of source to top handle of target
async function connect(page: any, sourceLabel: string, targetLabel: string){
  // Ensure both source & target labels are present before attempting drag
  await waitForNodeLabel(page, sourceLabel);
  await waitForNodeLabel(page, targetLabel);
  const sourceNode = page.locator(`.react-flow__node:has-text("${sourceLabel}")`).first();
  const targetNode = page.locator(`.react-flow__node:has-text("${targetLabel}")`).first();
  await waitForStableVisible(sourceNode);
  await waitForStableVisible(targetNode);
  const sourceBox = await sourceNode.boundingBox();
  const targetBox = await targetNode.boundingBox();
  if(!sourceBox || !targetBox) throw new Error('Missing node boxes');
  // Source handle at bottom center, target handle at top center
  await page.mouse.move(sourceBox.x + sourceBox.width/2, sourceBox.y + sourceBox.height - 4);
  await page.mouse.down();
  await page.mouse.move(targetBox.x + targetBox.width/2, targetBox.y + 4, { steps: 10 });
  await page.mouse.up();
}

// Wait until subgroup edges API reports expected length
async function waitForSubgraphEdgeCount(request: any, groupId: string, expected: number, timeoutMs = 4000){
  const deadline = Date.now() + timeoutMs;
  while(Date.now() < deadline){
    const res = await request.get(`/api/groups/${groupId}/subgraph`);
    const sg = await res.json();
    const count = (sg.edges || []).length;
    if(count === expected) return sg.edges;
    await new Promise(r=>setTimeout(r, 150));
  }
  const final = await (await request.get(`/api/groups/${groupId}/subgraph`)).json();
  throw new Error(`Timed out waiting for edge count=${expected}, last=${(final.edges||[]).length}`);
}

// Select the first edge on the canvas. React Flow wraps edges in a <g>; the <g> can report not visible
// due to zero bounding box, so click the underlying path instead. Retry until success.
async function selectFirstEdge(page: any){
  const deadline = Date.now() + 5000;
  while(Date.now() < deadline){
    const pathLoc = page.locator('.react-flow__edge path').first();
    if(await pathLoc.count()){
      try {
        await pathLoc.click({ force: true });
        return;
      } catch {/* retry */}
    }
    await page.waitForTimeout(120);
  }
  throw new Error('Failed to click first edge path');
}

// Change edge kind via inspector dropdown
async function changeEdgeKind(page: any, to: string){
  const select = page.locator('select:has(option[value="flow"])').last();
  await select.selectOption(to);
}

// Press Delete key
async function pressDelete(page: any){
  await page.keyboard.press('Delete');
}

// Wait for a node whose label text contains provided label
async function waitForNodeLabel(page: any, label: string){
  const deadline = Date.now() + 10000;
  while(Date.now() < deadline){
    const count = await page.locator(`.react-flow__node:has-text("${label}")`).count();
    if(count > 0){
      // minor settle delay
      await page.waitForTimeout(60);
      return;
    }
    await page.waitForTimeout(200);
  }
  throw new Error('Node label not found: '+label);
}

// Extract edges from subgraph API
async function listSubgraphEdges(request: any, groupId: string){
  const res = await request.get(`/api/groups/${groupId}/subgraph`);
  const sg = await res.json();
  return sg.edges || [];
}

 test.beforeEach(async()=>{ await resetRepoRoot(); });

test('subgroup edge create, update, cycle rejection, delete via Delete key', async ({ page, request }) => {
  // Create a group & two tasks inside via API for deterministic ids
  const group = await createGroup(request, 'GroupMain');
  // Force initial graph refresh before visiting page
  await page.goto('/');
  await page.evaluate(()=>{ window.dispatchEvent(new Event('graph:refresh-request')); });
  await createTaskInGroup(request, group.id, 'Alpha');
  let dbg1 = await request.get(`/api/groups/${group.id}/subgraph`); // debug: force read
  console.log('subgraph after Alpha', await dbg1.json());
  await createTaskInGroup(request, group.id, 'Beta');
  let dbg2 = await request.get(`/api/groups/${group.id}/subgraph`);
  console.log('subgraph after Beta', await dbg2.json());
  await createTaskInGroup(request, group.id, 'Gamma');
  let dbg3 = await request.get(`/api/groups/${group.id}/subgraph`);
  console.log('subgraph after Gamma', await dbg3.json());
  // Trigger refresh again to include new internal nodes on initial entry
  await page.evaluate(()=>{ window.dispatchEvent(new Event('graph:refresh-request')); });
  // Enter group
  // Use group.name because the canvas node label renders the name (prefers name over id when present)
  // Enter group via exposed helper for reliability
  await page.evaluate((id)=>{ (window as any).__enterGroup(id); }, group.id);
  await page.waitForTimeout(400);
  // Wait until internal task nodes appear (Alpha & Beta minimal)
  await waitForNodeLabel(page, 'Alpha');
  await waitForNodeLabel(page, 'Beta');
  // Create edge Alpha->Beta programmatically (fallback to avoid drag flakiness)
  // Dynamically resolve current task ids from subgraph (order may vary)
  const sg0 = await listSubgraphEdges(request, group.id); // edges before
  const subgraphData = await (await request.get(`/api/groups/${group.id}/subgraph`)).json();
  const taskIds: string[] = subgraphData.nodes.filter((n: any)=> n.type==='Task').map((n:any)=> n.id);
  // Expect at least 3 tasks
  expect(taskIds.length).toBeGreaterThanOrEqual(3);
  const alphaId = subgraphData.nodes.find((n:any)=>n.name==='Alpha').id;
  const betaId = subgraphData.nodes.find((n:any)=>n.name==='Beta').id;
  const gammaId = subgraphData.nodes.find((n:any)=>n.name==='Gamma').id;
  await page.evaluate(({a,b})=>{ window.dispatchEvent(new CustomEvent('graph:create-edge', { detail: { source: a, target: b, kind: 'flow' } })); }, { a: alphaId, b: betaId });
  // Poll API for persistence
  let edges = await waitForSubgraphEdgeCount(request, group.id, 1);
  const edgeId1 = edges[0].id;

  // Update edge kind through inspector
  // Select edge via global helper to avoid visibility flakiness
  await page.evaluate(({s,e})=>{ (window as any).__selectEdge(s,e); }, { s: alphaId, e: edgeId1 });
  await changeEdgeKind(page, 'data');
  const saveBtn = page.getByRole('button', { name: 'Save' }).last();
  await saveBtn.click();
  edges = await listSubgraphEdges(request, group.id);
  expect(edges[0].kind).toBe('data');

  // Add Beta->Gamma and attempt Gamma->Alpha (cycle)
  await page.evaluate(({b,g})=>{ window.dispatchEvent(new CustomEvent('graph:create-edge', { detail: { source: b, target: g, kind: 'flow' } })); }, { b: betaId, g: gammaId });
  edges = await waitForSubgraphEdgeCount(request, group.id, 2);
  // Attempt cycle (Gamma->Alpha)
  await page.evaluate(({g,a})=>{ window.dispatchEvent(new CustomEvent('graph:create-edge', { detail: { source: g, target: a, kind: 'flow' } })); }, { g: gammaId, a: alphaId });
  // Give backend brief time then ensure still 2
  await page.waitForTimeout(250);
  const afterCycleAttempt = await listSubgraphEdges(request, group.id);
  expect(afterCycleAttempt.length).toBe(2); // still 2, cycle rejected

  // Delete first edge via Delete key
  // Re-select (edge may re-render after kind update)
  await page.evaluate(({s,e})=>{ (window as any).__selectEdge(s,e); }, { s: alphaId, e: edgeId1 });
  await pressDelete(page);
  const afterDelete = await listSubgraphEdges(request, group.id);
  expect(afterDelete.length).toBe(1);
});
