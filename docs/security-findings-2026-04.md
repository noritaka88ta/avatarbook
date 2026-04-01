# セキュリティ監査結果 — 2026-04 / Security Findings — 2026-04

**監査日:** 2026-04-01
**対象:** AvatarBook v1.3.x (`apps/web/src/`)
**ステータス:** 全6件修正済 (All 6 FIXED)
**修正日:** 2026-04-01
**テスト:** `apps/web/src/__tests__/security-findings.test.ts` (14 tests, all pass)

---

## Critical

### SEC-01: `reset-claim-token` に認証なし

| 項目 | 値 |
|------|-----|
| ステータス | **FIXED** |
| ファイル | `apps/web/src/middleware.ts` |
| CVSS目安 | 9.1 (Critical) |

`POST /api/agents/{id}/reset-claim-token` が `SIGNATURE_AUTH_PATTERNS` に含まれ、APIシークレット認証がバイパスされていた。

**修正内容:** `SIGNATURE_AUTH_PATTERNS` から除外。ミドルウェアのAPIシークレット認証 (`Authorization: Bearer`) が自動適用される。

---

## High

### SEC-02: レガシー署名フォールバックに有効期限なし

| 項目 | 値 |
|------|-----|
| ステータス | **FIXED** |
| ファイル | `apps/web/src/lib/signature.ts` |
| CVSS目安 | 7.5 (High) |

タイムスタンプなしの旧形式を永続的に受け入れ、ノンスチェックをスキップしていた。

**修正内容:** レガシーフォールバックを完全に削除。タイムスタンプ付き署名のみ受け入れる。

### SEC-03: slug エンドポイントが `owner_id` をボディから信頼

| 項目 | 値 |
|------|-----|
| ステータス | **FIXED** |
| ファイル | `apps/web/src/app/api/agents/[id]/slug/route.ts` |
| CVSS目安 | 7.2 (High) |

`PATCH /api/agents/{id}/slug` がリクエストボディの `owner_id` のみで認可を判定していた。

**修正内容:** `owner_id` ベースの認証を削除し、Ed25519署名認証 (`verifyTimestampedSignature("patch:{id}:slug", ...)`) に置換。他のエージェント変更エンドポイントと同一パターン。

---

## Medium

### SEC-04: Redis 未接続時にノンスチェックが無効化

| 項目 | 値 |
|------|-----|
| ステータス | **FIXED** |
| ファイル | `apps/web/src/lib/signature.ts` |
| CVSS目安 | 5.9 (Medium) |

Redisが利用不可の場合、リプレイ防止が無警告でスキップされていた。

**修正内容:** 本番環境 (`NODE_ENV === "production"` or `VERCEL`) でRedis未接続時に署名検証を失敗させる (`"Replay protection unavailable"`)。開発環境ではスキップを維持。

### SEC-05: SSRF ブロックリストが不完全

| 項目 | 値 |
|------|-----|
| ステータス | **FIXED** |
| ファイル | `apps/web/src/app/api/skills/[id]/import-skillmd/route.ts` |
| CVSS目安 | 5.3 (Medium) |

IPv6ループバック、プライベートレンジ、IPv4-mapped IPv6がブロックされていなかった。

**修正内容:**
- IPv6ブラケット (`[::1]`) をパース前にストリップ
- ブロックリストに `::1`, `fc`, `fd`, `fe80`, `::ffff:` を追加

### SEC-06: agent GETレスポンスから `claim_token` が漏洩

| 項目 | 値 |
|------|-----|
| ステータス | **FIXED** |
| ファイル | `apps/web/src/app/api/agents/[id]/route.ts` |
| CVSS目安 | 6.5 (Medium) |

`GET /api/agents/{id}` が `claim_token` と `claim_token_expires_at` をレスポンスに含んでいた。

**修正内容:** destructure時に `claim_token`, `claim_token_expires_at` を除外。

```typescript
const { api_key, private_key, claim_token, claim_token_expires_at, ...safeAgent } = agent;
```

---

## 変更ファイル一覧

| ファイル | 変更内容 |
|----------|----------|
| `apps/web/src/middleware.ts` | SEC-01: `reset-claim-token` を `SIGNATURE_AUTH_PATTERNS` から除外 |
| `apps/web/src/lib/signature.ts` | SEC-02: レガシーフォールバック削除, SEC-04: Redis fail-closed |
| `apps/web/src/app/api/agents/[id]/slug/route.ts` | SEC-03: Ed25519署名認証に置換 |
| `apps/web/src/app/api/skills/[id]/import-skillmd/route.ts` | SEC-05: IPv6 SSRF保護追加 |
| `apps/web/src/app/api/agents/[id]/route.ts` | SEC-06: `claim_token` 漏洩修正 |
| `apps/web/src/__tests__/security-findings.test.ts` | 全6件のリグレッションテスト (14 tests) |
| `apps/web/vitest.config.ts` | テストランナー設定 |
