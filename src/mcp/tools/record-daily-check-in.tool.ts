import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { recordDailyCheckIn } from "../../application/record-daily-check-in";
import type { ApplicationOptions } from "../../application/get-week-summary";
import type { AthleteDataProvider } from "../../domain/provider";
import { toolResult } from "../tool-result";
import { OAUTH_TOOL_META } from "../security";

export const dailyCheckInInputSchema = z.object({
  fatigue: z.number().int().min(1).max(10),
  soreness: z.number().int().min(1).max(10).optional(),
  stress: z.number().int().min(1).max(10).optional(),
  motivation: z.number().int().min(1).max(10).optional(),
  confirmed: z.literal(true),
});

export function registerRecordDailyCheckInTool(
  server: McpServer,
  provider: AthleteDataProvider,
  options: ApplicationOptions,
): void {
  server.registerTool(
    "record_daily_check_in",
    {
      title: "Record today's wellness check-in",
      description:
        "Writes today's subjective fatigue and optional soreness, stress and motivation (1-10) to Intervals.icu. If the user gives no number, ask for a 1-10 value instead of inferring one. Call only after the user explicitly confirms the values. After writing, read get_training_context again before proposing calendar changes.",
      inputSchema: dailyCheckInInputSchema,
      annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: true },
      _meta: OAUTH_TOOL_META,
    },
    async (input) =>
      toolResult(
        await recordDailyCheckIn(
          provider,
          {
            fatigue: input.fatigue,
            ...(input.soreness === undefined ? {} : { soreness: input.soreness }),
            ...(input.stress === undefined ? {} : { stress: input.stress }),
            ...(input.motivation === undefined ? {} : { motivation: input.motivation }),
          },
          options,
        ),
      ),
  );
}
