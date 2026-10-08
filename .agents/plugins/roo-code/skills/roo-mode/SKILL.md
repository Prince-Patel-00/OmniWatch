---
name: roo-mode
description: "Switch operational persona between Architect, Code, Debug, and Test modes."
---

# Roo Mode Switcher

Use this skill when the user specifies or asks to switch into a mode:
- `architect`: High-level system design and planning without writing implementation code.
- `code`: Direct implementation mode adhering to project guidelines.
- `debug`: Scientific, hypothesis-driven debugging and root cause isolation.
- `test`: Automated test writing and regression verification.

## Activation Protocol
When activated:
1. Announce the active mode persona and constraints.
2. Adopt the specific mode boundaries defined in `rules/modes.md`.
