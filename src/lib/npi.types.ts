export interface NpiRow {
  No: number;
  Product: string;
  Country: string;
  Article: string | number;
  Description: string;
  Quantity: number;
  Year: number;
  YearMonth: string;
  Status: string;
  Delivery: string;
  Start: string;
  Request: string;
  Plan: string;
  CustomerFeedback: string;
  Remark: string;
  EstimateShipment: string;
  Shipment: string;
}

export interface AsmlRow {
  No: number;
  Product: string;
  Description: string;
  Article: string | number;
  Status: string;
  Plan: string;
  PlanYearMonth: string;
  PlanYear: number;
  Quantity: number;
  Remark: string;
}