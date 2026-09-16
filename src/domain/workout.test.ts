import { describe, expect, it } from "vitest";
import {
  parseIntervalsWorkout,
  serializeIntervalsWorkout,
  validateWorkoutForGarmin,
  workoutDurationSeconds,
  type WorkoutStep,
} from "./workout";

const repeat: WorkoutStep = {
  type: "REPEAT",
  repetitions: 4,
  instruction: "Force endurance",
  steps: [
    {
      type: "STEP",
      durationSeconds: 300,
      instruction: "Force assis",
      intensity: "interval",
      targets: { cadence: "55-60rpm", power: "80-85%", rpe: "6/10" },
    },
    {
      type: "STEP",
      durationSeconds: 180,
      instruction: "Pedalage souple",
      intensity: "recovery",
      targets: { cadence: "90-95rpm", power: "50-55%" },
    },
  ],
};

describe("Intervals workout serialization", () => {
  it("calculates a repeat block as repetitions times all child steps", () => {
    expect(workoutDurationSeconds([repeat])).toBe(32 * 60);
  });

  it("calculates the complete 55 minute workout", () => {
    const workout: WorkoutStep[] = [
      { type: "WARMUP", durationSeconds: 12 * 60, instruction: "Mise en route" },
      repeat,
      { type: "STEP", durationSeconds: 6 * 60, instruction: "Endurance" },
      { type: "COOLDOWN", durationSeconds: 5 * 60, instruction: "Retour au calme" },
    ];
    expect(workoutDurationSeconds(workout)).toBe(55 * 60);
  });

  it("puts Garmin-visible cues before duration and keeps repeat children contiguous", () => {
    expect(serializeIntervalsWorkout([repeat], { sport: "indoor_cycling" })).toBe(
      "Force endurance 4x\n"
      + "- Force assis RPE 6/10 5m 80-85% 55-60rpm intensity=interval\n"
      + "- Pedalage souple 3m 50-55% 90-95rpm intensity=recovery",
    );
  });

  it("serializes running pace and heart-rate targets in native order", () => {
    expect(serializeIntervalsWorkout([
      {
        type: "WARMUP",
        durationSeconds: 600,
        instruction: "Footing facile",
        targets: { heartRate: "Z2" },
      },
      {
        type: "STEP",
        durationSeconds: 300,
        instruction: "Allure seuil",
        intensity: "interval",
        targets: { pace: "95-100%" },
      },
    ], { sport: "running" })).toBe(
      "Warmup\n- Footing facile 10m Z2 HR intensity=warmup\n\n"
      + "- Allure seuil 5m 95-100% Pace intensity=interval",
    );
  });

  it("serializes time-based strength cues that Garmin can display", () => {
    expect(serializeIntervalsWorkout([
      {
        type: "STEP",
        durationSeconds: 45,
        instruction: "Goblet squat dix repetitions",
        intensity: "interval",
        targets: { rpe: "7/10" },
      },
      {
        type: "STEP",
        durationSeconds: 30,
        instruction: "Repos",
        intensity: "rest",
      },
    ], { sport: "strength" })).toBe(
      "- Goblet squat dix repetitions RPE 7/10 45s intensity=interval\n\n"
      + "- Repos 30s intensity=rest",
    );
  });

  it("rejects incompatible targets before publication", () => {
    expect(() => validateWorkoutForGarmin([{
      type: "STEP",
      durationSeconds: 300,
      instruction: "Tempo",
      targets: { power: "80%", heartRate: "Z3" },
    }], { sport: "cycling" })).toThrow("only one primary target");
    expect(() => validateWorkoutForGarmin([{
      type: "STEP",
      durationSeconds: 300,
      instruction: "Tempo",
      targets: { pace: "Z3" },
    }], { sport: "cycling" })).toThrow("only supported for running");
  });
});

describe("Intervals workout parsing", () => {
  it("reads cue-first lines and a named repeat without swallowing later sections", () => {
    const description = `Warmup
- Mise en route 12m freeride 85-95rpm intensity=warmup

Force endurance 4x
- Force assis RPE 6/10 5m freeride 55-60rpm intensity=interval
- Recuperation 3m freeride 90-95rpm intensity=recovery

- Endurance 6m freeride 85-95rpm intensity=active

Cooldown
- Tres facile 5m freeride intensity=cooldown`;
    const parsed = parseIntervalsWorkout(description);
    expect(workoutDurationSeconds(parsed)).toBe(55 * 60);
    expect(parsed).toMatchObject([
      { type: "WARMUP", durationSeconds: 720, instruction: "Mise en route" },
      {
        type: "REPEAT",
        repetitions: 4,
        instruction: "Force endurance",
        steps: [
          { durationSeconds: 300, instruction: "Force assis RPE 6/10", intensity: "interval" },
          { durationSeconds: 180, instruction: "Recuperation", intensity: "recovery" },
        ],
      },
      { type: "STEP", durationSeconds: 360, instruction: "Endurance" },
      { type: "COOLDOWN", durationSeconds: 300, instruction: "Tres facile" },
    ]);
  });

  it("recovers the legacy repeat even with an erroneous blank after its header", () => {
    const parsed = parseIntervalsWorkout(`Force-endurance 4x

- Force RPE 6 5m freeride 55-60rpm
- Recuperation RPE 2-3 3m freeride 90-95rpm

- Endurance 6m freeride`);
    expect(parsed[0]).toMatchObject({ type: "REPEAT", repetitions: 4, instruction: "Force-endurance" });
    expect(workoutDurationSeconds(parsed)).toBe(38 * 60);
  });

  it("still reads legacy duration-first descriptions", () => {
    expect(parseIntervalsWorkout("- 35m endurance")).toEqual([
      { type: "STEP", durationSeconds: 2_100, instruction: "endurance" },
    ]);
  });
});
