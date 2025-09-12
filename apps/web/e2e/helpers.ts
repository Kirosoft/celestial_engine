import { promises as fs } from 'fs';
import { resolve, join } from 'path';

export async function resetRepoRoot(){
  const root = resolve(process.cwd(), '.e2e-root');
  await fs.mkdir(root, { recursive: true });
  // Clean nodes and index data (not schemas)
  const nodesDir = join(root, 'nodes');
  const indexDir = join(root, '.awb');
  const removeDirContents = async (dir: string) => {
    const exists = await fs.stat(dir).catch(()=>null);
    if(!exists) return;
    const items = await fs.readdir(dir);
    await Promise.all(items.map(async i => {
      const p = join(dir, i);
      const st = await fs.stat(p).catch(()=>null);
      if(!st) return;
      if(st.isDirectory()) await fs.rm(p, { recursive: true, force: true }); else await fs.unlink(p).catch(()=>{});
    }));
  };
  await removeDirContents(nodesDir);
  await removeDirContents(indexDir);
  // Copy schemas into ephemeral root so schemaLoader (which uses REPO_ROOT) can find them
  const candidateSchemaDirs = [
    resolve(process.cwd(), 'schemas', 'nodes'),            // apps/web/schemas/nodes
    resolve(process.cwd(), '..', '..', 'schemas', 'nodes') // repo root schemas/nodes
  ];
  // Only copy schemas if not already copied
  const dest = join(root, 'schemas', 'nodes');
  const already = await fs.stat(dest).catch(()=>null);
  for(const dir of candidateSchemaDirs){
    try {
      const stat = await fs.stat(dir).catch(()=>null);
      if(!stat || !stat.isDirectory()) continue;
      if(!already) await fs.mkdir(dest, { recursive: true });
      const entries = await fs.readdir(dir);
      for(const e of entries){
        if(!e.endsWith('.schema.json')) continue;
        const srcFile = join(dir, e);
        const destFile = join(dest, e);
        // If duplicate names appear, prefer first copied (skip overwrite)
        const exists = await fs.stat(destFile).catch(()=>null);
        if(!exists) await fs.copyFile(srcFile, destFile);
      }
    } catch(err){
      console.warn('[resetRepoRoot] schema copy failed for', dir, err);
    }
  }
  process.env.REPO_ROOT = root;
  return root;
}

export async function readJson(path: string){
  return JSON.parse(await fs.readFile(path, 'utf8'));
}
