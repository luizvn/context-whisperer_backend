import "dotenv/config";
import { Worker, Job } from "bullmq";
import IORedis from "ioredis";
import { buildGraph } from './workflows/agents/graph';
import { prisma } from '@context-whisperer/database';
import { GenerationJobData, processGenerationJob } from './processors/generation.processor';

async function bootstrap() {
  console.log('👷 Iniciando Worker do Context-Whisperer...');

  const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
  const connection = new IORedis(redisUrl, {
    maxRetriesPerRequest: null,
  });

  const redisPublisher = new IORedis(redisUrl);

  // Inicializa o grafo do LangGraph com MongoDBSaver
  const graph = await buildGraph();
  console.log('✅ LangGraph inicializado no Worker com MongoDB Checkpointer.');

  const worker = new Worker<GenerationJobData>(
    'ai-generation',
    async (job: Job<GenerationJobData>) => {
      console.log(`[Worker] Processando Job ${job.id}...`);
      const result = await processGenerationJob(job, graph, redisPublisher);
      console.log(`[Worker] Job ${job.id} concluído com sucesso!`);
      return result;
    },
    { connection },
  );

  worker.on('failed', (job, err) => {
    console.error(`🚨 Job ${job?.id} falhou com o erro: ${err.message}`);
  });

  console.log('🎧 Worker escutando a fila "ai-generation"...');

  // Graceful shutdown
  const shutdown = async () => {
    console.log("🛑 Encerrando Worker...");
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

bootstrap().catch(console.error);
