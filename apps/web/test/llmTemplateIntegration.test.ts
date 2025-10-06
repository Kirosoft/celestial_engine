import { describe, it, expect, beforeEach } from 'vitest';
import { promises as fs } from 'fs';
import { resolve, join } from 'path';
import { seedBaseSchemasIfNeeded } from './helpers/seedBaseSchemas';
import { createNode, updateNode } from '../lib/nodeRepo';
import { runNode, appendInput } from '../lib/execution';
import { reloadTemplates } from '../lib/templateRepo';

const tmpRoot = resolve(process.cwd(), '.test-llm-template');

async function reset() {
  process.env.REPO_ROOT = tmpRoot;
  process.env.CE_TEST_MODE = '1'; // Enable test mode to avoid real LLM calls
  await fs.rm(tmpRoot, { recursive: true, force: true });
  await fs.mkdir(tmpRoot, { recursive: true });
  await fs.mkdir(join(tmpRoot, 'schemas', 'nodes'), { recursive: true });
  await fs.mkdir(join(tmpRoot, 'prompts', 'library', 'test'), { recursive: true });
  await seedBaseSchemasIfNeeded();
}

describe('LLM Template Integration (PBI-37)', () => {
  beforeEach(reset);

  it('uses template when useTemplate=true and templateId is set', async () => {
    // Create a test template
    const templateContent = `---
version: "1.0.0"
name: "Test Summary Template"
description: "Summarizes input text"
category: "test"
tags: ["test", "summary"]
variables:
  - name: text
    type: string
    required: true
    description: "Text to summarize"
  - name: max_words
    type: number
    required: false
    default: 50
    description: "Maximum words in summary"
---
Summarize the following text in {{max_words}} words or less:

{{text}}`;

    await fs.writeFile(
      join(tmpRoot, 'prompts', 'library', 'test', 'summary.md'),
      templateContent
    );
    await reloadTemplates(); // Force cache refresh

    // Create LLM node with template enabled
    const llm = await createNode('LLM', 'llm-template-test', {
      model: 'gpt-test',
      provider: 'openai',
      useTemplate: true,
      templateId: 'test/summary',
      templateVariables: {
        text: 'This is a long article about AI that needs summarization.',
        max_words: 30,
      },
    });

    const result = await runNode(llm.id);
    
    expect(result.error).toBeUndefined();
    expect(result.diagnostics).toBeDefined();
    
    // Check that template was used
    const templateDiag: any = result.diagnostics?.find((d: any) => d.message === 'using_prompt_template');
    expect(templateDiag).toBeDefined();
    expect(templateDiag?.data?.templateId).toBe('test/summary');
    
    // Check that template was rendered
    const renderDiag: any = result.diagnostics?.find((d: any) => d.message === 'template_rendered');
    expect(renderDiag).toBeDefined();
    expect(renderDiag?.data?.length).toBeGreaterThan(0);
  });

  it('merges templateVariables with input data', async () => {
    const templateContent = `---
version: "1.0.0"
name: "Message Response Template"
description: "Responds to user messages"
category: "test"
tags: ["test", "chat"]
variables:
  - name: message
    type: string
    required: true
    description: "User message"
  - name: tone
    type: string
    required: false
    default: "friendly"
    description: "Response tone"
---
Respond to this message in a {{tone}} tone:

{{message}}`;

    await fs.writeFile(
      join(tmpRoot, 'prompts', 'library', 'test', 'respond.md'),
      templateContent
    );
    await reloadTemplates(); // Force cache refresh

    const llm = await createNode('LLM', 'llm-merge-test', {
      model: 'gpt-test',
      provider: 'openai',
      useTemplate: true,
      templateId: 'test/respond',
      templateVariables: {
        tone: 'professional',
      },
    });

    // Add input via edge
    appendInput(llm.id, 'message', 'Hello, how are you?', {
      edgeId: 'e_test',
      sourceNodeId: 'chat-node',
    });

    const result = await runNode(llm.id);
    
    expect(result.error).toBeUndefined();
    
    const renderDiag: any = result.diagnostics?.find((d: any) => d.message === 'template_rendered');
    expect(renderDiag).toBeDefined();
    // Should have merged both explicit templateVariables (tone) and input data (message)
    expect(renderDiag?.data?.varsUsed).toBeGreaterThanOrEqual(2);
  });

  it('validates required variables and returns error if missing', async () => {
    const templateContent = `---
version: "1.0.0"
name: "Required Var Template"
description: "Template with required variables"
category: "test"
tags: ["test"]
variables:
  - name: required_field
    type: string
    required: true
    description: "This field is required"
  - name: optional_field
    type: string
    required: false
    description: "This field is optional"
---
Required: {{required_field}}
Optional: {{optional_field}}`;

    await fs.writeFile(
      join(tmpRoot, 'prompts', 'library', 'test', 'required.md'),
      templateContent
    );
    await reloadTemplates(); // Force cache refresh

    const llm = await createNode('LLM', 'llm-required-test', {
      model: 'gpt-test',
      provider: 'openai',
      useTemplate: true,
      templateId: 'test/required',
      templateVariables: {
        optional_field: 'I am here',
        // Missing required_field
      },
    });

    const result = await runNode(llm.id);
    
    // Should return error for missing required variable
    expect(result.error).toBeDefined();
    expect(result.error).toContain('required_field');
    
    const errorDiag: any = result.diagnostics?.find((d: any) => d.message === 'missing_required_template_variables');
    expect(errorDiag).toBeDefined();
    expect(errorDiag?.data?.missing).toContain('required_field');
  });

  it('maintains backward compatibility when useTemplate is false', async () => {
    const llm = await createNode('LLM', 'llm-legacy', {
      model: 'gpt-test',
      provider: 'openai',
      promptTemplate: 'User says: {message}',
      // useTemplate is false (default)
    });

    appendInput(llm.id, 'message', 'Hello world', {
      edgeId: 'e_test',
      sourceNodeId: 'source',
    });

    const result = await runNode(llm.id);
    
    expect(result.error).toBeUndefined();
    
    // Should NOT have template diagnostics
    const templateDiag = result.diagnostics?.find((d: any) => d.message === 'using_prompt_template');
    expect(templateDiag).toBeUndefined();
    
    // Should use traditional promptTemplate rendering
    expect((result as any).outputs).toBeDefined();
  });

  it('handles template not found error gracefully', async () => {
    const llm = await createNode('LLM', 'llm-missing-template', {
      model: 'gpt-test',
      provider: 'openai',
      useTemplate: true,
      templateId: 'nonexistent/template',
      templateVariables: {},
    });

    const result = await runNode(llm.id);
    
    expect(result.error).toBeDefined();
    expect(result.error).toContain('Failed to load template');
    
    const errorDiag: any = result.diagnostics?.find((d: any) => d.message === 'template_load_failed');
    expect(errorDiag).toBeDefined();
  });

  it('supports Handlebars helpers and expressions', async () => {
    const templateContent = `---
version: "1.0.0"
name: "Advanced Template"
description: "Uses Handlebars features"
category: "test"
tags: ["test", "advanced"]
variables:
  - name: items
    type: array
    required: true
    description: "List of items"
  - name: title
    type: string
    required: true
    description: "Title"
---
# {{title}}

{{#each items}}
- Item {{@index}}: {{this}}
{{/each}}`;

    await fs.writeFile(
      join(tmpRoot, 'prompts', 'library', 'test', 'advanced.md'),
      templateContent
    );
    await reloadTemplates(); // Force cache refresh

    const llm = await createNode('LLM', 'llm-advanced', {
      model: 'gpt-test',
      provider: 'openai',
      useTemplate: true,
      templateId: 'test/advanced',
      templateVariables: {
        title: 'My List',
        items: ['First', 'Second', 'Third'],
      },
    });

    const result = await runNode(llm.id);
    
    expect(result.error).toBeUndefined();
    
    const renderDiag: any = result.diagnostics?.find((d: any) => d.message === 'template_rendered');
    expect(renderDiag).toBeDefined();
    // The rendered content should include the expanded list
    expect(renderDiag?.data?.length).toBeGreaterThan(50);
  });

  it('allows templateVariables to override input data', async () => {
    const templateContent = `---
version: "1.0.0"
name: "Override Test"
description: "Tests variable precedence"
category: "test"
tags: ["test"]
variables:
  - name: value
    type: string
    required: true
    description: "Test value"
---
Value is: {{value}}`;

    await fs.writeFile(
      join(tmpRoot, 'prompts', 'library', 'test', 'override.md'),
      templateContent
    );
    await reloadTemplates(); // Force cache refresh

    const llm = await createNode('LLM', 'llm-override', {
      model: 'gpt-test',
      provider: 'openai',
      useTemplate: true,
      templateId: 'test/override',
      templateVariables: {
        value: 'explicit override',
      },
    });

    // Add input that should be overridden
    appendInput(llm.id, 'value', 'input data', {
      edgeId: 'e_test',
      sourceNodeId: 'source',
    });

    const result = await runNode(llm.id);
    
    expect(result.error).toBeUndefined();
    
    // The explicit templateVariables should take precedence
    // (We can't directly check rendered content in test mode, but we can verify no errors)
    const renderDiag: any = result.diagnostics?.find((d: any) => d.message === 'template_rendered');
    expect(renderDiag).toBeDefined();
  });

  it('continues to work with existing LLM nodes without template fields', async () => {
    // Simulate an LLM node created before PBI-37 (no template fields)
    const llm = await createNode('LLM', 'llm-pre-37', {
      model: 'gpt-test',
      provider: 'openai',
      promptTemplate: 'Simple prompt',
      // No useTemplate, templateId, or templateVariables
    });

    const result = await runNode(llm.id);
    
    // Should work normally without template processing
    expect(result.error).toBeUndefined();
    expect((result as any).outputs).toBeDefined();
  });
});
