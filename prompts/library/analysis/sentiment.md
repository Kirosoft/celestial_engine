---
id: analysis/sentiment
name: Sentiment Analyzer
version: 1.0.0
category: analysis
tags: [sentiment, emotion, analysis]
description: Analyze sentiment and emotional tone
variables:
  - name: text
    type: string
    required: true
    description: Text to analyze
  - name: scale
    type: string
    default: "5-point"
    description: Sentiment scale (5-point or 3-point)
    validation:
      enum: ["5-point", "3-point"]
---

# Sentiment Analysis

Analyze the sentiment and emotional tone of the following text.

**Sentiment Scale:** {{scale}}

{{#if (eq scale "5-point")}}
- Very Negative (-2)
- Negative (-1)
- Neutral (0)
- Positive (+1)
- Very Positive (+2)
{{else}}
- Negative
- Neutral
- Positive
{{/if}}

**Text to Analyze:**

{{text}}

**Analysis Instructions:**
1. Determine overall sentiment score
2. Identify dominant emotions (joy, anger, sadness, fear, surprise)
3. Note any sarcasm or irony
4. Explain reasoning

**Output Format:**
```json
{
  "sentiment_score": 0,
  "sentiment_label": "Neutral",
  "emotions": ["joy", "surprise"],
  "confidence": 0.85,
  "reasoning": "explanation here"
}
```
