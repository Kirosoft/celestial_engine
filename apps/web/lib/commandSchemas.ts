import Ajv, { DefinedError, ValidateFunction } from 'ajv';
import addFormats from 'ajv-formats';
import { FileRepo } from './fileRepo';
import { ValidationError } from './errors';

interface LoadedSchema { id: string; title: string; validate: ValidateFunction };

let envelopeValidator: ValidateFunction | null = null;
const actionValidators: Record<string, LoadedSchema> = {};
let initialized = false;

async function init(){
  if(initialized) return;
  const ajv = new Ajv({ allErrors: true, strict: false });
  addFormats(ajv);
  // Load envelope first
  const envelopeFiles = await FileRepo.list('schemas/commands/command-envelope.schema.json');
  for(const f of envelopeFiles){
    const schema = await FileRepo.readJson<any>(f);
    envelopeValidator = ajv.compile(schema);
  }
  // Load action schemas
  const actionFiles = await FileRepo.list('schemas/commands/*_*.schema.json');
  for(const f of actionFiles){
    if(/command-envelope/.test(f)) continue;
    const schema = await FileRepo.readJson<any>(f);
    const validate = ajv.compile(schema);
    const title = schema.title || schema.$id || f;
    actionValidators[title] = { id: schema.$id || title, title, validate };
  }
  initialized = true;
}

export interface CommandEnvelope {
  id: string; ts: string; expected_version?: number; idempotency_key?: string; meta?: any; actions: any[];
}

export interface CommandValidationResult { valid: boolean; errors?: { path: string; message: string }[] };

export async function validateEnvelope(envelope: any): Promise<CommandValidationResult>{
  await init();
  if(!envelopeValidator) throw new Error('Envelope validator not initialized');
  const ok = envelopeValidator(envelope);
  if(!ok){
    const errs = (envelopeValidator.errors||[]).map(e=>({ path: e.instancePath || e.schemaPath, message: e.message||'invalid' }));
    return { valid: false, errors: errs };
  }
  const env = envelope as CommandEnvelope;
  if(!Array.isArray(env.actions)) return { valid: false, errors: [{ path: '/actions', message: 'actions must be array' }] };
  const actionErrors: { path: string; message: string }[] = [];
  for(let i=0;i<env.actions.length;i++){
    const act = env.actions[i];
    if(!act || typeof act.type !== 'string'){ actionErrors.push({ path: `/actions/${i}`, message: 'missing type' }); continue; }
    const validator = actionValidators[act.type];
    if(!validator){ actionErrors.push({ path: `/actions/${i}/type`, message: `unknown action type ${act.type}` }); continue; }
    const okAct = validator.validate(act);
    if(!okAct){
      for(const e of validator.validate.errors || []){
        actionErrors.push({ path: `/actions/${i}${e.instancePath}`, message: e.message || 'invalid' });
      }
    }
  }
  if(actionErrors.length) return { valid: false, errors: actionErrors };
  return { valid: true };
}

export async function assertValidEnvelope(envelope: any){
  const r = await validateEnvelope(envelope);
  if(!r.valid) throw new ValidationError(r.errors||[]);
}

export function listActionTypes(){ return Object.keys(actionValidators); }
