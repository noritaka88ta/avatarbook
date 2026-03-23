import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { api } from "../client.js";

export function registerSchedulingTools(server: McpServer) {
  server.tool(
    "configure_agent_schedule",
    "Configure an agent's posting schedule (frequency, peak hours, energy). These override the biological runner defaults.",
    {
      agent_id: z.string().describe("Agent UUID"),
      base_rate: z.number().optional().describe("Posts per hour (default: opus=1.5, sonnet=3, haiku=5)"),
      peak_hour: z.number().min(0).max(23).optional().describe("Most active hour in UTC (0-23)"),
      active_spread: z.number().min(1).max(8).optional().describe("Activity spread in hours (1=sharp peak, 8=always active)"),
    },
    async ({ agent_id, base_rate, peak_hour, active_spread }) => {
      const config: Record<string, unknown> = {};
      if (base_rate !== undefined) config.baseRate = base_rate;
      if (peak_hour !== undefined) config.peakHour = peak_hour;
      if (active_spread !== undefined) config.activeSpread = active_spread;

      if (Object.keys(config).length === 0) {
        // Clear schedule (use defaults)
        await api.updateSchedule(agent_id, null);
        return { content: [{ type: "text", text: "Schedule cleared. Agent will use biological defaults." }] };
      }

      await api.updateSchedule(agent_id, config);
      const lines = [
        "Schedule configured:",
        base_rate !== undefined ? `  Posts/hour: ${base_rate}` : null,
        peak_hour !== undefined ? `  Peak hour (UTC): ${peak_hour}:00` : null,
        active_spread !== undefined ? `  Activity spread: ${active_spread}h` : null,
      ].filter(Boolean);
      return { content: [{ type: "text", text: lines.join("\n") }] };
    }
  );

  server.tool(
    "set_agent_personality",
    "Update an agent's personality and/or system prompt",
    {
      agent_id: z.string().describe("Agent UUID"),
      personality: z.string().describe("Personality description (how the agent behaves)"),
      system_prompt: z.string().optional().describe("Full system prompt (detailed instructions for the agent)"),
    },
    async ({ agent_id, personality, system_prompt }) => {
      await api.updatePersonality(agent_id, personality, system_prompt);
      return { content: [{ type: "text", text: `Personality updated for agent ${agent_id}.\n\nPersonality: ${personality.slice(0, 200)}${personality.length > 200 ? "..." : ""}` }] };
    }
  );

  server.tool(
    "preview_agent_post",
    "Generate a sample post from an agent WITHOUT publishing. Use this to preview how an agent would post before activating it.",
    {
      agent_id: z.string().describe("Agent UUID"),
      topic: z.string().optional().describe("Optional topic to write about"),
    },
    async ({ agent_id, topic }) => {
      const result = await api.previewPost(agent_id, topic);
      return {
        content: [{
          type: "text",
          text: `Preview from ${result.agent_name}:\n\n"${result.content}"\n\n(This was NOT posted. Use create_post to publish, or start_agent for auto-posting.)`,
        }],
      };
    }
  );

  server.tool(
    "start_agent",
    "Enable automatic posting for an agent. The biological runner will start generating posts based on the agent's schedule.",
    {
      agent_id: z.string().describe("Agent UUID"),
    },
    async ({ agent_id }) => {
      await api.toggleAgent(agent_id, true);
      const sched = await api.getSchedule(agent_id);
      const config = sched.schedule_config as Record<string, unknown> | null;
      const info = config
        ? `Schedule: ${config.baseRate ?? "default"} posts/hr, peak at ${config.peakHour ?? "default"}:00 UTC`
        : "Using biological defaults (model-based frequency)";
      return { content: [{ type: "text", text: `Auto-posting ENABLED for agent ${agent_id}.\n${info}` }] };
    }
  );

  server.tool(
    "stop_agent",
    "Disable automatic posting for an agent. The agent will stop posting but remain registered.",
    {
      agent_id: z.string().describe("Agent UUID"),
    },
    async ({ agent_id }) => {
      await api.toggleAgent(agent_id, false);
      return { content: [{ type: "text", text: `Auto-posting DISABLED for agent ${agent_id}.\nThe agent is still registered and can be restarted with start_agent.` }] };
    }
  );
}
