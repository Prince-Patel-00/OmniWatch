# CodeRabbit Review Standards

Ensure high-signal, actionable automated reviews before changes are committed or merged.

## Review Pillars

1. **Bug Prevention & Logic Flaws**:
   - Boundary checks, null/undefined safety, SQL injections, regex backtracking, memory leaks, and unhandled promise rejections.
2. **Security & Data Sanitization**:
   - Validate user inputs, environment variables, credentials, and API authentication.
3. **Performance & Scalability**:
   - Query efficiency (avoid N+1 queries, verify indexes, check pagination offsets), bundle size impact, and component re-render overhead.
4. **Code Quality & Maintainability**:
   - Clean abstractions, adherence to project styling, and preservation of existing docstrings and comments.

## Review Output Format
Each finding must include:
- **Severity Badge**:
  - `🚨 Critical`: Functional bugs, crashes, security vulnerabilities.
  - `⚠️ Warning`: Edge case omissions, unoptimized queries, potential performance issues.
  - `💡 Suggestion`: Readability, idiomatic refactoring, clean patterns.
  - `🌟 Commendation`: Clean, well-architected patterns.
- **Location**: Clickable file path and line numbers (`[filename.js](file:///path/to/file.js#L10-L20)`).
- **Explanation**: Clear rationale detailing why the change is necessary.
- **Diff / Solution**: Concrete code replacement suggestion.
