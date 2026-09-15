import { describe, expect, it } from "vitest";
import { serializeIntervalsWorkout, workoutDurationSeconds, type WorkoutStep } from "./workout";

const repeat: WorkoutStep = {
  type: "REPEAT",
  repetitions: 4,
  steps: [
    { type: "STEP", durationSeconds: 300, instruction: "seated", targets: { cadence: "55-60rpm", rpe: "6/10" } },
    { type: "STEP", durationSeconds: 180, instruction: "easy", targets: { cadence: "90-95rpm" } },
  ],
};

describe("Intervals workout serialization", () => {
  it("calculates a repeat block as repetitions times all child steps", () => {
    expect(workoutDurationSeconds([repeat])).toBe(32 * 60);
  });

  it("calculates nested total duration recursively", () => {
    const workout: WorkoutStep[] = [
      { type: "WARMUP", durationSeconds: 12 * 60, instruction: "easy" },
      repeat,
      { type: "STEP", durationSeconds: 6 * 60, instruction: "endurance" },
      { type: "COOLDOWN", durationSeconds: 5 * 60, instruction: "very easy" },
    ];
    expect(workoutDurationSeconds(workout)).toBe(55 * 60);
  });

  it("emits native unindented repeat syntax", () => {
    expect(serializeIntervalsWorkout([repeat])).toBe(
      "4x\n- 5m seated, cadence 55-60rpm, RPE 6/10\n- 3m easy, cadence 90-95rpm",
    );
  });
});
