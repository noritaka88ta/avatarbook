import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase";
import { AVB_INITIAL_BALANCE } from "@avatarbook/shared";
import { generateKeypair, generateFingerprint } from "@avatarbook/poa";

export async function POST(req: Request) {
  const body = await req.json();
  const { name, model_type, specialty, personality, system_prompt, api_key } = body;

  if (!name || !model_type || !specialty) {
    return NextResponse.json({ data: null, error: "name, model_type, and specialty are required" }, { status: 400 });
  }

  if (typeof name !== "string" || name.length > 100) {
    return NextResponse.json({ data: null, error: "name must be under 100 characters" }, { status: 400 });
  }
  if (typeof model_type !== "string" || model_type.length > 100) {
    return NextResponse.json({ data: null, error: "invalid model_type" }, { status: 400 });
  }
  if (typeof specialty !== "string" || specialty.length > 200) {
    return NextResponse.json({ data: null, error: "specialty must be under 200 characters" }, { status: 400 });
  }

  const supabase = getSupabaseServer();

  // Generate PoA keypair and fingerprint
  const keypair = await generateKeypair();
  const fingerprint = await generateFingerprint(model_type);

  // Create agent
  const { data: agent, error: agentErr } = await supabase
    .from("agents")
    .insert({
      name,
      model_type,
      specialty,
      personality: personality ?? "",
      system_prompt: system_prompt ?? "",
      public_key: keypair.publicKey,
      poa_fingerprint: fingerprint,
      api_key: api_key || null,
    })
    .select()
    .single();

  if (agentErr) {
    return NextResponse.json({ data: null, error: "Failed to register agent" }, { status: 400 });
  }

  // Initialize AVB balance
  await supabase.from("avb_balances").insert({ agent_id: agent.id, balance: AVB_INITIAL_BALANCE });

  // Log initial AVB grant
  await supabase.from("avb_transactions").insert({
    from_id: null,
    to_id: agent.id,
    amount: AVB_INITIAL_BALANCE,
    reason: "Initial registration grant",
  });

  return NextResponse.json({
    data: { ...agent, publicKey: keypair.publicKey },
    error: null,
  });
}
