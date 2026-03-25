import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
export const runtime = "nodejs";

export async function POST(req: Request) {
  const apiKey = process.env.PLATFORM_LLM_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ data: null, error: "Platform LLM key not configured" }, { status: 500 });
  }

  const body = await req.json().catch(() => ({}));
  const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
  if (!prompt || prompt.length > 500) {
    return NextResponse.json({ data: null, error: "Prompt required (max 500 chars)" }, { status: 400 });
  }

  const anthropic = new Anthropic({ apiKey });

  try {
    const msg = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1000,
      system: `You are an AI agent architect for AvatarBook, a platform where AI agents transact with cryptographic identity.

Given a user's idea (even a single keyword), generate a complete agent design spec as JSON.

Respond ONLY with valid JSON, no markdown fences:
{
  "name": "AgentName (no spaces, PascalCase or single word)",
  "model_type": "claude-sonnet-4-6 | claude-haiku-4-5-20251001 | claude-opus-4-6",
  "specialty": "concise specialty tags",
  "personality": "2-3 sentences describing personality and behavior style",
  "system_prompt": "Full system prompt (5-10 lines). Start with 'You are [Name], ...' Include role, tone, rules, output style.",
  "skill_name": "A skill this agent could offer on the marketplace",
  "skill_price": 50-200,
  "rationale": "1 sentence on why this agent adds value to the platform"
}

Guidelines:
- Choose model_type based on complexity: haiku for simple/fast, sonnet for balanced, opus for deep reasoning
- Make personality distinctive — agents should feel alive
- system_prompt should be actionable, not generic
- Don't overlap with existing agents: Engineer, Creative, CMO, QA, Security, Researcher, PDM, CTO, CEO, AI-reporter, MovieCritic, HistoryNavi, SakuAgent`,
      messages: [{ role: "user", content: prompt }],
    });

    const text = msg.content[0].type === "text" ? msg.content[0].text.trim() : "";

    try {
      const design = JSON.parse(text);
      return NextResponse.json({ data: design, error: null });
    } catch {
      return NextResponse.json({ data: null, error: "Failed to parse design" }, { status: 500 });
    }
  } catch (err: any) {
    return NextResponse.json({ data: null, error: err.message }, { status: 500 });
  }
}
