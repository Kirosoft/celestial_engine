# Prompt Template Library

This directory contains reusable prompt templates for LLM nodes in the Celestial Engine.

## Directory Structure

```
prompts/
├── .promptspec.yaml      # Template metadata and registry
├── README.md             # This file
├── library/              # Built-in curated templates
│   ├── summarization/
│   ├── extraction/
│   ├── analysis/
│   ├── code-review/
│   └── generation/
├── user/                 # User-created templates
└── shared/               # Team/project shared templates
```

## Template File Format

Each template is a Markdown file with YAML frontmatter:

```markdown
---
id: category/template-name
name: Human-Readable Name
version: 1.0.0
category: category-name
tags: [tag1, tag2]
description: Brief description
variables:
  - name: variable_name
    type: string|number|boolean|array
    required: true|false
    default: default_value
    description: Variable description
    validation:
      min: 1
      max: 100
      enum: [option1, option2]
---

# Template Content

Your prompt template with {{variable_name}} placeholders.

Use Handlebars syntax for logic:
{{#if condition}}...{{/if}}
{{#each items}}...{{/each}}
```

## Variable Syntax

Templates use Handlebars templating:

- **Simple substitution:** `{{variable_name}}`
- **Conditionals:** `{{#if variable}}...{{/if}}`
- **Loops:** `{{#each array}}{{this}}{{/each}}`
- **Comparisons:** `{{#if (eq value "test")}}...{{/if}}`

## Naming Conventions

### Template IDs
- Format: `category/descriptive-name`
- Use lowercase with hyphens
- Examples: `summarization/article`, `code-review/security`

### Variable Names
- Use snake_case
- Be descriptive: `max_words` not `max`
- Common names: `text`, `content`, `code`, `language`

### Categories
- `summarization` - Condensing text
- `extraction` - Extracting structured data
- `analysis` - Analyzing and interpreting
- `code-review` - Reviewing code quality/security
- `generation` - Creating new content
- `transformation` - Converting formats
- `qa` - Question answering

## Creating New Templates

1. Choose appropriate category directory
2. Create `.md` file with descriptive name
3. Add YAML frontmatter with metadata
4. Write prompt content with variable placeholders
5. Register in `.promptspec.yaml`
6. Test variable substitution

### Example Template

```markdown
---
id: summarization/meeting-notes
name: Meeting Notes Summarizer
version: 1.0.0
category: summarization
tags: [meeting, notes, summary]
description: Summarize meeting transcripts
variables:
  - name: transcript
    type: string
    required: true
  - name: focus
    type: string
    default: "action-items"
    validation:
      enum: ["action-items", "decisions", "full-summary"]
---

# Meeting Summary

Summarize the following meeting transcript, focusing on {{focus}}.

**Transcript:**
{{transcript}}

**Summary:**
```

## Template Versioning

- Use semantic versioning (MAJOR.MINOR.PATCH)
- MAJOR: Breaking changes to variables/structure
- MINOR: New features, backward-compatible
- PATCH: Bug fixes, typos, improvements

## GitSpec Compliance

This structure follows [GitSpec](https://gitspec.com) standards:

- Plain text (Markdown) for version control
- YAML metadata for machine readability
- Hierarchical organization
- Self-documenting structure

## Usage in LLM Nodes

1. Set `useTemplate: true` in LLM node props
2. Select `templateId` from available templates
3. Provide required variables via:
   - Direct props (`templateVariables`)
   - Input edge data (auto-mapped)
4. Template is rendered at execution time

## Best Practices

- **Keep templates focused:** One clear purpose per template
- **Document variables:** Clear descriptions and examples
- **Provide defaults:** Sensible default values where possible
- **Test edge cases:** Validate with various inputs
- **Version carefully:** Breaking changes require new major version
- **Use examples:** Include example outputs in template description

## Contributing

### Adding Templates to Library

1. Fork and create feature branch
2. Add template file in appropriate category
3. Update `.promptspec.yaml`
4. Add tests (if applicable)
5. Submit PR with description

### User Templates

Create templates in `user/` directory for personal use. These are gitignored by default.

### Shared Templates

Team templates in `shared/` can be version-controlled for collaboration.

## Future Enhancements

- Template inheritance (extend base templates)
- Multi-language support
- Template validation CLI tool
- Interactive template builder UI
- Template performance metrics

---

**Last Updated:** 2025-10-06  
**Spec Version:** 1.0
