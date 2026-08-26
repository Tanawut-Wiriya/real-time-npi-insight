import type { AsmlRow, NpiRow } from "./npi.types";

const DATA_URL =
  "https://script.google.com/macros/s/AKfycbzvmHETMFLENY7HtHeLH6pP2uv0Q4YV51n6jfpi7IZW_8kEAuKo2iuEV40vTJvUryygFQ/exec";
const TZ_OFFSET_MS = 7 * 60 * 60 * 1000;

type RawRow = Record<string, unknown>;

function ymFromDate(d: Date): string {
  const shifted = new Date(d.getTime() + TZ_OFFSET_MS);
  return `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, "0")}`;
}

function normalizeYearMonth(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "number") {
    const d = new Date((v - 25569) * 86400 * 1000);
    if (!isNaN(d.getTime())) return ymFromDate(d);
  }
  if (typeof v === "string") {
    if (/^\d{4}-\d{2}$/.test(v)) return v;
    const d = new Date(v);
    if (!isNaN(d.getTime())) return ymFromDate(d);
    return v;
  }
  return String(v);
}

function formatDate(v: unknown): string {
  if (v == null || v === "") return "-";
  if (typeof v === "number") {
    const d = new Date((v - 25569) * 86400 * 1000);
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

function clean(value: unknown): string {
  if (value == null) return "";
  return String(value).replace(/^[:\s-]+/, "").trim() || "-";
}

async function fetchAll(): Promise<{ rawData: RawRow[]; asmlRawData: RawRow[] }> {
  const response = await fetch(DATA_URL, {
    redirect: "follow",
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    throw new Error(`แหล่งข้อมูลตอบกลับด้วย HTTP ${response.status}`);
  }

  const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
  if (!contentType.includes("application/json")) {
    const redirectedToLogin =
      response.url.includes("accounts.google.com") || response.url.includes("/signin/");
    if (redirectedToLogin) {
      throw new Error(
        "Google Apps Script ต้องอนุญาตการเข้าถึง Web App เป็น Anyone โปรดตรวจสอบ Deployment แล้วลองใหม่",
      );
    }
    throw new Error("แหล่งข้อมูลไม่ได้ส่ง JSON โปรดตรวจสอบ URL และการ Deploy ของ Google Apps Script");
  }

  const body = await response.text();
  let json: unknown;
  try {
    json = JSON.parse(body);
  } catch {
    throw new Error("ข้อมูลจาก Google Apps Script ไม่ใช่ JSON ที่ถูกต้อง");
  }

  if (Array.isArray(json)) return { rawData: json as RawRow[], asmlRawData: [] };
  if (!json || typeof json !== "object") {
    throw new Error("โครงสร้างข้อมูลจาก Google Apps Script ไม่ถูกต้อง");
  }

  const object = json as Record<string, unknown>;
  if (typeof object.error === "string") {
    throw new Error(`Google Apps Script: ${object.error}`);
  }

  return {
    rawData: Array.isArray(object.rawData) ? (object.rawData as RawRow[]) : [],
    asmlRawData: Array.isArray(object.asmlRawData) ? (object.asmlRawData as RawRow[]) : [],
  };
}

export async function fetchNpiData(): Promise<NpiRow[]> {
  const { rawData } = await fetchAll();
  return rawData.map((r) => ({
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
    Shipment: formatDate(r.Shipment),
  }));
}

function planYearMonth(date: string): string {
  const match = date.match(/^(\d{4})-(\d{2})/);
  return match ? `${match[1]}-${match[2]}` : "";
}

export async function fetchAsmlData(): Promise<AsmlRow[]> {
  const { asmlRawData } = await fetchAll();
  return asmlRawData.map((r) => {
    const rawPlan = r.Plan;
    let plan = "";
    let yearMonth = "";
    if (
      typeof rawPlan === "number" ||
      (typeof rawPlan === "string" && /\d{4}-\d{2}/.test(rawPlan))
    ) {
      plan = formatDate(rawPlan);
      yearMonth = planYearMonth(plan);
    } else if (rawPlan != null) {
      plan = String(rawPlan).trim();
      yearMonth = plan;
    }
    return {
      No: Number(r.No) || 0,
      Product: String(r.Product ?? ""),
      Description: String(r.Description ?? ""),
      Article: (r.Article as string | number) ?? "",
      Status: clean(r.Status),
      Plan: plan,
      PlanYearMonth: yearMonth,
      PlanYear: yearMonth && /^\d{4}/.test(yearMonth) ? Number(yearMonth.slice(0, 4)) : 0,
      Quantity: Number(r.Quantity) || 0,
      Remark: String(r.Remark ?? "").trim(),
    };
  });
}