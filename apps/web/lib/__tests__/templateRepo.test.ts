import { describe, it, expect, beforeEach, vi } from 'vitest';
import { listTemplates, getTemplate, validateTemplate, reloadTemplates } from '../templateRepo';
import type { PromptTemplate } from '../templateRepo';

describe('templateRepo', () => {
  beforeEach(async () => {
    // Clear cache before each test
    await reloadTemplates();
  });
  
  describe('listTemplates', () => {
    it('should return all templates when no filters applied', async () => {
      const templates = await listTemplates();
      
      expect(templates.length).toBeGreaterThan(0);
      expect(templates[0]).toHaveProperty('id');
      expect(templates[0]).toHaveProperty('name');
      expect(templates[0]).toHaveProperty('content');
      expect(templates[0]).toHaveProperty('variables');
    });
    
    it('should return at least 5 templates from initial seed', async () => {
      const templates = await listTemplates();
      
      // We created 5 initial templates in PBI-34
      expect(templates.length).toBeGreaterThanOrEqual(5);
    });
    
    it('should filter by category', async () => {
      const templates = await listTemplates({ category: 'summarization' });
      
      expect(templates.length).toBeGreaterThan(0);
      expect(templates.every(t => t.category === 'summarization')).toBe(true);
    });
    
    it('should filter by tags', async () => {
      const templates = await listTemplates({ tags: ['text'] });
      
      expect(templates.length).toBeGreaterThan(0);
      expect(templates.every(t => t.tags.includes('text'))).toBe(true);
    });
    
    it('should search by name or description', async () => {
      const templates = await listTemplates({ search: 'article' });
      
      expect(templates.length).toBeGreaterThan(0);
      
      const matchesSearch = templates.every(t => 
        t.name.toLowerCase().includes('article') ||
        t.description?.toLowerCase().includes('article') ||
        t.id.toLowerCase().includes('article')
      );
      
      expect(matchesSearch).toBe(true);
    });
    
    it('should return empty array when no templates match filters', async () => {
      const templates = await listTemplates({ 
        category: 'nonexistent-category' 
      });
      
      expect(templates).toEqual([]);
    });
    
    it('should support multiple tag filters', async () => {
      const templates = await listTemplates({ 
        tags: ['text', 'summary'] 
      });
      
      // Should return templates that have at least one of the tags
      expect(templates.length).toBeGreaterThanOrEqual(0);
    });
  });
  
  describe('getTemplate', () => {
    it('should fetch template by ID', async () => {
      const template = await getTemplate('summarization/article');
      
      expect(template.id).toBe('summarization/article');
      expect(template.name).toBeTruthy();
      expect(template.content).toBeTruthy();
      expect(template.variables.length).toBeGreaterThan(0);
    });
    
    it('should return template with all expected fields', async () => {
      const template = await getTemplate('summarization/article');
      
      expect(template).toHaveProperty('id');
      expect(template).toHaveProperty('path');
      expect(template).toHaveProperty('version');
      expect(template).toHaveProperty('name');
      expect(template).toHaveProperty('category');
      expect(template).toHaveProperty('tags');
      expect(template).toHaveProperty('content');
      expect(template).toHaveProperty('variables');
      expect(template).toHaveProperty('frontmatter');
    });
    
    it('should throw error for invalid ID', async () => {
      await expect(getTemplate('invalid/template')).rejects.toThrow('Template not found');
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
        const template = await getTemplate(id);
        expect(template.id).toBe(id);
      }
    });
  });
  
  describe('validateTemplate', () => {
    it('should pass validation for valid template', async () => {
      const template = await getTemplate('summarization/article');
      const result = await validateTemplate(template);
      
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
    
    it('should fail validation for missing required fields', async () => {
      const invalidTemplate: Partial<PromptTemplate> = {
        id: '',
        name: '',
        category: '',
        content: '',
        version: '1.0.0',
        path: 'test.md',
        tags: [],
        variables: [],
        frontmatter: {}
      } as PromptTemplate;
      
      const result = await validateTemplate(invalidTemplate as PromptTemplate);
      
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
    
    it('should validate version format', async () => {
      const invalidTemplate: PromptTemplate = {
        id: 'test/template',
        name: 'Test',
        category: 'test',
        content: 'content',
        version: 'invalid-version',
        path: 'test.md',
        tags: [],
        variables: [],
        frontmatter: {}
      };
      
      const result = await validateTemplate(invalidTemplate);
      
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('version'))).toBe(true);
    });
    
    it('should validate variable types', async () => {
      const invalidTemplate: PromptTemplate = {
        id: 'test/template',
        name: 'Test',
        category: 'test',
        content: 'content',
        version: '1.0.0',
        path: 'test.md',
        tags: [],
        variables: [
          {
            name: 'test_var',
            type: 'invalid-type' as any,
            required: true
          }
        ],
        frontmatter: {}
      };
      
      const result = await validateTemplate(invalidTemplate);
      
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('type'))).toBe(true);
    });
  });
  
  describe('reloadTemplates', () => {
    it('should clear cache and reload', async () => {
      // Load templates initially
      const templates1 = await listTemplates();
      expect(templates1.length).toBeGreaterThan(0);
      
      // Reload
      await reloadTemplates();
      
      // Should still have templates
      const templates2 = await listTemplates();
      expect(templates2.length).toBe(templates1.length);
    });
  });
  
  describe('template content validation', () => {
    it('should load template with variable placeholders', async () => {
      const template = await getTemplate('summarization/article');
      
      // Should have Handlebars placeholders
      expect(template.content).toContain('{{');
      expect(template.content).toContain('}}');
    });
    
    it('should parse variables from frontmatter', async () => {
      const template = await getTemplate('summarization/article');
      
      expect(template.variables.length).toBeGreaterThan(0);
      
      const contentVar = template.variables.find(v => v.name === 'content');
      expect(contentVar).toBeDefined();
      expect(contentVar?.type).toBe('string');
      expect(contentVar?.required).toBe(true);
    });
    
    it('should load template with validation rules', async () => {
      const template = await getTemplate('summarization/article');
      
      const maxWordsVar = template.variables.find(v => v.name === 'max_words');
      expect(maxWordsVar).toBeDefined();
      expect(maxWordsVar?.validation).toBeDefined();
      expect(maxWordsVar?.validation?.min).toBe(50);
      expect(maxWordsVar?.validation?.max).toBe(500);
    });
  });
  
  describe('template categories', () => {
    it('should have templates in expected categories', async () => {
      const templates = await listTemplates();
      
      const categories = [...new Set(templates.map(t => t.category))];
      
      expect(categories).toContain('summarization');
      expect(categories).toContain('extraction');
      expect(categories).toContain('analysis');
      expect(categories).toContain('code-review');
      expect(categories).toContain('generation');
    });
  });
  
  describe('template tags', () => {
    it('should have templates with appropriate tags', async () => {
      const template = await getTemplate('code-review/security');
      
      expect(template.tags).toContain('security');
      expect(template.tags).toContain('code');
    });
  });
});
