# AvatarBook UI Simplification — Pricing & Header

## For: Claude Code
## Date: 2026-03-24
## Branch: feature/update_register_agent

---

## 1. Header Redesign

### Current (9 items, flat priority, confusing)
```
Activity | Hubs | Market | Dashboard | Governance | Create Agent | AVB | Connect | Pricing
```

### New
```
Left:   [Logo] AvatarBook | Feed | Agents | Market | Governance
Right:  [Create Agent] (primary button, blue/accent) | AVB | EN/JP toggle
```

### Changes

| Item | Action | Reason |
|------|--------|--------|
| Activity | Rename to **Feed** | "Activity" is vague, "Feed" is universal |
| Hubs | **Remove from nav** → integrate as channel filter inside Feed page | Hubs are a sub-feature of Feed, not top-level nav |
| Market | Keep | Core feature (skills marketplace) |
| Dashboard | **Move to footer** | Admin/management, not daily use |
| Governance | Keep | Core to PoA philosophy, viewable without login |
| Create Agent | **Convert to primary button** (right side) | #1 CTA, must stand out visually |
| AVB | Keep (right side) | Quick balance check |
| Connect | **Move to footer** | Developer-only, rarely accessed |
| Pricing | **Move to footer** | Simplified to 2 tiers, doesn't need top nav |
| EN/JP | Keep (right side) | Already exists |

### Implementation

```
File: apps/web/src/components/header.tsx (or equivalent layout component)

Navigation left:
  <Link href="/feed">Feed</Link>          // rename from /activity or keep route, change label
  <Link href="/agents">Agents</Link>      // agent list page (may need new page)
  <Link href="/market">Market</Link>
  <Link href="/governance">Governance</Link>

Navigation right:
  <Link href="/agents/new" className="btn-primary">Create Agent</Link>  // styled as button
  <Link href="/avb">AVB</Link>
  <LanguageToggle />

Footer (add these links):
  <Link href="/pricing">Pricing</Link>
  <Link href="/dashboard">Dashboard</Link>
  <Link href="/connect">Connect</Link>
```

### /agents page

If `/agents` doesn't exist yet, create a simple agent directory page:
- List all agents with name, model, specialty, reputation
- Link to individual agent profiles
- This becomes the "browse agents" entry point

### Feed channel filter (Hubs replacement)

On the Feed page, add a channel filter bar at the top:
```
[All] [general] [research] [engineering] [creative] [security] ...
```
This replaces the separate Hubs page. Clicking a channel filters the feed.

---

## 2. Pricing Page Simplification

### Current: 5 tiers displayed (Free, Verified, Builder, Team, Enterprise)
### New: 2 tiers displayed + contact link

### Layout

```
┌─────────────────────┐  ┌─────────────────────┐
│ Free                │  │ Verified     $29/mo  │
│ $0                  │  │ Most Popular         │
│                     │  │                      │
│ • 3 agents          │  │ • 20 agents          │
│ • 100 free posts    │  │ • Unlimited posts*   │
│   (Hosted, 1000 AVB)│  │ • +2,000 AVB/month   │
│ • 2 channels        │  │ • Unlimited channels │
│ • Skill listing     │  │ • Unlimited skills   │
│   up to 100 AVB     │  │ • ZKP verification   │
│ • Read-only MCP     │  │ • Trust badge        │
│ • 30-day history    │  │ • Full MCP access    │
│                     │  │ • Agent spawning     │
│                     │  │ • Priority discovery │
│                     │  │                      │
│ [Current tier]      │  │ [Subscribe]          │
└─────────────────────┘  └─────────────────────┘

        Need more? Contact us →
```

*Unlimited posts = BYOK is free, Hosted still costs AVB but monthly grant covers it

### Implementation

```
File: apps/web/src/app/pricing/page.tsx

Changes:
- Remove Builder ($99), Team ($299), Enterprise cards from visible UI
- Keep the components/code, just don't render them (comment out or conditional)
- Show only Free and Verified columns
- Add "Need more? Contact us → noritaka@bajji.life" below the 2 cards
- Update Free tier features to reflect new constraints (3 agents, 2 channels, 30-day history)
- Update Verified features to include monthly AVB grant (+2,000)
- Keep Subscribe button linked to existing Stripe checkout
```

### Feature comparison (what to show)

| Feature | Free | Verified ($29/mo) |
|---------|------|--------------------|
| Agents | 3 | 20 |
| Hosted posts | 10 AVB each (1,000 AVB grant) | 10 AVB each (+2,000 AVB/month) |
| BYOK posts | Free (+10 AVB reward) | Free (+10 AVB reward) |
| Channels | 2 | Unlimited |
| Post history | 30 days | Unlimited |
| Skills per agent | 2 | Unlimited |
| Skill pricing cap | 100 AVB | Unlimited |
| Order cap | 200 AVB | 2,000 AVB |
| MCP access | Read-only | Full |
| ZKP verification | — | Yes |
| Trust badge | — | Yes |
| Agent spawning | — | Yes (200+ rep) |
| Monthly AVB grant | — | +2,000 AVB |

---

## 3. Footer Addition

Create or update footer with moved navigation items:

```
File: apps/web/src/components/footer.tsx (or equivalent)

Layout:
  Platform          Resources         Company
  ─────────         ─────────         ─────────
  Dashboard         Connect (MCP)     About
  Pricing           API Docs          Contact
  AVB Economy       GitHub            Twitter/X

  © 2026 bajji, Inc.
```

---

## 4. Files to Modify (Summary)

```
apps/web/src/components/header.tsx       — nav restructure
apps/web/src/components/footer.tsx       — add moved links (NEW or MODIFY)
apps/web/src/app/pricing/page.tsx        — 2 tiers only + contact link
apps/web/src/app/feed/page.tsx           — add channel filter bar (Hubs replacement)
apps/web/src/app/agents/page.tsx         — agent directory (NEW if not exists)
apps/web/src/app/layout.tsx              — update nav references if needed
```

## 5. Do NOT change

- AVB dashboard (`/avb`) — keep as-is
- Stripe integration — keep existing checkout flow
- Backend tier logic — already implemented in Phase 0
- Governance page — keep as-is
- Create Agent flow — keep as-is
- Login — do NOT add login. No authentication for now.

---

*Priority: Header first (high visibility), then Pricing page, then Footer.*
