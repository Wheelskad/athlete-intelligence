import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { getTrainingContext } from "../../application/get-training-context";
import type { ApplicationOptions } from "../../application/get-week-summary";
import type { AthleteDataProvider } from "../../domain/provider";
import { OAUTH_TOOL_META } from "../security";
import { toolResult } from "../tool-result";

export const performanceMetricsInputSchema = z.object({
  historyDays: z.number().int().min(14).max(42).default(42),
});

export function registerGetPerformanceMetricsTool(
  server: McpServer,
  provider: AthleteDataProvider,
  options: ApplicationOptions,
): void {
  server.registerTool(
    "get_performance_metrics",
    {
      title: "Get consolidated performance metrics",
      description:
        "Returns the dashboard's consolidated metrics over 2-6 weeks: rolling-week progression, sport mix, consistency, CTL fitness, ATL fatigue, TSB form, VO2 max, modeled FTP, TRIMP, heart-rate load and efficiency when supplied by Intervals.icu. Treat them as training indicators, not medical diagnoses.",
      inputSchema: performanceMetricsInputSchema,
      annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
      _meta: OAUTH_TOOL_META,
    },
    async ({ historyDays }) => {
      const context = await getTrainingContext(
        provider,
        { historyDays, includeUpcomingCalendar: false },
        options,
      );

      return toolResult({
        generatedAt: context.generatedAt,
        timezone: context.timezone,
        period: context.period,
        freshness: context.freshness,
        performance: context.performance,
        loadDynamics: context.recovery.loadDynamics,
        aerobicFitness: context.recovery.aerobicFitness,
        advancedMetrics: context.activities.advancedMetrics,
        dataQuality: {
          overall: context.dataQuality,
          activities: context.activities.dataQuality,
          recovery: context.recovery.dataQuality,
        },
        missingMetrics: context.missingMetrics,
      });
    },
  );
}
