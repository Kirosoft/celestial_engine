import { promises as fs } from 'fs';
import { join, relative } from 'path';
import matter from 'gray-matter';

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

// Template cache (in-memory)
let templateCache: Map<string, PromptTemplate> | null = null;

/**
 * Get the root directory for the repository (workspace root)
 */
function getRepoRoot(): string {
  // Check for REPO_ROOT environment variable (used in tests)
  if (process.env.REPO_ROOT) {
    return process.env.REPO_ROOT;
  }
  // Navigate up from apps/web to workspace root
  return join(process.cwd(), '..', '..');
}

/**
 * List all templates with optional filtering
 */
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
      t.description?.toLowerCase().includes(search) ||
      t.id.toLowerCase().includes(search)
    );
  }
  
  return templates;
}

/**
 * Get a single template by ID
 */
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

/**
 * Validate a template structure
 */
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
  for (const variable of template.variables || []) {
    if (!variable.name) {
      errors.push('Variable missing name');
    }
    if (!['string', 'number', 'boolean', 'array', 'object'].includes(variable.type)) {
      errors.push(`Invalid variable type: ${variable.type}`);
    }
  }
  
  return { valid: errors.length === 0, errors };
}

/**
 * Reload templates from disk (clears cache)
 */
export async function reloadTemplates(): Promise<void> {
  templateCache = null;
  await loadTemplatesFromDisk();
}

/**
 * Load all templates from the prompts/ directory
 */
async function loadTemplatesFromDisk(): Promise<void> {
  templateCache = new Map();
  
  const repoRoot = getRepoRoot();
  const promptsDir = join(repoRoot, 'prompts');
  
  try {
    // Check if prompts directory exists
    await fs.access(promptsDir);
  } catch (error) {
    console.warn('[templateRepo] Prompts directory not found:', promptsDir);
    return;
  }
  
  // Find all .md files recursively
  const templateFiles = await findTemplateFiles(promptsDir);
  
  for (const filePath of templateFiles) {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const { data: frontmatter, content: body } = matter(content);
      
      // Derive ID from path if not in frontmatter
      const relativePath = relative(promptsDir, filePath);
      const derivedId = deriveIdFromPath(relativePath);
      
      const template: PromptTemplate = {
        id: frontmatter.id || derivedId,
        path: relativePath,
        version: frontmatter.version || '1.0.0',
        name: frontmatter.name || frontmatter.id || derivedId,
        description: frontmatter.description,
        category: frontmatter.category || 'uncategorized',
        tags: frontmatter.tags || [],
        content: body.trim(),
        variables: frontmatter.variables || [],
        examples: frontmatter.examples,
        frontmatter
      };
      
      // Validate before adding to cache
      const validation = await validateTemplate(template);
      if (!validation.valid) {
        console.warn(`[templateRepo] Invalid template ${filePath}:`, validation.errors);
        continue;
      }
      
      templateCache.set(template.id, template);
    } catch (error) {
      console.warn(`[templateRepo] Failed to load template: ${filePath}`, error);
    }
  }
  
  console.log(`[templateRepo] Loaded ${templateCache.size} templates`);
}

/**
 * Recursively find all .md files in a directory
 */
async function findTemplateFiles(dir: string): Promise<string[]> {
  const files: string[] = [];
  
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = join(dir, entry.name);
      
      if (entry.isDirectory()) {
        // Skip user and shared directories for now (empty)
        if (entry.name === 'user' || entry.name === 'shared') {
          continue;
        }
        // Recursively search subdirectories
        const subFiles = await findTemplateFiles(fullPath);
        files.push(...subFiles);
      } else if (entry.isFile() && entry.name.endsWith('.md')) {
        files.push(fullPath);
      }
    }
  } catch (error) {
    console.warn(`[templateRepo] Failed to read directory: ${dir}`, error);
  }
  
  return files;
}

/**
 * Derive template ID from file path
 * Example: "library/summarization/article.md" -> "summarization/article"
 */
function deriveIdFromPath(relativePath: string): string {
  return relativePath
    .replace(/^library\//, '') // Remove library/ prefix
    .replace(/^user\//, '')    // Remove user/ prefix
    .replace(/^shared\//, '')  // Remove shared/ prefix
    .replace(/\.md$/, '');      // Remove .md extension
}
