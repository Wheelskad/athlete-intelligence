import type { TrainingMemoryServices } from "./training-memory";
import type { TrainingDecisionDraft } from "../domain/training-runtime";
import { TrainingContextService } from "./training-context-service";

export class TrainingRuntimeService {
  constructor(
    private readonly contextService: TrainingContextService,
    private readonly memory: TrainingMemoryServices,
    private readonly athleteId: string,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async getRuntimeContext(input: {
    historyDays?: number;
    calendarDays?: number;
    decisionDays?: number;
    decisionLimit?: number;
  }) {
    const context = await this.contextService.build(input.historyDays ?? 42, input.calendarDays ?? 28);
    const snapshot = await this.memory.contexts.create(context);
    const since = new Date(this.now().getTime() - (input.decisionDays ?? 28) * 86_400_000).toISOString();
    const recentDecisions = await this.memory.decisions.findRecent(
      this.athleteId,
      since,
      input.decisionLimit ?? 10,
    );
    return { ...snapshot, recentDecisions };
  }

  async getDecisionHistory(days = 28, limit = 20) {
    const since = new Date(this.now().getTime() - days * 86_400_000).toISOString();
    return {
      generatedAt: this.now().toISOString(),
      decisions: await this.memory.decisions.findRecent(this.athleteId, since, limit),
    };
  }

  saveDecision(draft: TrainingDecisionDraft) {
    return this.memory.decisions.create(this.athleteId, draft);
  }

  updateDecisionStatus(
    decisionId: string,
    status: "ACCEPTED" | "REJECTED",
    userFeedback?: string,
  ) {
    return this.memory.decisions.transition(decisionId, this.athleteId, status, userFeedback);
  }
}
