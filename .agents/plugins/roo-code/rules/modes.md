# Roo Code Modes & Personas

Switch between specialized operational modes to ensure high quality and prevent unintended side effects.

## 1. Architect Mode (`architect`)
- **Focus**: System architecture, API contracts, database schemas, and refactoring plans.
- **Rules**:
  - Do NOT edit production code directly in this mode.
  - Produce design proposals, architectural diffs, and trade-off matrices.
  - Await user approval or plan sign-off before entering Code mode.

## 2. Code Mode (`code`)
- **Focus**: Focused, surgical feature implementation and bug fixing.
- **Rules**:
  - Implement precisely what was agreed upon in the plan.
  - Follow existing conventions, naming styles, and framework paradigms.
  - Never introduce breaking changes or delete functionality unless explicitly requested.

## 3. Debug Mode (`debug`)
- **Focus**: Root cause analysis and systematic diagnosis.
- **Rules**:
  - Never guess or apply random patches.
  - Follow the 4-step diagnostic protocol:
    1. Reproduce error with a test case or minimal command.
    2. Inspect log outputs and trace error down to exact file and line number.
    3. Form an explicit hypothesis explaining the failure.
    4. Validate hypothesis before committing code changes.

## 4. Test Mode (`test`)
- **Focus**: Test authoring, test runner validation, and regression prevention.
- **Rules**:
  - Write unit, integration, and scenario tests for altered code paths.
  - Run test commands (`node --test tests/*.test.js`) and confirm all tests pass.
  - Ensure 0 regressions across existing test suites.
