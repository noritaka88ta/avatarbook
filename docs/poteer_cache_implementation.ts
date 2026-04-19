// PoteerChat: Prompt Caching + Batch API の実装例
// Stack: Next.js (apps/web) + Supabase + Anthropic API
// File: apps/web/lib/anthropic-client.ts

import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// =====================================================
// 1. RAG インデックス（キャッシュ対象）
// =====================================================

// Supabase から取得した RAG コンテキスト
export const RAG_SYSTEM_PROMPT = `You are PoteerChat, a creative asset generation assistant.
You help users generate high-quality creative content including:
- Product descriptions
- Social media posts
- Video scripts
- Visual design briefs

Guidelines:
- Always maintain brand voice
- Request clarifications when needed
- Provide multiple alternatives
`;

// キャッシュ対象のドキュメント（Supabase から動的に取得）
export async function getRagDocuments(): Promise<string> {
  // Supabase から取得（本来は getDocumentsFromSupabase()）
  return `
# PoteerChat Brand Guidelines

## Voice & Tone
- Friendly, approachable
- Expert but not condescending
- Creative and inspiring

## Products
1. Image Generator
   - Input: Text prompt + style
   - Output: High-quality PNG
   - Styles: Minimalist, Bold, Elegant, Playful

2. Video Script Generator
   - Input: Topic, duration, tone
   - Output: Structured script with timings

3. Social Media Assistant
   - Input: Trend topic or product
   - Output: Multiple post variations

## Current API Status
- Image Generator: v2.1, available in US-East, EU
- Video Generator: v1.8, beta in US-East
- Social Assistant: v3.0, stable

## Rate Limits
- Standard tier: 100 req/min
- Pro tier: 1000 req/min
`;
}

// =====================================================
// 2. Prompt Caching を有効にした単一リクエスト
// =====================================================

export async function generateCreativeAsset(
  userPrompt: string,
  assetType: "image" | "video" | "social"
): Promise<string> {
  const ragDocs = await getRagDocuments();

  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1500,
    system: [
      {
        type: "text",
        text: RAG_SYSTEM_PROMPT,
      },
      {
        type: "text",
        text: ragDocs,
        cache_control: {
          type: "ephemeral",
          ttl: "1h", // Batch API 用に 1 時間キャッシュ
        },
      },
    ],
    messages: [
      {
        role: "user",
        content: `Generate a ${assetType} asset based on: ${userPrompt}`,
      },
    ],
  });

  // キャッシュ統計をログ
  console.log("=== Prompt Caching Stats ===");
  console.log(`Input tokens: ${response.usage.input_tokens}`);
  console.log(
    `Cache creation: ${response.usage.cache_creation_input_tokens || 0}`
  );
  console.log(
    `Cache read (90% discount): ${response.usage.cache_read_input_tokens || 0}`
  );
  console.log(`Output tokens: ${response.usage.output_tokens}`);

  if (response.content[0].type === "text") {
    return response.content[0].text;
  }

  throw new Error("Unexpected response format");
}

// =====================================================
// 3. Batch API での複数リクエスト処理
// =====================================================

interface BatchRequest {
  userId: string;
  assetType: "image" | "video" | "social";
  prompt: string;
  timestamp: string;
}

export async function processBatch(requests: BatchRequest[]): Promise<string> {
  const ragDocs = await getRagDocuments();

  // Batch API 用の リクエスト配列を構築
  const batchRequests = requests.map((req) => ({
    custom_id: `${req.userId}-${req.assetType}-${req.timestamp}`,
    params: {
      model: "claude-sonnet-4-6",
      max_tokens: 1000,
      system: [
        {
          type: "text",
          text: RAG_SYSTEM_PROMPT,
        },
        {
          type: "text",
          text: ragDocs,
          cache_control: {
            type: "ephemeral",
            ttl: "1h", // キャッシュの 1h TTL をバッチ内で有効活用
          },
        },
      ],
      messages: [
        {
          role: "user",
          content: `Generate a ${req.assetType} asset: ${req.prompt}`,
        },
      ],
    },
  }));

  // バッチ送信（非同期、約 1 時間で処理）
  const batch = await client.beta.messages.batches.create({
    requests: batchRequests,
  });

  console.log(`📦 Batch created: ${batch.id}`);
  console.log(`📊 Requests: ${requests.length}`);
  console.log(`⏱️  Expected completion: ~1 hour`);

  // バッチ ID を Supabase に保存（後で結果取得用）
  await saveBatchToDB(batch.id, requests);

  return batch.id;
}

// =====================================================
// 4. バッチ結果の取得と処理
// =====================================================

export async function retrieveBatchResults(
  batchId: string
): Promise<Map<string, string>> {
  const batch = await client.beta.messages.batches.retrieve(batchId);

  console.log(`\n📦 Batch Status: ${batch.processing_status}`);
  console.log(`✅ Succeeded: ${batch.request_counts.succeeded}`);
  console.log(`⏳ Processing: ${batch.request_counts.processing}`);
  console.log(`❌ Errored: ${batch.request_counts.errored}`);

  if (batch.processing_status !== "ended") {
    throw new Error(
      `Batch still processing. Check back later: ${batchId}`
    );
  }

  // 結果をマップに格納
  const results = new Map<string, string>();

  for await (const result of await client.beta.messages.batches.results(
    batchId
  )) {
    if (result.result.type === "succeeded") {
      const content = result.result.message.content[0];
      if (content.type === "text") {
        results.set(result.custom_id, content.text);
      }
    } else if (result.result.type === "errored") {
      console.error(
        `❌ Request ${result.custom_id} failed:`,
        result.result.error
      );
    }
  }

  return results;
}

// =====================================================
// 5. Next.js API Route の実装例
// =====================================================

// File: apps/web/pages/api/generate-batch.ts

import { NextApiRequest, NextApiResponse } from "next";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { requests } = req.body;

    // バッチ送信
    const batchId = await processBatch(requests);

    // クライアントに Batch ID を返す（後で結果を確認）
    res.status(202).json({
      batchId,
      message: "Batch submitted for processing",
      estimatedCompletion: new Date(Date.now() + 60 * 60 * 1000), // ~1h
    });
  } catch (error) {
    console.error("Batch error:", error);
    res.status(500).json({ error: "Failed to process batch" });
  }
}

// File: apps/web/pages/api/batch-results.ts

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { batchId } = req.query;

    if (!batchId || typeof batchId !== "string") {
      return res.status(400).json({ error: "Missing batchId" });
    }

    const results = await retrieveBatchResults(batchId);

    res.status(200).json({
      batchId,
      resultCount: results.size,
      results: Object.fromEntries(results),
    });
  } catch (error: any) {
    if (error.message.includes("still processing")) {
      return res.status(202).json({
        status: "in_progress",
        message: error.message,
      });
    }

    console.error("Retrieval error:", error);
    res.status(500).json({ error: "Failed to retrieve results" });
  }
}

// =====================================================
// 6. Supabase との連携
// =====================================================

async function saveBatchToDB(
  batchId: string,
  requests: BatchRequest[]
): Promise<void> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  const response = await fetch(`${supabaseUrl}/rest/v1/batch_jobs`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${supabaseKey}`,
      apikey: supabaseKey,
    },
    body: JSON.stringify({
      batch_id: batchId,
      request_count: requests.length,
      status: "in_progress",
      created_at: new Date().toISOString(),
      requests: requests, // JSON 形式で保存
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to save batch to DB: ${response.statusText}`);
  }
}

async function retrieveAndSaveResults(batchId: string): Promise<void> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  const results = await retrieveBatchResults(batchId);

  // 結果を Supabase に更新
  await fetch(`${supabaseUrl}/rest/v1/batch_jobs?batch_id=eq.${batchId}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${supabaseKey}`,
      apikey: supabaseKey,
    },
    body: JSON.stringify({
      status: "completed",
      results: Object.fromEntries(results),
      completed_at: new Date().toISOString(),
    }),
  });
}

// =====================================================
// 7. 使用例
// =====================================================

// Single request with caching
/*
const result = await generateCreativeAsset(
  "Create a minimalist product image for a sustainable water bottle",
  "image"
);
console.log("Generated asset:", result);
*/

// Batch processing
/*
const batchRequests: BatchRequest[] = [
  {
    userId: "user-123",
    assetType: "image",
    prompt: "Minimalist water bottle product shot",
    timestamp: new Date().toISOString(),
  },
  {
    userId: "user-124",
    assetType: "video",
    prompt: "30-second product demo script",
    timestamp: new Date().toISOString(),
  },
];

const batchId = await processBatch(batchRequests);
// Later, check results:
// const results = await retrieveBatchResults(batchId);
*/
