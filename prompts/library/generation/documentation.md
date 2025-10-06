---
id: generation/documentation
name: Documentation Generator
version: 1.0.0
category: generation
tags: [documentation, code, generation]
description: Generate documentation from code
variables:
  - name: code
    type: string
    required: true
    description: Code to document
  - name: style
    type: string
    default: "JSDoc"
    description: Documentation style
    validation:
      enum: ["JSDoc", "Markdown", "reStructuredText"]
  - name: include_examples
    type: boolean
    default: true
    description: Include usage examples
---

# Code Documentation Generator

Generate comprehensive documentation for the following code.

**Documentation Style:** {{style}}
**Include Examples:** {{include_examples}}

**Code:**

```
{{code}}
```

**Documentation Requirements:**

1. **Overview:**
   - Purpose and functionality
   - When to use this code

2. **API Reference:**
   - Function/method signatures
   - Parameter descriptions with types
   - Return value documentation
   - Exceptions/errors thrown

3. **Details:**
   - Implementation notes
   - Performance considerations
   - Edge cases

{{#if include_examples}}
4. **Usage Examples:**
   - Basic usage
   - Advanced scenarios
   - Common pitfalls
{{/if}}

**Output Format ({{style}}):**

{{#if (eq style "JSDoc")}}
```javascript
/**
 * @description Brief description
 * @param {Type} paramName - Parameter description
 * @returns {Type} Return value description
 * @example
 * // Usage example
 */
```
{{else if (eq style "Markdown")}}
```markdown
## Function Name

Description of function...

### Parameters
- `paramName` (Type): Description

### Returns
Type: Description

### Example
\`\`\`
// Code example
\`\`\`
```
{{else}}
```rst
Function Name
=============

Description...

:param paramName: Description
:type paramName: Type
:returns: Description
:rtype: Type
```
{{/if}}
