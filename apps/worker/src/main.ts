import { Worker } from 'bullmq';
import IORedis from 'ioredis';
import { buildGraph } from './workflows/agents/graph';

async function bootstrap() {
  console.log('👷 Iniciando Worker do Context-Whisperer...');

  const connection = new IORedis(process.env.REDIS_URL || 'redis://localhost:6379', {
    maxRetriesPerRequest: null,
  });

  // Inicializa o grafo do LangGraph (pode envolver setup de DB)
  const graph = await buildGraph();
  console.log('✅ LangGraph inicializado no Worker.');

  const worker = new Worker(
    'ai-generation',
    async (job) => {
      console.log(`[Worker] Processando Job ${job.id}...`);
      const { projectRequest, requisitionId, userId, threadId } = job.data;

      const initialState = {
        projectRequest,
        messages: [],
        requisitionId,
        userId,
      };

      try {
        const result = await graph.invoke(initialState, {
          configurable: {
            thread_id: threadId,
          },
        });
        console.log(`[Worker] Job ${job.id} concluído com sucesso!`);
        return result;
      } catch (err) {
        console.error(`[Worker] Erro no Job ${job.id}:`, err);
        throw err;
      }
    },
    { connection }
  );

  worker.on('failed', (job, err) => {
    console.error(`🚨 Job ${job?.id} falhou com o erro: ${err.message}`);
  });

  console.log('🎧 Worker escutando a fila "ai-generation"...');
}

bootstrap().catch(console.error);
