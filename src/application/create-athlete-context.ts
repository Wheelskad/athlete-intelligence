import { z } from "zod";
import type { AppConfig } from "../config/env";
import type { AthleteContext } from "../domain/training-runtime";

const profileSchema = z.object({
  goals: z.array(z.object({
    name: z.string().trim().min(1).max(120),
    targetDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    priority: z.enum(["LOW", "MEDIUM", "HIGH"]).optional(),
  })).default([]),
  preferences: z.object({
    preferredSports: z.array(z.string().trim().min(1).max(40)).max(12).optional(),
    indoorCyclingAvailable: z.boolean().optional(),
    outdoorCyclingAvailable: z.boolean().optional(),
    maxSessionsPerWeek: z.number().int().min(1).max(14).optional(),
    preferredTrainingDays: z.array(z.string().trim().min(1).max(20)).max(7).optional(),
  }).default({}),
  currentObjective: z.object({
    name: z.string().trim().min(1).max(160),
    eventDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    priority: z.enum(["LOW", "MEDIUM", "HIGH"]).optional(),
  }).optional(),
});

export function createAthleteContext(config: AppConfig): AthleteContext {
  let profile: z.infer<typeof profileSchema> = { goals: [], preferences: {} };
  if (config.ATHLETE_PROFILE_JSON !== undefined) {
    let raw: unknown;
    try {
      raw = JSON.parse(config.ATHLETE_PROFILE_JSON) as unknown;
    } catch {
      throw new Error("ATHLETE_PROFILE_JSON must contain valid JSON");
    }
    const parsed = profileSchema.safeParse(raw);
    if (!parsed.success) throw new Error(`Invalid ATHLETE_PROFILE_JSON: ${parsed.error.message}`);
    profile = parsed.data;
  }
  return {
    athleteId: config.ATHLETE_ID,
    goals: profile.goals.map((goal) => ({
      name: goal.name,
      ...(goal.targetDate === undefined ? {} : { targetDate: goal.targetDate }),
      ...(goal.priority === undefined ? {} : { priority: goal.priority }),
    })),
    preferences: {
      ...(profile.preferences.preferredSports === undefined ? {} : { preferredSports: profile.preferences.preferredSports }),
      ...(profile.preferences.indoorCyclingAvailable === undefined ? {} : { indoorCyclingAvailable: profile.preferences.indoorCyclingAvailable }),
      ...(profile.preferences.outdoorCyclingAvailable === undefined ? {} : { outdoorCyclingAvailable: profile.preferences.outdoorCyclingAvailable }),
      ...(profile.preferences.maxSessionsPerWeek === undefined ? {} : { maxSessionsPerWeek: profile.preferences.maxSessionsPerWeek }),
      ...(profile.preferences.preferredTrainingDays === undefined ? {} : { preferredTrainingDays: profile.preferences.preferredTrainingDays }),
    },
    ...(profile.currentObjective === undefined ? {} : {
      currentObjective: {
        name: profile.currentObjective.name,
        ...(profile.currentObjective.eventDate === undefined ? {} : { eventDate: profile.currentObjective.eventDate }),
        ...(profile.currentObjective.priority === undefined ? {} : { priority: profile.currentObjective.priority }),
      },
    }),
  };
}
