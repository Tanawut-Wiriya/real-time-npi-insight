export const RECENT_APPROVAL_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;

export function isWaitingFeedback(feedback: string): boolean {
  return /^w\.?customer$/i.test(feedback.trim());
}

/** A row stays in Wait Approval for 7 days after it leaves W.Customer. */
export function isRecentlyApproved(approvedAt: string, feedback: string, now = Date.now()): boolean {
  if (isWaitingFeedback(feedback)) return false;
  const t = Date.parse(approvedAt);
  return Number.isFinite(t) && now - t >= 0 && now - t < RECENT_APPROVAL_DAYS * DAY_MS;
}
