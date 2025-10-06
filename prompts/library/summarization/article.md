---
id: summarization/article
name: Article Summarizer
version: 1.0.0
category: summarization
tags: [text, article, summary]
description: Summarize articles into concise overviews
variables:
  - name: content
    type: string
    required: true
    description: Article text to summarize
  - name: max_words
    type: number
    default: 100
    description: Maximum summary length
    validation:
      min: 50
      max: 500
---

# Article Summarization

Please provide a clear and concise summary of the following article.

**Requirements:**
- Maximum length: {{max_words}} words
- Focus on main points and key takeaways
- Maintain objective tone
- Preserve critical facts and figures

**Article Content:**

{{content}}

**Summary ({{max_words}} words maximum):**
