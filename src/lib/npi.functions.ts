import { createServerFn } from "@tanstack/react-start";
import { fetchAsmlData, fetchNpiData } from "./npi.server";

export type { AsmlRow, NpiRow } from "./npi.types";

export const getNpiData = createServerFn({ method: "GET" }).handler(
  async () => fetchNpiData(),
);

export const getAsmlData = createServerFn({ method: "GET" }).handler(
  async () => fetchAsmlData(),
);
