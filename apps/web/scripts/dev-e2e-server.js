// Wrapper to ensure environment variables are set before Next dev starts for Playwright E2E.
const { spawn } = require('child_process');
const path = require('path');

async function main(){
  // Run preparation script (cleans .e2e-root & copies schemas)
  await require('./prepare-e2e');
  process.env.E2E = '1';
  process.env.PW_TEST = '1';
  process.env.REPO_ROOT = '.e2e-root';
  console.log('[dev-e2e-server] Starting Next with E2E env:', {
    E2E: process.env.E2E, PW_TEST: process.env.PW_TEST, REPO_ROOT: process.env.REPO_ROOT
  });
  const nextBin = process.platform === 'win32'
    ? path.join(process.cwd(), 'node_modules', '.bin', 'next.cmd')
    : path.join(process.cwd(), 'node_modules', '.bin', 'next');
  const child = spawn(nextBin, ['dev'], {
    stdio: 'inherit',
    env: process.env,
    cwd: process.cwd()
  });
  child.on('exit', code => process.exit(code || 0));
  child.on('error', err => { console.error('[dev-e2e-server] spawn error', err); process.exit(1); });
}

main().catch(err => { console.error('[dev-e2e-server] failed', err); process.exit(1); });
