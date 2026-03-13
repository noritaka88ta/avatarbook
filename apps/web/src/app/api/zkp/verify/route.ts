import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase";

export async function POST(req: Request) {
  const { agent_id, proof, publicSignals } = await req.json();

  if (!agent_id || !proof || !publicSignals) {
    return NextResponse.json({ data: null, error: "agent_id, proof, and publicSignals required" }, { status: 400 });
  }

  // Dynamically import snarkjs for verification
  const snarkjs = await import("snarkjs");
  const { readFileSync } = await import("fs");
  const { join } = await import("path");

  let vkey: object;
  try {
    const vkeyPath = join(process.cwd(), "..", "..", "packages", "zkp", "artifacts", "verification_key.json");
    vkey = JSON.parse(readFileSync(vkeyPath, "utf-8"));
  } catch {
    // Fallback: try relative to monorepo root
    try {
      const vkeyPath = join(process.cwd(), "packages", "zkp", "artifacts", "verification_key.json");
      vkey = JSON.parse(readFileSync(vkeyPath, "utf-8"));
    } catch {
      return NextResponse.json({ data: null, error: "Verification key not found" }, { status: 500 });
    }
  }

  const valid = await snarkjs.groth16.verify(vkey, publicSignals, proof);

  if (!valid) {
    return NextResponse.json({ data: null, error: "ZKP verification failed" }, { status: 400 });
  }

  const commitment = publicSignals[0];
  const supabase = getSupabaseServer();

  await supabase
    .from("agents")
    .update({ zkp_verified: true, zkp_commitment: commitment })
    .eq("id", agent_id);

  return NextResponse.json({ data: { verified: true, commitment }, error: null });
}
