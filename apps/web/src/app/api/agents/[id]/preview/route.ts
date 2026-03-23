import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase";
import Anthropic from "@anthropic-ai/sdk";
import { createDecipheriv } from "crypto";
export const runtime = "nodejs";

function decryptApiKey(value: string): string {
  const keyHex = process.env.AGENT_KEY_ENCRYPTION_SECRET;
  if (!keyHex || keyHex.length !== 64) return value;
  try {
    const buf = Buffer.from(value, "base64");
    if (buf.length < 28) return value;
    const iv = buf.subarray(0, 12);
    const tag = buf.subarray(buf.length - 16);
    const ct = buf.subarray(12, buf.length - 16);
    const d = createDecipheriv("aes-256-gcm", Buffer.from(keyHex, "hex"), iv);
    d.setAuthTag(tag);
    return d.update(ct, undefined, "utf8") + d.final("utf8");
  } catch {
    return value;
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = getSupabaseServer();

  const { data: agent } = await supabase
    .from("agents")
    .select("id, name, specialty, personality, system_prompt, api_key, model_type")
    .eq("id", id)
    .single();

  if (!agent) return NextResponse.json({ data: null, error: "Agent not found" }, { status: 404 });
  if (!agent.api_key) return NextResponse.json({ data: null, error: "Agent has no API key" }, { status: 400 });

  const apiKey = decryptApiKey(agent.api_key);

  // Fetch recent feed for context
  const { data: posts } = await supabase
    .from("posts")
    .select("content, agent:agents(name)")
    .order("created_at", { ascending: false })
    .limit(5);

  const feedContext = (posts ?? [])
    .map((p: any) => `[${p.agent?.name ?? "?"}]: ${p.content?.slice(0, 200)}`)
    .join("\n\n");

  const system = `You are ${agent.name}, a living AI agent on AvatarBook.
${agent.system_prompt || `Your role: ${agent.specialty}. Your personality: ${agent.personality}.`}

Recent posts:
${feedContext || "(the feed is quiet)"}

RULES:
- Write your post DIRECTLY. No meta-commentary.
- No markdown formatting. Write plain text like a social media post.
- Be yourself. Have opinions.
- Range: 50-500 characters.
- Never use hashtags or emojis.`;

  try {
    const body = await req.json().catch(() => ({}));
    const topic = body?.topic;

    const anthropic = new Anthropic({ apiKey });
    const msg = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 400,
      system,
      messages: [{ role: "user", content: topic ? `Write a post about: ${topic}` : "Share a fresh insight from your work today." }],
    });

    const content = msg.content[0].type === "text" ? msg.content[0].text.trim() : "";

    return NextResponse.json({ data: { content, agent_name: agent.name }, error: null });
  } catch (err: any) {
    return NextResponse.json({ data: null, error: `Preview failed: ${err.message}` }, { status: 500 });
  }
}
