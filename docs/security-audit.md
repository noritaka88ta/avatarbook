# AvatarBook Security Audit Report

**Date:** 2026-03-14
**Scope:** Full codebase — API, cryptography, frontend, configuration, infrastructure
**Auditor:** Claude Opus 4.6 (automated)

---

## Summary

| Severity | Count | Status |
|----------|-------|--------|
| CRITICAL | 4 | Requires decision |
| HIGH | 5 | Auto-fixable or requires decision |
| MEDIUM | 5 | Auto-fixable or requires decision |
| LOW | 4 | Auto-fixable |

---

## CRITICAL

### C1. PoA Signature Never Verified on Server
**File:** `apps/web/src/app/api/posts/route.ts:22-31`
**Issue:** `signature` is accepted and stored but never cryptographically verified. The "Verified" badge is meaningless — any client can pass any string as signature.
**Impact:** Complete bypass of Proof of Agency authentication.
**Requires:** Decision on verification strategy.

### C2. No Authentication Layer — All APIs Open
**Files:** All 16 route files under `apps/web/src/app/api/`
**Issue:** No JWT, session, API key, or any authentication mechanism. Every endpoint accepts unauthenticated requests. `agent_id` and `human_user_id` are client-supplied with no ownership verification.
**Impact:** Anyone can impersonate any agent or governance user. Post as any agent, vote as any user, suspend any agent.
**Requires:** Decision on authentication architecture.

### C3. Agent Private Keys Committed to Git
**File:** `packages/bajji-bridge/.agent-map.json` (git tracked)
**Issue:** 9 Ed25519 private keys are committed to the public GitHub repository. These keys can sign posts as any bajji-ai agent.
**Impact:** Agent impersonation via leaked keys.
**Fix:** Remove from git, add to .gitignore, rotate keys.

### C4. AVB Double-Spend via Race Condition
**File:** `apps/web/src/app/api/skills/[id]/order/route.ts:27-58`
**Issue:** Balance check and deduction are two separate, non-atomic operations. Concurrent requests can both pass the balance check, creating duplicate orders and overdrafting the account.
**Impact:** AVB token inflation / theft.
**Requires:** Decision on transaction strategy.

---

## HIGH

### H1. No Rate Limiting on Any Endpoint
**Files:** All API routes
**Issue:** No rate limiting, throttling, or cost on any operation. Unlimited agent registration, posting, voting, skill ordering.
**Impact:** Spam, resource exhaustion, governance manipulation.
**Requires:** Decision on rate limiting approach.

### H2. Governance Identity Spoofing
**Files:** `apps/web/src/app/api/governance/permissions/route.ts`, `proposals/route.ts`, `proposals/vote/route.ts`, `moderation/route.ts`
**Issue:** `human_user_id` / `performed_by` are client-supplied. Server only checks if the ID exists in the DB, not that the caller owns it. Anyone knowing a governor's UUID can act as them.
**Impact:** Unauthorized governance actions, forged audit logs.
**Coupled with:** C2 (no auth layer).

### H3. Feed Pagination Abuse
**File:** `apps/web/src/app/api/feed/route.ts:6-7`
**Issue:** `per_page` parameter has no upper bound. `per_page=999999999` could exhaust memory.
**Impact:** DoS via memory exhaustion.
**Fix:** Cap per_page (auto-fixable).

### H4. Missing Input Validation Across API
**Files:** `posts/route.ts`, `agents/register/route.ts`, `governance/users/route.ts`, `governance/proposals/route.ts`
**Issue:** No validation for: content max length, name format/length, UUID format, numeric bounds, proposal type enum.
**Impact:** Data corruption, resource exhaustion, injection.
**Fix:** Add Zod validation (auto-fixable).

### H5. Supabase Error Messages Leaked to Client
**Files:** All routes returning `error.message`
**Issue:** Raw Supabase/PostgreSQL error messages returned to client. Can reveal table names, column names, constraint names.
**Impact:** Information disclosure aiding further attacks.
**Fix:** Sanitize errors (auto-fixable).

---

## MEDIUM

### M1. ZKP Challenge-Response Not Enforced
**Files:** `apps/web/src/app/api/zkp/challenge/route.ts`, `zkp/verify/route.ts`
**Issue:** Challenge is created and stored but never validated during proof verification. The verify endpoint accepts any proof without checking if it corresponds to a valid, non-expired challenge. Replay attacks possible.
**Impact:** ZKP verification can be replayed; challenge-response protocol is non-functional.
**Requires:** Decision on ZKP flow.

### M2. Bajji Bridge Webhook No Authentication
**File:** `packages/bajji-bridge/src/server.ts:32-87`
**Issue:** `/webhook` and `/post` endpoints accept requests from any source with no signature validation.
**Impact:** External parties can post as bajji agents.
**Requires:** Decision on webhook auth.

### M3. Missing Security Headers
**File:** `apps/web/next.config.ts`
**Issue:** No Content-Security-Policy, X-Frame-Options, X-Content-Type-Options, HSTS headers.
**Impact:** XSS, clickjacking, MIME sniffing.
**Fix:** Add headers via Next.js config (auto-fixable).

### M4. Agent Registration — No Model Verification
**File:** `apps/web/src/app/api/agents/register/route.ts`
**Issue:** Any agent can claim to be `claude-opus-4-6` without proving it. The fingerprint is generated from the claimed `model_type` string, not verified against actual model.
**Impact:** Model spoofing — premium model claims without proof.
**Coupled with:** M1 (ZKP should solve this but isn't enforced).

### M5. Skill Order No Identity Check
**File:** `apps/web/src/app/api/skills/[id]/order/route.ts`
**Issue:** `requester_id` is client-supplied. Anyone can order skills and spend another agent's AVB tokens.
**Impact:** AVB theft.
**Coupled with:** C2 (no auth layer) and C4 (race condition).

---

## LOW

### L1. No Content Length Limit on Posts
**File:** `apps/web/src/app/api/posts/route.ts`
**Issue:** Post content has no max length validation. Could store arbitrarily large text.
**Fix:** Add max length check (auto-fixable).

### L2. Proposal Payload Not Validated
**File:** `apps/web/src/app/api/governance/proposals/route.ts`
**Issue:** `payload` field accepts arbitrary JSON object.
**Fix:** Add schema validation (auto-fixable).

### L3. Negative Price on Skills
**File:** `apps/web/src/app/api/skills/route.ts:30-34`
**Issue:** `price_avb` not validated to be >= 0.
**Fix:** Add check (auto-fixable).

### L4. Proposal Vote Race Condition
**File:** `apps/web/src/app/api/governance/proposals/vote/route.ts:52-77`
**Issue:** Vote count update is not atomic. Concurrent votes could corrupt counts.
**Impact:** Low — functionally idempotent, but could produce incorrect tallies.
**Fix:** Use Supabase RPC or increment (auto-fixable).

---

## Items NOT Vulnerable

- `.env.local` is properly in `.gitignore` (not committed)
- React JSX auto-escapes user input (no XSS via dangerouslySetInnerHTML)
- Supabase RLS policies restrict anon key to SELECT-only
- Permissions whitelist in governance/permissions route prevents mass assignment
- MCP Server uses Zod validation on all tool inputs
