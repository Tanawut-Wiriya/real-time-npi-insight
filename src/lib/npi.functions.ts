import { createServerFn } from "@tanstack/react-start";

const DATA_URL =
  "https://script.google.com/macros/s/AKfycbzvmHETMFLENY7HtHeLH6pP2uv0Q4YV51n6jfpi7IZW_8kEAuKo2iuEV40vTJvUryygFQ/exec";

export interface NpiRow {
  No: number;
  Product: string;
  Country: string;
  Article: string | number;
  Description: string;
  Quantity: number;
  Year: number;
  YearMonth: string; // normalized "YYYY-MM"
  Status: string;
  Delivery: string;
  Start: string; // YYYY-MM-DD or raw text
  Request: string;
  Plan: string; // YYYY-MM-DD or raw text
  CustomerFeedback: string;
  EstimateShipment: string;
  Shipment: string;
}

export interface AsmlRow {
  No: number;
  Product: string;
  Description: string;
  Article: string | number;
  Status: string;
  Plan: string; // normalized "YYYY-MM-DD"
  PlanYearMonth: string; // "YYYY-MM"
  PlanYear: number;
  Quantity: number;
  Remark: string;
}

// Bangkok timezone (GMT+7)
const TZ_OFFSET_MS = 7 * 60 * 60 * 1000;

function ymFromDate(d: Date): string {
  const shifted = new Date(d.getTime() + TZ_OFFSET_MS);
  return `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, "0")}`;
}

function normalizeYearMonth(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "number") {
    const ms = (v - 25569) * 86400 * 1000;
    const d = new Date(ms);
    if (!isNaN(d.getTime())) return ymFromDate(d);
  }
  if (typeof v === "string") {
    const ym = v.match(/^(\d{4})-(\d{2})$/);
    if (ym) return v;
    const d = new Date(v);
    if (!isNaN(d.getTime())) return ymFromDate(d);
    return v;
  }
  return String(v);
}

function formatDate(v: unknown): string {
  if (v == null || v === "") return "-";
  if (typeof v === "number") {
    const ms = (v - 25569) * 86400 * 1000;
    const d = new Date(ms);
    if (!isNaN(d.getTime())) {
      const shifted = new Date(d.getTime() + TZ_OFFSET_MS);
      return `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, "0")}-${String(shifted.getUTCDate()).padStart(2, "0")}`;
    }
  }
  if (typeof v === "string") {
    const d = new Date(v);
    if (!isNaN(d.getTime())) {
      const shifted = new Date(d.getTime() + TZ_OFFSET_MS);
      return `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, "0")}-${String(shifted.getUTCDate()).padStart(2, "0")}`;
    }
    return v;
  }
  return String(v);
}

function clean(s: unknown): string {
  if (s == null) return "";
  return String(s).replace(/^[:\s-]+/, "").trim() || "-";
}

function planYM(dateStr: string): string {
  const m = dateStr.match(/^(\d{4})-(\d{2})/);
  return m ? `${m[1]}-${m[2]}` : "";
}

/**
 * Business logic: Fetches raw data from the external endpoint.
 * Handles non-JSON responses gracefully (e.g. Google Sign-in redirects).
 */
async function fetchAllRaw(): Promise<{
  rawData: Array<Record<string, unknown>>;
  asmlRawData: Array<Record<string, unknown>>;
}> {
  const res = await fetch(DATA_URL, { redirect: "follow" });
  if (!res.ok) {
    throw new Error(`Data source returned status ${res.status}`);
  }

  const contentType = res.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    const text = await res.text();
    if (text.includes("<!DOCTYPE html>") || text.includes("<html")) {
      throw new Error(
        "Received HTML instead of JSON. This likely means the Google Apps Script is redirecting to a sign-in page. Please check your script permissions."
      );
    }
    throw new Error(`Expected JSON but received ${contentType}`);
  }

  let json: any;
  try {
    json = await res.json();
  } catch (err) {
    throw new Error("Failed to parse data as JSON. The source may be returning invalid data.");
  }

  if (Array.isArray(json)) {
    return { rawData: json, asmlRawData: [] };
  }
  const obj = (json ?? {}) as Record<string, unknown>;
  const rawData = Array.isArray(obj.rawData) ? obj.rawData : [];
  const asmlRawData = Array.isArray(obj.asmlRawData) ? obj.asmlRawData : [];
  return { rawData, asmlRawData };
}

/**
 * Logic for transforming raw NPI data.
 */
function transformNpiRows(raw: Array<Record<string, any>>): NpiRow[] {
  return raw.map((r) => ({
    No: Number(r.No) || 0,
    Product: String(r.Product ?? ""),
    Country: String(r.Country ?? ""),
    Article: (r.Article as string | number) ?? "",
    Description: String(r.Description ?? ""),
    Quantity: Number(r.Quantity) || 0,
    Year: Number(r.Year) || 0,
    YearMonth: normalizeYearMonth(r.YearMonth),
    Status: clean(r.Status),
    Delivery: clean(r.Delivery),
    Start: formatDate(r["Started date"] ?? r["started date"] ?? r.Start),
    Request: String(r["Requested date"] ?? r["requested date"] ?? r.Request ?? "").trim(),
    Plan: formatDate(r["Production plan"] ?? r["production plan"] ?? r.Plan),
    CustomerFeedback: String(r["Customer feedback"] ?? r.CustomerFeedback ?? "").trim(),
    EstimateShipment: formatDate(r["Estimate Shipment"] ?? r.EstimateShipment),
    Shipment: formatDate(r["Shipment"] ?? r.Shipment),
  }));
}

/**
 * Logic for transforming raw ASML data.
 */
function transformAsmlRows(raw: Array<Record<string, any>>): AsmlRow[] {
  return raw.map((r) => {
    const planRaw = r.Plan;
    let plan = "";
    let ym = "";
    if (typeof planRaw === "number" || (typeof planRaw === "string" && /\d{4}-\d{2}/.test(planRaw))) {
      plan = formatDate(planRaw);
      ym = planYM(plan);
    } else if (planRaw != null) {
      plan = String(planRaw).trim();
      ym = plan;
    }
    return {
      No: Number(r.No) || 0,
      Product: String(r.Product ?? ""),
      Description: String(r.Description ?? ""),
      Article: (r.Article as string | number) ?? "",
      Status: clean(r.Status),
      Plan: plan,
      PlanYearMonth: ym,
      PlanYear: ym && /^\d{4}/.test(ym) ? Number(ym.slice(0, 4)) : 0,
      Quantity: Number(r.Quantity) || 0,
      Remark: String(r.Remark ?? "").trim(),
    };
  });
}

/**
 * Server function: Thin wrapper for NPI data retrieval.
 */
export const getNpiData = createServerFn({ method: "GET" }).handler(async () => {
  const { rawData } = await fetchAllRaw();
  return transformNpiRows(rawData);
});

/**
 * Server function: Thin wrapper for ASML data retrieval.
 */
export const getAsmlData = createServerFn({ method: "GET" }).handler(async () => {
  const { asmlRawData } = await fetchAllRaw();
  return transformAsmlRows(asmlRawData);
});
