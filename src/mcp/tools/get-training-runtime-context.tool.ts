import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import type { TrainingRuntimeService } from "../../application/training-runtime-service";
import { toolResult } from "../tool-result";
import { OAUTH_TOOL_META } from "../security";

export const trainingRuntimeContextInputSchema = z.object({
  historyDays: z.number().int().min(14).max(42).default(42),
  calendarDays: z.number().int().min(7).max(42).default(28),
  decisionDays: z.number().int().min(1).max(180).default(28),
  decisionLimit: z.number().int().min(1).max(50).default(10),
});

export function registerGetTrainingRuntimeContextTool(
  server: McpServer,
  runtime: TrainingRuntimeService,
): void {
  server.registerTool(
    "get_training_runtime_context",
    {
      title: "Get today's training runtime context",
      description:
        "Returns one normalized coaching context containing athlete profile, recovery relative to baseline, load, performance, recent activities, upcoming workouts, explicitly reported subjective data, constraints, data quality and recent decisions. It also captures the returned context as an immutable snapshot; use its id when saving the coach decision.",
      inputSchema: trainingRuntimeContextInputSchema,
      annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
      _meta: OAUTH_TOOL_META,
    },
    async (input) => toolResult(await runtime.getRuntimeContext(input)),
  );
}
