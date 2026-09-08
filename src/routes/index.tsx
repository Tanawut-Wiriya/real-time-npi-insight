import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  BarChart3,
  Factory,
  FileSpreadsheet,
  HardHat,
  Hourglass,
  Inbox,
  LineChart as LineIcon,
  Loader2,
  Package,
  RefreshCw,
  Truck,
  Wrench,
} from "lucide-react";
import * as XLSX from "xlsx";
import { getNpiData, getAsmlData, type NpiRow, type AsmlRow } from "@/lib/npi.functions";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const npiQuery = queryOptions({
  queryKey: ["npi-data"],
  queryFn: () => getNpiData(),
  staleTime: 60_000,
});

const asmlQuery = queryOptions({
  queryKey: ["asml-data"],
  queryFn: () => getAsmlData(),
  staleTime: 60_000,
});

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Product NPI Analytics Dashboard" },
      {
        name: "description",
        content: "Real-time dashboard for Product NPI and ASML project analytics.",
      },
      { property: "og:title", content: "Product NPI Analytics Dashboard" },
      {
        property: "og:description",
        content: "Real-time dashboard for Product NPI and ASML project analytics.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: DashboardPage,
});

const ALL = "__all__";

function parseDateStr(s: string): Date | null {
  if (!s || s === "-") return null;
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  const d = new Date(`${m[1]}-${m[2]}-${m[3]}T00:00:00Z`);
  return isNaN(d.getTime()) ? null : d;
}

function formatUsd(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(value);
}

function exportToExcel(rows: NpiRow[], filename?: string) {
  const data = rows.map((r) => ({
    No: r.No,
    Product: r.Product,
    Country: r.Country,
    Article: r.Article,
    Description: r.Description,
    Quantity: r.Quantity,
    Year: r.Year,
    YearMonth: r.YearMonth,
    Status: r.Status,
    Delivery: r.Delivery,
    Start: r.Start,
    Request: r.Request,
    Plan: r.Plan,
    CustomerFeedback: r.CustomerFeedback,
    Remark: r.Remark,
    EstimateShipment: r.EstimateShipment,
    Shipment: r.Shipment,
    Revenue: r.Revenue,
  }));
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Projects");
  XLSX.writeFile(wb, filename ?? `projects-list-${new Date().toISOString().slice(0, 10)}.xlsx`);
}

function shipmentStatus(shipment: string, estimate: string): "on-time" | "delay" | "unknown" {
  const s = parseDateStr(shipment);
  const e = parseDateStr(estimate);
  if (!s || !e) return "unknown";
  return s.getTime() <= e.getTime() ? "on-time" : "delay";
}

function DashboardPage() {
  const [view, setView] = useState<"npi" | "asml">("npi");
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto flex max-w-[1400px] justify-end px-6 pt-4">
        <div className="inline-flex rounded-md border p-0.5">
          <button
            onClick={() => setView("npi")}
            className={`rounded px-3 py-1 text-xs font-medium transition ${
              view === "npi"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            NPI Dashboard
          </button>
          <button
            onClick={() => setView("asml")}
            className={`rounded px-3 py-1 text-xs font-medium transition ${
              view === "asml"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            ASML Dashboard
          </button>
        </div>
      </div>
      {view === "npi" ? <Dashboard /> : <AsmlDashboard />}
    </div>
  );
}

function Dashboard() {
  const { data, isFetching, isLoading, refetch, error } = useQuery(npiQuery);
  const rows: NpiRow[] = data ?? [];

  const [year, setYear] = useState<string>(ALL);
  const [month, setMonth] = useState<string>(ALL);
  const [status, setStatus] = useState<string>(ALL);
  const [product, setProduct] = useState<string>(ALL);
  const [feedback, setFeedback] = useState<string>(ALL);

  const uniq = (arr: (string | number)[]) =>
    Array.from(new Set(arr.filter((v) => v !== "" && v != null))).sort((a, b) =>
      String(a).localeCompare(String(b)),
    );

  // Cascading filter options: each filter's options reflect rows remaining
  // after all OTHER active filters are applied.
  const applyFilters = useCallback(
    (source: NpiRow[], except?: "year" | "month" | "status" | "product" | "feedback") =>
      source.filter(
        (r) =>
          (except === "year" || year === ALL || String(r.Year) === year) &&
          (except === "month" || month === ALL || r.YearMonth?.split("-")[1] === month) &&
          (except === "status" || status === ALL || r.Status === status) &&
          (except === "product" || product === ALL || r.Product === product) &&
          (except === "feedback" || feedback === ALL || r.CustomerFeedback === feedback),
      ),
    [year, month, status, product, feedback],
  );

  const years = useMemo(() => uniq(applyFilters(rows, "year").map((r) => r.Year)), [rows, applyFilters]);
  const months = useMemo(
    () =>
      uniq(
        applyFilters(rows, "month")
          .map((r) => r.YearMonth?.split("-")[1])
          .filter((m): m is string => !!m),
      ),
    [rows, applyFilters],
  );
  const statuses = useMemo(() => uniq(applyFilters(rows, "status").map((r) => r.Status)), [rows, applyFilters]);
  const products = useMemo(() => uniq(applyFilters(rows, "product").map((r) => r.Product)), [rows, applyFilters]);
  const feedbacks = useMemo(() => uniq(applyFilters(rows, "feedback").map((r) => r.CustomerFeedback)), [rows, applyFilters]);

  // Default to the latest year on first load
  const [yearInitialized, setYearInitialized] = useState(false);
  useEffect(() => {
    if (yearInitialized || years.length === 0) return;
    const latest = years
      .map((y) => Number(y))
      .filter((n) => !isNaN(n))
      .sort((a, b) => b - a)[0];
    if (latest != null) setYear(String(latest));
    setYearInitialized(true);
  }, [years, yearInitialized]);

  const [chartType, setChartType] = useState<"bar" | "line">("bar");
  const [drillStatus, setDrillStatus] = useState<string | null>(null);
  const [showInProgress, setShowInProgress] = useState(false);
  const [showInProduction, setShowInProduction] = useState(false);
  const [showWaitApproval, setShowWaitApproval] = useState(false);
  const [showTotal, setShowTotal] = useState(false);
  const [showDelivered, setShowDelivered] = useState(false);
  const [deliveredFilter, setDeliveredFilter] = useState<"all" | "ontime" | "delay" | "unknown">("all");
  const [drillMonth, setDrillMonth] = useState<string | null>(null);
  const [drillFeedback, setDrillFeedback] = useState<string | null>(null);


  const filtered = useMemo(
    () =>
      rows.filter(
        (r) =>
          (year === ALL || String(r.Year) === year) &&
          (month === ALL || r.YearMonth?.split("-")[1] === month) &&
          (status === ALL || r.Status === status) &&
          (product === ALL || r.Product === product) &&
          (feedback === ALL || r.CustomerFeedback === feedback),
      ),
    [rows, year, month, status, product, feedback],
  );

  const chartData = useMemo(() => {
    const map = new Map<string, { YearMonth: string; Count: number }>();
    for (const r of filtered) {
      const k = r.YearMonth || "Unknown";
      const cur = map.get(k) ?? { YearMonth: k, Count: 0 };
      cur.Count += 1;
      map.set(k, cur);
    }
    return Array.from(map.values()).sort((a, b) =>
      a.YearMonth.localeCompare(b.YearMonth),
    );
  }, [filtered]);

  // KPI scope: follows all active filters (year, month, status, product)
  const yearRows = filtered;

// Total Projects: count of filtered rows + their total quantity
  const totalProjectsCount = yearRows.length;
  const totalProjectsQty = yearRows.reduce((s, r) => s + r.Quantity, 0);

  // Delivered: filtered rows with Status "Delivered"
  const deliveredRows = useMemo(
    () => yearRows.filter((r) => /^delivered$/i.test(r.Status.trim())),
    [yearRows],
  );
  const deliveredCount = deliveredRows.length;
  const deliveredQty = deliveredRows.reduce((s, r) => s + r.Quantity, 0);

  // In progress: rows for the selected year with Status "In progress"
  const inProgressRows = useMemo(
    () => yearRows.filter((r) => /^in progress$/i.test(r.Status.trim())),
    [yearRows],
  );
  const inProgressCount = inProgressRows.length;
  const inProgressQty = inProgressRows.reduce((s, r) => s + r.Quantity, 0);

  // In production: rows for the selected year with Status "In production"
  const inProductionRows = useMemo(
    () => yearRows.filter((r) => /^in ?production$/i.test(r.Status.trim())),
    [yearRows],
  );
  const inProductionCount = inProductionRows.length;
  const inProductionQty = inProductionRows.reduce((s, r) => s + r.Quantity, 0);

  // Wait approval: rows whose Customer Feedback is "w.customer"
  const waitApprovalRows = useMemo(
    () => yearRows.filter((r) => /^w\.?customer$/i.test(r.CustomerFeedback.trim())),
    [yearRows],
  );
  const waitApprovalCount = waitApprovalRows.length;
  const waitApprovalQty = waitApprovalRows.reduce((s, r) => s + r.Quantity, 0);

  // Revenue sums (same scope as the quantity sums above)
  const totalProjectsRevenue = yearRows.reduce((s, r) => s + r.Revenue, 0);
  const deliveredRevenue = deliveredRows.reduce((s, r) => s + r.Revenue, 0);
  const inProgressRevenue = inProgressRows.reduce((s, r) => s + r.Revenue, 0);
  const inProductionRevenue = inProductionRows.reduce((s, r) => s + r.Revenue, 0);
  const waitApprovalRevenue = waitApprovalRows.reduce((s, r) => s + r.Revenue, 0);

  const deliveredShipment = useMemo(() => {
    let onTime = 0;
    let delay = 0;
    let unknown = 0;
    const withStatus = deliveredRows.map((r) => {
      const s = shipmentStatus(r.Shipment, r.EstimateShipment);
      if (s === "on-time") onTime++;
      else if (s === "delay") delay++;
      else unknown++;
      return { row: r, shipStatus: s };
    });
    return { onTime, delay, unknown, withStatus };
  }, [deliveredRows]);

  const deliveredDrillRows = useMemo(() => {
    if (deliveredFilter === "all") return deliveredRows;
    return deliveredShipment.withStatus
      .filter((x) => x.shipStatus === deliveredFilter)
      .map((x) => x.row);
  }, [deliveredFilter, deliveredRows, deliveredShipment]);

  const drillRows = useMemo(
    () => (drillStatus ? filtered.filter((r) => r.Status === drillStatus) : []),
    [filtered, drillStatus],
  );

  const drillMonthRows = useMemo(
    () =>
      drillMonth
        ? filtered.filter((r) => (r.YearMonth || "Unknown") === drillMonth)
        : [],
    [filtered, drillMonth],
  );

  const drillFeedbackRows = useMemo(
    () =>
      drillFeedback
        ? filtered.filter((r) => (r.CustomerFeedback || "").trim() === drillFeedback)
        : [],
    [filtered, drillFeedback],
  );

  const reset = () => {
    setYear(ALL);
    setMonth(ALL);
    setStatus(ALL);
    setProduct(ALL);
    setFeedback(ALL);
  };

  if (isLoading) return <DashboardSkeleton />;
  if (error)
    return (
      <div className="flex min-h-screen items-center justify-center p-6 text-center">
        <div>
          <h2 className="text-xl font-semibold">โหลดข้อมูลไม่สำเร็จ</h2>
          <p className="mt-2 text-sm text-muted-foreground">{(error as Error).message}</p>
          <Button onClick={() => refetch()} className="mt-4">
            <RefreshCw className="mr-2 h-4 w-4" /> ลองอีกครั้ง
          </Button>
        </div>
      </div>
    );

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card/50 backdrop-blur">
        <div className="mx-auto flex max-w-[1400px] flex-col gap-1 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              Product NPI Analytics
            </h1>
            <p className="text-sm text-muted-foreground">
              Real-time dashboard for New Product Introduction
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
          >
            {isFetching ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 h-4 w-4" />
            )}
            Refresh Data
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-[1400px] space-y-6 px-6 py-6">
        {/* Filters */}
        <Card className="p-3">
          <div className="grid grid-cols-6 gap-2">
            <FilterSelect
              label="Year"
              value={year}
              onChange={setYear}
              options={years.map(String)}
            />
            <FilterSelect
              label="Month"
              value={month}
              onChange={setMonth}
              options={months.map(String)}
            />
            <FilterSelect
              label="Status"
              value={status}
              onChange={setStatus}
              options={statuses.map(String)}
            />
            <FilterSelect
              label="Customer"
              value={product}
              onChange={setProduct}
              options={products.map(String)}
            />
            <FilterSelect
              label="Feedback"
              value={feedback}
              onChange={setFeedback}
              options={feedbacks.map(String)}
            />
            <div className="flex items-end">
              <Button variant="outline" size="sm" onClick={reset} className="h-8 w-full text-xs">
                <RefreshCw className="mr-1 h-3 w-3" />
                Reset
              </Button>
            </div>
          </div>
        </Card>

        {/* KPIs */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
<KpiCard
            label="Total Projects"
            value={totalProjectsCount.toLocaleString()}
            subValue={`Total QTY: ${totalProjectsQty.toLocaleString()}`}
            revenue={totalProjectsRevenue}
            icon={<BarChart3 className="h-4 w-4" />}
            onClick={() => setShowTotal(true)}
          />
          <KpiCard
            label="Delivered"
            value={deliveredCount.toLocaleString()}
            subValue={`Total QTY: ${deliveredQty.toLocaleString()}`}
            revenue={deliveredRevenue}
            icon={<Truck className="h-4 w-4" />}
            onClick={() => {
              setDeliveredFilter("all");
              setShowDelivered(true);
            }}
          />
          <KpiCard
            label="In production"
            value={inProductionCount.toLocaleString()}
            subValue={`Total QTY: ${inProductionQty.toLocaleString()}`}
            revenue={inProductionRevenue}
            icon={<Factory className="h-4 w-4" />}
            onClick={() => setShowInProduction(true)}
          />
          <KpiCard
            label="In progress"
            value={inProgressCount.toLocaleString()}
            subValue={`Total QTY: ${inProgressQty.toLocaleString()}`}
            revenue={inProgressRevenue}
            icon={<HardHat className="h-4 w-4" />}
            onClick={() => setShowInProgress(true)}
          />
          <KpiCard
            label="Wait approval"
            value={waitApprovalCount.toLocaleString()}
            subValue={`Total QTY: ${waitApprovalQty.toLocaleString()}`}
            revenue={waitApprovalRevenue}
            icon={<Hourglass className="h-4 w-4" />}
            onClick={() => setShowWaitApproval(true)}
          />
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {/* Product Count Chart */}
          <Card className="p-4">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold">Projects Count by Month</h2>
                <p className="text-[11px] text-muted-foreground">
                  จำนวน Project ต่อเดือน ตามตัวกรองที่เลือก · คลิกที่กราฟเพื่อดูรายละเอียด
                </p>
              </div>
              <div className="flex gap-1 rounded-md border p-0.5">
                <button
                  onClick={() => setChartType("bar")}
                  className={`rounded px-2 py-0.5 text-[11px] font-medium transition ${
                    chartType === "bar"
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Bar
                </button>
                <button
                  onClick={() => setChartType("line")}
                  className={`rounded px-2 py-0.5 text-[11px] font-medium transition ${
                    chartType === "line"
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Line
                </button>
              </div>
            </div>
            {chartData.length === 0 ? (
              <EmptyState />
            ) : (
              <div className="h-[260px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  {chartType === "bar" ? (
                    <BarChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 4 }} onClick={(s: { activeLabel?: string }) => { if (s?.activeLabel) setDrillMonth(String(s.activeLabel)); }} style={{ cursor: "pointer" }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                      <XAxis dataKey="YearMonth" tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" />
                      <YAxis tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" domain={[0, Math.max(...chartData.map((d) => d.Count), 1) + 2]} />
                      <Tooltip
                        contentStyle={{
                          background: "var(--popover)",
                          border: "1px solid var(--border)",
                          borderRadius: 8,
                          fontFamily: "Kanit",
                        }}
                      />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      <Bar dataKey="Count" name="Projects" fill="var(--chart-1)" radius={[4, 4, 0, 0]}>
                        <LabelList dataKey="Count" position="top" fontSize={10} fill="var(--foreground)" />
                      </Bar>
                    </BarChart>
                  ) : (
                    <LineChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 4 }} onClick={(s: { activeLabel?: string }) => { if (s?.activeLabel) setDrillMonth(String(s.activeLabel)); }} style={{ cursor: "pointer" }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                      <XAxis dataKey="YearMonth" tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" />
                      <YAxis tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" domain={[0, Math.max(...chartData.map((d) => d.Count), 1) + 2]} />
                      <Tooltip
                        contentStyle={{
                          background: "var(--popover)",
                          border: "1px solid var(--border)",
                          borderRadius: 8,
                          fontFamily: "Kanit",
                        }}
                      />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      <Line type="monotone" dataKey="Count" name="Projects" stroke="var(--chart-1)" strokeWidth={2} dot={{ r: 3 }}>
                        <LabelList dataKey="Count" position="top" fontSize={10} fill="var(--foreground)" />
                      </Line>
                    </LineChart>
                  )}
                </ResponsiveContainer>
              </div>
            )}
          </Card>

          {/* Status Pie Chart */}
          <StatusPieChart rows={filtered} onDrill={setDrillStatus} />
        </div>

        {/* Delivered & Feedback side by side */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <DeliveredShipmentChart
            rows={deliveredRows}
            onDrill={(status) => {
              setDeliveredFilter(status);
              setShowDelivered(true);
            }}
          />

          {/* Customer Feedback Chart */}
          <FeedbackChart rows={filtered} onDrill={setDrillFeedback} />
        </div>

        {/* Table */}
        <DataTable rows={filtered} />
      </main>

      {showInProgress && (
        <StatusDrilldownModal
          status="In Progress"
          rows={inProgressRows}
          onClose={() => setShowInProgress(false)}
        />
      )}

      {showInProduction && (
        <StatusDrilldownModal
          status="In Production"
          rows={inProductionRows}
          onClose={() => setShowInProduction(false)}
        />
      )}

      {showWaitApproval && (
        <StatusDrilldownModal
          status="Wait Approval (w.customer)"
          rows={waitApprovalRows}
          onClose={() => setShowWaitApproval(false)}
        />
      )}

{showTotal && (
        <StatusDrilldownModal
          status="Total Projects"
          rows={yearRows}
          onClose={() => setShowTotal(false)}
        />
      )}

      {showDelivered && (
        <StatusDrilldownModal
          status={
            deliveredFilter === "all"
              ? "Delivered"
              : deliveredFilter === "ontime"
                ? "Delivered — On-time"
                : deliveredFilter === "delay"
                  ? "Delivered — Delay"
                  : "Delivered — No date"
          }
          rows={deliveredDrillRows}
          onClose={() => setShowDelivered(false)}
        />
      )}

      {drillStatus && (
        <StatusDrilldownModal
          status={drillStatus}
          rows={drillRows}
          onClose={() => setDrillStatus(null)}
        />
      )}

      {drillMonth && (
        <StatusDrilldownModal
          status={`เดือน ${drillMonth}`}
          rows={drillMonthRows}
          onClose={() => setDrillMonth(null)}
        />
      )}

      {drillFeedback && (
        <StatusDrilldownModal
          status={`Feedback: ${drillFeedback}`}
          rows={drillFeedbackRows}
          onClose={() => setDrillFeedback(null)}
        />
      )}
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
}) {
  return (
    <div className="space-y-1">
      <label className="text-[11px] font-medium text-muted-foreground">{label}</label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="h-8 w-full text-xs">
          <SelectValue placeholder={`All ${label}`} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>All {label}</SelectItem>
          {options.map((o) => (
            <SelectItem key={o} value={o}>
              {o}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function KpiCard({
  label,
  value,
  icon,
  subValue,
  revenue,
  onClick,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  subValue?: string;
  revenue?: number;
  onClick?: () => void;
}) {
  return (
    <Card
      className={`p-4 ${onClick ? "cursor-pointer transition hover:bg-muted/50" : ""}`}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") onClick();
            }
          : undefined
      }
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </span>
        <span className="rounded-md bg-secondary p-1.5 text-primary">{icon}</span>
      </div>
      <div className="mt-2 flex items-end justify-between gap-2">
        <div className="text-2xl font-semibold tracking-tight">{value}</div>
        {revenue !== undefined && (
          <div className="text-right">
            <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              Revenue (USD)
            </div>
            <div className="text-sm font-semibold tabular-nums text-primary">
              {formatUsd(revenue)}
            </div>
          </div>
        )}
      </div>
      {subValue && (
        <div className="mt-1 text-xs text-muted-foreground">{subValue}</div>
      )}
    </Card>
  );
}

type SortKey = keyof NpiRow;

function DataTable({ rows }: { rows: NpiRow[] }) {
  const [sortKey, setSortKey] = useState<SortKey>("No");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const sorted = useMemo(() => {
    const copy = [...rows];
    copy.sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      if (typeof av === "number" && typeof bv === "number") {
        return sortDir === "asc" ? av - bv : bv - av;
      }
      return sortDir === "asc"
        ? String(av).localeCompare(String(bv))
        : String(bv).localeCompare(String(av));
    });
    return copy;
  }, [rows, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * pageSize;
  const pageRows = sorted.slice(start, start + pageSize);

  const toggleSort = (k: SortKey) => {
    if (k === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(k);
      setSortDir("asc");
    }
    setPage(1);
  };

  const cols: { key: SortKey; label: string; className?: string }[] = [
    { key: "No", label: "No", className: "w-14" },
    { key: "Product", label: "Product" },
    { key: "Article", label: "Article" },
    { key: "Description", label: "Description" },
    { key: "Quantity", label: "QTY." },
    { key: "YearMonth", label: "START DATE" },
    { key: "Start", label: "Start" },
    { key: "Request", label: "Request" },
    { key: "Status", label: "STATUS" },
    { key: "Delivery", label: "DELIVERY" },
    { key: "Plan", label: "Plan" },
    { key: "EstimateShipment", label: "Commit" },
    { key: "Shipment", label: "Shipment" },
    { key: "CustomerFeedback", label: "Feedback" },
    { key: "Remark", label: "Remark" },
    { key: "Revenue", label: "Revenue (USD)", className: "text-right" },
  ];

  return (
    <Card className="overflow-hidden p-0">
      <div className="flex items-center justify-between border-b px-5 py-4">
        <div>
          <h2 className="text-lg font-semibold">Projects List</h2>
          <p className="text-xs text-muted-foreground">
            {rows.length.toLocaleString()} รายการ
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => exportToExcel(rows)}
          disabled={rows.length === 0}
        >
          <FileSpreadsheet className="mr-1 h-3 w-3" />
          Export Excel
        </Button>
      </div>
      {rows.length === 0 ? (
        <div className="p-10">
          <EmptyState />
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40">
                  {cols.map((c) => (
                    <TableHead
                      key={c.key}
                      className={`cursor-pointer select-none whitespace-nowrap text-xs font-semibold uppercase tracking-wide ${c.className ?? ""}`}
                      onClick={() => toggleSort(c.key)}
                    >
                      <span className="inline-flex items-center gap-1">
                        {c.label}
                        {sortKey === c.key ? (
                          sortDir === "asc" ? (
                            <ArrowUp className="h-3 w-3" />
                          ) : (
                            <ArrowDown className="h-3 w-3" />
                          )
                        ) : (
                          <ArrowUpDown className="h-3 w-3 opacity-40" />
                        )}
                      </span>
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {pageRows.map((r) => (
                  <TableRow key={r.No} className="text-sm">
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {r.No}
                    </TableCell>
                    <TableCell className="font-medium">{r.Product}</TableCell>
                    <TableCell className="font-mono text-xs">{r.Article}</TableCell>
                    <TableCell className="max-w-[280px] truncate" title={r.Description}>
                      {r.Description}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {r.Quantity.toLocaleString()}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">{r.YearMonth}</TableCell>
                    <TableCell className="whitespace-nowrap text-xs">{r.Start}</TableCell>
                    <TableCell className="max-w-[180px] truncate text-xs" title={r.Request}>
                      {r.Request || "-"}
                    </TableCell>
                    <TableCell>
                      <StatusBadge value={r.Status} />
                    </TableCell>
                    <TableCell>
                      <DeliveryBadge value={r.Delivery} />
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-xs">{r.Plan}</TableCell>
                    <TableCell className="whitespace-nowrap text-xs">{r.EstimateShipment}</TableCell>
                    <TableCell className="whitespace-nowrap text-xs">{r.Shipment}</TableCell>
                    <TableCell className="max-w-[240px] truncate text-xs" title={r.CustomerFeedback}>
                      {r.CustomerFeedback || "-"}
                    </TableCell>
                    <TableCell className="max-w-[240px] truncate text-xs" title={r.Remark}>
                      {r.Remark || "-"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-xs">
                      {formatUsd(r.Revenue)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="flex items-center justify-between border-t px-5 py-3">
            <span className="text-xs text-muted-foreground">
              แสดง {start + 1}–{Math.min(start + pageSize, sorted.length)} จาก{" "}
              {sorted.length.toLocaleString()}
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={safePage <= 1}
              >
                ก่อนหน้า
              </Button>
              <span className="text-xs text-muted-foreground">
                หน้า {safePage} / {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={safePage >= totalPages}
              >
                ถัดไป
              </Button>
            </div>
          </div>
        </>
      )}
    </Card>
  );
}

function StatusBadge({ value }: { value: string }) {
  const v = value.toLowerCase();
  const variant = /deliver/.test(v)
    ? "bg-[var(--teal)]/15 text-[var(--teal)] border-[var(--teal)]/30"
    : /approv/.test(v)
      ? "bg-primary/10 text-primary border-primary/20"
      : "bg-muted text-muted-foreground border-border";
  return (
    <Badge variant="outline" className={`font-normal ${variant}`}>
      {value}
    </Badge>
  );
}

function DeliveryBadge({ value }: { value: string }) {
  const v = value.toLowerCase();
  if (/on time/.test(v))
    return <Badge variant="outline" className="border-[var(--teal)]/30 bg-[var(--teal)]/15 font-normal text-[var(--teal)]">{value}</Badge>;
  if (/delay/.test(v))
    return <Badge variant="outline" className="border-destructive/30 bg-destructive/10 font-normal text-destructive">{value}</Badge>;
  return <Badge variant="outline" className="font-normal text-muted-foreground">{value}</Badge>;
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
      <div className="rounded-full bg-muted p-4">
        <Inbox className="h-6 w-6 text-muted-foreground" />
      </div>
      <h3 className="text-base font-semibold">ไม่พบข้อมูล</h3>
      <p className="max-w-sm text-sm text-muted-foreground">
        ไม่มีรายการที่ตรงกับตัวกรองที่เลือก ลองปรับหรือล้างตัวกรองเพื่อดูผลลัพธ์อื่น
      </p>
    </div>
  );
}

function StatusPieChart({
  rows,
  onDrill,
}: {
  rows: NpiRow[];
  onDrill?: (status: string) => void;
}) {
  const data = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of rows) {
      const s = r.Status || "Unknown";
      map.set(s, (map.get(s) || 0) + 1);
    }
    return Array.from(map.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [rows]);

  const getStatusColor = (name: string) => {
    const v = name.toLowerCase().replace(/\s/g, "");
    if (v === "delivered") return "#22c55e";
    if (v === "inprogress") return "#94a3b8";
    if (v === "inproduction") return "#facc15";
    if (v === "partialdelivered") return "#86efac";
    return "var(--chart-1)";
  };

  return (
    <Card className="p-4">
      <div className="mb-3">
        <h2 className="text-base font-semibold">Overall status</h2>
        <p className="text-[11px] text-muted-foreground">
          สัดส่วนสถานะของ Projects ตามตัวกรองที่เลือก · คลิกที่ชิ้นส่วนเพื่อดูรายละเอียด
        </p>
      </div>
      {data.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="h-[260px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Tooltip
                contentStyle={{
                  background: "var(--popover)",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  fontFamily: "Kanit",
                  fontSize: 12,
                }}
                labelStyle={{ display: "none" }}
                formatter={(value: number, name: string) => [`${value.toLocaleString()} รายการ`, name]}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                outerRadius={80}
                dataKey="value"
                nameKey="name"
                label={({ name, value, percent }) => `${name}: ${value} (${(percent * 100).toFixed(0)}%)`}
                labelLine
                onClick={(entry: { name?: string }) => {
                  if (onDrill && entry?.name) onDrill(entry.name);
                }}
                style={{ cursor: onDrill ? "pointer" : "default" }}
              >
                {data.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={getStatusColor(entry.name)}
                    onClick={() => onDrill?.(entry.name)}
                  />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  );
}

function StatusDrilldownModal({
  status,
  rows,
  onClose,
}: {
  status: string;
  rows: NpiRow[];
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="relative flex max-h-[85vh] w-full max-w-5xl flex-col overflow-hidden rounded-lg border bg-card shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between border-b px-5 py-4">
          <div>
            <h3 className="text-lg font-semibold">Products — {status}</h3>
            <p className="text-xs text-muted-foreground">
              {rows.length.toLocaleString()} รายการ · รวม QTY{" "}
              {rows.reduce((s, r) => s + r.Quantity, 0).toLocaleString()} · รวม Revenue{" "}
              {formatUsd(rows.reduce((s, r) => s + r.Revenue, 0))}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              disabled={rows.length === 0}
              onClick={() =>
                exportToExcel(
                  rows,
                  `${status.replace(/[^a-zA-Z0-9]+/g, "-").toLowerCase()}-${new Date().toISOString().slice(0, 10)}.xlsx`
                )
              }
            >
              <FileSpreadsheet className="h-4 w-4" />
              Export Excel
            </Button>
          <button
            onClick={onClose}
            aria-label="Close"
            className="rounded-md p-1.5 text-muted-foreground transition hover:bg-muted hover:text-foreground"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
          </button>
          </div>
        </div>
        <div className="overflow-auto">
          {rows.length === 0 ? (
            <div className="p-10"><EmptyState /></div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40">
                  <TableHead className="text-xs font-semibold uppercase tracking-wide">No</TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wide">Product</TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wide">Article</TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wide">Description</TableHead>
                  <TableHead className="text-right text-xs font-semibold uppercase tracking-wide">QTY.</TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wide">Start Date</TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wide">Status</TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wide">Delivery</TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wide">Shipment</TableHead>
                  <TableHead className="text-right text-xs font-semibold uppercase tracking-wide">Revenue</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.No} className="text-sm">
                    <TableCell className="font-mono text-xs text-muted-foreground">{r.No}</TableCell>
                    <TableCell className="font-medium">{r.Product}</TableCell>
                    <TableCell className="font-mono text-xs">{r.Article}</TableCell>
                    <TableCell className="max-w-[280px] truncate" title={r.Description}>{r.Description}</TableCell>
                    <TableCell className="text-right tabular-nums">{r.Quantity.toLocaleString()}</TableCell>
                    <TableCell className="whitespace-nowrap">{r.YearMonth}</TableCell>
                    <TableCell><StatusBadge value={r.Status} /></TableCell>
                    <TableCell><DeliveryBadge value={r.Delivery} /></TableCell>
                    <TableCell className="whitespace-nowrap text-xs">{r.Shipment}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatUsd(r.Revenue)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </div>
    </div>
  );
}

function FeedbackChart({
  rows,
  onDrill,
}: {
  rows: NpiRow[];
  onDrill?: (feedback: string) => void;
}) {
  const data = useMemo(() => {
    const countMap = new Map<string, number>();
    const revenueMap = new Map<string, number>();
    for (const r of rows) {
      const fb = (r.CustomerFeedback || "").trim();
      if (!fb || fb === "-") continue;
      countMap.set(fb, (countMap.get(fb) || 0) + 1);
      revenueMap.set(fb, (revenueMap.get(fb) || 0) + r.Revenue);
    }
    return Array.from(countMap.entries())
      .map(([name, value]) => ({ name, value, revenue: revenueMap.get(name) || 0 }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 15);
  }, [rows]);

  const totalRevenue = useMemo(() => data.reduce((s, d) => s + d.revenue, 0), [data]);

  const renderLabel = (props: {
    name?: string;
    value?: number;
    percent?: number;
    x?: number;
    y?: number;
    textAnchor?: "inherit" | "start" | "middle" | "end";
  }) => {
    const { name = "", value = 0, percent = 0, x = 0, y = 0, textAnchor = "middle" } = props;
    const revenue = data.find((d) => d.name === name)?.revenue ?? 0;
    return (
      <text x={x} y={y} textAnchor={textAnchor} fill="var(--foreground)" fontSize={14}>
        <tspan x={x} dy="-0.2em">{`${name}: ${value} (${(percent * 100).toFixed(0)}%)`}</tspan>
        <tspan x={x} dy="1.2em" fill="var(--muted-foreground)">
          {formatUsd(revenue)}
        </tspan>
      </text>
    );
  };

  return (
    <Card className="p-4">
      <div className="mb-3">
        <h2 className="text-base font-semibold">Customer Feedback</h2>
        <p className="text-[11px] text-muted-foreground">
          สัดส่วน Customer Feedback ตามตัวกรองที่เลือก · คลิกที่ชิ้นส่วนเพื่อดูรายละเอียด
          {totalRevenue > 0 && (
            <span className="ml-1">· รวม Revenue {formatUsd(totalRevenue)}</span>
          )}
        </p>
      </div>
      {data.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="h-[280px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Tooltip
                contentStyle={{
                  background: "var(--popover)",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  fontFamily: "Kanit",
                  fontSize: 12,
                }}
                labelStyle={{ display: "none" }}
                formatter={(value: number, name: string, props: { payload?: { revenue?: number } }) => {
                  const revenue = props?.payload?.revenue ?? 0;
                  return [`${value.toLocaleString()} รายการ · Revenue ${formatUsd(revenue)}`, name];
                }}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                outerRadius={85}
                dataKey="value"
                nameKey="name"
                label={renderLabel}
                labelLine
                onClick={(entry: { name?: string }) => {
                  if (onDrill && entry?.name) onDrill(entry.name);
                }}
                style={{ cursor: onDrill ? "pointer" : "default" }}
              >
                {data.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={`var(--chart-${(index % 5) + 1})`}
                    onClick={() => onDrill?.(entry.name)}
                  />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  );
}

function DeliveredShipmentChart({
  rows,
  onDrill,
}: {
  rows: NpiRow[];
  onDrill?: (status: "ontime" | "delay" | "unknown") => void;
}) {
  const data = useMemo(() => {
    let onTime = 0;
    let delay = 0;
    let unknown = 0;
    for (const r of rows) {
      const s = shipmentStatus(r.Shipment, r.EstimateShipment);
      if (s === "on-time") onTime++;
      else if (s === "delay") delay++;
      else unknown++;
    }
    const arr = [
      { key: "ontime", name: "On-time", value: onTime, color: "#22c55e" },
      { key: "delay", name: "Delay", value: delay, color: "#ef4444" },
    ] as const;
    if (unknown > 0) {
      (arr as unknown as Array<{ key: string; name: string; value: number; color: string }>).push({
        key: "unknown",
        name: "No date",
        value: unknown,
        color: "#94a3b8",
      });
    }
    return arr;
  }, [rows]);

  const total = rows.length;
  const pct = (v: number) => (total ? ((v / total) * 100).toFixed(1) : "0.0");

  return (
    <Card className="p-4">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold">Delivered — Shipment vs Estimate</h2>
          <p className="text-[11px] text-muted-foreground">
            สรุปรวมทั้งปี · เปรียบเทียบ On-time กับ Delay · คลิกที่ชิ้นส่วนเพื่อดูรายละเอียด
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-[11px]">
          {data.map((d) => (
            <span key={d.key} className="rounded-md border px-2 py-0.5">
              <span
                className="mr-1 inline-block h-2 w-2 rounded-sm align-middle"
                style={{ backgroundColor: d.color }}
              />
              {d.name} {d.value.toLocaleString()} ({pct(d.value)}%)
            </span>
          ))}
        </div>
      </div>
      {total === 0 ? (
        <EmptyState />
      ) : (
        <div className="h-[260px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Tooltip
                contentStyle={{
                  background: "var(--popover)",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  fontFamily: "Kanit",
                  fontSize: 12,
                }}
                labelStyle={{ display: "none" }}
                formatter={(value: number, name: string) => [`${value.toLocaleString()} รายการ`, name]}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Pie
                data={data as unknown as Array<{ name: string; value: number; color: string; key: string }>}
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={80}
                dataKey="value"
                nameKey="name"
                label={({ name, value, percent }) => `${name}: ${value} (${(percent * 100).toFixed(0)}%)`}
                labelLine
              >
                {data.map((entry) => (
                  <Cell
                    key={entry.key}
                    fill={entry.color}
                    onClick={() => onDrill?.(entry.key as "ontime" | "delay" | "unknown")}
                    style={{ cursor: onDrill ? "pointer" : "default" }}
                  />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  );
}


function DashboardSkeleton() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card/50">
        <div className="mx-auto max-w-[1400px] px-6 py-5">
          <div className="h-7 w-64 animate-pulse rounded bg-muted" />
          <div className="mt-2 h-4 w-80 animate-pulse rounded bg-muted" />
        </div>
      </header>
      <main className="mx-auto max-w-[1400px] space-y-6 px-6 py-6">
        <div className="h-24 animate-pulse rounded-lg bg-muted" />
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
        <div className="h-[400px] animate-pulse rounded-lg bg-muted" />
        <div className="h-[400px] animate-pulse rounded-lg bg-muted" />
      </main>
    </div>
  );
}

function AsmlDashboard() {
  const { data, isFetching, isLoading, refetch, error } = useQuery(asmlQuery);
  const rows: AsmlRow[] = data ?? [];

  const [year, setYear] = useState<string>(ALL);
  const [product, setProduct] = useState<string>(ALL);
  const [plan, setPlan] = useState<string>(ALL);
  const [chartType, setChartType] = useState<"bar" | "line">("bar");

  const uniq = (arr: (string | number)[]) =>
    Array.from(new Set(arr.filter((v) => v !== "" && v != null))).sort((a, b) =>
      String(a).localeCompare(String(b)),
    );

  const years = useMemo(() => uniq(rows.map((r) => r.PlanYear).filter((y) => y > 0)), [rows]);
  const products = useMemo(() => uniq(rows.map((r) => r.Product)), [rows]);
  const plans = useMemo(() => uniq(rows.map((r) => r.PlanYearMonth).filter((p) => !!p)), [rows]);

  const filtered = useMemo(
    () =>
      rows.filter(
        (r) =>
          (year === ALL || String(r.PlanYear) === year) &&
          (product === ALL || r.Product === product) &&
          (plan === ALL || r.PlanYearMonth === plan),
      ),
    [rows, year, product, plan],
  );

  const chartData = useMemo(() => {
    const map = new Map<string, { YearMonth: string; Count: number; Quantity: number }>();
    for (const r of filtered) {
      const k = r.PlanYearMonth || "Unknown";
      const cur = map.get(k) ?? { YearMonth: k, Count: 0, Quantity: 0 };
      cur.Count += 1;
      cur.Quantity += r.Quantity;
      map.set(k, cur);
    }
    return Array.from(map.values()).sort((a, b) => a.YearMonth.localeCompare(b.YearMonth));
  }, [filtered]);

  const totalQty = filtered.reduce((s, r) => s + r.Quantity, 0);

  const reset = () => {
    setYear(ALL);
    setProduct(ALL);
    setPlan(ALL);
  };

  if (isLoading) return <DashboardSkeleton />;
  if (error)
    return (
      <div className="flex min-h-[60vh] items-center justify-center p-6 text-center">
        <div>
          <h2 className="text-xl font-semibold">โหลดข้อมูลไม่สำเร็จ</h2>
          <p className="mt-2 text-sm text-muted-foreground">{(error as Error).message}</p>
          <Button onClick={() => refetch()} className="mt-4">
            <RefreshCw className="mr-2 h-4 w-4" /> ลองอีกครั้ง
          </Button>
        </div>
      </div>
    );

  return (
    <>
      <header className="border-b bg-card/50 backdrop-blur">
        <div className="mx-auto flex max-w-[1400px] flex-col gap-1 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">ASML Analytics</h1>
            <p className="text-sm text-muted-foreground">
              Real-time dashboard for ASML production plan
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
            {isFetching ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 h-4 w-4" />
            )}
            Refresh Data
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-[1400px] space-y-6 px-6 py-6">
        <Card className="p-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <FilterSelect label="Year" value={year} onChange={setYear} options={years.map(String)} />
            <FilterSelect label="Product" value={product} onChange={setProduct} options={products.map(String)} />
            <FilterSelect label="Plan" value={plan} onChange={setPlan} options={plans.map(String)} />
            <div className="flex items-end">
              <Button variant="outline" onClick={reset} className="w-full">
                <RefreshCw className="mr-2 h-4 w-4" />
                Reset Filters
              </Button>
            </div>
          </div>
        </Card>

        <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
          <KpiCard label="Total Records" value={filtered.length.toLocaleString()} icon={<Package className="h-4 w-4" />} />
          <KpiCard label="Total Quantity" value={totalQty.toLocaleString()} icon={<BarChart3 className="h-4 w-4" />} />
          <KpiCard label="Products" value={uniq(filtered.map((r) => r.Product)).length.toLocaleString()} icon={<LineIcon className="h-4 w-4" />} />
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <Card className="p-5 lg:col-span-2">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold">Products by Plan Month</h2>
                <p className="text-xs text-muted-foreground">
                  จำนวน Product แยกตาม YearMonth ตามตัวกรองที่เลือก
                </p>
              </div>
              <div className="flex gap-1 rounded-md border p-0.5">
                <button
                  onClick={() => setChartType("bar")}
                  className={`rounded px-3 py-1 text-xs font-medium transition ${
                    chartType === "bar"
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Bar
                </button>
                <button
                  onClick={() => setChartType("line")}
                  className={`rounded px-3 py-1 text-xs font-medium transition ${
                    chartType === "line"
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Line
                </button>
              </div>
            </div>
            {chartData.length === 0 ? (
              <EmptyState />
            ) : (
              <div className="h-[360px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  {chartType === "bar" ? (
                    <BarChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 10 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                      <XAxis dataKey="YearMonth" tick={{ fontSize: 12 }} stroke="var(--muted-foreground)" />
                      <YAxis tick={{ fontSize: 12 }} stroke="var(--muted-foreground)" domain={[0, Math.max(...chartData.map((d) => d.Count), 1) + 2]} />
                      <Tooltip
                        contentStyle={{
                           background: "var(--popover)",
                           border: "1px solid var(--border)",
                           borderRadius: 8,
                           fontFamily: "Kanit",
                        }}
                      />
                      <Legend />
                      <Bar dataKey="Count" name="Products" fill="var(--chart-1)" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  ) : (
                    <LineChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 10 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                      <XAxis dataKey="YearMonth" tick={{ fontSize: 12 }} stroke="var(--muted-foreground)" />
                      <YAxis tick={{ fontSize: 12 }} stroke="var(--muted-foreground)" domain={[0, Math.max(...chartData.map((d) => d.Count), 1) + 2]} />
                      <Tooltip
                        contentStyle={{
                           background: "var(--popover)",
                           border: "1px solid var(--border)",
                           borderRadius: 8,
                           fontFamily: "Kanit",
                        }}
                      />
                      <Legend />
                      <Line type="monotone" dataKey="Count" name="Products" stroke="var(--chart-1)" strokeWidth={2} dot={{ r: 3 }} />
                    </LineChart>
                  )}
                </ResponsiveContainer>
              </div>
            )}
          </Card>

          <AsmlStatusPieChart rows={filtered} />
        </div>

        <AsmlTable rows={filtered} />
      </main>
    </>
  );
}

function AsmlStatusPieChart({ rows }: { rows: AsmlRow[] }) {
  const data = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of rows) {
      const s = r.Status || "Unknown";
      map.set(s, (map.get(s) || 0) + 1);
    }
    return Array.from(map.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [rows]);

  const getStatusColor = (name: string, index: number) => {
    const v = name.toLowerCase().replace(/\s/g, "");
    if (v === "delivered") return "#22c55e";
    if (v === "inprogress") return "#94a3b8";
    if (v === "inproduction") return "#facc15";
    if (v === "partialdelivered") return "#86efac";
    return `var(--chart-${(index % 5) + 1})`;
  };

  return (
    <Card className="p-5">
      <div className="mb-4">
        <h2 className="text-lg font-semibold">Status of projects</h2>
        <p className="text-xs text-muted-foreground">
          สัดส่วนสถานะของ Product ตามตัวกรองที่เลือก
        </p>
      </div>
      {data.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="h-[360px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Tooltip
                contentStyle={{
                  background: "var(--popover)",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  fontFamily: "Kanit",
                }}
                labelStyle={{ display: "none" }}
                formatter={(value: number, name: string) => [`${value.toLocaleString()} รายการ`, name]}
              />
              <Legend />
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                outerRadius={70}
                dataKey="value"
                nameKey="name"
                label={({ percent, value }) => `${value} (${(percent * 100).toFixed(0)}%)`}
                labelLine
              >
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={getStatusColor(entry.name, index)} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  );
}

function AsmlTable({ rows }: { rows: AsmlRow[] }) {
  const [page, setPage] = useState(1);
  const pageSize = 10;
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * pageSize;
  const pageRows = rows.slice(start, start + pageSize);

  return (
    <Card className="overflow-hidden p-0">
      <div className="flex items-center justify-between border-b px-5 py-4">
        <div>
          <h2 className="text-lg font-semibold">Filtered Records</h2>
          <p className="text-xs text-muted-foreground">{rows.length.toLocaleString()} รายการ</p>
        </div>
      </div>
      {rows.length === 0 ? (
        <div className="p-10">
          <EmptyState />
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40">
                  {["No", "Product", "Description", "Article", "Status", "Plan", "QTY.", "Remark"].map((h) => (
                    <TableHead key={h} className="whitespace-nowrap text-xs font-semibold uppercase tracking-wide">
                      {h}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {pageRows.map((r) => (
                  <TableRow key={r.No} className="text-sm">
                    <TableCell className="font-mono text-xs text-muted-foreground">{r.No}</TableCell>
                    <TableCell className="font-medium">{r.Product}</TableCell>
                    <TableCell className="max-w-[280px] truncate" title={r.Description}>
                      {r.Description}
                    </TableCell>
                    <TableCell className="font-mono text-xs">{r.Article}</TableCell>
                    <TableCell>
                      <StatusBadge value={r.Status} />
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-xs">{r.Plan || "-"}</TableCell>
                    <TableCell className="text-right tabular-nums">{r.Quantity.toLocaleString()}</TableCell>
                    <TableCell className="max-w-[240px] truncate text-xs" title={r.Remark}>
                      {r.Remark || "-"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="flex items-center justify-between border-t px-5 py-3">
            <span className="text-xs text-muted-foreground">
              แสดง {start + 1}–{Math.min(start + pageSize, rows.length)} จาก {rows.length.toLocaleString()}
            </span>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={safePage <= 1}>
                ก่อนหน้า
              </Button>
              <span className="text-xs text-muted-foreground">
                หน้า {safePage} / {totalPages}
              </span>
              <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={safePage >= totalPages}>
                ถัดไป
              </Button>
            </div>
          </div>
        </>
      )}
    </Card>
  );
}
