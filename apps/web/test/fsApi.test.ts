import { describe, it, expect, beforeAll } from 'vitest';

// We can call the handler directly by importing the API route module
import handler from '../pages/api/fs';
import type { NextApiRequest, NextApiResponse } from 'next';
import { resolve } from 'path';

function createMockRes(){
  const res: any = {};
  res.statusCode = 200;
  res.headers = {};
  res.status = (c:number)=>{ res.statusCode = c; return res; };
  res.jsonData = undefined;
  res.json = (d:any)=>{ res.jsonData = d; return res; };
  return res as NextApiResponse;
}

function createMockReq(query: Record<string, any>): NextApiRequest{
  return { method: 'GET', query } as any;
}

describe('fs API route', () => {
  beforeAll(()=>{
    process.env.REPO_ROOT = resolve(process.cwd(), '../../');
  });

  it('lists root directory', async () => {
    const req = createMockReq({ path: '' });
    const res = createMockRes();
    await handler(req, res);
  expect(res.statusCode).toBe(200);
  const data: any = (res as any).jsonData;
  expect(data.entries).toBeInstanceOf(Array);
  expect(data.parent).toBe(null);
  });

  it('rejects path traversal outside root', async () => {
    const req = createMockReq({ path: '../' });
    const res = createMockRes();
    await handler(req, res);
  expect(res.statusCode).toBe(400);
  const data: any = (res as any).jsonData;
  expect(data?.error?.code).toMatch(/outside_root|invalid_path|path_outside_repo_root/);
  });
});
