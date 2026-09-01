import "dotenv/config";
import { Worker, Job } from "bullmq";
import IORedis from "ioredis";
import { buildGraph } from "./workflows/agents/graph";
import { prisma } from "@context-whisperer/database";
import {
  GenerationJobData,
  processGenerationJob,
} from "./processors/generation.processor";

import { logger } from "./utils/logger";

async function bootstrap() {
  logger.info("Context-Whisperer Worker service initializing");

  const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";
  const connection = new IORedis(redisUrl, {
    maxRetriesPerRequest: null,
  });

  const redisPublisher = new IORedis(redisUrl);

  // Initialize LangGraph with MongoDB Checkpointer
  const graph = await buildGraph();
  logger.info("LangGraph workflow initialized with MongoDB checkpointer");

  const worker = new Worker<GenerationJobData>(
    "ai-generation",
    async (job: Job<GenerationJobData>) => {
      const jobLogger = logger.child({
        jobId: job.id,
        requisitionId: job.data.requisitionId,
        threadId: job.data.threadId,
      });

      jobLogger.info("Processing generation job");
      const startTime = Date.now();
      const result = await processGenerationJob(job, graph, redisPublisher);
      const durationMs = Date.now() - startTime;
      jobLogger.info({ durationMs }, "Generation job completed successfully");
      return result;
    },
    { connection },
  );

  worker.on("failed", (job, err) => {
    logger.error(
      {
        jobId: job?.id,
        requisitionId: job?.data.requisitionId,
        err: err.message,
      },
      "Generation job execution failed",
    );
  });

  logger.info({ queue: "ai-generation" }, "Worker listening to queue");

  // Graceful shutdown
  const shutdown = async () => {
    logger.info("Shutting down worker service");
    await worker.close();
    await connection.quit();
    await redisPublisher.quit();
    await prisma.$disconnect();
    process.exit(0);
  };

  process.on("SIGINT", () => {
    void shutdown();
  });
  process.on("SIGTERM", () => {
    void shutdown();
  });
}

bootstrap().catch((err: unknown) => {
  logger.fatal({ err }, "Worker bootstrap encountered fatal error");
  process.exit(1);
});
