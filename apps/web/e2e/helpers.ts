import { request as playwrightRequest } from '@playwright/test';
import { promises as fs } from 'fs';

export async function resetRepoRoot(baseURL = 'http://localhost:3000'){
  const ctx = await playwrightRequest.newContext();
  const res = await ctx.post(baseURL + '/api/admin/reset');
  if(res.status() !== 200){
    const body = await res.text();
    throw new Error(`reset endpoint failed ${res.status()} body=${body}`);
  }
  await ctx.dispose();
}

export async function readJson(path: string){
  return JSON.parse(await fs.readFile(path, 'utf8'));
}

// Wait until a locator is visible and its bounding box stays the same across two consecutive checks.
// This helps with React Flow nodes that may re-render/relayout immediately after initial mount.
export async function waitForStableVisible(locator: any, attempts = 12, delay = 120){
  let lastBox: any = null;
  for(let i=0;i<attempts;i++){
    await locator.waitFor({ state: 'visible' });
    const handle = await locator.elementHandle();
    if(!handle){
      await new Promise(r=>setTimeout(r, delay));
      continue;
    }
    const box1 = await handle.boundingBox();
    await new Promise(r=>setTimeout(r, delay));
    const box2 = await handle.boundingBox();
    if(box1 && box2 && box1.x === box2.x && box1.y === box2.y && box1.width === box2.width && box1.height === box2.height){
      // Additionally ensure it did not get detached right after.
      await new Promise(r=>setTimeout(r, 40));
      const box3 = await handle.boundingBox();
      if(box3 && box3.x === box2.x && box3.y === box2.y){
        return;
      }
    }
    lastBox = box2 || box1 || lastBox;
  }
  throw new Error('Element not stable after attempts');
}

export async function clickWithRetries(locator: any, attempts = 8){
  for(let i=0;i<attempts;i++){
    try {
      await locator.click({ timeout: 1200 });
      return;
    } catch(err){
      // Try JS click if element handle exists
      const handle = await locator.elementHandle();
      if(handle){
        try {
          await handle.evaluate((el: any)=> (el as HTMLElement).click());
          return;
        } catch(_err){ /* ignore */ }
      }
      await new Promise(r=>setTimeout(r, 150 + i*50));
    }
  }
  throw new Error('Failed to click element after retries');
}

// Wait for at least one React Flow node to appear, optionally creating one via toolbox if none.
export async function ensureNodePresent(page: any){
  const nodeSelector = '.react-flow__node';
  const deadline = Date.now() + 25000; // 25s max
  let attemptedApi = false;
  while(Date.now() < deadline){
    // 1. Check DOM directly
    const domCount = await page.$$eval(nodeSelector, (els: any[]) => els.length).catch(()=>0);
    if(domCount > 0) return;

    // 2. Poll API for existing nodes
    let apiNodes: any[] = [];
    try {
      const apiRes = await page.request.get('/api/nodes');
      if(apiRes.ok()){
        const json = await apiRes.json();
        apiNodes = json.nodes || [];
      }
    } catch{ /* ignore */ }
    if(apiNodes.length > 0){
      // Force a refresh event to nudge canvas hook
      await page.evaluate(()=>{ window.dispatchEvent(new Event('graph:refresh-request')); });
      await page.waitForTimeout(400);
      const afterNudge = await page.$$eval(nodeSelector, (els: any[]) => els.length).catch(()=>0);
      if(afterNudge > 0) return;
    }

    // 3. If no nodes anywhere, attempt UI creation first
    const opener = page.getByTestId('open-toolbox');
    if(await opener.count()) await opener.click();
    const firstBtn = page.locator('[data-testid="toolbox"] button').first();
    if(await firstBtn.count()){
      try { await firstBtn.click(); } catch { /* ignore */ }
    } else if(!attemptedApi) {
      // 4. Fallback create via API once
      attemptedApi = true;
      try {
        const createRes = await page.request.post('/api/nodes', { data: { type: 'Task', name: 'Task', props: { title: 'Temp' } } });
        if(createRes.ok()){
          await page.evaluate(()=>{ window.dispatchEvent(new Event('graph:refresh-request')); });
        }
      } catch { /* ignore */ }
    }

    // 5. Wait for canvas readiness (window.__selectNode as signal) before looping again
    try {
      await page.waitForFunction(() => typeof (window as any).__selectNode === 'function', { timeout: 3000 });
    } catch { /* ignore readiness timeout */ }
    await page.waitForTimeout(350);
  }
  throw new Error('No node became available');
}
