import { createServerFn } from "@tanstack/react-start";
import { setResponseHeader } from "@tanstack/react-start/server";
import { validateFeedbackUpdate } from "./feedback.schema";
import { saveFeedback } from "./feedback.server";
import { isWaitingFeedback } from "./recent-approvals";

export const updateCustomerFeedback = createServerFn({ method: "POST" })
  .inputValidator(validateFeedbackUpdate)
  .handler(async ({ data }) => {
    setResponseHeader("Cache-Control", "no-store");
    const result = await saveFeedback(data);
    // Only after the Sheet write is confirmed (passcode verified by Apps Script).
    const feedback = data.updates["Customer feedback"].trim();
    if (result.ok) {
      const kind = isWaitingFeedback(feedback) ? "remark" : "approval";
      try {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        await supabaseAdmin.from("recent_approvals").upsert({
          row_no: data.no, feedback, approved_at: new Date().toISOString(), kind,
        });
      } catch {
        // Sheet is the source of truth; history is best-effort.
      }
    }
    return result;
  });
