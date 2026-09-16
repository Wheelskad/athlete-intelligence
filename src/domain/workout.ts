export interface WorkoutTargets {
  /** Secondary cadence target, for example `85-95rpm`. */
  cadence?: string | undefined;
  /** Heart-rate target, for example `Z2` or `75-80%`. */
  heartRate?: string | undefined;
  /** Running pace target, for example `Z2` or `5:00-5:20/km`. */
  pace?: string | undefined;
  /** Power target, for example `80%` or `220-240w`. */
  power?: string | undefined;
  /** Display-only perceived exertion cue, for example `6/10`. */
  rpe?: string | undefined;
  /** Explicitly disable a power target (ERG off) for this step. */
  freeride?: boolean | undefined;
}

export type WorkoutStepIntensity =
  | "active"
  | "interval"
  | "recovery"
  | "rest"
  | "warmup"
  | "cooldown";

export type WorkoutSport =
  | "running"
  | "cycling"
  | "indoor_cycling"
  | "mountain_biking"
  | "gravel_cycling"
  | "strength"
  | "other";

export type WorkoutStep =
  | {
      type: "STEP" | "WARMUP" | "COOLDOWN";
      durationSeconds: number;
      /** Short cue displayed as the step description on compatible Garmin devices. */
      instruction: string;
      intensity?: WorkoutStepIntensity | undefined;
      targets?: WorkoutTargets | undefined;
    }
  | {
      type: "REPEAT";
      repetitions: number;
      /** Optional repeat name. Intervals turns it into cues such as `Force 1/4`. */
      instruction?: string | undefined;
      steps: Exclude<WorkoutStep, { type: "REPEAT" }>[];
    };

export interface WorkoutSerializationOptions {
  sport?: WorkoutSport | undefined;
}

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
  const hours = Math.floor(durationSeconds / 3_600);
  const minutes = Math.floor((durationSeconds % 3_600) / 60);
  const seconds = durationSeconds % 60;
  if (hours > 0) {
    return `${String(hours)}h${minutes === 0 ? "" : `${String(minutes)}m`}${seconds === 0 ? "" : `${String(seconds)}s`}`;
  }
  if (minutes === 0) return `${String(seconds)}s`;
  if (seconds === 0) return `${String(minutes)}m`;
  return `${String(minutes)}m${String(seconds)}s`;
}

function cleanTarget(value: string, prefix: RegExp): string {
  return value.trim().replace(prefix, "").trim();
}

function heartRateTarget(value: string): string {
  const cleaned = cleanTarget(value, /^(?:heart\s*rate|hr)\s+/i);
  return /(?:HR|LTHR)$/i.test(cleaned) ? cleaned : `${cleaned} HR`;
}

function paceTarget(value: string): string {
  const cleaned = cleanTarget(value, /^pace\s+/i);
  return /Pace$/i.test(cleaned) ? cleaned : `${cleaned} Pace`;
}

function targetText(targets: WorkoutTargets | undefined): string[] {
  if (targets === undefined) return [];
  const primary = targets.power !== undefined
    ? cleanTarget(targets.power, /^power\s+/i)
    : targets.heartRate !== undefined
      ? heartRateTarget(targets.heartRate)
      : targets.pace !== undefined
        ? paceTarget(targets.pace)
        : targets.freeride === true
          ? "freeride"
          : undefined;
  const cadence = targets.cadence === undefined
    ? undefined
    : cleanTarget(targets.cadence, /^cadence\s+/i);
  return [primary, cadence].filter((value): value is string => value !== undefined && value.length > 0);
}

function defaultIntensity(step: Exclude<WorkoutStep, { type: "REPEAT" }>): WorkoutStepIntensity {
  if (step.intensity !== undefined) return step.intensity;
  if (step.type === "WARMUP") return "warmup";
  if (step.type === "COOLDOWN") return "cooldown";
  return "active";
}

function cueText(step: Exclude<WorkoutStep, { type: "REPEAT" }>): string {
  const instruction = step.instruction.trim().replace(/\s+/g, " ");
  const rpe = step.targets?.rpe;
  if (rpe === undefined || /\bRPE\b/i.test(instruction)) return instruction;
  return `${instruction}${instruction.length === 0 ? "" : " "}RPE ${rpe.trim()}`;
}

function serializeStep(step: Exclude<WorkoutStep, { type: "REPEAT" }>): string {
  const cue = cueText(step);
  const details = [
    cue,
    durationToken(step.durationSeconds),
    ...targetText(step.targets),
    `intensity=${defaultIntensity(step)}`,
  ].filter(Boolean);
  return `- ${details.join(" ")}`;
}

function validateTargetCombination(
  step: Exclude<WorkoutStep, { type: "REPEAT" }>,
  sport: WorkoutSport | undefined,
): void {
  const targets = step.targets;
  if (targets === undefined) return;
  const primaryCount = [targets.power, targets.heartRate, targets.pace, targets.freeride === true ? "freeride" : undefined]
    .filter((value) => value !== undefined).length;
  if (primaryCount > 1) {
    throw new RangeError("A workout step can use only one primary target: power, heart rate, pace or freeride");
  }
  if (targets.pace !== undefined && sport !== undefined && sport !== "running") {
    throw new RangeError("Pace targets are only supported for running workouts");
  }
  if (targets.cadence !== undefined && sport !== undefined && ![
    "running",
    "cycling",
    "indoor_cycling",
    "mountain_biking",
    "gravel_cycling",
  ].includes(sport)) {
    throw new RangeError("Cadence targets are not supported for this workout sport");
  }
  if (targets.freeride === true && sport !== undefined && ![
    "cycling",
    "indoor_cycling",
    "mountain_biking",
    "gravel_cycling",
  ].includes(sport)) {
    throw new RangeError("Freeride is only supported for cycling workouts");
  }
  if (sport === "strength" && (targets.power !== undefined || targets.heartRate !== undefined || targets.pace !== undefined)) {
    throw new RangeError("Strength workouts support time-based steps and display cues, not endurance targets");
  }
}

export function validateWorkoutForGarmin(
  steps: WorkoutStep[],
  options: WorkoutSerializationOptions = {},
): void {
  let programmedStepCount = 0;
  for (const step of steps) {
    if (step.type === "REPEAT") {
      if (!Number.isInteger(step.repetitions) || step.repetitions < 2 || step.repetitions > 99) {
        throw new RangeError("Workout repetitions must be between 2 and 99");
      }
      if (step.steps.length === 0) throw new RangeError("A repeat block must contain at least one step");
      programmedStepCount += 1 + step.steps.length;
      for (const child of step.steps) validateTargetCombination(child, options.sport);
      continue;
    }
    programmedStepCount += 1;
    validateTargetCombination(step, options.sport);
  }
  if (programmedStepCount > 50) {
    throw new RangeError("Garmin workouts support at most 50 programmed steps");
  }
}

/**
 * Emits Garmin-compatible Intervals.icu Workout Builder text.
 *
 * Cue text deliberately precedes the duration so Intervals exports it as the
 * Garmin step description. Repeat children remain contiguous and unindented;
 * a blank line terminates the repeat block.
 */
export function serializeIntervalsWorkout(
  steps: WorkoutStep[],
  options: WorkoutSerializationOptions = {},
): string {
  validateWorkoutForGarmin(steps, options);
  const sections: string[] = [];
  for (const step of steps) {
    if (step.type === "REPEAT") {
      const repeatCue = step.instruction?.trim().replace(/\s+/g, " ");
      const heading = `${repeatCue === undefined || repeatCue.length === 0 ? "" : `${repeatCue} `}${String(step.repetitions)}x`;
      sections.push(`${heading}\n${step.steps.map(serializeStep).join("\n")}`);
      continue;
    }
    const heading = step.type === "WARMUP" ? "Warmup" : step.type === "COOLDOWN" ? "Cooldown" : undefined;
    sections.push(heading === undefined ? serializeStep(step) : `${heading}\n${serializeStep(step)}`);
  }
  return sections.join("\n\n");
}

function parseDurationToken(token: string): number | undefined {
  const match = /^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/i.exec(token);
  if (match === null || (match[1] === undefined && match[2] === undefined && match[3] === undefined)) return undefined;
  return Number(match[1] ?? 0) * 3_600 + Number(match[2] ?? 0) * 60 + Number(match[3] ?? 0);
}

const DURATION_IN_LINE = /(?:^|\s)((?:\d+h(?:\d+m)?(?:\d+s)?)|(?:\d+m(?:\d+s)?)|(?:\d+s))(?=\s|$)/i;

/** Best-effort parser for native text returned by Intervals.icu. */
export function parseIntervalsWorkout(description: string): WorkoutStep[] {
  const lines = description.split(/\r?\n/).map((line) => line.trim());
  const output: WorkoutStep[] = [];
  let section: "STEP" | "WARMUP" | "COOLDOWN" = "STEP";
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? "";
    if (line.length === 0) continue;
    if (/^warm\s*up$/i.test(line)) { section = "WARMUP"; continue; }
    if (/^cool\s*down$/i.test(line)) { section = "COOLDOWN"; continue; }
    const repeat = /^(?:(.*?)\s+)?(\d+)x$/i.exec(line);
    if (repeat !== null) {
      const children: Exclude<WorkoutStep, { type: "REPEAT" }>[] = [];
      let childIndex = index + 1;
      // Read legacy descriptions that accidentally placed a blank line between
      // the repeat header and its children, even though Intervals ignores it.
      while (childIndex < lines.length && (lines[childIndex] ?? "").length === 0) childIndex += 1;
      while (childIndex < lines.length && /^-\s*/.test(lines[childIndex] ?? "")) {
        const parsed = parseSimpleLine(lines[childIndex] ?? "", "STEP");
        if (parsed !== undefined) children.push(parsed);
        childIndex += 1;
      }
      if (children.length > 0) {
        const instruction = repeat[1]?.trim();
        output.push({
          type: "REPEAT",
          repetitions: Number(repeat[2]),
          ...(instruction === undefined || instruction.length === 0 ? {} : { instruction }),
          steps: children,
        });
        index = childIndex - 1;
      }
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
  const bullet = /^-\s*(.+)$/.exec(line);
  if (bullet === null) return undefined;
  const body = bullet[1] ?? "";
  const duration = DURATION_IN_LINE.exec(body);
  if (duration === null) return undefined;
  const token = duration[1] ?? "";
  const durationSeconds = parseDurationToken(token);
  if (durationSeconds === undefined) return undefined;
  const before = body.slice(0, duration.index).trim();
  const afterStart = duration.index + duration[0].length;
  const after = body.slice(afterStart).trim();
  const intensityMatch = /(?:^|\s)intensity=(active|interval|recovery|rest|warmup|cooldown)(?=\s|$)/i.exec(after);
  const intensity = intensityMatch?.[1]?.toLowerCase() as WorkoutStepIntensity | undefined;
  const residual = intensityMatch === null
    ? after
    : `${after.slice(0, intensityMatch.index)} ${after.slice(intensityMatch.index + intensityMatch[0].length)}`.trim();
  const instruction = before.length > 0 ? before : residual;
  const inferredType = intensity === "warmup" ? "WARMUP" : intensity === "cooldown" ? "COOLDOWN" : type;
  return {
    type: inferredType,
    durationSeconds,
    instruction,
    ...(intensity === undefined ? {} : { intensity }),
  };
}
