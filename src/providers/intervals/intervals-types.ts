import { z } from "zod";

const finiteNumber = z.number();

export const intervalsActivitySchema = z
  .looseObject({
    id: z.union([z.string(), z.number()]),
    start_date_local: z.string().min(10),
    type: z.string().min(1),
    moving_time: finiteNumber.optional().nullable(),
    elapsed_time: finiteNumber.optional().nullable(),
    distance: finiteNumber.optional().nullable(),
    total_elevation_gain: finiteNumber.optional().nullable(),
    icu_training_load: finiteNumber.optional().nullable(),
    icu_intensity: finiteNumber.optional().nullable(),
    average_heartrate: finiteNumber.optional().nullable(),
    max_heartrate: finiteNumber.optional().nullable(),
    icu_average_watts: finiteNumber.optional().nullable(),
    icu_weighted_avg_watts: finiteNumber.optional().nullable(),
    average_cadence: finiteNumber.optional().nullable(),
    decoupling: finiteNumber.optional().nullable(),
    trimp: finiteNumber.optional().nullable(),
    hr_load: finiteNumber.optional().nullable(),
    icu_pm_ftp: finiteNumber.optional().nullable(),
    icu_rolling_ftp: finiteNumber.optional().nullable(),
    icu_efficiency_factor: finiteNumber.optional().nullable(),
  })
  .refine((activity) => activity.moving_time != null || activity.elapsed_time != null, {
    message: "Activity must contain moving_time or elapsed_time",
  });

export const intervalsWellnessSchema = z
  .looseObject({
    id: z.string().min(10),
    weight: finiteNumber.optional().nullable(),
    restingHR: finiteNumber.optional().nullable(),
    hrv: finiteNumber.optional().nullable(),
    sleepSecs: finiteNumber.optional().nullable(),
    sleepScore: finiteNumber.optional().nullable(),
    sleepQuality: z.union([z.number(), z.string()]).optional().nullable(),
    soreness: finiteNumber.optional().nullable(),
    fatigue: finiteNumber.optional().nullable(),
    stress: finiteNumber.optional().nullable(),
    motivation: finiteNumber.optional().nullable(),
    bodyBattery: finiteNumber.optional().nullable(),
    ctl: finiteNumber.optional().nullable(),
    atl: finiteNumber.optional().nullable(),
    rampRate: finiteNumber.optional().nullable(),
    vo2max: finiteNumber.optional().nullable(),
  });

export const intervalsEventSchema = z
  .looseObject({
    start_date_local: z.string().min(10),
    category: z.string().min(1),
    type: z.string().optional().nullable(),
    moving_time: finiteNumber.optional().nullable(),
    icu_training_load: finiteNumber.optional().nullable(),
    external_id: z.string().optional().nullable(),
    name: z.string().optional().nullable(),
  });

export const intervalsActivitiesResponseSchema = z.array(intervalsActivitySchema);
export const intervalsUnavailableActivitySchema = z.looseObject({
  id: z.union([z.string(), z.number()]),
  start_date_local: z.string().min(10),
  _note: z.string().min(1),
});
export const intervalsWellnessResponseSchema = z.array(intervalsWellnessSchema);
export const intervalsEventsResponseSchema = z.array(intervalsEventSchema);

export type IntervalsActivity = z.infer<typeof intervalsActivitySchema>;
export type IntervalsWellness = z.infer<typeof intervalsWellnessSchema>;
export type IntervalsEvent = z.infer<typeof intervalsEventSchema>;
