import { afterEach, describe, expect, mock, test } from "bun:test";
import { validateFeedbackUpdate } from "./feedback.schema";
import { saveFeedback } from "./feedback.server";

const input = { no: 1, token: "test-only-passcode", updates: {
  "Customer feedback": "Approved",
  "Remark customer feedback": "Confirmed",
} };
const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; });
const json = (data: unknown) => new Response(JSON.stringify(data), { headers: { "content-type": "application/json" } });
const sheet = (feedback = "w.customer", remark = "") => json({ rawData: [{ No: 1, "Customer feedback": feedback, "Remark customer feedback": remark }] });

describe("Wait Approval write rules", () => {
  test("accepts only the two approved editable fields", () => {
    expect(validateFeedbackUpdate(input).updates).toEqual({ "Customer feedback": "Approved", "Remark customer feedback": "Confirmed" });
    expect(() => validateFeedbackUpdate({ ...input, updates: { ...input.updates, Revenue: 100 } })).toThrow();
  });
  test("requires a passcode before writing", () => {
    expect(() => validateFeedbackUpdate({ ...input, token: "" })).toThrow();
  });
  test("rejects spreadsheet formulas", () => {
    expect(() => validateFeedbackUpdate({ ...input, updates: { ...input.updates, "Customer feedback": "=IMPORTXML(\"https://example.com\")" } })).toThrow();
  });
  test("forwards the deployed doPost contract and confirms both fields by read-back", async () => {
    const calls: RequestInit[] = [];
    globalThis.fetch = mock(async (_url: unknown, init?: RequestInit) => {
      calls.push(init ?? {});
      if (init?.method === "POST") return json({ ok: true });
      return calls.length === 1 ? sheet() : sheet("Approved", "Confirmed");
    }) as typeof fetch;
    expect(await saveFeedback(input)).toEqual({ ok: true });
    expect(calls).toHaveLength(3);
    expect(JSON.parse(String(calls[1]?.body))).toEqual(input);
    expect(calls[1]?.redirect).toBe("follow");
  });
  test("wrong passcodes produce no successful save", async () => {
    globalThis.fetch = mock(async (_url: unknown, init?: RequestInit) => init?.method === "POST" ? json({ error: "unauthorized" }) : sheet()) as typeof fetch;
    const result = await saveFeedback(input);
    expect(result.ok).toBe(false);
    expect(JSON.stringify(result)).not.toContain(input.token);
  });
  test("an acknowledgement without matching sheet data is not success", async () => {
    globalThis.fetch = mock(async (_url: unknown, init?: RequestInit) => init?.method === "POST" ? json({ ok: true }) : sheet()) as typeof fetch;
    expect((await saveFeedback(input)).ok).toBe(false);
  });
  test("ambiguous row numbers prevent writes", async () => {
    const calls: RequestInit[] = [];
    globalThis.fetch = mock(async (_url: unknown, init?: RequestInit) => {
      calls.push(init ?? {});
      return json({ rawData: [{ No: 1 }, { No: 1 }] });
    }) as typeof fetch;
    expect((await saveFeedback(input)).ok).toBe(false);
    expect(calls.some((call) => call.method === "POST")).toBe(false);
  });
});