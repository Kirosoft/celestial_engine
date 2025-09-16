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
    expect(app).toStrictEqual(root);
  });

  it('enforces strict LLM props contract', () => {
    expect(root.properties.type.const).toBe('LLM');
    const props = root.properties.props;
    expect(props.required).toContain('model');
    const propKeys = Object.keys(props.properties).sort();
    expect(propKeys).toEqual(['maxOutputTokens','model','promptTemplate','system','temperature'].sort());
    expect(props.additionalProperties).toBe(false);
    const temperature = props.properties.temperature;
    expect(temperature.minimum).toBe(0);
    expect(temperature.maximum).toBe(2);
    const maxOutputTokens = props.properties.maxOutputTokens;
    expect(maxOutputTokens.minimum).toBe(1);
    expect(maxOutputTokens.maximum).toBe(8192);
  });
});
