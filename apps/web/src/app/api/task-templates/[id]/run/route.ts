import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase";
import { randomUUID } from "crypto";
export const runtime = "nodejs";

const TEMPLATES: Record<string, { description: string; primary_agent_id: string; budget: number }> = {
  "security-audit": {
    description: "Run a security assessment of a web application. Order Security Audit and Architecture Review skills from specialist agents. Synthesize findings into an executive report.",
    primary_agent_id: "a43e03fb-843a-45f4-b572-55e87bfc1ed4",
    budget: 300,
  },
  "market-analysis": {
    description: "Analyze market positioning and go-to-market strategy. Order Go-to-Market Strategy and Deep Research Report skills. Synthesize into actionable recommendations.",
    primary_agent_id: "a43e03fb-843a-45f4-b572-55e87bfc1ed4",
    budget: 250,
  },
  "full-launch-review": {
    description: "Comprehensive launch readiness evaluation. Order Security Audit, Go-to-Market Strategy, Deep Research Report, and Architecture Review skills from specialist agents. Synthesize all findings into a unified launch readiness report.",
    primary_agent_id: "a43e03fb-843a-45f4-b572-55e87bfc1ed4",
    budget: 500,
  },
};

const MAX_ACTIVE_TASKS_PER_AGENT = 5;
const MAX_GUEST_TASKS_PER_HOUR = 10;

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const template = TEMPLATES[id];

  if (!template) {
    return NextResponse.json({ data: null, error: "Template not found" }, { status: 404 });
  }

  const supabase = getSupabaseServer();

  // Rate limit: max guest tasks per hour (global)
  const hourAgo = new Date(Date.now() - 3600_000).toISOString();
  const { count: recentGuest } = await supabase
    .from("owner_tasks")
    .select("id", { count: "exact", head: true })
    .eq("agent_id", template.primary_agent_id)
    .eq("created_by", "owner")
    .gte("created_at", hourAgo);

  if ((recentGuest ?? 0) >= MAX_GUEST_TASKS_PER_HOUR) {
    return NextResponse.json({ data: null, error: "Too many tasks created recently. Please try again later." }, { status: 429 });
  }

  // Check active task count for this agent
  const { count: activeTasks } = await supabase
    .from("owner_tasks")
    .select("id", { count: "exact", head: true })
    .eq("agent_id", template.primary_agent_id)
    .in("status", ["pending", "working"]);

  if ((activeTasks ?? 0) >= MAX_ACTIVE_TASKS_PER_AGENT) {
    return NextResponse.json({ data: null, error: "Agent is busy. Please try again shortly." }, { status: 429 });
  }

  // Create guest owner
  const { data: owner } = await supabase
    .from("owners")
    .insert({ tier: "free", display_name: `guest-${randomUUID().slice(0, 8)}` })
    .select("id")
    .single();

  if (!owner) {
    return NextResponse.json({ data: null, error: "Failed to create guest owner" }, { status: 500 });
  }

  // Create task — NOT featured by default
  const { data: task, error } = await supabase
    .from("owner_tasks")
    .insert({
      owner_id: owner.id,
      agent_id: template.primary_agent_id,
      task_description: template.description,
      delegation_policy: {
        use_skills: true,
        max_avb_budget: template.budget,
        trusted_agents_only: false,
      },
      featured: false,
      execution_trace: [{
        timestamp: new Date().toISOString(),
        action: "created",
        detail: `Template: ${id} — guest task created`,
      }],
    })
    .select("id")
    .single();

  if (error || !task) {
    return NextResponse.json({ data: null, error: `Failed to create task: ${error?.message}` }, { status: 500 });
  }

  return NextResponse.json({
    data: {
      task_id: task.id,
      owner_id: owner.id,
      template_id: id,
    },
    error: null,
  });
}
