import { describe, expect, it } from "vitest";
import type { ActivitySummary } from "../domain/activity";
import { FixtureProvider } from "../providers/fixture-provider";
import { getTrainingContext } from "../application/get-training-context";
import { sanitizeTrainingContext, sanitizeWeekSummary } from "./sanitize";
import { getWeekSummary } from "../application/get-week-summary";

const FORBIDDEN = /latitude|longitude|polyline|authorization|token|address|gpx|tcx/i;
const FORBIDDEN_EXACT = new Set(["lat", "lng", "map", "route", "fit"]);

function assertNoForbiddenKeys(value: unknown): void {
  if (Array.isArray(value)) {
    for (const item of value) assertNoForbiddenKeys(item);
    return;
  }
  if (value === null || typeof value !== "object") return;
  for (const [key, nested] of Object.entries(value)) {
    expect(FORBIDDEN.test(key) || FORBIDDEN_EXACT.has(key.toLowerCase()), `forbidden key: ${key}`).toBe(false);
    assertNoForbiddenKeys(nested);
  }
}

describe("privacy allowlist", () => {
  it("recursively excludes GPS, route, free-name, raw and secret fields", async () => {
    const provider = FixtureProvider.anchoredAt("2026-09-14");
    const context = await getTrainingContext(
      provider,
      {},
      { timezone: "Europe/Paris", maxHistoryDays: 42, now: () => new Date("2026-09-14T07:30:00Z") },
    );
    const output = sanitizeTrainingContext(context);
    assertNoForbiddenKeys(output);
    expect(JSON.stringify(output)).not.toContain("fixture-a1");
  });

  it("drops unexpected properties even when they are attached to a domain object", async () => {
    const provider = FixtureProvider.anchoredAt("2026-09-14");
    const summary = await getWeekSummary(
      provider,
      {},
      { timezone: "Europe/Paris", maxHistoryDays: 42, now: () => new Date("2026-09-14T07:30:00Z") },
    );
    const poisoned = summary.activities[0] as ActivitySummary & Record<string, unknown>;
    poisoned.latitude = 43.1;
    poisoned.name = "Private trailhead";
    poisoned.authorization = "Bearer secret";
    const output = sanitizeWeekSummary(summary);
    assertNoForbiddenKeys(output);
    expect(JSON.stringify(output)).not.toContain("Private trailhead");
    expect(JSON.stringify(output)).not.toContain("Bearer secret");
  });
});
