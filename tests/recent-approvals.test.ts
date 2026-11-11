/// <reference types="bun" />
import { describe, expect, test } from "bun:test";
import { isRecentlyApproved } from "../src/lib/recent-approvals";

const now = Date.parse("2026-11-11T00:00:00Z");
describe("recently approved stays 7 days", () => {
  test("shown 6 days after approval", () => {
    expect(isRecentlyApproved("2026-11-05T00:00:00Z", "Approved", now)).toBe(true);
  });
  test("hidden after 7 days", () => {
    expect(isRecentlyApproved("2026-11-03T23:00:00Z", "Approved", now)).toBe(false);
  });
  test("not marked when back to W.Customer", () => {
    expect(isRecentlyApproved("2026-11-10T00:00:00Z", "W.Customer", now)).toBe(false);
  });
});
