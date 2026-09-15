import type { TrainingMemoryServices } from "./training-memory";
import type { PreWorkoutFeedbackDraft } from "../domain/training-runtime";

export async function recordPreWorkoutFeedback(
  memory: TrainingMemoryServices,
  athleteId: string,
  feedback: PreWorkoutFeedbackDraft,
) {
  if (Object.keys(feedback).length === 0) {
    throw new RangeError("At least one pre-workout feedback field is required");
  }
  if (feedback.managedId !== undefined) {
    const managed = await memory.managedWorkouts.findByManagedId(athleteId, feedback.managedId);
    if (managed === undefined) throw new RangeError("Managed workout not found");
  }
  return memory.preWorkoutFeedback.create(athleteId, feedback);
}
