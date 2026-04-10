# Expert Endpoints — Tenancy Enforcement (Story 4.3)

## Standard for New Expert Endpoints

All expert-scoped endpoints must:

1. **Path**: Include `:expertId` in the route path (e.g. `GET /experts/:expertId/...`).
2. **Guards**: Use `JwtAuthGuard` and `ExpertRoleGuard` (order matters).
3. **Role**: Annotate the handler with `@RequireExpertRole('support' | 'reviewer' | 'manager' | 'owner')` according to the minimum role needed.
4. **Context**: Use `@ExpertId()` param decorator when you need `expertId` in the handler. The guard resolves it from `params.expertId` (always) or, in dev/test only, from header `x-expert-id`. In production, missing `:expertId` in path always yields **400** with code `EXPERT_CONTEXT_REQUIRED`.

## Example

```ts
@Get(':expertId/ping')
@RequireExpertRole('support')
ping(@ExpertId() expertId: string): { ok: true; expertId: string } {
  return { ok: true, expertId };
}
```

## Errors (unified, same across API)

- Missing expert context (no `:expertId` in path and, in prod, no fallback): **400** Bad Request, code `EXPERT_CONTEXT_REQUIRED`.

## Reference

- Guard: `apps/api/src/auth/expert-rbac/expert-role.guard.ts`
- Decorators: `RequireExpertRole`, `ExpertId` in `apps/api/src/auth/expert-rbac/`
- Module: `ExpertRbacModule`; import it and use `ExpertRoleGuard` on expert controllers.
