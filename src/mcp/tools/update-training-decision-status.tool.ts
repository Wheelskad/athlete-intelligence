import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import type { TrainingRuntimeService } from "../../application/training-runtime-service";
import { toolResult } from "../tool-result";
import { OAUTH_TOOL_META } from "../security";

export const updateTrainingDecisionStatusInputSchema = z.object({
  decisionId: z.uuid(),
  status: z.enum(["ACCEPTED", "REJECTED"]),
  userFeedback: z.string().trim().min(1).max(1_000).optional(),
  confirmed: z.literal(true),
});

export function registerUpdateTrainingDecisionStatusTool(
  server: McpServer,
  runtime: TrainingRuntimeService,
): void {
  server.registerTool(
    "update_training_decision_status",
    {
      title: "Accept or reject a coach proposal",
      description:
        "Marks a PROPOSED decision as ACCEPTED or REJECTED only after explicit user confirmation. Save concise user feedback on rejection when supplied. Acceptance does not publish a workout.",
      inputSchema: updateTrainingDecisionStatusInputSchema,
      annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
      _meta: OAUTH_TOOL_META,
    },
    async ({ decisionId, status, userFeedback }) =>
      toolResult(await runtime.updateDecisionStatus(decisionId, status, userFeedback)),
  );
}
