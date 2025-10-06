import type { NextApiRequest, NextApiResponse } from 'next';
import { getTemplate } from '../../../../lib/templateRepo';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  try {
    const { id } = req.query;
    
    if (!id || typeof id !== 'string') {
      return res.status(400).json({ 
        error: 'Missing or invalid template ID',
        message: 'Template ID is required and must be a string'
      });
    }
    
    // Decode URL-encoded ID (e.g., "summarization%2Farticle" -> "summarization/article")
    const decodedId = decodeURIComponent(id);
    
    // Fetch template
    const template = await getTemplate(decodedId);
    
    res.status(200).json({ template });
  } catch (error: any) {
    if (error.message.includes('not found')) {
      return res.status(404).json({
        error: 'Template not found',
        templateId: req.query.id,
        message: error.message
      });
    }
    
    console.error('[API /api/prompts/templates/[id]] Error:', error);
    res.status(500).json({
      error: 'Failed to fetch template',
      message: error.message
    });
  }
}
