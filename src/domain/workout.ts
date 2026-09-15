export interface WorkoutTargets {
  cadence?: string | undefined;
  heartRate?: string | undefined;
  rpe?: string | undefined;
  power?: string | undefined;
}

export type WorkoutStep =
  | {
      type: "STEP" | "WARMUP" | "COOLDOWN";
      durationSeconds: number;
      instruction: string;
      targets?: WorkoutTargets | undefined;
    }
  | {
      type: "REPEAT";
      repetitions: number;
      steps: WorkoutStep[];
    };

export function workoutDurationSeconds(steps: WorkoutStep[]): number {
  return steps.reduce((total, step) => {
    if (step.type === "REPEAT") {
      return total + step.repetitions * workoutDurationSeconds(step.steps);
    }
    return total + step.durationSeconds;
  }, 0);
}

function durationToken(durationSeconds: number): string {
  if (durationSeconds <= 0 || !Number.isInteger(durationSeconds)) {
    throw new RangeError("Workout step duration must be a positive whole number of seconds");
  }
  const minutes = Math.floor(durationSeconds / 60);
  const seconds = durationSeconds % 60;
  if (minutes === 0) return `${String(seconds)}s`;
  if (seconds === 0) return `${String(minutes)}m`;
  return `${String(minutes)}m${String(seconds)}s`;
}

function targetText(targets: WorkoutTargets | undefined): string[] {
  if (targets === undefined) return [];
  return [
    targets.cadence === undefined ? undefined : `cadence ${targets.cadence}`,
    targets.heartRate === undefined ? undefined : `HR ${targets.heartRate}`,
    targets.rpe === undefined ? undefined : `RPE ${targets.rpe}`,
    targets.power === undefined ? undefined : `power ${targets.power}`,
  ].filter((value): value is string => value !== undefined);
}

function serializeStep(step: Exclude<WorkoutStep, { type: "REPEAT" }>): string {
  const details = [step.instruction.trim(), ...targetText(step.targets)].filter(Boolean).join(", ");
  return `- ${durationToken(step.durationSeconds)}${details.length === 0 ? "" : ` ${details}`}`;
}

/**
 * Emits Intervals.icu workout-builder text. Repeat children deliberately remain
 * unindented: indentation makes Intervals treat only part of the block as native
 * workout syntax.
 */
export function serializeIntervalsWorkout(steps: WorkoutStep[]): string {
  const sections: string[] = [];
  for (const step of steps) {
    if (step.type === "REPEAT") {
      const children = serializeRepeatSteps(step.steps);
      sections.push(`${String(step.repetitions)}x\n${children}`);
      continue;
    }
    const heading = step.type === "WARMUP" ? "Warmup" : step.type === "COOLDOWN" ? "Cooldown" : undefined;
    sections.push(heading === undefined ? serializeStep(step) : `${heading}\n${serializeStep(step)}`);
  }
  return sections.join("\n\n");
}

function serializeRepeatSteps(steps: WorkoutStep[]): string {
  return steps.map((step) => {
    if (step.type === "REPEAT") {
      return `${String(step.repetitions)}x\n${serializeRepeatSteps(step.steps)}`;
    }
    return serializeStep(step);
  }).join("\n");
}

function parseDurationToken(token: string): number | undefined {
  const match = /^(?:(\d+)m)?(?:(\d+)s)?$/i.exec(token);
  if (match === null || (match[1] === undefined && match[2] === undefined)) return undefined;
  return Number(match[1] ?? 0) * 60 + Number(match[2] ?? 0);
}

/** Best-effort parser for native text returned by Intervals.icu. */
export function parseIntervalsWorkout(description: string): WorkoutStep[] {
  const lines = description.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const output: WorkoutStep[] = [];
  let section: "STEP" | "WARMUP" | "COOLDOWN" = "STEP";
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? "";
    if (/^warmup$/i.test(line)) { section = "WARMUP"; continue; }
    if (/^cooldown$/i.test(line)) { section = "COOLDOWN"; continue; }
    const repeat = /^(\d+)x$/i.exec(line);
    if (repeat !== null) {
      const children: WorkoutStep[] = [];
      while (index + 1 < lines.length && /^-\s*/.test(lines[index + 1] ?? "")) {
        index += 1;
        const parsed = parseSimpleLine(lines[index] ?? "", "STEP");
        if (parsed !== undefined) children.push(parsed);
      }
      output.push({ type: "REPEAT", repetitions: Number(repeat[1]), steps: children });
      section = "STEP";
      continue;
    }
    const parsed = parseSimpleLine(line, section);
    if (parsed !== undefined) output.push(parsed);
    if (section !== "STEP") section = "STEP";
  }
  return output;
}

function parseSimpleLine(
  line: string,
  type: "STEP" | "WARMUP" | "COOLDOWN",
): Exclude<WorkoutStep, { type: "REPEAT" }> | undefined {
  const match = /^-\s*((?:\d+m)?(?:\d+s)?)\s*(.*)$/.exec(line);
  if (match === null) return undefined;
  const durationSeconds = parseDurationToken(match[1] ?? "");
  if (durationSeconds === undefined) return undefined;
  return { type, durationSeconds, instruction: match[2]?.trim() ?? "" };
}
