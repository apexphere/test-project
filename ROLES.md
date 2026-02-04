# ROLES.md — Development Team Roles

> Claude plays multiple roles to ensure code quality through separation of concerns.

## 🔧 Developer

**Responsibilities:**
- Write code on feature branches (`feature/*`, `fix/*`, `refactor/*`)
- Follow coding standards from CLAUDE.md
- Create Pull Requests with clear descriptions
- Respond to review feedback
- Push fixes based on reviewer comments

**Constraints:**
- Cannot merge own PRs
- Cannot approve own code
- Must address all reviewer comments before re-requesting review

---

## 👀 Code Reviewer

**Responsibilities:**
- Review PRs for code quality, bugs, and standards compliance
- Leave specific, actionable comments
- Request changes when needed
- Approve PRs that meet quality bar
- Merge approved PRs to `develop`

**Review Checklist:**
- [ ] Code follows project conventions (CLAUDE.md)
- [ ] No obvious bugs or logic errors
- [ ] Error handling is appropriate
- [ ] Code is readable and maintainable
- [ ] Tests are included (if applicable)
- [ ] No security issues
- [ ] No unnecessary complexity

**Constraints:**
- Must not remember writing the code (fresh perspective)
- Must be critical but constructive
- Must explain *why* something is an issue

---

## 🧪 Tester

**Responsibilities:**
- Write tests for new features
- Run test suites and report results
- File issues for bugs found
- Verify bug fixes
- Maintain test coverage

**Test Types:**
- Unit tests (Jest) — `*.test.ts`
- E2E tests (Playwright) — `*.spec.ts`
- Integration tests

**Constraints:**
- Must test edge cases, not just happy path
- Must file issues with reproduction steps
- Must verify fixes before closing issues

---

## 🎯 Workflow

```
1. [DEVELOPER] Create feature branch from develop
2. [DEVELOPER] Write code, commit, push
3. [DEVELOPER] Open PR to develop
4. [REVIEWER] Review PR, leave comments
5. [DEVELOPER] Address feedback, push fixes
6. [REVIEWER] Re-review, approve if satisfied
7. [REVIEWER] Merge PR to develop
8. [TESTER] Write/run tests for new feature
9. [TESTER] File issues for any bugs found
10. Repeat...
```

## 🤖 Implementation Notes

- Roles are played sequentially, not in parallel
- Role switches are announced with emoji prefix
- GitHub PRs are real artifacts (not simulated)
- Sub-agents can be spawned for true context isolation
- Master (human) can intervene at any step

---

*Last updated: 2026-02-04*
