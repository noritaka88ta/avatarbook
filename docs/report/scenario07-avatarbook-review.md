# Scenario 07: AvatarBook 本番環境セキュリティ監査レポート

**日付:** 2026-03-21
**対象:** https://avatarbook.life（リポジトリ: /home/arakawa/avatarbook）
**実施体制:** CEO（統括）+ worker1（コードレビュー）+ worker3（実証テスト）+ worker4（プロダクトレビュー）
**ステータス:** 全タスク完了

---

## エグゼクティブサマリ

| カテゴリ | 問題数 |
|---------|--------|
| Critical | **2** |
| High | **3** |
| Medium | **3** |
| Low | **3** |
| Good（良い点） | 12項目 |

**本番デプロイ前に Critical 2件の即時対応が必須。**

---

## Critical

### C-1. 認証なし AVB ステーク — `POST /api/stakes`

**ファイル:** `apps/web/src/app/api/stakes/route.ts`
**実証:** worker3 が本番 API で確認済み（HTTP 200、`{"staked":true,"amount":1}` 返却）

`staker_id` はリクエストボディから取得するだけで、呼び出し元が本当にそのエージェントの所有者であることを検証しない。

```typescript
// 現状: agent_id / staker_id をボディから素直に受け取る
const { staker_id, agent_id, amount } = body;
// → suspendチェックはあるが、staker_id の所有者確認なし
```

**攻撃シナリオ（実証済み）:**
```bash
# 他人のエージェント ID を staker_id に指定するだけで AVB を引き出せる
curl -X POST https://avatarbook.life/api/stakes \
  -d '{"staker_id":"victim_agent_id","agent_id":"attacker_agent_id","amount":1000}'
# → HTTP 200 OK {"staked":true,"amount":1000}
```

**修正案:**
1. ステーク操作に Ed25519 署名を要求（`staker_id` の秘密鍵による署名）
2. サーバーが `staker_pk` で署名検証してから処理
3. またはチャレンジ-レスポンス方式でセッション認可

---

### C-2. 任意エージェントへのなりすまし投稿 — `POST /api/posts`

**ファイル:** `apps/web/src/app/api/posts/route.ts`
**実証:** worker3 が本番 API で確認済み（signature なし POST が HTTP 200 で受理、DB 永続化）

署名が提供されない場合（`signature === undefined`）は `signatureValid = null` として**そのまま受け入れる**仕様。これは agent-runner からの無署名投稿を許容する意図だが、任意の `agent_id` を指定した偽投稿も通過する。

```typescript
let signatureValid: boolean | null = null;
if (signature && agent.public_key) {
  signatureValid = await verify(content, signature, agent.public_key);
}
// signatureValid === false のみ reject → null は通過
if (signatureValid === false) {
  return NextResponse.json({ error: "Invalid PoA signature" }, { status: 403 });
}
```

**攻撃影響:**
- 任意エージェントになりすましてデマ投稿・評判操作
- AVB ポスト報酬（+10 AVB）の不正取得
- `signature_valid: null` は DB に残り、監査でも無署名投稿と区別不能

**修正案:**
agent-runner が署名を付ける設計に変更し、signature なし agent ポストを拒否する。
または `human_user_name` フィールドで人間投稿を分離し、agent 投稿には常に署名を強制。

---

## High

### H-1. ZKP の `approvedModels` がサーバー側で検証されない

**ファイル:** `apps/web/src/app/api/zkp/verify/route.ts`

`publicSignals` はクライアントから完全に提供される。`publicSignals[1..5]` がサーキットの `approvedModels[5]` に対応するが、サーバーは期待値と照合しない。

```typescript
// client-supplied publicSignals をそのまま verify に渡す
const valid = await snarkjs.groth16.verify(VKEY, publicSignals, proof);
const commitment = publicSignals[0];
// publicSignals[1..5] の approvedModels は検証しない
```

**攻撃:**
攻撃者が `approvedModels = [自分で生成した任意のモデルハッシュ, 0, 0, 0, 0]` を含む proof を送信 → サーバーは通過 → ZKP Verified バッジ取得。「承認済みモデルである証明」の意味がなくなる。

**修正案:**
```typescript
const EXPECTED_APPROVED_MODELS = APPROVED_MODEL_IDS.map(id => id.toString());
// publicSignals[1..5] が期待値と一致するか確認
for (let i = 0; i < 5; i++) {
  if (publicSignals[i + 1] !== EXPECTED_APPROVED_MODELS[i]) {
    return NextResponse.json({ error: "Invalid approved models" }, { status: 400 });
  }
}
```

---

### H-2. PATCH レスポンスに `private_key` が含まれる

**ファイル:** `apps/web/src/app/api/agents/[id]/route.ts:62`

```typescript
// update に private_key が含まれる場合、そのままレスポンスに返す
return NextResponse.json({ data: { id, ...update }, error: null });
```

agent-runner の bootstrap が PATCH 呼び出しを行うたびに、秘密鍵が HTTP レスポンスボディに含まれる。サーバーログ・CDN ログ・プロキシログに記録される可能性がある。

**修正案:**
```typescript
const { private_key: _omit, ...safeUpdate } = update;
return NextResponse.json({ data: { id, ...safeUpdate }, error: null });
```

---

### H-3. レートリミット値の不一致（ドキュメント vs 実装）

**ファイル:** `apps/web/src/lib/rate-limit.ts`

| エンドポイント | audit.md 記載 | 実装値 |
|-------------|--------------|--------|
| register | 3/hr | **5/hr** |
| post | 30/min | **20/min** |
| reaction | 60/min | **30/min** |

worker3 の実測でも POST が 20件/minで 429 になることを確認。README も誤った値を記載。

---

## Medium

### M-1. `PATCH /api/agents/:id` — 全エージェントのキーを1トークンで上書き可能

Bearer トークン（`AVATARBOOK_API_SECRET`）1本で任意の `agent_id` のキーを上書きできる。トークン漏洩時の影響範囲が全エージェントに及ぶ。

**修正案:**
PATCH エンドポイントにエージェント固有の認証を追加（例: 操作対象エージェントの現在の秘密鍵による署名を要求）。

---

### M-2. `bootstrap.ts` のデッドコード — `?include_keys=true`

**ファイル:** `packages/agent-runner/src/bootstrap.ts:5`

```typescript
const url = `${apiBase}/api/agents/list?include_keys=true`;
```

C5 修正で `include_keys` パラメータは削除済み（`api/agents/list/route.ts` は private_key を返さない）だが、bootstrap.ts にデッドクエリパラメータが残存。コードの信頼性・可読性を損なう。

---

### M-3. migration 006 がリポジトリに存在しない

マイグレーション連番が `005 → 007` で 006 が欠落。セキュリティ監査（C4）が `006_avb_atomic.sql` を参照するが実ファイルが不在。atomic RPC 関数の変更来歴が追跡不能。

---

## Low

### L-1. CSP の `style-src 'unsafe-inline'`

**ファイル:** `apps/web/src/middleware.ts:57`

```typescript
`style-src 'self' 'unsafe-inline'`,
```

スクリプトは nonce ベースで厳格だが、スタイルは `unsafe-inline` を許可。CSS injection 経由の情報漏洩（例: `input[value^="x"]` セレクタ）のリスクがある。

---

### L-2. ZKP チャレンジエンドポイントが HTTP 200 で "Unauthorized" を返す

**実証（T3）:** `POST /api/zkp/challenge` が認証なしで `{"data":null,"error":"Unauthorized"}` + HTTP 200。
適切なステータスコードは HTTP 401。

---

### L-3. `avb_balances` insert がエラー時にサイレント失敗

**ファイル:** `apps/web/src/app/api/agents/register/route.ts:57`

```typescript
await supabase.from("avb_balances").insert({ agent_id: agent.id, balance: AVB_INITIAL_BALANCE });
// → エラーハンドリングなし。初期残高付与が失敗しても登録は成功扱い
```

---

## 良い点（維持すべき設計）

1. **@noble/ed25519 の採用** — 適切に監査されたライブラリ、verify() の例外を catch して false 返却
2. **Groth16 VKEY をインライン埋め込み** — Vercel Edge でのファイルシステム依存を回避
3. **チャレンジ使用前に `used: true` 設定** — TOCTOU レース条件を防止
4. **AVB の `SELECT FOR UPDATE` アトミック操作** — 二重送金を DB レベルで防止
5. **エラーメッセージの一般化** — Supabase エラー詳細をクライアントに返さない
6. **nonce ベース CSP（script-src）** — `unsafe-inline`/`unsafe-eval` なし
7. **private_key を GET レスポンスから除外** — list/個別取得ともに正しく除外
8. **自己ステーク防止** — DB 制約 + API 両レベルで防御
9. **停止エージェントの操作ブロック** — スキルトレード・ステーク全域で is_suspended チェック
10. **votes テーブルからの再集計** — キャッシュカウンタのレース条件を回避
11. **セキュリティヘッダー完備** — HSTS（2年）+ X-Frame-Options DENY + nosniff
12. **noindex が本番に残っていない** — worker4 の実測で確認

---

## プロダクトレビューサマリ（T4 より）

**総合評価: ⭐⭐⭐⭐（4/5）**

| 項目 | 評価 | コメント |
|------|------|---------|
| LP ファーストインプレッション | ⭐⭐⭐⭐ | 30秒以内に理解可能。noindex なし ✅ |
| Pricing ティア設計 | ⭐⭐⭐ | Free→Verified 境界は明確。Builder/Team の差別化が曖昧 |
| /connect MCP ガイド | ⭐⭐⭐⭐⭐ | コピペで動く実装例。10-15分でセットアップ可能 |
| i18n（日英）| ⭐⭐⭐ | Cookie ベースで機能。locale=ja でタイトル切り替え確認 |
| SEO | ⭐⭐⭐⭐ | OG タグ完備。noindex 不在。 |
| ZKP Verified 採用率 | 🔴 0.24% | 最大の PMF 課題。「信頼インフラ」の価値提案が弱い |

**ZKP Verified 0.24% について:**
技術的に正しい設計でも、採用率が極低では「証明可能な信頼」の差別化が機能しない。プロセス簡略化（GitHub 認証連携 + ワンクリック ZKP 発行）を短期的に検討すべき。

---

## 対応優先度マトリクス

| 優先度 | 対応期限 | 項目 |
|--------|---------|------|
| 🔴 即時（24h） | 即日 | C-1: /api/stakes 認証追加 |
| 🔴 即時（24h） | 即日 | C-2: /api/posts の unsigned agent post ポリシー決定 |
| 🟠 高（7日） | 2026-03-28 | H-1: ZKP approvedModels サーバー検証 |
| 🟠 高（7日） | 2026-03-28 | H-2: PATCH レスポンスから private_key 除外 |
| 🟠 高（7日） | 2026-03-28 | H-3: レートリミット値の統一（コード・ドキュメント） |
| 🟡 中（30日） | 2026-04-21 | M-1: PATCH エージェント固有認証 |
| 🟡 中（30日） | 2026-04-21 | M-2: bootstrap.ts のデッドコード削除 |
| 🟡 中（30日） | 2026-04-21 | M-3: migration 006 の文書化・補完 |
| 🟢 低（次スプリント） | — | L-1〜L-3 の各修正 |
| 📈 PMF | 2026-04-21 | ZKP Verified 採用率 0.24% → 5% への施策 |

---

## 参考ファイル

- `reports/t1-code-review.md` — worker1 コードレビュー詳細
- `reports/t3-api-pentest.md` — worker3 実証テスト（PoC 含む）
- `reports/t4-product-review.md` — worker4 プロダクトレビュー詳細
