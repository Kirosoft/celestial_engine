import type { NextApiRequest, NextApiResponse } from 'next';
import { listTemplates, type PromptTemplate } from '../../../../lib/templateRepo';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  try {
    const { category, tags, search } = req.query;
    
    // Build filters object
    const filters: any = {};
    
    if (category && typeof category === 'string') {
      filters.category = category;
    }
    
    if (tags && typeof tags === 'string') {
      filters.tags = tags.split(',').map(t => t.trim()).filter(Boolean);
    }
    
    if (search && typeof search === 'string') {
      filters.search = search;
    }
    
    // Fetch templates
    const templates = await listTemplates(filters);
    
    // Map to summary format (exclude content for list view)
    const summaries = templates.map((t: PromptTemplate) => ({
      id: t.id,
      name: t.name,
      version: t.version,
      category: t.category,
      tags: t.tags,
      description: t.description,
      variableCount: t.variables.length,
      path: t.path
    }));
    
    res.status(200).json({
      templates: summaries,
      total: summaries.length
    });
  } catch (error: any) {
    console.error('[API /api/prompts/templates] Error:', error);
    res.status(500).json({
      error: 'Failed to load templates',
      message: error.message
    });
  }
}
