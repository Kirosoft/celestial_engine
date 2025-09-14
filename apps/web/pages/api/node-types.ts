import type { NextApiRequest, NextApiResponse } from 'next';
import { FileRepo } from '../../lib/fileRepo';
import { sendError } from '../../lib/apiErrors';

interface NodeTypeMeta { id: string; title: string; description?: string; schemaId: string; requiredPropKeys: string[] }

export default async function handler(_req: NextApiRequest, res: NextApiResponse){
  try {
  const files = await FileRepo.list('schemas/nodes/*.schema.json');
    const out: NodeTypeMeta[] = [];
    for(const f of files){
      try {
        const schema = await FileRepo.readJson<any>(f);
        if(schema){
          const schemaId = schema.$id || '';
            // derive canonical type key preference order: title -> const type -> filename stem
          const fileStem = f.replace(/.*\/(.*?)\.schema\.json$/, '$1');
          const constType = (schema?.properties?.type?.const && typeof schema.properties.type.const === 'string') ? schema.properties.type.const : undefined;
          const title = schema.title || constType || fileStem;
          const id = title; // canonical key used for creation
          const requiredPropKeys: string[] = Array.isArray(schema?.properties?.props?.required) ? schema.properties.props.required.slice() : [];
          out.push({ id, title, description: schema.description, schemaId, requiredPropKeys });
        }
      } catch(e){
        console.warn('[node-types] failed to read schema', f, e);
      }
    }
    out.sort((a,b)=> a.title.localeCompare(b.title));
    res.status(200).json({ nodeTypes: out });
  } catch(e){
    return sendError(res, e);
  }
}
