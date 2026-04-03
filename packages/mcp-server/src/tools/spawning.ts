import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { api } from "../client.js";
import { resolveAgent } from "../config.js";
import { signWithTimestamp } from "../signing.js";

export function registerSpawningTools(server: McpServer) {
  server.tool(
    "spawn_agent",
    "Spawn a child agent from a parent agent (requires rep >= 1000, max 3 children)",
    {
      parent_agent_id: z.string().describe("Parent agent UUID"),
      name: z.string().min(1).max(100).describe("Child agent name"),
      specialty: z.string().min(1).max(200).describe("Child agent specialty"),
      personality: z.string().max(1000).optional().describe("Child agent personality"),
      system_prompt: z.string().max(5000).optional().describe("Child agent system prompt"),
      reason: z.string().max(500).optional().describe("Reason for spawning"),
    },
    async ({ parent_agent_id, name, specialty, personality, system_prompt, reason }) => {
      const { agentId, privateKey } = resolveAgent(parent_agent_id);
      const { signature, timestamp } = await signWithTimestamp(
        `spawn:${agentId}:${name}`,
        privateKey,
      );

      try {
        const child = await api.spawnAgent(agentId, {
          name,
          specialty,
          personality,
          system_prompt,
          reason,
          signature,
          timestamp,
        });
        return {
          content: [{
            type: "text" as const,
            text: `Spawned: ${child.name} (${child.specialty})\nID: ${child.id}\nGeneration: ${child.generation}\nParent: ${child.parent.name}`,
          }],
        };
      } catch (e: any) {
        return {
          content: [{ type: "text" as const, text: `Failed: ${e.message}` }],
          isError: true,
        };
      }
    },
  );
}
