import { createMcpHandler } from "agents/mcp/server";
import { dateInTimezone } from "./application/date-range";
import { getTrainingContext } from "./application/get-training-context";
import { parseConfig, type WorkerEnv } from "./config/env";
import {
  DASHBOARD_CSS,
  DASHBOARD_CSS_EXTRA,
  DASHBOARD_HTML,
  DASHBOARD_JS,
} from "./dashboard/assets";
import type { AthleteDataProvider } from "./domain/provider";
import { createAthleteDataServer } from "./mcp/server";
import { sanitizeTrainingContext } from "./privacy/sanitize";
import { FixtureProvider } from "./providers/fixture-provider";
import { IntervalsClient, IntervalsProviderError } from "./providers/intervals/intervals-client";

function productionAuthPending(): Response {
  return Response.json(
    {
      error: "PRODUCTION_AUTH_NOT_CONFIGURED",
      message: "Remote access is disabled until OAuth 2.1 authentication and authorization are configured.",
    },
    { status: 503 },
  );
}

function createProvider(config: ReturnType<typeof parseConfig>, today: string): AthleteDataProvider {
  if (config.DATA_SOURCE === "fixtures") return FixtureProvider.anchoredAt(today);
  if (!config.INTERVALS_API_KEY || !config.INTERVALS_ATHLETE_ID) {
    throw new Error("Validated Intervals.icu credentials are unavailable");
  }
  return new IntervalsClient({
    apiKey: config.INTERVALS_API_KEY,
    athleteId: config.INTERVALS_ATHLETE_ID,
    maxHistoryDays: config.MAX_HISTORY_DAYS,
  });
}

function assetResponse(request: Request, body: string, contentType: string, html = false): Response {
  const headers = new Headers({
    "Content-Type": contentType,
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
  });
  if (html) {
    headers.set(
      "Content-Security-Policy",
      "default-src 'self'; connect-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; base-uri 'none'; frame-ancestors 'none'",
    );
  }
  return new Response(request.method === "HEAD" ? null : body, { headers });
}

async function dashboardData(request: Request, env: WorkerEnv): Promise<Response> {
  const config = parseConfig(env);
  if (config.NODE_ENV === "production") return productionAuthPending();
  const url = new URL(request.url);
  const historyDays = Number(url.searchParams.get("historyDays") ?? "42");
  const now = new Date();
  const provider = createProvider(config, dateInTimezone(now, config.DEFAULT_TIMEZONE));
  try {
    const context = await getTrainingContext(
      provider,
      { historyDays, includeUpcomingCalendar: true, calendarDays: 28 },
      {
        timezone: config.DEFAULT_TIMEZONE,
        maxHistoryDays: config.MAX_HISTORY_DAYS,
        now: () => now,
      },
    );
    return Response.json(
      {
        ...sanitizeTrainingContext(context),
        runtime: {
          dataSource: config.DATA_SOURCE,
          demo: config.DATA_SOURCE === "fixtures",
        },
      },
      {
      headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" },
      },
    );
  } catch (error: unknown) {
    if (error instanceof RangeError) {
      return Response.json({ error: "INVALID_RANGE", message: error.message }, { status: 400 });
    }
    if (error instanceof IntervalsProviderError) {
      return Response.json(
        { error: error.code, message: error.message },
        { status: error.status === 429 ? 429 : 502 },
      );
    }
    return Response.json(
      { error: "DASHBOARD_UNAVAILABLE", message: "Le dashboard ne peut pas charger les données." },
      { status: 500 },
    );
  }
}

export default {
  async fetch(request: Request, env: WorkerEnv, context: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    if (!["GET", "HEAD"].includes(request.method) && url.pathname !== "/mcp") {
      return Response.json({ error: "METHOD_NOT_ALLOWED" }, { status: 405, headers: { Allow: "GET, HEAD" } });
    }
    if (url.pathname === "/") {
      return assetResponse(request, DASHBOARD_HTML, "text/html; charset=utf-8", true);
    }
    if (url.pathname === "/dashboard.css") {
      return assetResponse(request, DASHBOARD_CSS + DASHBOARD_CSS_EXTRA, "text/css; charset=utf-8");
    }
    if (url.pathname === "/dashboard.js") {
      return assetResponse(request, DASHBOARD_JS, "text/javascript; charset=utf-8");
    }
    if (url.pathname === "/api/dashboard") return dashboardData(request, env);
    if (url.pathname !== "/mcp") return Response.json({ error: "NOT_FOUND" }, { status: 404 });
    const config = parseConfig(env);
    if (config.NODE_ENV === "production") return productionAuthPending();
    const now = new Date();
    const provider = createProvider(config, dateInTimezone(now, config.DEFAULT_TIMEZONE));
    const handler = createMcpHandler(
      () =>
        createAthleteDataServer({
          provider,
          options: {
            timezone: config.DEFAULT_TIMEZONE,
            maxHistoryDays: config.MAX_HISTORY_DAYS,
          },
        }),
      { route: "/mcp", corsOptions: false },
    );
    return handler(request, env, context);
  },
} satisfies ExportedHandler<WorkerEnv>;
