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
