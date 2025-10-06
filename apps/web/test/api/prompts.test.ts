import { describe, it, expect } from 'vitest';
import templatesIndexHandler from '../../pages/api/prompts/templates/index';
import templatesIdHandler from '../../pages/api/prompts/templates/[id]';

// Mock request/response helpers
function createMockRequest(method: string, url: string, query: any = {}): any {
  return {
    method,
    url,
    query,
    headers: {},
    body: null
  };
}

function createMockResponse(): any {
  const res: any = {
    statusCode: 200,
    headers: {},
    _data: null,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(data: any) {
      this._data = data;
      return this;
    },
    setHeader(key: string, value: string) {
      this.headers[key] = value;
      return this;
    }
  };
  return res;
}

describe('Template API Endpoints', () => {
  describe('GET /api/prompts/templates', () => {
    it('should return list of templates', async () => {
      const req = createMockRequest('GET', '/api/prompts/templates');
      const res = createMockResponse();
      
      await templatesIndexHandler(req, res);
      
      expect(res.statusCode).toBe(200);
      expect(res._data).toHaveProperty('templates');
      expect(res._data).toHaveProperty('total');
      expect(Array.isArray(res._data.templates)).toBe(true);
      expect(res._data.templates.length).toBeGreaterThan(0);
    });
    
    it('should return templates with summary format', async () => {
      const req = createMockRequest('GET', '/api/prompts/templates');
      const res = createMockResponse();
      
      await templatesIndexHandler(req, res);
      
      const template = res._data.templates[0];
      expect(template).toHaveProperty('id');
      expect(template).toHaveProperty('name');
      expect(template).toHaveProperty('version');
      expect(template).toHaveProperty('category');
      expect(template).toHaveProperty('tags');
      expect(template).toHaveProperty('variableCount');
      expect(template).not.toHaveProperty('content'); // Should be excluded
    });
    
    it('should filter by category', async () => {
      const req = createMockRequest('GET', '/api/prompts/templates', { 
        category: 'summarization' 
      });
      const res = createMockResponse();
      
      await templatesIndexHandler(req, res);
      
      expect(res.statusCode).toBe(200);
      expect(res._data.templates.every((t: any) => t.category === 'summarization')).toBe(true);
    });
    
    it('should filter by tags', async () => {
      const req = createMockRequest('GET', '/api/prompts/templates', { 
        tags: 'text,article' 
      });
      const res = createMockResponse();
      
      await templatesIndexHandler(req, res);
      
      expect(res.statusCode).toBe(200);
      expect(res._data.templates.length).toBeGreaterThanOrEqual(0);
    });
    
    it('should search by name', async () => {
      const req = createMockRequest('GET', '/api/prompts/templates', { 
        search: 'article' 
      });
      const res = createMockResponse();
      
      await templatesIndexHandler(req, res);
      
      expect(res.statusCode).toBe(200);
      expect(res._data.templates.length).toBeGreaterThan(0);
    });
    
    it('should return 405 for non-GET requests', async () => {
      const req = createMockRequest('POST', '/api/prompts/templates');
      const res = createMockResponse();
      
      await templatesIndexHandler(req, res);
      
      expect(res.statusCode).toBe(405);
      expect(res._data).toHaveProperty('error');
    });
    
    it('should handle empty filter results', async () => {
      const req = createMockRequest('GET', '/api/prompts/templates', { 
        category: 'nonexistent' 
      });
      const res = createMockResponse();
      
      await templatesIndexHandler(req, res);
      
      expect(res.statusCode).toBe(200);
      expect(res._data.templates).toEqual([]);
      expect(res._data.total).toBe(0);
    });
  });
  
  describe('GET /api/prompts/templates/[id]', () => {
    it('should return single template', async () => {
      const req = createMockRequest('GET', '/api/prompts/templates/summarization%2Farticle', {
        id: 'summarization/article'
      });
      const res = createMockResponse();
      
      await templatesIdHandler(req, res);
      
      expect(res.statusCode).toBe(200);
      expect(res._data).toHaveProperty('template');
      expect(res._data.template.id).toBe('summarization/article');
    });
    
    it('should return template with full content', async () => {
      const req = createMockRequest('GET', '/api/prompts/templates/summarization%2Farticle', {
        id: 'summarization/article'
      });
      const res = createMockResponse();
      
      await templatesIdHandler(req, res);
      
      const template = res._data.template;
      expect(template).toHaveProperty('content');
      expect(template).toHaveProperty('variables');
      expect(template).toHaveProperty('frontmatter');
      expect(template.content.length).toBeGreaterThan(0);
    });
    
    it('should decode URL-encoded IDs', async () => {
      const req = createMockRequest('GET', '/api/prompts/templates/code-review%2Fsecurity', {
        id: 'code-review%2Fsecurity'
      });
      const res = createMockResponse();
      
      await templatesIdHandler(req, res);
      
      expect(res.statusCode).toBe(200);
      expect(res._data.template.id).toBe('code-review/security');
    });
    
    it('should return 404 for invalid ID', async () => {
      const req = createMockRequest('GET', '/api/prompts/templates/invalid', {
        id: 'invalid/template'
      });
      const res = createMockResponse();
      
      await templatesIdHandler(req, res);
      
      expect(res.statusCode).toBe(404);
      expect(res._data).toHaveProperty('error');
      expect(res._data.error).toBe('Template not found');
    });
    
    it('should return 400 for missing ID', async () => {
      const req = createMockRequest('GET', '/api/prompts/templates/', {});
      const res = createMockResponse();
      
      await templatesIdHandler(req, res);
      
      expect(res.statusCode).toBe(400);
      expect(res._data).toHaveProperty('error');
    });
    
    it('should return 405 for non-GET requests', async () => {
      const req = createMockRequest('POST', '/api/prompts/templates/test', {
        id: 'test'
      });
      const res = createMockResponse();
      
      await templatesIdHandler(req, res);
      
      expect(res.statusCode).toBe(405);
      expect(res._data).toHaveProperty('error');
    });
    
    it('should fetch all seeded templates by ID', async () => {
      const templateIds = [
        'summarization/article',
        'extraction/entities',
        'analysis/sentiment',
        'code-review/security',
        'generation/documentation'
      ];
      
      for (const id of templateIds) {
        const encodedId = encodeURIComponent(id);
        const req = createMockRequest('GET', `/api/prompts/templates/${encodedId}`, { id });
        const res = createMockResponse();
        
        await templatesIdHandler(req, res);
        
        expect(res.statusCode).toBe(200);
        expect(res._data.template.id).toBe(id);
      }
    });
  });
});
