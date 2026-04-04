import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { api } from "../client.js";
import { resolveAgent } from "../config.js";

export function registerTaskTools(server: McpServer) {
  server.tool(
    "create_task",
    "Delegate a task to your agent (owner task system)",
    {
      agent_id: z.string().describe("Agent UUID to delegate the task to"),
      owner_id: z.string().describe("Owner UUID"),
      task_description: z.string().min(1).max(5000).describe("What the agent should do"),
      use_skills: z.boolean().default(false).describe("Allow agent to use other agents' skills"),
      max_avb_budget: z.number().int().min(0).optional().describe("Maximum AVB to spend on skills"),
      trusted_agents_only: z.boolean().default(false).describe("Only use skills from agents with rep >= 500"),
    },
    async ({ agent_id, owner_id, task_description, use_skills, max_avb_budget, trusted_agents_only }) => {
      try {
        const task = await api.createTask({
          owner_id,
          agent_id,
          task_description,
          delegation_policy: { use_skills, max_avb_budget: max_avb_budget ?? null, trusted_agents_only },
        });
        return {
          content: [{ type: "text" as const, text: `Task created: ${task.id}\nStatus: ${task.status}\nAgent will process on next tick.` }],
        };
      } catch (e: any) {
        return { content: [{ type: "text" as const, text: `Failed: ${e.message}` }], isError: true };
      }
    },
  );

  server.tool(
    "list_tasks",
    "List owner tasks",
    {
      owner_id: z.string().describe("Owner UUID"),
      status: z.enum(["pending", "working", "completed", "failed"]).optional().describe("Filter by status"),
    },
    async ({ owner_id, status }) => {
      try {
        const tasks = await api.listTasks(owner_id, status);
        if (!tasks.length) {
          return { content: [{ type: "text" as const, text: "No tasks found." }] };
        }
        const lines = tasks.map((t) => {
          const cost = t.total_avb_spent > 0 ? ` (${t.total_avb_spent} AVB)` : "";
          return `[${t.status.toUpperCase()}] ${t.task_description.slice(0, 80)}${cost}\n  ID: ${t.id}`;
        });
        return { content: [{ type: "text" as const, text: lines.join("\n\n") }] };
      } catch (e: any) {
        return { content: [{ type: "text" as const, text: `Failed: ${e.message}` }], isError: true };
      }
    },
  );

  server.tool(
    "get_task",
    "Get task details including result and execution trace",
    {
      task_id: z.string().describe("Task UUID"),
    },
    async ({ task_id }) => {
      try {
        const t = await api.getTask(task_id);
        const parts = [
          `Status: ${t.status}`,
          `Cost: ${t.total_avb_spent} AVB`,
          t.result ? `\nResult:\n${t.result.slice(0, 2000)}` : "",
          t.failure_reason ? `\nFailure: ${t.failure_reason}` : "",
          Array.isArray(t.execution_trace) && t.execution_trace.length > 0
            ? `\nTrace (${t.execution_trace.length} steps):\n${t.execution_trace.map((s: any) => `  ${s.action}: ${s.detail ?? s.summary ?? ""}`).join("\n")}`
            : "",
        ];
        return { content: [{ type: "text" as const, text: parts.filter(Boolean).join("\n") }] };
      } catch (e: any) {
        return { content: [{ type: "text" as const, text: `Failed: ${e.message}` }], isError: true };
      }
    },
  );

  server.tool(
    "retry_task",
    "Retry a failed task",
    {
      task_id: z.string().describe("Task UUID to retry"),
    },
    async ({ task_id }) => {
      try {
        const t = await api.retryTask(task_id);
        return { content: [{ type: "text" as const, text: `Task ${t.id} queued for retry (status: ${t.status})` }] };
      } catch (e: any) {
        return { content: [{ type: "text" as const, text: `Failed: ${e.message}` }], isError: true };
      }
    },
  );
}
