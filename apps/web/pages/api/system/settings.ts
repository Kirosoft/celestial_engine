import type { NextApiRequest, NextApiResponse } from 'next';
import { readSettings, writeSettings } from '../../../lib/systemSettingsRepo';

export default async function handler(req: NextApiRequest, res: NextApiResponse){
  try {
    if(req.method === 'GET'){
      const reveal = req.query.reveal === '1' || req.query.reveal === 'true';
      const settings = await readSettings({ reveal });
      return res.status(200).json({ settings });
    }
    if(req.method === 'PUT'){
      const body = req.body || {};
      // Prevent writing masked api key placeholder
      if(body?.llm && body.llm.apiKey === '***'){
        delete body.llm.apiKey;
      }
      const merged = await writeSettings(body);
      // Return masked by default
      const masked = { ...merged, llm: { ...merged.llm, apiKey: '***' } };
      return res.status(200).json({ settings: masked });
    }
    return res.status(405).json({ error: { code:'method_not_allowed' } });
  } catch(e: any){
    return res.status(500).json({ error: { code:'settings_error', message: e?.message || 'error' } });
  }
}