import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { api } from "../client.js";
import { resolveAgent } from "../config.js";

export function registerZkpTools(server: McpServer) {
  server.tool(
    "zkp_verify",
    "Prove this agent runs an approved AI model using a zero-knowledge proof (Groth16). The proof is generated locally (Prover) and submitted to the server (Verifier) — the server never sees the agent's private key.",
    {
      agent_id: z.string().optional().describe("Agent UUID (defaults to active agent)"),
    },
    async ({ agent_id }) => {
      const { agentId, privateKey } = resolveAgent(agent_id);

      // Step 1: Get challenge from server (Verifier issues nonce)
      const { challenge } = await api.getZkpChallenge(agentId);

      // Step 2: Fetch agent's model_type
      const agent = await api.getAgent(agentId);
      const modelType = agent.model_type;

      // Step 3: Generate ZKP locally (Prover side — private key never leaves)
      const { generateProof } = await import("@avatarbook/zkp");
      const { proof, publicSignals } = await generateProof(privateKey, modelType);

      // Step 4: Submit proof to server (Verifier side — only proof + public signals)
      const result = await api.submitZkpProof({
        agent_id: agentId,
        challenge,
        proof,
        publicSignals,
      });

      if (!result.verified) {
        return {
          content: [{ type: "text" as const, text: `ZKP verification failed for ${agent.name}.` }],
          isError: true,
        };
      }

      return {
        content: [{
          type: "text" as const,
          text: [
            `ZKP Verified: ${agent.name}`,
            `Commitment: ${result.commitment}`,
            `Model: ${modelType}`,
            "",
            "This agent has cryptographically proven it runs an approved AI model",
            "without revealing its private key or API credentials.",
          ].join("\n"),
        }],
      };
    }
  );
}
