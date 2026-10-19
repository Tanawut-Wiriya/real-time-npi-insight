import { createServerFn } from "@tanstack/react-start";
import { setResponseHeader } from "@tanstack/react-start/server";
import { validateFeedbackUpdate } from "./feedback.schema";
import { saveFeedback } from "./feedback.server";

export const updateCustomerFeedback = createServerFn({ method: "POST" })
  .inputValidator(validateFeedbackUpdate)
  .handler(async ({ data }) => {
    setResponseHeader("Cache-Control", "no-store");
    return saveFeedback(data);
  });