import {
  AuthorizationError,
  type AuthRequest,
  type ClientInfo,
  type OAuthHelpers,
} from "@cloudflare/workers-oauth-provider";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { ATHLETE_ACCESS_SCOPE } from "../mcp/security";

const STATE_TTL_SECONDS = 10 * 60;
const CSRF_COOKIE = "__Host-athlete_mcp_csrf";
const textEncoder = new TextEncoder();
const jwksByUrl = new Map<string, ReturnType<typeof createRemoteJWKSet>>();

export interface AccessOAuthEnv {
  OAUTH_KV: KVNamespace;
  OAUTH_PROVIDER: OAuthHelpers;
  ACCESS_CLIENT_ID: string;
  ACCESS_CLIENT_SECRET: string;
  ACCESS_TOKEN_URL: string;
  ACCESS_AUTHORIZATION_URL: string;
  ACCESS_JWKS_URL: string;
  ACCESS_ISSUER: string;
  COOKIE_ENCRYPTION_KEY: string;
  AUTHORIZED_EMAILS: string;
}

interface UpstreamState {
  oauthRequest: AuthRequest;
  codeVerifier: string;
  nonce: string;
}

interface OidcTokenResponse {
  id_token?: string;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/u, "");
}

function base64UrlToBytes(value: string): Uint8Array {
  const normalized = value.replaceAll("-", "+").replaceAll("_", "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    textEncoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

async function signedState(secret: string): Promise<{ id: string; value: string }> {
  const id = crypto.randomUUID();
  const signature = await crypto.subtle.sign("HMAC", await hmacKey(secret), textEncoder.encode(id));
  return { id, value: `${id}.${bytesToBase64Url(new Uint8Array(signature))}` };
}

async function verifiedStateId(value: string, secret: string): Promise<string | undefined> {
  const separator = value.lastIndexOf(".");
  if (separator < 1) return undefined;
  const id = value.slice(0, separator);
  let signature: Uint8Array;
  try {
    signature = base64UrlToBytes(value.slice(separator + 1));
  } catch {
    return undefined;
  }
  const valid = await crypto.subtle.verify(
    "HMAC",
    await hmacKey(secret),
    signature.buffer as ArrayBuffer,
    textEncoder.encode(id),
  );
  return valid ? id : undefined;
}

async function storeState(
  env: AccessOAuthEnv,
  prefix: string,
  value: unknown,
): Promise<string> {
  const state = await signedState(env.COOKIE_ENCRYPTION_KEY);
  await env.OAUTH_KV.put(`${prefix}:${state.id}`, JSON.stringify(value), {
    expirationTtl: STATE_TTL_SECONDS,
  });
  return state.value;
}

async function consumeState<T>(
  env: AccessOAuthEnv,
  prefix: string,
  state: string,
): Promise<T | undefined> {
  const id = await verifiedStateId(state, env.COOKIE_ENCRYPTION_KEY);
  if (!id) return undefined;
  const key = `${prefix}:${id}`;
  const value = await env.OAUTH_KV.get(key);
  if (!value) return undefined;
  await env.OAUTH_KV.delete(key);
  try {
    return JSON.parse(value) as T;
  } catch {
    return undefined;
  }
}

function readCookie(request: Request, name: string): string | undefined {
  return request.headers
    .get("cookie")
    ?.split(";")
    .map((cookie) => cookie.trim())
    .find((cookie) => cookie.startsWith(`${name}=`))
    ?.slice(name.length + 1);
}

function authorizationErrorResponse(error: AuthorizationError): Response {
  if (!error.redirectUri) return new Response(error.description, { status: 400 });
  const redirect = new URL(error.redirectUri);
  redirect.searchParams.set("error", error.code);
  redirect.searchParams.set("error_description", error.description);
  if (error.state) redirect.searchParams.set("state", error.state);
  if (error.issuer) redirect.searchParams.set("iss", error.issuer);
  return Response.redirect(redirect, 302);
}

function denyAuthorization(oauthRequest: AuthRequest): Response {
  const redirect = new URL(oauthRequest.redirectUri);
  redirect.searchParams.set("error", "access_denied");
  redirect.searchParams.set("error_description", "The user declined access.");
  redirect.searchParams.set("state", oauthRequest.state);
  if (oauthRequest.issuer) redirect.searchParams.set("iss", oauthRequest.issuer);
  return Response.redirect(redirect, 302);
}

function consentPage(
  client: ClientInfo,
  oauthRequest: AuthRequest,
  state: string,
  csrfToken: string,
): Response {
  const clientName = escapeHtml(client.clientName ?? "MCP client");
  const scopes = oauthRequest.scope.map(escapeHtml).join(", ") || ATHLETE_ACCESS_SCOPE;
  const html = `<!doctype html>
<html lang="fr">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Autoriser ${clientName}</title>
<style>
:root{color-scheme:dark;font-family:Inter,ui-sans-serif,system-ui;background:#0b0e0d;color:#f2f5f3}body{margin:0;min-height:100vh;display:grid;place-items:center;padding:24px}.card{width:min(560px,100%);box-sizing:border-box;border:1px solid #29312d;border-radius:18px;background:#121715;padding:32px;box-shadow:0 24px 80px #0008}.eyebrow{color:#b8f34a;font-size:11px;font-weight:800;letter-spacing:.16em;text-transform:uppercase}h1{margin:10px 0 14px;font-size:30px}p{color:#a8b2ad;line-height:1.55}.scope{padding:13px;border-radius:10px;background:#1a211e;color:#d9e0dc;font-family:ui-monospace,monospace;font-size:13px}.actions{display:flex;gap:10px;margin-top:26px}button{flex:1;border:1px solid #39433e;border-radius:10px;padding:13px;font-weight:750;cursor:pointer;background:#1a211e;color:#f2f5f3}button.primary{background:#b8f34a;border-color:#b8f34a;color:#11160f}
</style></head>
<body><main class="card"><div class="eyebrow">Athlete Intelligence · OAuth</div><h1>Autoriser ${clientName} ?</h1><p>Ce client pourra consulter tes données sportives et appeler les actions MCP. Les écritures Intervals.icu exigent toujours une confirmation explicite dans la conversation.</p><div class="scope">Permission : ${scopes}</div><form method="post" action="/authorize"><input type="hidden" name="state" value="${escapeHtml(state)}"><input type="hidden" name="csrf_token" value="${escapeHtml(csrfToken)}"><div class="actions"><button type="submit" name="decision" value="deny">Refuser</button><button class="primary" type="submit" name="decision" value="allow">Autoriser</button></div></form></main></body></html>`;
  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'",
      "Referrer-Policy": "no-referrer",
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "DENY",
      "Set-Cookie": `${CSRF_COOKIE}=${csrfToken}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${String(STATE_TTL_SECONDS)}`,
    },
  });
}

async function createPkce(): Promise<{ verifier: string; challenge: string }> {
  const verifier = bytesToBase64Url(crypto.getRandomValues(new Uint8Array(32)));
  const digest = await crypto.subtle.digest("SHA-256", textEncoder.encode(verifier));
  return { verifier, challenge: bytesToBase64Url(new Uint8Array(digest)) };
}

function upstreamAuthorizationUrl(
  request: Request,
  env: AccessOAuthEnv,
  state: string,
  challenge: string,
  nonce: string,
): string {
  const url = new URL(env.ACCESS_AUTHORIZATION_URL);
  url.searchParams.set("client_id", env.ACCESS_CLIENT_ID);
  url.searchParams.set("redirect_uri", new URL("/callback", request.url).href);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "openid email profile");
  url.searchParams.set("state", state);
  url.searchParams.set("nonce", nonce);
  url.searchParams.set("code_challenge", challenge);
  url.searchParams.set("code_challenge_method", "S256");
  return url.href;
}

async function exchangeAuthorizationCode(
  request: Request,
  env: AccessOAuthEnv,
  code: string,
  verifier: string,
): Promise<string> {
  const response = await fetch(env.ACCESS_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      client_id: env.ACCESS_CLIENT_ID,
      client_secret: env.ACCESS_CLIENT_SECRET,
      code,
      redirect_uri: new URL("/callback", request.url).href,
      code_verifier: verifier,
    }),
  });
  if (!response.ok) throw new Error(`Upstream token exchange failed (${String(response.status)})`);
  const token = await response.json<OidcTokenResponse>();
  if (!token.id_token) throw new Error("Upstream token response did not include an ID token");
  return token.id_token;
}

function allowedEmails(env: AccessOAuthEnv): Set<string> {
  return new Set(
    env.AUTHORIZED_EMAILS.split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
  );
}

async function handleAuthorizeGet(request: Request, env: AccessOAuthEnv): Promise<Response> {
  let oauthRequest: AuthRequest;
  try {
    oauthRequest = await env.OAUTH_PROVIDER.parseAuthRequest(request);
  } catch (error) {
    if (error instanceof AuthorizationError) return authorizationErrorResponse(error);
    throw error;
  }
  if (!oauthRequest.scope.includes(ATHLETE_ACCESS_SCOPE)) {
    return authorizationErrorResponse(
      new AuthorizationError("invalid_scope", {
        description: `The ${ATHLETE_ACCESS_SCOPE} scope is required.`,
        redirectUri: oauthRequest.redirectUri,
        state: oauthRequest.state,
        ...(oauthRequest.issuer ? { issuer: oauthRequest.issuer } : {}),
      }),
    );
  }
  const client = await env.OAUTH_PROVIDER.lookupClient(oauthRequest.clientId);
  if (!client) return new Response("Unknown OAuth client", { status: 400 });
  const state = await storeState(env, "oauth:consent", oauthRequest);
  const csrfToken = crypto.randomUUID();
  return consentPage(client, oauthRequest, state, csrfToken);
}

async function handleAuthorizePost(request: Request, env: AccessOAuthEnv): Promise<Response> {
  const form = await request.formData();
  const csrfFromForm = form.get("csrf_token");
  const csrfFromCookie = readCookie(request, CSRF_COOKIE);
  if (typeof csrfFromForm !== "string" || !csrfFromCookie || csrfFromForm !== csrfFromCookie) {
    return new Response("Invalid or expired CSRF token", { status: 400 });
  }
  const state = form.get("state");
  if (typeof state !== "string") return new Response("Missing authorization state", { status: 400 });
  const oauthRequest = await consumeState<AuthRequest>(env, "oauth:consent", state);
  if (!oauthRequest) return new Response("Invalid or expired authorization state", { status: 400 });
  if (form.get("decision") !== "allow") return denyAuthorization(oauthRequest);

  const pkce = await createPkce();
  const nonce = crypto.randomUUID();
  const upstreamState = await storeState(env, "oauth:upstream", {
    oauthRequest,
    codeVerifier: pkce.verifier,
    nonce,
  } satisfies UpstreamState);
  return Response.redirect(
    upstreamAuthorizationUrl(request, env, upstreamState, pkce.challenge, nonce),
    302,
  );
}

async function handleCallback(request: Request, env: AccessOAuthEnv): Promise<Response> {
  const url = new URL(request.url);
  const state = url.searchParams.get("state");
  const code = url.searchParams.get("code");
  if (!state || !code) return new Response("Missing OAuth callback parameters", { status: 400 });
  const upstream = await consumeState<UpstreamState>(env, "oauth:upstream", state);
  if (!upstream) return new Response("Invalid or expired OAuth callback state", { status: 400 });

  const idToken = await exchangeAuthorizationCode(request, env, code, upstream.codeVerifier);
  let jwks = jwksByUrl.get(env.ACCESS_JWKS_URL);
  if (!jwks) {
    jwks = createRemoteJWKSet(new URL(env.ACCESS_JWKS_URL));
    jwksByUrl.set(env.ACCESS_JWKS_URL, jwks);
  }
  const { payload } = await jwtVerify(idToken, jwks, {
    issuer: env.ACCESS_ISSUER,
    audience: env.ACCESS_CLIENT_ID,
    algorithms: ["RS256"],
  });
  if (payload.nonce !== upstream.nonce) return new Response("Invalid OIDC nonce", { status: 400 });
  if (typeof payload.email !== "string" || typeof payload.sub !== "string") {
    return new Response("The identity provider did not return a usable identity", { status: 403 });
  }
  const email = payload.email.toLowerCase();
  if (!allowedEmails(env).has(email)) return new Response("This account is not authorized", { status: 403 });

  const scope = upstream.oauthRequest.scope.filter((value) => value === ATHLETE_ACCESS_SCOPE);
  const subjectHash = await crypto.subtle.digest("SHA-256", textEncoder.encode(payload.sub));
  const { redirectTo } = await env.OAUTH_PROVIDER.completeAuthorization({
    request: upstream.oauthRequest,
    userId: bytesToBase64Url(new Uint8Array(subjectHash)),
    metadata: { client: upstream.oauthRequest.clientId },
    scope,
    props: {
      subject: payload.sub,
      email,
      name: typeof payload.name === "string" ? payload.name : email,
      scopes: scope,
    },
  });
  return Response.redirect(redirectTo, 302);
}

export const accessOAuthHandler = {
  async fetch(request, env) {
    const url = new URL(request.url);
    try {
      if (url.pathname === "/" && request.method === "GET") {
        return Response.json({
          name: "Athlete Intelligence MCP",
          status: "ready",
          endpoint: "/mcp",
          authentication: "OAuth 2.1 via Cloudflare Access",
        });
      }
      if (url.pathname === "/authorize" && request.method === "GET") {
        return await handleAuthorizeGet(request, env);
      }
      if (url.pathname === "/authorize" && request.method === "POST") {
        return await handleAuthorizePost(request, env);
      }
      if (url.pathname === "/callback" && request.method === "GET") {
        return await handleCallback(request, env);
      }
      return new Response("Not found", { status: 404 });
    } catch (error) {
      console.error("OAuth request failed", error instanceof Error ? error.message : "Unknown error");
      return new Response("OAuth request failed", { status: 500 });
    }
  },
} satisfies ExportedHandler<AccessOAuthEnv>;
