import { WorkflowFailedEventData } from "@context-whisperer/core";
import { logger } from "./logger";

export function handleWorkerError(
  err: unknown,
  context: { jobId?: string; requisitionId?: string; threadId?: string },
): WorkflowFailedEventData {
  // Always log the full, raw error with stack trace and metadata via Pino
  logger.error(
    {
      err,
      jobId: context.jobId,
      requisitionId: context.requisitionId,
      threadId: context.threadId,
    },
    "Worker job encountered an error during workflow execution",
  );

  // Check for known domain errors or template errors
  if (err instanceof Error) {
    if (
      err.message.includes("não encontrado no banco") ||
      err.message.toLowerCase().includes("template")
    ) {
      return {
        statusCode: 500,
        code: "TEMPLATE_NOT_FOUND",
        message: "Required template was not found in the database",
      };
    }

    if (
      err.message.toLowerCase().includes("rate limit") ||
      err.message.includes("429")
    ) {
      return {
        statusCode: 429,
        code: "RATE_LIMIT_EXCEEDED",
        message: "AI service rate limit exceeded. Please try again later.",
      };
    }
  }

  // Universal Default Fallback: HTTP 500 Internal Server Error (Sanitized)
  return {
    statusCode: 500,
    code: "INTERNAL_SERVER_ERROR",
    message: "Internal server error during project workflow execution",
  };
}
