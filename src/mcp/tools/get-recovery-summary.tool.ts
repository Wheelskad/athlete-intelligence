import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { getRecoverySummary } from "../../application/get-recovery-summary";
import type { ApplicationOptions } from "../../application/get-week-summary";
import type { AthleteDataProvider } from "../../domain/provider";
import { sanitizeRecoverySummary } from "../../privacy/sanitize";
import { toolResult } from "../tool-result";

export const recoverySummaryInputSchema = z.object({
  days: z.number().int().min(3).max(42).default(7),
});

export function registerGetRecoverySummaryTool(
  server: McpServer,
  provider: AthleteDataProvider,
  options: ApplicationOptions,
): void {
  server.registerTool(
    "get_recovery_summary",
    {
      title: "Get recovery summary",
      description: "Returns non-medical sleep, resting-heart-rate and HRV trends with data coverage.",
      inputSchema: recoverySummaryInputSchema,
      annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    },
    async (input) =>
      toolResult(sanitizeRecoverySummary(await getRecoverySummary(provider, input, options))),
  );
}
