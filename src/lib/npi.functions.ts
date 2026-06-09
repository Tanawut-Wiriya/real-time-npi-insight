import { createServerFn } from "@tanstack/react-start";

const DATA_URL =
  "https://script.google.com/macros/s/AKfycbwuQCRSkSzCm1JwixbYbJOQNAWRudA1CgI_vQGeA20VdoOFAwXnesyaoui6zG88n7P5gA/exec";

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
  CustomerFeedback: string;
  EstimateShipment: string;
  Shipment: string;
}

// Bangkok timezone (GMT+7) — Google Apps Script serializes dates to UTC,
// shifting Thai-local dates back by 7 hours. Re-apply the offset before
// extracting year/month so e.g. 2023-12-31T17:00:00Z → 2024-01.
const TZ_OFFSET_MS = 7 * 60 * 60 * 1000;

function ymFromDate(d: Date): string {
  const shifted = new Date(d.getTime() + TZ_OFFSET_MS);
  return `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, "0")}`;
}

function normalizeYearMonth(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "number") {
    // Excel serial date (days since 1899-12-30)
    const ms = (v - 25569) * 86400 * 1000;
    const d = new Date(ms);
    if (!isNaN(d.getTime())) return ymFromDate(d);
  }
  if (typeof v === "string") {
    // Already in YYYY-MM form
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

export const getNpiData = createServerFn({ method: "GET" }).handler(
  async (): Promise<NpiRow[]> => {
    const res = await fetch(DATA_URL, { redirect: "follow" });
    if (!res.ok) throw new Error(`Failed to fetch data: ${res.status}`);
    const raw = (await res.json()) as Array<Record<string, unknown>>;
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
      CustomerFeedback: String(r["Customer feedback"] ?? r.CustomerFeedback ?? "").trim(),
      EstimateShipment: formatDate(r["Estimate Shipment"] ?? r.EstimateShipment),
      Shipment: formatDate(r["Shipment"] ?? r.Shipment),
    }));
  },
);

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

function planYM(dateStr: string): string {
  const m = dateStr.match(/^(\d{4})-(\d{2})/);
  return m ? `${m[1]}-${m[2]}` : "";
}

export const getAsmlData = createServerFn({ method: "GET" }).handler(
  async (): Promise<AsmlRow[]> => {
    const url = `${DATA_URL}?sheet=${encodeURIComponent("ASML Raw Data")}`;
    const res = await fetch(url, { redirect: "follow" });
    if (!res.ok) throw new Error(`Failed to fetch data: ${res.status}`);
    const raw = (await res.json()) as Array<Record<string, unknown>>;
    return raw.map((r) => {
      const plan = formatDate(r.Plan);
      const ym = planYM(plan);
      return {
        No: Number(r.No) || 0,
        Product: String(r.Product ?? ""),
        Description: String(r.Description ?? ""),
        Article: (r.Article as string | number) ?? "",
        Status: clean(r.Status),
        Plan: plan,
        PlanYearMonth: ym,
        PlanYear: ym ? Number(ym.slice(0, 4)) : 0,
        Quantity: Number(r.Quantity) || 0,
        Remark: String(r.Remark ?? "").trim(),
      };
    });
  },
);
