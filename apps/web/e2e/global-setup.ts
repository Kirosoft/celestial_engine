import { FullConfig } from '@playwright/test';
import { promises as fs } from 'fs';
import { resolve, join } from 'path';

// Minimal global setup: ensure REPO_ROOT env visible to test workers (server already prepared by prepare-e2e script).
export default async function globalSetup(_config: FullConfig) {
  const root = resolve(process.cwd(), '.e2e-root');
  process.env.REPO_ROOT = root;
  await fs.mkdir(root, { recursive: true });
  await fs.writeFile(join(root, 'GLOBAL_SETUP_OK'), new Date().toISOString()).catch(()=>{});
}
