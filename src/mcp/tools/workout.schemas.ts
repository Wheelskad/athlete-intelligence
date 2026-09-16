import { z } from "zod";
import type { WorkoutStep } from "../../domain/workout";

const targetsSchema = z.object({
  cadence: z.string().trim().min(1).max(80).optional().describe("Cadence range such as 85-95rpm"),
  heartRate: z.string().trim().min(1).max(80).optional().describe("Heart-rate target such as Z2 or 75-80%"),
  pace: z.string().trim().min(1).max(80).optional().describe("Running pace target such as Z2 or 5:00-5:20/km"),
  rpe: z.string().trim().min(1).max(40).optional().describe("Display-only effort cue such as 6/10"),
  power: z.string().trim().min(1).max(80).optional().describe("Power target such as 80% or 220-240w"),
  freeride: z.boolean().optional().describe("Cycling only: ERG off with no primary intensity target"),
});

const simpleWorkoutStepSchema = z.object({
  type: z.enum(["STEP", "WARMUP", "COOLDOWN"]),
  durationSeconds: z.number().int().min(1).max(43_200),
  instruction: z.string().trim().min(1).max(120).describe("Short cue visible on the Garmin step screen"),
  intensity: z.enum(["active", "interval", "recovery", "rest", "warmup", "cooldown"]).optional(),
  targets: targetsSchema.optional(),
});

export const workoutStepSchema: z.ZodType<WorkoutStep> = z.union([
  simpleWorkoutStepSchema,
  z.object({
    type: z.literal("REPEAT"),
    repetitions: z.number().int().min(2).max(99),
    instruction: z.string().trim().min(1).max(80).optional(),
    steps: z.array(simpleWorkoutStepSchema).min(1).max(30),
  }),
]);

export const workoutBlocksSchema = z.array(workoutStepSchema).min(1).max(50);
