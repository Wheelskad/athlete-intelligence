import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import type { TrainingRuntimeService } from "../../application/training-runtime-service";
import { toolResult } from "../tool-result";
import { OAUTH_TOOL_META } from "../security";

export const trainingDecisionHistoryInputSchema = z.object({
  days: z.number().int().min(1).max(365).default(28),
  limit: z.number().int().min(1).max(50).default(20),
});

export function registerGetTrainingDecisionHistoryTool(
  server: McpServer,
  runtime: TrainingRuntimeService,
): void {
  server.registerTool(
    "get_training_decision_history",
    {
      title: "Get recent coach decisions",
      description:
        "Returns compact, auditable coach decisions and their lifecycle status. It never returns private chain-of-thought or full historical snapshots.",
      inputSchema: trainingDecisionHistoryInputSchema,
      annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
      _meta: OAUTH_TOOL_META,
    },
    async ({ days, limit }) => toolResult(await runtime.getDecisionHistory(days, limit)),
  );
}
