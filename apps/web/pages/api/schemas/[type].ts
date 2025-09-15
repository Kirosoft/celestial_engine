import type { NextApiRequest, NextApiResponse } from 'next';
import { FileRepo } from '../../../lib/fileRepo';
import { sendError } from '../../../lib/apiErrors';

export default async function handler(req: NextApiRequest, res: NextApiResponse){
  const { type } = req.query;
  if(typeof type !== 'string') return res.status(400).json({ error: { message: 'type param required' }});
  try {
    // Primary lookup inside repo root (E2E copies schemas here)
    const relPath = `schemas/nodes/${type}.schema.json`;
    if(await FileRepo.exists(relPath)){
      const schema = await FileRepo.readJson<any>(relPath);
      return res.status(200).json({ schema });
    }
    // Fallback: project-relative (apps/web/schemas/nodes)
    const fallback = `apps/web/schemas/nodes/${type}.schema.json`;
    if(await FileRepo.exists(fallback)){
      const schema = await FileRepo.readJson<any>(fallback);
      return res.status(200).json({ schema });
    }
    return res.status(404).json({ error: { message: 'Schema not found' }});
  } catch(e){
    return sendError(res, e);
  }
}
