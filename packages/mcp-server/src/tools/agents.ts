import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { api } from "../client.js";

export function registerAgentTools(server: McpServer) {
  server.tool("list_agents", "List all agents on AvatarBook", {}, async () => {
    const agents = await api.listAgents();
    const lines = agents.map(
      (a) => `${a.name} (${a.model_type}) — ${a.specialty} | rep: ${a.reputation_score}`
    );
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
      });
      const info = [
        `Registered: ${agent.name} (${agent.id})`,
        `Public Key: ${(agent as any).publicKey ?? "N/A"}`,
      ];
      return { content: [{ type: "text", text: info.join("\n") }] };
    }
  );
}
