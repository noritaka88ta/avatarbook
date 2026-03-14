import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase";

export async function POST(req: Request) {
  const { proposal_id, human_user_id, vote } = await req.json();

  if (!proposal_id || !human_user_id || !vote) {
    return NextResponse.json({ data: null, error: "proposal_id, human_user_id, vote required" }, { status: 400 });
  }
  if (vote !== "for" && vote !== "against") {
    return NextResponse.json({ data: null, error: "vote must be 'for' or 'against'" }, { status: 400 });
  }

  const supabase = getSupabaseServer();

  // Verify user exists
  const { data: user } = await supabase.from("human_users").select("*").eq("id", human_user_id).single();
  if (!user) {
    return NextResponse.json({ data: null, error: "User not found" }, { status: 404 });
  }

  // Get proposal
  const { data: proposal } = await supabase.from("proposals").select("*").eq("id", proposal_id).single();
  if (!proposal) {
    return NextResponse.json({ data: null, error: "Proposal not found" }, { status: 404 });
  }
  if (proposal.status !== "open") {
    return NextResponse.json({ data: null, error: "Proposal is not open for voting" }, { status: 400 });
  }

  // Check for duplicate vote
  const { data: existingVotes } = await supabase
    .from("votes")
    .select("*")
    .eq("proposal_id", proposal_id)
    .eq("human_user_id", human_user_id);

  if (existingVotes && existingVotes.length > 0) {
    return NextResponse.json({ data: null, error: "Already voted" }, { status: 409 });
  }

  // Record vote
  const { data: voteRecord, error } = await supabase
    .from("votes")
    .insert({ proposal_id, human_user_id, vote })
    .select("*")
    .single();

  if (error) return NextResponse.json({ data: null, error: "Operation failed" }, { status: 500 });

  // Update proposal vote counts
  const newFor = proposal.votes_for + (vote === "for" ? 1 : 0);
  const newAgainst = proposal.votes_against + (vote === "against" ? 1 : 0);
  const totalVotes = newFor + newAgainst;
  let newStatus = proposal.status;

  if (totalVotes >= proposal.quorum) {
    newStatus = newFor > newAgainst ? "passed" : "rejected";
  }

  await supabase
    .from("proposals")
    .update({ votes_for: newFor, votes_against: newAgainst, status: newStatus })
    .eq("id", proposal_id);

  // Auto-execute if passed
  if (newStatus === "passed") {
    if (proposal.type === "suspend_agent") {
      await supabase.from("agent_permissions").update({ is_suspended: true, updated_by: proposal.proposed_by, updated_at: new Date().toISOString() }).eq("agent_id", proposal.target_id);
      await supabase.from("moderation_actions").insert({ action: "suspend_agent", target_id: proposal.target_id, reason: `Proposal passed: ${proposal.title}`, performed_by: proposal.proposed_by });
      await supabase.from("proposals").update({ status: "executed" }).eq("id", proposal_id);
    } else if (proposal.type === "unsuspend_agent") {
      await supabase.from("agent_permissions").update({ is_suspended: false, updated_by: proposal.proposed_by, updated_at: new Date().toISOString() }).eq("agent_id", proposal.target_id);
      await supabase.from("moderation_actions").insert({ action: "unsuspend_agent", target_id: proposal.target_id, reason: `Proposal passed: ${proposal.title}`, performed_by: proposal.proposed_by });
      await supabase.from("proposals").update({ status: "executed" }).eq("id", proposal_id);
    }
  }

  return NextResponse.json({ data: voteRecord, proposal_status: newStatus, error: null });
}
