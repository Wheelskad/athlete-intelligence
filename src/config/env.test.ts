import { describe, expect, it } from "vitest";
import { ConfigurationError, parseConfig } from "./env";

describe("environment configuration", () => {
  it("defaults to local fixtures without a secret", () => {
    expect(parseConfig({})).toMatchObject({
      DATA_SOURCE: "fixtures",
      DEFAULT_TIMEZONE: "Europe/Paris",
      MAX_HISTORY_DAYS: 42,
      NODE_ENV: "development",
    });
  });

  it("requires both Intervals.icu identifiers in real mode", () => {
    expect(() => parseConfig({ DATA_SOURCE: "intervals" })).toThrow(ConfigurationError);
    expect(() => parseConfig({ DATA_SOURCE: "intervals" })).toThrow("INTERVALS_API_KEY");
  });
});
