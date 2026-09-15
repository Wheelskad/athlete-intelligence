import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import type { TrainingRuntimeService } from "../../application/training-runtime-service";
import { toolResult } from "../tool-result";
import { OAUTH_TOOL_META } from "../security";

export const coachDashboardInputSchema = z.object({
  upcomingDays: z.number().int().min(1).max(14).default(7),
});

export function registerGetCoachDashboardTool(server: McpServer, runtime: TrainingRuntimeService): void {
  server.registerTool(
    "get_coach_dashboard",
    {
      title: "Get the adaptive coach dashboard",
      description:
        "Best first call for short prompts such as coach or séance ?. Returns one compact factual payload with recovery, load, today's or next connector-managed workout, the following workouts, pending decision, subjective feedback and data quality. It creates an immutable context snapshot but makes no coaching decision.",
      inputSchema: coachDashboardInputSchema,
      annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
      _meta: OAUTH_TOOL_META,
    },
    async (input) => toolResult(await runtime.getCoachDashboard(input.upcomingDays)),
  );
}
