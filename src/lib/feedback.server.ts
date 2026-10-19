import { DATA_URL, fetchNpiData } from "./npi.server";
import { validateFeedbackUpdate } from "./feedback.schema";

type SaveResult = { ok: true } | { ok: false; message: string };

// The deployed Apps Script verifies token against WRITE_TOKEN before any write.
// Never log, persist, or return the user-entered credential.
export async function saveFeedback(input: unknown): Promise<SaveResult> {
  const data = validateFeedbackUpdate(input);
  try {
    const before = await fetchNpiData();
    if (before.filter((row) => row.No === data.no).length !== 1) {
      return { ok: false, message: "ไม่พบหมายเลขแถวที่ตรงกันเพียงรายการเดียว กรุณารีเฟรชข้อมูล" };
    }
    const response = await fetch(DATA_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(data),
      redirect: "follow",
      signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok || !response.headers.get("content-type")?.includes("application/json")) {
      return { ok: false, message: "ยังยืนยันการบันทึกไม่ได้ กรุณารีเฟรชเพื่อตรวจสอบข้อมูลและการ Deploy doPost" };
    }
    const result: unknown = await response.json();
    if (!result || typeof result !== "object" || Array.isArray(result)) {
      return { ok: false, message: "Google Apps Script ส่งผลตอบกลับไม่ถูกต้อง กรุณารีเฟรชข้อมูล" };
    }
    const payload = result as Record<string, unknown>;
    if (payload.error === "unauthorized") {
      return { ok: false, message: "รหัสยืนยันไม่ถูกต้อง หรือยังไม่ได้ตั้ง WRITE_TOKEN ใน Google Apps Script" };
    }
    if (payload.ok !== true || payload.error) {
      return { ok: false, message: "บันทึกไม่สำเร็จ กรุณาตรวจสอบ doPost ชื่อแท็บ Raw data และหัวคอลัมน์ใน Google Sheet" };
    }
    const after = await fetchNpiData();
    const saved = after.find((row) => row.No === data.no);
    const expectedFeedback = data.updates["Customer feedback"].replace(/^[:\s]+/, "").trim();
    const expectedRemark = data.updates["Remark customer feedback"].trim();
    if (!saved || saved.CustomerFeedback !== expectedFeedback || saved.FeedbackRemark !== expectedRemark) {
      return { ok: false, message: "Google Apps Script ตอบรับแล้ว แต่ข้อมูลที่อ่านกลับยังไม่ตรง กรุณารีเฟรชและตรวจสอบ Sheet ก่อนบันทึกซ้ำ" };
    }
    return { ok: true };
  } catch {
    return { ok: false, message: "ยังยืนยันการบันทึกไม่ได้ กรุณารีเฟรชเพื่อตรวจสอบข้อมูลก่อนลองใหม่" };
  }
}