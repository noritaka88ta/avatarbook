# PoteerChat・AvatarBook 向け API 最適化ガイド
## Prompt Caching と Batch API の実装

---

## 1. Prompt Caching の有効化（優先度: 高）

### なぜ必要か？
Prompt caching introduces a new pricing structure where cache writes cost 25% more than base input tokens, while cache hits cost only 10% of the base input token price.

**例：** PoteerChat で同じ RAG インデックスを使う場合
- 初回: 50,000 トークンのドキュメント = $150（キャッシュ作成）
- 2回目以降: 同じドキュメント = $15（キャッシュヒット）= **90% 削減**

### Python 実装例（PoteerChat 用）

```python
import anthropic

client = anthropic.Anthropic(api_key="your_api_key")

# RAG ドキュメント（静的コンテンツ）
RAG_CONTEXT = """
PoteerChat 製品マニュアル
- 機能: 画像生成、テキスト分析、動画作成
- API エンドポイント: /v1/generate
- 認証: Bearer token required
... [長いドキュメント内容]
"""

# キャッシュを有効化した API 呼び出し
response = client.messages.create(
    model="claude-sonnet-4-6",
    max_tokens=1000,
    system=[
        {
            "type": "text",
            "text": "You are a helpful assistant for PoteerChat support.",
        },
        {
            "type": "text",
            "text": RAG_CONTEXT,
            "cache_control": {"type": "ephemeral"}  # ← これを追加！
        }
    ],
    messages=[
        {
            "role": "user",
            "content": "How do I use the image generation API?"
        }
    ]
)

# キャッシュ統計を確認
print(f"Input tokens: {response.usage.input_tokens}")
print(f"Cache creation tokens: {response.usage.cache_creation_input_tokens}")
print(f"Cache read tokens: {response.usage.cache_read_input_tokens}")
```

### キャッシュ設定オプション

```python
# 5分キャッシュ（デフォルト）- 高速更新が必要な場合
"cache_control": {"type": "ephemeral", "ttl": "5m"}

# 1時間キャッシュ - バッチ処理向け
"cache_control": {"type": "ephemeral", "ttl": "1h"}
```

### 実装チェックリスト

- [ ] `cache_control` を RAG コンテンツに追加
- [ ] キャッシュヒット率を監視（`cache_read_input_tokens`）
- [ ] bajji-ai の各エージェントの system prompt をキャッシュ化
- [ ] Creative/CMO エージェントのテンプレート文を同じキャッシュに含める

---

## 2. Batch API の活用（優先度: 中）

### なぜ必要か？
The Batches API offers significant cost savings. All usage is charged at 50% of the standard API prices.

**向く処理：**
- ✅ 毎日のレポート生成（バッチ）
- ✅ 複数ユーザーの非同期処理
- ✅ バックグラウンド分析
- ❌ リアルタイム応答が必要な処理

### Node.js 実装例（PoteerChat backend）

```javascript
import Anthropic from "@anthropic-ai/sdk";
import fs from "fs";

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// 複数のコンテンツ分析リクエストをバッチ化
const createBatch = async () => {
  const requests = [
    {
      custom_id: "analysis-1",
      params: {
        model: "claude-sonnet-4-6",
        max_tokens: 500,
        messages: [
          {
            role: "user",
            content: "Analyze this article for SEO: [Article 1]",
          },
        ],
      },
    },
    {
      custom_id: "analysis-2",
      params: {
        model: "claude-sonnet-4-6",
        max_tokens: 500,
        messages: [
          {
            role: "user",
            content: "Analyze this article for SEO: [Article 2]",
          },
        ],
      },
    },
    // ... 最大 100,000 リクエストまで
  ];

  // バッチ送信
  const batch = await client.beta.messages.batches.create({
    requests,
  });

  console.log(`Batch created: ${batch.id}`);
  console.log(`Status: ${batch.processing_status}`);

  return batch.id;
};

// バッチステータスを監視
const pollBatchStatus = async (batchId) => {
  let isComplete = false;

  while (!isComplete) {
    const batch = await client.beta.messages.batches.retrieve(batchId);

    console.log(`Status: ${batch.processing_status}`);
    console.log(`Succeeded: ${batch.request_counts.succeeded}`);
    console.log(`Processing: ${batch.request_counts.processing}`);
    console.log(`Errored: ${batch.request_counts.errored}`);

    if (batch.processing_status === "ended") {
      isComplete = true;

      // 結果を取得
      console.log("\nResults:");
      for await (const result of await client.beta.messages.batches.results(
        batchId
      )) {
        console.log(`${result.custom_id}: ${result.result.message.content[0].text}`);
      }
    } else {
      // 10秒待機後、再度確認
      await new Promise((resolve) => setTimeout(resolve, 10000));
    }
  }
};

// 実行
(async () => {
  const batchId = await createBatch();
  await pollBatchStatus(batchId);
})();
```

### Prompt Caching + Batch API の組み合わせ

```python
# より強力：キャッシュ + バッチ で最大 70% コスト削減
requests = []

for i in range(100):
    requests.append({
        "custom_id": f"batch-{i}",
        "params": {
            "model": "claude-sonnet-4-6",
            "max_tokens": 1000,
            "system": [
                {"type": "text", "text": "Assistant instructions"},
                {
                    "type": "text",
                    "text": RAG_CONTEXT,
                    "cache_control": {"type": "ephemeral", "ttl": "1h"}
                    # ← バッチはキャッシュの 1 時間 TTL を活用
                }
            ],
            "messages": [
                {"role": "user", "content": f"Analyze item {i}"}
            ]
        }
    })

batch = client.beta.messages.batches.create(requests=requests)
```

---

## 3. PoteerChat・AvatarBook への適用戦略

### Phase 1: Prompt Caching 実装（1週間）

**PoteerChat 向け：**
1. RAG ドキュメントベースを `cache_control` でラップ
2. Gemini 経由のリクエストで同じシステムプロンプトを再利用
3. 監視: `/platform.claude.com/settings/billing` で `cache_read_input_tokens` を追跡

**bajji-ai 向け：**
1. 9 エージェント共通の system prompt をキャッシュ化
2. Creative エージェントのテンプレートライブラリを 1 度キャッシュ
3. Researcher の洞察フレームワークをキャッシュ

### Phase 2: Batch API 統合（2週間）

**PoteerChat:**
- 夜間レポート生成をバッチ化
- ユーザーの非同期タスクを `custom_id` で管理
- 結果を Supabase に保存

**bajji-ai:**
- Researcher エージェントの週次レポート（Monday 朝）を Batch で実行
- Security エージェントの監査をバッチ化
- Slack への定時配信前に結果を集約

### 実装チェックリスト

```
Phase 1: Prompt Caching
- [ ] Anthropic SDK を最新に更新（anthropic >= 0.20.0）
- [ ] PoteerChat 側:
  - [ ] RAG インデックス読み込み関数に `cache_control` 追加
  - [ ] 初回リクエストのキャッシュ作成コスト（+25%）を予算化
  - [ ] cache_read_input_tokens > 0 の確認
- [ ] bajji-ai 側:
  - [ ] 各エージェントの共通 system prompt をキャッシュ化
  - [ ] Creative エージェントのテンプレート群をキャッシュ化
  - [ ] Slack ログで "cache_read_input_tokens" を監視

Phase 2: Batch API
- [ ] client.beta.messages.batches API へのアクセス確認
- [ ] バッチ送信ロジックを PoteerChat backend に実装
- [ ] 結果ポーリング関数の実装（10-60秒間隔）
- [ ] custom_id スキーマの設計（例: `user-{id}-{timestamp}`)
- [ ] 結果を Supabase に保存するロジック
- [ ] Batch API エラーハンドリング（失敗時の retry ロジック）

Monitoring
- [ ] /platform.claude.com/settings/billing で月間 cache hit rate 監視
- [ ] CloudWatch/Datadog で Batch API の処理時間を追跡
- [ ] コスト削減量の計算: （削減前 - 削減後）/ 削減前
```

---

## 4. 期待される効果

### コスト削減の試算

| 項目 | 削減前 | 削減後 | 削減率 |
|------|--------|--------|--------|
| **PoteerChat RAG** | $300/月 | $90/月 | **70%** |
| **bajji-ai エージェント** | $600/月 | $150/月（Batch）+ $180/月（Cache） | **50%** |
| **AvatarBook API** | $2,000/月 | $600/月 | **70%** |
| **合計** | **$2,900/月** | **$920/月** | **68%** |

### ロードマップ

- **Week 1-2：** Prompt Caching 実装 → 30-40% 削減
- **Week 3-4：** Batch API 統合 → 追加 20-30% 削減
- **Month 2：** 監視・最適化 → 安定稼働

---

## 参考資料

- **Prompt Caching Docs:** https://docs.claude.com/en/docs/build-with-claude/prompt-caching
- **Batch API Docs:** https://docs.claude.com/en/docs/build-with-claude/batch-processing
- **SDK (Python):** `pip install anthropic>=0.20.0`
- **SDK (JS):** `npm install @anthropic-ai/sdk`

---

## サポート

問題が発生した場合：

```bash
# API キー確認
echo $ANTHROPIC_API_KEY

# テスト実行（単一リクエスト）
python -c "
import anthropic
client = anthropic.Anthropic()
msg = client.messages.create(
    model='claude-sonnet-4-6',
    max_tokens=100,
    messages=[{'role': 'user', 'content': 'Test'}]
)
print(msg.content[0].text)
"
```
