import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { getWeekSummary, type ApplicationOptions } from "../../application/get-week-summary";
import type { AthleteDataProvider } from "../../domain/provider";
import { sanitizeWeekSummary } from "../../privacy/sanitize";
import { toolResult } from "../tool-result";
import { OAUTH_TOOL_META } from "../security";

export const weekSummaryInputSchema = z.object({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export function registerGetWeekSummaryTool(
  server: McpServer,
  provider: AthleteDataProvider,
  options: ApplicationOptions,
): void {
  server.registerTool(
    "get_week_summary",
    {
      title: "Get week summary",
      description: "Returns a compact, factual summary of completed training over a calendar date range.",
      inputSchema: weekSummaryInputSchema,
      annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
      _meta: OAUTH_TOOL_META,
    },
    async (input) => toolResult(sanitizeWeekSummary(await getWeekSummary(provider, input, options))),
  );
}
