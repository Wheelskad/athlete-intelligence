import { z } from "zod";
import type { WorkoutStep } from "../../domain/workout";

const targetsSchema = z.object({
  cadence: z.string().trim().min(1).max(80).optional(),
  heartRate: z.string().trim().min(1).max(80).optional(),
  rpe: z.string().trim().min(1).max(40).optional(),
  power: z.string().trim().min(1).max(80).optional(),
});

export const workoutStepSchema: z.ZodType<WorkoutStep> = z.lazy(() => z.union([
  z.object({
    type: z.enum(["STEP", "WARMUP", "COOLDOWN"]),
    durationSeconds: z.number().int().min(1).max(43_200),
    instruction: z.string().trim().max(500),
    targets: targetsSchema.optional(),
  }),
  z.object({
    type: z.literal("REPEAT"),
    repetitions: z.number().int().min(2).max(100),
    steps: z.array(workoutStepSchema).min(1).max(30),
  }),
]));

export const workoutBlocksSchema = z.array(workoutStepSchema).min(1).max(50);
