import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import type { TrainingRuntimeService } from "../../application/training-runtime-service";
import { toolResult } from "../tool-result";
import { OAUTH_TOOL_META } from "../security";
import { managedIdSchema } from "./training-decision.schemas";

export const preWorkoutFeedbackInputSchema = z.object({
  managedId: managedIdSchema.optional(),
  feeling: z.enum(["GREAT", "OK", "TIRED", "NO_MOTIVATION"]).optional(),
  fatigue: z.number().int().min(1).max(10).optional(),
  motivation: z.number().int().min(1).max(10).optional(),
  pain: z.object({
    location: z.string().trim().min(1).max(120),
    severity: z.number().int().min(1).max(10),
  }).optional(),
  timeAvailableMinutes: z.number().int().min(1).max(1_440).optional(),
  preferredSport: z.string().trim().min(1).max(80).optional(),
  message: z.string().trim().min(1).max(1_000).optional(),
  confirmed: z.literal(true),
}).refine(
  (feedback) => [
    feedback.feeling,
    feedback.fatigue,
    feedback.motivation,
    feedback.pain,
    feedback.timeAvailableMinutes,
    feedback.preferredSport,
    feedback.message,
  ].some((value) => value !== undefined),
  { message: "At least one feedback field is required" },
);

export function registerRecordPreWorkoutFeedbackTool(server: McpServer, runtime: TrainingRuntimeService): void {
  server.registerTool(
    "record_pre_workout_feedback",
    {
      title: "Record confirmed pre-workout feedback",
      description:
        "Persists explicit subjective feedback such as feeling, pain, time available or preferred sport, optionally linked to a managed workout. Do not infer numeric values from vague text. Pain is subjective feedback, not a diagnosis. Requires explicit user confirmation and does not alter the calendar.",
      inputSchema: preWorkoutFeedbackInputSchema,
      annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
      _meta: OAUTH_TOOL_META,
    },
    async (input) => toolResult(await runtime.recordPreWorkoutFeedback({
      ...(input.managedId === undefined ? {} : { managedId: input.managedId }),
      ...(input.feeling === undefined ? {} : { feeling: input.feeling }),
      ...(input.fatigue === undefined ? {} : { fatigue: input.fatigue }),
      ...(input.motivation === undefined ? {} : { motivation: input.motivation }),
      ...(input.pain === undefined ? {} : { pain: input.pain }),
      ...(input.timeAvailableMinutes === undefined ? {} : { timeAvailableMinutes: input.timeAvailableMinutes }),
      ...(input.preferredSport === undefined ? {} : { preferredSport: input.preferredSport }),
      ...(input.message === undefined ? {} : { message: input.message }),
    })),
  );
}
