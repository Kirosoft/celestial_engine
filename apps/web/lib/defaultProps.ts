export function buildDefaultProps(typeId: string, requiredPropKeys: string[]): Record<string, any>{
  const props: Record<string, any> = {};
  for(const k of requiredPropKeys){
    const lower = k.toLowerCase();
    if(lower.includes('title')) props[k] = `${typeId} Title`;
    else if(lower.includes('plannermodel') || lower.includes('planner')) props[k] = 'gpt-4';
    else if(lower === 'model' || lower.endsWith('model')) props[k] = 'gpt-4';
    else if(lower.includes('language')) props[k] = 'typescript';
    else if(lower.includes('source')) props[k] = '// TODO: implement';
    else props[k] = '';
  }
  return props;
}
