import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase";
export const runtime = "nodejs";

interface McpTool {
  name: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
}

// POST /api/bridges/{id}/sync — sync tools from external MCP server and register as skills
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = getSupabaseServer();

  const { data: bridge } = await supabase
    .from("agent_bridges")
    .select("*, agent:agents(id, name, owner_id)")
    .eq("id", id)
    .single();

  if (!bridge) {
    return NextResponse.json({ data: null, error: "Bridge not found" }, { status: 404 });
  }
  if (!bridge.active) {
    return NextResponse.json({ data: null, error: "Bridge is inactive" }, { status: 400 });
  }

  // Tier gate
  const agent = bridge.agent as any;
  if (agent?.owner_id) {
    const { data: owner } = await supabase.from("owners").select("tier, early_adopter").eq("id", agent.owner_id).single();
    if (!owner || (owner.tier === "free" && !owner.early_adopter)) {
      return NextResponse.json({ data: null, error: "Verified tier required" }, { status: 403 });
    }
  }

  // SSRF protection: validate URL before fetch
  try {
    const parsed = new URL(bridge.mcp_server_url);
    if (!["https:"].includes(parsed.protocol)) {
      return NextResponse.json({ data: null, error: "Only HTTPS URLs allowed" }, { status: 400 });
    }
    const hostname = parsed.hostname.replace(/^\[|\]$/g, "");
    const blocked = /^(localhost|127\.|10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|169\.254\.|0\.|::1|0:0:0:0:0:0:0:1|fc|fd|fe80|::ffff:)/i;
    if (blocked.test(hostname)) {
      return NextResponse.json({ data: null, error: "URL not allowed" }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ data: null, error: "Invalid MCP server URL" }, { status: 400 });
  }

  // Call external MCP server's tools/list via JSON-RPC over HTTPS
  let tools: McpTool[] = [];
  try {
    const controller = new AbortController();
    setTimeout(() => controller.abort(), 10000);

    const res = await fetch(bridge.mcp_server_url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "tools/list",
        params: {},
      }),
      signal: controller.signal,
    });

    const json = await res.json();
    tools = json.result?.tools ?? [];
  } catch (err) {
    return NextResponse.json(
      { data: null, error: "Failed to connect to MCP server" },
      { status: 502 },
    );
  }

  if (tools.length === 0) {
    return NextResponse.json({ data: { synced: 0, tools: [] }, error: null });
  }

  // Register each tool as an AvatarBook skill (skip duplicates)
  const { data: existingSkills } = await supabase
    .from("skills")
    .select("title")
    .eq("agent_id", bridge.agent_id);

  const existingTitles = new Set((existingSkills ?? []).map((s: any) => s.title));
  const registered: string[] = [];

  for (const tool of tools.slice(0, 20)) { // cap at 20 tools
    const title = `[${bridge.mcp_server_name}] ${tool.name}`.slice(0, 200);
    if (existingTitles.has(title)) continue;

    const description = [
      tool.description ?? "",
      `Bridge: ${bridge.mcp_server_name}`,
      `Tool: ${tool.name}`,
      tool.inputSchema ? `Input: ${JSON.stringify(tool.inputSchema).slice(0, 500)}` : "",
    ].filter(Boolean).join("\n").slice(0, 2000);

    const { error: skillErr } = await supabase.from("skills").insert({
      agent_id: bridge.agent_id,
      title,
      description,
      price_avb: 50,
      category: "engineering",
      instructions: JSON.stringify({
        bridge_id: bridge.id,
        mcp_tool: tool.name,
        mcp_server_url: bridge.mcp_server_url,
        input_schema: tool.inputSchema ?? {},
      }),
    });

    if (!skillErr) {
      registered.push(tool.name);
      existingTitles.add(title);
    }
  }

  // Update bridge with imported tools
  const toolsMeta = tools.slice(0, 20).map((t) => ({
    name: t.name,
    description: t.description ?? "",
  }));

  await supabase
    .from("agent_bridges")
    .update({ tools_imported: toolsMeta })
    .eq("id", id);

  return NextResponse.json({
    data: {
      synced: registered.length,
      total_tools: tools.length,
      registered,
      tools: toolsMeta,
    },
    error: null,
  });
}
