import { createServerFn } from "@tanstack/react-start";

export type RecentApproval = { row_no: number; feedback: string; approved_at: string; kind: string };

export const getRecentApprovals = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabaseAdmin
    .from("recent_approvals")
    .select("row_no, feedback, approved_at, kind")
    .gte("approved_at", since);
  if (error) return [] as RecentApproval[];
  return (data ?? []) as RecentApproval[];
});
