import {
  WorkflowFailedEventData,
  DomainException,
} from "@context-whisperer/core";
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

  // 1. Check for DomainException (TemplateNotFound, UnsupportedArtifact, etc.)
  if (err instanceof DomainException) {
    return {
      statusCode: err.statusCode,
      code: err.code,
      message: err.message,
    };
  }

  // 2. Check for known provider errors (e.g. rate limit)
  if (err instanceof Error) {
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
