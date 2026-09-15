export const ATHLETE_ACCESS_SCOPE = "athlete:access";

export const OAUTH_TOOL_META = {
  securitySchemes: [{ type: "oauth2", scopes: [ATHLETE_ACCESS_SCOPE] }],
};
