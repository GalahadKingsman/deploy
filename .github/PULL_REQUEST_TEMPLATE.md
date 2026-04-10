## Description

<!-- Describe your changes in detail -->

## Type of Change

- [ ] Feature (new functionality)
- [ ] Bug fix
- [ ] Refactoring (no functional changes)
- [ ] Documentation
- [ ] Chore (infrastructure, tooling, etc.)

## Definition of Stable (EPIC 1+)

**REQUIRED**: All three checks must pass before PR is considered ready for review.

- [ ] `pnpm verify` PASS
- [ ] `pnpm test:foundation` PASS
- [ ] `pnpm audit:architecture` PASS

**Note**: If any of these checks fail, the PR is NOT ready for review, even if the feature/UI looks good.

## Testing

<!-- Describe how you tested your changes -->

- [ ] Manual testing performed
- [ ] Automated tests pass (if applicable)

## Checklist

- [ ] Code follows project style guidelines
- [ ] Self-review completed
- [ ] Comments added for complex logic
- [ ] Documentation updated (if needed)
- [ ] No new warnings or errors introduced

## PR Artifacts (EPIC 1+)

**REQUIRED**: Every PR for EPIC 1 Stories MUST include:

1. **Git commit hash:**

   ```bash
   git rev-parse HEAD
   ```

2. **Link to GitHub Actions run** (if PR triggers CI)

3. **Copy-paste stdout of three commands:**

   ```bash
   pnpm verify
   pnpm test:foundation
   pnpm audit:architecture
   ```

4. **Manual smoke test results** (actual curl output, not just "works"):
   - `curl -i http://localhost:3001/health` (showing `x-request-id` header)
   - `curl -i http://localhost:3001/docs` returns `200` in dev, `404` in prod
   - `curl -i http://localhost:3001/nope` returns `404` with unified error format

**Without these artifacts, PR is NOT considered complete.**

## Related Issues

<!-- Link to related issues, if any -->

Closes #
