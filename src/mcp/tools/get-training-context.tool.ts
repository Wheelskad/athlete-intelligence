import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { getTrainingContext } from "../../application/get-training-context";
import type { ApplicationOptions } from "../../application/get-week-summary";
import type { AthleteDataProvider } from "../../domain/provider";
import { sanitizeTrainingContext } from "../../privacy/sanitize";
import { toolResult } from "../tool-result";

export const trainingContextInputSchema = z.object({
  historyDays: z.number().int().min(7).max(42).default(14),
  includeUpcomingCalendar: z.boolean().default(true),
  calendarDays: z.number().int().min(7).max(42).default(28),
});

export function registerGetTrainingContextTool(
  server: McpServer,
  provider: AthleteDataProvider,
  options: ApplicationOptions,
): void {
  server.registerTool(
    "get_training_context",
    {
      title: "Get training context",
      description: "Primary weekly context: completed activity, recovery trends, upcoming sessions and missing metrics.",
      inputSchema: trainingContextInputSchema,
      annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    },
    async (input) =>
      toolResult(sanitizeTrainingContext(await getTrainingContext(provider, input, options))),
  );
}
