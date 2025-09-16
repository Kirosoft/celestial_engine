import type { NextApiRequest, NextApiResponse } from 'next';
import { SystemSettingsRepo, readSettings, writeSettings } from '../../lib/systemSettingsRepo';

// Simple API with masking for apiKey. No auth yet.

export default async function handler(req: NextApiRequest, res: NextApiResponse){
  try {
    if(req.method === 'GET'){
      const reveal = req.query.reveal === '1';
      const data = await readSettings({ reveal });
      return res.status(200).json(data);
    }
    if(req.method === 'PUT'){
      const body = req.body || {};
      try {
        const updated = await writeSettings(body);
        // Always return masked value unless explicit reveal=1 query
        const masked = await readSettings({ reveal: false });
        return res.status(200).json(masked);
      } catch(e: any){
        return res.status(400).json({ error: 'validation_error', message: e.message });
      }
    }
    res.setHeader('Allow', 'GET,PUT');
    return res.status(405).json({ error: 'method_not_allowed' });
  } catch(err: any){
    console.error('[api/system] error', err);
    return res.status(500).json({ error: 'internal_error' });
  }
}