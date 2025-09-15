import { ensureTempSchema } from '../helpers/schemaHelper';

/**
 * Global schema seeding for common node types used across most tests.
 * Intentionally exported (not auto-invoked) so caller controls timing without top-level await.
 */
export async function seedGlobalSchemas(){
  if((globalThis as any).__schemasSeeded) return;
  (globalThis as any).__schemasSeeded = true;
  if(!process.env.REPO_ROOT){
    process.env.REPO_ROOT = process.cwd();
  }
  await ensureTempSchema({ typeName: 'Task' });
  await ensureTempSchema({ typeName: 'Group', extraProps: { properties: { ports: { type: 'object', properties: { inputs: { type:'array', items:{ type:'string'} }, outputs: { type:'array', items:{ type:'string'} } }, required:['inputs','outputs'] } }, required: ['id','type','name','ports'] } });
  for(const t of ['Plan','LLM','ToolCall','Router','Merge','Code','GitHubInput','GitHubOutput','Eval']){
    await ensureTempSchema({ typeName: t });
  }
}
