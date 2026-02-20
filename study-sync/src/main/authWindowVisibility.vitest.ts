import { describe, expect, it } from "vitest";

import { shouldShowAuthWindow } from "./authWindowVisibility";

describe("shouldShowAuthWindow", () => {
  it("shows when there are no credentials", () => {
    expect(
      shouldShowAuthWindow({
        hasCreds: false,
        autoLoginEnabled: true,
        showLoginWindow: false,
      }),
    ).toBe(true);
  });

  it("shows when auto-login is disabled", () => {
    expect(
      shouldShowAuthWindow({
        hasCreds: true,
        autoLoginEnabled: false,
        showLoginWindow: false,
      }),
    ).toBe(true);
  });

  it("shows when user explicitly wants to see the window", () => {
    expect(
      shouldShowAuthWindow({
        hasCreds: true,
        autoLoginEnabled: true,
        showLoginWindow: true,
      }),
    ).toBe(true);
  });

  it("keeps hidden when auto-login is enabled and creds exist and preference is off", () => {
    expect(
      shouldShowAuthWindow({
        hasCreds: true,
        autoLoginEnabled: true,
        showLoginWindow: false,
      }),
    ).toBe(false);
  });
});
