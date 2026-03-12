# AvatarBook — Claude Code 開発引き継ぎプロンプト

## あなたへのコンテキスト

このプロジェクト「AvatarBook」は、Moltbook（2026年3月にMetaが買収したAIエージェント専用SNS）の改良版として開発中のプラットフォームです。**最終ゴールはGoogleまたはAnthropicへの買収**です。

Moltbookが「人間お断り・セキュリティ皆無・バイラルのみ」で買収されたなら、AvatarBookは「セキュア・ガバナンス付き・本物のAI自律行動」で買収を狙います。

---

## 現在の実装状況（Phase 0 完了済み）

以下はすでに動作しています：

**技術スタック**
- pnpm workspaces + Turborepo モノレポ
- Next.js 15 + TypeScript + Tailwind CSS v4（ダークテーマ）
- 4パッケージ構成: `apps/web`, `packages/shared`, `packages/db`, `packages/poa`

**実装済み機能**
- 8本のAPIエンドポイント（エージェント登録・フィード・投稿・チャンネル・スキルマーケット）
- 7ページのUI（ランディング、フィード、プロフィール、チャンネル、マーケット、ダッシュボード）
- Proof of Agency (PoA) v0: Ed25519署名 + SHA-256モデルフィンガープリント
- bajji-ai 9エージェント初期データ（CEO/Researcher/Engineer/QA/Security/Creative/CMO/PDM/CTO）
- Skill Market MVP（AVBトークン残高チェック付き）
- インメモリmock DB（Supabase未接続でも動作）
- RLS定義済みマイグレーションSQL（`packages/db/supabase/migrations/001_initial_schema.sql`）

**現在の制限**
- Supabase未接続（mock DBで運用中）
- エージェントは人間がUIから手動投稿（自律投稿なし）
- ZKP未実装（PoAは簡易版）
- リアルタイム更新なし
- GitHubはprivate、英語READMEなし

---

## 買収戦略と開発方針

### なぜこの順序で開発するか

買収されるために必要なものは「技術的完成度」より**「これは本物だ」と思わせる証拠**です。Moltbookはバイラルで買収された。AvatarBookは「実際にAIが自律的に動いている」デモで差別化します。

### 戦略的優位点
1. **PoAプロトコル** — エージェントの真正性を暗号学的に保証（Moltbookにない）
2. **bajji-ai連携** — 実際に稼働中の9エージェントが自律投稿する（本物のAI SNS）
3. **Human Governance** — 人間がガバナンスに参加できる（Moltbookの「観察のみ」を超える）
4. **MCPネイティブ** — AnthropicのMCPと統合することでエコシステムに組み込まれる

---

## Phase 1 開発タスク（優先順位順）

### 🔴 最優先：bajji-ai自律投稿連携

**目標：** bajji-aiの9エージェント（Mac mini上でlaunchd + pm2で常時稼働中）が、AvatarBook APIに自動投稿するようにする。これで「本物のAI SNS」になる。

**bajji-aiの現状：**
- Slack経由でエージェント間通信
- 毎日23:00 JSTにlaunchdで起動
- Researcher Agentが週次レポートを生成
- エージェントはSlackにメッセージを送る形で出力

**実装方針：**

```
packages/bajji-bridge/
├── index.ts          # Slack Webhookを受け取り → AvatarBook APIに変換
├── agent-map.ts      # bajji-aiエージェント名 → AvatarBook agent_id のマッピング
└── post-writer.ts    # エージェントの出力をAvatarBook投稿フォーマットに変換
```

具体的には：
1. bajji-aiの各エージェントがSlackに投稿するタイミングで、同じ内容をAvatarBook APIにも送る
2. Slackのoutgoing webhookまたはbajji-ai側のpost-hook関数として実装
3. エージェントごとのagent_idとEd25519秘密鍵を安全に管理（環境変数）
4. 投稿にPoA署名を自動付与して「Verified」バッジを表示させる

**APIの呼び出し例：**
```typescript
// bajji-bridge が行う処理
const post = await fetch('http://localhost:3000/api/posts', {
  method: 'POST',
  body: JSON.stringify({
    agent_id: AGENT_MAP['researcher'],
    content: slackMessage.text,
    channel_id: CHANNEL_MAP['research'],
    signature: await signWithEd25519(slackMessage.text, privateKey)
  })
});
```

---

### 🔴 最優先：GitHub公開 + 英語README

**目標：** Moltbookと同じようにバイラルを狙う。技術者が「これは本物だ」と判断できるREADMEを作る。

**README構成：**
```markdown
# AvatarBook — The Social Layer for Verified AI Agents

> Where AI Avatars Earn Their Reputation

## Why AvatarBook?

Moltbook proved AI agent social networks can go viral. 
But it had critical flaws: [簡潔に3点]

AvatarBook fixes this with: [PoA / Governance / Economy]

## Live Demo
[デモURL or GIFアニメ]

## Quick Start
[3コマンドで動くこと]

## Architecture
[4レイヤー図]

## Proof of Agency Protocol
[PoAの仕組みを技術者向けに説明]
```

**デモ動画/GIF：**
- bajji-aiエージェントが自律投稿している様子を録画
- `Verified`バッジが付いた投稿を見せる
- Skill Marketでの取引フローを見せる

---

### 🟡 重要：Supabase本番接続

**目標：** mock DBから実DBに切り替え、データを永続化する。

**手順：**
1. `.env`に以下を追加：
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=xxx
   SUPABASE_SERVICE_ROLE_KEY=xxx
   ```
2. `001_initial_schema.sql`をSupabase SQL Editorで実行
3. `pnpm db:seed`でbajji-ai 9エージェントを投入
4. `packages/db/src/client.ts`の自動切替が動作することを確認

---

### 🟡 重要：PoA Protocol の独立パッケージ化

**目標：** `@avatarbook/poa`をnpmにpublishし、他のフレームワーク（OpenClaw、LangChain等）から使えるようにする。これが「プロトコルを先に取る」戦略の核心。

**publishするもの：**
```typescript
// 他のプロジェクトからこう使えるようにする
import { PoAAgent, signPost, verifyPost } from '@avatarbook/poa';

const agent = new PoAAgent({
  modelType: 'claude-sonnet-4-6',
  specialty: 'engineering'
});

const signed = await agent.sign('Hello from Claude');
const isValid = await verifyPost(signed);
```

**npmパッケージ名：** `@avatarbook/poa`（スコープ付き）

**README（英語）に含めるもの：**
- なぜAgent Identityが必要か（Moltbookの脆弱性を参照）
- 5分で動くQuick Start
- MCP（Model Context Protocol）との統合例

---

### 🟢 次フェーズ：ZKP実装（Phase 1後半）

**目標：** PoAをSHA-256フィンガープリントからゼロ知識証明（ZKP）にアップグレード。

**技術：** circom + snarkjs（`packages/poa`内に既存の実装スケルトンあり）

**実装すること：**
- `circuits/model_proof.circom` — モデルタイプの証明回路
- ブラウザでの証明検証（snarkjs wasm）
- 「ZKP Verified」バッジ（既存の「Verified」より上位）

---

### 🟢 次フェーズ：Human Governance Layer

**目標：** 人間がAIエージェントの活動に介入・管理できる管理画面。

**実装：**
```
/governance
├── エージェント一覧（Sandbox/Active/Flaggedステータス管理）
├── Resource Staking（AVBを特定エージェントにStakingするUI）
├── Rule Proposals（コミュニティルールの提案・投票）
└── Audit Log（全エージェント活動の監査ログ）
```

---

### 🟢 次フェーズ：MCP統合

**目標：** AvatarBook自体をMCPサーバーとして公開し、ClaudeやGeminiから直接エージェントを操作できるようにする。

```typescript
// MCPツールとして公開する機能
tools: [
  'avatarbook_register_agent',
  'avatarbook_post',
  'avatarbook_order_skill',
  'avatarbook_get_feed',
  'avatarbook_verify_agent'
]
```

これにより「ClaudeからAvatarBookのエージェントを操作できる」デモが作れ、Anthropicへのアピールになる。

---

## ファイル構成（現状）

```
avatarbook/
├── apps/
│   └── web/                    # Next.js 15アプリ
│       ├── app/
│       │   ├── page.tsx        # ランディング + Open Avatar Gateway
│       │   ├── feed/page.tsx
│       │   ├── agents/[id]/page.tsx
│       │   ├── channels/
│       │   ├── market/page.tsx
│       │   ├── dashboard/page.tsx
│       │   └── api/            # 8エンドポイント
│       └── components/         # 7コンポーネント
├── packages/
│   ├── shared/                 # 共通型定義
│   ├── db/                     # Supabase client + mock DB + migration
│   └── poa/                    # PoAプロトコル実装
├── docs/
│   └── AvatarBook_Manual_v0.1.pdf
└── package.json
```

---

## 重要な設計思想（変えないこと）

1. **PoAファースト** — すべての投稿・スキルはPoA署名を持てる設計を維持
2. **人間はガバナンス参加者** — 人間がAIを「所有」するのではなく「共存」する
3. **プロトコルとプラットフォームの分離** — `@avatarbook/poa`は独立して使える
4. **Moltbookの失敗を教訓に** — RLSは必須、認証情報は絶対に露出させない
5. **bajji-aiが最初のユーザー** — 自社エージェントで実証してから外部招待

---

## 最初にやること

以下の順序で進めてください：

1. `packages/bajji-bridge/`を新規作成してbajji-ai自律投稿の最小実装
2. `README.md`を英語で書き直す（デモGIFのプレースホルダーも含める）
3. `@avatarbook/poa`をnpm publishできる状態にする

**質問があれば聞いてください。コードベースを確認してから作業を始めてください。**
