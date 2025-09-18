import Ajv, { DefinedError } from 'ajv';
import addFormats from 'ajv-formats';
import { getNodeTypeSchema } from './schemaLoader';
import { ValidationError } from './errors';

const ajv = new Ajv({ allErrors: false, strict: false });
addFormats(ajv);

const compiled: Record<string, any> = {};

export function clearValidatorCache(){
  for(const k of Object.keys(compiled)) delete compiled[k];
}

async function ensureCompiled(type: string){
  if(!compiled[type]){
    const schema = await getNodeTypeSchema(type);
    console.log('[validator] compiling schema for', type);
    try {
      compiled[type] = ajv.compile(schema);
    } catch(err: any){
      if(err && /already exists/.test(String(err.message||err))){
        // Schema with same $id already registered; find it via getSchema
        if(schema.$id){
          const existing = ajv.getSchema(schema.$id);
          if(existing) compiled[type] = existing;
        }
        if(!compiled[type]) throw err; // rethrow if still missing
      } else throw err;
    }
  }
  return compiled[type];
}

export interface ValidationResult { valid: boolean; errors?: { path: string; message: string }[] }

export async function validateNode(node: any): Promise<ValidationResult>{
  if(!node || !node.type) throw new ValidationError([{ path: 'type', message: 'Missing node.type' }]);
  const validate = await ensureCompiled(node.type);
  console.log('[validateNode] validating node', node.id, 'type', node.type);
  const ok = validate(node);
  if(ok) return { valid: true };
  const errs = (validate.errors || []).map((e: DefinedError) => ({ path: e.instancePath || e.schemaPath, message: e.message || 'invalid' }));
  return { valid: false, errors: errs };
}

export async function assertValidNode(node: any){
  const r = await validateNode(node);
  if(!r.valid) throw new ValidationError(r.errors || []);
}
