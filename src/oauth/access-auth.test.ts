import { afterEach, describe, expect, it, vi } from "vitest";
import { openAuthorizationState, sealAuthorizationState } from "./authorization-state";

const SECRET = "test-secret-that-is-long-enough-for-state-encryption";

afterEach(() => vi.useRealTimers());

describe("OAuth authorization state", () => {
  it("round-trips only for the intended purpose", async () => {
    const state = await sealAuthorizationState("consent", { clientId: "client-1" }, SECRET);

    await expect(
      openAuthorizationState<{ clientId: string }>("consent", state, SECRET),
    ).resolves.toEqual({ clientId: "client-1" });
    await expect(openAuthorizationState("callback", state, SECRET)).resolves.toBeUndefined();
  });

  it("rejects tampered and expired state", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-15T12:00:00Z"));
    const state = await sealAuthorizationState("consent", { ok: true }, SECRET);
    const tampered = `${state.slice(0, -1)}${state.endsWith("A") ? "B" : "A"}`;

    await expect(openAuthorizationState("consent", tampered, SECRET)).resolves.toBeUndefined();
    vi.advanceTimersByTime(10 * 60 * 1_000 + 1);
    await expect(openAuthorizationState("consent", state, SECRET)).resolves.toBeUndefined();
  });
});
