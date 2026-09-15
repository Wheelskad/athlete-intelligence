import type { McpServer } from "@modelcontextprotocol/server";
import type { TrainingRuntimeService } from "../../application/training-runtime-service";
import { toolResult } from "../tool-result";
import { OAUTH_TOOL_META } from "../security";
import { trainingDecisionDraftSchema } from "./training-decision.schemas";

export function registerSaveTrainingDecisionTool(
  server: McpServer,
  runtime: TrainingRuntimeService,
): void {
  server.registerTool(
    "save_training_decision",
    {
      title: "Save a proposed coach decision",
      description:
        "Persists a structured PROPOSED decision produced by the model and links it to the exact immutable context snapshot. Store only short user-facing reasoningSummary items, never private chain-of-thought. This does not accept or publish the proposal.",
      inputSchema: trainingDecisionDraftSchema,
      annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
      _meta: OAUTH_TOOL_META,
    },
    async (input) => toolResult(await runtime.saveDecision({
      contextSnapshotId: input.contextSnapshotId,
      runtimeType: input.runtimeType,
      state: input.state,
      action: input.action,
      confidence: input.confidence,
      signals: input.signals.map((signal) => ({
        metric: signal.metric,
        ...(signal.value === undefined ? {} : { value: signal.value }),
        ...(signal.baseline === undefined ? {} : { baseline: signal.baseline }),
        direction: signal.direction,
        importance: signal.importance,
        explanation: signal.explanation,
      })),
      reasoningSummary: input.reasoningSummary,
      ...(input.originalWorkout === undefined ? {} : {
        originalWorkout: {
          ...(input.originalWorkout.managedId === undefined ? {} : { managedId: input.originalWorkout.managedId }),
          ...(input.originalWorkout.date === undefined ? {} : { date: input.originalWorkout.date }),
          ...(input.originalWorkout.title === undefined ? {} : { title: input.originalWorkout.title }),
        },
      }),
      ...(input.proposedWorkout === undefined ? {} : {
        proposedWorkout: {
          intent: input.proposedWorkout.intent,
          sport: input.proposedWorkout.sport,
          title: input.proposedWorkout.title,
          description: input.proposedWorkout.description,
          ...(input.proposedWorkout.durationMinutes === undefined ? {} : { durationMinutes: input.proposedWorkout.durationMinutes }),
          ...(input.proposedWorkout.expectedTrainingLoad === undefined ? {} : { expectedTrainingLoad: input.proposedWorkout.expectedTrainingLoad }),
          ...(input.proposedWorkout.scheduledDate === undefined ? {} : { scheduledDate: input.proposedWorkout.scheduledDate }),
          ...(input.proposedWorkout.blocks === undefined ? {} : { blocks: input.proposedWorkout.blocks }),
        },
      }),
      ...(input.managedId === undefined ? {} : { managedId: input.managedId }),
      modelMetadata: input.modelMetadata,
    })),
  );
}
