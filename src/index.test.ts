import { describe, expect, it } from "vitest";
import { z } from "zod";
import worker from "./index";
import type { WorkerEnv } from "./config/env";

const env: WorkerEnv = {
  DATA_SOURCE: "fixtures",
  DEFAULT_TIMEZONE: "Europe/Paris",
  MAX_HISTORY_DAYS: "42",
  NODE_ENV: "development",
};
const context = {} as ExecutionContext;

describe("dashboard routes", () => {
  it("serves the dashboard with restrictive browser headers", async () => {
    const response = await worker.fetch(new Request("http://localhost/"), env, context);
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/html");
    expect(response.headers.get("content-security-policy")).toContain("default-src 'self'");
    await expect(response.text()).resolves.toContain("Athlete Intelligence");
  });

  it("serves a sanitized six-week dashboard payload", async () => {
    const response = await worker.fetch(
      new Request("http://localhost/api/dashboard?historyDays=42"),
      env,
      context,
    );
    expect(response.status).toBe(200);
    const payload = z
      .object({
        performance: z.object({ weeklyTrend: z.array(z.unknown()) }),
        recovery: z.unknown(),
      })
      .parse(await response.json());
    expect(payload.performance.weeklyTrend).toHaveLength(6);
    expect(payload).toHaveProperty("recovery");
    expect(JSON.stringify(payload)).not.toContain("fixture-a1");
  });

  it("rejects invalid dashboard history", async () => {
    const response = await worker.fetch(
      new Request("http://localhost/api/dashboard?historyDays=6"),
      env,
      context,
    );
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ error: "INVALID_RANGE" });
  });
});
