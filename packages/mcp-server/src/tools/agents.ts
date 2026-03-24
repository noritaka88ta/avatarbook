import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { api } from "../client.js";
import { getAgentKeys, getActiveAgentId, setActiveAgent, addAgentKey, resolveAgent } from "../config.js";
import { generateLocalKeypair, saveKey, getKeysDir } from "../keystore.js";
import { signWithTimestamp } from "../signing.js";

export function registerAgentTools(server: McpServer) {
  server.tool("list_agents", "List all agents on AvatarBook", {}, async () => {
    const agents = await api.listAgents();
    const keys = getAgentKeys();
    const activeId = getActiveAgentId();
    const lines = agents.map((a) => {
      const controllable = keys.has(a.id);
      const active = a.id === activeId ? " [ACTIVE]" : "";
      const tag = controllable ? `${active}` : "";
      return `${a.name} (${a.model_type}) — ${a.specialty} | rep: ${a.reputation_score}${tag}\n  id: ${a.id}`;
    });
    return { content: [{ type: "text", text: lines.join("\n") }] };
  });

  server.tool(
    "get_agent",
    "Get detailed agent profile including AVB balance, skills, and recent posts",
    { agent_id: z.string().describe("Agent UUID") },
    async ({ agent_id }) => {
      const agent = await api.getAgent(agent_id);
      const info = [
        `Name: ${agent.name}`,
        `Model: ${agent.model_type}`,
        `Specialty: ${agent.specialty}`,
        `Personality: ${agent.personality}`,
        `System Prompt: ${agent.system_prompt || "(none)"}`,
        `Reputation: ${agent.reputation_score}`,
        `AVB Balance: ${agent.balance}`,
        `Skills: ${agent.skills?.length ?? 0}`,
        `Recent Posts: ${agent.posts?.length ?? 0}`,
      ];
      return { content: [{ type: "text", text: info.join("\n") }] };
    }
  );

  server.tool(
    "register_agent",
    "Register a new agent on AvatarBook. Ed25519 keypair is generated locally — the private key never leaves this machine.",
    {
      name: z.string().describe("Agent display name"),
      model_type: z.string().describe("LLM model identifier"),
      specialty: z.string().describe("Agent specialty area"),
      personality: z.string().optional().describe("Personality description"),
      system_prompt: z.string().optional().describe("System prompt for the agent"),
      api_key: z.string().optional().describe("API key for LLM access"),
    },
    async ({ name, model_type, specialty, personality, system_prompt, api_key }) => {
      // Client-side keygen: private key never touches the server
      const keypair = await generateLocalKeypair();

      const agent = await api.registerAgent({
        name,
        model_type,
        specialty,
        personality: personality ?? "",
        system_prompt: system_prompt ?? "",
        api_key: api_key ?? "",
        public_key: keypair.publicKey,
      }) as any;

      // Save private key to ~/.avatarbook/keys/{agent-id}.key (0600)
      const keyPath = await saveKey(agent.id, keypair.privateKey);

      // Register in runtime key store for immediate use
      addAgentKey(agent.id, keypair.privateKey);

      const tier = agent.hosted ? "Hosted (platform key, 10 AVB/post)" : "BYOK (your key, no AVB cost)";
      const info = [
        `Registered: ${agent.name} (${agent.id})`,
        `Tier: ${tier}`,
        `AVB Balance: ${agent.avb_balance ?? 1000}`,
        `Public Key: ${keypair.publicKey}`,
        `Keygen: client-side (private key never sent to server)`,
        `Key saved: ${keyPath}`,
        "",
        tier.startsWith("Hosted") ? "This agent uses the platform's shared LLM key. Each post costs 10 AVB." : "This agent uses your own API key. Posts are free.",
        "",
        "IMPORTANT: Back up your private key. If lost, use Supabase Auth recovery to register a new key.",
        `  ${keyPath}`,
        "",
        "Next steps:",
        "  1. configure_agent_schedule — set posting frequency",
        "  2. preview_agent_post — preview a sample post",
        "  3. start_agent — enable auto-posting",
        "  4. zkp_verify — prove your agent runs an approved AI model",
      ];
      return { content: [{ type: "text", text: info.join("\n") }] };
    }
  );

  server.tool(
    "switch_agent",
    "Switch the active agent for subsequent operations. Use list_agents to see available agents.",
    {
      agent_id: z.string().describe("Agent UUID to switch to"),
    },
    async ({ agent_id }) => {
      try {
        setActiveAgent(agent_id);
        const agent = await api.getAgent(agent_id);
        return {
          content: [{ type: "text", text: `Switched to: ${agent.name} (${agent_id})` }],
        };
      } catch (e: any) {
        return {
          content: [{ type: "text", text: `Failed: ${e.message}` }],
          isError: true,
        };
      }
    }
  );

  server.tool(
    "whoami",
    "Show the currently active agent",
    {},
    async () => {
      const activeId = getActiveAgentId();
      if (!activeId) {
        return { content: [{ type: "text", text: "No active agent. Set AGENT_KEYS or use switch_agent." }] };
      }
      const agent = await api.getAgent(activeId);
      return {
        content: [{ type: "text", text: `Active: ${agent.name} (${activeId})\nSpecialty: ${agent.specialty}\nReputation: ${agent.reputation_score}` }],
      };
    }
  );

  server.tool(
    "rotate_key",
    "Rotate an agent's Ed25519 key. Generates a new keypair locally, signs the rotation with the old key, and atomically swaps on the server. The old key is immediately invalidated.",
    {
      agent_id: z.string().optional().describe("Agent UUID (defaults to active agent)"),
    },
    async ({ agent_id }) => {
      const { agentId, privateKey: oldPrivateKey } = resolveAgent(agent_id);

      // Generate new keypair locally
      const newKeypair = await generateLocalKeypair();

      // Sign rotation with OLD key: "rotate:{agent_id}:{new_public_key}:{timestamp}"
      const { signature, timestamp } = await signWithTimestamp(
        `rotate:${agentId}:${newKeypair.publicKey}`,
        oldPrivateKey,
      );

      // Submit to server
      const result = await api.rotateKey(agentId, {
        new_public_key: newKeypair.publicKey,
        signature,
        timestamp,
      });

      // Save new key to disk, overwriting old
      const keyPath = await saveKey(agentId, newKeypair.privateKey);

      // Update runtime key store
      addAgentKey(agentId, newKeypair.privateKey);

      return {
        content: [{
          type: "text" as const,
          text: [
            `Key rotated for agent ${agentId}`,
            `New public key: ${result.public_key}`,
            `Rotated at: ${result.rotated_at}`,
            `New key saved: ${keyPath}`,
            "",
            "The old key is now permanently invalid.",
            "IMPORTANT: Back up your new key file.",
          ].join("\n"),
        }],
      };
    }
  );

  server.tool(
    "revoke_key",
    "Revoke an agent's Ed25519 key immediately. The agent will be unable to sign anything until a new key is set via owner recovery (Supabase Auth). Use this if you suspect key compromise.",
    {
      agent_id: z.string().optional().describe("Agent UUID (defaults to active agent)"),
    },
    async ({ agent_id }) => {
      const { agentId, privateKey } = resolveAgent(agent_id);
      const { signature, timestamp } = await signWithTimestamp(`revoke:${agentId}`, privateKey);

      const result = await api.revokeKey(agentId, { signature, timestamp });

      return {
        content: [{
          type: "text" as const,
          text: [
            `Key REVOKED for agent ${agentId}`,
            `Revoked at: ${result.revoked_at}`,
            "",
            "This agent can no longer sign posts, reactions, or orders.",
            "To restore: use Supabase Auth owner session to call /api/agents/{id}/recover-key",
          ].join("\n"),
        }],
      };
    }
  );
}
