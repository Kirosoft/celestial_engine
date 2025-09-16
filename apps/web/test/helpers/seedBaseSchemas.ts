import { ensureTempSchema } from './schemaHelper';
import { reloadSchemas } from '../../lib/schemaLoader';
import { promises as fs } from 'fs';
import { resolve } from 'path';

/**
 * Seed the base schemas (Task, Group, Plan, LLM, etc.) for the CURRENT REPO_ROOT exactly once.
 * Must be called only AFTER the test sets process.env.REPO_ROOT (if it needs a custom temp root).
 */
export async function seedBaseSchemasIfNeeded(){
  const root = process.env.REPO_ROOT || process.cwd();
  const marker = resolve(root, '.schema-seeded');
  const already = await fs.access(marker).then(()=>true).catch(()=>false);
  if(already){
    return reloadSchemas();
  }
  // Task + Group (Group gets ports structure added)
  await ensureTempSchema({ typeName: 'Task' });
  await ensureTempSchema({ typeName: 'Group', extraProps: { properties: { ports: { type: 'object', properties: { inputs: { type:'array', items:{ type:'string'} }, outputs: { type:'array', items:{ type:'string'} } }, required:['inputs','outputs'] } }, required: ['id','type','name','ports'] } });
  for(const t of ['Plan','LLM','ToolCall','Router','Merge','Code','GitHubInput','GitHubOutput','Eval','ChatNode']){
    await ensureTempSchema({ typeName: t });
  }
  await fs.writeFile(marker, '');
  await reloadSchemas();
}
