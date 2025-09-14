// Prepares a clean ephemeral repository root for Playwright E2E tests BEFORE the Next.js dev server starts.
// This must run in the app/web working directory.
// Responsibilities:
// 1. Remove any existing .e2e-root directory
// 2. Recreate directory structure
// 3. Copy node schema files so validation works inside isolated root
// 4. Write a marker for diagnostics
// NOTE: REPO_ROOT is NOT set here; Playwright webServer.command sets it immediately after this script runs.

const fs = require('fs').promises;
const path = require('path');

async function main() {
  const root = path.resolve(process.cwd(), '.e2e-root');
  // Start fresh
  await fs.rm(root, { recursive: true, force: true }).catch(() => {});
  await fs.mkdir(root, { recursive: true });

  // Prepare schemas inside isolated root so schema loader can find them relative to REPO_ROOT if needed.
  const destSchemasDir = path.join(root, 'schemas', 'nodes');
  await fs.mkdir(destSchemasDir, { recursive: true });
  const candidateSources = [
    path.resolve(process.cwd(), 'schemas', 'nodes'),
    path.resolve(process.cwd(), '..', '..', 'schemas', 'nodes')
  ];
  for (const src of candidateSources) {
    try {
      const st = await fs.stat(src).catch(() => null);
      if (!st || !st.isDirectory()) continue;
      const files = await fs.readdir(src);
      for (const f of files) {
        if (!f.endsWith('.schema.json')) continue;
        await fs.copyFile(path.join(src, f), path.join(destSchemasDir, f));
      }
    } catch (e) {
      // non-fatal
    }
  }

  await fs.writeFile(path.join(root, 'PREPARED'), new Date().toISOString(), 'utf8');
  console.log(`[prepare-e2e] Clean root prepared at ${root}`);
}

main().catch(err => {
  console.error('[prepare-e2e] FAILED', err);
  process.exit(1);
});
