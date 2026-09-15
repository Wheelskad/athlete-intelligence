import OAuthProvider, { type OAuthHelpers } from "@cloudflare/workers-oauth-provider";
import { createMcpHandler } from "agents/mcp/server";
import { parseConfig, type WorkerEnv } from "./config/env";
import { createAthleteDataServer } from "./mcp/server";
import { ATHLETE_ACCESS_SCOPE } from "./mcp/security";
import { accessOAuthHandler, type AccessOAuthEnv } from "./oauth/access-auth";
import { createProvider } from "./providers/create-provider";

interface OAuthProps {
  subject: string;
  email: string;
  name: string;
  scopes: string[];
}

export interface McpWorkerEnv extends WorkerEnv, AccessOAuthEnv {
  OAUTH_KV: KVNamespace;
  OAUTH_PROVIDER: OAuthHelpers;
}

const apiHandler = {
  async fetch(request, env, context) {
    const auth = context as ExecutionContext<OAuthProps>;
    if (!auth.props.email || !auth.props.scopes.includes(ATHLETE_ACCESS_SCOPE)) {
      return Response.json(
        { error: "INSUFFICIENT_SCOPE", message: "The athlete:access scope is required." },
        { status: 403, headers: { "Cache-Control": "no-store" } },
      );
    }

    const config = parseConfig(env);
    const provider = createProvider(config);
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
} satisfies ExportedHandler<McpWorkerEnv>;

export default new OAuthProvider<McpWorkerEnv>({
  apiRoute: "/mcp",
  apiHandler,
  defaultHandler: accessOAuthHandler,
  authorizeEndpoint: "/authorize",
  tokenEndpoint: "/oauth/token",
  clientRegistrationEndpoint: "/oauth/register",
  clientIdMetadataDocumentEnabled: true,
  scopesSupported: [ATHLETE_ACCESS_SCOPE],
  resourceMetadata: {
    scopes_supported: [ATHLETE_ACCESS_SCOPE],
    bearer_methods_supported: ["header"],
    resource_name: "Athlete Intelligence MCP",
  },
  accessTokenTTL: 60 * 60,
  refreshTokenTTL: 24 * 60 * 60,
});
