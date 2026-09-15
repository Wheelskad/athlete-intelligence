import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import type { TrainingRuntimeService } from "../../application/training-runtime-service";
import { toolResult } from "../tool-result";
import { OAUTH_TOOL_META } from "../security";
import { managedIdSchema } from "./training-decision.schemas";

export function registerGetWorkoutDetailTool(server: McpServer, runtime: TrainingRuntimeService): void {
  server.registerTool(
    "get_workout_detail",
    {
      title: "Get one managed workout in full",
      description:
        "Returns the canonical description, structured blocks when available, expected and Intervals.icu-parsed duration, publication state and verification for one Athlete Intelligence workout. Never resolves or modifies non-managed calendar events.",
      inputSchema: z.object({ managedId: managedIdSchema }),
      annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
      _meta: OAUTH_TOOL_META,
    },
    async ({ managedId }) => toolResult(await runtime.getWorkoutDetail(managedId)),
  );
}
