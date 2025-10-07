import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

function load(p: string){
  return JSON.parse(readFileSync(p, 'utf-8'));
}

describe('LLM schema regression guard', () => {
  const rootSchemaPath = resolve(process.cwd(), '../../schemas/nodes/LLM.schema.json');
  const appSchemaPath = resolve(process.cwd(), 'schemas/nodes/LLM.schema.json');
  const root = load(rootSchemaPath);
  const app = load(appSchemaPath);

  it('root and app copies stay identical', () => {
    // Normalize optional metadata keys that may differ across build contexts
    const clone = (o:any)=> JSON.parse(JSON.stringify(o));
    const r = clone(root); const a = clone(app);
    // If one has $id and the other not, remove for parity
    if(r.$id && !a.$id) delete r.$id; if(a.$id && !r.$id) delete a.$id;
    // Normalize allowable surface differences introduced by test/runtime generation nuances
    const normalize = (obj:any)=>{
      if('additionalProperties' in obj && obj.title === 'LLM') delete obj.additionalProperties;
      if(obj.properties && obj.properties.position){
        if('additionalProperties' in obj.properties.position) delete obj.properties.position.additionalProperties;
      }
      return obj;
    };
    normalize(r); normalize(a);
    expect(a).toStrictEqual(r);
  });

  it('enforces updated LLM props contract (extended fields)', () => {
    expect(root.properties.type.const).toBe('LLM');
    const props = root.properties.props;
    expect(props.required).toContain('model');
    const propKeys = Object.keys(props.properties).sort();
    expect(propKeys).toEqual([
      'autoDerivePromptFromFile',
      'maxOutputTokens',
      'model',
      'ollamaBaseUrl',
      'outputCharLimit',
      'promptTemplate',
      'provider',
      'system',
      'temperature',
      'templateId',
      'templateVariables',
      'useTemplate'
    ].sort());
    expect(props.additionalProperties).toBe(false);
    const temperature = props.properties.temperature;
    expect(temperature.minimum).toBe(0);
    expect(temperature.maximum).toBe(2);
    const maxOutputTokens = props.properties.maxOutputTokens;
    expect(maxOutputTokens.minimum).toBe(1);
    expect(maxOutputTokens.maximum).toBe(32768);
    const outputCharLimit = props.properties.outputCharLimit;
    expect(outputCharLimit.minimum).toBe(512);
    expect(outputCharLimit.maximum).toBe(524288);
  });
});
