import { createServerFn } from "@tanstack/react-start";

const DATA_URL =
  "https://script.googleusercontent.com/macros/echo?user_content_key=AUkAhnQsEgM8cbTtaVHLSGf_rqwapztuBhAXuslw6-9NoYRdReu73s3ZnFxHlFWSDA82A3po2lQoDgByjgqCo3LLCwfb_kZr4BzUVVqG0wFudAt2UwzZEtkWqNSxG8GnI6HD9XNs357wBI0I2tYml4FuQIB20avi1oNJV-leIZrC57VvcZizvcUFCGQqt19rBeSCqC4Bi6Wn1reReJpq0JZohFMaUBzMbkvLYBUNO4S4EAkpniuP6untmVXd3y0jiEZEhPABWvlT8pEENe88cGCbof9U9s251w&lib=M0bGm-_Zb3kJTDfZ7cThr5KrVZfHLKP8z";

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
}

function normalizeYearMonth(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "number") {
    // Excel serial date (days since 1899-12-30)
    const ms = (v - 25569) * 86400 * 1000;
    const d = new Date(ms);
    if (!isNaN(d.getTime())) {
      return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    }
  }
  if (typeof v === "string") {
    const d = new Date(v);
    if (!isNaN(d.getTime())) {
      return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
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
    }));
  },
);
