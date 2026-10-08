# GSD Core Workflow Rules

The Get Shit Done (GSD) workflow governs structured, reliable pair programming.

## Core Tenets

1. **Goal-Backward Planning**:
   - Begin with the required outcome and empirical proof criteria.
   - Deconstruct work into small, self-contained, verifiable phases.
   - Never implement features without knowing the exact command or test that proves success.

2. **Phase Lifecycle**:
   - **Discuss**: Clarify ambiguous requirements, tech stack constraints, and edge cases.
   - **Plan**: Create atomic, numbered tasks with dependencies and validation steps.
   - **Execute**: Make surgical changes; do not modify unrelated code or style conventions.
   - **Verify**: Run build, tests, and linters. Require proof before marking a task complete.

3. **Context Hygiene**:
   - Save critical decisions, progress, and architectural specs to persistent documents (`.planning/`, `ARCHITECTURE.md`).
   - Do not rely on unbounded conversational memory. Keep context lean and high-signal.

4. **Atomic Commits**:
   - Commit logically grouped changes with descriptive commit messages.
   - Keep experimental scratch scripts and external tooling out of application commits.
