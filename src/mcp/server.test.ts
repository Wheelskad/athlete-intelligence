import { describe, expect, it } from "vitest";
import { Client } from "@modelcontextprotocol/client";
import { InMemoryTransport } from "@modelcontextprotocol/server";
import { z } from "zod";
import { getTrainingContext } from "../application/get-training-context";
import { sanitizeTrainingContext } from "../privacy/sanitize";
import { FixtureProvider } from "../providers/fixture-provider";
import { createAthleteDataServer, TOOL_DEFINITIONS } from "./server";
import { createInMemoryTrainingMemory } from "../persistence/in-memory-training-memory";

const athlete = { athleteId: "test-athlete", goals: [], preferences: {} };

describe("MCP contract", () => {
  it("declares runtime memory tools alongside the existing connector tools", async () => {
    expect(TOOL_DEFINITIONS).toHaveLength(10);
    expect(TOOL_DEFINITIONS.map((tool) => tool.name)).toEqual([
      "get_week_summary",
      "get_recovery_summary",
      "get_training_context",
      "get_performance_metrics",
      "get_training_runtime_context",
      "get_training_decision_history",
      "save_training_decision",
      "update_training_decision_status",
      "record_daily_check_in",
      "publish_training_plan",
    ]);
    expect(TOOL_DEFINITIONS.map((tool) => tool.annotations)).toEqual([
      { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
      { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
      { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
      { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
      { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
      { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
      { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
      { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
      { readOnlyHint: false, destructiveHint: false, openWorldHint: true },
      { readOnlyHint: false, destructiveHint: true, openWorldHint: true },
    ]);

    const server = createAthleteDataServer({
      provider: FixtureProvider.anchoredAt("2026-09-14"),
      options: { timezone: "Europe/Paris", maxHistoryDays: 42 },
      athlete,
      memory: createInMemoryTrainingMemory(),
    });
    const client = new Client({ name: "contract-test", version: "1.0.0" });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await server.connect(serverTransport);
    await client.connect(clientTransport);
    try {
      const listed = await client.listTools();
      expect(
        listed.tools.map((tool) => ({ name: tool.name, annotations: tool.annotations })),
      ).toEqual(TOOL_DEFINITIONS);
      expect(
        listed.tools.every(
          (tool) =>
            JSON.stringify(tool._meta?.securitySchemes) ===
            JSON.stringify([{ type: "oauth2", scopes: ["athlete:access"] }]),
        ),
      ).toBe(true);
    } finally {
      await client.close();
      await server.close();
    }
  });

  it("exposes the consolidated dashboard metrics as a compact MCP tool", async () => {
    const server = createAthleteDataServer({
      provider: FixtureProvider.anchoredAt("2026-09-14"),
      options: {
        timezone: "Europe/Paris",
        maxHistoryDays: 42,
        now: () => new Date("2026-09-14T07:30:00Z"),
      },
      athlete,
      memory: createInMemoryTrainingMemory(),
    });
    const client = new Client({ name: "performance-test", version: "1.0.0" });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await server.connect(serverTransport);
    await client.connect(clientTransport);
    try {
      const result = await client.callTool({
        name: "get_performance_metrics",
        arguments: { historyDays: 42 },
      });
      const output = z
        .object({
          performance: z.object({
            weeklyTrend: z.array(z.object({ sessionCount: z.number() })),
          }),
          loadDynamics: z.object({
            current: z.object({
              fitness: z.number(),
              fatigue: z.number(),
              form: z.number(),
            }),
          }),
          aerobicFitness: z.object({ vo2Max: z.object({ latest: z.number() }) }),
        })
        .parse(result.structuredContent);
      expect(output.performance.weeklyTrend).toHaveLength(6);
      expect(output.loadDynamics.current.fitness).toBeGreaterThan(0);
      expect(output.aerobicFitness.vo2Max.latest).toBeGreaterThan(0);
    } finally {
      await client.close();
      await server.close();
    }
  });

  it("keeps a stable get_training_context output contract", async () => {
    const output = sanitizeTrainingContext(
      await getTrainingContext(
        FixtureProvider.anchoredAt("2026-09-14"),
        { historyDays: 14, includeUpcomingCalendar: true },
        { timezone: "Europe/Paris", maxHistoryDays: 42, now: () => new Date("2026-09-14T07:30:00Z") },
      ),
    ) as Record<string, unknown>;
    expect({
      topLevelKeys: Object.keys(output),
      missingMetrics: output.missingMetrics,
      dataQuality: output.dataQuality,
      upcomingCalendar: output.upcomingCalendar,
    }).toEqual({
      topLevelKeys: [
        "generatedAt",
        "timezone",
        "period",
        "freshness",
        "activities",
        "recovery",
        "performance",
        "upcomingCalendar",
        "dataQuality",
        "missingMetrics",
      ],
      missingMetrics: [
        "trainingReadiness",
        "garminRecoveryTime",
        "trainingStatus",
        "acuteLoadFocus",
        "enduranceScore",
      ],
      dataQuality: { score: 1, label: "good" },
      upcomingCalendar: {
        period: { startDate: "2026-09-15", endDate: "2026-10-12" },
        available: true,
        events: [
          { date: "2026-09-16", category: "WORKOUT", sport: "cycling", durationMinutes: 90, trainingLoad: 70 },
          { date: "2026-09-18", category: "WORKOUT", sport: "running", durationMinutes: 45, trainingLoad: 48 },
        ],
      },
    });
  });
});
