---
id: code-review/security
name: Security Code Reviewer
version: 1.0.0
category: code-review
tags: [security, code, review, vulnerabilities]
description: Review code for security vulnerabilities
variables:
  - name: code
    type: string
    required: true
    description: Code to review
  - name: language
    type: string
    required: true
    description: Programming language
  - name: focus_areas
    type: array
    default: ["injection", "authentication", "authorization", "data-exposure"]
    description: Security areas to focus on
---

# Security Code Review

Perform a thorough security review of the following {{language}} code.

**Focus Areas:**
{{#each focus_areas}}
- {{this}}
{{/each}}

**Code to Review:**

```{{language}}
{{code}}
```

**Review Instructions:**

1. **Identify Vulnerabilities:**
   - SQL/NoSQL injection risks
   - Cross-Site Scripting (XSS)
   - Authentication/authorization flaws
   - Sensitive data exposure
   - Input validation issues
   - Dependency vulnerabilities

2. **Assess Severity:**
   - Critical (immediate fix required)
   - High (fix before release)
   - Medium (fix soon)
   - Low (improvement suggestion)

3. **Provide Recommendations:**
   - Specific code fixes
   - Best practice guidance
   - Alternative approaches

**Output Format:**

```json
{
  "vulnerabilities": [
    {
      "type": "SQL Injection",
      "severity": "Critical",
      "line": 42,
      "description": "User input directly concatenated into SQL query",
      "recommendation": "Use parameterized queries",
      "example_fix": "code snippet here"
    }
  ],
  "overall_security_score": 6.5,
  "summary": "Brief overview of findings"
}
```
