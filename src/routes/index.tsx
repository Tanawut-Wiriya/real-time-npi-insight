import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
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
  Inbox,
  LineChart as LineIcon,
  Loader2,
  Package,
  RefreshCw,
  Truck,
} from "lucide-react";
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

  const uniq = (arr: (string | number)[]) =>
    Array.from(new Set(arr.filter((v) => v !== "" && v != null))).sort((a, b) =>
      String(a).localeCompare(String(b)),
    );

  const years = useMemo(() => uniq(rows.map((r) => r.Year)), [rows]);
  const months = useMemo(
    () =>
      uniq(
        rows
          .map((r) => r.YearMonth?.split("-")[1])
          .filter((m): m is string => !!m),
      ),
    [rows],
  );
  const statuses = useMemo(() => uniq(rows.map((r) => r.Status)), [rows]);
  const products = useMemo(() => uniq(rows.map((r) => r.Product)), [rows]);

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
  const [showTotal, setShowTotal] = useState(false);
  const [showDelivered, setShowDelivered] = useState(false);
  const [deliveredFilter, setDeliveredFilter] = useState<"all" | "ontime" | "delay">("all");
  const [deliveredMonth, setDeliveredMonth] = useState<string | null>(null);

  const filtered = useMemo(
    () =>
      rows.filter(
        (r) =>
          (year === ALL || String(r.Year) === year) &&
          (month === ALL || r.YearMonth?.split("-")[1] === month) &&
          (status === ALL || r.Status === status) &&
          (product === ALL || r.Product === product),
      ),
    [rows, year, month, status, product],
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

  const totalQty = filtered.reduce((s, r) => s + r.Quantity, 0);
  const delivered = useMemo(
    () => filtered.filter((r) => /deliver/i.test(r.Status)).length,
    [filtered],
  );
  const inProgress = filtered.filter(
    (r) => /in production|in progress/i.test(r.Status),
  ).length;
  const inProgressRows = useMemo(
    () => filtered.filter((r) => /in production|in progress/i.test(r.Status)),
    [filtered],
  );

  const deliveredRows = useMemo(
    () => filtered.filter((r) => /deliver/i.test(r.Status)),
    [filtered],
  );

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

  const deliveredByMonth = useMemo(() => {
    const map = new Map<string, { month: string; onTime: number; delay: number; unknown: number; total: number }>();
    for (const { row, shipStatus } of deliveredShipment.withStatus) {
      const m = row.Shipment && row.Shipment !== "-" ? row.Shipment.slice(0, 7) : "No date";
      const cur = map.get(m) ?? { month: m, onTime: 0, delay: 0, unknown: 0, total: 0 };
      if (shipStatus === "on-time") cur.onTime++;
      else if (shipStatus === "delay") cur.delay++;
      else cur.unknown++;
      cur.total++;
      map.set(m, cur);
    }
    const arr = Array.from(map.values()).sort((a, b) => b.total - a.total);
    const grand = arr.reduce((s, x) => s + x.total, 0);
    let cum = 0;
    return arr.map((x) => {
      cum += x.total;
      return { ...x, cumulativePct: grand ? +((cum / grand) * 100).toFixed(1) : 0 };
    });
  }, [deliveredShipment]);

  const deliveredMonthRows = useMemo(() => {
    if (!deliveredMonth) return [];
    return deliveredRows.filter((r) => {
      const m = r.Shipment && r.Shipment !== "-" ? r.Shipment.slice(0, 7) : "No date";
      return m === deliveredMonth;
    });
  }, [deliveredMonth, deliveredRows]);

  const drillRows = useMemo(
    () => (drillStatus ? filtered.filter((r) => r.Status === drillStatus) : []),
    [filtered, drillStatus],
  );

  const reset = () => {
    setYear(ALL);
    setMonth(ALL);
    setStatus(ALL);
    setProduct(ALL);
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
        <Card className="p-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
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
              label="Product"
              value={product}
              onChange={setProduct}
              options={products.map(String)}
            />
            <div className="flex items-end">
              <Button variant="outline" onClick={reset} className="w-full">
                <RefreshCw className="mr-2 h-4 w-4" />
                Reset Filters
              </Button>
            </div>
          </div>
        </Card>

        {/* KPIs */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <KpiCard
            label="Total Projects"
            value={filtered.length.toLocaleString()}
            icon={<Package className="h-4 w-4" />}
            onClick={() => setShowTotal(true)}
          />
          <KpiCard
            label="Total Quantity"
            value={totalQty.toLocaleString()}
            icon={<BarChart3 className="h-4 w-4" />}
          />
          <KpiCard
            label="Delivered"
            value={delivered.toLocaleString()}
            icon={<Truck className="h-4 w-4" />}
            onClick={() => {
              setDeliveredFilter("all");
              setShowDelivered(true);
            }}
          />
          <KpiCard
            label="In progress"
            value={inProgress.toLocaleString()}
            icon={<LineIcon className="h-4 w-4" />}
            onClick={() => setShowInProgress(true)}
          />
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Product Count Chart */}
          <Card className="p-5">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold">Projects Count by Month</h2>
                <p className="text-xs text-muted-foreground">
                  จำนวน Project ต่อเดือน ตามตัวกรองที่เลือก
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
              <div className="h-[340px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  {chartType === "bar" ? (
                    <BarChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 10 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                      <XAxis dataKey="YearMonth" tick={{ fontSize: 12 }} stroke="var(--muted-foreground)" />
                      <YAxis tick={{ fontSize: 12 }} stroke="var(--muted-foreground)" />
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
                      <YAxis tick={{ fontSize: 12 }} stroke="var(--muted-foreground)" />
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

          {/* Status Pie Chart */}
          <StatusPieChart rows={filtered} onDrill={setDrillStatus} />
        </div>

        {/* Delivered Shipment (On-time vs Delay) — per Shipment month */}
        <DeliveredShipmentChart
          data={deliveredByMonth}
          onDrillMonth={(m) => setDeliveredMonth(m)}
        />

        {/* Customer Feedback Chart */}
        <FeedbackChart rows={filtered} />

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

      {showTotal && (
        <StatusDrilldownModal
          status="Total Projects"
          rows={filtered}
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
                : "Delivered — Delay"
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

      {deliveredMonth && (
        <StatusDrilldownModal
          status={`Delivered — ${deliveredMonth}`}
          rows={deliveredMonthRows}
          onClose={() => setDeliveredMonth(null)}
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
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="w-full">
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
  onClick,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  subValue?: string;
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
      <div className="mt-2 text-2xl font-semibold tracking-tight">{value}</div>
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
    { key: "Status", label: "STATUS" },
    { key: "Delivery", label: "Delivery" },
    { key: "EstimateShipment", label: "Estimate Shipment" },
    { key: "Shipment", label: "Shipment" },
    { key: "CustomerFeedback", label: "Customer Feedback" },
  ];

  return (
    <Card className="overflow-hidden p-0">
      <div className="flex items-center justify-between border-b px-5 py-4">
        <div>
          <h2 className="text-lg font-semibold">Filtered Records</h2>
          <p className="text-xs text-muted-foreground">
            {rows.length.toLocaleString()} รายการ
          </p>
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
                    <TableCell>
                      <StatusBadge value={r.Status} />
                    </TableCell>
                    <TableCell>
                      <DeliveryBadge value={r.Delivery} />
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-xs">{r.EstimateShipment}</TableCell>
                    <TableCell className="whitespace-nowrap text-xs">{r.Shipment}</TableCell>
                    <TableCell className="max-w-[240px] truncate text-xs" title={r.CustomerFeedback}>
                      {r.CustomerFeedback || "-"}
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
    <Card className="p-5">
      <div className="mb-4">
        <h2 className="text-lg font-semibold">Status of projects</h2>
        <p className="text-xs text-muted-foreground">
          สัดส่วนสถานะของ Product ตามตัวกรองที่เลือก · ดับเบิลคลิกที่ชิ้นส่วนเพื่อดูรายละเอียด
        </p>
      </div>
      {data.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="h-[340px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Tooltip
                contentStyle={{
                  background: "var(--popover)",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  fontFamily: "Kanit",
                }}
                formatter={(value: number, name: string) => [`${value.toLocaleString()} รายการ`, name]}
              />
              <Legend />
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                outerRadius={100}
                dataKey="value"
                nameKey="name"
                label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                labelLine
                onDoubleClick={(entry: { name?: string }) => {
                  if (onDrill && entry?.name) onDrill(entry.name);
                }}
                style={{ cursor: onDrill ? "pointer" : "default" }}
              >
                {data.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={getStatusColor(entry.name)}
                    onDoubleClick={() => onDrill?.(entry.name)}
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
              จำนวน {rows.length.toLocaleString()} รายการที่อยู่ในสถานะนี้ (ตามตัวกรองปัจจุบัน)
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="rounded-md p-1.5 text-muted-foreground transition hover:bg-muted hover:text-foreground"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
          </button>
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

function FeedbackChart({ rows }: { rows: NpiRow[] }) {
  const data = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of rows) {
      const fb = (r.CustomerFeedback || "").trim();
      if (!fb || fb === "-") continue;
      map.set(fb, (map.get(fb) || 0) + 1);
    }
    return Array.from(map.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 15);
  }, [rows]);

  return (
    <Card className="p-5">
      <div className="mb-4">
        <h2 className="text-lg font-semibold">Customer Feedback</h2>
        <p className="text-xs text-muted-foreground">
          จำนวนรายการตามประเภท Customer feedback (สูงสุด 15 อันดับ)
        </p>
      </div>
      {data.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="h-[400px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Tooltip
                contentStyle={{
                  background: "var(--popover)",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  fontFamily: "Kanit",
                }}
                formatter={(value: number, name: string) => [`${value.toLocaleString()} รายการ`, name]}
              />
              <Legend />
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                outerRadius={120}
                dataKey="value"
                nameKey="name"
                label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                labelLine
              >
                {data.map((_, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={`var(--chart-${(index % 5) + 1})`}
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

interface DeliveredMonthDatum {
  month: string;
  onTime: number;
  delay: number;
  unknown: number;
  total: number;
  cumulativePct: number;
}

function DeliveredShipmentChart({
  data,
  onDrillMonth,
}: {
  data: DeliveredMonthDatum[];
  onDrillMonth: (month: string) => void;
}) {
  const totals = data.reduce(
    (s, d) => ({
      onTime: s.onTime + d.onTime,
      delay: s.delay + d.delay,
      unknown: s.unknown + d.unknown,
      total: s.total + d.total,
    }),
    { onTime: 0, delay: 0, unknown: 0, total: 0 },
  );
  const pct = (v: number) => (totals.total ? ((v / totals.total) * 100).toFixed(1) : "0.0");

  return (
    <Card className="p-5">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Delivered — Shipment vs Estimate</h2>
          <p className="text-xs text-muted-foreground">
            แยกตามเดือนของ Shipment · เปรียบเทียบ On-time กับ Delay · คลิกที่แท่งเพื่อดูรายละเอียด
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs">
          <span className="rounded-md border px-2 py-1">
            <span className="mr-1 inline-block h-2 w-2 rounded-sm align-middle" style={{ backgroundColor: "#22c55e" }} />
            On-time {totals.onTime.toLocaleString()} ({pct(totals.onTime)}%)
          </span>
          <span className="rounded-md border px-2 py-1">
            <span className="mr-1 inline-block h-2 w-2 rounded-sm align-middle" style={{ backgroundColor: "#ef4444" }} />
            Delay {totals.delay.toLocaleString()} ({pct(totals.delay)}%)
          </span>
          {totals.unknown > 0 && (
            <span className="rounded-md border px-2 py-1">
              <span className="mr-1 inline-block h-2 w-2 rounded-sm align-middle" style={{ backgroundColor: "#94a3b8" }} />
              No date {totals.unknown.toLocaleString()}
            </span>
          )}
        </div>
      </div>
      {data.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="h-[380px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={{ top: 10, right: 40, left: 0, bottom: 10 }}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
              <XAxis dataKey="month" tick={{ fontSize: 12, fontFamily: "Kanit" }} />
              <YAxis yAxisId="left" allowDecimals={false} tick={{ fontSize: 12, fontFamily: "Kanit" }} />
              <YAxis
                yAxisId="right"
                orientation="right"
                domain={[0, 100]}
                unit="%"
                tick={{ fontSize: 12, fontFamily: "Kanit" }}
              />
              <Tooltip
                contentStyle={{
                  background: "var(--popover)",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  fontFamily: "Kanit",
                }}
                formatter={(value: number, name: string) => {
                  if (name === "Cumulative %") return [`${value}%`, name];
                  return [value.toLocaleString(), name];
                }}
              />
              <Legend />
              <Bar
                yAxisId="left"
                dataKey="onTime"
                stackId="s"
                name="On-time"
                fill="#22c55e"
                cursor="pointer"
                onClick={(d: DeliveredMonthDatum) => d?.month && onDrillMonth(d.month)}
              />
              <Bar
                yAxisId="left"
                dataKey="delay"
                stackId="s"
                name="Delay"
                fill="#ef4444"
                cursor="pointer"
                onClick={(d: DeliveredMonthDatum) => d?.month && onDrillMonth(d.month)}
              />
              {totals.unknown > 0 && (
                <Bar
                  yAxisId="left"
                  dataKey="unknown"
                  stackId="s"
                  name="No date"
                  fill="#94a3b8"
                  cursor="pointer"
                  onClick={(d: DeliveredMonthDatum) => d?.month && onDrillMonth(d.month)}
                />
              )}
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="cumulativePct"
                name="Cumulative %"
                stroke="#f59e0b"
                strokeWidth={2}
                dot={{ r: 3 }}
              />
            </ComposedChart>
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
                      <YAxis tick={{ fontSize: 12 }} stroke="var(--muted-foreground)" />
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
                      <YAxis tick={{ fontSize: 12 }} stroke="var(--muted-foreground)" />
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
