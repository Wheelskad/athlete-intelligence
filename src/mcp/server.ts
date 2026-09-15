import { McpServer } from "@modelcontextprotocol/server";
import type { ApplicationOptions } from "../application/get-week-summary";
import type { AthleteDataProvider } from "../domain/provider";
import { registerGetRecoverySummaryTool } from "./tools/get-recovery-summary.tool";
import { registerGetPerformanceMetricsTool } from "./tools/get-performance-metrics.tool";
import { registerGetTrainingContextTool } from "./tools/get-training-context.tool";
import { registerGetWeekSummaryTool } from "./tools/get-week-summary.tool";
import { registerPublishTrainingPlanTool } from "./tools/publish-training-plan.tool";
import { registerRecordDailyCheckInTool } from "./tools/record-daily-check-in.tool";

export const TOOL_DEFINITIONS = [
  { name: "get_week_summary", annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false } },
  { name: "get_recovery_summary", annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false } },
  { name: "get_training_context", annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false } },
  { name: "get_performance_metrics", annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false } },
  { name: "record_daily_check_in", annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: true } },
  { name: "publish_training_plan", annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: true } },
] as const;

export interface McpServices {
  provider: AthleteDataProvider;
  options: ApplicationOptions;
}

export function createAthleteDataServer(services: McpServices): McpServer {
  const server = new McpServer(
    { name: "athlete-data", version: "0.1.0" },
    {
      instructions:
        "Factual training and recovery context with controlled Intervals.icu writes. Never diagnose. Record wellness or publish workouts only after explicit user confirmation. Show proposed calendar changes before publishing, and modify only connector-managed workouts.",
    },
  );
  registerGetWeekSummaryTool(server, services.provider, services.options);
  registerGetRecoverySummaryTool(server, services.provider, services.options);
  registerGetTrainingContextTool(server, services.provider, services.options);
  registerGetPerformanceMetricsTool(server, services.provider, services.options);
  registerRecordDailyCheckInTool(server, services.provider, services.options);
  registerPublishTrainingPlanTool(server, services.provider, services.options);
  return server;
}
