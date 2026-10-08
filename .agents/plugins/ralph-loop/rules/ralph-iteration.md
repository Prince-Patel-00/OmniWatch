# Ralph Loop Iteration Principles

The Ralph Loop (named by Geoffrey Huntley) avoids context degradation by offloading state to the filesystem and running automated verification loops until tasks pass.

## Core Rules

1. **State Lives on Disk**:
   - Never rely on conversational memory for tracking progress across long tasks.
   - Use `.ralph/tasks.json` or markdown task lists on disk as the single source of truth.
   - Mark tasks `pending`, `in_progress`, or `completed`.

2. **Fresh-Context Mindset**:
   - Each iteration begins by reading the current task status from disk.
   - Perform the minimal required change to advance the active task.
   - Run verification immediately.

3. **Empirical Exit Gates (Never Stop on Assumptions)**:
   - A task cannot be marked `completed` without external proof:
     - Tests pass (`node --test ...` / `npm test`).
     - Types / build pass (`npm run build`).
     - Lint passes (`npm run lint`).
   - If tests fail, diagnose and iterate within the loop until green.
