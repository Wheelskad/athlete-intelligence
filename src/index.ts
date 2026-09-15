import { createMcpHandler } from "agents/mcp/server";
import { getTrainingContext } from "./application/get-training-context";
import { parseConfig, type WorkerEnv } from "./config/env";
import {
  DASHBOARD_CSS,
  DASHBOARD_CSS_EXTRA,
  DASHBOARD_HTML,
  DASHBOARD_JS,
} from "./dashboard/assets";
import { createAthleteDataServer } from "./mcp/server";
import { sanitizeTrainingContext } from "./privacy/sanitize";
import { createProvider } from "./providers/create-provider";
import { IntervalsProviderError } from "./providers/intervals/intervals-client";
import { createAthleteContext } from "./application/create-athlete-context";
import { createD1TrainingMemory } from "./persistence/d1-training-memory";
import { createInMemoryTrainingMemory } from "./persistence/in-memory-training-memory";

const developmentMemory = createInMemoryTrainingMemory();

function productionAuthPending(): Response {
  return Response.json(
    {
      error: "PRODUCTION_AUTH_NOT_CONFIGURED",
      message: "Remote access is disabled until OAuth 2.1 authentication and authorization are configured.",
    },
    { status: 503 },
  );
}

function productionAccessRequired(): Response {
  return Response.json(
    {
      error: "CLOUDFLARE_ACCESS_REQUIRED",
      message: "This deployment requires an authenticated Cloudflare Access identity.",
    },
    {
      status: 401,
      headers: {
        "Cache-Control": "no-store",
        "WWW-Authenticate": 'Bearer realm="athlete-intelligence"',
      },
    },
  );
}

async function hasAuthenticatedAccess(context: ExecutionContext): Promise<boolean> {
  if (!context.access) return false;
  try {
    const identity = await context.access.getIdentity();
    return typeof identity?.email === "string" && identity.email.length > 0;
  } catch {
    return false;
  }
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
  const url = new URL(request.url);
  const historyDays = Number(url.searchParams.get("historyDays") ?? "42");
  const now = new Date();
  const provider = createProvider(config, now);
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
    const config = parseConfig(env);
    if (config.NODE_ENV === "production" && !(await hasAuthenticatedAccess(context))) {
      return productionAccessRequired();
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
    if (config.NODE_ENV === "production") return productionAuthPending();
    const now = new Date();
    const provider = createProvider(config, now);
    const handler = createMcpHandler(
      () =>
        createAthleteDataServer({
          provider,
          options: {
            timezone: config.DEFAULT_TIMEZONE,
            maxHistoryDays: config.MAX_HISTORY_DAYS,
          },
          athlete: createAthleteContext(config),
          memory: env.TRAINING_DB === undefined
            ? developmentMemory
            : createD1TrainingMemory(env.TRAINING_DB),
        }),
      { route: "/mcp", corsOptions: false },
    );
    return handler(request, env, context);
  },
} satisfies ExportedHandler<WorkerEnv>;
