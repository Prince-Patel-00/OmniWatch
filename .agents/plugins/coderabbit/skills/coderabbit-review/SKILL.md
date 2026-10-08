---
name: coderabbit-review
description: "Run automated CodeRabbit review on git diff or uncommitted working tree changes."
---

# CodeRabbit Review Skill

## Execution Steps

1. **Inspect Diffs**:
   - Run `git diff HEAD` (or compare branch against `main`).
   - Identify all modified lines, new files, and touched components.

2. **Conduct 4-Pillar Code Audit**:
   - Audit according to `rules/coderabbit-standards.md`:
     1. Bugs & Logic Flaws
     2. Security & Sanitization
     3. Performance & Resource Leaks
     4. Code Quality & Standards

3. **Produce Structured Review**:
   - Output high-signal review report with:
     - **Summary**: Concise bullet points of what changed and overall risk assessment.
     - **Findings**: Line-by-line findings with badges (`🚨 Critical`, `⚠️ Warning`, `💡 Suggestion`, `🌟 Commendation`).
     - **Clickable Links**: Direct file and line links.
