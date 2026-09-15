import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { publishTrainingPlan } from "../../application/publish-training-plan";
import type { ApplicationOptions } from "../../application/get-week-summary";
import type { AthleteDataProvider } from "../../domain/provider";
import { toolResult } from "../tool-result";
import { OAUTH_TOOL_META } from "../security";
import type { TrainingMemoryServices } from "../../application/training-memory";
import { workoutBlocksSchema } from "./workout.schemas";

const sportSchema = z.enum([
  "running",
  "cycling",
  "indoor_cycling",
  "mountain_biking",
  "gravel_cycling",
  "strength",
  "other",
]);

export const publishTrainingPlanInputSchema = z.object({
  decisionId: z.uuid().optional(),
  workouts: z
    .array(
      z.object({
        managedId: z.string().regex(/^[a-z0-9][a-z0-9_-]{2,63}$/),
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        sport: sportSchema,
        title: z.string().trim().min(1).max(80),
        description: z.string().trim().min(1).max(4_000),
        durationMinutes: z.number().int().min(10).max(600).optional(),
        trainingLoad: z.number().min(0).max(500).optional(),
        blocks: workoutBlocksSchema.optional(),
      }),
    )
    .min(1)
    .max(14),
  confirmed: z.literal(true),
});

export function registerPublishTrainingPlanTool(
  server: McpServer,
  provider: AthleteDataProvider,
  options: ApplicationOptions,
  memory: TrainingMemoryServices,
  athleteId: string,
): void {
  server.registerTool(
    "publish_training_plan",
    {
      title: "Publish confirmed workouts",
      description:
        "Creates or updates only connector-managed workouts in the Intervals.icu calendar. Prefer structured blocks: the server serializes repeats to native Intervals.icu syntax and verifies interpreted duration after read-back. Reuse managedId to adapt an existing workout. For a saved coach proposal, pass decisionId; it must already be ACCEPTED and becomes PUBLISHED only after successful verification. Never call before showing exact changes and receiving explicit confirmation.",
      inputSchema: publishTrainingPlanInputSchema,
      annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: true },
      _meta: OAUTH_TOOL_META,
    },
    async (input) =>
      toolResult(
        await publishTrainingPlan(
          provider,
          input.workouts,
          options,
          {
            athleteId,
            memory,
            ...(input.decisionId === undefined ? {} : { decisionId: input.decisionId }),
          },
        ),
      ),
  );
}
