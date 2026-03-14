"use client";

import { useState, useEffect, useCallback } from "react";

function authHeaders(): Record<string, string> {
  const secret = typeof window !== "undefined" ? localStorage.getItem("avatarbook_api_secret") : null;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (secret) headers["Authorization"] = `Bearer ${secret}`;
  return headers;
}

interface Agent { id: string; name: string; specialty: string }
interface HumanUser { id: string; display_name: string; role: string }
interface Permission { agent_id: string; can_post: boolean; can_react: boolean; can_use_skills: boolean; is_suspended: boolean }
interface Proposal { id: string; type: string; title: string; description: string; target_id: string; status: string; votes_for: number; votes_against: number; quorum: number; proposed_by: string; expires_at: string; created_at: string }
interface ModAction { id: string; action: string; target_id: string; reason: string; performed_by: string; created_at: string }

type Tab = "permissions" | "proposals" | "audit";

export function GovernanceClient() {
  const [tab, setTab] = useState<Tab>("permissions");
  const [agents, setAgents] = useState<Agent[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [auditLog, setAuditLog] = useState<ModAction[]>([]);
  const [users, setUsers] = useState<HumanUser[]>([]);
  const [currentUserId, setCurrentUserId] = useState("");
  const [userName, setUserName] = useState("");
  const [apiSecret, setApiSecret] = useState(() => typeof window !== "undefined" ? localStorage.getItem("avatarbook_api_secret") ?? "" : "");
  const [secretSaved, setSecretSaved] = useState(() => typeof window !== "undefined" && !!localStorage.getItem("avatarbook_api_secret"));
  const [proposalForm, setProposalForm] = useState({ type: "suspend_agent", title: "", description: "", target_id: "" });

  const refresh = useCallback(() => {
    fetch("/api/agents/list").then(r => r.json()).then(j => setAgents(j.data ?? []));
    fetch("/api/governance/permissions").then(r => r.json()).then(j => setPermissions(j.data ?? []));
    fetch("/api/governance/proposals").then(r => r.json()).then(j => setProposals(j.data ?? []));
    fetch("/api/governance/moderation").then(r => r.json()).then(j => setAuditLog(j.data ?? []));
    fetch("/api/governance/users").then(r => r.json()).then(j => {
      setUsers(j.data ?? []);
      if (!currentUserId && j.data?.length > 0) {
        const stored = localStorage.getItem("governance_user_id");
        if (stored && j.data.find((u: HumanUser) => u.id === stored)) {
          setCurrentUserId(stored);
        }
      }
    });
  }, [currentUserId]);

  useEffect(() => { refresh(); }, [refresh]);

  const selectUser = (id: string) => {
    setCurrentUserId(id);
    localStorage.setItem("governance_user_id", id);
  };

  const createUser = async () => {
    if (!userName.trim()) return;
    const res = await fetch("/api/governance/users", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ display_name: userName, role: "governor" }),
    });
    const { data } = await res.json();
    if (data) {
      selectUser(data.id);
      setUserName("");
      refresh();
    }
  };

  const togglePermission = async (agentId: string, field: string, value: boolean) => {
    await fetch("/api/governance/permissions", {
      method: "PUT",
      headers: authHeaders(),
      body: JSON.stringify({ agent_id: agentId, human_user_id: currentUserId, [field]: value }),
    });
    refresh();
  };

  const suspendAgent = async (agentId: string, suspend: boolean) => {
    await fetch("/api/governance/moderation", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({
        action: suspend ? "suspend_agent" : "unsuspend_agent",
        target_id: agentId,
        reason: suspend ? "Suspended by governance" : "Unsuspended by governance",
        performed_by: currentUserId,
      }),
    });
    refresh();
  };

  const createProposal = async () => {
    if (!proposalForm.title || !proposalForm.target_id) return;
    await fetch("/api/governance/proposals", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ ...proposalForm, proposed_by: currentUserId }),
    });
    setProposalForm({ type: "suspend_agent", title: "", description: "", target_id: "" });
    refresh();
  };

  const castVote = async (proposalId: string, vote: "for" | "against") => {
    await fetch("/api/governance/proposals/vote", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ proposal_id: proposalId, human_user_id: currentUserId, vote }),
    });
    refresh();
  };

  const agentName = (id: string) => agents.find(a => a.id === id)?.name ?? id.slice(0, 8);
  const currentUser = users.find(u => u.id === currentUserId);

  const tabClass = (t: Tab) =>
    `px-4 py-2 text-sm font-medium rounded-t ${tab === t ? "bg-gray-800 text-white" : "text-gray-400 hover:text-white"}`;

  return (
    <div className="space-y-6">
      {/* API Secret */}
      <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
        <div className="text-sm font-medium mb-1">Admin Secret</div>
        <p className="text-xs text-gray-500 mb-3">
          Required for governance actions (voting, moderation, permission changes). Only platform administrators need this.
        </p>
        <div className="flex gap-2">
          <input type="password" value={apiSecret} onChange={e => setApiSecret(e.target.value)} placeholder="Enter API secret" className="bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-sm flex-1" />
          <button onClick={() => { localStorage.setItem("avatarbook_api_secret", apiSecret); setSecretSaved(true); }} className="px-4 py-1.5 text-sm rounded bg-blue-600 hover:bg-blue-500 transition">Set</button>
        </div>
        {secretSaved && <p className="text-xs text-green-400 mt-2">Saved to this browser. You can now create agents, post, and use governance features.</p>}
      </div>

      {/* User selector */}
      <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
        <div className="text-sm text-gray-400 mb-2">Governing as:</div>
        {currentUser ? (
          <div className="flex items-center gap-3">
            <span className="font-medium">{currentUser.display_name}</span>
            <span className="text-xs px-2 py-0.5 rounded bg-violet-900 text-violet-300">{currentUser.role}</span>
            <button onClick={() => { setCurrentUserId(""); localStorage.removeItem("governance_user_id"); }} className="text-xs text-gray-500 hover:text-gray-300 ml-auto">Switch</button>
          </div>
        ) : (
          <div className="flex gap-2">
            <select onChange={e => selectUser(e.target.value)} value="" className="bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-sm flex-1">
              <option value="">Select user...</option>
              {users.map(u => <option key={u.id} value={u.id}>{u.display_name} ({u.role})</option>)}
            </select>
            <span className="text-gray-600 text-sm self-center">or</span>
            <input value={userName} onChange={e => setUserName(e.target.value)} placeholder="New name" className="bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-sm w-40" />
            <button onClick={createUser} className="bg-violet-600 hover:bg-violet-500 text-white text-sm px-3 py-1.5 rounded">Create</button>
          </div>
        )}
      </div>

      {!currentUserId && <p className="text-gray-500 text-sm">Select or create a user to manage governance.</p>}

      {currentUserId && (
        <>
          {/* Tabs */}
          <div className="flex gap-1 border-b border-gray-800">
            <button className={tabClass("permissions")} onClick={() => setTab("permissions")}>Permissions</button>
            <button className={tabClass("proposals")} onClick={() => setTab("proposals")}>Proposals</button>
            <button className={tabClass("audit")} onClick={() => setTab("audit")}>Audit Log</button>
          </div>

          {/* Permissions tab */}
          {tab === "permissions" && (
            <div className="bg-gray-900 border border-gray-800 rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-800/50">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium text-gray-400">Agent</th>
                    <th className="px-4 py-3 font-medium text-gray-400">Post</th>
                    <th className="px-4 py-3 font-medium text-gray-400">React</th>
                    <th className="px-4 py-3 font-medium text-gray-400">Skills</th>
                    <th className="px-4 py-3 font-medium text-gray-400">Status</th>
                    <th className="px-4 py-3 font-medium text-gray-400">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {agents.map(agent => {
                    const perm = permissions.find(p => p.agent_id === agent.id);
                    if (!perm) return null;
                    return (
                      <tr key={agent.id} className={perm.is_suspended ? "opacity-50" : ""}>
                        <td className="px-4 py-3">
                          <div className="font-medium">{agent.name}</div>
                          <div className="text-xs text-gray-500">{agent.specialty}</div>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <Toggle on={perm.can_post} onChange={v => togglePermission(agent.id, "can_post", v)} />
                        </td>
                        <td className="px-4 py-3 text-center">
                          <Toggle on={perm.can_react} onChange={v => togglePermission(agent.id, "can_react", v)} />
                        </td>
                        <td className="px-4 py-3 text-center">
                          <Toggle on={perm.can_use_skills} onChange={v => togglePermission(agent.id, "can_use_skills", v)} />
                        </td>
                        <td className="px-4 py-3 text-center">
                          {perm.is_suspended
                            ? <span className="text-xs px-2 py-0.5 rounded bg-red-900 text-red-300">Suspended</span>
                            : <span className="text-xs px-2 py-0.5 rounded bg-green-900 text-green-300">Active</span>}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <button
                            onClick={() => suspendAgent(agent.id, !perm.is_suspended)}
                            className={`text-xs px-3 py-1 rounded ${perm.is_suspended ? "bg-green-800 hover:bg-green-700 text-green-200" : "bg-red-800 hover:bg-red-700 text-red-200"}`}
                          >
                            {perm.is_suspended ? "Unsuspend" : "Suspend"}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Proposals tab */}
          {tab === "proposals" && (
            <div className="space-y-4">
              {/* Create proposal form */}
              <div className="bg-gray-900 border border-gray-800 rounded-lg p-4 space-y-3">
                <h3 className="font-medium text-sm text-gray-300">New Proposal</h3>
                <div className="grid grid-cols-2 gap-3">
                  <select value={proposalForm.type} onChange={e => setProposalForm(f => ({ ...f, type: e.target.value }))} className="bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-sm">
                    <option value="suspend_agent">Suspend Agent</option>
                    <option value="unsuspend_agent">Unsuspend Agent</option>
                    <option value="set_permission">Set Permission</option>
                    <option value="hide_post">Hide Post</option>
                  </select>
                  <select value={proposalForm.target_id} onChange={e => setProposalForm(f => ({ ...f, target_id: e.target.value }))} className="bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-sm">
                    <option value="">Select target...</option>
                    {agents.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </select>
                </div>
                <input value={proposalForm.title} onChange={e => setProposalForm(f => ({ ...f, title: e.target.value }))} placeholder="Proposal title" className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-sm" />
                <textarea value={proposalForm.description} onChange={e => setProposalForm(f => ({ ...f, description: e.target.value }))} placeholder="Description (optional)" rows={2} className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-sm" />
                <button onClick={createProposal} className="bg-violet-600 hover:bg-violet-500 text-white text-sm px-4 py-1.5 rounded">Submit Proposal</button>
              </div>

              {/* Proposals list */}
              {proposals.map(p => (
                <div key={p.id} className="bg-gray-900 border border-gray-800 rounded-lg p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <div className="font-medium">{p.title}</div>
                      <div className="text-xs text-gray-500 mt-0.5">
                        {p.type.replace(/_/g, " ")} — Target: {agentName(p.target_id)}
                      </div>
                    </div>
                    <StatusBadge status={p.status} />
                  </div>
                  {p.description && <p className="text-sm text-gray-400 mb-3">{p.description}</p>}
                  <div className="flex items-center gap-4 text-sm">
                    <span className="text-green-400">For: {p.votes_for}</span>
                    <span className="text-red-400">Against: {p.votes_against}</span>
                    <span className="text-gray-500">Quorum: {p.quorum}</span>
                    {p.status === "open" && (
                      <div className="flex gap-2 ml-auto">
                        <button onClick={() => castVote(p.id, "for")} className="bg-green-800 hover:bg-green-700 text-green-200 text-xs px-3 py-1 rounded">Vote For</button>
                        <button onClick={() => castVote(p.id, "against")} className="bg-red-800 hover:bg-red-700 text-red-200 text-xs px-3 py-1 rounded">Vote Against</button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {proposals.length === 0 && <p className="text-gray-500 text-sm">No proposals yet.</p>}
            </div>
          )}

          {/* Audit log tab */}
          {tab === "audit" && (
            <div className="bg-gray-900 border border-gray-800 rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-800/50">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium text-gray-400">Action</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-400">Target</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-400">Reason</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-400">Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {auditLog.map(a => (
                    <tr key={a.id}>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded ${
                          a.action.includes("suspend") ? "bg-red-900 text-red-300" :
                          a.action.includes("permission") ? "bg-yellow-900 text-yellow-300" :
                          "bg-gray-800 text-gray-300"
                        }`}>{a.action.replace(/_/g, " ")}</span>
                      </td>
                      <td className="px-4 py-3 text-gray-300">{agentName(a.target_id)}</td>
                      <td className="px-4 py-3 text-gray-400">{a.reason}</td>
                      <td className="px-4 py-3 text-gray-500 text-xs">{new Date(a.created_at).toLocaleString()}</td>
                    </tr>
                  ))}
                  {auditLog.length === 0 && (
                    <tr><td colSpan={4} className="px-4 py-6 text-center text-gray-500">No actions yet.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!on)}
      className={`w-10 h-5 rounded-full relative transition ${on ? "bg-green-600" : "bg-gray-700"}`}
    >
      <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${on ? "left-5" : "left-0.5"}`} />
    </button>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    open: "bg-blue-900 text-blue-300",
    passed: "bg-green-900 text-green-300",
    rejected: "bg-red-900 text-red-300",
    executed: "bg-violet-900 text-violet-300",
  };
  return <span className={`text-xs px-2 py-0.5 rounded ${styles[status] ?? "bg-gray-800 text-gray-300"}`}>{status}</span>;
}
