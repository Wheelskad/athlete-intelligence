import { McpServer } from "@modelcontextprotocol/server";
import type { ApplicationOptions } from "../application/get-week-summary";
import type { AthleteDataProvider } from "../domain/provider";
import { registerGetRecoverySummaryTool } from "./tools/get-recovery-summary.tool";
import { registerGetPerformanceMetricsTool } from "./tools/get-performance-metrics.tool";
import { registerGetTrainingContextTool } from "./tools/get-training-context.tool";
import { registerGetWeekSummaryTool } from "./tools/get-week-summary.tool";
import { registerPublishTrainingPlanTool } from "./tools/publish-training-plan.tool";
import { registerRecordDailyCheckInTool } from "./tools/record-daily-check-in.tool";
import type { AthleteContext } from "../domain/training-runtime";
import type { TrainingMemoryServices } from "../application/training-memory";
import { TrainingContextService } from "../application/training-context-service";
import { TrainingRuntimeService } from "../application/training-runtime-service";
import { registerGetTrainingRuntimeContextTool } from "./tools/get-training-runtime-context.tool";
import { registerGetTrainingDecisionHistoryTool } from "./tools/get-training-decision-history.tool";
import { registerSaveTrainingDecisionTool } from "./tools/save-training-decision.tool";
import { registerUpdateTrainingDecisionStatusTool } from "./tools/update-training-decision-status.tool";
import { registerGetCoachDashboardTool } from "./tools/get-coach-dashboard.tool";
import { registerGetWorkoutDetailTool } from "./tools/get-workout-detail.tool";
import { registerRecordPreWorkoutFeedbackTool } from "./tools/record-pre-workout-feedback.tool";

export const TOOL_DEFINITIONS = [
  { name: "get_week_summary", annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false } },
  { name: "get_recovery_summary", annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false } },
  { name: "get_training_context", annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false } },
  { name: "get_performance_metrics", annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false } },
  { name: "get_training_runtime_context", annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false } },
  { name: "get_coach_dashboard", annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false } },
  { name: "get_workout_detail", annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false } },
  { name: "get_training_decision_history", annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false } },
  { name: "save_training_decision", annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false } },
  { name: "update_training_decision_status", annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false } },
  { name: "record_daily_check_in", annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: true } },
  { name: "record_pre_workout_feedback", annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false } },
  { name: "publish_training_plan", annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: true } },
] as const;

export interface McpServices {
  provider: AthleteDataProvider;
  options: ApplicationOptions;
  athlete: AthleteContext;
  memory: TrainingMemoryServices;
}

export function createAthleteDataServer(services: McpServices): McpServer {
  const server = new McpServer(
    { name: "athlete-data", version: "0.1.0" },
    {
      instructions:
        "ChatGPT is the training decision engine; this server provides factual context, immutable snapshots, auditable decision memory and controlled Intervals.icu writes. For short coaching prompts, call get_coach_dashboard first. Never diagnose or infer subjective values. Save only short user-facing reasoning summaries, never private chain-of-thought. Record wellness or pre-workout feedback, accept or reject a proposal, or publish workouts only after explicit user confirmation. Acceptance and publication are separate steps. Show exact calendar changes before publishing, reuse the original managedId, and modify only connector-managed workouts. Treat publication as complete only when verified is true.",
    },
  );
  const runtime = new TrainingRuntimeService(
    new TrainingContextService(services.provider, services.options, services.athlete),
    services.memory,
    services.athlete.athleteId,
    services.options.now,
  );
  registerGetWeekSummaryTool(server, services.provider, services.options);
  registerGetRecoverySummaryTool(server, services.provider, services.options);
  registerGetTrainingContextTool(server, services.provider, services.options);
  registerGetPerformanceMetricsTool(server, services.provider, services.options);
  registerGetTrainingRuntimeContextTool(server, runtime);
  registerGetCoachDashboardTool(server, runtime);
  registerGetWorkoutDetailTool(server, runtime);
  registerGetTrainingDecisionHistoryTool(server, runtime);
  registerSaveTrainingDecisionTool(server, runtime);
  registerUpdateTrainingDecisionStatusTool(server, runtime);
  registerRecordDailyCheckInTool(server, services.provider, services.options);
  registerRecordPreWorkoutFeedbackTool(server, runtime);
  registerPublishTrainingPlanTool(
    server,
    services.provider,
    services.options,
    services.memory,
    services.athlete.athleteId,
  );
  return server;
}
