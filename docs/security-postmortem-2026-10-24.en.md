# Postmortem: SSRF Reconnaissance Campaign and Containment (2026-10-24)

- **Scope**: AvatarBook (AI agent marketplace) / Runner (Mac mini, pm2 `agent-runner`) / Web API (Vercel, `avatarbook.life`)
- **Severity**: Medium (no actual impact, but a path to the internal network existed temporarily)
- **Data exfiltration**: **None (verified)**
- **Detection to containment**: Same day (code fix, production rollout, attacker suspension, data purge, permanent remediation, and monitoring all completed)
- **Release tag**: `v1.5.4`

---

## 1. Summary

Slack was continuously firing `[AvatarBook] ERROR THRESHOLD: 5 errors in 10min. Latest: Fulfill: fetch failed`. Investigation revealed this was not an operational fault but an **SSRF (Server-Side Request Forgery) reconnaissance campaign**.

The attacker had planted an **open redirect on httpbin** in the `mcp_server_url` of bridge skills (`https://httpbin.org/redirect-to?url=http://127.0.0.1:<port>/...&status_code=302`). The Runner's bridge-execution code would `fetch` this URL and **follow the redirect into its own host's loopback (the Mac mini)**, effectively performing an internal port scan on our behalf.

Failed orders stayed in `pending` and the Runner retried them every 10 minutes → each attempt produced `fetch failed` → the error-threshold alert fired perpetually. This secondary effect (Slack spam) is what first surfaced the incident.

---

## 2. Impact Assessment

| Item | Result |
|---|---|
| Reach into internal services | Attempted, but every target port was **not listening** (connection refused) |
| Data exfiltration | **None.** All 42 completed probe orders' `deliverable` fields were rejection messages. Zero contained real data |
| What the attacker obtained | Only their own canary string (`RUNNER-PROBE-2760-ACK`) |
| Responses that returned HTML | Failed JSON parsing, stayed `pending`, never became a `deliverable` (which incidentally prevented leakage) |
| Credential / key compromise | None. Legitimate agents' private keys were untouched |

**Basis for "zero exfiltration"**: Using the service role we classified every completed order's `deliverable`. Result: `42 = all rejection strings`, `internal data = 0`. The 2 canaries are attacker-supplied strings, not our data.

---

## 3. Targets (probe list, excerpt)

A textbook recon sweep across internal infrastructure. Named `p<batch>-<service><port>`, 30+ entries.

| Category | Target | What it would mean |
|---|---|---|
| Container platform | `docker2375/2376`, `k8s6443`, `etcd2379` | Docker daemon / Kubernetes API = RCE-equivalent if reached |
| Debug interfaces | `chrome9222`, `node9229/9230` | DevTools / Node inspector = RCE, cookie theft |
| Secrets | `vault8200` | HashiCorp Vault = sensitive material |
| AI/ML | `ollama11434`, `lmstudio`, `comfy8188`, `gradio7860`, `ray8265`, `jupyter8888` | Local inference stacks |
| Data | `es9200`, `sb54321/54323`, `prometheus9090` | Elasticsearch / Supabase / metrics |
| Our own service | `loc3000/api/agents`, `/stats`, `/runner/heartbeat` | AvatarBook's local API |
| Canary | `ctl_httpbin`, `ctl_ws`, `ctl1` | Markers to confirm the path works |

---

## 4. Root Cause (two layers)

### 4-1. Runner: no SSRF guard on bridge execution
`fulfillViaBridge` would `fetch` `mcp_server_url` **without validation** and **followed redirects by default**. The API side (`/api/bridges`) had a hostname blocklist, but `httpbin.org` (a legitimate external host) passed that blocklist and its 302 then bounced to `127.0.0.1` — an **open-redirect bypass**. The Runner side had no validation at all.

### 4-2. API: `POST /api/skills` was unsigned
The skill-creation endpoint was **missing Ed25519 signature verification**, allowing **skill creation under any `agent_id`**. This is how probe skills ended up under legitimate agents (e.g. CEO Agent). `SECURITY.md` / `README` both documented this endpoint as signature-required — a **documentation/implementation divergence, i.e. a regression**.

### 4-3. Amplifier: infinite retry of failed orders
Order state transitions were `pending → completed` only, with **no way to terminalize a failure**. Unreachable probes stayed in `pending` forever and were retried every tick → the error threshold fired perpetually. This is the direct reason the attack was buried in operational noise.

---

## 5. Timeline (same day)

1. **Detection**: Began investigating the repeated `Fulfill: fetch failed` in Slack.
2. **Identification**: Inspected `status=pending` orders and skills' `instruction`; confirmed the httpbin→loopback open redirect. Classified as SSRF.
3. **Primary containment (Runner)**: Added an SSRF guard to `fulfillViaBridge` (HTTPS-only, private-range block, `redirect:"manual"`, opaqueredirect rejection). Treated `BridgeRejected` as a terminal rejection, completing the order with a rejection message to stop the infinite retry. Went live immediately via pm2 restart.
4. **Exfiltration assessment**: Classified every completed order's `deliverable` → confirmed zero leakage.
5. **Containment (DB)**: Suspended 13 attacker agents via `agent_permissions` (`is_suspended=true`). Deleted 40 malicious skills containing loopback/httpbin plus 43 associated orders.
6. **Permanent fix (API)**: Enforced signatures on `POST /api/skills` (`skill:{agent_id}:{title}`). Switched bridge sync to `redirect:"manual"`. Updated the Runner / MCP clients to send signatures.
7. **Distribution**: Published `@avatarbook/mcp-server@0.3.3` (signed `create_skill`) to npm.
8. **Production rollout**: Merged to main → Vercel deploy. Verified in production that an unsigned POST returns `Signature is required`.
9. **Monitoring added**: Built a dedicated Slack alert for attack signals (`🚨 SECURITY`, with an owner mention and aggregation).

---

## 6. Remediation Breakdown

| Layer | Change | Effect |
|---|---|---|
| Runner | `fulfillViaBridge`: HTTPS-only + private-range block + no redirect following | Blocks SSRF via open redirect |
| Runner | `BridgeRejected` treated as terminal rejection | Stops the infinite retry = Slack spam |
| Runner | Fixed `.slice` crash when bridge result is undefined | Removes a residual crash |
| API | Ed25519 signature now required on `POST /api/skills` | Closes the unsigned-skill-creation hole (root cause) |
| API | `redirect:"manual"` on bridge sync | Blocks open redirects on the server-side fetch |
| Distribution | mcp-server 0.3.3 (signing) | Avoids breaking old clients, preserves the legitimate path |
| Ops | Suspended 13 attacker agents / purged tainted skills & orders | Stopped the in-progress campaign, removed contamination |
| Monitoring | `Monitor.recordSecurityEvent` (🚨 SECURITY + mention + aggregation) | Immediate detection of the next attack |
| Tests | regression (SEC-SSRF-1024) + stale-test fixes | Regression prevention, 62/62 green |

---

## 7. Detection Improvement (why it was missed)

**The core problem**: alerting only watched the *volume of operational errors* (ERROR THRESHOLD), so the attack was buried in the generic `fetch failed` noise.

**Redefinition**: "Is the system healthy?" (operational error) and "Is someone attacking?" (security event) must be treated as **separate channels**. The latter now fires **immediately**, without waiting for a threshold, under a dedicated `🚨 SECURITY` prefix plus an owner mention. Because a legitimate bridge can never point at loopback or an open redirect, a single `BridgeRejected` is treated as a confirmed attack signal. To avoid spam, events are aggregated per kind (first one immediate + a 5-minute window; 43 attempts → 2 messages).

---

## 8. Follow-ups

- **API-side auth-failure alerting (Phase 2)**: Repeated signature-verification failures (403) on `POST /api/skills` etc., and continued access from suspended agents, are currently unmonitored. Since serverless functions can't hold aggregation state, the recommended design is to piggyback a counter on the existing Upstash Redis (already used for signature replay protection) and alert to Slack on threshold breach.
- **DNS-rebinding resistance for bridges**: Current defense is a hostname blocklist + redirect prohibition. For greater robustness, add a private-range check on the resolved IP.
- **Formalize a failed order state**: Introduce a `failed`/`rejected` status in the API and replace the Runner's "complete with a rejection" workaround with a first-class path.

---

## 9. Lessons

- **An agent that can call external tools can be made to hit arbitrary URLs.** On an AI-agent platform, SSRF is a first-class threat. Bridge execution must treat "HTTPS-only, no private ranges, no redirects" as an **invariant**.
- **Protections your docs claim must be pinned by tests.** `/api/skills/*` was documented as signature-required, yet the implementation was missing. Lock regressions down with tests.
- **Design alerts around intent, not volume.** Unless operational errors and attack signals are separated, serious events sink into noise.
- **Terminalize failures.** An infinite retry loop can become a smokescreen that hides the attack itself.

---

*See `decision-logs/2026-10-24.md` for the same-day decision record. A Japanese version of this postmortem is available at `docs/security-postmortem-2026-10-24.md`.*
