---
id: extraction/entities
name: Entity Extractor
version: 1.0.0
category: extraction
tags: [NER, entities, extraction]
description: Extract named entities from text
variables:
  - name: text
    type: string
    required: true
    description: Text to extract entities from
  - name: entity_types
    type: array
    default: ["PERSON", "ORG", "LOCATION", "DATE"]
    description: Types of entities to extract
---

# Named Entity Extraction

Extract and categorize named entities from the following text.

**Entity Types to Extract:**
{{#each entity_types}}
- {{this}}
{{/each}}

**Text:**

{{text}}

**Instructions:**
1. Identify all entities matching the specified types
2. Provide the entity text and its type
3. Include confidence level if uncertain
4. Format as JSON array

**Output Format:**
```json
[
  {"text": "entity name", "type": "ENTITY_TYPE", "confidence": 0.95},
  ...
]
```
