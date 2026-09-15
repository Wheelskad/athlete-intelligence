import { z } from "zod";
import { workoutBlocksSchema } from "./workout.schemas";

export const managedIdSchema = z.string().regex(/^[a-z0-9][a-z0-9_-]{2,63}$/);

export const trainingSignalSchema = z.object({
  metric: z.string().trim().min(1).max(80),
  value: z.union([z.number(), z.string().trim().max(120)]).optional(),
  baseline: z.union([z.number(), z.string().trim().max(120)]).optional(),
  direction: z.enum(["POSITIVE", "NEUTRAL", "NEGATIVE"]),
  importance: z.enum(["LOW", "MEDIUM", "HIGH"]),
  explanation: z.string().trim().min(1).max(280),
});

export const proposedWorkoutSchema = z.object({
  intent: z.enum(["REST", "RECOVERY", "ENDURANCE", "TEMPO", "THRESHOLD", "VO2", "FORCE", "TECHNIQUE", "LONG_ENDURANCE"]),
  sport: z.enum(["running", "cycling", "indoor_cycling", "mountain_biking", "gravel_cycling", "strength", "other"]),
  title: z.string().trim().min(1).max(80),
  description: z.string().trim().min(1).max(4_000),
  durationMinutes: z.number().int().min(0).max(600).optional(),
  expectedTrainingLoad: z.number().min(0).max(500).optional(),
  scheduledDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  blocks: workoutBlocksSchema.optional(),
});

export const trainingDecisionDraftSchema = z.object({
  contextSnapshotId: z.uuid(),
  runtimeType: z.enum(["DAILY", "POST_WORKOUT", "WEEKLY", "RECOVERY_CHANGE", "ON_DEMAND"]),
  state: z.enum(["RED", "AMBER", "GREEN", "PRIME"]),
  action: z.enum(["REST", "KEEP", "REDUCE", "REPLACE", "POSTPONE"]),
  confidence: z.enum(["LOW", "MEDIUM", "HIGH"]),
  signals: z.array(trainingSignalSchema).min(1).max(12),
  reasoningSummary: z.array(z.string().trim().min(1).max(280)).min(1).max(8),
  originalWorkout: z.object({
    managedId: managedIdSchema.optional(),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    title: z.string().trim().min(1).max(80).optional(),
  }).optional(),
  proposedWorkout: proposedWorkoutSchema.optional(),
  managedId: managedIdSchema.optional(),
  modelMetadata: z.object({
    provider: z.string().trim().min(1).max(80),
    model: z.string().trim().min(1).max(120),
    coachPromptVersion: z.string().trim().min(1).max(120),
    schemaVersion: z.string().trim().min(1).max(40),
  }),
}).refine(
  (decision) => decision.proposedWorkout === undefined || decision.managedId !== undefined,
  { message: "managedId is required when proposedWorkout is provided", path: ["managedId"] },
).refine(
  (decision) => decision.originalWorkout?.managedId === undefined || decision.originalWorkout.managedId === decision.managedId,
  { message: "An adapted workout must reuse the original managedId", path: ["managedId"] },
);
