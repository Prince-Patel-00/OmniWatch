---
name: gsd-runner
description: "Run and orchestrate GSD (Get Shit Done) phases: plan, execute, and verify milestones."
---

# GSD Runner Skill

## Workflow

1. **Check Status**:
   - Inspect `.planning/` or current phase status in ROADMAP.md.
   - If no plan exists, run `/plan` to decompose requirements into phases.

2. **Execute Phase**:
   - For the active phase, execute each task in sequential order.
   - For every file modification:
     - Check existing tests.
     - Make minimal, targeted changes.
     - Run verification (`npm test` / build commands).

3. **Verify & Checkpoint**:
   - Validate against spec requirements with empirical proof.
   - Summarize deliverables and confirm user acceptance.
