import { z } from "zod";

export const feedbackUpdateSchema = z.object({
  no: z.number().int().positive(),
  token: z.string().min(1).max(4096),
  updates: z.object({
    "Customer feedback": z.string().max(200),
    "Remark customer feedback": z.string().max(5000),
  }).strict(),
}).strict();

export type FeedbackUpdate = z.infer<typeof feedbackUpdateSchema>;

export function validateFeedbackUpdate(input: unknown): FeedbackUpdate {
  const parsed = feedbackUpdateSchema.safeParse(input);
  if (!parsed.success) throw new Error("ข้อมูลแก้ไขไม่ถูกต้อง กรุณาตรวจสอบสองช่องและรหัสยืนยัน");
  if (Object.values(parsed.data.updates).some((value) => value.trimStart().startsWith("="))) {
    throw new Error("กรุณากรอกข้อความแทนสูตร Google Sheet");
  }
  return parsed.data;
}