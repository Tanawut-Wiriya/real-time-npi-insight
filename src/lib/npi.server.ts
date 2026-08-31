import type { AsmlRow, NpiRow } from "./npi.types";

const DATA_URL =
  "https://script.google.com/macros/s/AKfycbwuQCRSkSzCm1JwixbYbJOQNAWRudA1CgI_vQGeA20VdoOFAwXnesyaoui6zG88n7P5gA/exec";
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

function pick(r: RawRow, ...keys: string[]): unknown {
  for (const k of keys) {
    if (r[k] !== undefined && r[k] !== null && r[k] !== "") return r[k];
  }
  return undefined;
}

export async function fetchNpiData(): Promise<NpiRow[]> {
  const { rawData } = await fetchAll();
  return rawData.map((r) => ({
    No: Number(pick(r, "No", "no")) || 0,
    Product: String(pick(r, "Product", "product") ?? ""),
    Country: String(pick(r, "Country", "country") ?? ""),
    Article: (pick(r, "Article", "article") as string | number) ?? "",
    Description: String(pick(r, "Description", "description") ?? ""),
    Quantity: Number(pick(r, "Quantity", "quantity")) || 0,
    Year: Number(pick(r, "Year", "year")) || 0,
    YearMonth: normalizeYearMonth(pick(r, "YearMonth", "yearMonth")),
    Status: clean(pick(r, "Status", "status")),
    Delivery: clean(pick(r, "Delivery", "delivery")),
    Start: formatDate(pick(r, "Started date", "started date", "Start", "startedDate")),
    Request: String(
      pick(r, "Requested date", "requested date", "Request", "requestedDate") ?? "",
    ).trim(),
    Plan: formatDate(pick(r, "Production plan", "production plan", "Plan", "productionPlan")),
    CustomerFeedback: String(
      pick(r, "Customer feedback", "CustomerFeedback", "customerFeedback") ?? "",
    ).trim(),
    Remark: String(pick(r, "Remark", "remark") ?? "").trim(),
    Revenue:
      Number(
        String(pick(r, "Revenue", "revenue") ?? "0").replace(/[,฿$ ]/g, ""),
      ) || 0,
    EstimateShipment: formatDate(
      pick(r, "Estimate Shipment", "EstimateShipment", "estimateShipment"),
    ),
    Shipment: formatDate(pick(r, "Shipment", "shipment")),
  }));
}

function planYearMonth(date: string): string {
  const match = date.match(/^(\d{4})-(\d{2})/);
  return match ? `${match[1]}-${match[2]}` : "";
}

export async function fetchAsmlData(): Promise<AsmlRow[]> {
  const { asmlRawData } = await fetchAll();
  return asmlRawData.map((r) => {
    const rawPlan = pick(r, "Plan", "plan");
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
      No: Number(pick(r, "No", "no")) || 0,
      Product: String(pick(r, "Product", "product") ?? ""),
      Description: String(pick(r, "Description", "description") ?? ""),
      Article: (pick(r, "Article", "article") as string | number) ?? "",
      Status: clean(pick(r, "Status", "status")),
      Plan: plan,
      PlanYearMonth: yearMonth,
      PlanYear: yearMonth && /^\d{4}/.test(yearMonth) ? Number(yearMonth.slice(0, 4)) : 0,
      Quantity: Number(pick(r, "Quantity", "quantity")) || 0,
      Remark: String(pick(r, "Remark", "remark") ?? "").trim(),
    };
  });
}