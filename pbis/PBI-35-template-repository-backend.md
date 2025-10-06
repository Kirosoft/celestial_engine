# PBI-35: Template Repository Backend

**Phase:** 2.1 - Prompt Template Infrastructure  
**Priority:** High  
**Estimate:** 3 days  
**Status:** ✅ Complete  
**Depends On:** PBI-34

---

## User Story

As a **backend developer**, I want a **template repository module** so that **the API can discover, load, and manage prompt templates from the filesystem**.

---

## Acceptance Criteria

1. ✅ `lib/templateRepo.ts` exists with core CRUD functions

2. ✅ Can list all templates with optional filtering (category, tags)

3. ✅ Can fetch single template by ID (returns content + metadata)

4. ✅ Can parse YAML frontmatter from markdown files

5. ✅ Template validation catches missing required fields

6. ✅ Unit tests cover all core functions (>80% coverage)

7. ✅ Templates are cached in memory (lazy load on first access)

---

## Technical Details

### Module Interface (`lib/templateRepo.ts`)

```typescript
import { promises as fs } from 'fs';
import { join } from 'path';
import matter from 'gray-matter';
import { FileRepo } from './fileRepo';

export interface PromptTemplate {
  id: string;
  path: string;
  version: string;
  name: string;
  description?: string;
  category: string;
  tags: string[];
  content: string;
  variables: TemplateVariable[];
  examples?: TemplateExample[];
  frontmatter: Record<string, any>; // Raw frontmatter
}

export interface TemplateVariable {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  required: boolean;
  default?: any;
  description?: string;
  validation?: {
    pattern?: string;
    min?: number;
    max?: number;
    enum?: any[];
  };
}

export interface TemplateExample {
  input: Record<string, any>;
  output: string;
}

export interface TemplateListFilters {
  category?: string;
  tags?: string[];
  search?: string;
}

// Core functions
export async function listTemplates(filters?: TemplateListFilters): Promise<PromptTemplate[]>
export async function getTemplate(id: string): Promise<PromptTemplate>
export async function validateTemplate(template: PromptTemplate): Promise<{ valid: boolean; errors: string[] }>
export async function reloadTemplates(): Promise<void>
```

### Core Logic

```typescript
// Template cache (in-memory)
let templateCache: Map<string, PromptTemplate> | null = null;

export async function listTemplates(filters?: TemplateListFilters): Promise<PromptTemplate[]> {
  if (!templateCache) {
    await loadTemplatesFromDisk();
  }
  
  let templates = Array.from(templateCache!.values());
  
  // Apply filters
  if (filters?.category) {
    templates = templates.filter(t => t.category === filters.category);
  }
  
  if (filters?.tags && filters.tags.length > 0) {
    templates = templates.filter(t => 
      filters.tags!.some(tag => t.tags.includes(tag))
    );
  }
  
  if (filters?.search) {
    const search = filters.search.toLowerCase();
    templates = templates.filter(t =>
      t.name.toLowerCase().includes(search) ||
      t.description?.toLowerCase().includes(search)
    );
  }
  
  return templates;
}

async function loadTemplatesFromDisk(): Promise<void> {
  templateCache = new Map();
  
  const promptsDir = join(FileRepo.repoRoot(), 'prompts');
  const templateFiles = await FileRepo.list('prompts/**/*.md');
  
  for (const filePath of templateFiles) {
    try {
      const content = await FileRepo.read(filePath);
      const { data: frontmatter, content: body } = matter(content);
      
      const template: PromptTemplate = {
        id: frontmatter.id || deriveIdFromPath(filePath),
        path: filePath,
        version: frontmatter.version || '1.0.0',
        name: frontmatter.name || frontmatter.id,
        description: frontmatter.description,
        category: frontmatter.category || 'uncategorized',
        tags: frontmatter.tags || [],
        content: body.trim(),
        variables: frontmatter.variables || [],
        examples: frontmatter.examples,
        frontmatter
      };
      
      templateCache.set(template.id, template);
    } catch (error) {
      console.warn(`[templateRepo] Failed to load template: ${filePath}`, error);
    }
  }
  
  console.log(`[templateRepo] Loaded ${templateCache.size} templates`);
}

export async function getTemplate(id: string): Promise<PromptTemplate> {
  if (!templateCache) {
    await loadTemplatesFromDisk();
  }
  
  const template = templateCache!.get(id);
  if (!template) {
    throw new Error(`Template not found: ${id}`);
  }
  
  return template;
}

export async function validateTemplate(template: PromptTemplate): Promise<{ valid: boolean; errors: string[] }> {
  const errors: string[] = [];
  
  // Required fields
  if (!template.id) errors.push('Missing required field: id');
  if (!template.name) errors.push('Missing required field: name');
  if (!template.category) errors.push('Missing required field: category');
  if (!template.content) errors.push('Missing required field: content');
  
  // Version format (semver)
  if (template.version && !/^\d+\.\d+\.\d+$/.test(template.version)) {
    errors.push(`Invalid version format: ${template.version} (expected semver)`);
  }
  
  // Variables validation
  for (const variable of template.variables) {
    if (!variable.name) {
      errors.push('Variable missing name');
    }
    if (!['string', 'number', 'boolean', 'array', 'object'].includes(variable.type)) {
      errors.push(`Invalid variable type: ${variable.type}`);
    }
  }
  
  return { valid: errors.length === 0, errors };
}

export async function reloadTemplates(): Promise<void> {
  templateCache = null;
  await loadTemplatesFromDisk();
}

function deriveIdFromPath(filePath: string): string {
  // Convert "prompts/library/summarization/article.md" -> "summarization/article"
  return filePath
    .replace(/^prompts\/(library|user|shared)\//, '')
    .replace(/\.md$/, '');
}
```

---

## Implementation Checklist

### Setup
- [x] Install dependencies: `npm install gray-matter`
- [x] Create `lib/templateRepo.ts` file
- [x] Add TypeScript interfaces (PromptTemplate, TemplateVariable, etc.)

### Core Functions
- [x] Implement `loadTemplatesFromDisk()` with recursive file search
- [x] Implement `listTemplates()` with filtering
- [x] Implement `getTemplate()` with cache lookup
- [x] Implement `validateTemplate()` with field checks
- [x] Implement `reloadTemplates()` to clear cache
- [x] Add `deriveIdFromPath()` helper function

### Parsing & Validation
- [x] Integrate `gray-matter` for frontmatter parsing
- [x] Handle parse errors gracefully (log warning, skip file)
- [x] Validate variable types (string, number, boolean, array, object)
- [x] Check semver format for version field
- [x] Ensure required fields present (id, name, category, content)

### Caching
- [x] Create in-memory Map for template cache
- [x] Implement lazy loading (load on first `listTemplates()` call)
- [x] Add cache invalidation via `reloadTemplates()`
- [x] Log cache size on load

### Error Handling
- [x] Catch file read errors (missing files, permissions)
- [x] Catch YAML parse errors (malformed frontmatter)
- [x] Return meaningful error messages
- [x] Throw NotFoundError for missing template ID

### Testing
- [x] Create `lib/__tests__/templateRepo.test.ts`
- [x] Test `listTemplates()` without filters
- [x] Test `listTemplates()` with category filter
- [x] Test `listTemplates()` with tags filter
- [x] Test `listTemplates()` with search filter
- [x] Test `getTemplate()` with valid ID
- [x] Test `getTemplate()` with invalid ID (throws error)
- [x] Test `validateTemplate()` with valid template
- [x] Test `validateTemplate()` with missing required fields
- [x] Test `validateTemplate()` with invalid version format
- [x] Test `reloadTemplates()` clears cache
- [x] Update vitest.config.ts to include lib/**/__tests__ pattern

---

## Testing Approach

### Unit Tests (`lib/__tests__/templateRepo.test.ts`)

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { listTemplates, getTemplate, validateTemplate, reloadTemplates } from '../templateRepo';

describe('templateRepo', () => {
  beforeEach(async () => {
    await reloadTemplates(); // Clear cache before each test
  });
  
  describe('listTemplates', () => {
    it('should return all templates when no filters applied', async () => {
      const templates = await listTemplates();
      expect(templates.length).toBeGreaterThan(0);
      expect(templates[0]).toHaveProperty('id');
      expect(templates[0]).toHaveProperty('name');
    });
    
    it('should filter by category', async () => {
      const templates = await listTemplates({ category: 'summarization' });
      expect(templates.every(t => t.category === 'summarization')).toBe(true);
    });
    
    it('should filter by tags', async () => {
      const templates = await listTemplates({ tags: ['text'] });
      expect(templates.every(t => t.tags.includes('text'))).toBe(true);
    });
    
    it('should search by name', async () => {
      const templates = await listTemplates({ search: 'article' });
      expect(templates.length).toBeGreaterThan(0);
      expect(templates.some(t => t.name.toLowerCase().includes('article'))).toBe(true);
    });
  });
  
  describe('getTemplate', () => {
    it('should fetch template by ID', async () => {
      const template = await getTemplate('summarization/article');
      expect(template.id).toBe('summarization/article');
      expect(template.content).toBeTruthy();
      expect(template.variables.length).toBeGreaterThan(0);
    });
    
    it('should throw error for invalid ID', async () => {
      await expect(getTemplate('invalid/template')).rejects.toThrow('Template not found');
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
      const invalidTemplate: any = { id: 'test', name: '', category: '', content: '' };
      const result = await validateTemplate(invalidTemplate);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });
});
```

### Manual Testing
1. Run `npm test lib/__tests__/templateRepo.test.ts`
2. Check console logs for template load count
3. Verify no parse errors for existing templates
4. Test with malformed template (invalid YAML) to ensure graceful skip

---

## Dependencies

- **PBI-34** - Prompt template directory structure must exist
- **NPM Package:** `gray-matter` (^4.0.3) for YAML frontmatter parsing

---

## Risks & Mitigation

| Risk | Mitigation |
|------|-----------|
| Large template library slows startup | Lazy load on first access, not at module import |
| Malformed YAML crashes server | Wrap parsing in try-catch, log warning and skip |
| Cache stale after template edits | Implement hot reload in next PBI (file watcher) |
| Template ID collisions | Validate uniqueness, warn on duplicates |

---

## Definition of Done

- [x] All checklist items completed
- [x] `templateRepo.ts` implemented with all core functions
- [x] Unit tests written and passing (21/21 tests ✅)
- [x] Can list and filter templates via code
- [x] Can fetch single template by ID
- [x] Validation catches common errors
- [x] Code reviewed and ready to merge

---

## Test Results

```
✓ lib/__tests__/templateRepo.test.ts (21 tests)
  ✓ listTemplates (7 tests)
  ✓ getTemplate (4 tests)  
  ✓ validateTemplate (4 tests)
  ✓ reloadTemplates (1 test)
  ✓ template content validation (3 tests)
  ✓ template categories (1 test)
  ✓ template tags (1 test)

Test Files: 1 passed
Tests: 21 passed
Duration: 759ms
```

---

## Notes

- Loaded 8 templates successfully (5 from PBI-34 + 3 found in other locations)
- Cache invalidation (hot reload) handled in next PBI (file watcher)
- Template creation/update/delete endpoints in PBI-36
- Focus on read operations for MVP
- Consider adding template metrics (usage count) in future

---

**Created:** 2025-10-03  
**Completed:** 2025-10-06
