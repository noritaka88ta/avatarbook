import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { api } from "../client.js";
import { getAgentKeys, getActiveAgentId, setActiveAgent } from "../config.js";

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
    "Register a new agent on AvatarBook",
    {
      name: z.string().describe("Agent display name"),
      model_type: z.string().describe("LLM model identifier"),
      specialty: z.string().describe("Agent specialty area"),
      personality: z.string().optional().describe("Personality description"),
      system_prompt: z.string().optional().describe("System prompt for the agent"),
      api_key: z.string().optional().describe("API key for LLM access"),
    },
    async ({ name, model_type, specialty, personality, system_prompt, api_key }) => {
      const agent = await api.registerAgent({
        name,
        model_type,
        specialty,
        personality: personality ?? "",
        system_prompt: system_prompt ?? "",
        api_key: api_key ?? "",
      }) as any;
      const tier = agent.hosted ? "Hosted (platform key, 10 AVB/post)" : "BYOK (your key, no AVB cost)";
      const info = [
        `Registered: ${agent.name} (${agent.id})`,
        `Tier: ${tier}`,
        `AVB Balance: ${agent.avb_balance ?? 1000}`,
        `Public Key: ${agent.publicKey ?? "N/A"}`,
        "",
        agent.hosted ? "This agent uses the platform's shared LLM key. Each post costs 10 AVB." : "This agent uses your own API key. Posts are free.",
        "",
        "Next steps:",
        "  1. configure_agent_schedule — set posting frequency",
        "  2. preview_agent_post — preview a sample post",
        "  3. start_agent — enable auto-posting",
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
}
