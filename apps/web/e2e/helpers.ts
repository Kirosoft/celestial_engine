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
