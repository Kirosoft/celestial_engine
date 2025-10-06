# PBI-34: Prompt Template Directory Structure

**Phase:** 2.1 - Prompt Template Infrastructure  
**Priority:** High  
**Estimate:** 2 days  
**Status:** ✅ Complete

---

## User Story

As a **prompt engineer**, I want a **standardized directory structure for storing prompt templates** so that **I can organize, version-control, and share reusable prompts across LLM nodes**.

---

## Acceptance Criteria

1. ✅ `prompts/` directory exists at repo root with subdirectories:
   - `prompts/library/` - Built-in templates
   - `prompts/user/` - User-created templates
   - `prompts/shared/` - Team templates
   
2. ✅ `.promptspec.yaml` file exists at `prompts/.promptspec.yaml` with valid schema

3. ✅ At least 5 initial templates created covering common use cases:
   - `library/summarization/article.md`
   - `library/extraction/entities.md`
   - `library/analysis/sentiment.md`
   - `library/code-review/security.md`
   - `library/generation/documentation.md`

4. ✅ Each template file follows markdown format with YAML frontmatter

5. ✅ Template files are Git-trackable (no binary formats)

6. ✅ Documentation explains directory structure and naming conventions

---

## Technical Details

### `.promptspec.yaml` Schema

```yaml
version: "1.0"
metadata:
  name: "Celestial Engine Prompt Library"
  description: "Curated templates for LLM nodes"
  author: "Celestial Team"
  license: "MIT"
  created: "2025-10-03"
templates:
  - id: "summarization/article"
    path: "library/summarization/article.md"
    version: "1.0.0"
    category: "summarization"
    tags: ["text", "article", "summary"]
    variables:
      - name: "content"
        type: "string"
        required: true
        description: "Article text to summarize"
      - name: "max_words"
        type: "number"
        default: 100
        description: "Maximum summary length"
        validation:
          min: 50
          max: 500
```

### Template File Format

```markdown
---
id: summarization/article
name: Article Summarizer
version: 1.0.0
category: summarization
tags: [text, article, summary]
variables:
  - name: content
    type: string
    required: true
    description: Article text to summarize
  - name: max_words
    type: number
    default: 100
    validation:
      min: 50
      max: 500
---

# Article Summarization

Summarize the following article in approximately {{max_words}} words.
Focus on the main points and key takeaways.

**Article:**
{{content}}

**Summary ({{max_words}} words max):**
```

### Directory Tree

```
prompts/
├── .promptspec.yaml
├── README.md
├── library/
│   ├── summarization/
│   │   └── article.md
│   ├── extraction/
│   │   └── entities.md
│   ├── analysis/
│   │   └── sentiment.md
│   ├── code-review/
│   │   └── security.md
│   └── generation/
│       └── documentation.md
├── user/
│   └── .gitkeep
└── shared/
    └── .gitkeep
```

---

## Implementation Checklist

### Setup
- [x] Create `prompts/` directory at repo root
- [x] Create subdirectories: `library/`, `user/`, `shared/`
- [x] Add `.gitkeep` files to empty directories

### .promptspec.yaml
- [x] Create `.promptspec.yaml` with metadata section
- [x] Define schema structure (version, metadata, templates array)
- [x] Add inline documentation comments
- [x] Validate YAML syntax

### Initial Templates
- [x] Create `library/summarization/article.md` with frontmatter
- [x] Create `library/extraction/entities.md`
- [x] Create `library/analysis/sentiment.md`
- [x] Create `library/code-review/security.md`
- [x] Create `library/generation/documentation.md`
- [x] Register all 5 templates in `.promptspec.yaml`

### Documentation
- [x] Create `prompts/README.md` explaining structure
- [x] Document template file format
- [x] Add variable naming conventions
- [x] Provide template authoring examples
- [x] Link to GitSpec standards

### Validation
- [x] Verify all templates have valid frontmatter
- [x] Check all variables are properly typed
- [x] Ensure template IDs match file paths
- [x] Create validation script
- [x] Ready to commit to Git

---

## Testing Approach

### Manual Testing
1. Navigate to `prompts/` directory
2. Verify all subdirectories exist
3. Open `.promptspec.yaml` and validate structure
4. Open each template file and check frontmatter
5. Confirm templates use `{{variable}}` syntax
6. Verify Git tracking (run `git status`)

### Validation Script (Optional)
```bash
#!/bin/bash
# scripts/validate-templates.sh

echo "Validating prompt template structure..."

# Check directories exist
test -d prompts/library || echo "ERROR: prompts/library missing"
test -d prompts/user || echo "ERROR: prompts/user missing"
test -d prompts/shared || echo "ERROR: prompts/shared missing"

# Check .promptspec.yaml exists
test -f prompts/.promptspec.yaml || echo "ERROR: .promptspec.yaml missing"

# Count templates
TEMPLATE_COUNT=$(find prompts/library -name "*.md" | wc -l)
echo "Found $TEMPLATE_COUNT templates"
test $TEMPLATE_COUNT -ge 5 || echo "WARNING: Expected at least 5 templates"

echo "Validation complete"
```

---

## Dependencies

None (this is foundational work)

---

## Risks & Mitigation

| Risk | Mitigation |
|------|-----------|
| Templates not Git-friendly (large files) | Use plain markdown, keep templates concise |
| Inconsistent naming conventions | Document standards in README.md |
| Template versioning conflicts | Use semver, track in `.promptspec.yaml` |

---

## Definition of Done

- [x] All checklist items completed
- [x] 5 templates created with valid frontmatter
- [x] `.promptspec.yaml` contains all template metadata
- [x] Documentation (prompts/README.md) written
- [x] Validation script created and passes
- [x] Changes ready for Git commit

---

## Notes

- Keep initial templates simple and focused on MVP
- Template content can be improved in later iterations
- User/shared directories start empty (populated in future PBIs)
- Consider adding a template linter in future (not MVP)

---

**Created:** 2025-10-03  
**Completed:** 2025-10-06
