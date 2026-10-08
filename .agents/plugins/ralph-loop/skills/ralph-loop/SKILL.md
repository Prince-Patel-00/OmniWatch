---
name: ralph-loop
description: "Run iterative execution loop with disk-persisted tasks and test-driven exit verification."
---

# Ralph Loop Skill

## Protocol

1. **Initialize or Read Task List**:
   - Check if `.ralph/tasks.json` exists.
   - If not, create `.ralph/tasks.json` containing an array of atomic tasks:
     ```json
     {
       "tasks": [
         { "id": 1, "description": "...", "status": "pending", "verification": "npm test" }
       ]
     }
     ```

2. **Step Through Active Task**:
   - Pick the first non-completed task.
   - Mark as `in_progress`.
   - Apply necessary code modifications.

3. **Run Verification Gate**:
   - Run the specified verification command (e.g. `npm test` or `npm run build`).
   - If green: Mark task `completed`, commit atomically, and proceed to next task.
   - If red: Do not advance. Diagnose error, fix, and rerun verification.

4. **Loop Exit**:
   - Exit only when all tasks in `.ralph/tasks.json` are verified `completed`.
